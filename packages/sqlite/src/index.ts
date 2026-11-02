import { RestError, type Dialect, type SqlRenderer } from '@crudy/restloom';
import type { Database } from 'better-sqlite3';
import { introspect } from './introspect.js';
import { SqliteRenderer } from './renderer.js';

export { SqliteRenderer } from './renderer.js';

const CODES: Record<string, [number, string]> = {
    SQLITE_CONSTRAINT_UNIQUE: [409, 'duplicate'],
    SQLITE_CONSTRAINT_PRIMARYKEY: [409, 'duplicate'],
    SQLITE_CONSTRAINT_FOREIGNKEY: [409, 'reference_missing'],
    SQLITE_CONSTRAINT_NOTNULL: [400, 'value_required'],
    SQLITE_CONSTRAINT_CHECK: [400, 'value_rejected'],
    SQLITE_MISMATCH: [400, 'invalid_value'],
};

export function mapError(err: unknown): RestError | null {
    const code = (err as { code?: unknown })?.code;
    const hit = typeof code === 'string' ? CODES[code] : undefined;
    return hit ? new RestError(hit[0], hit[1]) : null;
}

const bindable = (v: unknown) => (v === true ? 1 : v === false ? 0 : v);

export interface SqliteOptions {
    renderer?: SqlRenderer;
}

/**
 * The SQLite dialect over a better-sqlite3 Database. It turns on foreign keys
 * and case-sensitive LIKE for the connection. One connection runs one
 * transaction at a time, so requests are queued. SQLite cannot stop a running
 * statement, so `limits.timeoutMs` does not apply, and it has no functions to
 * call as procedures.
 */
export function sqlite(db: Database, options: SqliteOptions = {}): Dialect {
    db.pragma('foreign_keys = ON');
    db.pragma('case_sensitive_like = ON');
    let queue: Promise<unknown> = Promise.resolve();
    return {
        name: 'sqlite',
        capabilities: { returning: true, estimatedCount: false, rowSecurity: false, procedures: false },
        renderer: options.renderer ?? new SqliteRenderer(),
        decode: (value) => (typeof value === 'string' ? JSON.parse(value) : value),
        introspect: async (scope) => introspect(db, scope),
        transaction(fn) {
            const run = queue.then(async () => {
                db.exec('BEGIN');
                try {
                    const out = await fn({
                        async query(sql, params) {
                            const stmt = db.prepare(sql);
                            const bound = params.map(bindable);
                            return (stmt.reader ? stmt.all(...bound) : (stmt.run(...bound), [])) as Record<string, unknown>[];
                        },
                    });
                    db.exec('COMMIT');
                    return out;
                } catch (err) {
                    if (db.inTransaction) db.exec('ROLLBACK');
                    throw err;
                }
            });
            queue = run.catch(() => undefined);
            return run;
        },
        mapError,
    };
}
