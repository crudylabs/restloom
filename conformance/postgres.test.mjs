import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createREST } from '../packages/core/dist/index.js';
import { postgres } from '../packages/postgres/dist/index.js';
import { examples, run } from './examples.mjs';

const require = createRequire(new URL('../packages/postgres/package.json', import.meta.url));
const { Pool } = require('pg');
const url = process.env.RESTLOOM_PG_URL;
const docs = new URL('../docs/', import.meta.url).pathname;
const pages = ['query-grammar.md'];

let pool;
let rest;
before(async () => {
    if (!url) return;
    pool = new Pool({ connectionString: url });
    await pool.query(readFileSync(new URL('./fixtures/postgres.sql', import.meta.url), 'utf8'));
    rest = createREST({ db: postgres(pool), expose: { schemas: ['demo'] }, resources: { asset_tags: { expose: false } } });
});
after(async () => { await pool?.end(); });

for (const page of pages) {
    for (const example of examples(docs + page)) {
        test(`postgres ${example.name}`, { skip: !url && 'RESTLOOM_PG_URL is not set' }, () => run(rest, example, assert));
    }
}
