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
    const keys = await c.tx.query(stmt.sql, stmt.params);
    return wantsRows(c.request) ? readBack(c, keys, 201) : { status: 201, headers: {}, body: undefined };
}

export async function update(c: WriteContext, id: string | undefined): Promise<RestResponse> {
    if (!c.resource.write.update) throw new RestError(405, 'method_not_allowed');
    const [row] = bodyRows(c.resource, c.request.body, 'update', 1);
    const scope = pinned(c);
    for (const [col, v] of row) if (scope.has(col) && v !== scope.get(col)) throw new RestError(403, 'out_of_scope', col);
    const where = [...c.scope(c.resource), ...target(c, id)];
    const stmt = c.db.renderer.update(c.resource, [...row], where, c.db.renderer.context(c.scope));
    const keys = await c.tx.query(stmt.sql, stmt.params);
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
    const stmt = c.db.renderer.delete(c.resource, where, c.db.renderer.context(c.scope));
    const keys = await c.tx.query(stmt.sql, stmt.params);
    if (id !== undefined && keys.length === 0) throw notFound();
    if (!before) return { status: 204, headers: {}, body: undefined };
    return { status: 200, headers: {}, body: id !== undefined ? (before.body as unknown[])[0] : before.body };
}
