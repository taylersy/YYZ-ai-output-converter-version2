import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';

// Run the actual TypeScript implementation without adding a second test runtime.
const source = readFileSync(new URL('../src/utils/textUtils.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const { normalizeMarkdown } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const fixture = readFileSync(new URL('./fixtures/gpt-coordinate-triangle.md', import.meta.url), 'utf8');
const preview = input => renderToStaticMarkup(React.createElement(ReactMarkdown, {
    remarkPlugins: [remarkMath, remarkGfm], rehypePlugins: [rehypeKatex, rehypeRaw],
}, normalizeMarkdown(input)));
const count = (text, regex) => [...text.matchAll(regex)].length;

for (const [name, input, expected] of [
    ['single-slash inline', String.raw`点 \(P_1(x,y)\)。`, '点 $P_1(x,y)$。'],
    ['double-slash inline', String.raw`点 \\(P_1(x,y)\\)。`, '点 $P_1(x,y)$。'],
    ['single-slash display', String.raw`\[ \frac12 \]`, '$$\n\\frac12\n$$'],
    ['double-slash display', String.raw`\\[ \frac12 \\]`, '$$\n\\frac12\n$$'],
    ['inline newlines', '\\(x+\ny\\)', '$x+ y$'],
    ['existing inline', '点 $x_1$。', '点 $x_1$。'],
    ['existing display', '$$x^2$$', '$$\nx^2\n$$'],
    ['grouped subscript', String.raw`\(S\_{\triangle ABC}\)`, String.raw`$S_{\triangle ABC}$`],
    ['literal text underscore', String.raw`\(\text{file\_name}\)`, String.raw`$\text{file\_name}$`],
    ['escaped dollar', String.raw`价格 \$5；公式 $x+1$。`, String.raw`价格 \$5；公式 $x+1$。`],
    ['escaped dollar in math', String.raw`$\text{cost: \$5}$`, String.raw`$\text{cost: \$5}$`],
    ['unmatched delimiter', String.raw`普通文本 \(未闭合。`, String.raw`普通文本 \(未闭合。`],
    ['Chinese punctuation', '（1）中文，标点；保持！', '（1）中文，标点；保持！'],
    ['inline code', '说明 `\\(x_1\\)` 和 $y$。', '说明 `\\(x_1\\)` 和 $y$。'],
    ['backtick fence', '```latex\n\\[x_1\\]\n\n\n\\left{\n```', '```latex\n\\[x_1\\]\n\n\n\\left{\n```'],
    ['tilde fence', '~~~latex\n\\\\(x_1\\\\)\n~~~', '~~~latex\n\\\\(x_1\\\\)\n~~~'],
    ['long closing fence', '```latex\n\\(x_1\\)\n````\n\\(y\\)', '```latex\n\\(x_1\\)\n````\n$y$'],
    ['indented inline formula', '说明\n\n    $x_1$ text', '说明\n\n' + '\u00a0'.repeat(4) + '$x_1$ text'],
    ['unclosed fence', '```latex\n\\[x_1\\]', '```latex\n\\[x_1\\]'],
    ['bare formula', String.raw`f(x) = \frac12`, '$$\nf(x) = \\frac12\n$$'],
    ['bare bracket formula', '[\nx^2\n]', '$$\nx^2\n$$'],
]) {
    test(name, () => {
        assert.equal(normalizeMarkdown(input), expected);
        assert.equal(normalizeMarkdown(expected), expected, 'normalization must be idempotent');
    });
}

test('explicit neighboring display equations stay separate', () => {
    const input = '$$x^2$$\n$$y^2$$';
    assert.equal(count(preview(input), /class="katex-display"/g), 2);
    assert.equal(normalizeMarkdown(input), '$$\nx^2\n$$\n\n$$\ny^2\n$$');
});

test('repair aligned/cases row separators without breaking valid matrices', () => {
    for (const input of [
        String.raw`\\[ \begin{aligned} S_P&=\frac32(t^2-6t+11)\\\ &=\frac32(t-3)^2+3. \end{aligned} \\]`,
        String.raw`\\[ \begin{cases} x+y=4,\\\ xy=1 \end{cases} \\]`,
        '\\[\\begin{bmatrix}\na&b\\\nc&d\n\\end{bmatrix}\\]',
        String.raw`$$\begin{bmatrix}a&b\\c&d\end{bmatrix}$$`,
        '\\left{\n\\begin{aligned}\nx&=1,\\\ny&=2\n\\end{aligned}\n\\right.',
    ]) {
        const html = preview(input);
        assert.doesNotMatch(html, /katex-error/);
        assert.match(html, /<mtable/);
        assert.equal(count(html, /<mtr>/g), 2);
    }
});

test('legacy split bare equation retains one formula and valid rows', () => {
    const input = 'f(x) =\n\\begin{bmatrix}\nx&1\n\\end{bmatrix}';
    const html = preview(input);
    assert.doesNotMatch(html, /katex-error/);
    assert.equal(count(html, /class="katex-display"/g), 1);
});

test('full GPT fixture renders every formula with intact headings/list/table', () => {
    const normalized = normalizeMarkdown(fixture);
    const html = preview(fixture);
    assert.equal(normalizeMarkdown(normalized), normalized);
    assert.doesNotMatch(html, /katex-error/);
    assert.doesNotMatch(normalized, /\\\\[()[\]]/);
    assert.equal(count(html, /class="katex-display"/g), 13);
    assert.equal(count(html, /class="katex"/g), 56);
    assert.equal(count(html, /<h[1-6]>/g), 8);
    assert.equal(count(html, /<li>/g), 2);
    assert.equal(count(html, /<table>/g), 1);
    assert.equal(count(html, /<tr>/g), 6);
    assert.match(html, /______；/);
    assert.match(html, /S_\{\\triangle ABC\}/);
});
