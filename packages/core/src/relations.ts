import { qualified, type Catalog, type CatalogForeignKey, type CatalogTable } from './catalog.js';
import type { RelationOptions, ResourceOptions } from './options.js';
import type { Relation, Resource } from './resources.js';

function stripId(columns: string[]): string | null {
    return columns.length === 1 && columns[0].endsWith('_id') && columns[0].length > 3 ? columns[0].slice(0, -3) : null;
}

function taken(r: Resource, name: string): boolean {
    return r.all.has(name) || r.relations.has(name);
}

/** Adds a discovered relation under the first free candidate name. */
function addDiscovered(r: Resource, candidates: (string | null)[], rel: Omit<Relation, 'name'>): void {
    const name = candidates.find((c): c is string => !!c && !taken(r, c));
    if (!name) throw new Error(`restloom: no free name for a relation of ${r.name} to ${rel.target.name}; name it in resources.${r.name}.relations`);
    r.relations.set(name, { name, ...rel });
}

/** A table whose primary key is exactly the columns of its two foreign keys links the two tables they point to. */
function junctionKeys(t: CatalogTable): [CatalogForeignKey, CatalogForeignKey] | null {
    if (t.foreignKeys.length !== 2) return null;
    const fkCols = t.foreignKeys.flatMap((fk) => fk.columns);
    const pk = new Set(t.primaryKey);
    if (pk.size !== fkCols.length || !fkCols.every((c) => pk.has(c))) return null;
    return [t.foreignKeys[0], t.foreignKeys[1]];
}

function explicit(name: string, source: Resource, o: RelationOptions, catalog: Catalog, resources: Map<string, Resource>): Relation {
    const target = resources.get('one' in o ? o.one : o.many);
    if (!target) throw new Error(`restloom: relation ${source.name}.${name} points to a resource that is not exposed`);
    const need = (r: Resource, c: string) => { if (!r.all.has(c)) throw new Error(`restloom: ${r.name} has no column ${c} for relation ${source.name}.${name}`); return c; };
    if ('one' in o) return { name, kind: 'one', target, from: [need(source, o.via)], to: [need(target, o.references ?? target.key[0] ?? 'id')] };
    if ('via' in o) return { name, kind: 'many', target, from: [need(source, o.references ?? source.key[0] ?? 'id')], to: [need(target, o.via)] };
    const ref = o.through.includes('.') ? o.through : `${source.schema}.${o.through}`;
    const j = catalog.tables.find((t) => qualified(t) === ref);
    const fkTo = (r: Resource) => j?.foreignKeys.find((fk) => fk.target.schema === r.schema && fk.target.table === r.table);
    const toSource = fkTo(source);
    const toTarget = j?.foreignKeys.find((fk) => fk !== toSource && fk.target.schema === target.schema && fk.target.table === target.table);
    if (!j || !toSource || !toTarget) throw new Error(`restloom: ${o.through} does not link ${source.name} and ${target.name} with two foreign keys`);
    return {
        name, kind: 'many', target, from: toSource.targetColumns, to: toTarget.targetColumns,
        through: { schema: j.schema, table: j.name, from: toSource.columns, to: toTarget.columns },
    };
}

/**
 * Relations between exposed resources: a foreign key gives a to-one relation on
 * its side and a to-many on the other, a junction table gives a many-to-many on
 * both ends. Relations to tables that are not exposed do not exist.
 */
export function discoverRelations(catalog: Catalog, resources: Map<string, Resource>, config: Record<string, ResourceOptions>): void {
    const byTable = new Map([...resources.values()].map((r) => [`${r.schema}.${r.table}`, r]));
    for (const t of catalog.tables) {
        const source = byTable.get(qualified(t));
        for (const fk of t.foreignKeys) {
            const target = byTable.get(qualified(fk.target));
            if (!source || !target) continue;
            const stem = stripId(fk.columns);
            addDiscovered(source, [stem, target.name, `${fk.columns.join('_')}_${target.name}`], { kind: 'one', target, from: fk.columns, to: fk.targetColumns });
            addDiscovered(target, [source.name, `${source.name}_by_${stem ?? fk.columns.join('_')}`], { kind: 'many', target: source, from: fk.targetColumns, to: fk.columns });
        }
        const pair = junctionKeys(t);
        const a = pair && byTable.get(qualified(pair[0].target));
        const b = pair && byTable.get(qualified(pair[1].target));
        if (!pair || !a || !b) continue;
        const via = (x: CatalogForeignKey, y: CatalogForeignKey) => ({ schema: t.schema, table: t.name, from: x.columns, to: y.columns });
        addDiscovered(a, [b.name, `${b.name}_via_${t.name}`], { kind: 'many', target: b, from: pair[0].targetColumns, to: pair[1].targetColumns, through: via(pair[0], pair[1]) });
        if (a !== b) addDiscovered(b, [a.name, `${a.name}_via_${t.name}`], { kind: 'many', target: a, from: pair[1].targetColumns, to: pair[0].targetColumns, through: via(pair[1], pair[0]) });
    }
    for (const [resName, o] of Object.entries(config)) {
        const source = resources.get(resName);
        if (!source) continue;
        for (const [name, ro] of Object.entries(o.relations ?? {})) {
            source.relations.delete(name);
            if (ro === false) continue;
            if (source.all.has(name)) throw new Error(`restloom: relation ${resName}.${name} has the name of a column`);
            source.relations.set(name, explicit(name, source, ro, catalog, resources));
        }
    }
}
