# Discovery and overrides

restloom reads the database's catalog once, on the first request, and builds the API from it. `rest.reload()` reads it again on the next request, after a migration for example.

## What becomes a resource

`expose` names what is served. Nothing else is.

```ts
expose: { schemas: ['app'] }                       // every table and view of app
expose: { tables: ['app.todos', 'app.users'] }    // only these
```

A resource is named after its table. When two exposed schemas hold a table of the same name, both are named `schema_table`. `resources.<name>.expose: false` removes one, for example a junction table you only want used as a relation:

```ts
resources: { todo_tags: { expose: false } }
```

A resource's key is its primary key. A view has none, so it uses a column named `id` when it has one, or the columns you give it: `resources: { todo_rows: { key: ['todo_id'] } }`. A resource without a key can still be listed, but has no `/{id}` path and no stable page order.

## Columns

Every column is visible except:

- **Sensitive names:** columns whose name contains one of these words: `password`, `passwd`, `pwd`, `hash`, `hashed`, `salt`, `secret`, `token`, `api_key`, `private_key`, `otp`, `totp`, `mfa`, `recovery`. A word is a whole part of the name between underscores: `password_hash` and `reset_token` are hidden, `tokenizer` is not.
- **Columns you hide:** `resources: { users: { hide: ['phone'] } }`.

`show` makes a sensitive-looking column visible on purpose: `resources: { files: { show: ['sha256_hash'] } }`. `sensitive` replaces the whole list with your own pattern.

A hidden column cannot be read, filtered, sorted or written, and naming it answers exactly as naming a column that does not exist. It can still join a relation.

## Relations

Relations come from foreign keys between exposed resources:

| In the catalog | Gives |
|---|---|
| `todos.owner_id` references `users.id` | `todos.owner`, to-one; `users.todos`, to-many |
| `todo_tags` has a primary key made of a key to `todos` and a key to `tags` | `todos.tags` and `tags.todos`, many-to-many |

Names:

- **To-one:** the foreign key column without `_id` (`owner_id` gives `owner`). Otherwise the target table's name.
- **To-many:** the source table's name.
- **Collisions:** when a name is taken by a column or another relation, the next candidate is used. For to-one, that is the target table's name, then `<column>_<table>`. For to-many, it is `<table>_by_<column>`, and for many-to-many `<table>_via_<junction>`.

A relation to a table that is not exposed does not exist. A foreign key to a hidden table exposes nothing.

`relations` overrides, adds or removes them:

```ts
resources: {
    users: {
        relations: {
            users: false,                                    // remove the discovered one
            reports: { many: 'users', via: 'manager_id' },   // to-many: users whose manager_id is my key
            team: { one: 'teams', via: 'team_id' },          // to-one, e.g. for a view without foreign keys
            badges: { many: 'badges', through: 'user_badges' },
        },
    },
}
```

An override with the name of a column is refused when the catalog is read, and so is any option naming a resource, column or table that does not exist. Call `await rest.resources()` at start so a typo stops your server from booting instead of failing its first request.
