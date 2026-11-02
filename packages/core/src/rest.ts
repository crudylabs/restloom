import type { Catalog } from './catalog.js';
import { RestError, notFound } from './errors.js';
import { DEFAULT_LIMITS, type Limits, type RestOptions, type RestRequest, type RestResponse } from './options.js';
import { readRows } from './read.js';
import { buildResources, type Resource } from './resources.js';
import { scopeFilters } from './scope.js';

export interface Rest<C = unknown> {
    /** Answers one request. Never throws: every failure is a response. */
    handle(request: RestRequest<C>): Promise<RestResponse>;
    /** Rereads the catalog on the next request. */
    reload(): void;
    /** The resources the API serves, read from the catalog on first use. */
    resources(): Promise<ReadonlyMap<string, Resource>>;
}

function errorBody(err: RestError): RestResponse {
    return { status: err.status, headers: {}, body: { error: err.code, ...(err.detail ? { message: err.detail } : {}) } };
}

function route(path: string): { resource: string; id?: string } | null {
    const parts = path.split('/').filter((p) => p !== '');
    if (parts.length < 1 || parts.length > 2) return null;
    try {
        return { resource: decodeURIComponent(parts[0]), id: parts[1] === undefined ? undefined : decodeURIComponent(parts[1]) };
    } catch {
        return null;
    }
}

/**
 * A REST API over the exposed tables and views of a database. Everything is
 * read from the catalog on first use; options only override.
 */
export function createREST<C = unknown>(options: RestOptions<C>): Rest<C> {
    const limits: Limits = { ...DEFAULT_LIMITS, ...options.limits };
    const db = options.db;
    let loading: Promise<Map<string, Resource>> | null = null;

    const load = () => (loading ??= db.introspect({ schemas: options.expose.schemas ?? [], tables: options.expose.tables ?? [] })
        .then((catalog: Catalog) => buildResources(catalog, options as RestOptions<unknown>))
        .catch((err: unknown) => { loading = null; throw err; }));

    async function dispatch(request: RestRequest<C>): Promise<RestResponse> {
        const target = route(request.path);
        const resource = target && (await load()).get(target.resource);
        if (!target || !resource) throw notFound();
        if (request.method !== 'GET') throw new RestError(405, 'method_not_allowed');
        await options.hooks?.authorize?.(request, { resource: resource.name, action: 'read' });
        const scope = scopeFilters(options, request.context);
        return db.transaction(async (tx) => {
            await options.hooks?.transaction?.(tx, request.context);
            return readRows(db, tx, resource, request as RestRequest<unknown>, limits, scope, target.id);
        }, { timeoutMs: limits.timeoutMs, readOnly: true });
    }

    return {
        async handle(request) {
            try {
                return await dispatch(request);
            } catch (err) {
                if (err instanceof RestError) return errorBody(err);
                const mapped = db.mapError(err);
                if (mapped) return errorBody(mapped);
                options.hooks?.onError?.(err, request);
                return errorBody(new RestError(500, 'internal'));
            }
        },
        reload() { loading = null; },
        resources: load,
    };
}
