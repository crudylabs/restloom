import type { CatalogFunction } from '../catalog.js';
import type { Filter } from '../plan.js';
import type { Resource } from '../resources.js';
import type { RenderContext } from './context.js';
import { SqlReader, type Statement } from './reader.js';

export type { Statement } from './reader.js';

/**
 * Every statement restloom writes: reads from SqlReader, then inserts, updates,
 * deletes and function calls. Writes return the key of each written row, which
 * the core reads back when the client asks for the rows.
 */
export class SqlRenderer extends SqlReader {
    returning(resource: Resource): string {
        return ` RETURNING ${resource.key.map((k) => this.quote(k)).join(', ')}`;
    }

    insert(resource: Resource, columns: string[], rows: unknown[][], ctx: RenderContext): Statement {
        const values = rows.map((row) => `(${row.map((v) => ctx.params.add(v)).join(', ')})`).join(', ');
        const sql = `INSERT INTO ${this.table(resource.schema, resource.table)} (${columns.map((c) => this.quote(c)).join(', ')}) VALUES ${values}${this.returning(resource)}`;
        return ctx.params.finalize(sql, (i) => this.placeholder(i));
    }

    /** For databases without RETURNING: the keys a write will reach, locked until the transaction ends. */
    selectKeys(resource: Resource, where: Filter[], ctx: RenderContext): Statement {
        const alias = ctx.alias();
        const conditions = this.filters(resource, alias, where, ctx);
        const sql = `SELECT ${resource.key.map((k) => `${this.column(alias, k)} AS ${this.quote(k)}`).join(', ')} FROM ${this.table(resource.schema, resource.table)} ${alias}${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''} FOR UPDATE`;
        return ctx.params.finalize(sql, (i) => this.placeholder(i));
    }

    /** For databases without RETURNING: the first generated key of the last insert, as `id`. */
    lastInsertId(): string {
        return 'SELECT LAST_INSERT_ID() AS id';
    }

    writeTarget(resource: Resource, alias: string): string {
        return `${this.table(resource.schema, resource.table)} AS ${alias}`;
    }

    update(resource: Resource, set: [string, unknown][], where: Filter[], ctx: RenderContext): Statement {
        const alias = ctx.alias();
        const assignments = set.map(([c, v]) => `${this.quote(c)} = ${ctx.params.add(v)}`).join(', ');
        const conditions = this.filters(resource, alias, where, ctx);
        const sql = `UPDATE ${this.writeTarget(resource, alias)} SET ${assignments}${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''}${this.returning(resource)}`;
        return ctx.params.finalize(sql, (i) => this.placeholder(i));
    }

    delete(resource: Resource, where: Filter[], ctx: RenderContext): Statement {
        const alias = ctx.alias();
        const conditions = this.filters(resource, alias, where, ctx);
        const sql = `DELETE FROM ${this.writeTarget(resource, alias)}${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''}${this.returning(resource)}`;
        return ctx.params.finalize(sql, (i) => this.placeholder(i));
    }

    /** A function call by argument name; a set-returning function answers its rows, any other its value. */
    call(fn: CatalogFunction, args: [string, unknown][], ctx: RenderContext): Statement {
        const call = `${this.table(fn.schema, fn.name)}(${args.map(([n, v]) => `${this.quote(n)} => ${ctx.params.add(v)}`).join(', ')})`;
        const sql = fn.returnsSet ? `SELECT to_json(x) AS r FROM ${call} x` : `SELECT to_json(${call}) AS r`;
        return ctx.params.finalize(sql, (i) => this.placeholder(i));
    }
}
