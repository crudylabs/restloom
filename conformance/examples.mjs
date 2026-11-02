import { readFileSync } from 'node:fs';

const CASE = /```http\n([\s\S]*?)```[ \t]*\n+(?:Answer: (\d{3})[ \t]*\n+)?(?:```json\n([\s\S]*?)```)?/g;

function request(block) {
    const [head, ...rest] = block.split(/\n\s*\n/);
    const lines = head.split('\n').map((l) => l.trim()).filter(Boolean);
    const headers = {};
    let line = '';
    for (const l of lines) {
        const h = /^([A-Za-z-]+):\s*(.*)$/.exec(l);
        if (h && line) headers[h[1].toLowerCase()] = h[2];
        else line += l;
    }
    const body = rest.join('\n\n').trim();
    return { line, headers, body: body ? JSON.parse(body) : undefined };
}

/**
 * The conformance cases of a docs page: every ```http block (request line,
 * header lines, a blank line and a JSON body) followed by an optional
 * `Answer: <status>` line and an optional ```json block with the exact body.
 * Without an Answer line the status is 2xx, or 4xx when the body has `error`.
 */
export function examples(file) {
    const text = readFileSync(file, 'utf8');
    const out = [];
    for (let m; (m = CASE.exec(text));) {
        if (!m[2] && m[3] === undefined) continue;
        const { line, headers, body } = request(m[1]);
        const space = line.indexOf(' ');
        const target = new URL(line.slice(space + 1), 'http://example');
        out.push({
            name: `${file.split('/').pop()}:${text.slice(0, m.index).split('\n').length} ${line}`,
            method: line.slice(0, space), path: target.pathname, query: target.searchParams, headers, body,
            status: m[2] ? Number(m[2]) : undefined,
            expected: m[3] === undefined ? undefined : JSON.parse(m[3]),
        });
    }
    return out;
}

export async function run(rest, example, assert) {
    const res = await rest.handle({ method: example.method, path: example.path, query: example.query, headers: example.headers, body: example.body, context: undefined });
    assert.deepEqual(res.body, example.expected, `status ${res.status}`);
    if (example.status) assert.equal(res.status, example.status);
    else if (example.expected && typeof example.expected === 'object' && 'error' in example.expected) assert.ok(res.status >= 400, `status ${res.status}`);
    else assert.ok(res.status < 300, `status ${res.status}`);
}
