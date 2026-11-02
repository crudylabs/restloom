import type { Dialect, Tx } from './dialect.js';
import type { Value } from './plan.js';

export interface Limits {
    /** Rows in a page when the request names no limit. */
    page: number;
    /** Largest limit a request may ask for; more is refused, not clamped. */
    maxPage: number;
    /** Relations a path or an embed may walk through. */
    depth: number;
    /** Filters, including the terms of every or/and, in one request. */
    filters: number;
    /** Items in one in.(...) list. */
    inList: number;
    /** Rows in one write body. */
    bodyRows: number;
    /** Statement timeout, set by the dialect on every transaction. */
    timeoutMs: number;
}

export const DEFAULT_LIMITS: Limits = { page: 50, maxPage: 1000, depth: 2, filters: 50, inList: 500, bodyRows: 1000, timeoutMs: 5000 };

export type RelationOptions =
    | { one: string; via: string; references?: string }
    | { many: string; via: string; references?: string }
    | { many: string; through: string };

export interface WriteOptions {
    /** true: every visible column that is not generated. A list: only those. */
    create?: boolean | string[];
    update?: boolean | string[];
    delete?: boolean;
    /** PATCH and DELETE by filter on the collection, not only by id. */
    bulk?: boolean;
}

export interface ResourceOptions {
    /** false removes a discovered table or view from the API. */
    expose?: boolean;
    /** Columns kept out of the API although their names look harmless. */
    hide?: string[];
    /** Columns shown although their names look sensitive. */
    show?: string[];
    /** Off by default: true allows create, update and delete of visible columns. */
    write?: boolean | WriteOptions;
    /** Columns that identify a row, for a view or a table without a primary key. */
    key?: string[];
    /** Override, add (any other name) or remove (false) a relation. */
    relations?: Record<string, RelationOptions | false>;
}

export interface ProcedureOptions {
    /** Schema-qualified function name. */
    function: string;
    /**
     * POST (default) takes arguments from the body. GET takes them from the
     * query string and runs read-only: use it for a function without side
     * effects, such as a search.
     */
    method?: 'GET' | 'POST';
}

export interface RestRequest<C = unknown> {
    method: string;
    /** Path without the mount prefix, e.g. /assets/42. */
    path: string;
    query: URLSearchParams;
    headers: Record<string, string | undefined>;
    body?: unknown;
    /** Whatever the host passes in; it reaches every hook. */
    context: C;
}

export interface RestResponse {
    status: number;
    headers: Record<string, string>;
    body: unknown;
}

export interface Hooks<C = unknown> {
    /** Throw a RestError to refuse a request before any SQL runs. */
    authorize?(request: RestRequest<C>, target: { resource?: string; procedure?: string; action: 'read' | 'create' | 'update' | 'delete' | 'call' }): void | Promise<void>;
    /** First statement of every transaction: session settings, role, search path. */
    transaction?(tx: Tx, context: C): Promise<void>;
    /** Equality filters added to every query on a resource, for databases without row security. */
    scope?(resource: string, context: C): Record<string, Value> | undefined;
    /** Called with every error answered as a 500, for the host's logs. The client only sees `internal`. */
    onError?(error: unknown, request: RestRequest<C>): void;
}

export interface RestOptions<C = unknown> {
    db: Dialect;
    /** Nothing is served until a schema or a table is named here. */
    expose: { schemas?: string[]; tables?: string[] };
    resources?: Record<string, ResourceOptions>;
    procedures?: Record<string, ProcedureOptions>;
    /** Replaces the default list of sensitive name patterns. */
    sensitive?: RegExp;
    hooks?: Hooks<C>;
    limits?: Partial<Limits>;
}

/** Column names hidden unless shown on purpose. Matched against whole words of the name. */
export const DEFAULT_SENSITIVE = /(^|_)(password|passwd|pwd|hash|hashed|salt|secret|token|api_?key|private_?key|otp|totp|mfa|recovery)(_|$)/i;
