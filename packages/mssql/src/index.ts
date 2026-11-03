import { RestError, type Dialect, type SqlRenderer } from '@crudy/restloom';
import mssqlDriver, { type ConnectionPool, type config as MssqlConfig } from 'mssql';
import { introspect } from './introspect.js';
import { MssqlRenderer } from './renderer.js';

export * from '@crudy/restloom';

/** A connected mssql ConnectionPool, or what opens one: a connection string or config. */
export type MssqlConnection = ConnectionPool | MssqlConfig | string;

function poolOf(c: MssqlConnection): Promise<ConnectionPool> {
    if (typeof c !== 'string' && typeof (c as ConnectionPool).request === 'function') return Promise.resolve(c as ConnectionPool);
    const ready = new mssqlDriver.ConnectionPool(c as MssqlConfig).connect();
    // A failed connection surfaces on the first request, not as an unhandled rejection at startup.
    ready.catch(() => undefined);
    return ready;
}

export { MssqlRenderer } from './renderer.js';

const CODES: Record<number, [number, string]> = {
    2627: [409, 'duplicate'],
    2601: [409, 'duplicate'],
    515: [400, 'value_required'],
    245: [400, 'invalid_value'],
    241: [400, 'invalid_value'],
    242: [400, 'invalid_value'],
    8114: [400, 'invalid_value'],
    8115: [400, 'invalid_value'],
    2628: [400, 'invalid_value'],
    229: [403, 'forbidden'],
    230: [403, 'forbidden'],
};

/** Error 547 covers both foreign keys and checks; its message tells which. */
export function mapError(err: unknown): RestError | null {
    const e = err as { number?: unknown; code?: unknown; message?: unknown; originalError?: { info?: { number?: unknown; message?: unknown } } };
    if (e?.code === 'ETIMEOUT') return new RestError(503, 'timeout');
    const number = e?.number ?? e?.originalError?.info?.number;
    if (number === 547) {
        const text = String(e.message ?? e.originalError?.info?.message ?? '');
        return /CHECK constraint/i.test(text) ? new RestError(400, 'value_rejected') : new RestError(409, 'reference_missing');
    }
    const hit = typeof number === 'number' ? CODES[number] : undefined;
    return hit ? new RestError(hit[0], hit[1]) : null;
}

export interface MssqlOptions {
    renderer?: SqlRenderer;
}

/**
 * The SQL Server 2022 dialect over an mssql ConnectionPool, given or opened. Each request is one
 * transaction; the statement timeout is the pool's `requestTimeout`, since the
 * driver sets it per pool. Row security is SQL Server's security policies,
 * which a `transaction` hook feeds through sp_set_session_context.
 */
export function mssql(connection: MssqlConnection, options: MssqlOptions = {}): Dialect {
    const ready = poolOf(connection);
    return {
        name: 'mssql',
        capabilities: { returning: true, estimatedCount: false, rowSecurity: true, procedures: true },
        renderer: options.renderer ?? new MssqlRenderer(),
        decode: (value) => (typeof value === 'string' ? JSON.parse(value) : value),
        introspect: async (scope) => introspect(await ready, scope),
        async transaction(fn) {
            const tx = new mssqlDriver.Transaction(await ready);
            await tx.begin();
            try {
                const out = await fn({
                    async query(sql, params) {
                        const req = new mssqlDriver.Request(tx);
                        params.forEach((v, i) => {
                            // Whole numbers beyond 32 bits go as BigInt, or the driver overflows them as Int.
                            if (typeof v === 'number' && Number.isInteger(v) && Math.abs(v) > 2147483647) req.input(`p${i + 1}`, mssqlDriver.BigInt, v);
                            else req.input(`p${i + 1}`, v);
                        });
                        return ((await req.query(sql)).recordset ?? []) as Record<string, unknown>[];
                    },
                });
                await tx.commit();
                return out;
            } catch (err) {
                await tx.rollback().catch(() => undefined);
                throw err;
            }
        },
        mapError,
    };
}
