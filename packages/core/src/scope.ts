import type { Filter } from './plan.js';
import type { Resource } from './resources.js';
import type { RestOptions } from './options.js';

/** The host's scope filters for a resource, as equality filters on its own columns (hidden ones included). */
export function scopeFilters<C>(options: RestOptions<C>, context: C): (resource: Resource) => Filter[] {
    const hook = options.hooks?.scope;
    if (!hook) return () => [];
    return (resource) => Object.entries(hook(resource.name, context) ?? {}).map(([column, value]): Filter => {
        if (!resource.all.has(column)) throw new Error(`restloom: scope for ${resource.name} names a column it does not have: ${column}`);
        return value === null
            ? { kind: 'cmp', path: { relations: [], column }, op: 'is', negate: false, value: null }
            : { kind: 'cmp', path: { relations: [], column }, op: 'eq', negate: false, value };
    });
}
