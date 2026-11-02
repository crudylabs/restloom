# Changelog

All notable changes to the restloom packages are documented here. The packages are versioned together.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and the packages follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-11-02

### Added
- `match` and `imatch` regular expression filters, on Postgres and MySQL; SQLite and SQL Server answer `unsupported`.
- `ov`, `cs` and `cd` filters on Postgres array columns.
- GET procedures (`method: 'GET'`): arguments from the query string, run read-only.

## [0.2.0] - 2026-11-02

### Added
- `Prefer: count=exact` (or `estimated`) counts a list, as the `count` parameter does.
- A declared procedure's function is read wherever it lives, not only in an exposed schema.

### Changed
- `Dialect.introspect` takes the declared functions as `functions`.

## [0.1.0] - 2026-11-02

### Added
- `@crudy/restloom`: discovery from the catalog, relations from foreign keys and junction tables, the read grammar, the overridable SQL renderer, `createREST` and a Node `http` listener.
- Writes: create, update and delete by key, bulk by filter where enabled, scope applied, rows read back with `Prefer: return=representation`.
- Procedures: database functions at declared paths, arguments checked by name and type.
- `@crudy/restloom-postgres`: the Postgres dialect.
- `@crudy/restloom-mysql`, `@crudy/restloom-mssql` and `@crudy/restloom-sqlite`: MySQL 8, SQL Server 2022 and SQLite dialects, each passing the conformance suite.
- `@crudy/restloom-fastify` and `@crudy/restloom-express`: framework adapters.
