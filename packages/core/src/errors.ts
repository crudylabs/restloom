/**
 * Every refusal restloom answers. The code is stable and documented; the detail
 * names the part of the request at fault and never carries database text.
 */
export class RestError extends Error {
    constructor(public readonly status: number, public readonly code: string, public readonly detail?: string) {
        super(detail ? `${code}: ${detail}` : code);
    }
}

export const badRequest = (code: string, detail?: string) => new RestError(400, code, detail);
export const notFound = (detail?: string) => new RestError(404, 'not_found', detail);
