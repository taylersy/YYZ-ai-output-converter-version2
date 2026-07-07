import {
    MathRun,
    MathFraction,
    MathSuperScript,
    MathSubScript,
    MathSubSuperScript,
    MathRadical,
    MathLimitUpper,
    MathLimitLower,
    XmlComponent,
    XmlAttributeComponent
} from "docx";
import katex from "katex";

// --- Constants ---
// const STOP_CHARS = ["=", "<", ">", "\u2264", "\u2265", "\u2248", "\u2192", ","];

export const globalMathConfig = {
    fontName: "Cambria Math",
    fontSize: 12
};

class ExtendedMathRun extends XmlComponent {
    public readonly textContent: string;
    public readonly isOperator: boolean;
    constructor(text: string, isOperator: boolean = false, isNormalText: boolean = false) {
        super("m:r");
        this.textContent = text;
        this.isOperator = isOperator;

        const wRPr = new GenericXmlComponent("w:rPr");
        
        const fonts = new GenericXmlComponent("w:rFonts");
        fonts.addChild({
            _attr: {
                "w:ascii": globalMathConfig.fontName,
                "w:hAnsi": globalMathConfig.fontName,
                "w:cs": globalMathConfig.fontName,
                "w:eastAsia": globalMathConfig.fontName
            }
        });
        wRPr.addChild(fonts);

        const szVal = Math.round(globalMathConfig.fontSize * 2).toString();
        const sz = new GenericXmlComponent("w:sz");
        sz.addChild({ _attr: { "w:val": szVal } });
        const szCs = new GenericXmlComponent("w:szCs");
        szCs.addChild({ _attr: { "w:val": szVal } });
        wRPr.addChild(sz);
        wRPr.addChild(szCs);

        if (isNormalText) {
            const iOff = new GenericXmlComponent("w:i");
            iOff.addChild({ _attr: { "w:val": "0" } });
            wRPr.addChild(iOff);
        } else if (!isOperator && text.length === 1 && /[a-zA-Z]/.test(text)) {
            wRPr.addChild(new GenericXmlComponent("w:i"));
        }

        // w:rPr is a direct child of m:r in OMML!
        this.root.push(wRPr);

        if (isNormalText) {
            const mRPr = new GenericXmlComponent("m:rPr");
            mRPr.addChild(new GenericXmlComponent("m:nor"));
            this.root.push(mRPr);
        }

        const t = new GenericXmlComponent("m:t");
        t.addChild({ _attr: { "xml:space": "preserve" } });
        t.addChild(text);
        this.root.push(t);
    }
}

function applyCtrlPr(component: any, propTagName: string) {
    const ctrlPr = new GenericXmlComponent("m:ctrlPr");
    const rPr = new GenericXmlComponent("w:rPr");
    
    const fonts = new GenericXmlComponent("w:rFonts");
    fonts.addChild({
        _attr: {
            "w:ascii": globalMathConfig.fontName,
            "w:hAnsi": globalMathConfig.fontName,
            "w:cs": globalMathConfig.fontName,
            "w:eastAsia": globalMathConfig.fontName
        }
    });
    rPr.addChild(fonts);

    const szVal = Math.round(globalMathConfig.fontSize * 2).toString();
    const sz = new GenericXmlComponent("w:sz");
    sz.addChild({ _attr: { "w:val": szVal } });
    const szCs = new GenericXmlComponent("w:szCs");
    szCs.addChild({ _attr: { "w:val": szVal } });
    rPr.addChild(sz);
    rPr.addChild(szCs);

    ctrlPr.addChild(rPr);

    const root = component.root;
    if (root && Array.isArray(root)) {
        let propNode = root.find((child: any) => child.rootKey === propTagName);
        if (!propNode) {
            propNode = new GenericXmlComponent(propTagName);
            root.unshift(propNode);
        }
        propNode.addChild ? propNode.addChild(ctrlPr) : propNode.root.push(ctrlPr);
    }
    return component;
}

