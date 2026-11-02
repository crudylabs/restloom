import type { Relation, Resource } from './resources.js';

export const OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is'] as const;
export type Operator = typeof OPERATORS[number];

export const AGGREGATES = ['count', 'sum', 'avg', 'min', 'max'] as const;
export type Aggregate = typeof AGGREGATES[number];

/** A typed value ready to bind: the core checked it against the column's logical type. */
export type Value = string | number | boolean | null;

/** Relations walked from the resource, then a column of the last one. */
export interface Path { relations: Relation[]; column: string }

export type Filter =
    | { kind: 'cmp'; path: Path; op: Operator; negate: boolean; value: Value | Value[] }
    | { kind: 'present'; relations: Relation[]; negate: boolean }
    | { kind: 'or' | 'and'; negate: boolean; terms: Filter[] };

export type OrderKey = { kind: 'column'; path: Path } | { kind: 'count'; relations: Relation[] };
export interface OrderTerm { key: OrderKey; desc: boolean; nulls?: 'first' | 'last' }

export interface Selection {
    columns: string[];
    aggregates: { fn: Aggregate; column: string | null }[];
    embeds: Embed[];
}

export interface Embed {
    name: string;
    relation: Relation;
    select: Selection;
    order: OrderTerm[];
    limit?: number;
    offset?: number;
}

export interface ReadPlan {
    resource: Resource;
    select: Selection;
    where: Filter[];
    order: OrderTerm[];
    limit: number;
    offset: number;
    count: 'none' | 'exact' | 'estimated';
}
