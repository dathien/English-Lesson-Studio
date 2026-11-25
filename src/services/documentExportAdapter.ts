import DOMPurify from 'dompurify';
import {
  AlignmentType,
  BorderStyle,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
} from 'docx';

/**
 * DocumentExportAdapter
 * Single source of truth for sanitizing, normalizing, parsing, and exporting
 * structured rich-text content across Editor, Renderer, Word DOCX, PDF Print, and PowerPoint PPTX.
 */

export interface RichInlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  color?: string; // hex without # or css color
  highlight?: string; // hex or css bg
  fontFamily?: string;
  fontSizePt?: number;
  linkHref?: string;
}

export interface RichBlock {
  type: 'paragraph' | 'bullet_item' | 'ordered_item' | 'table';
  align?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  runs: RichInlineRun[];
  rows?: Array<Array<{isHeader: boolean; runs: RichInlineRun[]}>>;
}

const SAFE_URL_PROTOCOLS = /^(https?:|mailto:)/i;
const SAFE_IMAGE_SRC = /^(https?:|data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,)/i;
const SAFE_AUDIO_SRC = /^(https?:|data:audio\/(mpeg|mp3|wav|ogg|webm|mp4|x-m4a);base64,)/i;

const ALLOWED_TAGS = [
  'p',
  'br',
  'div',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'strike',
  'sup',
  'sub',
  'mark',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'a',
  'img',
  'audio',
  'h1',
  'h2',
  'h3',
  'h4',
  'blockquote',
];

const ALLOWED_ATTRS = [
  'style',
  'class',
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'title',
  'controls',
  'colspan',
  'rowspan',
  'data-color',
  'data-studio-audio',
  'data-file-name',
];

function sanitizeStyleValue(styleStr: string): string {
  const safeParts: string[] = [];
  const declarations = styleStr.split(';');
  for (const decl of declarations) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = decl.slice(0, colonIdx).trim().toLowerCase();
    const val = decl.slice(colonIdx + 1).trim();
    if (!val || /expression|javascript:|url\(/i.test(val)) continue;

    if (
      prop === 'color' ||
      prop === 'background-color' ||
      prop === 'text-align' ||
      prop === 'font-family' ||
      prop === 'font-size' ||
      prop === 'line-height' ||
      prop === 'text-decoration' ||
      prop === 'font-weight' ||
      prop === 'font-style'
    ) {
      safeParts.push(`${prop}: ${val}`);
    }
  }
  return safeParts.join('; ');
}

function stripOfficeAndUnsafeMarkup(raw: string): string {
  return raw
    // Remove Word conditional comments & XML islands
    .replace(/<!--\[if[\s\S]*?endif\]-->/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<xml[\s\S]*?<\/xml>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<\/?o:p[^>]*>/gi, '')
    .replace(/<\/?w:[^>]*>/gi, '')
    .replace(/<\/?m:[^>]*>/gi, '')
    // Strip inline event handlers
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

/**
 * Sanitizes rich HTML from user paste (Word/PDF/Website) or stored data.
 * Safe in both browser (DOMPurify) and Node.js environments.
 */
export function sanitizeRichHtml(input: string): string {
  if (!input) return '';
  const preCleaned = stripOfficeAndUnsafeMarkup(input);

  // Convert Word inline text-decoration:underline spans to real <u> tags so Tiptap & DOCX keep them cleanly
  const normalizedWordMarks = preCleaned.replace(
    /<span([^>]*style="[^"]*text-decoration\s*:\s*underline[^"]*"[^>]*)>([\s\S]*?)<\/span>/gi,
    '<u>$2</u>',
  );

  if (typeof window !== 'undefined' && DOMPurify && typeof DOMPurify.sanitize === 'function') {
    const clean = DOMPurify.sanitize(normalizedWordMarks, {
      ALLOWED_TAGS,
      ALLOWED_ATTR: ALLOWED_ATTRS,
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['data-color', 'data-studio-audio', 'data-file-name'],
    });
    // Post-filter unsafe href / src / styles via lightweight regex guard
    return clean
      .replace(/href\s*=\s*"([^"]*)"/gi, (_m, url: string) =>
        SAFE_URL_PROTOCOLS.test(url.trim())
          ? `href="${url.trim()}" target="_blank" rel="noopener noreferrer"`
          : '',
      )
      .replace(/<img([^>]*)src\s*=\s*"([^"]*)"([^>]*)>/gi, (m, a, src: string, b) =>
        SAFE_IMAGE_SRC.test(src.trim()) ? m : `<span${a}${b}></span>`,
      )
      .replace(/<audio([^>]*)src\s*=\s*"([^"]*)"([^>]*)>/gi, (m, _a, src: string) =>
        SAFE_AUDIO_SRC.test(src.trim()) ? m : '',
      )
      .replace(/style\s*=\s*"([^"]*)"/gi, (_m, st: string) => {
        const safe = sanitizeStyleValue(st);
        return safe ? `style="${safe}"` : '';
      });
  }

  // Node.js fallback sanitizer (for tests / non-DOM execution)
  return normalizedWordMarks
    .replace(/<(?!\/?(?:p|br|div|span|strong|b|em|i|u|s|del|strike|sup|sub|mark|ul|ol|li|table|thead|tbody|tr|th|td|a|img|audio|h[1-4]|blockquote)\b)[^>]+>/gi, '')
    .replace(/href\s*=\s*"([^"]*)"/gi, (_m, url: string) =>
      SAFE_URL_PROTOCOLS.test(url.trim()) ? `href="${url.trim()}"` : '',
    )
    .replace(/style\s*=\s*"([^"]*)"/gi, (_m, st: string) => {
      const safe = sanitizeStyleValue(st);
      return safe ? `style="${safe}"` : '';
    });
}

