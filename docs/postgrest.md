# Compared with PostgREST

restloom keeps what makes PostgREST pleasant, the catalog as the source and a query string anyone can type, and changes where control sits.

| | PostgREST | restloom |
|---|---|---|
| Runs as | a separate server | a library inside your backend |
| Databases | PostgreSQL | PostgreSQL, MySQL, SQL Server, SQLite |
| What is served | everything the role can reach in the schema | what you name in `expose`, minus hidden columns |
| Sensitive columns | served unless the role cannot read them | hidden by name unless shown |
| Writes | everything the role may write | off until a resource enables them, by column |
| Authorisation | database roles and row security | your hooks, plus row security where the database has it |
| Relations | inferred from foreign keys | inferred from foreign keys, overridable, removable |
| Filtering through a to-many relation | an embed with `!inner` | `tags.name=eq.pci`: at least one; `not.`: none |
| Ordering by a related column | on embedded resources | `order=owner.name`, `order=incidents.count` |
| A name that is a keyword | not addressable as a filter | quote it: `"limit"=eq.5` |
| Over-sized limit | capped | refused with `limit_exceeded` |
| Errors | database messages | stable codes, no database text |

The grammar is close enough that most PostgREST reads work unchanged: `select`, `eq`, `in`, `is`, `like`, `order`, `limit`, `offset`, `or`, embeds, and `Prefer: return=representation`.
