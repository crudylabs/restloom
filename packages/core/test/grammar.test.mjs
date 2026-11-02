import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRead } from '../dist/grammar/read.js';
import { SqlRenderer } from '../dist/index.js';
import { resources, limits } from './fixture.mjs';

const r = resources();
const parse = (res, qs) => parseRead(r.get(res), new URLSearchParams(qs), limits);
const code = (fn) => { try { fn(); } catch (e) { return e.code; } return 'none'; };

test('unknown, hidden and quoted names', () => {
    assert.equal(code(() => parse('users', 'select=password_hash')), 'unknown_column');
    assert.equal(code(() => parse('users', 'nope=eq.1')), 'unknown_column');
    assert.deepEqual(parse('users', 'select="limit"').select.columns, ['limit']);
    assert.equal(parse('users', '"limit"=eq.2').where[0].path.column, 'limit');
    assert.equal(code(() => parse('users', 'limit=x')), 'bad_limit');
});

test('values are checked against the column type', () => {
    assert.equal(code(() => parse('todos', 'id=eq.abc')), 'invalid_value');
    assert.equal(code(() => parse('todos', 'pinned=eq.yes')), 'invalid_value');
    assert.equal(code(() => parse('todos', 'estimate=like.1*')), 'bad_operator');
    assert.equal(parse('todos', 'id=eq.4').where[0].value, 4);
});

test('relation paths, presence and depth', () => {
    const f = parse('todos', 'owner.manager.name=eq.Ada').where[0];
    assert.deepEqual(f.path.relations.map((x) => x.name), ['owner', 'manager']);
    assert.equal(code(() => parse('todos', 'owner.manager.manager.name=eq.Ada')), 'too_deep');
    assert.equal(parse('todos', 'tags=is.empty').where[0].kind, 'present');
    assert.equal(code(() => parse('todos', 'order=tags.name')), 'bad_order');
    assert.equal(parse('todos', 'order=tags.count.desc').order[0].key.kind, 'count');
});

test('limits are refused, not clamped', () => {
    assert.equal(code(() => parse('todos', 'limit=1001')), 'limit_exceeded');
    const many = Array.from({ length: 51 }, (_, i) => `id=neq.${i}`).join('&');
    assert.equal(code(() => parse('todos', many)), 'too_many_filters');
});

test('the key is appended to the order; a grouped read orders by its columns', () => {
    assert.deepEqual(parse('todos', 'order=name.desc').order.map((o) => o.key.path.column), ['name', 'id']);
    assert.equal(code(() => parse('todos', 'select=status,count()&order=name')), 'bad_order');
});

test('placeholders follow the text order, for positional databases too', () => {
    class Positional extends SqlRenderer { placeholder() { return '?'; } }
    const renderer = new Positional();
    const plan = parse('todos', 'select=id,owner(name)&status=eq.open');
    const scope = (res) => res.name === 'users' ? [{ kind: 'cmp', path: { relations: [], column: 'name' }, op: 'eq', negate: false, value: 'scoped' }] : [];
    const { sql, params } = renderer.read(plan, renderer.context(scope));
    assert.equal(sql.split('?').length - 1, params.length);
    assert.deepEqual(params, ['scoped', 'open']);
});
