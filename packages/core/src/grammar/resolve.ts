import { badRequest } from '../errors.js';
import type { Column, Relation, Resource } from '../resources.js';
import type { Segment } from './names.js';

export interface Resolved { relations: Relation[]; resource: Resource; last: Segment }

/**
 * Walks the leading segments as relations and returns the resource the last
 * segment is read on. A quoted segment is a column, so it cannot be a hop.
 */
export function walk(resource: Resource, segs: Segment[], depth: number): Resolved {
    const relations: Relation[] = [];
    let current = resource;
    for (const seg of segs.slice(0, -1)) {
        const rel = seg.quoted ? undefined : current.relations.get(seg.name);
        if (!rel) throw badRequest('unknown_relation', seg.name);
        relations.push(rel);
        current = rel.target;
    }
    if (relations.length > depth) throw badRequest('too_deep', segs.map((s) => s.name).join('.'));
    return { relations, resource: current, last: segs[segs.length - 1] };
}

export function column(resource: Resource, name: string): Column {
    const c = resource.columns.get(name);
    if (!c) throw badRequest('unknown_column', name);
    return c;
}
