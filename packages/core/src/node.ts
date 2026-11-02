import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RestResponse } from './options.js';
import type { Rest } from './rest.js';

export interface NodeListenerOptions<C> {
    /** Builds the context hooks receive, e.g. the authenticated user. */
    context?(req: IncomingMessage): C | Promise<C>;
    /** Path the API is mounted under, e.g. /api. */
    prefix?: string;
    /** Largest request body read, in bytes (default 1 MiB). */
    maxBodyBytes?: number;
}

function readBody(req: IncomingMessage, max: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (c: Buffer) => {
            size += c.length;
            if (size > max) { reject(Object.assign(new Error('body_too_large'), { status: 413 })); req.destroy(); }
            else chunks.push(c);
        });
        req.on('end', () => {
            if (size === 0) return resolve(undefined);
            try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(Object.assign(new Error('bad_body'), { status: 400 })); }
        });
        req.on('error', reject);
    });
}

function send(res: ServerResponse, r: RestResponse): void {
    const body = r.body === undefined ? '' : JSON.stringify(r.body);
    res.writeHead(r.status, { ...r.headers, ...(body ? { 'content-type': 'application/json; charset=utf-8' } : {}) });
    res.end(body);
}

/** A node:http request listener serving the API. */
export function nodeListener<C>(rest: Rest<C>, options: NodeListenerOptions<C> = {}) {
    const prefix = options.prefix?.replace(/\/$/, '') ?? '';
    return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (prefix && url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return send(res, { status: 404, headers: {}, body: { error: 'not_found' } });
        let body: unknown;
        try {
            body = await readBody(req, options.maxBodyBytes ?? 1 << 20);
        } catch (err) {
            const status = (err as { status?: number }).status ?? 400;
            return send(res, { status, headers: {}, body: { error: status === 413 ? 'body_too_large' : 'bad_body' } });
        }
        const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v]));
        send(res, await rest.handle({
            method: req.method ?? 'GET',
            path: url.pathname.slice(prefix.length) || '/',
            query: url.searchParams,
            headers,
            body,
            context: (await options.context?.(req)) as C,
        }));
    };
}
