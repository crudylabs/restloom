import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createREST } from '../packages/core/dist/index.js';
import { mysql } from '../packages/mysql/dist/index.js';
import { examples, run } from './examples.mjs';
import { PAGES, optionsFor, skipFor } from './pages.mjs';

const require = createRequire(new URL('../packages/mysql/package.json', import.meta.url));
const { createPool } = require('mysql2/promise');
const url = process.env.RESTLOOM_MYSQL_URL;
const fixture = readFileSync(new URL('./fixtures/mysql.sql', import.meta.url), 'utf8');

let pool;
let admin;
before(() => {
    if (!url) return;
    pool = createPool({ uri: url, connectionLimit: 4 });
    admin = createPool({ uri: url, connectionLimit: 1, multipleStatements: true });
});
after(async () => { await pool?.end(); await admin?.end(); });

for (const page of PAGES) {
    describe(`mysql ${page}`, { skip: !url && 'RESTLOOM_MYSQL_URL is not set' }, () => {
        let rest;
        before(async () => {
            await admin.query(fixture);
            const db = mysql(pool);
            rest = createREST({ db, ...optionsFor(db) });
        });
        for (const example of examples(new URL(`../docs/${page}`, import.meta.url).pathname)) {
            test(example.name, { skip: skipFor('mysql', example) }, () => run(rest, example, assert));
        }
    });
}

describe('mysql regular expressions', { skip: !url && 'RESTLOOM_MYSQL_URL is not set' }, () => {
    test('imatch ignores case, match does not', async () => {
        await admin.query(fixture);
        const rest = createREST({ db: mysql(pool), expose: { schemas: ['demo'] } });
        const get = async (qs) => (await rest.handle({ method: 'GET', path: '/users', query: new URLSearchParams(qs), headers: {}, context: undefined })).body;
        assert.deepEqual(await get('select=id&name=imatch.^(ada|LINUS)$'), [{ id: 1 }, { id: 3 }]);
        assert.deepEqual(await get('select=id&name=match.^(ada|LINUS)$'), []);
    });
});
