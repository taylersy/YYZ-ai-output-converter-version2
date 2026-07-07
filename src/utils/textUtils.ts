export function normalizeMarkdown(markdown: string): string {
    if (!markdown) return "";
    
    // Normalize line endings
    let normalized = markdown.replace(/\r\n/g, '\n');

    // --- NEW: Auto-fix common AI LaTeX escaping errors ---
    // 1. Fix \left{ and \right} without escaped braces
    normalized = normalized.replace(/\\left\{/g, '\\left\\{');
    normalized = normalized.replace(/\\right\}/g, '\\right\\}');
    
    // 2. Fix single backslash at the end of a line (e.g. `x=1,\`) which was meant to be `\\`
    normalized = normalized.replace(/([^\\])\\[ \t]*\n/g, '$1\\\\\n');
    // ---------------------------------------------------

    // 0. Mobile compatibility: Convert full-width chars to half-width
    normalized = normalized.replace(/[\uff01-\uff5e]/g, function(ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
    }).replace(/\u3000/g, ' ');

    // 1. Convert LaTeX-style inline math \( ... \) to $ ... $
    normalized = normalized.replace(/\\\([\s\S]*?\\\)/g, (match) => {
        // Replace inner newlines with space to keep it inline, or just wrap with $
        return '$' + match.slice(2, -2) + '$';
    });

    // 2. Convert LaTeX-style display math \[ ... \] to $$ ... $$
    normalized = normalized.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');

    // 3. Convert bare [ ... ] on newlines to $$ ... $$ and fix Setext artifacts
    normalized = normalized.replace(/^[ \t]*\[\n([\s\S]*?)\n[ \t]*\]/gm, (_, p1) => {
        const fixedMath = p1.replace(/^={2,}\s*$/gm, '=').replace(/^-{2,}\s*$/gm, '-');
        return '$$\n' + fixedMath + '\n$$';
    });

    // 4. Line-by-line robust parsing & auto-wrapping
    const lines = normalized.split('\n');
    const resultLines: string[] = [];
    let inMathBlock = false;
    let inCodeBlock = false;
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let trimmed = line.trim();
        
        if (trimmed.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            resultLines.push(line);
            continue;
        }
        
        if (trimmed === '$$') {
            inMathBlock = !inMathBlock;
            resultLines.push(line);
            continue;
        }
        
        // Skip existing inline blocks that take up whole line
        if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
            resultLines.push(line);
            continue;
        }
        
        // If we are already inside a valid block, just copy the line
        if (inCodeBlock || inMathBlock) {
            resultLines.push(line);
            continue;
        }
        
        // Ignore empty lines
        if (!trimmed) {
            resultLines.push(line);
            continue;
        }
        
        // Is it a bare \begin{...}?
        if (trimmed.startsWith('\\begin{')) {
            const envMatch = trimmed.match(/^\\begin{([a-zA-Z*]+)}/);
            const envName = envMatch ? envMatch[1] : "";
            
            resultLines.push('$$'); // Wrap start
            resultLines.push(line);
            
            // Slurp until \end{...}
            if (!trimmed.includes(`\\end{${envName}}`)) {
                i++;
                while (i < lines.length) {
                    const innerLine = lines[i];
                    resultLines.push(innerLine);
                    if (innerLine.trim().includes(`\\end{${envName}}`)) {
                        break;
                    }
                    i++;
                }
            }
            resultLines.push('$$'); // Wrap end
            continue;
        }
        
        // Reject lines that already contain explicit math delimiters to prevent double-wrapping
        if (trimmed.includes('$')) {
            resultLines.push(line);
            continue;
        }

        // Is it a bare heuristic math line?
        // Reject standard markdown features
        if (/^(#|\*|-|\d+\.|\||>)/.test(trimmed)) {
            resultLines.push(line);
            continue;
        }
        // Reject lines with Chinese
        if (/[\u4e00-\u9fa5]/.test(trimmed)) {
            resultLines.push(line);
            continue;
        }
        
        const mathPattern = /(\\frac|\\sum|\\int|\\lim|\\Delta|\\alpha|\\beta|\\gamma|\\theta|\\pm|\\ne|\\approx|\\le|\\ge|\^|_|\\sqrt|\\times|\\div|=.*=)/;
        const eqPattern = /^[a-zA-Z]\([a-zA-Z]\)\s*=/;
        const arrayPattern = /^&?=/;
        
        if (mathPattern.test(trimmed) || eqPattern.test(trimmed) || arrayPattern.test(trimmed)) {
            resultLines.push('$$');
            resultLines.push(line);
            resultLines.push('$$');
            continue;
        }
        
        resultLines.push(line);
    }
    
    normalized = resultLines.join('\n');
    
    // 5. Merge adjacent $$ blocks (e.g. $$ \n $$ or $$ \n\n $$)
    // This flawlessly heals equations that were split by heuristic vs \begin wrappers!
    normalized = normalized.replace(/\$\$\n*\$\$/g, '\n');

    // Clean up any empty math blocks left over
    normalized = normalized.replace(/\$\$\s*\$\$/g, '');

    // Ensure $$ ... $$ display math is properly spaced with newlines for ReactMarkdown
    normalized = normalized.replace(/\$\$([\s\S]*?)\$\$/g, (_, content) => {
        return `\n\n$$\n${content.trim()}\n$$\n\n`;
    });
    
    // Clean up excessive newlines
    normalized = normalized.replace(/\n{3,}/g, '\n\n');

    // 6. Fix for "math treated as code block due to indentation"
    normalized = normalized.replace(/^( +|\t+)(?=.*\$)/gm, (match) => {
        if (match.includes('\t') || match.length >= 4) {
             return match.replace(/ /g, '\u00A0').replace(/\t/g, '\u00A0\u00A0\u00A0\u00A0');
        }
        return match;
    });

    return normalized.trim();
}
