import { qualified, type Catalog, type CatalogColumn, type CatalogTable } from './catalog.js';
import { DEFAULT_SENSITIVE, type ResourceOptions, type RestOptions } from './options.js';
import { discoverRelations } from './relations.js';

export interface Column extends CatalogColumn {
    create: boolean;
    update: boolean;
}

export interface Junction {
    schema: string;
    table: string;
    /** Junction columns matching the source key, in order. */
    from: string[];
    /** Junction columns matching the target key, in order. */
    to: string[];
}

/**
 * A relation from a resource to another. `one` and `many` match target.to
 * against source.from; `many` through a junction matches the junction instead.
 */
export interface Relation {
    name: string;
    kind: 'one' | 'many';
    target: Resource;
    from: string[];
    to: string[];
    through?: Junction;
}

export interface Resource {
    name: string;
    schema: string;
    table: string;
    kind: 'table' | 'view';
    /** Visible columns: everything the API may read, filter, sort or write. */
    columns: Map<string, Column>;
    /** Every column, hidden ones included, for joins only. */
    all: Map<string, CatalogColumn>;
    key: string[];
    relations: Map<string, Relation>;
    write: { create: boolean; update: boolean; delete: boolean; bulk: boolean };
}

function exposed(t: CatalogTable, expose: RestOptions['expose']): boolean {
    return (expose.schemas ?? []).includes(t.schema) || (expose.tables ?? []).includes(qualified(t));
}

function names(tables: CatalogTable[]): Map<CatalogTable, string> {
    const count = new Map<string, number>();
    for (const t of tables) count.set(t.name, (count.get(t.name) ?? 0) + 1);
    return new Map(tables.map((t) => [t, count.get(t.name)! > 1 ? `${t.schema}_${t.name}` : t.name]));
}

function columnsOf(t: CatalogTable, o: ResourceOptions, sensitive: RegExp): Map<string, Column> {
    const hide = new Set(o.hide ?? []);
    const show = new Set(o.show ?? []);
    for (const c of [...hide, ...show]) {
        if (!t.columns.some((col) => col.name === c)) throw new Error(`restloom: ${t.name} has no column ${c} to hide or show`);
    }
    const w = o.write === true ? { create: true, update: true } : o.write || {};
    const allowed = (setting: boolean | string[] | undefined, c: CatalogColumn) =>
        !c.generated && (setting === true || (Array.isArray(setting) && setting.includes(c.name)));
    const out = new Map<string, Column>();
    for (const c of t.columns) {
        if (hide.has(c.name) || (sensitive.test(c.name) && !show.has(c.name))) continue;
        const keyColumn = t.primaryKey.includes(c.name);
        out.set(c.name, { ...c, create: allowed(w.create, c), update: !keyColumn && allowed(w.update, c) });
    }
    for (const setting of [w.create, w.update]) {
        for (const c of Array.isArray(setting) ? setting : []) {
            if (!out.has(c)) throw new Error(`restloom: ${t.name}.${c} is not a visible column and cannot be writable`);
        }
    }
    return out;
}

/**
 * Turns a catalog into the API's resources. Only exposed tables and views
 * become resources; relations come from foreign keys between them, then the
 * options override, add or remove them.
 */
export function buildResources(catalog: Catalog, options: RestOptions<unknown>): Map<string, Resource> {
    const sensitive = options.sensitive ?? DEFAULT_SENSITIVE;
    const tables = catalog.tables.filter((t) => exposed(t, options.expose));
    const named = names(tables);
    const config = options.resources ?? {};
    for (const name of Object.keys(config)) {
        if (![...named.values()].includes(name)) throw new Error(`restloom: no exposed table or view is named ${name}`);
    }
    const resources = new Map<string, Resource>();
    for (const t of tables) {
        const name = named.get(t)!;
        const own = config[name] ?? {};
        if (own.expose === false) continue;
        const o = own.write === undefined && t.kind === 'table' ? { ...own, write: options.write } : own;
        const key = o.key ?? (t.primaryKey.length ? t.primaryKey : t.columns.some((c) => c.name === 'id') ? ['id'] : []);
        const w = o.write === true ? { delete: true, bulk: false } : o.write || {};
        const columns = columnsOf(t, o, sensitive);
        resources.set(name, {
            name, schema: t.schema, table: t.name, kind: t.kind, columns, key,
            all: new Map(t.columns.map((c) => [c.name, c])),
            relations: new Map(),
            write: {
                create: [...columns.values()].some((c) => c.create),
                update: [...columns.values()].some((c) => c.update),
                delete: w.delete === true,
                bulk: w.bulk === true,
            },
        });
    }
    discoverRelations(catalog, resources, config);
    return resources;
}
