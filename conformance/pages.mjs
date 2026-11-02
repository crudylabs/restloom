/** The docs pages whose examples are conformance cases, and the options every database runs them with. */
export const PAGES = ['query-grammar.md', 'writes.md'];

export const OPTIONS = {
    expose: { schemas: ['demo'] },
    resources: {
        asset_tags: { expose: false },
        tags: { write: true },
        assets: { write: { create: ['name', 'status', 'owner_id', 'cost'], update: ['name', 'status', 'owner_id'], delete: false } },
        incidents: { write: { create: true, update: true, delete: true, bulk: true } },
    },
    procedures: {
        'assets/{asset}/retire': { function: 'demo.retire_asset' },
        'tags/{tag}/assets': { function: 'demo.assets_tagged' },
    },
};
