import type { Catalog, CatalogFunction } from './catalog.js';
import { badRequest } from './errors.js';
import { typed } from './grammar/values.js';
import type { ProcedureOptions } from './options.js';

export interface Procedure {
    template: string;
    method: 'GET' | 'POST';
    pattern: RegExp;
    params: string[];
    fn: CatalogFunction;
}

/** Declared procedures, each bound to exactly one function of the catalog. */
export function buildProcedures(catalog: Catalog, declared: Record<string, ProcedureOptions>): Procedure[] {
    return Object.entries(declared).map(([template, o]) => {
        const [schema, name] = o.function.includes('.') ? o.function.split('.', 2) : ['', o.function];
        const matches = catalog.functions.filter((f) => f.name === name && (!schema || f.schema === schema));
        if (matches.length !== 1) throw new Error(`restloom: procedure ${template} needs exactly one function named ${o.function} in an exposed schema, found ${matches.length}`);
        const params: string[] = [];
        const source = template.replace(/^\/+|\/+$/g, '').split('/').map((part) => {
            const p = /^\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(part);
            if (!p) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (!matches[0].args.some((a) => a.name === p[1])) throw new Error(`restloom: procedure ${template} names {${p[1]}}, which ${o.function} does not take`);
            params.push(p[1]);
            return '([^/]+)';
        }).join('/');
        return { template, method: o.method ?? 'POST', pattern: new RegExp(`^/${source}/?$`), params, fn: matches[0] };
    });
}

export function matchProcedure(list: Procedure[], path: string): { procedure: Procedure; values: Record<string, string> } | null {
    for (const procedure of list) {
        const m = procedure.pattern.exec(path);
        if (!m) continue;
        try {
            return { procedure, values: Object.fromEntries(procedure.params.map((p, i) => [p, decodeURIComponent(m[i + 1])])) };
        } catch {
            return null;
        }
    }
    return null;
}

/** A query-string argument as the body would give it: JSON for structured types, the text otherwise. */
function fromQuery(raw: string, type: CatalogFunction['args'][number]['type']): unknown {
    if (type !== 'json' && type !== 'array') return raw;
    try { return JSON.parse(raw); } catch { throw badRequest('invalid_value', raw); }
}

/** The arguments of a GET procedure: each query parameter by name, once. */
export function queryArgs(fn: CatalogFunction, query: URLSearchParams): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [name, raw] of query) {
        if (name in out) throw badRequest('bad_argument', name);
        const arg = fn.args.find((a) => a.name === name);
        out[name] = arg ? fromQuery(raw, arg.type) : raw;
    }
    return out;
}

/** The call's arguments from the path and the body (or query), by name, each checked against its type. */
export function procedureArgs(fn: CatalogFunction, fromPath: Record<string, string>, body: unknown): [string, unknown][] {
    if (body !== undefined && (body === null || typeof body !== 'object' || Array.isArray(body))) throw badRequest('bad_body', 'arguments are an object');
    const given: Record<string, unknown> = { ...(body as Record<string, unknown> | undefined), ...fromPath };
    for (const name of Object.keys(given)) if (!fn.args.some((a) => a.name === name)) throw badRequest('unknown_argument', name);
    const out: [string, unknown][] = [];
    for (const a of fn.args) {
        if (!(a.name in given)) {
            if (!a.hasDefault) throw badRequest('missing_argument', a.name);
            continue;
        }
        const v = given[a.name];
        if (v === null) out.push([a.name, null]);
        else if (a.type === 'json') out.push([a.name, JSON.stringify(v)]);
        else if (a.type === 'array') {
            if (!Array.isArray(v)) throw badRequest('invalid_value', a.name);
            out.push([a.name, v]);
        } else if (a.type === 'other' && (typeof v === 'string' || typeof v === 'number')) out.push([a.name, v]);
        else if (typeof v === 'boolean' || typeof v === 'number') out.push([a.name, typed(String(v), a.type, a.name)]);
        else if (typeof v === 'string') out.push([a.name, typed(v, a.type, a.name)]);
        else throw badRequest('invalid_value', a.name);
    }
    return out;
}
