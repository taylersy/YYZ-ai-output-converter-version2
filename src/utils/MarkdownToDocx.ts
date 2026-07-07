import { 
    Document, 
    Packer, 
    Paragraph, 
    TextRun, 
    HeadingLevel, 
    AlignmentType,
    Math as DocxMath,
    Table,
    TableRow,
    TableCell,
    BorderStyle,
    WidthType,
    convertInchesToTwip,
} from "docx";
import { convertLatexToMath, MathParagraph, globalMathConfig } from "./DocxMathConverter";
import { normalizeMarkdown } from "./textUtils";

// Helper to normalize AI/User input for better compatibility


export const FONT_SIZES = [
    { label: '初号 (42pt)', value: 42 },
    { label: '小初 (36pt)', value: 36 },
    { label: '一号 (26pt)', value: 26 },
    { label: '小一 (24pt)', value: 24 },
    { label: '二号 (22pt)', value: 22 },
    { label: '小二 (18pt)', value: 18 },
    { label: '三号 (16pt)', value: 16 },
    { label: '小三 (15pt)', value: 15 },
    { label: '四号 (14pt)', value: 14 },
    { label: '小四 (12pt)', value: 12 },
    { label: '五号 (10.5pt)', value: 10.5 },
    { label: '小五 (9pt)', value: 9 },
];

export interface ExportConfig {
    mainFont: {
        ascii: string;    // English font
        eastAsia: string; // Chinese font
    };
    mathFont: string;     // Math font (e.g. Times New Roman, Cambria Math)
    mathFontSize: number; // Math font size
    lineSpacing: number; // Multiplier (e.g., 1.5)
    fontSize: number;    // Point size (e.g., 12)
}

