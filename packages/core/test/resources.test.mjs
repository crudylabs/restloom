import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resources } from './fixture.mjs';

test('only exposed schemas become resources', () => {
    const r = resources();
    assert.deepEqual([...r.keys()].sort(), ['tags', 'todo_tags', 'todos', 'users']);
});

test('sensitive columns are hidden unless shown, and hide removes any column', () => {
    assert.equal(resources().get('users').columns.has('password_hash'), false);
    assert.equal(resources({ resources: { users: { show: ['password_hash'] } } }).get('users').columns.has('password_hash'), true);
    assert.equal(resources({ resources: { users: { hide: ['name'] } } }).get('users').columns.has('name'), false);
});

test('foreign keys give to-one, to-many and many-to-many relations', () => {
    const r = resources();
    const rel = (res, name) => { const x = r.get(res).relations.get(name); return x && `${x.kind}:${x.target.name}${x.through ? ':through' : ''}`; };
    assert.equal(rel('todos', 'owner'), 'one:users');
    assert.equal(rel('users', 'todos'), 'many:todos');
    assert.equal(rel('users', 'manager'), 'one:users');
    assert.equal(rel('users', 'users'), 'many:users');
    assert.equal(rel('todos', 'tags'), 'many:tags:through');
    assert.equal(rel('tags', 'todos'), 'many:todos:through');
});

test('relations can be renamed, removed and declared', () => {
    const r = resources({ resources: { users: { relations: { users: false, reports: { many: 'users', via: 'manager_id' } } } } });
    assert.equal(r.get('users').relations.has('users'), false);
    assert.equal(r.get('users').relations.get('reports').kind, 'many');
    assert.throws(() => resources({ resources: { users: { relations: { name: { one: 'users', via: 'manager_id' } } } } }), /name of a column/);
});

test('writes are off by default and never reach generated or key columns', () => {
    assert.equal(resources().get('todos').write.create, false);
    const a = resources({ resources: { todos: { write: true } } }).get('todos');
    assert.equal(a.columns.get('name').create, true);
    assert.equal(a.columns.get('created_at').create, false);
    assert.equal(a.columns.get('id').update, false);
    assert.equal(a.write.delete, true);
});

test('options naming unknown resources or columns fail at load', () => {
    assert.throws(() => resources({ resources: { nope: {} } }), /no exposed table/);
    assert.throws(() => resources({ resources: { users: { hide: ['nope'] } } }), /no column nope/);
});
