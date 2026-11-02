# restloom

A REST API generated from your database's catalog. Name the schemas or tables to serve, and restloom reads their columns, types, keys and relations, and answers queries like this one:

```
GET /assets?select=id,name,owner(name),tags(name)&tags.name=in.(pci,gdpr)&order=owner.name.desc
```

```json
[
  { "id": 4, "name": "payroll db", "owner": { "name": "Linus" }, "tags": [{ "name": "pci" }, { "name": "gdpr" }] },
  { "id": 2, "name": "mail relay", "owner": { "name": "Grace" }, "tags": [{ "name": "gdpr" }] }
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
    resources: { assets: { write: true } },
});

http.createServer(nodeListener(rest)).listen(3000);
```

## Documentation

- [Query grammar](docs/query-grammar.md): select, filters, relations, order, pages, counts, aggregates.

## Licence

Apache-2.0.