export async function generateDocx(markdown: string, config?: Partial<ExportConfig>): Promise<Blob> {
    const cleanMarkdown = normalizeMarkdown(markdown);
    
    // Default Settings
    const defaultConfig: ExportConfig = {
        mainFont: { ascii: "Times New Roman", eastAsia: "SimSun" },
        mathFont: "Times New Roman",
        mathFontSize: 12,
        lineSpacing: 1.5,
        fontSize: 12
    };
    const finalConfig = { ...defaultConfig, ...config };

    // Set global math config for DocxMathConverter
    globalMathConfig.fontName = finalConfig.mathFont;
    globalMathConfig.fontSize = finalConfig.mathFontSize;

    // 240 twips = 1 line (single spacing). But in docx, line rule "auto" takes 240 as 100% (1 line).
    // Actually, "auto" means 240 = 1 line. So 360 = 1.5 lines.
    const lineSpacingTwips = Math.round(finalConfig.lineSpacing * 240);
    const fontSizeHalfPoints = Math.round(finalConfig.fontSize * 2);
    
    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: {
                        font: {
                            ascii: finalConfig.mainFont.ascii,
                            eastAsia: finalConfig.mainFont.eastAsia,
                        },
                        size: fontSizeHalfPoints,
                        color: "000000",
                    },
                    paragraph: {
                        spacing: {
                            line: lineSpacingTwips,
                            lineRule: "auto",
                        },
                    },
                },
            },
            paragraphStyles: [
                {
                    id: "Heading1",
                    name: "Heading 1",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        font: {
                            ascii: finalConfig.mainFont.ascii,
                            eastAsia: finalConfig.mainFont.eastAsia,
                        },
                        size: 32, // 16pt - Keep headings larger/fixed or relative? User asked for "正文" customization.
                        // Usually headings should match the font family but have their own sizes.
                        // I will respect the requested font family for headings too, but keep sizes fixed as per previous "perfect" version logic unless asked otherwise.
                        // However, user said "customize body text". But usually font family applies globally.
                        // Let's apply the font family to headings too for consistency, but keep sizes fixed.
                        bold: true,
                        italics: false,
                        color: "000000",
                    },
                    paragraph: {
                        spacing: {
                            before: 240,
                            after: 120,
                        },
                    },
                },
                {
                    id: "Heading2",
                    name: "Heading 2",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        font: {
                            ascii: finalConfig.mainFont.ascii,
                            eastAsia: finalConfig.mainFont.eastAsia,
                        },
                        size: 28, // 14pt
                        bold: true,
                        italics: false,
                        color: "000000",
                    },
                    paragraph: {
                        spacing: {
                            before: 240,
                            after: 120,
                        },
                    },
                },
                {
                    id: "Heading3",
                    name: "Heading 3",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        font: {
                            ascii: finalConfig.mainFont.ascii,
                            eastAsia: finalConfig.mainFont.eastAsia,
                        },
                        size: 24, // 12pt
                        bold: true,
                        italics: false,
                        color: "000000",
                    },
                    paragraph: {
                        spacing: {
                            before: 240,
                            after: 120,
                        },
                    },
                },
                {
                    id: "Heading4",
                    name: "Heading 4",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        font: {
                            ascii: finalConfig.mainFont.ascii,
                            eastAsia: finalConfig.mainFont.eastAsia,
                        },
                        size: 24, // 12pt
                        bold: true,
                        italics: false,
                        color: "000000",
                    },
                    paragraph: {
                        spacing: {
                            before: 240,
                            after: 120,
                        },
                    },
                },
                {
                    id: "Heading5",
                    name: "Heading 5",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        font: {
                            ascii: finalConfig.mainFont.ascii,
                            eastAsia: finalConfig.mainFont.eastAsia,
                        },
                        size: 24, // 12pt
                        bold: true,
                        italics: false,
                        color: "000000",
                    },
                    paragraph: {
                        spacing: {
                            before: 240,
                            after: 120,
                        },
                    },
                },
                {
                    id: "Heading6",
                    name: "Heading 6",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        font: {
                            ascii: finalConfig.mainFont.ascii,
                            eastAsia: finalConfig.mainFont.eastAsia,
                        },
                        size: 24, // 12pt
                        bold: true,
                        italics: false,
                        color: "000000",
                    },
                    paragraph: {
                        spacing: {
                            before: 240,
                            after: 120,
                        },
                    },
                },
            ],
        },
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: convertInchesToTwip(1),
                        bottom: convertInchesToTwip(1),
                        left: convertInchesToTwip(1.25),
                        right: convertInchesToTwip(1.25),
                    }
                }
            },
            children: parseMarkdown(cleanMarkdown, finalConfig),
        }],
    });

    return await Packer.toBlob(doc);
}

