import type { LogicalType } from '@crudy/restloom';

const BY_NAME: Record<string, LogicalType> = {
    int2: 'integer', int4: 'integer', int8: 'integer', oid: 'integer',
    numeric: 'number', float4: 'number', float8: 'number', money: 'number',
    bool: 'boolean', uuid: 'uuid',
    date: 'date', timestamp: 'timestamp', timestamptz: 'timestamp', time: 'time', timetz: 'time',
    text: 'text', varchar: 'text', bpchar: 'text', name: 'text', citext: 'text', inet: 'text', cidr: 'text',
    json: 'json', jsonb: 'json', bytea: 'binary',
};

/** A Postgres type (after resolving a domain to its base) as a logical type. Enums read as text. */
export function logical(typname: string, typtype: string, category: string): LogicalType {
    if (BY_NAME[typname]) return BY_NAME[typname];
    if (typtype === 'e') return 'text';
    if (category === 'A') return 'array';
    return 'other';
}
