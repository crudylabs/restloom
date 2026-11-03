import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createREST, nodeListener, RestError } from '../dist/index.js';
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

test('a context that throws answers the request instead of stopping the process', async () => {
    const rest = createREST({ db: fakeDialect(), expose: { schemas: ['app'] } });
    const server = http.createServer(nodeListener(rest, {
        context(req) {
            if (req.headers.authorization === 'bad') throw new RestError(401, 'unauthenticated');
            if (req.headers.authorization === 'broken') throw new Error('database down');
            return {};
        },
    })).listen(0);
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        const refused = await fetch(`${base}/items`, { headers: { authorization: 'bad' } });
        assert.equal(refused.status, 401);
        assert.deepEqual(await refused.json(), { error: 'unauthenticated' });
        const broken = await fetch(`${base}/items`, { headers: { authorization: 'broken' } });
        assert.equal(broken.status, 500);
        assert.deepEqual(await broken.json(), { error: 'internal' });
        assert.equal((await fetch(`${base}/items`)).status, 200);
    } finally {
        server.close();
    }
});
