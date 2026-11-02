const TOKEN = /\u0000(\d+)\u0000/g;

/**
 * Bound values of one statement. Fragments carry a token per value, so they can
 * be written in any order and repeated; finalize() writes the database's own
 * placeholders in text order. The token holds a NUL, which no identifier or
 * literal can contain.
 */
export class Params {
    readonly values: unknown[] = [];

    add(value: unknown): string {
        this.values.push(value);
        return `\u0000${this.values.length}\u0000`;
    }

    finalize(sql: string, placeholder: (index: number) => string): { sql: string; params: unknown[] } {
        const params: unknown[] = [];
        const text = sql.replace(TOKEN, (_, n: string) => {
            params.push(this.values[Number(n) - 1]);
            return placeholder(params.length);
        });
        return { sql: text, params };
    }
}
