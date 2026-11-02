/**
 * What a dialect reads from its database's catalog. The core never queries the
 * catalog itself: every dialect maps its own types onto these logical ones, and
 * operators, aggregates and value checks are decided on the logical type.
 */
export type LogicalType =
    | 'text' | 'integer' | 'number' | 'boolean' | 'uuid'
    | 'date' | 'timestamp' | 'time' | 'json' | 'binary' | 'array' | 'other';

export interface CatalogColumn {
    name: string;
    type: LogicalType;
    /** The database's own type name, kept for error messages and dialect use. */
    nativeType: string;
    nullable: boolean;
    /** Computed by the database: never writable. */
    generated: boolean;
}

export interface CatalogForeignKey {
    columns: string[];
    target: { schema: string; table: string };
    targetColumns: string[];
}

export interface CatalogTable {
    schema: string;
    name: string;
    kind: 'table' | 'view';
    columns: CatalogColumn[];
    primaryKey: string[];
    foreignKeys: CatalogForeignKey[];
}

export interface CatalogFunction {
    schema: string;
    name: string;
    args: { name: string; type: LogicalType; nativeType: string; hasDefault: boolean }[];
    returnsSet: boolean;
}

export interface Catalog {
    tables: CatalogTable[];
    functions: CatalogFunction[];
}

export function qualified(t: { schema: string; name: string } | { schema: string; table: string }): string {
    return `${t.schema}.${'name' in t ? t.name : t.table}`;
}
