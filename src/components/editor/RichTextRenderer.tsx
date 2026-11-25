import React from 'react';
import {sanitizeRichHtml} from '../../services/documentExportAdapter';

/**
 * RichTextRenderer
 * Renders structured rich HTML (from Tiptap or legacy `<u>...</u>` / `**...**`)
 * via pure React elements — ZERO dangerouslySetInnerHTML, 100% XSS-safe!
 * Automatically styles Unicode IPA sequences with Charis SIL (.font-ipa).
 */

const IPA_DETECT_REGEX = /([ɪʊæɑɒɔɜəʌθðʃʒŋɡˈˌːɝɚɾ])/;
const IPA_SEGMENT_SPLIT = /(\/[^/\s<>]{1,32}\/|\[[^\]\s<>]{1,32}\])/g;

function renderTextWithIpaFont(text: string, keyPrefix: string): React.ReactNode {
  if (!IPA_DETECT_REGEX.test(text)) return text;
  const parts = text.split(IPA_SEGMENT_SPLIT);
  return parts.map((part, i) => {
    if (IPA_DETECT_REGEX.test(part)) {
      return (
        <span key={`${keyPrefix}-ipa-${i}`} className="font-ipa">
          {part}
        </span>
      );
    }
    return <React.Fragment key={`${keyPrefix}-txt-${i}`}>{part}</React.Fragment>;
  });
}

