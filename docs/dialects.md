# Dialects

A dialect is the package that knows one database: how to read its catalog, how to write its SQL, how to run a transaction and what its errors mean.

| Package | Database | Embeds | Writes return rows | Estimated count | Row security |
|---|---|---|---|---|---|
| `@crudy/restloom-postgres` | PostgreSQL 13+ | `json_build_object`, `json_agg` | `RETURNING` | planner estimate | yes |

## Postgres

```ts
import { postgres } from '@crudy/restloom-postgres';

const db = postgres(pool);
```

- **Transactions:** every request is one transaction, `READ ONLY` for reads, with `SET LOCAL statement_timeout` from `limits.timeoutMs`.
- **Types:** enums read as text. A domain reads as its base type.
- **Timestamps:** they are written in the session's time zone, as Postgres writes them in JSON.
- **Procedures:** calls use named arguments, so the order in the body does not matter.

## Changing how SQL is written

Every piece of SQL comes from one overridable method of the dialect's renderer. To change one, subclass it and pass it in:

```ts
import { PostgresRenderer, postgres } from '@crudy/restloom-postgres';

class Renderer extends PostgresRenderer {
    like(expr: string, pattern: string, insensitive: boolean) {
        return insensitive ? `unaccent(${expr}) ILIKE unaccent(${pattern})` : super.like(expr, pattern, false);
    }
}

const db = postgres(pool, { renderer: new Renderer() });
```

The pieces are listed in [writing a dialect](./writing-a-dialect.md).
