# Query grammar

A read is a GET with a query string. Every example on this page runs against the [demo schema](../conformance/fixtures/postgres.sql) in the test suite, against every database, so the answers shown are the answers you get.

The demo schema has four resources:

| Resource | Columns | Relations |
|---|---|---|
| `users` | id, name, email, limit, manager_id | `manager` (one user), `users` (the users they manage), `todos` |
| `todos` | id, name, status, owner_id, estimate, pinned, created_at | `owner` (one user), `tags` (many, through `todo_tags`), `steps` (many) |
| `tags` | id, name | `todos` (many, through `todo_tags`) |
| `steps` | id, title, todo_id, priority, due_on | `todo` (one todo) |

`users.password_hash` exists in the table but is never served: its name looks sensitive, so it is hidden.

Examples are shown unencoded. A client encodes them like any query string: `curl -g` sends them as written.

## Choosing columns: `select`

Without `select`, a row has every visible column. With it, only the listed ones, in that order.

```http
GET /todos?select=id,name&status=eq.open&order=id
```

```json
[{ "id": 1, "name": "water plants" }, { "id": 2, "name": "file taxes" }, { "id": 4, "name": "pay rent" }]
```

One row is read by its key. It answers 404 when the row does not exist or is not visible.

```http
GET /todos/1?select=id,name,owner(name)
```

```json
{ "id": 1, "name": "water plants", "owner": { "name": "Ada" } }
```

## Related rows: embedding

`relation(columns)` puts related rows inside each row: an object (or `null`) for a to-one relation, an array for a to-many one. `relation(*)` takes every visible column. Embeds nest up to the depth limit (2 by default).

```http
GET /todos?status=eq.open&select=id,owner(name,manager(name))
```

```json
[
  { "id": 1, "owner": { "name": "Ada", "manager": null } },
  { "id": 2, "owner": { "name": "Grace", "manager": { "name": "Ada" } } },
  { "id": 4, "owner": { "name": "Linus", "manager": { "name": "Ada" } } }
]
```

