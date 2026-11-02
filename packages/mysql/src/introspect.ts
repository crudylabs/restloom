import type { Catalog, CatalogTable } from '@crudy/restloom';
import type { Pool } from 'mysql2/promise';
import { logical } from './types.js';

type Row = Record<string, unknown>;

const IN_SCOPE = '(t.TABLE_SCHEMA IN (?) OR CONCAT(t.TABLE_SCHEMA, \'.\', t.TABLE_NAME) IN (?))';

/** Reads tables, views, columns, keys and functions from information_schema. MySQL's schemas are its databases. */
export async function introspect(pool: Pool, scope: { schemas: string[]; tables: string[] }): Promise<Catalog> {
    const schemas = scope.schemas.length ? scope.schemas : [''];
    const tablesIn = scope.tables.length ? scope.tables : [''];
    const q = async (sql: string, params: unknown[]) => (await pool.query(sql, params))[0] as Row[];
    const [tables, columns, keys, params, functions] = await Promise.all([
        q(`SELECT TABLE_SCHEMA AS s, TABLE_NAME AS n, TABLE_TYPE AS k FROM information_schema.TABLES t WHERE ${IN_SCOPE}`, [schemas, tablesIn]),
        q(`SELECT c.TABLE_SCHEMA AS s, c.TABLE_NAME AS n, c.COLUMN_NAME AS name, c.DATA_TYPE AS dt, c.COLUMN_TYPE AS ct, c.IS_NULLABLE AS nullable, c.EXTRA AS extra
             FROM information_schema.COLUMNS c JOIN information_schema.TABLES t ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
            WHERE ${IN_SCOPE} ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION`, [schemas, tablesIn]),
        q(`SELECT k.TABLE_SCHEMA AS s, k.TABLE_NAME AS n, k.CONSTRAINT_NAME AS c, k.COLUMN_NAME AS col,
                  k.REFERENCED_TABLE_SCHEMA AS rs, k.REFERENCED_TABLE_NAME AS rt, k.REFERENCED_COLUMN_NAME AS rc
             FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.TABLES t ON t.TABLE_SCHEMA = k.TABLE_SCHEMA AND t.TABLE_NAME = k.TABLE_NAME
            WHERE ${IN_SCOPE} AND (k.CONSTRAINT_NAME = 'PRIMARY' OR k.REFERENCED_TABLE_NAME IS NOT NULL)
            ORDER BY k.CONSTRAINT_NAME, k.ORDINAL_POSITION`, [schemas, tablesIn]),
        q(`SELECT SPECIFIC_SCHEMA AS s, SPECIFIC_NAME AS n, PARAMETER_NAME AS name, DATA_TYPE AS dt, DTD_IDENTIFIER AS ct
             FROM information_schema.PARAMETERS WHERE SPECIFIC_SCHEMA IN (?) AND ORDINAL_POSITION > 0 ORDER BY ORDINAL_POSITION`, [schemas]),
        q(`SELECT ROUTINE_SCHEMA AS s, ROUTINE_NAME AS n FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA IN (?) AND ROUTINE_TYPE = 'FUNCTION'`, [schemas]),
    ]);
    const byName = new Map<string, CatalogTable>();
    for (const t of tables) {
        byName.set(`${t.s}.${t.n}`, { schema: t.s as string, name: t.n as string, kind: t.k === 'VIEW' ? 'view' : 'table', columns: [], primaryKey: [], foreignKeys: [] });
    }
    for (const c of columns) {
        byName.get(`${c.s}.${c.n}`)?.columns.push({
            name: c.name as string, nativeType: c.ct as string, type: logical(c.dt as string, c.ct as string),
            nullable: c.nullable === 'YES', generated: /GENERATED/i.test(c.extra as string),
        });
    }
    const fks = new Map<string, { table: CatalogTable; columns: string[]; targetColumns: string[]; target: { schema: string; table: string } }>();
    for (const k of keys) {
        const table = byName.get(`${k.s}.${k.n}`);
        if (!table) continue;
        if (k.c === 'PRIMARY') { table.primaryKey.push(k.col as string); continue; }
        const id = `${k.s}.${k.n}.${k.c}`;
        const fk = fks.get(id) ?? { table, columns: [], targetColumns: [], target: { schema: k.rs as string, table: k.rt as string } };
        fk.columns.push(k.col as string);
        fk.targetColumns.push(k.rc as string);
        fks.set(id, fk);
    }
    for (const { table, ...fk } of fks.values()) table.foreignKeys.push(fk);
    return {
        tables: [...byName.values()],
        functions: functions.map((f) => ({
            schema: f.s as string, name: f.n as string, returnsSet: false,
            args: params.filter((p) => p.s === f.s && p.n === f.n).map((p) => ({
                name: p.name as string, type: logical(p.dt as string, p.ct as string), nativeType: p.ct as string, hasDefault: false,
            })),
        })),
    };
}
