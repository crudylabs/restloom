import type { Embed, Filter, OrderTerm, Path, ReadPlan, Selection, Value } from '../plan.js';
import type { Relation, Resource } from '../resources.js';
import { RenderContext } from './context.js';
import { SqlPrimitives } from './primitives.js';

export interface Statement { sql: string; params: unknown[] }

const CMP: Record<string, string> = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };

/**
 * Writes read statements from a plan. Relations are correlated subqueries, so
 * a statement is one SQL text whatever the depth, and every table it touches
 * carries the host's scope filters. Each method can be overridden by a dialect.
 */
export class SqlReader extends SqlPrimitives {
    context(scope: (r: Resource) => Filter[]): RenderContext {
        return new RenderContext(scope);
    }

    /** FROM clause and correlation of a relation's target, seen from the parent alias. */
    relationSource(rel: Relation, parent: string, alias: string, ctx: RenderContext): { from: string; where: string[] } {
        const target = this.table(rel.target.schema, rel.target.table);
        const scoped = this.filters(rel.target, alias, ctx.scope(rel.target), ctx);
        if (!rel.through) {
            const on = rel.to.map((c, i) => `${this.column(alias, c)} = ${this.column(parent, rel.from[i])}`);
            return { from: `${target} ${alias}`, where: [...on, ...scoped] };
        }
        const j = ctx.alias('j');
        const join = rel.to.map((c, i) => `${this.column(j, rel.through!.to[i])} = ${this.column(alias, c)}`).join(' AND ');
        const on = rel.from.map((c, i) => `${this.column(j, rel.through!.from[i])} = ${this.column(parent, c)}`);
        return { from: `${target} ${alias} JOIN ${this.table(rel.through.schema, rel.through.table)} ${j} ON ${join}`, where: [...on, ...scoped] };
    }

    /** EXISTS through a chain of relations, with `inner` written against the last alias. */
    exists(relations: Relation[], parent: string, ctx: RenderContext, inner: (alias: string) => string | null): string {
        const [rel, ...rest] = relations;
        const alias = ctx.alias();
        const src = this.relationSource(rel, parent, alias, ctx);
        const tail = rest.length ? this.exists(rest, alias, ctx, inner) : inner(alias);
        const where = [...src.where, ...(tail ? [tail] : [])];
        return `EXISTS (SELECT 1 FROM ${src.from}${where.length ? ` WHERE ${where.join(' AND ')}` : ''})`;
    }

    comparison(expr: string, f: Extract<Filter, { kind: 'cmp' }>, ctx: RenderContext): string {
        const bind = (v: Value) => ctx.params.add(v);
        switch (f.op) {
            case 'in': return `${expr} IN (${(f.value as Value[]).map(bind).join(', ')})`;
            case 'is': return f.value === null ? `${expr} IS NULL` : this.isBoolean(expr, f.value as boolean);
            case 'like': return this.like(expr, bind(f.value as Value), false);
            case 'ilike': return this.like(expr, bind(f.value as Value), true);
            default: return `${expr} ${CMP[f.op]} ${bind(f.value as Value)}`;
        }
    }

    filter(alias: string, f: Filter, ctx: RenderContext): string {
        if (f.kind === 'present') return `${f.negate ? 'NOT ' : ''}${this.exists(f.relations, alias, ctx, () => null)}`;
        if (f.kind !== 'cmp') {
            const body = `(${f.terms.map((t) => this.filter(alias, t, ctx)).join(f.kind === 'or' ? ' OR ' : ' AND ')})`;
            return f.negate ? `NOT ${body}` : body;
        }
        if (f.path.relations.length === 0) {
            const cmp = this.comparison(this.column(alias, f.path.column), f, ctx);
            return f.negate ? `NOT (${cmp})` : cmp;
        }
        const found = this.exists(f.path.relations, alias, ctx, (a) => this.comparison(this.column(a, f.path.column), f, ctx));
        return f.negate ? `NOT ${found}` : found;
    }

    filters(_resource: Resource, alias: string, list: Filter[], ctx: RenderContext): string[] {
        return list.map((f) => this.filter(alias, f, ctx));
    }

    /** A value reached through to-one relations, or a count of a to-many one, as a scalar subquery. */
    pathValue(relations: Relation[], parent: string, ctx: RenderContext, leaf: (alias: string) => string): string {
        const [rel, ...rest] = relations;
        const alias = ctx.alias();
        const src = this.relationSource(rel, parent, alias, ctx);
        const value = rest.length ? this.pathValue(rest, alias, ctx, leaf) : leaf(alias);
        return `(${this.first(`SELECT ${value} FROM ${src.from} WHERE ${src.where.join(' AND ')}`)})`;
    }

