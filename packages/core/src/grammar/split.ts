import { badRequest } from '../errors.js';

/** Splits on top-level commas, keeping commas inside double quotes and parentheses. */
export function splitTopLevel(input: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let quoted = false;
    let start = 0;
    for (let i = 0; i < input.length; i++) {
        const c = input[i];
        if (c === '\\' && quoted) { i++; continue; }
        if (c === '"') quoted = !quoted;
        else if (!quoted && (c === '(' || c === '{')) depth++;
        else if (!quoted && (c === ')' || c === '}')) depth--;
        else if (!quoted && depth === 0 && c === ',') { out.push(input.slice(start, i)); start = i + 1; }
        if (depth < 0) throw badRequest('bad_syntax', input);
    }
    if (quoted || depth !== 0) throw badRequest('bad_syntax', input);
    out.push(input.slice(start));
    return out;
}

/** A value item: double quotes delimit it and a backslash escapes the next character. */
export function unquote(item: string): string {
    const t = item.trim();
    if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/\\(.)/g, '$1');
    return t;
}

/** `(a,b,"c,d")`, or `{a,b}` for an array, into its items. */
export function listItems(value: string, open = '(', close = ')'): string[] {
    if (!value.startsWith(open) || !value.endsWith(close)) throw badRequest('bad_list', value);
    const inner = value.slice(1, -1);
    return inner.trim() === '' ? [] : splitTopLevel(inner).map(unquote);
}
