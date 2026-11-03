/** The docs pages whose examples are conformance cases, and the options every database runs them with. */
export const PAGES = ['query-grammar.md', 'writes.md', 'security.md'];

const PROCEDURES = {
    'todos/{todo}/complete': { function: 'demo.complete_todo' },
    'tags/{tag}/todos': { function: 'demo.todos_tagged' },
};

/**
 * The procedures each dialect's fixture defines: SQLite has no functions,
 * MySQL none returning a set, and a SQL Server function cannot change data.
 */
const AVAILABLE = {
    postgres: Object.keys(PROCEDURES),
    mssql: ['tags/{tag}/todos'],
    mysql: ['todos/{todo}/complete'],
    sqlite: [],
};

export const OPTIONS = {
    expose: { schemas: ['demo'] },
    resources: {
        todo_tags: { expose: false },
        tags: { write: true },
        todos: { write: { create: ['name', 'status', 'owner_id', 'estimate'], update: ['name', 'status', 'owner_id'], delete: false } },
        steps: { write: { create: true, update: true, delete: true, bulk: true } },
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
