# Adapters

The core answers a plain request object, so it fits any framework:

```ts
const response = await rest.handle({ method, path, query, headers, body, context });
// { status, headers, body }
```

`handle` never throws: every failure is a response. `path` is the path below where the API is mounted (`/todos/4`), `query` a `URLSearchParams`, `body` the parsed JSON.

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
