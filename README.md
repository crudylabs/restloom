<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/brand/logo-dark.svg">
    <img alt="restloom" src=".github/brand/logo-light.svg" height="110">
  </picture>
</h1>

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
npm install @crudy/restloom @crudy/restloom-postgres pg
```

## Use

```ts
import http from 'node:http';
import pg from 'pg';
import { createREST, nodeListener } from '@crudy/restloom';
import { postgres } from '@crudy/restloom-postgres';

const rest = createREST({
    db: postgres(new pg.Pool()),
    expose: { schemas: ['app'] },
    resources: { todos: { write: true } },
});

http.createServer(nodeListener(rest)).listen(3000);
```

## Documentation

1. [Getting started](docs/getting-started.md)
2. [Discovery and overrides](docs/discovery.md): what becomes a resource, hidden columns, relation names.
3. [Query grammar](docs/query-grammar.md): select, filters, relations, order, pages, counts, aggregates.
4. [Writes and procedures](docs/writes.md)
5. [Security and hooks](docs/security.md)
6. [Adapters](docs/adapters.md): Node, Fastify, Express, your own routes.
7. [Dialects](docs/dialects.md) and [writing a dialect](docs/writing-a-dialect.md)
8. [Errors](docs/errors.md)
9. [Compared with PostgREST](docs/postgrest.md)

The examples in the grammar and writes pages are the conformance suite: each one runs against every database and must answer exactly what the page shows.

## Licence

Apache-2.0.
