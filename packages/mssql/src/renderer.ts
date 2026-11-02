import { SqlRenderer, type CatalogColumn, type CatalogFunction, type Filter, type OrderTerm, type RenderContext, type Resource, type Statement } from '@crudy/restloom';

/**
 * SQL Server 2022: bracketed names, @p placeholders, JSON_OBJECT for rows and
 * STRING_AGG for arrays (JSON_ARRAYAGG is not in 2022), OFFSET/FETCH paging,
 * OUTPUT in place of RETURNING.
 */
export class MssqlRenderer extends SqlRenderer {
    quote(identifier: string): string {
        return `[${identifier.replace(/]/g, ']]')}]`;
    }

    literal(text: string): string {
        return `N'${text.replace(/'/g, "''")}'`;
    }

    placeholder(index: number): string {
        return `@p${index}`;
    }

    jsonObject(pairs: [string, string][]): string {
        return `JSON_OBJECT(${pairs.map(([k, v]) => `${this.literal(k)}: ${v}`).join(', ')} NULL ON NULL)`;
    }

    jsonArray(rowExpr: string, orderExpr: string): string {
        return `COALESCE(N'[' + STRING_AGG(CAST(${rowExpr} AS nvarchar(max)), N',') WITHIN GROUP (ORDER BY ${orderExpr}) + N']', N'[]')`;
    }

    nested(expr: string): string {
        return `JSON_QUERY(${expr})`;
    }

    jsonValue(expr: string, column: CatalogColumn): string {
        if (column.type === 'boolean') return `CAST(${expr} AS bit)`;
        if (column.nativeType === 'datetimeoffset') return `CONVERT(varchar(19), SWITCHOFFSET(${expr}, '+00:00'), 126) + '+00:00'`;
        if (column.type === 'timestamp') return `CONVERT(varchar(19), ${expr}, 126)`;
        if (column.type === 'date') return `CONVERT(varchar(10), ${expr}, 23)`;
        return expr;
    }

    like(expr: string, pattern: string, insensitive: boolean): string {
        return insensitive
            ? `LOWER(${expr}) LIKE LOWER(${pattern}) ESCAPE '\\'`
            : `${expr} COLLATE Latin1_General_100_CS_AS LIKE ${pattern} ESCAPE '\\'`;
    }

    isBoolean(expr: string, value: boolean): string {
        return `${expr} = ${value ? 1 : 0}`;
    }

    /** SQL Server sorts nulls first ascending; this keeps the Postgres order: last ascending, first descending. */
    orderBy(expr: string, desc: boolean, nulls?: 'first' | 'last'): string {
        const first = (nulls ?? (desc ? 'first' : 'last')) === 'first';
        return `CASE WHEN ${expr} IS NULL THEN ${first ? 0 : 1} ELSE ${first ? 1 : 0} END, ${expr} ${desc ? 'DESC' : 'ASC'}`;
    }

    /** OFFSET/FETCH needs an ORDER BY, so an unordered read orders by nothing in particular. */
    order(terms: OrderTerm[], alias: string, ctx: RenderContext): string {
        return super.order(terms, alias, ctx) || '(SELECT NULL)';
    }

    page(limit: number | undefined, offset: number | undefined): string {
        if (limit === undefined && !offset) return '';
        return ` OFFSET ${offset ?? 0} ROWS${limit !== undefined ? ` FETCH NEXT ${limit} ROWS ONLY` : ''}`;
    }

    first(selectSql: string): string {
        return selectSql.replace(/^SELECT /, 'SELECT TOP 1 ');
    }

    aggregate(fn: Parameters<SqlRenderer['aggregate']>[0], expr: string | null): string {
        return fn === 'count' ? 'COUNT_BIG(*)' : super.aggregate(fn, expr);
    }

    private output(resource: Resource, side: 'INSERTED' | 'DELETED'): string {
        return ` OUTPUT ${resource.key.map((k) => `${side}.${this.quote(k)}`).join(', ')}`;
    }

    insert(resource: Resource, columns: string[], rows: unknown[][], ctx: RenderContext): Statement {
        const values = rows.map((row) => `(${row.map((v) => ctx.params.add(v)).join(', ')})`).join(', ');
        const sql = `INSERT INTO ${this.table(resource.schema, resource.table)} (${columns.map((c) => this.quote(c)).join(', ')})${this.output(resource, 'INSERTED')} VALUES ${values}`;
        return ctx.params.finalize(sql, (i) => this.placeholder(i));
    }

    update(resource: Resource, set: [string, unknown][], where: Filter[], ctx: RenderContext): Statement {
        const alias = ctx.alias();
        const assignments = set.map(([c, v]) => `${this.column(alias, c)} = ${ctx.params.add(v)}`).join(', ');
        const conditions = this.filters(resource, alias, where, ctx);
        const sql = `UPDATE ${alias} SET ${assignments}${this.output(resource, 'INSERTED')} FROM ${this.table(resource.schema, resource.table)} ${alias}${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''}`;
        return ctx.params.finalize(sql, (i) => this.placeholder(i));
    }

    delete(resource: Resource, where: Filter[], ctx: RenderContext): Statement {
        const alias = ctx.alias();
        const conditions = this.filters(resource, alias, where, ctx);
        const sql = `DELETE ${alias}${this.output(resource, 'DELETED')} FROM ${this.table(resource.schema, resource.table)} ${alias}${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''}`;
        return ctx.params.finalize(sql, (i) => this.placeholder(i));
    }

    /** T-SQL calls by position. A scalar comes back as JSON text through JSON_ARRAY, a table function row by row. */
    call(fn: CatalogFunction, args: [string, unknown][], ctx: RenderContext): Statement {
        const byName = new Map(args);
        const call = `${this.table(fn.schema, fn.name)}(${fn.args.map((a) => ctx.params.add(byName.get(a.name))).join(', ')})`;
        const row = fn.columns?.length
            ? this.jsonObject(fn.columns.map((c) => [c.name, this.jsonValue(this.column('x', c.name), c)]))
            : '(SELECT x.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES)';
        const sql = fn.returnsSet
            ? `SELECT ${row} AS r FROM ${call} x`
            : `SELECT SUBSTRING(j, 2, LEN(j + N'x') - 3) AS r FROM (SELECT JSON_ARRAY(${call} NULL ON NULL) AS j) v`;
        return ctx.params.finalize(sql, (i) => this.placeholder(i));
    }
}