class MathValAttribute extends XmlAttributeComponent<{ val: string }> {
    protected readonly xmlKeys = { val: "m:val" };
}

class GenericXmlComponent extends XmlComponent {
    constructor(rootKey: string) {
        super(rootKey);
    }
    
    public addChild(child: any) {
        this.root.push(child);
    }

    public clear() {
        this.root.length = 0;
    }

    public getLastChild(): any {
        return this.root.length > 0 ? this.root[this.root.length - 1] : null;
    }
}

class MathAccentChar extends XmlComponent {
    constructor(val: string) {
        super("m:chr");
        this.root.push(new MathValAttribute({ val }));
    }
}

class MathAccentProperties extends XmlComponent {
    constructor(accent: string) {
        super("m:accPr");
        this.root.push(new MathAccentChar(accent));
    }
}

class MathElement extends XmlComponent {
    constructor(children: any[]) {
        super("m:e");
        children.forEach(child => this.root.push(child));
    }
}

export class MathAccent extends XmlComponent {
    constructor(options: { children: any[], accent: string }) {
        super("m:acc");
        this.root.push(new MathAccentProperties(options.accent));
        this.root.push(new MathElement(options.children));
    }
}

class MathMatrixProperties extends XmlComponent {
    constructor() {
        super("m:mPr");
        // Define matrix column properties (m:mcs) to ensure correct spacing and alignment
        // <m:mcs>
        //   <m:mc>
        //     <m:mcPr>
        //       <m:count m:val="1"/>
        //       <m:mcJc m:val="center"/>
        //     </m:mcPr>
        //   </m:mc>
        const mcs = new GenericXmlComponent("m:mcs");
        const mc = new GenericXmlComponent("m:mc");
        const mcPr = new GenericXmlComponent("m:mcPr");
        
        const count = new GenericXmlComponent("m:count");
        count.addChild(new MathValAttribute({ val: "1" }));
        
        const jc = new GenericXmlComponent("m:mcJc");
        jc.addChild(new MathValAttribute({ val: "center" }));
        
        mcPr.addChild(count);
        mcPr.addChild(jc);
        mc.addChild(mcPr);
        mcs.addChild(mc);
        
        this.root.push(mcs);
    }
}

class MathMatrixRow extends XmlComponent {
    constructor(children: MathElement[]) {
        super("m:mr");
        children.forEach(child => this.root.push(child));
    }
}

class MathMatrix extends XmlComponent {
    constructor(rows: MathMatrixRow[]) {
        super("m:m");
        this.root.push(new MathMatrixProperties());
        rows.forEach(row => this.root.push(row));
        applyCtrlPr(this, "m:mPr");
    }
}

class MathEqArr extends XmlComponent {
    constructor(rows: MathEqArrRow[]) {
        super("m:eqArr");
        rows.forEach(row => this.root.push(row));
        applyCtrlPr(this, "m:eqArrPr");
    }
}

class MathEqArrRow extends XmlComponent {
    constructor(children: any[]) {
        super("m:e");
        children.forEach(child => this.root.push(child));
    }
}

// --- N-ary Operator Support (Integrals, Sums, Products) ---

class MathNaryProperties extends XmlComponent {
    constructor(chr: string, limitLocation?: "subSup" | "undOvr") {
        super("m:naryPr");
        this.root.push(new MathAccentChar(chr));
        
        if (limitLocation) {
            const limLoc = new GenericXmlComponent("m:limLoc");
            limLoc.addChild(new MathValAttribute({ val: limitLocation }));
            this.root.push(limLoc);
        }
    }
}

class MathNary extends XmlComponent {
    private element: GenericXmlComponent;
    private hasContent: boolean = false;

