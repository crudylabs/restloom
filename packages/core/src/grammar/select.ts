import { badRequest } from '../errors.js';
import type { Limits } from '../options.js';
import { AGGREGATES, type Aggregate, type Selection } from '../plan.js';
import type { Resource } from '../resources.js';
import { segments } from './names.js';
import { column } from './resolve.js';
import { splitTopLevel } from './split.js';
import { orderable } from './values.js';

function single(raw: string): string {
    const segs = segments(raw.trim());
    if (segs.length !== 1) throw badRequest('bad_select', raw);
    return segs[0].name;
}

function all(resource: Resource): string[] {
    return [...resource.columns.keys()];
}

/**
 * A select list: columns, `*`, `count()`, `col.sum()` and the other
 * aggregates, and `relation(list)` embeds, nested up to the depth limit.
 */
export function selection(resource: Resource, raw: string | null, limits: Limits, level = 0): Selection {
    const out: Selection = { columns: [], aggregates: [], embeds: [] };
    if (raw === null || raw.trim() === '' || raw.trim() === '*') return { ...out, columns: all(resource) };
    const seen = new Set<string>();
    const claim = (name: string) => {
        if (seen.has(name)) throw badRequest('duplicate_select', name);
        seen.add(name);
    };
    for (const part of splitTopLevel(raw).map((p) => p.trim())) {
        if (part === '*') { all(resource).forEach((c) => { claim(c); out.columns.push(c); }); continue; }
        if (part === 'count()') { claim('count'); out.aggregates.push({ fn: 'count', column: null }); continue; }
        const agg = /^(.+)\.([a-z]+)\(\)$/s.exec(part);
        if (agg) {
            const fn = agg[2] as Aggregate;
            if (!AGGREGATES.includes(fn) || fn === 'count') throw badRequest('unknown_aggregate', agg[2]);
            const col = column(resource, single(agg[1]));
            const fits = fn === 'sum' || fn === 'avg' ? col.type === 'integer' || col.type === 'number' : orderable(col.type);
            if (!fits) throw badRequest('bad_aggregate', part);
            claim(fn);
            out.aggregates.push({ fn, column: col.name });
            continue;
        }
        const embed = /^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/s.exec(part);
        if (embed) {
            const relation = resource.relations.get(embed[1]);
            if (!relation) throw badRequest('unknown_relation', embed[1]);
            if (level + 1 > limits.depth) throw badRequest('too_deep', embed[1]);
            claim(embed[1]);
            out.embeds.push({ name: embed[1], relation, select: selection(relation.target, embed[2], limits, level + 1), order: [] });
            continue;
        }
        const name = column(resource, single(part)).name;
        claim(name);
        out.columns.push(name);
    }
    if (out.aggregates.length > 0 && out.embeds.length > 0) throw badRequest('aggregate_with_embed');
    if (out.embeds.some((e) => e.select.aggregates.length > 0)) throw badRequest('aggregate_in_embed');
    return out;
}
