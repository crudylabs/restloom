import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createREST } from '../packages/core/dist/index.js';
import { mssql } from '../packages/mssql/dist/index.js';
import { examples, run } from './examples.mjs';
import { PAGES, optionsFor, skipFor } from './pages.mjs';

const require = createRequire(new URL('../packages/mssql/package.json', import.meta.url));
const driver = require('mssql');
const url = process.env.RESTLOOM_MSSQL_URL;
const batches = readFileSync(new URL('./fixtures/mssql.sql', import.meta.url), 'utf8').split(/^GO$/m);

let pool;
before(async () => { if (url) pool = await new driver.ConnectionPool(url).connect(); });
after(async () => { await pool?.close(); });

for (const page of PAGES) {
    describe(`mssql ${page}`, { skip: !url && 'RESTLOOM_MSSQL_URL is not set' }, () => {
        let rest;
        before(async () => {
            for (const batch of batches) await pool.request().batch(batch);
            const db = mssql(pool);
            rest = createREST({ db, ...optionsFor(db) });
        });
        for (const example of examples(new URL(`../docs/${page}`, import.meta.url).pathname)) {
            test(example.name, { skip: skipFor('mssql', example) }, () => run(rest, example, assert));
        }
    });
}