    constructor(options: {
        char: string,
        limitLocation?: "subSup" | "undOvr",
        subScript?: any[],
        superScript?: any[],
        children?: any[]
    }) {
        super("m:nary");
        this.root.push(new MathNaryProperties(options.char, options.limitLocation));
        
        const sub = new GenericXmlComponent("m:sub");
        if (options.subScript) {
            options.subScript.forEach(child => sub.addChild(child));
        }
        this.root.push(sub);

        const sup = new GenericXmlComponent("m:sup");
        if (options.superScript) {
            options.superScript.forEach(child => sup.addChild(child));
        }
        this.root.push(sup);

        this.element = new GenericXmlComponent("m:e");
        if (options.children && options.children.length > 0) {
            options.children.forEach(child => this.element.addChild(child));
            this.hasContent = true;
        } else {
            this.element.addChild(new MathRun("\u200B"));
            this.hasContent = false;
        }
        this.root.push(this.element);
        applyCtrlPr(this, "m:naryPr");
    }

    public appendChildToBody(child: any) {
        if (!this.hasContent) {
            this.element.clear();
            this.hasContent = true;
        }
        this.element.addChild(child);
    }
}

// --- Delimiter Support (Fences) ---

class MathDelimiterShape extends XmlAttributeComponent<{ val: string }> {
    protected readonly xmlKeys = { val: "m:val" };
}

class MathDelimiterChar extends XmlComponent {
    constructor(tagName: string, val: string) {
        super(tagName);
        this.root.push(new MathDelimiterShape({ val }));
    }
}

class MathDelimiterProperties extends XmlComponent {
    constructor(begChr: string, endChr: string) {
        super("m:dPr");
        this.root.push(new MathDelimiterChar("m:begChr", begChr));
        this.root.push(new MathDelimiterChar("m:endChr", endChr));
    }
}

class MathDelimiter extends XmlComponent {
    constructor(children: any[], begChr: string = "(", endChr: string = ")") {
        super("m:d");
        this.root.push(new MathDelimiterProperties(begChr, endChr));
        this.root.push(new MathElement(children));
        applyCtrlPr(this, "m:dPr");
    }
}

export class MathParagraph extends XmlComponent {
    constructor(children: any[]) {
        super("m:oMathPara");
        const oMath = new GenericXmlComponent("m:oMath");
        children.forEach(child => oMath.addChild(child));
        this.root.push(oMath);
    }
}

// --- Converter Logic ---

const parser = new DOMParser();

export function mathmlToDocx(mathml: string): any[] {
    const doc = parser.parseFromString(mathml, "text/xml");
    const errorNode = doc.querySelector("parsererror");
    if (errorNode) {
        console.error("MathML parsing error", errorNode);
        return [];
    }
    
    const mathNode = doc.querySelector("math");
    if (!mathNode) return [];

    const semantics = mathNode.querySelector("semantics");
    let root: Element = semantics ? semantics : mathNode;
    
    if (semantics) {
        const annotation = semantics.querySelector("annotation");
        if (annotation) annotation.remove(); 
        root = semantics.firstElementChild || semantics;
    }

    return walkNode(root);
}