function parseMarkdown(markdown: string, config: ExportConfig): any[] {
    const lines = markdown.split('\n');
    const children: any[] = [];
    let currentParagraphLines: string[] = [];

    const createParagraph = (lines: string[], options: { 
        headingLevel?: any, 
        alignment?: any,
        bold?: boolean,
        italic?: boolean,
    } = {}) => {
        const text = lines.join(' ');
        if (!text.trim()) return null;

        const inlineOptions: any = {};
        if (options.bold !== undefined) inlineOptions.bold = options.bold;
        if (options.italic !== undefined) inlineOptions.italics = options.italic;
        
        // Use config for font and size
        inlineOptions.font = {
            ascii: config.mainFont.ascii,
            eastAsia: config.mainFont.eastAsia
        };
        inlineOptions.size = Math.round(config.fontSize * 2);

        const paragraphOptions: any = {
            children: parseInline(text, inlineOptions),
            heading: options.headingLevel
        };

        // Explicitly set line spacing from config
        paragraphOptions.spacing = {
            line: Math.round(config.lineSpacing * 240),
            lineRule: "auto"
        };

        if (options.alignment) {
            paragraphOptions.alignment = options.alignment;
        }

        return new Paragraph(paragraphOptions);
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // --- Heading Detection (Standard Markdown #) ---
        const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
        if (headingMatch) {
            if (currentParagraphLines.length > 0) {
                const p = createParagraph(currentParagraphLines);
                if (p) children.push(p);
                currentParagraphLines = [];
            }
            const level = headingMatch[1].length;
            const content = headingMatch[2];
            const headingLevel = [
                HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
                HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6
            ][level - 1];

            children.push(createParagraph([content], { headingLevel }));
            continue;
        }

        // --- Table Detection ---
        if (trimmedLine.startsWith('|')) {
            if (currentParagraphLines.length > 0) {
                const p = createParagraph(currentParagraphLines);
                if (p) children.push(p);
                currentParagraphLines = [];
            }
            
            // Collect all table lines
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i].trim());
                i++;
            }
            i--; // Adjust index back

            if (tableLines.length >= 2) {
                children.push(createTable(tableLines, config));
            }
            continue;
        }

        // --- Block Math Detection ---
        if (trimmedLine.startsWith('$$')) {
            if (currentParagraphLines.length > 0) {
                const p = createParagraph(currentParagraphLines);
                if (p) children.push(p);
                currentParagraphLines = [];
            }

            let mathContent = "";
            if (trimmedLine === '$$') {
                i++;
                while (i < lines.length && lines[i].trim() !== '$$') {
                    mathContent += lines[i] + "\n";
                    i++;
                }
            } else {
                const singleLineMatch = trimmedLine.match(/^\$\$(.*)\$\$$/);
                if (singleLineMatch) {
                    mathContent = singleLineMatch[1];
                }
            }

            if (mathContent.trim()) {
                const mathNodes = convertLatexToMath(mathContent.trim(), true);
                
                // We must use m:oMathPara for block math to ensure compatibility with WPS Office
                // and strict OMML parsers.
                
                children.push(new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new MathParagraph(mathNodes)],
                    spacing: { before: 240, after: 240 }
                }));
            }
            continue;
        }

        // --- List Item Detection ---
        const listMatch = trimmedLine.match(/^(\*|-|\d+\.)\s+(.*)/);
        if (listMatch) {
            if (currentParagraphLines.length > 0) {
                const p = createParagraph(currentParagraphLines);
                if (p) children.push(p);
                currentParagraphLines = [];
            }
            const marker = listMatch[1];
            const content = listMatch[2];
            
            if (marker.match(/^\d+\.$/)) {
                // Numbered list - output as text for simplicity in this version
                 const p = createParagraph([`${marker} ${content}`]);
                 if (p) children.push(p);
            } else {
                // Bullet list
                const inlineOptions: any = {
                    font: {
                        ascii: config.mainFont.ascii,
                        eastAsia: config.mainFont.eastAsia
                    },
                    size: Math.round(config.fontSize * 2)
                };

                children.push(new Paragraph({
                    children: parseInline(content, inlineOptions),
                    bullet: { level: 0 },
                    spacing: {
                        line: Math.round(config.lineSpacing * 240),
                        lineRule: "auto"
                    }
                }));
            }
            continue;
        }

        // --- Regular Paragraph ---
        if (trimmedLine === '') {
            if (currentParagraphLines.length > 0) {
                const p = createParagraph(currentParagraphLines);
                if (p) children.push(p);
                currentParagraphLines = [];
            }
        } else {
            currentParagraphLines.push(line);
        }
    }

    if (currentParagraphLines.length > 0) {
        const p = createParagraph(currentParagraphLines);
        if (p) children.push(p);
    }

    return children;
}

