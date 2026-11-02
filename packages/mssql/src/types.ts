import type { LogicalType } from '@crudy/restloom';

/** A SQL Server type name as a logical type. JSON lives in text columns, so it reads as text. */
export function logical(type: string): LogicalType {
    const t = type.toLowerCase();
    if (['tinyint', 'smallint', 'int', 'bigint'].includes(t)) return 'integer';
    if (['decimal', 'numeric', 'money', 'smallmoney', 'float', 'real'].includes(t)) return 'number';
    if (t === 'bit') return 'boolean';
    if (t === 'uniqueidentifier') return 'uuid';
    if (t === 'date') return 'date';
    if (['datetime', 'datetime2', 'smalldatetime', 'datetimeoffset'].includes(t)) return 'timestamp';
    if (t === 'time') return 'time';
    if (['char', 'varchar', 'nchar', 'nvarchar', 'text', 'ntext', 'sysname'].includes(t)) return 'text';
    if (['binary', 'varbinary', 'image', 'rowversion', 'timestamp'].includes(t)) return 'binary';
    return 'other';
}
