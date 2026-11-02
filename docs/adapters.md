# Adapters

The core answers a plain request object, so it fits any framework:

```ts
const response = await rest.handle({ method, path, query, headers, body, context });
// { status, headers, body }
```

`handle` never throws: every failure is a response. `path` is the path below where the API is mounted (`/assets/4`), `query` a `URLSearchParams`, `body` the parsed JSON.

## Node

`nodeListener` from the core serves `node:http` with no other dependency. It reads JSON bodies up to 1 MiB (`maxBodyBytes`).

```ts
http.createServer(nodeListener(rest, { prefix: '/api', context: (req) => userFrom(req) })).listen(3000);
```

## Fastify

```sh
npm install @crudy/restloom-fastify
```

```ts
import { restloom } from '@crudy/restloom-fastify';

await app.register(restloom(rest, { context: (req) => req.user }), { prefix: '/api' });
```

Fastify's own hooks, rate limits and logging run as for any route.

## Express

```sh
npm install @crudy/restloom-express
```

```ts
import { restloom } from '@crudy/restloom-express';

app.use('/api', express.json(), restloom(rest, { context: (req) => req.user }));
```

## Your own routes

A host that registers every route itself, to attach its own permissions or documentation to each, calls `rest.handle` from those routes. That is how crudy mounts restloom: each declared route checks its permission, then hands the request to restloom.
