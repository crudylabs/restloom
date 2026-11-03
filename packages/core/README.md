# restloom

A REST API generated from your database's catalog. Name the schemas or tables to serve, and restloom reads their columns, types, keys and relations, and answers queries like this one:

```
GET /todos?select=id,name,owner(name),tags(name)&tags.name=in.(work,home)&order=owner.name.desc
```

```json
[
  { "id": 4, "name": "pay rent", "owner": { "name": "Linus" }, "tags": [{ "name": "work" }, { "name": "home" }] },
  { "id": 2, "name": "file taxes", "owner": { "name": "Grace" }, "tags": [{ "name": "home" }] }
]
```

Your backend stays in charge:
- **Only what you name is served.** Nothing is exposed until a schema or table is named.
- **Writes are opt-in.** They are off until a resource enables them.
- **Sensitive columns stay hidden.** Columns named like passwords, hashes, tokens or keys are never served unless you show them on purpose.
- **Clients cannot run arbitrary queries.** They choose among what you expose: there is no query language for them to run arbitrary joins with.

## Install

| Package | For |
|---|---|
| `@crudy/restloom` | The core: grammar, discovery, `createREST`, a Node `http` listener |
| `@crudy/restloom-postgres` | PostgreSQL |
| `@crudy/restloom-mysql` | MySQL |
| `@crudy/restloom-mssql` | SQL Server |
| `@crudy/restloom-sqlite` | SQLite |
| `@crudy/restloom-fastify` | Fastify plugin |
| `@crudy/restloom-express` | Express handler |

```sh
npm install @crudy/restloom-postgres
```

A database package brings the core and its driver, and exports the whole core.

## Use

```ts
import http from 'node:http';
import { createREST, nodeListener, postgres } from '@crudy/restloom-postgres';

const rest = createREST({
    db: postgres(process.env.DATABASE_URL),
    expose: { schemas: ['app'] },
    resources: { todos: { write: true } },
});

http.createServer(nodeListener(rest)).listen(3000);
```

## Documentation

1. [Getting started](https://github.com/crudylabs/restloom/blob/master/docs/getting-started.md)
2. [Discovery and overrides](https://github.com/crudylabs/restloom/blob/master/docs/discovery.md): what becomes a resource, hidden columns, relation names.
3. [Query grammar](https://github.com/crudylabs/restloom/blob/master/docs/query-grammar.md): select, filters, relations, order, pages, counts, aggregates.
4. [Writes and procedures](https://github.com/crudylabs/restloom/blob/master/docs/writes.md)
5. [Security and hooks](https://github.com/crudylabs/restloom/blob/master/docs/security.md)
6. [Adapters](https://github.com/crudylabs/restloom/blob/master/docs/adapters.md): Node, Fastify, Express, your own routes.
7. [Dialects](https://github.com/crudylabs/restloom/blob/master/docs/dialects.md) and [writing a dialect](https://github.com/crudylabs/restloom/blob/master/docs/writing-a-dialect.md)
8. [Errors](https://github.com/crudylabs/restloom/blob/master/docs/errors.md)
9. [Compared with PostgREST](https://github.com/crudylabs/restloom/blob/master/docs/postgrest.md)

The examples in the grammar and writes pages are the conformance suite: each one runs against every database and must answer exactly what the page shows.

## Licence

Apache-2.0.