function parseSafeInlineStyle(styleStr: string | null): React.CSSProperties | undefined {
  if (!styleStr) return undefined;
  const style: React.CSSProperties = {};
  for (const decl of styleStr.split(';')) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    if (!val || /url\(|expression|javascript:/i.test(val)) continue;
    if (prop === 'color') style.color = val;
    else if (prop === 'background-color') style.backgroundColor = val;
    else if (prop === 'font-family') style.fontFamily = val;
    else if (prop === 'font-size') style.fontSize = val;
    else if (prop === 'line-height') style.lineHeight = val;
    else if (prop === 'text-align' && ['left', 'center', 'right', 'justify'].includes(val)) {
      style.textAlign = val as React.CSSProperties['textAlign'];
    }
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

function domNodeToReact(node: ChildNode, key: string): React.ReactNode {
  if (node.nodeType === 3) {
    return renderTextWithIpaFont(node.textContent || '', key);
  }
  if (node.nodeType !== 1) return null;

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const style = parseSafeInlineStyle(el.getAttribute('style'));
  const children = Array.from(el.childNodes).map((child, idx) =>
    domNodeToReact(child, `${key}-${idx}`),
  );

  switch (tag) {
    case 'br':
      return <br key={key} />;
    case 'strong':
    case 'b':
      return (
        <strong key={key} className="font-bold" style={style}>
          {children}
        </strong>
      );
    case 'em':
    case 'i':
      return (
        <em key={key} className="italic" style={style}>
          {children}
        </em>
      );
    case 'u':
      return (
        <u key={key} className="pron-underline" style={style}>
          {children}
        </u>
      );
    case 's':
    case 'del':
    case 'strike':
      return (
        <s key={key} style={style}>
          {children}
        </s>
      );
    case 'sup':
      return (
        <sup key={key} style={style}>
          {children}
        </sup>
      );
    case 'sub':
      return (
        <sub key={key} style={style}>
          {children}
        </sub>
      );
    case 'mark': {
      const bg =
        style?.backgroundColor || el.getAttribute('data-color') || '#FEF08A';
      return (
        <mark
          key={key}
          className="rounded px-0.5"
          style={{...style, backgroundColor: bg}}
        >
          {children}
        </mark>
      );
    }
    case 'span':
      return (
        <span key={key} style={style}>
          {children}
        </span>
      );
    case 'p':
      return (
        <p key={key} className="mb-1.5 last:mb-0" style={style}>
          {children}
        </p>
      );
    case 'div':
      return (
        <div key={key} style={style}>
          {children}
        </div>
      );
    case 'h1':
    case 'h2':
      return (
        <h3 key={key} className="font-bold text-lg mb-1.5" style={style}>
          {children}
        </h3>
      );
    case 'h3':
    case 'h4':
      return (
        <h4 key={key} className="font-bold text-base mb-1" style={style}>
          {children}
        </h4>
      );
    case 'blockquote':
      return (
        <blockquote
          key={key}
          className="pl-3 italic text-slate-600 my-1.5 border border-slate-200 rounded-lg p-2.5 bg-slate-50"
          style={style}
        >
          {children}
        </blockquote>
      );
    case 'ul':
      return (
        <ul key={key} className="list-disc pl-5 my-1.5 space-y-0.5">
          {children}
        </ul>
      );
    case 'ol':
      return (
        <ol key={key} className="list-decimal pl-5 my-1.5 space-y-0.5">
          {children}
        </ol>
      );
    case 'li':
      return (
        <li key={key} style={style}>
          {children}
        </li>
      );
    case 'table':
      return (
        <div key={key} className="overflow-x-auto my-2">
          <table className="w-full border-collapse border border-slate-300 text-sm">
            {children}
          </table>
        </div>
      );
    case 'thead':
      return <thead key={key}>{children}</thead>;
    case 'tbody':
      return <tbody key={key}>{children}</tbody>;
    case 'tr':
      return <tr key={key}>{children}</tr>;
    case 'th':
      return (
        <th
          key={key}
          colSpan={Number(el.getAttribute('colspan')) || undefined}
          rowSpan={Number(el.getAttribute('rowspan')) || undefined}
          className="border border-slate-300 bg-slate-100 px-2.5 py-1.5 font-bold text-left"
          style={style}
        >
          {children}
        </th>
      );
    case 'td':
      return (
        <td
          key={key}
          colSpan={Number(el.getAttribute('colspan')) || undefined}
          rowSpan={Number(el.getAttribute('rowspan')) || undefined}
          className="border border-slate-300 px-2.5 py-1.5 align-top"
          style={style}
        >
          {children}
        </td>
      );
    case 'a': {
      const href = el.getAttribute('href') || '';
      if (!/^(https?:|mailto:)/i.test(href)) {
        return <span key={key}>{children}</span>;
      }
      return (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#2563EB] underline hover:text-[#1E40AF]"
          style={style}
        >
          {children}
        </a>
      );
    }
    case 'img': {
      const src = el.getAttribute('src') || '';
      if (!/^(https?:|data:image\/)/i.test(src)) return null;
      return (
        <img
          key={key}
          src={src}
          alt={el.getAttribute('alt') || 'Hình minh họa bài học'}
          referrerPolicy="no-referrer"
          className="max-w-full max-h-72 rounded-lg my-1.5 inline-block object-contain"
        />
      );
    }
    case 'audio': {
      const src = el.getAttribute('src') || '';
      if (!/^(https?:|data:audio\/)/i.test(src)) return null;
      return (
        <audio
          key={key}
          src={src}
          controls
          className="w-full max-w-md my-1.5"
        />
      );
    }
    default:
      return <React.Fragment key={key}>{children}</React.Fragment>;
  }
}

interface RichTextRendererProps {
  content: string;
  className?: string;
  inline?: boolean;
}

export const RichTextRenderer: React.FC<RichTextRendererProps> = ({
  content,
  className = '',
  inline = false,
}) => {
  if (!content) return null;

  // Fast path for plain strings with no HTML tags and no **bold** markers
  if (!/[<>]|\*\*/.test(content)) {
    const Wrapper = inline ? 'span' : 'span';
    return <Wrapper className={className}>{renderTextWithIpaFont(content, 'plain')}</Wrapper>;
  }

  const normalized = sanitizeRichHtml(
    content.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>'),
  );

  // Use browser DOMParser safely (never executes scripts in detached document)
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(`<div>${normalized}</div>`, 'text/html');
    const root = doc.body.firstElementChild;
    if (root) {
      // If inline mode and single <p>, render children directly inline so options A. breadwinner don't break onto a new line
      if (
        inline &&
        root.childNodes.length === 1 &&
        root.firstElementChild?.tagName.toLowerCase() === 'p'
      ) {
        const pChildren = Array.from(root.firstElementChild.childNodes).map((c, idx) =>
          domNodeToReact(c, `in-${idx}`),
        );
        return <span className={className}>{pChildren}</span>;
      }

      const nodes = Array.from(root.childNodes).map((c, idx) => domNodeToReact(c, `rt-${idx}`));
      const hasBlock = /<(p|div|ul|ol|table|h[1-4]|blockquote)\b/i.test(normalized);
      if (hasBlock && !inline) {
        return <div className={className}>{nodes}</div>;
      }
      return <span className={className}>{nodes}</span>;
    }
  }

  // Fallback for non-DOM environments
  return <span className={className}>{content.replace(/<[^>]+>/g, '')}</span>;
};