/**
 * Automatically converts legacy HTML/Markdown/plain text strings
 * (e.g., `<u>br</u>eadwinner`, `**bold**`, or multi-line plain text)
 * into clean structured rich HTML for Tiptap without losing any data.
 */
export function normalizeLegacyToRichHtml(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';

  // Upgrade legacy **bold** syntax into <strong>...</strong>
  const withBold = input.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');

  // If already contains block HTML tags, just sanitize directly
  if (/<(p|div|ul|ol|table|h[1-4]|blockquote|br)\b/i.test(withBold)) {
    return sanitizeRichHtml(withBold);
  }

  // Otherwise split paragraphs on newline while preserving inline tags like <u>, <strong>, <em>
  const lines = withBold.split(/\r?\n/);
  const html = lines
    .map((line) => `<p>${line || '<br>'}</p>`)
    .join('');
  return sanitizeRichHtml(html);
}

/**
 * For compact single-line fields (like answer options A/B/C/D), unwraps a single
 * outer `<p>...</p>` wrapper so `<u>br</u>eadwinner` stays concise and compatible.
 */
export function compactRichHtmlToInline(html: string): string {
  const clean = sanitizeRichHtml(html).trim();
  if (!clean || clean === '<p></p>' || clean === '<p><br></p>') return '';
  const singlePMatch = clean.match(/^<p(?:\s+style="[^"]*")?>([\s\S]*)<\/p>$/i);
  if (singlePMatch && !/<\/p>\s*<p/i.test(singlePMatch[1])) {
    return singlePMatch[1].replace(/<br\s*\/?>$/i, '').trim();
  }
  return clean;
}

export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Extracts clean plain text from rich HTML (preserving Unicode IPA and line breaks).
 */
export function stripHtmlToPlainText(input: string): string {
  if (!input) return '';
  const withBreaks = input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-4]|blockquote)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/<[^>]+>/g, '');
  return decodeHtmlEntities(withBreaks)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function isRichHtmlEmpty(input: string): boolean {
  if (!input) return true;
  if (/<(img|audio|table)\b/i.test(input)) return false;
  return stripHtmlToPlainText(input).length === 0;
}

/**
 * Joins a legacy or rich-text paragraph array into a single valid HTML string for RichTextEditor.
 */
export function joinParagraphsToRichHtml(paragraphs?: string[]): string {
  if (!paragraphs || paragraphs.length === 0) return '';
  return paragraphs
    .map((p) => {
      const normalized = normalizeLegacyToRichHtml(p).trim();
      if (!normalized) return '';
      if (/^<(p|ul|ol|table|blockquote|h[1-4]|div)\b/i.test(normalized)) {
        return normalized;
      }
      return `<p>${normalized}</p>`;
    })
    .filter(Boolean)
    .join('');
}

/**
 * Splits a RichTextEditor HTML document into top-level block strings (paragraphs, lists, tables)
 * while preserving all inline formatting (bold, italic, underline, IPA, color, highlight).
 */
