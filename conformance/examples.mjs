import { readFileSync } from 'node:fs';

/**
 * Every ```http block followed by a ```json block in a docs page is one
 * conformance case: the request, then the exact body it must answer. A body
 * with an `error` key must come with a 4xx or 5xx status.
 */
export function examples(file) {
    const text = readFileSync(file, 'utf8');
    const out = [];
    const re = /```http\n([\s\S]*?)```\s*\n+```json\n([\s\S]*?)```/g;
    for (let m; (m = re.exec(text));) {
        const line = text.slice(0, m.index).split('\n').length;
        const request = m[1].split('\n').map((l) => l.trim()).filter(Boolean).join('');
        const space = request.indexOf(' ');
        const target = new URL(request.slice(space + 1), 'http://example');
        out.push({
            name: `${file.split('/').pop()}:${line} ${request}`,
            method: request.slice(0, space),
            path: target.pathname,
            query: target.searchParams,
            expected: JSON.parse(m[2]),
        });
    }
    return out;
}

export async function run(rest, example, assert) {
    const res = await rest.handle({ method: example.method, path: example.path, query: example.query, headers: {}, context: undefined });
    assert.deepEqual(res.body, example.expected, `status ${res.status}`);
    if (example.expected && typeof example.expected === 'object' && 'error' in example.expected) assert.ok(res.status >= 400, `status ${res.status}`);
    else assert.ok(res.status < 300, `status ${res.status}`);
}
