import type { Catalog } from './catalog.js';
import { RestError, notFound } from './errors.js';
import { DEFAULT_LIMITS, type Limits, type RestOptions, type RestRequest, type RestResponse } from './options.js';
import { buildProcedures, matchProcedure, procedureArgs, type Procedure } from './procedures.js';
import { readRows } from './read.js';
import { buildResources, type Resource } from './resources.js';
import { scopeFilters } from './scope.js';
import { create, remove, update, type WriteContext } from './write.js';

export interface Rest<C = unknown> {
    /** Answers one request. Never throws: every failure is a response. */
    handle(request: RestRequest<C>): Promise<RestResponse>;
    /** Rereads the catalog on the next request. */
    reload(): void;
    /** The resources the API serves, read from the catalog on first use. */
    resources(): Promise<ReadonlyMap<string, Resource>>;
}

interface Api { resources: Map<string, Resource>; procedures: Procedure[] }

const ACTIONS = { GET: 'read', POST: 'create', PATCH: 'update', DELETE: 'delete' } as const;

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
    let loading: Promise<Api> | null = null;

    const load = () => (loading ??= db.introspect({ schemas: options.expose.schemas ?? [], tables: options.expose.tables ?? [] })
        .then((catalog: Catalog) => ({
            resources: buildResources(catalog, options as RestOptions<unknown>),
            procedures: buildProcedures(catalog, options.procedures ?? {}),
        }))
        .catch((err: unknown) => { loading = null; throw err; }));

    async function inTransaction<T>(request: RestRequest<C>, readOnly: boolean, fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>): Promise<T> {
        return db.transaction(async (tx) => {
            await options.hooks?.transaction?.(tx, request.context);
            return fn(tx);
        }, { timeoutMs: limits.timeoutMs, readOnly });
    }

    async function dispatch(request: RestRequest<C>): Promise<RestResponse> {
        const api = await load();
        const scope = scopeFilters(options, request.context);
        const call = matchProcedure(api.procedures, request.path);
        if (call) {
            if (request.method !== 'POST') throw new RestError(405, 'method_not_allowed');
            await options.hooks?.authorize?.(request, { procedure: call.procedure.template, action: 'call' });
            const args = procedureArgs(call.procedure.fn, call.values, request.body);
            return inTransaction(request, false, async (tx) => {
                const stmt = db.renderer.call(call.procedure.fn, args, db.renderer.context(scope));
                const rows = (await tx.query(stmt.sql, stmt.params)).map((r) => (typeof r.r === 'string' ? JSON.parse(r.r) : r.r));
                return { status: 200, headers: {}, body: call.procedure.fn.returnsSet ? rows : rows[0] ?? null };
            });
        }
        const target = route(request.path);
        const resource = target && api.resources.get(target.resource);
        if (!target || !resource) throw notFound();
        const action = ACTIONS[request.method as keyof typeof ACTIONS];
        if (!action || (action === 'create' && target.id !== undefined)) throw new RestError(405, 'method_not_allowed');
        await options.hooks?.authorize?.(request, { resource: resource.name, action });
        const generic = request as RestRequest<unknown>;
        if (action === 'read') return inTransaction(request, true, (tx) => readRows(db, tx, resource, generic, limits, scope, target.id));
        return inTransaction(request, false, (tx) => {
            const c: WriteContext = { db, tx, resource, request: generic, limits, scope };
            return action === 'create' ? create(c) : action === 'update' ? update(c, target.id) : remove(c, target.id);
        });
    }

    return {
        async handle(request) {
            try {
                return await dispatch(request);
            } catch (err) {
                if (err instanceof RestError) return errorBody(err);
                const mapped = db.mapError(err);
                if (mapped?.code === 'reference_missing' && request.method === 'DELETE') return errorBody(new RestError(409, 'still_referenced'));
                if (mapped) return errorBody(mapped);
                options.hooks?.onError?.(err, request);
                return errorBody(new RestError(500, 'internal'));
            }
        },
        reload() { loading = null; },
        resources: async () => (await load()).resources,
    };
}
