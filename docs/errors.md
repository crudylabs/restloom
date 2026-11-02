# Errors

Every error is a JSON object with a stable code, and a message naming the part of the request at fault when there is one:

```json
{ "error": "unknown_column", "message": "password_hash" }
```

A message never contains SQL or database text.

## The request

| Code | Status | Means |
|---|---|---|
| `not_found` | 404 | no such resource, or no such row, or a row you may not see |
| `method_not_allowed` | 405 | the resource does not allow this method, or a procedure was not called with POST |
| `unknown_column` | 400 | the column does not exist or is hidden |
| `unknown_relation` | 400 | the relation does not exist |
| `unknown_operator` | 400 | the operator is not one of `eq neq gt gte lt lte in like ilike match imatch is ov cs cd` |
| `bad_operator` | 400 | the operator does not apply to the column's type |
| `invalid_value` | 400 | the value does not fit the column's type |
| `bad_filter` | 400 | a filter is not `operator.value` |
| `bad_logic` | 400 | an `or` or `and` is not `(term,term)` |
| `bad_list` | 400 | an `in` list is malformed, empty, or too long |
| `bad_name` | 400 | a dotted or quoted name is malformed |
| `bad_syntax` | 400 | unbalanced quotes or parentheses |
| `bad_select` | 400 | a select item is malformed |
| `duplicate_select` | 400 | a name is selected twice |
| `unknown_aggregate` | 400 | not one of `count sum avg min max` |
| `bad_aggregate` | 400 | the aggregate does not apply to the column's type |
| `aggregate_with_embed` | 400 | a grouped read cannot embed relations |
| `aggregate_in_embed` | 400 | an embed cannot hold aggregates |
| `bad_order` | 400 | an order term names a to-many column, an unorderable type, or, in a grouped read, an unselected column |
| `not_embedded` | 400 | `relation.order`, `.limit` or `.offset` names a relation that is not embedded |
| `too_deep` | 400 | a path or an embed walks more relations than `limits.depth` |
| `too_many_filters` | 400 | more filters than `limits.filters` |
| `bad_limit`, `bad_offset` | 400 | not a whole number |
| `limit_exceeded` | 400 | a limit over `limits.maxPage` |
| `bad_count` | 400 | `count` is not `exact` or `estimated` |
| `unsupported` | 400 | the database cannot do what was asked, e.g. a regular expression on SQLite |

## Writes and procedures

| Code | Status | Means |
|---|---|---|
| `bad_body` | 400 | the body is not an object or a list of objects within `limits.bodyRows` |
| `body_too_large` | 413 | the body is over the adapter's size limit |
| `mixed_columns` | 400 | the rows of a body name different columns |
| `not_writable` | 400 | the column cannot be written by this method |
| `filter_required` | 400 | a bulk update or delete has no filter |
| `out_of_scope` | 403 | a value contradicts the host's scope |
| `unknown_argument` | 400 | the procedure's function takes no argument of that name |
| `missing_argument` | 400 | an argument without a default is missing |
| `bad_argument` | 400 | a GET procedure's argument is given twice |

## The database

| Code | Status | Means |
|---|---|---|
| `duplicate` | 409 | a unique constraint refused the row |
| `reference_missing` | 409 | a foreign key points to a row that does not exist |
| `still_referenced` | 409 | the row is still referenced by another |
| `value_required` | 400 | a required column has no value |
| `value_rejected` | 400 | a check constraint refused the value |
| `forbidden` | 403 | the database refused the session's role |
| `timeout` | 503 | the statement ran past `limits.timeoutMs` |
| `internal` | 500 | anything else; your `onError` hook receives it |
