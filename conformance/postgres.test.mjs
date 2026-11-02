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

describe('postgres arrays, regular expressions and GET procedures', { skip: !url && 'RESTLOOM_PG_URL is not set' }, () => {
    let rest;
    before(async () => {
        await pool.query(fixture);
        rest = createREST({ db: postgres(pool), expose: { schemas: ['demo'] }, procedures: { 'tags/{tag}/assets': { function: 'demo.assets_tagged', method: 'GET' } } });
    });
    const get = (path, qs = '') => rest.handle({ method: 'GET', path, query: new URLSearchParams(qs), headers: {}, context: undefined });

    test('array overlap, contains and contained by', async () => {
        assert.deepEqual((await get('/notes', 'select=id&labels=ov.{a,z}')).body, [{ id: 1 }, { id: 3 }]);
        assert.deepEqual((await get('/notes', 'select=id&labels=cs.{b}')).body, [{ id: 1 }, { id: 2 }]);
        assert.deepEqual((await get('/notes', 'select=id&labels=cd.{a,b,z}')).body, [{ id: 1 }, { id: 3 }]);
        assert.equal((await get('/assets', 'name=ov.{a}')).body.error, 'bad_operator');
    });

    test('regular expressions, with and without case', async () => {
        assert.deepEqual((await get('/users', 'select=id&name=imatch.^(ada|LINUS)$')).body, [{ id: 1 }, { id: 3 }]);
        assert.deepEqual((await get('/users', 'select=id&name=match.^(ada|LINUS)$')).body, []);
    });

    test('a GET procedure takes its arguments from the query and refuses POST', async () => {
        const rows = (await get('/tags/gdpr/assets', 'select=ignored')).body;
        assert.equal(rows.error, 'unknown_argument');
        assert.deepEqual((await get('/tags/gdpr/assets')).body.map((r) => r.id), [2, 4]);
        const post = await rest.handle({ method: 'POST', path: '/tags/gdpr/assets', query: new URLSearchParams(), headers: {}, body: {}, context: undefined });
        assert.equal(post.status, 405);
    });
});
