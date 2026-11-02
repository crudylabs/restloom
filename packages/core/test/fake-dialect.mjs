import { SqlRenderer } from '../dist/index.js';

/** A dialect with one table and canned rows, for adapter and wiring tests without a database. */
export function fakeDialect(rows = [{ id: 1, name: 'one' }]) {
    const statements = [];
    return {
        statements,
        name: 'fake',
        capabilities: { returning: true, estimatedCount: false, rowSecurity: false },
        renderer: new SqlRenderer(),
        async introspect() {
            const col = (name, type) => ({ name, type, nativeType: type, nullable: false, generated: false });
            return { functions: [], tables: [{ schema: 'app', name: 'items', kind: 'table', primaryKey: ['id'], foreignKeys: [], columns: [col('id', 'integer'), col('name', 'text')] }] };
        },
        async transaction(fn) {
            return fn({ async query(sql) { statements.push(sql); return sql.startsWith('SELECT COUNT') ? [{ n: rows.length }] : rows.map((r) => ({ r })); } });
        },
        mapError: () => null,
    };
}
