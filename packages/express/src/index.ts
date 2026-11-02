import type { Rest } from '@crudy/restloom';
import type { NextFunction, Request, Response } from 'express';

export interface RestloomExpressOptions<C> {
    /** Builds the context hooks receive, e.g. the authenticated user. */
    context?(req: Request): C | Promise<C>;
}

/**
 * An Express handler answering every path it is mounted on with restloom.
 * Mount it after a JSON body parser: `app.use('/api', express.json(), restloom(rest))`.
 */
export function restloom<C>(rest: Rest<C>, options: RestloomExpressOptions<C> = {}) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const url = new URL(req.url, 'http://localhost');
            const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v]));
            const out = await rest.handle({
                method: req.method,
                path: url.pathname || '/',
                query: url.searchParams,
                headers,
                body: req.body,
                context: (await options.context?.(req)) as C,
            });
            res.status(out.status).set(out.headers);
            if (out.body === undefined) res.end();
            else res.json(out.body);
        } catch (err) {
            next(err);
        }
    };
}
