import type { LogicalType } from '../catalog.js';
import { badRequest } from '../errors.js';
import type { Operator, Value } from '../plan.js';

const COMPARABLE: ReadonlySet<LogicalType> = new Set(['text', 'integer', 'number', 'boolean', 'uuid', 'date', 'timestamp', 'time']);
const ORDERED: ReadonlySet<LogicalType> = new Set(['text', 'integer', 'number', 'date', 'timestamp', 'time']);

/** Whether an operator applies to a column of this type, decided before any SQL. */
export function operatorFits(op: Operator, type: LogicalType, value: string): boolean {
    if (op === 'is') return value === 'null' || (type === 'boolean' && (value === 'true' || value === 'false'));
    if (op === 'like' || op === 'ilike') return type === 'text';
    if (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte') return ORDERED.has(type);
    return COMPARABLE.has(type);
}

export function orderable(type: LogicalType): boolean {
    return ORDERED.has(type) || type === 'boolean' || type === 'uuid';
}

const CHECKS: Partial<Record<LogicalType, RegExp>> = {
    integer: /^-?\d{1,19}$/,
    number: /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/,
    uuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    date: /^\d{4}-\d{2}-\d{2}$/,
    timestamp: /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?)?(Z|[+-]\d{2}(:?\d{2})?)?$/,
    time: /^\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?$/,
};

/**
 * A request value as a typed value to bind. Checking it here keeps databases
 * that convert loosely ('abc' = 0 in MySQL) from answering a different question.
 */
export function typed(raw: string, type: LogicalType, column: string): Value {
    const check = CHECKS[type];
    if (check && !check.test(raw)) throw badRequest('invalid_value', column);
    if (type === 'boolean') {
        if (raw !== 'true' && raw !== 'false') throw badRequest('invalid_value', column);
        return raw === 'true';
    }
    if (type === 'integer' && Number.isSafeInteger(Number(raw))) return Number(raw);
    return raw;
}

/** A like pattern with PostgREST's `*` wildcard, other wildcards escaped. */
export function likePattern(raw: string): string {
    return raw.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/\*/g, '%');
}
