import { badRequest } from '../errors.js';
import type { Limits } from '../options.js';
import type { Embed, Filter, ReadPlan, Selection } from '../plan.js';
import type { Resource } from '../resources.js';
import { countTerms, filter, logic } from './filter.js';
import { segments } from './names.js';
import { ordering } from './order.js';
import { selection } from './select.js';

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'count', 'or', 'and', 'not.or', 'not.and']);
const EMBED_MODIFIERS = new Set(['order', 'limit', 'offset']);

export function bounded(raw: string | null, fallback: number, max: number, code: string): number {
    if (raw === null) return fallback;
    if (!/^\d{1,15}$/.test(raw)) throw badRequest(code, raw);
    const n = Number(raw);
    if (n > max) throw badRequest(code === 'bad_limit' ? 'limit_exceeded' : code, raw);
    return n;
}

function embedAt(select: Selection, names: string[]): Embed {
    let current = select;
    let found: Embed | undefined;
    for (const name of names) {
        found = current.embeds.find((e) => e.name === name);
        if (!found) throw badRequest('not_embedded', names.join('.'));
        current = found.select;
    }
    return found!;
}

/** `rel.order`, `rel.limit`, `rel.offset`: the last segment is an unquoted modifier after at least one embed name. */
function embedModifier(key: string): { path: string[]; modifier: string } | null {
    const segs = segments(key);
    const last = segs[segs.length - 1];
    if (segs.length < 2 || last.quoted || !EMBED_MODIFIERS.has(last.name)) return null;
    return { path: segs.slice(0, -1).map((s) => s.name), modifier: last.name };
}

/** An embedded array without a limit holds at most a page of the largest size. */
function capEmbeds(select: Selection, limits: Limits): void {
    for (const e of select.embeds) {
        if (e.relation.kind === 'many') e.limit ??= limits.maxPage;
        capEmbeds(e.select, limits);
    }
}

/** Reads a query string into a read plan. Every name is checked against the resource; nothing unknown reaches SQL. */
export function parseRead(resource: Resource, query: URLSearchParams, limits: Limits): ReadPlan {
    const select = selection(resource, query.get('select'), limits);
    const where: Filter[] = [];
    for (const [key, value] of query) {
        if (RESERVED.has(key)) {
            if (key === 'or' || key === 'and') where.push(logic(resource, key, value, false, limits));
            if (key === 'not.or' || key === 'not.and') where.push(logic(resource, key.slice(4) as 'or' | 'and', value, true, limits));
            continue;
        }
        const mod = embedModifier(key);
        if (mod) {
            const embed = embedAt(select, mod.path);
            if (mod.modifier === 'order') embed.order = ordering(embed.relation.target, value, embed.select, limits);
            else if (mod.modifier === 'limit') embed.limit = bounded(value, limits.page, limits.maxPage, 'bad_limit');
            else embed.offset = bounded(value, 0, Number.MAX_SAFE_INTEGER, 'bad_offset');
            continue;
        }
        where.push(filter(resource, key, value, limits));
    }
    capEmbeds(select, limits);
    if (where.reduce((n, f) => n + countTerms(f), 0) > limits.filters) throw badRequest('too_many_filters');
    const count = query.get('count');
    if (count !== null && count !== 'exact' && count !== 'estimated') throw badRequest('bad_count', count);
    return {
        resource,
        select,
        where,
        order: ordering(resource, query.get('order'), select, limits),
        limit: bounded(query.get('limit'), limits.page, limits.maxPage, 'bad_limit'),
        offset: bounded(query.get('offset'), 0, Number.MAX_SAFE_INTEGER, 'bad_offset'),
        count: count ?? 'none',
    };
}
