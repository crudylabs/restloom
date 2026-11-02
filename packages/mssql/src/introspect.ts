import type { Catalog, CatalogTable } from '@crudy/restloom';
import type { ConnectionPool } from 'mssql';
import { logical } from './types.js';

type Row = Record<string, unknown>;

const OBJECTS = `
SELECT o.object_id AS id, SCHEMA_NAME(o.schema_id) AS s, o.name AS n, RTRIM(o.type) AS t
  FROM sys.objects o
 WHERE o.type IN ('U', 'V', 'FN', 'IF', 'TF')
   AND (SCHEMA_NAME(o.schema_id) IN (SELECT value FROM STRING_SPLIT(@schemas, ','))
        OR (o.type IN ('U', 'V') AND SCHEMA_NAME(o.schema_id) + '.' + o.name IN (SELECT value FROM STRING_SPLIT(@tables, ','))))`;

const COLUMNS = `
SELECT c.object_id AS id, c.name, TYPE_NAME(c.user_type_id) AS type, c.is_nullable AS nullable,
       CAST(CASE WHEN c.is_computed = 1 OR c.is_identity = 1 THEN 1 ELSE 0 END AS bit) AS generated
  FROM sys.columns c WHERE c.object_id IN (SELECT value FROM STRING_SPLIT(@ids, ','))
 ORDER BY c.object_id, c.column_id`;

const PRIMARY_KEYS = `
SELECT i.object_id AS id, c.name FROM sys.indexes i
  JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
  JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
 WHERE i.is_primary_key = 1 AND i.object_id IN (SELECT value FROM STRING_SPLIT(@ids, ','))
 ORDER BY i.object_id, ic.key_ordinal`;

const FOREIGN_KEYS = `
SELECT fk.object_id AS fk, fk.parent_object_id AS id, pc.name AS col, SCHEMA_NAME(t.schema_id) AS ts, t.name AS tt, rc.name AS rcol
  FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
  JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
  JOIN sys.tables t ON t.object_id = fk.referenced_object_id
 WHERE fk.parent_object_id IN (SELECT value FROM STRING_SPLIT(@ids, ','))
 ORDER BY fk.object_id, fkc.constraint_column_id`;

const PARAMETERS = `
SELECT p.object_id AS id, SUBSTRING(p.name, 2, 200) AS name, TYPE_NAME(p.user_type_id) AS type
  FROM sys.parameters p WHERE p.parameter_id > 0 AND p.object_id IN (SELECT value FROM STRING_SPLIT(@ids, ','))
 ORDER BY p.object_id, p.parameter_id`;

/** Reads tables, views and functions from the catalog views. T-SQL does not expose parameter defaults, so every argument is required. */
export async function introspect(pool: ConnectionPool, scope: { schemas: string[]; tables: string[] }): Promise<Catalog> {
    const run = async (sql: string, params: Record<string, string>) => {
        const req = pool.request();
        for (const [k, v] of Object.entries(params)) req.input(k, v);
        return (await req.query(sql)).recordset as Row[];
    };
    const objects = await run(OBJECTS, { schemas: scope.schemas.join(','), tables: scope.tables.join(',') });
    const ids = { ids: objects.map((o) => String(o.id)).join(',') };
    const [columns, keys, fks, params] = await Promise.all([run(COLUMNS, ids), run(PRIMARY_KEYS, ids), run(FOREIGN_KEYS, ids), run(PARAMETERS, ids)]);
    const columnsOf = (id: unknown) => columns.filter((c) => c.id === id).map((c) => ({
        name: c.name as string, nativeType: c.type as string, type: logical(c.type as string), nullable: !!c.nullable, generated: !!c.generated,
    }));
    const tables = new Map<number, CatalogTable>();
    for (const o of objects) {
        if (o.t !== 'U' && o.t !== 'V') continue;
        tables.set(o.id as number, { schema: o.s as string, name: o.n as string, kind: o.t === 'V' ? 'view' : 'table', columns: [], primaryKey: [], foreignKeys: [] });
    }
    for (const [id, table] of tables) table.columns = columnsOf(id);
    for (const k of keys) tables.get(k.id as number)?.primaryKey.push(k.name as string);
    const byFk = new Map<number, Row[]>();
    for (const f of fks) byFk.set(f.fk as number, [...(byFk.get(f.fk as number) ?? []), f]);
    for (const parts of byFk.values()) {
        tables.get(parts[0].id as number)?.foreignKeys.push({
            columns: parts.map((p) => p.col as string), targetColumns: parts.map((p) => p.rcol as string),
            target: { schema: parts[0].ts as string, table: parts[0].tt as string },
        });
    }
    const functions = objects.filter((o) => o.t === 'FN' || o.t === 'IF' || o.t === 'TF').map((o) => ({
        schema: o.s as string, name: o.n as string, returnsSet: o.t !== 'FN', columns: o.t === 'FN' ? undefined : columnsOf(o.id),
        args: params.filter((p) => p.id === o.id).map((p) => ({ name: p.name as string, type: logical(p.type as string), nativeType: p.type as string, hasDefault: false })),
    }));
    return { tables: [...tables.values()], functions };
}
