import { RestError, SqlRenderer, type CatalogColumn } from '@crudy/restloom';

/** SQLite: JSON through json_object and json_group_array, booleans as 0 and 1, positional placeholders. */
export class SqliteRenderer extends SqlRenderer {
    placeholder(_index: number): string {
        return '?';
    }

    jsonObject(pairs: [string, string][]): string {
        return `json_object(${pairs.map(([k, v]) => `${this.literal(k)}, ${v}`).join(', ')})`;
    }

    jsonArray(rowExpr: string, orderExpr: string): string {
        return `COALESCE(json_group_array(json(${rowExpr}) ORDER BY ${orderExpr}), json('[]'))`;
    }

    nested(expr: string): string {
        return `json(${expr})`;
    }

    jsonValue(expr: string, column: CatalogColumn): string {
        if (column.type === 'boolean') return `CASE WHEN ${expr} IS NULL THEN NULL WHEN ${expr} THEN json('true') ELSE json('false') END`;
        if (column.type === 'json') return `json(${expr})`;
        return expr;
    }

    like(expr: string, pattern: string, insensitive: boolean): string {
        return insensitive ? `lower(${expr}) LIKE lower(${pattern}) ESCAPE '\\'` : `${expr} LIKE ${pattern} ESCAPE '\\'`;
    }

    regex(): string {
        throw new RestError(400, 'unsupported', 'regular expressions');
    }

    isBoolean(expr: string, value: boolean): string {
        return `${expr} = ${value ? 1 : 0}`;
    }

    /** SQLite sorts nulls first ascending; this keeps the Postgres order: last ascending, first descending. */
    orderBy(expr: string, desc: boolean, nulls?: 'first' | 'last'): string {
        return super.orderBy(expr, desc, nulls ?? (desc ? 'first' : 'last'));
    }

    page(limit: number | undefined, offset: number | undefined): string {
        return limit === undefined && !offset ? '' : ` LIMIT ${limit ?? -1}${offset ? ` OFFSET ${offset}` : ''}`;
    }
}
