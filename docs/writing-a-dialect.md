# Writing a dialect

A dialect implements one interface:

```ts
interface Dialect {
    name: string;
    capabilities: { returning: boolean; estimatedCount: boolean; rowSecurity: boolean };
    renderer: SqlRenderer;
    introspect(scope: { schemas: string[]; tables: string[] }): Promise<Catalog>;
    transaction<T>(fn: (tx: Tx) => Promise<T>, options: { timeoutMs: number; readOnly: boolean }): Promise<T>;
    mapError(err: unknown): RestError | null;
    estimate?(tx: Tx, sql: string, params: unknown[]): Promise<number | null>;
}
```

| Member | Does |
|---|---|
| `introspect` | reads tables, views, columns, primary keys, foreign keys and functions, and maps each type to a logical one: `text`, `integer`, `number`, `boolean`, `uuid`, `date`, `timestamp`, `time`, `json`, `binary`, `array` or `other` |
| `transaction` | runs a request's statements in one transaction with a statement timeout |
| `mapError` | turns an error the client caused into a stable code; anything else returns `null` and answers `internal` |
| `renderer` | writes the SQL |

The core decides everything else from the logical types: which operators a column accepts, which values are valid, which columns can be summed.

## The renderer

`SqlRenderer` writes Postgres SQL. A dialect subclasses it and overrides what its database writes differently. Statements are built only from these pieces, so an override reaches every statement that uses it:

| Method | Postgres writes |
|---|---|
| `quote(name)` | `"name"` |
| `placeholder(n)` | `$n` |
| `jsonObject(pairs)` | `json_build_object('a', x, ...)` |
| `jsonArray(row, order)` | `COALESCE(json_agg(row ORDER BY order), '[]'::json)` |
| `jsonValue(expr, column)` | the column, unchanged |
| `nested(expr)` | a nested JSON subquery, unchanged |
| `like(expr, pattern, insensitive)` | `LIKE` or `ILIKE ... ESCAPE '\'` |
| `isBoolean(expr, value)` | `IS TRUE`, `IS FALSE` |
| `orderBy(expr, desc, nulls)` | `ASC`/`DESC NULLS FIRST`/`LAST` |
| `page(limit, offset)` | `LIMIT n OFFSET m` |
| `first(select)` | `... LIMIT 1` |
| `rowNumber(order)` | `ROW_NUMBER() OVER (ORDER BY ...)` |
| `returning(resource)` | `RETURNING key` |
| `writeTarget(resource, alias)` | `table AS alias` |
| `call(fn, args)` | `SELECT to_json(fn(arg => $1))` |

Larger units can be overridden too: `relationSource`, `exists`, `filter`, `embed`, `read`, `count`, `insert`, `update`, `delete`.

Placeholders are written last: fragments carry internal tokens, and the final text gets the database's own placeholders in text order. A dialect with positional placeholders (`?`) gets its values in the right order whatever order the fragments were built in.

## Proving it

A dialect passes when the conformance suite does. Add a fixture with the demo schema and data in `conformance/fixtures/<dialect>.sql`, and a runner next to `postgres.test.mjs`. Every example of the docs pages then runs against your database and must answer exactly what the page shows.
