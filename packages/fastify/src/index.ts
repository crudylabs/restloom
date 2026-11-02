import type { Rest } from '@crudy/restloom';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface RestloomFastifyOptions<C> {
    /** Builds the context hooks receive, e.g. the authenticated user. */
    context?(req: FastifyRequest): C | Promise<C>;
}

/**
 * A Fastify plugin answering every path under its prefix with restloom.
 * Register it with a prefix: `app.register(restloom(rest), { prefix: '/api' })`.
 */
export function restloom<C>(rest: Rest<C>, options: RestloomFastifyOptions<C> = {}) {
    return async function plugin(app: FastifyInstance): Promise<void> {
        const handler = async (req: FastifyRequest, reply: FastifyReply) => {
            const url = new URL(req.raw.url ?? '/', 'http://localhost');
            const prefix = app.prefix ?? '';
            const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v]));
            const res = await rest.handle({
                method: req.method,
                path: url.pathname.slice(prefix.length) || '/',
                query: url.searchParams,
                headers,
                body: req.body,
                context: (await options.context?.(req)) as C,
            });
            reply.code(res.status).headers(res.headers);
            return res.body === undefined ? reply.send() : reply.send(res.body);
        };
        app.route({ method: ['GET', 'POST', 'PATCH', 'DELETE'], url: '/*', handler });
    };
}
