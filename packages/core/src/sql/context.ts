import type { Filter } from '../plan.js';
import type { Resource } from '../resources.js';
import { Params } from './params.js';

/** State of one statement being written: its bound values, fresh aliases, and the host's scope per resource. */
export class RenderContext {
    readonly params = new Params();
    private next = 0;
    constructor(readonly scope: (resource: Resource) => Filter[]) {}

    alias(prefix = 't'): string {
        return `${prefix}${this.next++}`;
    }
}
