import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createREST, nodeListener } from '../dist/index.js';
import { fakeDialect } from './fake-dialect.mjs';

test('the node listener serves under its prefix and refuses bad bodies', async () => {
    const rest = createREST({ db: fakeDialect(), expose: { schemas: ['app'] } });
    const server = http.createServer(nodeListener(rest, { prefix: '/api' })).listen(0);
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        assert.equal((await fetch(`${base}/api/items`)).status, 200);
        assert.equal((await fetch(`${base}/items`)).status, 404);
        const bad = await fetch(`${base}/api/items`, { method: 'POST', body: '{nope' });
        assert.equal(bad.status, 400);
        assert.deepEqual(await bad.json(), { error: 'bad_body' });
    } finally {
        server.close();
    }
});

test('Prefer: count=exact counts as count=exact does', async () => {
    const rest = createREST({ db: fakeDialect(), expose: { schemas: ['app'] } });
    const res = await rest.handle({ method: 'GET', path: '/items', query: new URLSearchParams(), headers: { prefer: 'count=exact' }, context: undefined });
    assert.equal(res.headers['content-range'], '0-0/1');
});
