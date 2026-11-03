import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { postgres } from '../packages/postgres/dist/index.js';
import { mysql } from '../packages/mysql/dist/index.js';
import { mssql } from '../packages/mssql/dist/index.js';
import { sqlite } from '../packages/sqlite/dist/index.js';

// The table in docs/dialects.md is what readers compare databases by, on the
// site too. It must say what each dialect's capabilities say.
const DIALECTS = {
    '@crudy/restloom-postgres': postgres({ connect() {} }),
    '@crudy/restloom-mysql': mysql({ getConnection() {} }),
    '@crudy/restloom-mssql': mssql({ request() {} }),
    '@crudy/restloom-sqlite': sqlite({ pragma() {} }),
};

const rows = readFileSync(new URL('../docs/dialects.md', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('| `@crudy/restloom-'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));

test('docs/dialects.md lists every dialect', () => {
    assert.deepEqual(rows.map((r) => r[0].replaceAll('`', '')).sort(), Object.keys(DIALECTS).sort());
});

for (const [pkg, dialect] of Object.entries(DIALECTS)) {
    test(`docs/dialects.md says what ${pkg} can do`, () => {
        const [, , , written, estimated, rowSecurity, procedures] = rows.find((r) => r[0] === `\`${pkg}\``);
        const c = dialect.capabilities;
        assert.equal(/RETURNING|OUTPUT/.test(written), c.returning, 'written keys');
        assert.equal(estimated !== 'no', c.estimatedCount, 'estimated count');
        assert.equal(rowSecurity !== 'no', c.rowSecurity, 'row security');
        assert.equal(procedures !== 'none', c.procedures, 'procedures');
    });
}
