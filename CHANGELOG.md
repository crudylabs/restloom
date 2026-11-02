# Changelog

All notable changes to the restloom packages are documented here. The packages are versioned together.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and the packages follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `@crudy/restloom`: discovery from the catalog, relations from foreign keys and junction tables, the read grammar, the overridable SQL renderer, `createREST` and a Node `http` listener.
- Writes: create, update and delete by key, bulk by filter where enabled, scope applied, rows read back with `Prefer: return=representation`.
- Procedures: database functions at declared paths, arguments checked by name and type.
- `@crudy/restloom-postgres`: the Postgres dialect.
- `@crudy/restloom-fastify` and `@crudy/restloom-express`: framework adapters.
