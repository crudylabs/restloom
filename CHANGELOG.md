# Changelog

All notable changes to the restloom packages are documented here. The packages are versioned together.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and the packages follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-11-03

### Added
- Every database package exports the whole core, so one install and one import are enough: `import { createREST, nodeListener, postgres } from '@crudy/restloom-postgres'`.
- `postgres`, `mysql` and `mssql` take a connection URL or the driver's pool options and open the pool themselves; a pool you already have still works.

### Changed
- `pg`, `mysql2` and `mssql` are dependencies of their packages again, installed with them. `better-sqlite3` stays an optional peer of the SQLite package, which also runs on sql.js in a browser.

### Fixed
- A `nodeListener` context that throws answers the request, with the `RestError` it threw or `500 internal`, instead of stopping the process.

## [0.4.0] - 2026-11-03

### Added
- A top-level `write` option turns writes on for every exposed table at once: `write: true`, or `{ create, update, delete, bulk }`. A resource's own `write` replaces it, and views stay read-only unless their resource allows writes.
- Every write example in the docs states its status, and the security page describes sensitive columns and how to serve one.

## [0.3.1] - 2026-11-03

### Changed
- Each dialect's driver (`pg`, `mysql2`, `mssql`, `better-sqlite3`) is an optional peer dependency: you pass the driver object in, so npm no longer installs one you did not choose. A dialect works with any object offering the driver's API, the SQLite one with sql.js in a browser for example.
- The docs use a to-do app as their example schema.

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
