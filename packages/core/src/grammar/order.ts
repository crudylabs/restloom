import { badRequest } from '../errors.js';
import type { Limits } from '../options.js';
import type { OrderTerm, Selection } from '../plan.js';
import type { Resource } from '../resources.js';
import { segments } from './names.js';
import { column, walk } from './resolve.js';
import { splitTopLevel } from './split.js';
import { orderable } from './values.js';

const MODIFIERS = new Set(['asc', 'desc', 'nullsfirst', 'nullslast']);

function orderTerm(resource: Resource, raw: string, limits: Limits): OrderTerm {
    const segs = segments(raw.trim());
    const term: Omit<OrderTerm, 'key'> = { desc: false };
    while (segs.length > 1 && !segs[segs.length - 1].quoted && MODIFIERS.has(segs[segs.length - 1].name)) {
        const m = segs.pop()!.name;
        if (m === 'asc' || m === 'desc') term.desc = m === 'desc';
        else term.nulls = m === 'nullsfirst' ? 'first' : 'last';
    }
    const last = segs[segs.length - 1];
    if (segs.length > 1 && !last.quoted && last.name === 'count') {
        const { relations } = walk(resource, [...segs.slice(0, -1), last], limits.depth);
        const rel = relations[relations.length - 1];
        if (rel.kind !== 'many' || relations.slice(0, -1).some((r) => r.kind !== 'one')) throw badRequest('bad_order', raw);
        return { key: { kind: 'count', relations }, ...term };
    }
    const { relations, resource: owner } = walk(resource, segs, limits.depth);
    if (relations.some((r) => r.kind !== 'one')) throw badRequest('bad_order', raw);
    const col = column(owner, last.name);
    if (!orderable(col.type)) throw badRequest('bad_order', raw);
    return { key: { kind: 'column', path: { relations, column: col.name } }, ...term };
}

/**
 * The order of a read. A grouped read orders by its selected plain columns
 * only. Any other read gets the key appended, so pages never shift.
 */
export function ordering(resource: Resource, raw: string | null, select: Selection, limits: Limits): OrderTerm[] {
    const terms = (raw ? splitTopLevel(raw) : []).filter((t) => t.trim() !== '').map((t) => orderTerm(resource, t, limits));
    if (select.aggregates.length > 0) {
        for (const t of terms) {
            if (t.key.kind !== 'column' || t.key.path.relations.length > 0 || !select.columns.includes(t.key.path.column)) throw badRequest('bad_order', 'a grouped read orders by its selected columns');
        }
        return terms;
    }
    const direct = new Set(terms.flatMap((t) => (t.key.kind === 'column' && t.key.path.relations.length === 0 ? [t.key.path.column] : [])));
    for (const k of resource.key) {
        if (!direct.has(k)) terms.push({ key: { kind: 'column', path: { relations: [], column: k } }, desc: false });
    }
    return terms;
}
