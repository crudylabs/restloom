import { DEFAULT_LIMITS } from '../dist/index.js';
import { buildResources } from '../dist/resources.js';

const col = (name, type = 'text', extra = {}) => ({ name, type, nativeType: type, nullable: true, generated: false, ...extra });

/** The demo schema as a catalog, without a database. */
export function catalog() {
    return {
        functions: [],
        tables: [
            { schema: 'demo', name: 'users', kind: 'table', primaryKey: ['id'],
              columns: [col('id', 'integer'), col('name'), col('password_hash'), col('limit', 'integer'), col('manager_id', 'integer')],
              foreignKeys: [{ columns: ['manager_id'], target: { schema: 'demo', table: 'users' }, targetColumns: ['id'] }] },
            { schema: 'demo', name: 'assets', kind: 'table', primaryKey: ['id'],
              columns: [col('id', 'integer'), col('name'), col('status'), col('owner_id', 'integer'), col('cost', 'number'), col('active', 'boolean'), col('created_at', 'timestamp', { generated: true })],
              foreignKeys: [{ columns: ['owner_id'], target: { schema: 'demo', table: 'users' }, targetColumns: ['id'] }] },
            { schema: 'demo', name: 'tags', kind: 'table', primaryKey: ['id'], columns: [col('id', 'integer'), col('name')], foreignKeys: [] },
            { schema: 'demo', name: 'asset_tags', kind: 'table', primaryKey: ['asset_id', 'tag_id'],
              columns: [col('asset_id', 'integer'), col('tag_id', 'integer')],
              foreignKeys: [
                  { columns: ['asset_id'], target: { schema: 'demo', table: 'assets' }, targetColumns: ['id'] },
                  { columns: ['tag_id'], target: { schema: 'demo', table: 'tags' }, targetColumns: ['id'] },
              ] },
            { schema: 'other', name: 'secrets', kind: 'table', primaryKey: ['id'], columns: [col('id', 'integer')], foreignKeys: [] },
        ],
    };
}

export function resources(options = {}) {
    return buildResources(catalog(), { db: null, expose: { schemas: ['demo'] }, ...options });
}

export const limits = DEFAULT_LIMITS;
