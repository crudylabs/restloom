import { badRequest } from '../errors.js';

/** One part of a dotted name. A quoted part is always a column, never a keyword. */
export interface Segment { name: string; quoted: boolean }

/**
 * Reads `owner."order".name` into its segments. Quotes let a name hold a dot
 * or a keyword; a backslash escapes a quote inside them.
 */
export function segments(input: string): Segment[] {
    const out: Segment[] = [];
    let i = 0;
    while (i <= input.length) {
        if (input[i] === '"') {
            let name = '';
            i++;
            while (i < input.length && input[i] !== '"') {
                if (input[i] === '\\') i++;
                name += input[i++] ?? '';
            }
            if (input[i] !== '"') throw badRequest('bad_name', input);
            i++;
            out.push({ name, quoted: true });
        } else {
            const end = input.indexOf('.', i);
            const name = input.slice(i, end < 0 ? input.length : end);
            out.push({ name, quoted: false });
            i = end < 0 ? input.length : end;
        }
        if (i >= input.length) break;
        if (input[i] !== '.') throw badRequest('bad_name', input);
        i++;
        if (i === input.length) throw badRequest('bad_name', input);
    }
    if (out.some((s) => s.name === '')) throw badRequest('bad_name', input);
    return out;
}

/** Splits `name.rest` at the first dot outside quotes. */
export function headAndRest(input: string): [string, string | null] {
    let quoted = false;
    for (let i = 0; i < input.length; i++) {
        if (input[i] === '\\' && quoted) { i++; continue; }
        if (input[i] === '"') quoted = !quoted;
        else if (!quoted && input[i] === '.') return [input.slice(0, i), input.slice(i + 1)];
    }
    return [input, null];
}
