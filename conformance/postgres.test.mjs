import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createREST } from '../packages/core/dist/index.js';
import { postgres } from '../packages/postgres/dist/index.js';
import { examples, run } from './examples.mjs';
import { PAGES, optionsFor } from './pages.mjs';

const require = createRequire(new URL('../packages/postgres/package.json', import.meta.url));
const { Pool } = require('pg');
const url = process.env.RESTLOOM_PG_URL;
const fixture = readFileSync(new URL('./fixtures/postgres.sql', import.meta.url), 'utf8');

let pool;
before(() => { if (url) pool = new Pool({ connectionString: url }); });
after(async () => { await pool?.end(); });

for (const page of PAGES) {
    describe(`postgres ${page}`, { skip: !url && 'RESTLOOM_PG_URL is not set' }, () => {
        let rest;
        before(async () => {
            await pool.query(fixture);
            const dialect = postgres(pool);
            rest = createREST({ db: dialect, ...optionsFor(dialect) });
        });
        for (const example of examples(new URL(`../docs/${page}`, import.meta.url).pathname)) {
            test(example.name, () => run(rest, example, assert));
        }
    });
}

describe('postgres procedures outside the exposed schemas', { skip: !url && 'RESTLOOM_PG_URL is not set' }, () => {
    test('a declared function is read even when only tables are exposed', async () => {
        await pool.query(fixture);
        const rest = createREST({ db: postgres(pool), expose: { tables: ['demo.tags'] }, procedures: { 'assets/{asset}/retire': { function: 'demo.retire_asset' } } });
        const res = await rest.handle({ method: 'POST', path: '/assets/3/retire', query: new URLSearchParams(), headers: {}, body: {}, context: undefined });
        assert.equal(res.status, 200);
        assert.equal(res.body, 3);
    });
});
