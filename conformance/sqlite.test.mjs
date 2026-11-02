import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createREST } from '../packages/core/dist/index.js';
import { sqlite } from '../packages/sqlite/dist/index.js';
import { examples, run } from './examples.mjs';
import { PAGES, optionsFor, skipFor } from './pages.mjs';

const require = createRequire(new URL('../packages/sqlite/package.json', import.meta.url));
const Database = require('better-sqlite3');
const fixture = readFileSync(new URL('./fixtures/sqlite.sql', import.meta.url), 'utf8');

for (const page of PAGES) {
    describe(`sqlite ${page}`, () => {
        const db = new Database(':memory:');
        const dialect = sqlite(db);
        let rest;
        before(() => {
            db.exec("ATTACH ':memory:' AS demo");
            db.exec(fixture);
            rest = createREST({ db: dialect, ...optionsFor(dialect) });
        });
        for (const example of examples(new URL(`../docs/${page}`, import.meta.url).pathname)) {
            test(example.name, { skip: skipFor('sqlite', example) }, () => run(rest, example, assert));
        }
    });
}