export function splitRichHtmlToParagraphs(html: string): string[] {
  const clean = sanitizeRichHtml(html).trim();
  if (!clean) return [];

  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(`<div>${clean}</div>`, 'text/html');
      const root = doc.body.firstElementChild;
      if (root) {
        const blocks: string[] = [];
        Array.from(root.childNodes).forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const t = (node.textContent || '').trim();
            if (t) blocks.push(t);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tag = el.tagName.toLowerCase();
            if (tag === 'p' || tag === 'div') {
              const inner = el.innerHTML.replace(/<br\s*\/?>$/i, '').trim();
              if (inner && !isRichHtmlEmpty(inner)) {
                blocks.push(inner);
              }
            } else {
              const outer = el.outerHTML.trim();
              if (outer && !isRichHtmlEmpty(outer)) {
                blocks.push(outer);
              }
            }
          }
        });
        if (blocks.length > 0) return blocks;
      }
    } catch {
      // Fall through to regex splitter
    }
  }

  // Fallback for Node.js or plain text
  const parts = clean
    .replace(/<\/(p|div|blockquote|h[1-4])>/gi, '\n\n')
    .replace(/<(p|div|blockquote|h[1-4])[^>]*>/gi, '')
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => !isRichHtmlEmpty(s));
  return parts;
}

function cssColorToHex(color?: string): string | undefined {
  if (!color) return undefined;
  const c = color.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.slice(1).toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) {
    return (c[1] + c[1] + c[2] + c[2] + c[3] + c[3]).toUpperCase();
  }
  const rgb = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    const toHex = (n: string) =>
      Math.max(0, Math.min(255, Number(n)))
        .toString(16)
        .padStart(2, '0');
    return `${toHex(rgb[1])}${toHex(rgb[2])}${toHex(rgb[3])}`.toUpperCase();
  }
  const named: Record<string, string> = {
    red: 'DC2626',
    blue: '2563EB',
    green: '059669',
    yellow: 'FEF08A',
    orange: 'EA580C',
    purple: '7C3AED',
    black: '0F172A',
    gray: '475569',
  };
  return named[c];
}

function mapHexToDocxHighlight(
  hex?: string,
): 'yellow' | 'green' | 'cyan' | 'magenta' | 'lightGray' | undefined {
  if (!hex) return undefined;
  const h = hex.toUpperCase();
  if (h.startsWith('FE') || h.startsWith('FF') || h.startsWith('FA')) return 'yellow';
  if (h.startsWith('BB') || h.startsWith('D1') || h.startsWith('A7')) return 'green';
  if (h.startsWith('BA') || h.startsWith('BF') || h.startsWith('CF')) return 'cyan';
  if (h.startsWith('F5') || h.startsWith('FB') || h.startsWith('FD')) return 'magenta';
  return 'yellow';
}

function extractAttr(attrs: string, name: string): string | undefined {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const m = attrs.match(re);
  return m ? (m[1] ?? m[2]) : undefined;
}

function parseStyleMap(styleAttr?: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!styleAttr) return map;
  for (const part of styleAttr.split(';')) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim().toLowerCase();
    const v = part.slice(idx + 1).trim();
    if (k && v) map[k] = v;
  }
  return map;
}

/**
 * Pure TypeScript inline HTML tokenizer (works identically in Browser and Node.js).
 * Preserves nested formatting: e.g. `<strong><u>br</u></strong>eadwinner`, `<mark>`, colors, IPA, etc.
 */
