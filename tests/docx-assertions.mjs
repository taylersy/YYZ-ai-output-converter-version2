// Read a ZIP member in the browser without adding a production dependency.
async function readMember(blob, name) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer);
    let end = bytes.length - 22;
    while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
    if (end < 0) throw new Error('Missing ZIP directory');
    let offset = view.getUint32(end + 16, true);
    const entries = view.getUint16(end + 10, true);
    for (let i = 0; i < entries; i++) {
        const method = view.getUint16(offset + 10, true);
        const size = view.getUint32(offset + 20, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const entryName = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength));
        if (entryName === name) {
            const local = view.getUint32(offset + 42, true);
            const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
            const compressed = bytes.slice(start, start + size);
            if (method === 0) return new TextDecoder().decode(compressed);
            if (method !== 8) throw new Error(`Unsupported ZIP compression: ${method}`);
            const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
            return new Response(stream).text();
        }
        offset += 46 + nameLength + extraLength + commentLength;
    }
    throw new Error(`Missing ZIP member: ${name}`);
}

export async function assertDocx(blob) {
    const xml = await readMember(blob, 'word/document.xml');
    const root = new DOMParser().parseFromString(xml, 'text/xml');
    const mathNS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
    const wordNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const count = (name, expected, ns = mathNS) => {
        const actual = root.getElementsByTagNameNS(ns, name).length;
        if (actual !== expected) throw new Error(`DOCX ${name}: ${actual}, expected ${expected}`);
    };
    count('oMath', 56);
    count('oMathPara', 13);
    count('f', 8);
    count('rad', 11);
    count('sSub', 14);
    count('eqArr', 1);
    count('tbl', 1, wordNS);
    count('tr', 6, wordNS);
    const rows = root.getElementsByTagNameNS(mathNS, 'eqArr')[0].children;
    if ([...rows].filter(node => node.localName === 'e').length !== 2) throw new Error('Aligned equation lost a row');
    const matrix = root.getElementsByTagNameNS(mathNS, 'm')[0];
    if (!matrix || matrix.getElementsByTagNameNS(mathNS, 'mr').length !== 2) throw new Error('Cases lost a row');
    for (const delim of root.getElementsByTagNameNS(mathNS, 'dPr')) {
        const begin = delim.getElementsByTagNameNS(mathNS, 'begChr')[0]?.getAttributeNS(mathNS, 'val');
        const end = delim.getElementsByTagNameNS(mathNS, 'endChr')[0]?.getAttributeNS(mathNS, 'val');
        if (begin === '(' && end === '') throw new Error('Ordinary parenthesis became an unclosed delimiter');
    }
    if (root.documentElement.textContent.includes('\\_') || root.documentElement.textContent.includes('Error:')) throw new Error('Escaping/error leaked into DOCX');
    if ((root.documentElement.textContent.match(/______/g) || []).length !== 2) throw new Error('Fill-in blanks changed');
    return '56 editable OMML formulas, 13 display equations, 2 aligned rows, 2 cases rows, 6 table rows';
}
