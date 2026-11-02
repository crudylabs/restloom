/** The docs pages whose examples are conformance cases, and the options every database runs them with. */
export const PAGES = ['query-grammar.md', 'writes.md'];

const PROCEDURES = {
    'assets/{asset}/retire': { function: 'demo.retire_asset' },
    'tags/{tag}/assets': { function: 'demo.assets_tagged' },
};

/**
 * The procedures each dialect's fixture defines: SQLite has no functions,
 * MySQL none returning a set, and a SQL Server function cannot change data.
 */
const AVAILABLE = {
    postgres: Object.keys(PROCEDURES),
    mssql: ['tags/{tag}/assets'],
    mysql: ['assets/{asset}/retire'],
    sqlite: [],
};

export const OPTIONS = {
    expose: { schemas: ['demo'] },
    resources: {
        asset_tags: { expose: false },
        tags: { write: true },
        assets: { write: { create: ['name', 'status', 'owner_id', 'cost'], update: ['name', 'status', 'owner_id'], delete: false } },
        incidents: { write: { create: true, update: true, delete: true, bulk: true } },
    },
};

export function optionsFor(dialect) {
    const procedures = Object.fromEntries(AVAILABLE[dialect.name].map((t) => [t, PROCEDURES[t]]));
    return Object.keys(procedures).length ? { ...OPTIONS, procedures } : OPTIONS;
}

const pattern = (t) => new RegExp(`^/${t.replace(/\{[^}]+\}/g, '[^/]+')}$`);

/** Why a dialect skips an example, or false. */
export function skipFor(name, example) {
    const missing = Object.keys(PROCEDURES).filter((t) => !AVAILABLE[name].includes(t));
    return missing.some((t) => pattern(t).test(example.path)) && `${name} has no such function`;
}
