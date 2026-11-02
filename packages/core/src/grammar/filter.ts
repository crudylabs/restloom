import { badRequest } from '../errors.js';
import type { Limits } from '../options.js';
import { OPERATORS, type Filter, type Operator, type Value } from '../plan.js';
import type { Resource } from '../resources.js';
import { headAndRest, segments, type Segment } from './names.js';
import { column, walk } from './resolve.js';
import { listItems, splitTopLevel, unquote } from './split.js';
import { likePattern, operatorFits, typed } from './values.js';

interface Operation { op: Operator; negate: boolean; raw: string }

function operation(expr: string): Operation {
    let rest = expr;
    let negate = false;
    if (rest.startsWith('not.')) { negate = true; rest = rest.slice(4); }
    const dot = rest.indexOf('.');
    const op = (dot < 0 ? rest : rest.slice(0, dot)) as Operator;
    if (!OPERATORS.includes(op)) throw badRequest('unknown_operator', op);
    if (dot < 0) throw badRequest('bad_filter', expr);
    return { op, negate, raw: rest.slice(dot + 1) };
}

/** One filter from its path segments and its `[not.]op.value`. */
function condition(resource: Resource, segs: Segment[], expr: string, limits: Limits): Filter {
    const { op, negate, raw } = operation(expr);
    const { relations, resource: owner, last } = walk(resource, segs, limits.depth);
    const asRelation = !last.quoted ? owner.relations.get(last.name) : undefined;
    if (asRelation) {
        if (op !== 'is' || (raw !== 'empty' && raw !== 'null')) throw badRequest('bad_filter', expr);
        if (relations.length + 1 > limits.depth) throw badRequest('too_deep', segs.map((s) => s.name).join('.'));
        return { kind: 'present', relations: [...relations, asRelation], negate: !negate };
    }
    const col = column(owner, last.name);
    if (!operatorFits(op, col.type, raw)) throw badRequest('bad_operator', `${op} on ${col.name}`);
    let value: Value | Value[];
    if (op === 'in') {
        const items = listItems(raw);
        if (items.length === 0 || items.length > limits.inList) throw badRequest('bad_list', col.name);
        value = items.map((i) => typed(i, col.type, col.name));
    } else if (op === 'is') {
        value = raw === 'null' ? null : raw === 'true';
    } else if (op === 'like' || op === 'ilike') {
        value = likePattern(unquote(raw));
    } else {
        value = typed(unquote(raw), col.type, col.name);
    }
    return { kind: 'cmp', path: { relations, column: col.name }, op, negate, value };
}

/** A term of or/and: `path.op.value`, `path.not.op.value`, or a nested and(...)/or(...). */
function term(resource: Resource, expr: string, limits: Limits, depth: number): Filter {
    const nested = /^(not\.)?(and|or)(\(.*\))$/s.exec(expr);
    if (nested) {
        if (depth >= 1) throw badRequest('too_deep', expr);
        return logic(resource, nested[2] as 'and' | 'or', nested[3], !!nested[1], limits, depth + 1);
    }
    const path: string[] = [];
    let rest: string | null = expr;
    while (rest !== null) {
        const [head, tail]: [string, string | null] = headAndRest(rest);
        if (!head.startsWith('"') && (head === 'not' || (OPERATORS as readonly string[]).includes(head)) && path.length > 0) {
            return condition(resource, segments(path.join('.')), rest, limits);
        }
        path.push(head);
        rest = tail;
    }
    throw badRequest('bad_filter', expr);
}

export function logic(resource: Resource, kind: 'and' | 'or', value: string, negate: boolean, limits: Limits, depth = 0): Filter {
    if (!value.startsWith('(') || !value.endsWith(')')) throw badRequest('bad_logic', value);
    const terms = splitTopLevel(value.slice(1, -1)).map((t) => term(resource, t.trim(), limits, depth));
    if (terms.length === 0) throw badRequest('bad_logic', value);
    return { kind, negate, terms };
}

export function filter(resource: Resource, key: string, value: string, limits: Limits): Filter {
    return condition(resource, segments(key), value, limits);
}

export function countTerms(f: Filter): number {
    return f.kind === 'or' || f.kind === 'and' ? f.terms.reduce((n, t) => n + countTerms(t), 0) : 1;
}
