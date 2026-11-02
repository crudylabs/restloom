import type { Catalog } from './catalog.js';
import type { RestError } from './errors.js';
import type { SqlRenderer } from './sql/renderer.js';

/** A connection inside a transaction. Rows come back as plain objects. */
export interface Tx {
    query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
}

/** What a database can do natively. A request needing something missing is refused with `unsupported`. */
export interface Capabilities {
    /** INSERT/UPDATE/DELETE return the written rows in the same statement. */
    returning: boolean;
    /** A planner estimate for count=estimated. */
    estimatedCount: boolean;
    /** Row security enforced by the database for the session's role. */
    rowSecurity: boolean;
}

export interface Dialect {
    readonly name: string;
    readonly capabilities: Capabilities;
    readonly renderer: SqlRenderer;
    /** Reads the tables, views and functions of the given schemas and tables. */
    introspect(scope: { schemas: string[]; tables: string[] }): Promise<Catalog>;
    /** Runs fn in one transaction with a statement timeout; read-only when asked. */
    transaction<T>(fn: (tx: Tx) => Promise<T>, options: { timeoutMs: number; readOnly: boolean }): Promise<T>;
    /** A database error the client caused, as a RestError; null for anything else, which stays a 500. */
    mapError(err: unknown): RestError | null;
    /** The planner's row estimate for a count query, when estimatedCount is supported. */
    estimate?(tx: Tx, sql: string, params: unknown[]): Promise<number | null>;
}