function createTable(tableLines: string[], config: ExportConfig) {
    const rows: TableRow[] = [];
    
    // Parse header and body
    // tableLines[0] is header
    // tableLines[1] is separator (skip)
    // tableLines[2+] is body

    const processLine = (line: string) => {
        // Split by | but handle escaped \| or math context
        // This is tricky. For now, simple split is flawed if math contains |
        // Better: use regex or character scan.
        // Quick fix: replace \| with placeholder, split, then restore?
        // But $...|...$ inside math is also a problem.
        
        const cells: string[] = [];
        let currentCell = "";
        let inMath = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '$') {
                inMath = !inMath;
                currentCell += char;
            } else if (char === '|' && !inMath) {
                cells.push(currentCell.trim());
                currentCell = "";
            } else {
                currentCell += char;
            }
        }
        cells.push(currentCell.trim()); // Last part
        
        if (cells[0] === '') cells.shift();
        if (cells[cells.length - 1] === '') cells.pop();
        return cells;
    };

    const fontOptions = {
        font: config.mainFont,
        size: Math.round(config.fontSize * 2)
    };

    if (tableLines.length > 0) {
        // Header
        const headerCells = processLine(tableLines[0]);
        rows.push(new TableRow({
            children: headerCells.map(text => {
                return new TableCell({
                    children: [new Paragraph({
                        children: parseInline(text, { bold: true, ...fontOptions }),
                        alignment: AlignmentType.CENTER
                    })],
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 12, color: "000000" }, // Thick top
                        bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" }, // Thin bottom
                        left: { style: BorderStyle.NIL, size: 0, color: "auto" },
                        right: { style: BorderStyle.NIL, size: 0, color: "auto" },
                    },
                    width: { size: 100 / headerCells.length, type: WidthType.PERCENTAGE }
                });
            })
        }));
    }

    // Body
    for (let i = 2; i < tableLines.length; i++) {
        const bodyCells = processLine(tableLines[i]);
        rows.push(new TableRow({
            children: bodyCells.map(text => new TableCell({
                children: [new Paragraph({
                    children: parseInline(text, fontOptions),
                    alignment: AlignmentType.CENTER
                })],
                borders: {
                    top: { style: BorderStyle.NIL, size: 0, color: "auto" },
                    bottom: i === tableLines.length - 1 
                        ? { style: BorderStyle.SINGLE, size: 12, color: "000000" } // Thick bottom for last row
                        : { style: BorderStyle.NIL, size: 0, color: "auto" },
                    left: { style: BorderStyle.NIL, size: 0, color: "auto" },
                    right: { style: BorderStyle.NIL, size: 0, color: "auto" },
                },
                width: { size: 100 / bodyCells.length, type: WidthType.PERCENTAGE }
            }))
        }));
    }

    return new Table({
        rows: rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            insideHorizontal: { style: BorderStyle.NIL, size: 0, color: "auto" },
            insideVertical: { style: BorderStyle.NIL, size: 0, color: "auto" },
        }
    });
}

function parseInline(text: string, options: { 
    bold?: boolean,
    italics?: boolean,
    size?: number,
    font?: { ascii: string, eastAsia: string }
} = {}): (TextRun | DocxMath)[] {
    const parts: (TextRun | DocxMath)[] = [];
    const regex = /(\*\*.*?\*\*|\*.*?\*|\$[^\$]+\$|<br\s*\/?>)/g;
    
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
            parts.push(new TextRun({ 
                text: text.slice(lastIndex, match.index),
                bold: options.bold,
                italics: options.italics,
                size: options.size,
                font: options.font
            }));
        }
        
        const part = match[0];
        if (part.startsWith('**')) {
            // Found bold marker. Recurse into content with bold=true
            const innerContent = part.slice(2, -2);
            // Preserve other options (size, font) and set bold=true
            const innerParts = parseInline(innerContent, { ...options, bold: true });
            parts.push(...innerParts);
        } else if (part.startsWith('*')) {
            // Found italic marker. Recurse into content with italics=true
            const innerContent = part.slice(1, -1);
            const innerParts = parseInline(innerContent, { ...options, italics: true });
            parts.push(...innerParts);
        } else if (part.startsWith('$')) {
            const latex = part.slice(1, -1);
            if (latex.trim() === "") {
                 // Empty math, ignore
            } else {
                const mathNodes = convertLatexToMath(latex, false);
                parts.push(new DocxMath({ children: mathNodes }));
            }
        } else if (part.match(/^<br\s*\/?>$/)) {
            parts.push(new TextRun({ break: 1 }));
        }
        
        lastIndex = regex.lastIndex;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(new TextRun({ 
            text: text.slice(lastIndex),
            bold: options.bold,
            italics: options.italics,
            size: options.size,
            font: options.font
        }));
    }
    
    return parts;
}