function walkNode(node: Element | null): any[] {
    if (!node) return [];
    
    if (!node.tagName) return [];

    const tagName = node.tagName.toLowerCase();
    const children = Array.from(node.children);

    switch (tagName) {
        case "math":
        case "mstyle":
            return walkChildren(children);

        case "mrow": {
            const result: any[] = [];
            let stack: { startNode: Element, children: any[], openChar: string }[] = [];

            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                const isChildFence = isFence(child);
                
                if (isChildFence) {
                    const char = child.textContent || "";
                    const isOpener = ['(', '[', '{', '\u27E8', '\u2016'].includes(char) || char === 'l';
                    const isCloser = [')', ']', '}', '\u27E9'].includes(char);
                    const isAmbiguous = ['|', '\u2016', '.', '\u2223'].includes(char);
                    
                    let action = 'text';
                    
                    if (isOpener) action = 'open';
                    else if (isCloser) action = 'close';
                    else if (isAmbiguous) {
                        if (stack.length > 0 && stack[stack.length - 1].openChar === char) {
                            action = 'close';
                        } else {
                            action = 'open';
                        }
                    }

                    if (action === 'close' && stack.length > 0) {
                        const top = stack[stack.length - 1];
                        if (!isPair(top.openChar, char) && !isAmbiguous) {
                            let found = false;
                            for (let j = stack.length - 1; j >= 0; j--) {
                                if (isPair(stack[j].openChar, char)) {
                                    found = true;
                                    break;
                                }
                            }
                            if (found) {
                                while (stack.length > 0) {
                                    const currentTop = stack[stack.length - 1];
                                    if (isPair(currentTop.openChar, char)) {
                                        break;
                                    } else {
                                        stack.pop();
                                        const delim = new MathDelimiter(
                                            walkChildren(currentTop.children), 
                                            normalizeFence(currentTop.openChar), 
                                            ""
                                        );
                                        if (stack.length > 0) {
                                            stack[stack.length - 1].children.push(delim);
                                        } else {
                                            result.push(delim);
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (action === 'open') {
                        stack.push({ startNode: child, children: [], openChar: char });
                    } else if (action === 'close') {
                        if (stack.length > 0) {
                            const top = stack.pop()!;
                            const delim = new MathDelimiter(
                                walkChildren(top.children), 
                                normalizeFence(top.openChar), 
                                normalizeFence(char)
                            );
                            
                            if (stack.length > 0) {
                                stack[stack.length - 1].children.push(delim);
                            } else {
                                result.push(delim);
                            }
                        } else {
                             result.push(...walkNode(child));
                        }
                    } else {
                         result.push(...walkNode(child));
                    }

                } else {
                    if (stack.length > 0) {
                        stack[stack.length - 1].children.push(child);
                    } else {
                        result.push(...walkNode(child));
                    }
                }
            }

            while (stack.length > 0) {
                const top = stack.pop()!;
                const delim = new MathDelimiter(
                    walkChildren(top.children), 
                    normalizeFence(top.openChar), 
                    ""
                );
                if (stack.length > 0) {
                    stack[stack.length - 1].children.push(delim);
                } else {
                    result.push(delim);
                }
            }
            return result;
        }
        
        case "mfenced": {
            const open = node.getAttribute("open") || "(";
            const close = node.getAttribute("close") || ")";
            return [new MathDelimiter(walkChildren(children), open, close)];
        }

        case "mi": {
            const text = node.textContent || "";
            return [new ExtendedMathRun(text, false, false)];
        }
        case "mn":
        case "mtext":
        case "ms": {
            const text = node.textContent || "";
            return [new ExtendedMathRun(text, false, true)];
        }

        case "mo": {
            const text = node.textContent || "";
            return [new ExtendedMathRun(text, true, false)];
        }
        
        case "mfrac": {
            const [num, den] = children;
            if (!num || !den) return walkChildren(children);
            return [applyCtrlPr(new MathFraction({
                numerator: walkNode(num),
                denominator: walkNode(den)
            }), "m:fPr")];
        }
        
        case "msup": {
            const [base, sup] = children;
            if (!base || !sup) return walkChildren(children);
            return [applyCtrlPr(new MathSuperScript({
                children: walkNode(base),
                superScript: walkNode(sup)
            }), "m:supPr")];
        }
        
        case "msub": {
            const [base, sub] = children;
            if (!base || !sub) return walkChildren(children);
            return [applyCtrlPr(new MathSubScript({
                children: walkNode(base),
                subScript: walkNode(sub)
            }), "m:subPr")];
        }
        
        case "msubsup": {
            const [base, sub, sup] = children;
            if (!base || !sub || !sup) return walkChildren(children);
            const baseText = extractText(base) || "";
            
            if (isIntegral(baseText) || isSum(baseText)) {
                return [applyCtrlPr(new MathNary({
                    char: baseText,
                    limitLocation: "subSup",
                    subScript: walkNode(sub),
                    superScript: walkNode(sup),
                    children: []
                }), "m:naryPr")];
            }
            return [applyCtrlPr(new MathSubSuperScript({
                children: walkNode(base),
                subScript: walkNode(sub),
                superScript: walkNode(sup)
            }), "m:subSupPr")];
        }
        
        case "msqrt": {
            return [applyCtrlPr(new MathRadical({
                children: walkChildren(children)
            }), "m:radPr")];
        }
        
        case "mroot": {
            const [base, degree] = children;
            if (!base || !degree) return walkChildren(children);
            return [applyCtrlPr(new MathRadical({
                children: walkNode(base),
                degree: walkNode(degree)
            }), "m:radPr")];
        }
        
        case "mover": {
            const [base, over] = children;
            if (!base || !over) return walkChildren(children);
            
            const isAccent = over.tagName && over.tagName.toLowerCase() === 'mo' && (over.getAttribute('accent') === 'true' || isAccentChar(over.textContent || ""));
            
            if (isAccent) {
                return [applyCtrlPr(new MathAccent({
                    children: walkNode(base),
                    accent: over.textContent || ""
                }), "m:accPr")];
            }
            
            return [applyCtrlPr(new MathLimitUpper({
                children: walkNode(base),
                limit: walkNode(over)
            }), "m:limUppPr")];
        }
        
        case "munder": {
            const [base, under] = children;
            if (!base || !under) return walkChildren(children);
            return [applyCtrlPr(new MathLimitLower({
                children: walkNode(base),
                limit: walkNode(under)
            }), "m:limLowPr")];
        }
        
        case "munderover": {
            const [base, under, over] = children;
            if (!base || !under || !over) return walkChildren(children);
            
            const baseText = extractText(base) || "";
            
            if (isIntegral(baseText) || isSum(baseText)) {
                return [applyCtrlPr(new MathNary({
                    char: baseText,
                    limitLocation: "undOvr",
                    subScript: walkNode(under),
                    superScript: walkNode(over),
                    children: []
                }), "m:naryPr")];
            }
            
            // Generic munderover -> nest LimitLower and LimitUpper
            // munderover(base, under, over) = LimitLower(LimitUpper(base, over), under)
            return [applyCtrlPr(new MathLimitLower({
                children: [applyCtrlPr(new MathLimitUpper({
                    children: walkNode(base),
                    limit: walkNode(over)
                }), "m:limUppPr")],
                limit: walkNode(under)
            }), "m:limLowPr")];
        }
        
        case "mspace":
             return [new ExtendedMathRun(" ", false)]; // Approximation

        case "mtable": {
            const columnalign = node.getAttribute("columnalign") || "";
            const isAligned = columnalign.includes("right left") || columnalign.includes("left right");

            if (isAligned) {
                const rows = Array.from(children).map(child => {
                    if (child.tagName && child.tagName.toLowerCase() === "mtr") {
                        const rowChildren: any[] = [];
                        const cells = Array.from(child.children);
                        for (let i = 0; i < cells.length; i++) {
                            const cell = cells[i];
                            if (cell.tagName && cell.tagName.toLowerCase() === "mtd") {
                                const cellContent = walkNode(cell);
                                rowChildren.push(...cellContent);
                                
                                // Insert <m:aln/> after odd columns (0-indexed: i % 2 === 0)
                                // except if it's the last column
                                if (i % 2 === 0 && i < cells.length - 1) {
                                    rowChildren.push(new GenericXmlComponent("m:aln"));
                                }
                            }
                        }
                        return new MathEqArrRow(rowChildren);
                    }
                    return new MathEqArrRow([]);
                });
                return [new MathEqArr(rows)];
            } else {
                const rows = Array.from(children).map(child => {
                    // child should be mtr
                    if (child.tagName && child.tagName.toLowerCase() === "mtr") {
                        const cells = Array.from(child.children).map(cell => {
                            // cell should be mtd
                            if (cell.tagName && cell.tagName.toLowerCase() === "mtd") {
                                let cellChildren = walkNode(cell);
                                if (cellChildren.length === 0) {
                                    cellChildren = [new ExtendedMathRun("\u200B", false)];
                                }
                                return new MathElement(cellChildren);
                            }
                            return new MathElement([new ExtendedMathRun("\u200B", false)]); // Empty cell fallback
                        });
                        return new MathMatrixRow(cells);
                    }
                    return new MathMatrixRow([]); // Empty row fallback
                });
                return [new MathMatrix(rows)];
            }
        }
             
        default:
            // Fallback for unknown tags
            return walkChildren(children);
    }
}

function walkChildren(children: Element[]): any[] {
    let result: any[] = [];
    for (const child of children) {
        result = result.concat(walkNode(child));
    }
    return result;
}

function extractText(node: Element): string {
    return node.textContent || "";
}

function isIntegral(text: string): boolean {
    return /[\u222B\u222C\u222D\u222E\u222F\u2230\u2231\u2232\u2233]/.test(text);
}

function isSum(text: string): boolean {
    // Include Sum (\u2211), Product (\u220F), Coproduct (\u2210) and other N-ary operators
    return /[\u2211\u220F\u2210\u22C0\u22C1\u22C2\u22C3\u2A00\u2A01\u2A02\u2A04\u2A06]/.test(text);
}

function isAccentChar(text: string): boolean {
    // Common accent characters
    const accents = [
        '\u2192', // vector arrow
        '\u005E', // hat ^
        '\u02C6', // hat modifier
        '\u00AF', // bar
        '\u02C9', // bar modifier
        '\u007E', // tilde
        '\u02DC', // tilde modifier
        '\u0300', '\u0301', '\u0302', '\u0303', '\u0304', '\u0305', '\u0306', '\u0307', '\u0308', '\u030A', '\u030C', // combining marks
        '→', '⃗', '^', 'ˉ', '~', '˙', '¨'
    ];
    return accents.includes(text) || text.length === 1 && text.charCodeAt(0) >= 0x300 && text.charCodeAt(0) <= 0x36F;
}

function isFence(node: Element): boolean {
    if (!node.tagName || node.tagName.toLowerCase() !== 'mo') return false;
    
    // Explicit fence attribute from KaTeX
    if (node.getAttribute('fence') === 'true') return true;
    
    // Common fence characters
    const text = node.textContent || "";
    const fenceChars = ['(', ')', '[', ']', '{', '}', '|', '\u2016', '\u27E8', '\u27E9', '.'];
    return fenceChars.includes(text);
}

function isPair(open: string, close: string): boolean {
    if (open === '(' && close === ')') return true;
    if (open === '[' && close === ']') return true;
    if (open === '{' && close === '}') return true;
    if (open === '\u27E8' && close === '\u27E9') return true; // angle brackets
    if (open === '\u2016' && close === '\u2016') return true; // double vert
    // Match | with | (both regular and divides char)
    if ((open === '|' || open === '\u2223') && (close === '|' || close === '\u2223')) return true;
    return false;
}

// Handle "." as empty delimiter
// Also normalize "∣" (0x2223) to "|" (0x007C) for Word compatibility
function normalizeFence(ch: string): string {
    if (ch === ".") return "";
    if (ch.charCodeAt(0) === 0x2223) return "|";
    return ch;
}

export function convertLatexToMath(latex: string, displayMode: boolean = false): any[] {
    try {
        const mathml = katex.renderToString(latex, {
            output: "mathml",
            throwOnError: false,
            displayMode: displayMode
        });
        return mathmlToDocx(mathml);
    } catch (e: any) {
        console.error("KaTeX error", e);
        // Return error message in red to help debugging
        const errorRun = new MathRun(`Error: ${e.message}`);
        // We can't easily set color on MathRun, but the text will be visible.
        return [errorRun];
    }
}
