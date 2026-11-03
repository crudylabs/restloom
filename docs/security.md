# Security and hooks

restloom decides what can be asked. Your backend decides who may ask it, through hooks.

## What restloom enforces

- **Exposure:** only the schemas and tables you name are served, and only their visible columns.
- **Sensitive columns:** a column whose name looks like a secret is hidden without being asked, see below.
- **Bound values:** every value is a bound parameter, checked against its column's type before any SQL runs. Names come from the catalog and are quoted; nothing from a request is written into SQL.
- **Bounded requests:** every request is limited:

| Limit | Default | Option |
|---|---|---|
| Rows per page | 50, at most 1000 | `limits.page`, `limits.maxPage` |
| Relations walked by a path or an embed | 2 | `limits.depth` |
| Filters, every or/and term included | 50 | `limits.filters` |
| Items in one `in` list | 500 | `limits.inList` |
| Rows in one write body | 1000 | `limits.bodyRows` |
| Statement time | 5 s | `limits.timeoutMs` |

A request over a limit is refused, never quietly cut down.

- **Errors:** they answer stable codes. A database message never reaches the client. Unexpected errors answer `internal` and reach your `onError` hook.

## Sensitive columns

restloom reads every column name when it reads the catalog. A name made of a word such as `password`, `hash`, `salt`, `secret`, `token`, `api_key`, `private_key`, `otp`, `mfa` or `recovery`, alone or between underscores, marks the column as sensitive: `password_hash` and `reset_token` are hidden, `tokenizer` is not. The full list is in [Columns](./discovery.md#columns).

A hidden column is not served at all. It cannot be read, filtered, sorted or written, `select=*` leaves it out, and naming it answers as a column that does not exist, so a client cannot even learn it is there:

```http
GET /users?select=name,password_hash
```

Answer: 400

```json
{ "error": "unknown_column", "message": "password_hash" }
```

The check runs on names, so it guards against the column nobody thought about when the table grew. It does not know what a column holds: hide a sensitive column with a harmless name yourself, with `hide`.

To serve a column the check hides on purpose, name it in `show`. It then behaves as any other column, and is writable only if `write` lists it:

```ts
resources: {
    files: { show: ['sha256_hash'] },
    users: { hide: ['phone'] },
}
```

`sensitive` replaces the whole pattern, for every resource. Start from `DEFAULT_SENSITIVE` to add words rather than lose the defaults:

```ts
import { createREST, DEFAULT_SENSITIVE } from '@crudy/restloom-postgres';

createREST({
    db, // from a database package, see Dialects
    expose: { schemas: ['app'] },
    sensitive: new RegExp(`${DEFAULT_SENSITIVE.source}|(^|_)(iban|ssn)(_|$)`, 'i'),
});
```

## Hooks

```ts
import { createREST, RestError } from '@crudy/restloom-postgres';

createREST({
    db, // from a database package, see Dialects
    expose: { schemas: ['app'] },
    hooks: {
        authorize(request, target) { /* throw a RestError to refuse */ },
        async transaction(tx, context) { /* session settings, role */ },
        scope(resource, context) { return { tenant_id: context.tenantId }; },
        onError(error, request) { log.error(error); },
    },
});
```

| Hook | Runs | Use it to |
|---|---|---|
| `authorize(request, target)` | before any SQL, with `{ resource, action }` or `{ procedure, action: 'call' }` | refuse a request: `throw new RestError(403, 'forbidden')` |
| `transaction(tx, context)` | first, in every transaction | set the role and session settings row security reads |
| `scope(resource, context)` | for every resource a query touches, embeds and relation filters included | add equality filters, e.g. a tenant column, on databases without row security |
| `onError(error, request)` | for every answer of `internal` | log it |

`context` is what your adapter builds from the request, usually the authenticated user. restloom never reads it.

## Row security

Row security needs PostgreSQL, or SQL Server with security policies (see [Dialects](./dialects.md#sql-server)). With Postgres, it is the strongest perimeter: the database itself hides the rows a session may not see. Connect as a role without `BYPASSRLS`, and set what your policies read in the `transaction` hook:

```ts
async transaction(tx, context) {
    await tx.query("SELECT set_config('app.user_id', $1, true)", [context.userId]);
}
```

Every read and write of the request then runs under those policies, embeds and relation filters included.

## Scope

On a database without row security, `scope` keeps a request inside its perimeter. It returns column values a row must have, and restloom applies them:

- **Reads:** every query on the resource, and every relation reaching it, only matches rows with those values.
- **Inserts:** the scoped columns are filled in. A body giving another value is refused with `out_of_scope`.
- **Updates and deletes:** only rows with those values are reached. An update moving a row out of scope is refused.
