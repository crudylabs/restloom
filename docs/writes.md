# Writes and procedures

Writes are off until a resource enables them. The examples on this page run with these options, against the [demo schema](../conformance/fixtures/postgres.sql):

```ts
resources: {
    tags: { write: true },
    assets: { write: { create: ['name', 'status', 'owner_id', 'cost'], update: ['name', 'status', 'owner_id'], delete: false } },
    incidents: { write: { create: true, update: true, delete: true, bulk: true } },
},
procedures: {
    'assets/{asset}/retire': { function: 'demo.retire_asset' },
    'tags/{tag}/assets': { function: 'demo.assets_tagged' },
},
```

`write: true` allows create, update and delete of every visible column. A list allows only the columns named. Generated and identity columns are never writable, and neither is a key on update.

| Method | Path | Does | Answers |
|---|---|---|---|
| POST | `/tags` | creates one row, or an array of rows | 201 |
| PATCH | `/tags/4` | updates one row | 204, or 200 with the row |
| DELETE | `/tags/4` | deletes one row | 204, or 200 with the row |
| PATCH, DELETE | `/incidents?severity=lt.3` | by filter, only where `bulk: true` | 204, or 200 with the rows |

## Getting the rows back

Without a `Prefer` header a write answers with no body. `Prefer: return=representation` answers the written rows, read back with the request's `select`, so embeds work too.

```http
POST /tags?select=id,name
Prefer: return=representation

{ "id": 4, "name": "critical" }
```

Answer: 201

```json
[{ "id": 4, "name": "critical" }]
```

```http
POST /tags

[{ "id": 5, "name": "legacy" }, { "id": 6, "name": "edge" }]
```

Answer: 201

Every row of a body names the same columns, so one statement writes them all.

```http
POST /tags

[{ "id": 7, "name": "a" }, { "name": "b" }]
```

```json
{ "error": "mixed_columns" }
```

A column outside the resource's writable list is refused, whatever its value:

```http
POST /assets

{ "name": "new laptop", "status": "open", "active": false }
```

```json
{ "error": "not_writable", "message": "active" }
```

## Updating and deleting

PATCH and DELETE act on one row, by its key. A row that does not exist, or is not visible, answers 404.

```http
PATCH /assets/2?select=id,name,owner(name)
Prefer: return=representation

{ "owner_id": 1 }
```

Answer: 200

```json
{ "id": 2, "name": "mail relay", "owner": { "name": "Ada" } }
```

```http
DELETE /tags/4
```

Answer: 204

A row still referenced by another is not deleted:

```http
DELETE /tags/3
```

```json
{ "error": "still_referenced" }
```

```http
DELETE /assets/1
```

```json
{ "error": "method_not_allowed" }
```

A resource with `bulk: true` also takes PATCH and DELETE on the collection, with at least one filter. Without a filter they are refused, so no request can empty a table by accident.

```http
DELETE /incidents?severity=lt.3&select=id,title
Prefer: return=representation
```

Answer: 200

```json
[{ "id": 2, "title": "Spoofed mail" }]
```

```http
DELETE /incidents
```

```json
{ "error": "filter_required" }
```

## Values

Body values are checked against each column's type, as query values are: a number for a number column, `true` or `false` for a boolean, a string in ISO 8601 for a date or a time. The database's own constraints answer with stable codes:

```http
POST /tags

{ "id": 1, "name": "duplicate key" }
```

```json
{ "error": "duplicate" }
```

```http
POST /incidents

{ "id": 9, "title": "Lost badge", "asset_id": 99, "severity": 1, "opened_on": "2026-04-01" }
```

```json
{ "error": "reference_missing" }
```

## Procedures

A procedure calls a database function at a path you choose. A `{name}` in the path passes that segment as the argument of the same name; the body's keys pass the others. Arguments are checked by name and type, and one with a default may be left out.

A procedure is a POST unless declared `method: 'GET'`. A GET procedure takes its arguments from the query string (`/search?q=vpn&limit=10`), each once, and runs in a read-only transaction: use it for a function without side effects.

```http
POST /assets/3/retire

{ "reason": "end of life" }
```

```json
3
```

A function returning a set answers an array of its rows. Mail relay belongs to Ada since the update above.

```http
POST /tags/gdpr/assets
```

```json
[
  { "id": 2, "name": "mail relay", "status": "open", "owner_id": 1, "cost": 300, "active": true, "created_at": "2026-01-05T09:30:00+00:00" },
  { "id": 4, "name": "payroll db", "status": "open", "owner_id": 3, "cost": 4000, "active": true, "created_at": "2026-02-11T16:45:00+00:00" }
]
```

```http
POST /assets/3/retire

{ "why": "no reason" }
```

```json
{ "error": "unknown_argument", "message": "why" }
```
