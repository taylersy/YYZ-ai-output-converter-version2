/** Repair copy/paste escaping inside formulas, never in surrounding Markdown/code. */
function normalizeLatex(latex: string): string {
    let normalized = latex
        .replace(/[\uff01-\uff5e]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
        .replace(/\u3000/g, ' ')
        .replace(/\\left\{/g, '\\left\\{')
        .replace(/\\right\}/g, '\\right\\}')
        // GPT sometimes Markdown-escapes the subscript before a grouped expression.
        .replace(/\\_(?=\{)/g, '_');

    if (/\\begin\{(?:aligned|align\*?|alignedat|cases|[bpBvV]?matrix|array|gathered|split)\}/.test(normalized)) {
        normalized = normalized
            // A single slash at a row boundary is a damaged LaTeX row separator.
            .replace(/(?<!\\)\\[ \t]*\n/g, () => '\\\\\n')
            // A copied row separator can have three slashes, even on one line.
            .replace(/(?<!\\)\\{3}(?=\s*(?:&|[a-zA-Z][^\\\n]*[=&]))/g, () => '\\\\');
    }
    return normalized.trim();
}

export function normalizeMarkdown(markdown: string): string {
    if (!markdown) return '';

    const code: string[] = [];
    const formulas: string[] = [];
    const protectCode = (value: string) => `\uE000CODE${code.push(value) - 1}\uE001`;
    const protectMath = (value: string, display: boolean) => {
        const latex = normalizeLatex(value);
        const formula = display ? `$$\n${latex}\n$$` : `$${latex.replace(/\s*\n\s*/g, ' ')}$`;
        const token = `\uE000MATH${formulas.push(formula) - 1}\uE001`;
        return display ? `\n\n${token}\n\n` : token;
    };

    let normalized = markdown.replace(/\r\n?/g, '\n');

    // Protect both fence styles (including unclosed fences) before touching LaTeX.
    const openingFence = /^ {0,3}(`{3,}|~{3,})[^\n]*(?:\n|$)/gm;
    let fenced = '';
    let cursor = 0;
    let opening: RegExpExecArray | null;
    while ((opening = openingFence.exec(normalized)) !== null) {
        const fence = opening[1];
        const closingFence = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*(?=\\n|$)`, 'gm');
        closingFence.lastIndex = openingFence.lastIndex;
        const closing = closingFence.exec(normalized);
        const end = closing ? closingFence.lastIndex : normalized.length;
        fenced += normalized.slice(cursor, opening.index) + protectCode(normalized.slice(opening.index, end));
        cursor = end;
        openingFence.lastIndex = end;
    }
    normalized = fenced + normalized.slice(cursor);
    normalized = normalized.replace(/(`+)([^`]|(?!\1)`)*?\1(?!`)/g, protectCode);

    // Protect existing dollar math first. A double-escaped GPT boundary must be
    // consumed as a whole: matching only its second slash leaves broken math.
    normalized = normalized.replace(/(?<![\\$])\$\$(?!\$)([\s\S]*?)(?<!\\)\$\$(?!\$)/g,
        (_, content: string) => protectMath(content, true));
    normalized = normalized.replace(/(?<!\\)(\\{1,2})\[([\s\S]*?)\1\]/g,
        (_, _slashes: string, content: string) => protectMath(content, true));
    normalized = normalized.replace(/(?<!\\)(\\{1,2})\(([\s\S]*?)\1\)/g,
        (_, _slashes: string, content: string) => protectMath(content, false));
    normalized = normalized.replace(/(?<![\\$])\$(?!\$)((?:\\[^\n]|[^$\\])+?)(?<!\\)\$(?!\$)/g,
        (_, content: string) => protectMath(content, false));

    // Retain compatibility with AI output that lost the slashes around [ ... ].
    normalized = normalized.replace(/^[ \t]*\[\n([\s\S]*?)\n[ \t]*\]/gm, (_, content: string) =>
        protectMath(content.replace(/^={2,}\s*$/gm, '=').replace(/^-{2,}\s*$/gm, '-'), true));

    // Legacy bare-formula support. Only these inferred fragments may be joined;
    // explicit display equations above always keep their own boundaries.
    const lines = normalized.split('\n');
    const result: string[] = [];
    let inferred: string[] = [];
    const flushMath = () => {
        if (inferred.length) {
            result.push(protectMath(inferred.join('\n'), true));
            inferred = [];
        }
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        // Tokens can represent inline code/math or a whole protected block.
        if (line.includes('\uE000') || trimmed.includes('$')) {
            flushMath();
            // Keep previously supported indented inline formulas out of Markdown
            // code blocks, while leaving actual protected code untouched.
            result.push(line.includes('\uE000MATH')
                ? line.replace(/^( {4,}|\t+)/, indent => indent.replace(/ /g, '\u00a0').replace(/\t/g, '\u00a0'.repeat(4)))
                : line);
            continue;
        }
        const env = trimmed.match(/^\\begin\{([a-zA-Z*]+)\}/);
        if (env) {
            const envName = env[1];
            inferred.push(line);
            while (!lines[i].includes(`\\end{${envName}}`) && i + 1 < lines.length && !lines[i + 1].includes('\uE000')) {
                inferred.push(lines[++i]);
            }
            continue;
        }
        const isMath = trimmed && !/^(#|\*|-|\d+\.|\||>)/.test(trimmed) && !/[\u4e00-\u9fff]/.test(trimmed) && (
            /(\\frac|\\sum|\\int|\\lim|\\Delta|\\alpha|\\beta|\\gamma|\\theta|\\pm|\\ne|\\approx|\\le|\\ge|\^|_|\\sqrt|\\times|\\div|=.*=)/.test(trimmed) ||
            /^[a-zA-Z]\([a-zA-Z]\)\s*=/.test(trimmed) || /^&?=/.test(trimmed) ||
            /^\\(?:left|right)/.test(trimmed)
        );
        if (isMath) {
            inferred.push(line);
        } else {
            flushMath();
            result.push(line);
        }
    }
    flushMath();

    normalized = result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    // Restore code last, so no formula or whitespace repair can change it.
    normalized = normalized.replace(/\uE000MATH(\d+)\uE001/g, (_, index: string) => formulas[Number(index)]);
    return normalized.replace(/\uE000CODE(\d+)\uE001/g, (_, index: string) => code[Number(index)]);
}
