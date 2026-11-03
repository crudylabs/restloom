# Dialects

A dialect is the package that knows one database: how to read its catalog, how to write its SQL, how to run a transaction and what its errors mean.

| Package | Database | Embeds | Written keys | Estimated count | Row security | Procedures |
|---|---|---|---|---|---|---|
| `@crudy/restloom-postgres` | PostgreSQL 13+ | `json_build_object`, `json_agg` | `RETURNING` | planner estimate | yes | functions, scalar or set |
| `@crudy/restloom-mysql` | MySQL 8.0+ | `JSON_OBJECT`, `GROUP_CONCAT` | locked and read before writing | no | no | scalar functions |
| `@crudy/restloom-mssql` | SQL Server 2022+ | `JSON_OBJECT`, `STRING_AGG` | `OUTPUT` | no | security policies | scalar and table functions |
| `@crudy/restloom-sqlite` | SQLite 3.44+ (better-sqlite3) | `json_object`, `json_group_array` | `RETURNING` | no | no | none |

Every dialect passes the same conformance suite, so a request answers the same rows on each. Regular expressions (`match`, `imatch`) need Postgres or MySQL, and array filters (`ov`, `cs`, `cd`) Postgres array columns; elsewhere they answer `unsupported`. Where else the dialects differ, the sections below say how.

## Postgres

```ts
import pg from 'pg';
import { postgres } from '@crudy/restloom-postgres';

const db = postgres(new pg.Pool({ connectionString: process.env.DATABASE_URL }));
```

- **Transactions:** every request is one transaction, `READ ONLY` for reads, with `SET LOCAL statement_timeout` from `limits.timeoutMs`.
- **Types:** enums read as text. A domain reads as its base type.
- **Timestamps:** they are written in the session's time zone, as Postgres writes them in JSON.
- **Procedures:** calls use named arguments, so the order in the body does not matter.

## MySQL

```ts
import { createPool } from 'mysql2/promise';
import { mysql } from '@crudy/restloom-mysql';

const db = mysql(createPool({ uri: process.env.DATABASE_URL }));
```

- **Schemas:** MySQL's schemas are its databases: `expose: { schemas: ['shop'] }`.
- **Session:** every request runs in UTC. `MAX_EXECUTION_TIME` applies the timeout, which MySQL enforces on reads only.
- **Writes without RETURNING:** an update or delete first locks and reads the keys it will reach, then writes by key. An insert takes its keys from the body, or from `AUTO_INCREMENT` for a single-column key.
- **Text comparison:** text compares with each column's collation, so with a case-insensitive collation `eq` ignores case. `like` is always case-sensitive and `ilike` never is.
- **Timestamps:** written as ISO 8601. A `TIMESTAMP` carries `+00:00`; a `DATETIME`, which has no zone, carries none.
- **Procedures:** stored functions take every argument, in any order in the body; MySQL has none returning a set.

## SQL Server

```ts
import sql from 'mssql';
import { mssql } from '@crudy/restloom-mssql';

const db = mssql(await new sql.ConnectionPool(process.env.DATABASE_URL).connect());
```

- **Version:** SQL Server 2022 or later, for `JSON_OBJECT`.
- **Timeout:** the statement timeout is the pool's `requestTimeout`, since the driver sets it per pool, not per request.
- **Text comparison:** as for MySQL, it follows the column's collation. `like` is case-sensitive, `ilike` is not.
- **Timestamps:** written to the second. A `datetimeoffset` is written in UTC with `+00:00`.
- **Row security:** security policies read `SESSION_CONTEXT`; set it in the `transaction` hook with `sp_set_session_context`.
- **Procedures:** scalar and table-valued functions; T-SQL does not expose parameter defaults, so every argument is required. A T-SQL function cannot change data.

## SQLite

```ts
import Database from 'better-sqlite3';
import { sqlite } from '@crudy/restloom-sqlite';

const db = sqlite(new Database('app.db'));
```

- **Schemas:** the main database is `main`, and an attached database is a schema by its name.
- **Connection settings:** foreign keys and case-sensitive `LIKE` are turned on for the connection.
- **One connection:** requests run one transaction at a time, queued.
- **Limits of SQLite:** it cannot stop a running statement, so `limits.timeoutMs` does not apply. It has no functions to call as procedures.
- **Booleans:** stored as 0 and 1, answered as `true` and `false`.

## Changing how SQL is written

Every piece of SQL comes from one overridable method of the dialect's renderer. To change one, subclass it and pass it in:

```ts
import pg from 'pg';
import { PostgresRenderer, postgres } from '@crudy/restloom-postgres';

class Renderer extends PostgresRenderer {
    like(expr: string, pattern: string, insensitive: boolean) {
        return insensitive ? `unaccent(${expr}) ILIKE unaccent(${pattern})` : super.like(expr, pattern, false);
    }
}

const db = postgres(new pg.Pool({ connectionString: process.env.DATABASE_URL }), { renderer: new Renderer() });
```

The pieces are listed in [writing a dialect](./writing-a-dialect.md).
