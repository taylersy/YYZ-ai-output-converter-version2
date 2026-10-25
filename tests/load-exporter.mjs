import { build } from 'esbuild';
import { DOMParser } from 'linkedom';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const JSZip = createRequire(require.resolve('docx'))('jszip');

export async function loadExporter() {
    globalThis.DOMParser = DOMParser;
    const cache = fileURLToPath(new URL('../node_modules/.tmp/', import.meta.url));
    await mkdir(cache, { recursive: true });
    const directory = await mkdtemp(cache + 'font-test-');
    const output = directory + '/exporter.mjs';
    await build({ entryPoints: [fileURLToPath(new URL('../src/utils/MarkdownToDocx.ts', import.meta.url))], outfile: output,
        bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent' });
    return { ...await import(pathToFileURL(output)), cleanup: () => rm(directory, { recursive: true, force: true }) };
}

export async function unpackDocx(blob) {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = async name => new DOMParser().parseFromString(await zip.file(name).async('string'), 'text/xml');
    return { zip, document: await xml('word/document.xml'), styles: await xml('word/styles.xml'), settings: await xml('word/settings.xml') };
}

export const elements = (root, name) => Array.from(root.getElementsByTagName(name));
export const children = (root, name) => Array.from(root.children).filter(child => child.tagName === name);
export const child = (root, name) => children(root, name)[0];
export const val = node => node?.getAttribute('w:val') ?? node?.getAttribute('m:val');
