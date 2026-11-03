import { RestError, type Dialect, type SqlRenderer } from '@crudy/restloom';
import { createPool, type Pool, type PoolOptions } from 'mysql2/promise';
import { introspect } from './introspect.js';
import { MysqlRenderer } from './renderer.js';

export * from '@crudy/restloom';

/** A mysql2/promise Pool, or what opens one: a connection URL or pool options. */
export type MysqlConnection = Pool | PoolOptions | string;

const poolOf = (c: MysqlConnection): Pool =>
    typeof c === 'string' ? createPool({ uri: c }) : typeof (c as Pool).getConnection === 'function' ? (c as Pool) : createPool(c as PoolOptions);

export { MysqlRenderer } from './renderer.js';

const CODES: Record<number, [number, string]> = {
    1062: [409, 'duplicate'],
    1452: [409, 'reference_missing'],
    1451: [409, 'still_referenced'],
    1048: [400, 'value_required'],
    1364: [400, 'value_required'],
    3819: [400, 'value_rejected'],
    1292: [400, 'invalid_value'],
    1264: [400, 'invalid_value'],
    1366: [400, 'invalid_value'],
    1406: [400, 'invalid_value'],
    1142: [403, 'forbidden'],
    3024: [503, 'timeout'],
};

export function mapError(err: unknown): RestError | null {
    const errno = (err as { errno?: unknown })?.errno;
    const hit = typeof errno === 'number' ? CODES[errno] : undefined;
    return hit ? new RestError(hit[0], hit[1]) : null;
}

export interface MysqlOptions {
    renderer?: SqlRenderer;
}

/**
 * The MySQL 8 dialect over a mysql2/promise Pool, given or opened. Each request is one
 * transaction on one connection, in UTC, with MAX_EXECUTION_TIME for reads.
 * Text compares with each column's collation, so with a case-insensitive
 * collation `eq` ignores case.
 */
export function mysql(connection: MysqlConnection, options: MysqlOptions = {}): Dialect {
    const pool = poolOf(connection);
    return {
        name: 'mysql',
        capabilities: { returning: false, estimatedCount: false, rowSecurity: false, procedures: true },
        renderer: options.renderer ?? new MysqlRenderer(),
        decode: (value) => value,
        introspect: (scope) => introspect(pool, scope),
        async transaction(fn, { timeoutMs, readOnly }) {
            const conn = await pool.getConnection();
            try {
                await conn.query(`SET SESSION time_zone = '+00:00', SESSION group_concat_max_len = 1073741824, SESSION MAX_EXECUTION_TIME = ${Math.max(1, Math.floor(timeoutMs))}`);
                await conn.query(readOnly ? 'START TRANSACTION READ ONLY' : 'START TRANSACTION');
                const out = await fn({
                    async query(sql, params) {
                        const [rows] = await conn.query(sql, params);
                        return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
                    },
                });
                await conn.query('COMMIT');
                return out;
            } catch (err) {
                await conn.query('ROLLBACK').catch(() => undefined);
                throw err;
            } finally {
                conn.release();
            }
        },
        mapError,
    };
}
