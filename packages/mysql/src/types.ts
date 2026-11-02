import type { LogicalType } from '@crudy/restloom';

/** A MySQL column type as a logical type. TINYINT(1) is MySQL's boolean. */
export function logical(dataType: string, columnType: string): LogicalType {
    const t = dataType.toLowerCase();
    if (columnType.toLowerCase().startsWith('tinyint(1)') || t === 'boolean') return 'boolean';
    if (['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint', 'year'].includes(t)) return 'integer';
    if (['decimal', 'numeric', 'float', 'double', 'real'].includes(t)) return 'number';
    if (['char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext', 'enum', 'set'].includes(t)) return 'text';
    if (t === 'date') return 'date';
    if (t === 'datetime' || t === 'timestamp') return 'timestamp';
    if (t === 'time') return 'time';
    if (t === 'json') return 'json';
    if (['binary', 'varbinary', 'tinyblob', 'blob', 'mediumblob', 'longblob', 'bit'].includes(t)) return 'binary';
    return 'other';
}
