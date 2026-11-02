import { SqlRenderer, type CatalogColumn, type CatalogFunction, type RenderContext, type Statement } from '@crudy/restloom';

/**
 * MySQL 8: backquoted names, positional placeholders, no RETURNING. Arrays are
 * built with GROUP_CONCAT, which keeps an order where JSON_ARRAYAGG does not.
 */
export class MysqlRenderer extends SqlRenderer {
    quote(identifier: string): string {
        return `\`${identifier.replace(/`/g, '``')}\``;
    }

    literal(text: string): string {
        return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
    }

    placeholder(_index: number): string {
        return '?';
    }

    jsonObject(pairs: [string, string][]): string {
        return `JSON_OBJECT(${pairs.map(([k, v]) => `${this.literal(k)}, ${v}`).join(', ')})`;
    }

    jsonArray(rowExpr: string, orderExpr: string): string {
        return `COALESCE(CAST(CONCAT('[', GROUP_CONCAT(${rowExpr} ORDER BY ${orderExpr} SEPARATOR ','), ']') AS JSON), JSON_ARRAY())`;
    }

    nested(expr: string): string {
        return `CAST(${expr} AS JSON)`;
    }

    jsonValue(expr: string, column: CatalogColumn): string {
        if (column.type === 'boolean') return `IF(${expr} IS NULL, NULL, CAST(IF(${expr}, 'true', 'false') AS JSON))`;
        if (column.type === 'timestamp') return `DATE_FORMAT(${expr}, '%Y-%m-%dT%H:%i:%s${/^timestamp/i.test(column.nativeType) ? '+00:00' : ''}')`;
        return expr;
    }

    like(expr: string, pattern: string, insensitive: boolean): string {
        return insensitive
            ? `LOWER(${expr}) LIKE LOWER(${pattern}) ESCAPE '\\\\'`
            : `${expr} COLLATE utf8mb4_bin LIKE ${pattern} ESCAPE '\\\\'`;
    }

    regex(expr: string, pattern: string, insensitive: boolean): string {
        return `REGEXP_LIKE(${expr}, ${pattern}, '${insensitive ? 'i' : 'c'}')`;
    }

    isBoolean(expr: string, value: boolean): string {
        return `${expr} = ${value ? 1 : 0}`;
    }

    /** MySQL sorts nulls first ascending; this keeps the Postgres order: last ascending, first descending. */
    orderBy(expr: string, desc: boolean, nulls?: 'first' | 'last'): string {
        const first = (nulls ?? (desc ? 'first' : 'last')) === 'first';
        return `(${expr} IS NULL) ${first ? 'DESC' : 'ASC'}, ${expr} ${desc ? 'DESC' : 'ASC'}`;
    }

    page(limit: number | undefined, offset: number | undefined): string {
        return limit === undefined && !offset ? '' : ` LIMIT ${limit ?? '18446744073709551615'}${offset ? ` OFFSET ${offset}` : ''}`;
    }

    returning(): string {
        return '';
    }

    call(fn: CatalogFunction, args: [string, unknown][], ctx: RenderContext): Statement {
        const byName = new Map(args);
        const call = `${this.table(fn.schema, fn.name)}(${fn.args.map((a) => ctx.params.add(byName.get(a.name))).join(', ')})`;
        return ctx.params.finalize(`SELECT JSON_EXTRACT(JSON_ARRAY(${call}), '$[0]') AS r`, (i) => this.placeholder(i));
    }
}
