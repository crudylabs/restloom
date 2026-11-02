import { RestError } from '@crudy/restloom';

const CODES: Record<string, [number, string]> = {
    '42501': [403, 'forbidden'],
    '23505': [409, 'duplicate'],
    '23503': [409, 'reference_missing'],
    '23502': [400, 'value_required'],
    '23514': [400, 'value_rejected'],
    '22P02': [400, 'invalid_value'],
    '22007': [400, 'invalid_value'],
    '22008': [400, 'invalid_value'],
    '22003': [400, 'invalid_value'],
    '22001': [400, 'invalid_value'],
    '22023': [400, 'invalid_value'],
    '57014': [503, 'timeout'],
};

/** A Postgres error the client caused, by SQLSTATE. The database's own message is never passed on. */
export function mapError(err: unknown): RestError | null {
    const code = (err as { code?: unknown })?.code;
    const hit = typeof code === 'string' ? CODES[code] : undefined;
    return hit ? new RestError(hit[0], hit[1]) : null;
}
