import type { Dialect, Tx } from './dialect.js';
import { notFound } from './errors.js';
import { parseRead } from './grammar/read.js';
import type { Limits, RestRequest, RestResponse } from './options.js';
import type { Filter, ReadPlan } from './plan.js';
import type { Resource } from './resources.js';
import { typed } from './grammar/values.js';

async function total(db: Dialect, tx: Tx, plan: ReadPlan, scope: (r: Resource) => Filter[]): Promise<number | null> {
    if (plan.count === 'none') return null;
    const stmt = db.renderer.count(plan, db.renderer.context(scope));
    if (plan.count === 'estimated' && db.capabilities.estimatedCount && db.estimate) {
        const n = await db.estimate(tx, stmt.sql, stmt.params);
        if (n !== null) return n;
    }
    const [row] = await tx.query(stmt.sql, stmt.params);
    return Number(row?.n ?? 0);
}

export function keyFilter(resource: Resource, id: string): Filter {
    if (resource.key.length !== 1) throw notFound();
    const column = resource.all.get(resource.key[0])!;
    let value;
    try { value = typed(id, column.type, column.name); } catch { throw notFound(); }
    return { kind: 'cmp', path: { relations: [], column: column.name }, op: 'eq', negate: false, value };
}

/** GET on a collection, or on one row when id is given. */
export async function readRows(db: Dialect, tx: Tx, resource: Resource, request: RestRequest<unknown>, limits: Limits,
    scope: (r: Resource) => Filter[], id?: string, extra: Filter[] = []): Promise<RestResponse> {
    const plan = parseRead(resource, request.query, limits);
    plan.where.push(...extra);
    const prefer = /\bcount=(exact|estimated)\b/.exec(request.headers.prefer ?? '');
    if (plan.count === 'none' && prefer) plan.count = prefer[1] as 'exact' | 'estimated';
    if (id !== undefined) {
        plan.where.unshift(keyFilter(resource, id));
        plan.limit = 1;
        plan.offset = 0;
        plan.count = 'none';
    }
    const stmt = db.renderer.read(plan, db.renderer.context(scope));
    const rows = (await tx.query(stmt.sql, stmt.params)).map((row) => db.decode(row.r));
    if (id !== undefined) {
        if (rows.length === 0) throw notFound();
        return { status: 200, headers: {}, body: rows[0] };
    }
    const n = await total(db, tx, plan, scope);
    const range = rows.length ? `${plan.offset}-${plan.offset + rows.length - 1}` : '*';
    return { status: 200, headers: { 'content-range': `${range}/${n ?? '*'}` }, body: rows };
}