A relation of a table to itself works the same way. Here `users` is the list of people each user manages; rename it with a [relation override](./discovery.md#relations) if `reports` reads better.

```http
GET /users?select=id,name,manager(name),users(name)
```

```json
[
  { "id": 1, "name": "Ada", "manager": null, "users": [{ "name": "Grace" }, { "name": "Linus" }] },
  { "id": 2, "name": "Grace", "manager": { "name": "Ada" }, "users": [] },
  { "id": 3, "name": "Linus", "manager": { "name": "Ada" }, "users": [] }
]
```

An embedded array is ordered by the related key, unless `relation.order` says otherwise. `relation.limit` and `relation.offset` page it. Without a limit it holds at most `maxPage` rows (1000).

```http
GET /todos?select=id,steps(title)&steps.order=priority.desc&steps.limit=1&order=steps.count.desc
```

```json
[
  { "id": 1, "steps": [{ "title": "Buy a watering can" }] },
  { "id": 2, "steps": [{ "title": "Find the receipts" }] },
  { "id": 3, "steps": [] },
  { "id": 4, "steps": [] }
]
```

## Filtering

A filter is `column=operator.value`. Every filter must hold.

| Operator | Means | Applies to |
|---|---|---|
| `eq`, `neq` | equal, not equal | any comparable column |
| `gt`, `gte`, `lt`, `lte` | greater or less than | text, numbers, dates and times |
| `in.(a,b,c)` | one of the list; quote an item holding a comma: `in.("a,b",c)` | any comparable column |
| `like`, `ilike` | pattern, `*` for any text; `ilike` ignores case | text |
| `match`, `imatch` | regular expression; `imatch` ignores case | text, where the database has them (Postgres, MySQL) |
| `ov.{a,b}`, `cs.{a,b}`, `cd.{a,b}` | the array overlaps, contains, or is contained by the list | array columns (Postgres) |
| `is.null`, `is.true`, `is.false` | null, or a boolean value | `null` any column, `true` and `false` booleans |

`not.` before the operator negates it: `status=not.in.(done,cancelled)`.

A value is checked against the column's type before any SQL runs: `id=eq.abc` answers `invalid_value`. An operator that does not fit the column is refused:

```http
GET /todos?estimate=like.1*
```

```json
{ "error": "bad_operator", "message": "like on estimate" }
```

### Through relations

A filter can name a column of a related resource: `relation.column=operator.value`.

- **To-one** (`owner.name`): the related row must match.
- **To-many** and **many-to-many** (`tags.name`): at least one related row must match.
- **With `not.`** on a relation path: no related row may match.

```http
GET /todos?select=id,name&owner.name=ilike.*a*
```

```json
[{ "id": 1, "name": "water plants" }, { "id": 2, "name": "file taxes" }]
```

```http
GET /todos?select=id,name,owner(name),tags(name)&tags.name=in.(work,home)&order=owner.name.desc
```

```json
[
  { "id": 4, "name": "pay rent", "owner": { "name": "Linus" }, "tags": [{ "name": "work" }, { "name": "home" }] },
  { "id": 2, "name": "file taxes", "owner": { "name": "Grace" }, "tags": [{ "name": "home" }] },
  { "id": 1, "name": "water plants", "owner": { "name": "Ada" }, "tags": [{ "name": "work" }, { "name": "urgent" }] }
]
```

Todos with no `work` tag, including todos with no tag at all:

```http
GET /todos?select=id&tags.name=not.eq.work
```

```json
[{ "id": 2 }, { "id": 3 }]
```

`relation=is.empty` keeps rows with no related row, `relation=not.is.empty` rows with at least one. `is.null` means the same.

```http
GET /todos?select=id&tags=is.empty
```

```json
[{ "id": 3 }]
```

### Either-or: `or` and `and`

`or=(term,term)` holds when one term does. A term is `path.operator.value`, with the same operators and relation paths. `and=(...)` groups terms inside an `or`, one level deep. `not.or` and `not.and` negate the group.

```http
GET /todos?select=id&or=(status.eq.done,owner.name.eq.Linus)
```

```json
[{ "id": 3 }, { "id": 4 }]
```

## Ordering: `order`

`order=column.direction,...` with `asc` (default) or `desc`, and optionally `nullsfirst` or `nullslast`.

- **To-one paths:** sort by a related column: `order=owner.name.desc`.
- **To-many relations:** sort by how many related rows each row has: `order=steps.count.desc`. A to-many relation cannot be sorted by one of its columns, because a row has many values.
- **Stable pages:** the key is appended to every order.
- **Nulls:** they sort last ascending and first descending, as in Postgres, on every database.

```http
GET /todos?select=id,estimate&order=estimate.desc
```

```json
[{ "id": 3, "estimate": null }, { "id": 4, "estimate": 4 }, { "id": 1, "estimate": 2.5 }, { "id": 2, "estimate": 1 }]
```

## Pages and counts

`limit` (default 50) and `offset` page a read. A limit over 1000 is refused, never silently reduced:

```http
GET /todos?limit=1001
```

```json
{ "error": "limit_exceeded", "message": "1001" }
```

Every list answers a `Content-Range` header: `0-49/*`, or `*/0` for an empty page. `count=exact` replaces `*` with the total, and `count=estimated` with the planner's estimate where the database has one.

```http
GET /todos?select=id&limit=2&offset=1&count=exact
```

```json
[{ "id": 2 }, { "id": 3 }]
```

The answer above comes with `Content-Range: 1-2/4`.

## Totals: aggregates

`count()`, and `column.sum()`, `.avg()`, `.min()`, `.max()`, group by every plain column selected. `sum` and `avg` take numbers; `min` and `max` anything orderable. An aggregate read cannot embed relations, and orders by its selected columns only.

```http
GET /todos?select=status,count(),estimate.sum()&order=status
```

```json
[{ "status": "done", "count": 1, "sum": null }, { "status": "open", "count": 3, "sum": 7.5 }]
```

## Names that are keywords

`select`, `order`, `limit`, `offset`, `count`, `or` and `and` are reserved, and so are `order`, `limit` and `offset` after a relation name. A double-quoted name is always a column, never a keyword, wherever it appears: `"limit"=gte.2`, `select="order"`, `order="limit".desc`, `tags."order"=eq.x`.

```http
GET /users?select=id,"limit"&"limit"=gte.2
```

```json
[{ "id": 1, "limit": 5 }, { "id": 3, "limit": 2 }]
```

## What is never served

A column that is hidden answers exactly as a column that does not exist, so a client cannot learn it is there:

```http
GET /users?select=password_hash
```

```json
{ "error": "unknown_column", "message": "password_hash" }
```

Every error code is listed in [errors](./errors.md).
