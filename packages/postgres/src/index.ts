import { SqlRenderer, type Dialect, type Tx } from '@crudy/restloom';
import pg, { type Pool, type PoolConfig } from 'pg';
import { mapError } from './errors.js';
import { introspect } from './introspect.js';

export * from '@crudy/restloom';
export { mapError } from './errors.js';

/** A pg Pool, or what opens one: a connection string or a pool config. */
export type PostgresConnection = Pool | PoolConfig | string;

const poolOf = (c: PostgresConnection): Pool =>
    typeof c === 'string' ? new pg.Pool({ connectionString: c }) : typeof (c as Pool).connect === 'function' ? (c as Pool) : new pg.Pool(c as PoolConfig);

/** Postgres writes every primitive the core's defaults assume; subclass it to change one. */
export class PostgresRenderer extends SqlRenderer {}

export interface PostgresOptions {
    renderer?: SqlRenderer;
}

/**
 * The Postgres dialect over a `pg` Pool, given or opened from a connection
 * string or config. Every request runs in one transaction
 * with a local statement timeout, read-only for reads, so a `transaction` hook
 * can set the role and session settings that row security reads.
 */
export function postgres(connection: PostgresConnection, options: PostgresOptions = {}): Dialect {
    const pool = poolOf(connection);
    return {
        name: 'postgres',
        capabilities: { returning: true, estimatedCount: true, rowSecurity: true, procedures: true },
        decode: (value) => value,
        renderer: options.renderer ?? new PostgresRenderer(),
        introspect: (scope) => introspect(pool, scope),
        async transaction(fn, { timeoutMs, readOnly }) {
            const client = await pool.connect();
            try {
                await client.query(readOnly ? 'BEGIN READ ONLY' : 'BEGIN');
                await client.query(`SET LOCAL statement_timeout = ${Math.max(1, Math.floor(timeoutMs))}`);
                const tx: Tx = { query: async (sql, params) => (await client.query(sql, params)).rows };
                const out = await fn(tx);
                await client.query('COMMIT');
                return out;
            } catch (err) {
                await client.query('ROLLBACK').catch(() => undefined);
                throw err;
            } finally {
                client.release();
            }
        },
        mapError,
        async estimate(tx, sql, params) {
            const [row] = await tx.query(`EXPLAIN (FORMAT JSON) ${sql}`, params);
            const plan = (row?.['QUERY PLAN'] as { Plan?: { 'Plan Rows'?: number } }[] | undefined)?.[0]?.Plan;
            return typeof plan?.['Plan Rows'] === 'number' ? plan['Plan Rows'] : null;
        },
    };
}
