# Markdown / native Word compatibility checks

Run `pnpm test` for the shared TypeScript normalizer and the actual ReactMarkdown/remark/KaTeX preview pipeline.

For browser and native Word structure checks, run `pnpm dev`, then open `/tests/browser-compat.html`. The page uses the full reported GPT sample and the production `generateDocx` implementation. It checks 56 editable formulas, 13 display equations, aligned/cases rows, fractions, radicals, subscripts, fill-in blanks and the comparison table. It also provides the generated DOCX for visual review in Word.

The test page and fixture are development files; Vite's production build includes only the application entry point.

Font regressions also exercise the real DOCX exporter in Node via a test-only DOM parser. Run `EXPORT_FONT_QA_DIR=/private/tmp/ai-converter-font-qa npm test` to write 12pt and 18pt Times New Roman samples with independent 10.5pt body text. Check the actual typeface and size in Word; LibreOffice can substitute its own math typeface and base size, so its PDF alone is not proof of Word font fidelity.
