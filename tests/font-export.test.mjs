import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { loadExporter, unpackDocx, elements, child, val } from './load-exporter.mjs';

const api = await loadExporter();
after(api.cleanup);
const fixture = await readFile(new URL('./fixtures/math-font-smoke.md', import.meta.url), 'utf8');
const mathRuns = root => elements(root, 'm:r');
const runText = run => child(run, 'm:t')?.textContent;
const formatting = run => child(run, 'w:rPr');
const runWith = (root, text) => mathRuns(root).find(run => runText(run) === text);
const options = { mainFont: { ascii: 'Arial', eastAsia: 'KaiTi' }, fontSize: 10.5, mathFont: 'Times New Roman', mathItalic: true };

for (const size of [12, 15.5, 18]) {
    test(`actual DOCX: independent body and formula font at ${size}pt`, async () => {
        const blob = await api.generateDocx(fixture, { ...options, mathFontSize: size });
        const { document, styles, settings } = await unpackDocx(blob);
        assert.equal(elements(document, 'm:oMath').length, 9);
        for (const marker of elements(document, 'm:aln')) assert.equal(marker.parentElement.tagName, 'm:rPr');
        for (const run of mathRuns(document)) {
            assert.equal(child(run, 'm:t') !== undefined, true, 'No empty formula runs');
            const properties = formatting(run);
            const fonts = child(properties, 'w:rFonts');
            assert.equal(fonts.getAttribute('w:ascii'), 'Times New Roman');
            assert.equal(fonts.getAttribute('w:hAnsi'), 'Times New Roman');
            assert.equal(fonts.getAttribute('w:eastAsia'), 'KaiTi');
            assert.equal(val(child(properties, 'w:sz')), String(size * 2));
            assert.equal(val(child(properties, 'w:szCs')), String(size * 2));
            assert.deepEqual(Array.from(run.children).map(n => n.tagName), ['m:rPr', 'w:rPr', 'm:t']);
        }
        for (const variable of ['x', 'y', 'z', 'α', 'β', 'γ', 'P']) {
            const run = runWith(document, variable);
            assert.equal(val(child(child(run, 'm:rPr'), 'm:sty')), 'p', `${variable} must retain base Unicode glyphs for Times New Roman`);
            assert.equal(child(child(run, 'm:rPr'), 'm:nor'), undefined, 'Variables retain mathematical spacing');
            assert.equal(val(child(formatting(run), 'w:i')), '1', `${variable} should be italic`);
        }
        for (const normal of ['1', 'sin', '单位']) {
            assert.equal(val(child(formatting(runWith(document, normal)), 'w:i')), '0');
        }
        const defaults = elements(styles, 'w:rPrDefault')[0];
        assert.equal(elements(defaults, 'w:rFonts')[0].getAttribute('w:hAnsi'), 'Arial');
        assert.equal(val(elements(defaults, 'w:sz')[0]), '21');
        const bodyRun = elements(document, 'w:r').find(run => run.textContent.includes('正文中文'));
        assert.equal(val(elements(bodyRun, 'w:sz')[0]), '21');
        assert.equal(elements(bodyRun, 'w:rFonts')[0].getAttribute('w:eastAsia'), 'KaiTi');
        assert.equal(val(elements(settings, 'm:mathFont')[0]), 'Cambria Math');
        assert.equal(elements(document, 'm:supPr').length + elements(document, 'm:subPr').length + elements(document, 'm:subSupPr').length, 0);
        for (const name of ['m:sSupPr', 'm:sSubPr', 'm:fPr', 'm:radPr', 'm:eqArrPr']) {
            for (const properties of elements(document, name)) {
                assert.equal(val(elements(properties, 'w:sz')[0]), String(size * 2), `${name} must use formula size`);
            }
        }
        // Save only requested QA sizes, outside the repository.
        if (process.env.EXPORT_FONT_QA_DIR && size !== 15.5) {
            await mkdir(process.env.EXPORT_FONT_QA_DIR, { recursive: true });
            await writeFile(`${process.env.EXPORT_FONT_QA_DIR}/times-new-roman-${size}pt.docx`, Buffer.from(await blob.arrayBuffer()));
        }
    });
}

test('upright choice and explicit LaTeX styles retain meaning', async () => {
    const { document } = await unpackDocx(await api.generateDocx(String.raw`$x+\mathrm{AB}+\mathbf{v}+\boldsymbol{\alpha}+\mathbb{R}$`, { mathItalic: false }));
    assert.equal(val(child(formatting(runWith(document, 'x')), 'w:i')), '0');
    assert.equal(val(child(formatting(runWith(document, 'A')), 'w:i')), '0');
    assert.equal(val(child(formatting(runWith(document, 'v')), 'w:b')), '1');
    assert.equal(val(child(formatting(runWith(document, 'v')), 'w:i')), '0');
    assert.equal(val(child(formatting(runWith(document, 'α')), 'w:b')), '1');
    assert.equal(val(child(formatting(runWith(document, 'α')), 'w:i')), '1');
    const blackboard = runWith(document, 'R');
    assert.equal(val(child(child(blackboard, 'm:rPr'), 'm:scr')), 'double-struck');
    assert.equal(child(child(blackboard, 'm:rPr'), 'm:nor'), undefined);
});

test('real math fonts keep math italics and document font selection', async () => {
    for (const font of ['Cambria Math', 'XITS Math', 'Latin Modern Math']) {
        const { document, settings } = await unpackDocx(await api.generateDocx('$x^2+1$', { mathFont: font, mathFontSize: 16 }));
        assert.equal(val(elements(settings, 'm:mathFont')[0]), font);
        const run = runWith(document, 'x');
        assert.equal(val(child(child(run, 'm:rPr'), 'm:sty')), 'i');
        assert.equal(elements(run, 'w:rFonts')[0].getAttribute('w:ascii'), font);
    }
});

test('parallel exports keep separate font settings', async () => {
    const blobs = await Promise.all([api.generateDocx('$x^2+1$', { mathFont: 'Times New Roman', mathFontSize: 12 }),
        api.generateDocx('$x^2+1$', { mathFont: 'Cambria Math', mathFontSize: 18 })]);
    for (const [index, blob] of blobs.entries()) {
        const { document } = await unpackDocx(blob);
        const run = runWith(document, 'x');
        assert.equal(val(child(formatting(run), 'w:sz')), index ? '36' : '24');
        assert.equal(elements(run, 'w:rFonts')[0].getAttribute('w:ascii'), index ? 'Cambria Math' : 'Times New Roman');
    }
});

test('invalid settings cannot produce zero or nonfinite sizes', () => {
    const config = api.resolveExportConfig({ mathFontSize: NaN, fontSize: -3, lineSpacing: 0 });
    assert.equal(config.mathFontSize, 12);
    assert.equal(config.fontSize, 8);
    assert.equal(config.lineSpacing, 1.5);
    assert.equal(api.resolveExportConfig({ mathFontSize: 1000 }).mathFontSize, 72);
    assert.equal(api.resolveExportConfig({ mathFontSize: 15.4 }).mathFontSize, 15.5);
});

test('original GPT regression still has 56 editable formulas and intact table', async () => {
    const markdown = await readFile(new URL('./fixtures/gpt-coordinate-triangle.md', import.meta.url), 'utf8');
    const { document } = await unpackDocx(await api.generateDocx(markdown));
    assert.equal(elements(document, 'm:oMath').length, 56);
    assert.equal(elements(document, 'm:oMathPara').length, 13);
    assert.equal(elements(document, 'w:tr').length, 6);
    assert.doesNotMatch(document.documentElement.textContent, /Error:|\\_/);
});