export function parseRichInlineRuns(htmlSnippet: string): RichInlineRun[] {
  if (!htmlSnippet) return [];
  const normalized = sanitizeRichHtml(
    htmlSnippet.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>'),
  );

  const runs: RichInlineRun[] = [];
  type StyleFrame = {tag: string; patch: Partial<RichInlineRun>};
  const stack: StyleFrame[] = [];

  const currentStyle = (): Omit<RichInlineRun, 'text'> => {
    const acc: Omit<RichInlineRun, 'text'> = {};
    for (const f of stack) {
      Object.assign(acc, f.patch);
    }
    return acc;
  };

  const tokenRegex = /(<\/?[a-z0-9]+(?:\s+[^>]*)?>)|([^<]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(normalized)) !== null) {
    const tagToken = match[1];
    const textToken = match[2];

    if (textToken) {
      const decoded = decodeHtmlEntities(textToken);
      if (decoded.length > 0) {
        runs.push({text: decoded, ...currentStyle()});
      }
      continue;
    }

    if (tagToken) {
      if (/^<br\b/i.test(tagToken)) {
        runs.push({text: '\n', ...currentStyle()});
        continue;
      }

      const closeMatch = tagToken.match(/^<\/([a-z0-9]+)>/i);
      if (closeMatch) {
        const closeTag = closeMatch[1].toLowerCase();
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].tag === closeTag) {
            stack.splice(i, 1);
            break;
          }
        }
        continue;
      }

      const openMatch = tagToken.match(/^<([a-z0-9]+)([\s\S]*?)\/?>$/i);
      if (!openMatch) continue;
      const tag = openMatch[1].toLowerCase();
      const attrs = openMatch[2] || '';
      if (tag === 'img' || tag === 'audio') continue;

      const styles = parseStyleMap(extractAttr(attrs, 'style'));
      const patch: Partial<RichInlineRun> = {};

      if (tag === 'strong' || tag === 'b' || styles['font-weight'] === 'bold' || Number(styles['font-weight']) >= 600) {
        patch.bold = true;
      }
      if (tag === 'em' || tag === 'i' || styles['font-style'] === 'italic') {
        patch.italic = true;
      }
      if (tag === 'u' || (styles['text-decoration'] && styles['text-decoration'].includes('underline'))) {
        patch.underline = true;
      }
      if (tag === 's' || tag === 'del' || tag === 'strike' || (styles['text-decoration'] && styles['text-decoration'].includes('line-through'))) {
        patch.strike = true;
      }
      if (tag === 'sup') patch.superscript = true;
      if (tag === 'sub') patch.subscript = true;
      if (tag === 'mark') {
        const bg = styles['background-color'] || extractAttr(attrs, 'data-color') || '#FEF08A';
        patch.highlight = cssColorToHex(bg) || 'FEF08A';
      }
      if (styles['color']) {
        const hex = cssColorToHex(styles['color']);
        if (hex) patch.color = hex;
      }
      if (styles['background-color']) {
        const hex = cssColorToHex(styles['background-color']);
        if (hex) patch.highlight = hex;
      }
      if (styles['font-family']) {
        patch.fontFamily = styles['font-family'].replace(/['"]/g, '').split(',')[0].trim();
      }
      if (styles['font-size']) {
        const pxMatch = styles['font-size'].match(/(\d+(?:\.\d+)?)\s*px/i);
        const ptMatch = styles['font-size'].match(/(\d+(?:\.\d+)?)\s*pt/i);
        if (ptMatch) patch.fontSizePt = Number(ptMatch[1]);
        else if (pxMatch) patch.fontSizePt = Math.round(Number(pxMatch[1]) * 0.75 * 10) / 10;
      }
      if (tag === 'a') {
        const href = extractAttr(attrs, 'href');
        if (href && SAFE_URL_PROTOCOLS.test(href)) {
          patch.linkHref = href;
          patch.underline = true;
          patch.color = patch.color || '2563EB';
        }
      }

      if (!tagToken.endsWith('/>')) {
        stack.push({tag, patch});
      }
    }
  }

  return runs;
}

/**
 * Parses full rich HTML into structured blocks (paragraphs, lists, tables)
 * for accurate Word DOCX and PDF export.
 */
export function parseRichBlocks(input: string): RichBlock[] {
  if (!input) return [];
  const clean = normalizeLegacyToRichHtml(input);
  const blocks: RichBlock[] = [];

  // Extract top-level tables, lists, and paragraphs in source order
  const blockRegex = /<(table|ul|ol|p|h[1-4]|blockquote|div)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = blockRegex.exec(clean)) !== null) {
    // Capture any loose text before block
    const before = clean.slice(lastIndex, m.index).trim();
    if (before) {
      const looseRuns = parseRichInlineRuns(before);
      if (looseRuns.length > 0) {
        blocks.push({type: 'paragraph', runs: looseRuns});
      }
    }
    lastIndex = blockRegex.lastIndex;

    const tag = m[1].toLowerCase();
    const attrs = m[2] || '';
    const inner = m[3] || '';
    const styles = parseStyleMap(extractAttr(attrs, 'style'));
    const alignVal = styles['text-align'] as RichBlock['align'] | undefined;
    const lh = styles['line-height'] ? Number(styles['line-height']) : undefined;

    if (tag === 'table') {
      const rows: Array<Array<{isHeader: boolean; runs: RichInlineRun[]}>> = [];
      const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let trMatch: RegExpExecArray | null;
      while ((trMatch = trRegex.exec(inner)) !== null) {
        const cells: Array<{isHeader: boolean; runs: RichInlineRun[]}> = [];
        const cellRegex = /<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi;
        let cellMatch: RegExpExecArray | null;
        while ((cellMatch = cellRegex.exec(trMatch[1])) !== null) {
          cells.push({
            isHeader: cellMatch[1].toLowerCase() === 'th',
            runs: parseRichInlineRuns(cellMatch[2]),
          });
        }
        if (cells.length > 0) rows.push(cells);
      }
      if (rows.length > 0) {
        blocks.push({type: 'table', runs: [], rows});
      }
    } else if (tag === 'ul' || tag === 'ol') {
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch: RegExpExecArray | null;
      while ((liMatch = liRegex.exec(inner)) !== null) {
        blocks.push({
          type: tag === 'ul' ? 'bullet_item' : 'ordered_item',
          align: alignVal,
          lineHeight: lh,
          runs: parseRichInlineRuns(liMatch[1]),
        });
      }
    } else {
      const runs = parseRichInlineRuns(inner);
      if (runs.length > 0) {
        blocks.push({
          type: 'paragraph',
          align: alignVal,
          lineHeight: lh,
          runs,
        });
      }
    }
  }

  const trailing = clean.slice(lastIndex).trim();
  if (trailing) {
    const runs = parseRichInlineRuns(trailing);
    if (runs.length > 0) {
      blocks.push({type: 'paragraph', runs});
    }
  }

  if (blocks.length === 0 && input.trim()) {
    blocks.push({type: 'paragraph', runs: parseRichInlineRuns(input)});
  }

  return blocks;
}

