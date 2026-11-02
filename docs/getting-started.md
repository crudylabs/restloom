# Getting started

## Install

Install the core, the package for your database, and its driver:

```sh
npm install @crudy/restloom @crudy/restloom-postgres pg
```

| Database | Package | Driver |
|---|---|---|
| PostgreSQL 13+ | `@crudy/restloom-postgres` | `pg` |

## Serve a schema

```ts
import http from 'node:http';
import pg from 'pg';
import { createREST, nodeListener } from '@crudy/restloom';
import { postgres } from '@crudy/restloom-postgres';

const rest = createREST({
    db: postgres(new pg.Pool({ connectionString: process.env.DATABASE_URL })),
    expose: { schemas: ['app'] },
});

http.createServer(nodeListener(rest, { prefix: '/api' })).listen(3000);
```

Every table and view of `app` is now a resource, read-only:

```sh
curl -g 'http://localhost:3000/api/assets?select=id,name,owner(name)&status=eq.open'
```

## Next

- [Discovery and overrides](./discovery.md): what becomes a resource, which columns are hidden, how relations are named.
- [Query grammar](./query-grammar.md): everything a GET can ask.
- [Writes and procedures](./writes.md): turning writes on, calling functions.
- [Security and hooks](./security.md): authorising requests, row security, scoping.
- [Adapters](./adapters.md): Fastify, Express, or any framework.