    orderExpr(t: OrderTerm, alias: string, ctx: RenderContext): string {
        if (t.key.kind === 'count') {
            const rels = t.key.relations;
            const counted = (parent: string) => {
                const a = ctx.alias();
                const src = this.relationSource(rels[rels.length - 1], parent, a, ctx);
                return `(SELECT COUNT(*) FROM ${src.from} WHERE ${src.where.join(' AND ')})`;
            };
            return rels.length === 1 ? counted(alias) : this.pathValue(rels.slice(0, -1), alias, ctx, counted);
        }
        const path: Path = t.key.path;
        return path.relations.length === 0
            ? this.column(alias, path.column)
            : this.pathValue(path.relations, alias, ctx, (a) => this.column(a, path.column));
    }

    order(terms: OrderTerm[], alias: string, ctx: RenderContext): string {
        return terms.map((t) => this.orderBy(this.orderExpr(t, alias, ctx), t.desc, t.nulls)).join(', ');
    }

    rowJson(resource: Resource, select: Selection, alias: string, ctx: RenderContext): string {
        const pairs: [string, string][] = select.columns.map((c) => [c, this.jsonValue(this.column(alias, c), resource.columns.get(c)!)]);
        for (const a of select.aggregates) pairs.push([a.fn, this.aggregate(a.fn, a.column && this.column(alias, a.column))]);
        for (const e of select.embeds) pairs.push([e.name, this.nested(this.embed(e, alias, ctx))]);
        return this.jsonObject(pairs);
    }

    embed(e: Embed, parent: string, ctx: RenderContext): string {
        const alias = ctx.alias();
        const src = this.relationSource(e.relation, parent, alias, ctx);
        const target = e.relation.target;
        const row = this.rowJson(target, e.select, alias, ctx);
        const where = ` WHERE ${src.where.join(' AND ')}`;
        if (e.relation.kind === 'one') return `(${this.first(`SELECT ${row} FROM ${src.from}${where}`)})`;
        const terms = e.order.length ? e.order : target.key.map((k) => ({ key: { kind: 'column' as const, path: { relations: [], column: k } }, desc: false }));
        const ordered = this.order(terms, alias, ctx);
        const inner = `SELECT ${row} AS r, ${this.rowNumber(ordered || '1')} AS n FROM ${src.from}${where}${ordered ? ` ORDER BY ${ordered}` : ''}${this.page(e.limit, e.offset)}`;
        return `(SELECT ${this.jsonArray('x.r', 'x.n')} FROM (${inner}) x)`;
    }

    where(plan: ReadPlan, alias: string, ctx: RenderContext): string {
        const parts = [...this.filters(plan.resource, alias, ctx.scope(plan.resource), ctx), ...this.filters(plan.resource, alias, plan.where, ctx)];
        return parts.length ? ` WHERE ${parts.join(' AND ')}` : '';
    }

    groupBy(plan: ReadPlan, alias: string): string {
        return plan.select.aggregates.length && plan.select.columns.length
            ? ` GROUP BY ${plan.select.columns.map((c) => this.column(alias, c)).join(', ')}` : '';
    }

    read(plan: ReadPlan, ctx: RenderContext): Statement {
        const alias = ctx.alias();
        const row = this.rowJson(plan.resource, plan.select, alias, ctx);
        const where = this.where(plan, alias, ctx);
        const ordered = this.order(plan.order, alias, ctx);
        const sql = `SELECT ${row} AS r FROM ${this.table(plan.resource.schema, plan.resource.table)} ${alias}${where}${this.groupBy(plan, alias)}${ordered ? ` ORDER BY ${ordered}` : ''}${this.page(plan.limit, plan.offset)}`;
        return ctx.params.finalize(sql, (i) => this.placeholder(i));
    }

    count(plan: ReadPlan, ctx: RenderContext): Statement {
        const alias = ctx.alias();
        const from = `${this.table(plan.resource.schema, plan.resource.table)} ${alias}${this.where(plan, alias, ctx)}`;
        const sql = plan.select.aggregates.length && plan.select.columns.length
            ? `SELECT COUNT(*) AS n FROM (SELECT 1 AS one FROM ${from}${this.groupBy(plan, alias)}) g`
            : plan.select.aggregates.length ? 'SELECT 1 AS n' : `SELECT COUNT(*) AS n FROM ${from}`;
        return ctx.params.finalize(sql, (i) => this.placeholder(i));
    }
}
