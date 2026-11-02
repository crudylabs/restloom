import type { LogicalType } from '@crudy/restloom';

/** A declared SQLite column type as a logical type, by the same keyword rules SQLite uses for affinity, refined for common names. */
export function logical(declared: string): LogicalType {
    const t = declared.toUpperCase();
    if (t === 'BOOLEAN' || t === 'BOOL') return 'boolean';
    if (t === 'UUID') return 'uuid';
    if (t === 'DATE') return 'date';
    if (t.includes('DATETIME') || t.includes('TIMESTAMP')) return 'timestamp';
    if (t === 'TIME') return 'time';
    if (t === 'JSON' || t === 'JSONB') return 'json';
    if (t.includes('INT')) return 'integer';
    if (t.includes('CHAR') || t.includes('CLOB') || t.includes('TEXT')) return 'text';
    if (t.includes('BLOB') || t === '') return t === '' ? 'other' : 'binary';
    if (t.includes('REAL') || t.includes('FLOA') || t.includes('DOUB') || t.includes('NUMERIC') || t.includes('DECIMAL')) return 'number';
    return 'other';
}
