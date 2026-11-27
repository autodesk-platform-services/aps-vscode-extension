/**
 * Parses a work item argument's headers field (`HeaderA:ValueA;HeaderB:ValueB`) into a map.
 * Entries are split on the first `:` only (so values may contain colons), and entries that are
 * empty or have no header name or no `:` are ignored.
 */
export function parseHeaders(text: string): { [name: string]: string } {
    const headers: { [name: string]: string } = {};
    for (const entry of text.split(';')) {
        const separator = entry.indexOf(':');
        if (separator === -1) {
            continue;
        }
        const name = entry.slice(0, separator).trim();
        if (name) {
            headers[name] = entry.slice(separator + 1).trim();
        }
    }
    return headers;
}
