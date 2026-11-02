import type { LogicalType } from '../catalog.js';
import { badRequest } from '../errors.js';
import type { Value } from '../plan.js';
import type { Column, Resource } from '../resources.js';
import { typed } from './values.js';

export type Row = Map<string, unknown>;

/** A body value as a value to bind, checked against the column's type the same way a query value is. */
function bodyValue(v: unknown, c: Column): unknown {
    if (v === null) return null;
    const type: LogicalType = c.type;
    if (type === 'json') return JSON.stringify(v);
    if (type === 'boolean') {
        if (typeof v !== 'boolean') throw badRequest('invalid_value', c.name);
        return v;
    }
    if (type === 'integer' || type === 'number') {
        if (typeof v === 'number' && Number.isFinite(v) && (type === 'number' || Number.isInteger(v))) return v;
        if (typeof v === 'string') return typed(v, type, c.name);
        throw badRequest('invalid_value', c.name);
    }
    if (typeof v !== 'string') throw badRequest('invalid_value', c.name);
    return typed(v, type, c.name) as Value;
}

/**
 * The rows of a write body, each a map of writable columns to checked values.
 * Every row must name the same columns, so one statement writes them all.
 */
export function bodyRows(resource: Resource, body: unknown, kind: 'create' | 'update', maxRows: number): Row[] {
    const list = Array.isArray(body) ? body : [body];
    if (list.length === 0 || list.length > maxRows) throw badRequest('bad_body', `between 1 and ${maxRows} rows`);
    if (kind === 'update' && Array.isArray(body)) throw badRequest('bad_body', 'an update takes one object');
    let keys: string | null = null;
    return list.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw badRequest('bad_body', 'rows are objects');
        const names = Object.keys(item).sort();
        if (names.length === 0) throw badRequest('bad_body', 'a row names at least one column');
        if (keys !== null && keys !== names.join(',')) throw badRequest('mixed_columns');
        keys = names.join(',');
        const row: Row = new Map();
        for (const name of names) {
            const c = resource.columns.get(name);
            if (!c || !c[kind]) throw badRequest('not_writable', name);
            row.set(name, bodyValue((item as Record<string, unknown>)[name], c));
        }
        return row;
    });
}
