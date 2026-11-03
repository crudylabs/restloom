# Getting started

## Install

Install the package for your database. It brings the core and the database driver with it, except for SQLite, which also needs `better-sqlite3`:

```sh
npm install @crudy/restloom-postgres
```

| Database | Package |
|---|---|
| PostgreSQL 13+ | `@crudy/restloom-postgres` |
| MySQL 8.0+ | `@crudy/restloom-mysql` |
| SQL Server 2022+ | `@crudy/restloom-mssql` |
| SQLite 3.44+ | `@crudy/restloom-sqlite` |

Each of them exports the whole core, so everything is imported from that one package. The examples in these pages use `@crudy/restloom-postgres`; with another database, import from its package instead.

## Serve a schema

```ts
import http from 'node:http';
import { createREST, nodeListener, postgres } from '@crudy/restloom-postgres';

const rest = createREST({
    db: postgres(process.env.DATABASE_URL),
    expose: { schemas: ['app'] },
});

http.createServer(nodeListener(rest, { prefix: '/api' })).listen(3000);
```

`nodeListener` comes with the core, so no framework is needed. Every table and view of `app` is now a resource, read-only:

```sh
curl -g 'http://localhost:3000/api/todos?select=id,name,owner(name)&status=eq.open'
```

Add `write: true` beside `expose` to create, update and delete rows in every table too. Do it once your `authorize` hook decides who may write: [Writes](./writes.md#writes-on-every-table).

## Next

- [Discovery and overrides](./discovery.md): what becomes a resource, which columns are hidden, how relations are named.
- [Query grammar](./query-grammar.md): everything a GET can ask.
- [Writes and procedures](./writes.md): turning writes on, calling functions.
- [Security and hooks](./security.md): authorising requests, row security, scoping.
- [Adapters](./adapters.md): Fastify, Express, or any framework.