/**
 * Converts rich HTML inline runs into real Word DOCX TextRun[] objects.
 * Strictly preserves partial-word underlines (`<u>br</u>eadwinner`), bold, italic,
 * strike, color, highlight, superscript, subscript, font family & size.
 */
export function richHtmlToDocxRuns(
  input: string,
  base: {
    font?: string;
    sizeHalfPt?: number;
    bold?: boolean;
    italics?: boolean;
    color?: string;
  } = {},
): TextRun[] {
  const runs = parseRichInlineRuns(input);
  if (runs.length === 0) {
    return [
      new TextRun({
        text: '',
        font: base.font || 'Times New Roman',
        size: base.sizeHalfPt ?? 26,
      }),
    ];
  }

  return runs.map((r) => {
    const highlightKey = mapHexToDocxHighlight(r.highlight);
    return new TextRun({
      text: r.text,
      font: r.fontFamily || base.font || 'Times New Roman',
      size: r.fontSizePt ? Math.round(r.fontSizePt * 2) : (base.sizeHalfPt ?? 26),
      bold: r.bold || base.bold || undefined,
      italics: r.italic || base.italics || undefined,
      underline: r.underline ? {type: UnderlineType.SINGLE} : undefined,
      strike: r.strike || undefined,
      superScript: r.superscript || undefined,
      subScript: r.subscript || undefined,
      color: r.color || base.color || '0F172A',
      highlight: highlightKey,
    });
  });
}

function mapAlignToDocx(align?: RichBlock['align']) {
  if (align === 'center') return AlignmentType.CENTER;
  if (align === 'right') return AlignmentType.RIGHT;
  if (align === 'justify') return AlignmentType.JUSTIFIED;
  return AlignmentType.LEFT;
}

/**
 * Converts multi-paragraph/list/table rich HTML into native Word DOCX Paragraph/Table nodes.
 */
