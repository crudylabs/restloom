import type { Catalog, CatalogColumn, CatalogTable } from '@crudy/restloom';
import type { Pool } from 'pg';
import { logical } from './types.js';

const TABLES = `
SELECT c.oid, n.nspname AS schema, c.relname AS name, c.relkind AS kind
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
   AND (n.nspname = ANY($1::text[]) OR n.nspname || '.' || c.relname = ANY($2::text[]))`;

const COLUMNS = `
SELECT a.attrelid AS oid, a.attname AS name, format_type(a.atttypid, a.atttypmod) AS native,
       b.typname, b.typtype, b.typcategory, a.attnotnull AS notnull,
       (a.attgenerated <> '' OR a.attidentity = 'a') AS generated
  FROM pg_attribute a
  JOIN pg_type t ON t.oid = a.atttypid
  JOIN pg_type b ON b.oid = CASE WHEN t.typtype = 'd' THEN t.typbasetype ELSE t.oid END
 WHERE a.attrelid = ANY($1::oid[]) AND a.attnum > 0 AND NOT a.attisdropped
 ORDER BY a.attrelid, a.attnum`;

const PRIMARY_KEYS = `
SELECT i.indrelid AS oid, array_agg(a.attname::text ORDER BY k.ord) AS columns
  FROM pg_index i
  CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
 WHERE i.indisprimary AND i.indrelid = ANY($1::oid[])
 GROUP BY i.indrelid`;

const FOREIGN_KEYS = `
SELECT con.conrelid AS oid, tn.nspname AS target_schema, tc.relname AS target_table,
       (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(con.conkey) WITH ORDINALITY k(n, ord)
          JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.n) AS columns,
       (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(con.confkey) WITH ORDINALITY k(n, ord)
          JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.n) AS target_columns
  FROM pg_constraint con
  JOIN pg_class tc ON tc.oid = con.confrelid
  JOIN pg_namespace tn ON tn.oid = tc.relnamespace
 WHERE con.contype = 'f' AND con.conrelid = ANY($1::oid[])
 ORDER BY con.conname`;

const FUNCTIONS = `
SELECT n.nspname AS schema, p.proname AS name, p.proretset AS returns_set, p.pronargs AS nargs,
       p.pronargdefaults AS ndefaults, coalesce(p.proargnames, '{}') AS argnames,
       (SELECT array_agg(format_type(t, NULL) ORDER BY ord) FROM unnest(p.proargtypes) WITH ORDINALITY u(t, ord)) AS natives,
       (SELECT array_agg(b.typname::text || ':' || b.typtype::text || ':' || b.typcategory::text ORDER BY ord)
          FROM unnest(p.proargtypes) WITH ORDINALITY u(t, ord) JOIN pg_type b ON b.oid = u.t) AS types
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE p.prokind = 'f' AND n.nspname = ANY($1::text[])`;

type Row = Record<string, unknown>;

/** Reads the tables, views, keys, foreign keys and functions of the exposed schemas and tables. */
export async function introspect(pool: Pool, scope: { schemas: string[]; tables: string[] }): Promise<Catalog> {
    const { rows: tables } = await pool.query<Row>(TABLES, [scope.schemas, scope.tables]);
    const oids = tables.map((t) => t.oid as number);
    const [columns, keys, fks, fns] = await Promise.all([
        pool.query<Row>(COLUMNS, [oids]), pool.query<Row>(PRIMARY_KEYS, [oids]),
        pool.query<Row>(FOREIGN_KEYS, [oids]), pool.query<Row>(FUNCTIONS, [scope.schemas]),
    ]);
    const byOid = new Map<number, CatalogTable>();
    for (const t of tables) {
        byOid.set(t.oid as number, {
            schema: t.schema as string, name: t.name as string,
            kind: t.kind === 'v' || t.kind === 'm' ? 'view' : 'table',
            columns: [], primaryKey: [], foreignKeys: [],
        });
    }
    for (const c of columns.rows) {
        const col: CatalogColumn = {
            name: c.name as string, nativeType: c.native as string, nullable: !c.notnull, generated: c.generated as boolean,
            type: logical(c.typname as string, c.typtype as string, c.typcategory as string),
        };
        byOid.get(c.oid as number)?.columns.push(col);
    }
    for (const k of keys.rows) byOid.get(k.oid as number)!.primaryKey = k.columns as string[];
    for (const f of fks.rows) {
        byOid.get(f.oid as number)!.foreignKeys.push({
            columns: f.columns as string[], targetColumns: f.target_columns as string[],
            target: { schema: f.target_schema as string, table: f.target_table as string },
        });
    }
    const functions = fns.rows.map((f) => {
        const names = f.argnames as string[];
        const types = (f.types as string[] | null) ?? [];
        const natives = (f.natives as string[] | null) ?? [];
        const nargs = f.nargs as number;
        return {
            schema: f.schema as string, name: f.name as string, returnsSet: f.returns_set as boolean,
            args: types.map((t, i) => {
                const [typname, typtype, category] = t.split(':');
                return { name: names[i] ?? '', type: logical(typname, typtype, category), nativeType: natives[i], hasDefault: i >= nargs - (f.ndefaults as number) };
            }),
        };
    });
    return { tables: [...byOid.values()], functions };
}
