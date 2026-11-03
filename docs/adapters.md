# Adapters

The core answers a plain request object, so it fits any framework:

```ts
import { createREST, postgres } from '@crudy/restloom-postgres';

const rest = createREST({
    db: postgres(process.env.DATABASE_URL),
    expose: { schemas: ['app'] },
});

const response = await rest.handle({ method, path, query, headers, body, context });
// { status, headers, body }
```

The examples below use this `rest`.

`handle` never throws: every failure is a response. `path` is the path below where the API is mounted (`/todos/4`), `query` a `URLSearchParams`, `body` the parsed JSON.

## Node, without a framework

`nodeListener` from the core serves `node:http` with nothing else installed. It mounts the API under `prefix` and answers `404 not_found` outside it, reads JSON bodies up to 1 MiB (`maxBodyBytes`), and builds each request's context with `context`. A `context` that throws a `RestError` refuses the request with it; any other error answers `500 internal`:

```ts
import http from 'node:http';
import { nodeListener } from '@crudy/restloom-postgres';

const api = nodeListener(rest, { prefix: '/api', context: (req) => userFrom(req) });
http.createServer(api).listen(3000);
```

To serve other pages from the same server, hand only the API's paths to it:

```ts
import http from 'node:http';

http.createServer((req, res) => (req.url?.startsWith('/api/') ? api(req, res) : site(req, res))).listen(3000);
```

Without HTTP at all, call `rest.handle` directly: [From your own code](#from-your-own-code).

## Fastify

```sh
npm install @crudy/restloom-fastify
```

```ts
import Fastify from 'fastify';
import { restloom } from '@crudy/restloom-fastify';

const app = Fastify();
await app.register(restloom(rest, { context: (req) => req.user }), { prefix: '/api' });
```

Fastify's own hooks, rate limits and logging run as for any route.

## Express

```sh
npm install @crudy/restloom-express
```

```ts
import express from 'express';
import { restloom } from '@crudy/restloom-express';

const app = express();
app.use('/api', express.json(), restloom(rest, { context: (req) => req.user }));
```

## From your own code

Your backend never needs to call its own API over HTTP. `rest.handle` runs a request in the same process, through the same checks, hooks and row security as a client's, and gives the answer back as data:

```ts
const { status, body: todos } = await rest.handle({
    method: 'GET',
    path: '/todos',
    query: new URLSearchParams('select=id,name,owner(name)&status=eq.open'),
    headers: {},
    context: currentUser,
});
```

A write passes its body as an object, and header names in lower case:

```ts
const { status, body } = await rest.handle({
    method: 'POST',
    path: '/tags',
    query: new URLSearchParams('select=id,name'),
    headers: { prefer: 'return=representation' },
    body: { id: 8, name: 'garden' },
    context: currentUser,
});
```

A call from your code is not trusted more than a client's: `authorize` and `scope` receive its `context` like any other. Pass the user you act for, or a context your hooks recognise as a background job. Check `status` rather than catching: `handle` never throws, and an error answers its code in `body.error`.

## Your own routes

A host that registers every route itself, to attach its own permissions or documentation to each, calls `rest.handle` from those routes. That is how crudy mounts restloom: each declared route checks its permission, then hands the request to restloom.
