import type { Dialect, Tx } from './dialect.js';
import { RestError, badRequest, notFound } from './errors.js';
import { bodyRows } from './grammar/body.js';
import { parseRead } from './grammar/read.js';
import type { Limits, RestRequest, RestResponse } from './options.js';
import type { Filter, Value } from './plan.js';
import { keyFilter, readRows } from './read.js';
import type { Resource } from './resources.js';

export interface WriteContext {
    db: Dialect;
    tx: Tx;
    resource: Resource;
    request: RestRequest<unknown>;
    limits: Limits;
    scope: (r: Resource) => Filter[];
}

const wantsRows = (r: RestRequest<unknown>) => /\breturn=representation\b/.test(r.headers.prefer ?? '');

/** The value a scope filter pins a column to, keyed by column. */
function pinned(c: WriteContext): Map<string, Value> {
    const out = new Map<string, Value>();
    for (const f of c.scope(c.resource)) if (f.kind === 'cmp' && f.op === 'eq') out.set(f.path.column, f.value as Value);
    return out;
}

function keysFilter(resource: Resource, keys: Record<string, unknown>[]): Filter {
    const one = (k: Record<string, unknown>): Filter => ({ kind: 'and', negate: false, terms: resource.key.map((col): Filter => ({
        kind: 'cmp', path: { relations: [], column: col }, op: 'eq', negate: false, value: k[col] as Value,
    })) });
    return { kind: 'or', negate: false, terms: keys.map(one) };
}

function selectOnly(request: RestRequest<unknown>, limit: number): URLSearchParams {
    const query = new URLSearchParams({ limit: String(limit) });
    const select = request.query.get('select');
    if (select) query.set('select', select);
    return query;
}

/** Reads the written rows back with the request's select, embeds included. */
async function readBack(c: WriteContext, keys: Record<string, unknown>[], status: number): Promise<RestResponse> {
    if (keys.length === 0) return { status, headers: {}, body: [] };
    const query = selectOnly(c.request, Math.min(keys.length, c.limits.maxPage));
    const read = await readRows(c.db, c.tx, c.resource, { ...c.request, query }, c.limits, c.scope, undefined, [keysFilter(c.resource, keys)]);
    return { status, headers: {}, body: read.body };
}

/**
 * Runs an update or delete and returns the keys it reached. A database
 * without RETURNING locks and reads the keys first, then writes by key, which
 * also keeps it from reading the table it is changing.
 */
async function writeByKeys(c: WriteContext, where: Filter[], write: (where: Filter[]) => { sql: string; params: unknown[] }): Promise<Record<string, unknown>[]> {
    if (c.db.capabilities.returning) {
        const stmt = write(where);
        return c.tx.query(stmt.sql, stmt.params);
    }
    const sel = c.db.renderer.selectKeys(c.resource, where, c.db.renderer.context(c.scope));
    const keys = await c.tx.query(sel.sql, sel.params);
    if (keys.length === 0) return keys;
    const stmt = write([keysFilter(c.resource, keys)]);
    await c.tx.query(stmt.sql, stmt.params);
    return keys;
}

/** The keys of inserted rows: returned by the database, given in the body, or generated in sequence. */
async function insertedKeys(c: WriteContext, returned: Record<string, unknown>[], columns: string[], values: unknown[][]): Promise<Record<string, unknown>[]> {
    if (c.db.capabilities.returning) return returned;
    const key = c.resource.key;
    if (key.every((k) => columns.includes(k))) return values.map((row) => Object.fromEntries(key.map((k) => [k, row[columns.indexOf(k)]])));
    if (key.length !== 1) return [];
    const [first] = await c.tx.query(c.db.renderer.lastInsertId(), []);
    return values.map((_, i) => ({ [key[0]]: Number(first.id) + i }));
}

/** The filters a PATCH or DELETE applies: the id, or the query's filters on a bulk-enabled resource. */
function target(c: WriteContext, id: string | undefined): Filter[] {
    if (id !== undefined) return [keyFilter(c.resource, id)];
    if (!c.resource.write.bulk) throw new RestError(405, 'method_not_allowed');
    const filters = parseRead(c.resource, c.request.query, c.limits).where;
    if (filters.length === 0) throw badRequest('filter_required');
    return filters;
}

export async function create(c: WriteContext): Promise<RestResponse> {
    if (!c.resource.write.create) throw new RestError(405, 'method_not_allowed');
    const rows = bodyRows(c.resource, c.request.body, 'create', c.limits.bodyRows);
    const scope = pinned(c);
    const columns = [...new Set([...rows[0].keys(), ...scope.keys()])];
    const values = rows.map((row) => columns.map((col) => {
        if (scope.has(col) && row.has(col) && row.get(col) !== scope.get(col)) throw new RestError(403, 'out_of_scope', col);
        return scope.has(col) ? scope.get(col) : row.get(col);
    }));
    const stmt = c.db.renderer.insert(c.resource, columns, values, c.db.renderer.context(c.scope));
    const keys = await insertedKeys(c, await c.tx.query(stmt.sql, stmt.params), columns, values);
    return wantsRows(c.request) ? readBack(c, keys, 201) : { status: 201, headers: {}, body: undefined };
}

export async function update(c: WriteContext, id: string | undefined): Promise<RestResponse> {
    if (!c.resource.write.update) throw new RestError(405, 'method_not_allowed');
    const [row] = bodyRows(c.resource, c.request.body, 'update', 1);
    const scope = pinned(c);
    for (const [col, v] of row) if (scope.has(col) && v !== scope.get(col)) throw new RestError(403, 'out_of_scope', col);
    const where = [...c.scope(c.resource), ...target(c, id)];
    const keys = await writeByKeys(c, where, (w) => c.db.renderer.update(c.resource, [...row], w, c.db.renderer.context(c.scope)));
    if (id !== undefined && keys.length === 0) throw notFound();
    if (!wantsRows(c.request)) return { status: 204, headers: {}, body: undefined };
    const back = await readBack(c, keys, 200);
    return id !== undefined ? { ...back, body: (back.body as unknown[])[0] } : back;
}

export async function remove(c: WriteContext, id: string | undefined): Promise<RestResponse> {
    if (!c.resource.write.delete) throw new RestError(405, 'method_not_allowed');
    const where = [...c.scope(c.resource), ...target(c, id)];
    const before = wantsRows(c.request)
        ? await readRows(c.db, c.tx, c.resource, { ...c.request, query: selectOnly(c.request, c.limits.maxPage) }, c.limits, c.scope, undefined, where)
        : null;
    const keys = await writeByKeys(c, where, (w) => c.db.renderer.delete(c.resource, w, c.db.renderer.context(c.scope)));
    if (id !== undefined && keys.length === 0) throw notFound();
    if (!before) return { status: 204, headers: {}, body: undefined };
    return { status: 200, headers: {}, body: id !== undefined ? (before.body as unknown[])[0] : before.body };
}
