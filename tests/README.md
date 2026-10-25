# Markdown / native Word compatibility checks

Run `pnpm test` for the shared TypeScript normalizer and the actual ReactMarkdown/remark/KaTeX preview pipeline.

For browser and native Word structure checks, run `pnpm dev`, then open `/tests/browser-compat.html`. The page uses the full reported GPT sample and the production `generateDocx` implementation. It checks 56 editable formulas, 13 display equations, aligned/cases rows, fractions, radicals, subscripts, fill-in blanks and the comparison table. It also provides the generated DOCX for visual review in Word.

The test page and fixture are development files; Vite's production build includes only the application entry point.
