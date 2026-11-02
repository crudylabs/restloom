import type { Catalog, CatalogTable } from '@crudy/restloom';
import type { Database } from 'better-sqlite3';
import { logical } from './types.js';

type Row = Record<string, unknown>;

/** Reads tables and views of the main database or of attached ones; SQLite's schemas are its attached databases. */
export function introspect(db: Database, scope: { schemas: string[]; tables: string[] }): Catalog {
    const schemas = new Set([...scope.schemas, ...scope.tables.map((t) => t.split('.')[0])]);
    const attached = new Set((db.prepare('PRAGMA database_list').all() as Row[]).map((r) => r.name as string));
    const tables: CatalogTable[] = [];
    for (const schema of schemas) {
        if (!attached.has(schema)) continue;
        const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
        const rows = db.prepare(`SELECT name, type FROM ${q(schema)}.sqlite_schema WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'`).all() as Row[];
        for (const r of rows) {
            const name = r.name as string;
            if (!scope.schemas.includes(schema) && !scope.tables.includes(`${schema}.${name}`)) continue;
            const cols = db.prepare(`PRAGMA ${q(schema)}.table_xinfo(${q(name)})`).all() as Row[];
            const fks = db.prepare(`PRAGMA ${q(schema)}.foreign_key_list(${q(name)})`).all() as Row[];
            const byId = new Map<number, Row[]>();
            for (const f of fks) byId.set(f.id as number, [...(byId.get(f.id as number) ?? []), f]);
            tables.push({
                schema, name, kind: r.type === 'view' ? 'view' : 'table',
                columns: cols.filter((c) => c.hidden !== 1).map((c) => ({
                    name: c.name as string, nativeType: c.type as string, type: logical(c.type as string),
                    nullable: !c.notnull, generated: c.hidden === 2 || c.hidden === 3,
                })),
                primaryKey: cols.filter((c) => (c.pk as number) > 0).sort((a, b) => (a.pk as number) - (b.pk as number)).map((c) => c.name as string),
                foreignKeys: [...byId.values()].map((parts) => {
                    const ordered = parts.sort((a, b) => (a.seq as number) - (b.seq as number));
                    return {
                        columns: ordered.map((p) => p.from as string),
                        target: { schema, table: ordered[0].table as string },
                        targetColumns: ordered.map((p) => p.to as string),
                    };
                }),
            });
        }
    }
    return { tables, functions: [] };
}
