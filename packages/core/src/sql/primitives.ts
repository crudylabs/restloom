import type { CatalogColumn } from '../catalog.js';
import type { Aggregate } from '../plan.js';

/**
 * The smallest pieces of SQL, written for Postgres. A dialect overrides the
 * ones its database writes differently; the statements are built from these
 * pieces only, so an override reaches every statement that uses it.
 */
export class SqlPrimitives {
    quote(identifier: string): string {
        return `"${identifier.replace(/"/g, '""')}"`;
    }

    literal(text: string): string {
        return `'${text.replace(/'/g, "''")}'`;
    }

    placeholder(index: number): string {
        return `$${index}`;
    }

    table(schema: string, table: string): string {
        return `${this.quote(schema)}.${this.quote(table)}`;
    }

    column(alias: string, name: string): string {
        return `${alias}.${this.quote(name)}`;
    }

    /** A column as it goes into a JSON object; a dialect fixes types its JSON functions misread. */
    jsonValue(expr: string, _column: CatalogColumn): string {
        return expr;
    }

    /** A JSON value produced by a subquery, nested into an outer JSON object. */
    nested(expr: string): string {
        return expr;
    }

    jsonObject(pairs: [string, string][]): string {
        return `json_build_object(${pairs.map(([k, v]) => `${this.literal(k)}, ${v}`).join(', ')})`;
    }

    /** JSON array of rowExpr over a derived table, in the order of orderExpr, [] when empty. */
    jsonArray(rowExpr: string, orderExpr: string): string {
        return `COALESCE(json_agg(${rowExpr} ORDER BY ${orderExpr}), '[]'::json)`;
    }

    like(expr: string, pattern: string, insensitive: boolean): string {
        return `${expr} ${insensitive ? 'ILIKE' : 'LIKE'} ${pattern} ESCAPE '\\'`;
    }

    /** A POSIX regular expression match; a dialect without one refuses with `unsupported`. */
    regex(expr: string, pattern: string, insensitive: boolean): string {
        return `${expr} ${insensitive ? '~*' : '~'} ${pattern}`;
    }

    /** Array overlap (ov), contains (cs) or contained by (cd); only Postgres has array columns. */
    arrayCompare(expr: string, op: 'ov' | 'cs' | 'cd', array: string): string {
        return `${expr} ${op === 'ov' ? '&&' : op === 'cs' ? '@>' : '<@'} ${array}`;
    }

    isBoolean(expr: string, value: boolean): string {
        return `${expr} IS ${value ? 'TRUE' : 'FALSE'}`;
    }

    orderBy(expr: string, desc: boolean, nulls?: 'first' | 'last'): string {
        return `${expr} ${desc ? 'DESC' : 'ASC'}${nulls ? ` NULLS ${nulls.toUpperCase()}` : ''}`;
    }

    /** limit and offset are integers checked by the grammar. */
    page(limit: number | undefined, offset: number | undefined): string {
        return `${limit !== undefined ? ` LIMIT ${limit}` : ''}${offset ? ` OFFSET ${offset}` : ''}`;
    }

    rowNumber(orderSql: string): string {
        return `ROW_NUMBER() OVER (ORDER BY ${orderSql})`;
    }

    aggregate(fn: Aggregate, expr: string | null): string {
        return fn === 'count' ? 'COUNT(*)' : `${fn.toUpperCase()}(${expr})`;
    }

    /** A row-producing statement limited to its first row. */
    first(selectSql: string): string {
        return `${selectSql} LIMIT 1`;
    }
}
