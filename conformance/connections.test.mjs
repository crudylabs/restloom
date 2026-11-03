import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as pg from '../packages/postgres/dist/index.js';
import * as my from '../packages/mysql/dist/index.js';
import * as ms from '../packages/mssql/dist/index.js';
import * as lite from '../packages/sqlite/dist/index.js';

// One install and one import: each database package brings the core with it,
// and the server databases open their own connection from a URL.
test('every database package exports the core', () => {
    for (const mod of [pg, my, ms, lite]) {
        assert.equal(typeof mod.createREST, 'function');
        assert.equal(typeof mod.nodeListener, 'function');
        assert.equal(typeof mod.RestError, 'function');
    }
});

test('postgres and mysql open a pool from a URL without connecting yet', async () => {
    assert.equal(pg.postgres('postgres://user:secret@127.0.0.1:1/app').name, 'postgres');
    assert.equal(my.mysql('mysql://user:secret@127.0.0.1:1/app').name, 'mysql');
});

test('postgres serves from a URL', { skip: !process.env.RESTLOOM_PG_URL && 'RESTLOOM_PG_URL is not set' }, async () => {
    const db = pg.postgres(process.env.RESTLOOM_PG_URL);
    const rows = await db.transaction((tx) => tx.query('SELECT 1 AS one', []), { timeoutMs: 5000, readOnly: true });
    assert.deepEqual(rows, [{ one: 1 }]);
});