export function richHtmlToDocxBlocks(
  input: string,
  base: {
    font?: string;
    sizeHalfPt?: number;
    bold?: boolean;
    italics?: boolean;
    color?: string;
    spacingAfter?: number;
  } = {},
): Array<Paragraph | Table> {
  const blocks = parseRichBlocks(input);
  const result: Array<Paragraph | Table> = [];
  const defaultFont = base.font || 'Times New Roman';
  const defaultSize = base.sizeHalfPt ?? 26;

  const thinBorder = {
    top: {style: BorderStyle.SINGLE, size: 4, color: '94A3B8'},
    bottom: {style: BorderStyle.SINGLE, size: 4, color: '94A3B8'},
    left: {style: BorderStyle.SINGLE, size: 4, color: '94A3B8'},
    right: {style: BorderStyle.SINGLE, size: 4, color: '94A3B8'},
  };

  let orderedCounter = 1;

  for (const blk of blocks) {
    if (blk.type === 'table' && blk.rows && blk.rows.length > 0) {
      orderedCounter = 1;
      const tableRows = blk.rows.map(
        (row) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  borders: thinBorder,
                  shading: cell.isHeader
                    ? {type: ShadingType.CLEAR, color: 'auto', fill: 'E2E8F0'}
                    : undefined,
                  margins: {top: 70, bottom: 70, left: 100, right: 100},
                  children: [
                    new Paragraph({
                      children: cell.runs.map(
                        (r) =>
                          new TextRun({
                            text: r.text,
                            font: r.fontFamily || defaultFont,
                            size: r.fontSizePt ? Math.round(r.fontSizePt * 2) : defaultSize,
                            bold: r.bold || cell.isHeader || undefined,
                            italics: r.italic || undefined,
                            underline: r.underline ? {type: UnderlineType.SINGLE} : undefined,
                            strike: r.strike || undefined,
                            color: r.color || base.color || '0F172A',
                          }),
                      ),
                    }),
                  ],
                }),
            ),
          }),
      );
      result.push(
        new Table({
          width: {size: 100, type: WidthType.PERCENTAGE},
          rows: tableRows,
        }),
      );
      continue;
    }

    const runs = blk.runs.map((r) => {
      const highlightKey = mapHexToDocxHighlight(r.highlight);
      return new TextRun({
        text: r.text,
        font: r.fontFamily || defaultFont,
        size: r.fontSizePt ? Math.round(r.fontSizePt * 2) : defaultSize,
        bold: r.bold || base.bold || undefined,
        italics: r.italic || base.italics || undefined,
        underline: r.underline ? {type: UnderlineType.SINGLE} : undefined,
        strike: r.strike || undefined,
        superScript: r.superscript || undefined,
        subScript: r.subscript || undefined,
        color: r.color || base.color || '0F172A',
        highlight: highlightKey,
      });
    });

    if (blk.type === 'bullet_item') {
      orderedCounter = 1;
      result.push(
        new Paragraph({
          bullet: {level: 0},
          alignment: mapAlignToDocx(blk.align),
          spacing: {after: base.spacingAfter ?? 60},
          children: runs,
        }),
      );
    } else if (blk.type === 'ordered_item') {
      result.push(
        new Paragraph({
          alignment: mapAlignToDocx(blk.align),
          spacing: {after: base.spacingAfter ?? 60},
          children: [
            new TextRun({
              text: `${orderedCounter++}. `,
              font: defaultFont,
              size: defaultSize,
              bold: true,
            }),
            ...runs,
          ],
        }),
      );
    } else {
      orderedCounter = 1;
      result.push(
        new Paragraph({
          alignment: mapAlignToDocx(blk.align),
          spacing: {
            after: base.spacingAfter ?? 90,
            ...(blk.lineHeight ? {line: Math.round(blk.lineHeight * 240)} : {}),
          },
          children: runs,
        }),
      );
    }
  }

  return result;
}

/**
 * Converts rich HTML into native PptxGenJS TextProps[] for real PowerPoint formatting.
 */
export function richHtmlToPptxTextRuns(
  input: string,
  base: {fontSize?: number; color?: string; bold?: boolean; fontFace?: string} = {},
): Array<{
  text: string;
  options: {
    fontSize?: number;
    color?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: {style: 'sng'};
    strike?: boolean;
    superscript?: boolean;
    subscript?: boolean;
    highlight?: string;
    fontFace?: string;
  };
}> {
  const runs = parseRichInlineRuns(input);
  return runs.map((r) => ({
    text: r.text,
    options: {
      fontSize: r.fontSizePt || base.fontSize || 16,
      color: r.color || base.color || '0F172A',
      bold: r.bold || base.bold || undefined,
      italic: r.italic || undefined,
      underline: r.underline ? {style: 'sng'} : undefined,
      strike: r.strike || undefined,
      superscript: r.superscript || undefined,
      subscript: r.subscript || undefined,
      highlight: r.highlight || undefined,
      fontFace: r.fontFamily || base.fontFace || 'Calibri',
    },
  }));
}

/**
 * Produces sanitized, print-ready HTML with IPA font class for PDF / iframe print export.
 */
export function richHtmlToPrintableHtml(input: string): string {
  if (!input) return '';
  const clean = sanitizeRichHtml(
    input.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>'),
  );
  // Wrap standalone IPA slashes like /ˈfætə/ in .ipa-inline span so PDF prints with Charis SIL
  return clean.replace(
    /(\/[^/\s<>]{1,28}\/)/g,
    (match) => {
      if (/[ɪʊæɑɒɔɜəʌθðʃʒŋɡˈˌː]/.test(match)) {
        return `<span class="ipa-inline">${match}</span>`;
      }
      return match;
    },
  );
}
