import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createREST } from '@crudy/restloom';
import { restloom } from '../dist/index.js';
import { fakeDialect } from '../../core/test/fake-dialect.mjs';

const require = createRequire(import.meta.url);
const express = require('express');

test('serves restloom where it is mounted', async () => {
    const rest = createREST({ db: fakeDialect(), expose: { schemas: ['app'] } });
    const app = express();
    app.use('/api', express.json(), restloom(rest));
    const server = app.listen(0);
    const port = server.address().port;
    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/items?select=id`);
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), [{ id: 1, name: 'one' }]);
        assert.equal(res.headers.get('content-range'), '0-0/*');
        const write = await fetch(`http://127.0.0.1:${port}/api/items`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"x"}' });
        assert.equal(write.status, 405);
    } finally {
        server.close();
    }
});
