import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createREST } from '@crudy/restloom';
import { restloom } from '../dist/index.js';
import { fakeDialect } from '../../core/test/fake-dialect.mjs';

const require = createRequire(import.meta.url);
const Fastify = require('fastify');

test('serves restloom under its prefix with the request context', async () => {
    let seen;
    const rest = createREST({ db: fakeDialect(), expose: { schemas: ['app'] }, hooks: { authorize(req) { seen = req.context; } } });
    const app = Fastify();
    await app.register(restloom(rest, { context: (req) => ({ user: req.headers['x-user'] }) }), { prefix: '/api' });
    const res = await app.inject({ method: 'GET', url: '/api/items?select=id&count=exact', headers: { 'x-user': 'ada' } });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), [{ id: 1, name: 'one' }]);
    assert.equal(res.headers['content-range'], '0-0/1');
    assert.deepEqual(seen, { user: 'ada' });
    assert.equal((await app.inject({ method: 'GET', url: '/api/nope' })).statusCode, 404);
    await app.close();
});
