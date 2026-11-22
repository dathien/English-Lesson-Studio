import React from 'react';

/**
 * Safely renders text containing <u>...</u> (for underlined letters in Pronunciation/Grammar)
 * and **...** (for bold emphasis) without using dangerouslySetInnerHTML.
 * Strictly preserves exact underlined characters from original source documents.
 */
export function RenderFormattedText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  if (!text) return null;

  const tokens = text.split(/(<u>[\s\S]*?<\/u>|\*\*[\s\S]*?\*\*)/g);

  return (
    <span className={className}>
      {tokens.map((token, idx) => {
        if (token.startsWith('<u>') && token.endsWith('</u>')) {
          const inner = token.slice(3, -4);
          return (
            <u key={idx} className="pron-underline">
              {inner}
            </u>
          );
        }
        if (token.startsWith('**') && token.endsWith('**')) {
          const inner = token.slice(2, -2);
          return (
            <strong key={idx} className="font-semibold">
              {inner}
            </strong>
          );
        }
        return <React.Fragment key={idx}>{token}</React.Fragment>;
      })}
    </span>
  );
}

/**
 * Strips formatting tags for plain text comparisons or exports where needed.
 */
export function stripFormattingTags(text: string): string {
  return text.replace(/<\/?u>/g, '').replace(/\*\*/g, '');
}

/**
 * Splits text into segments preserving underline state for DOCX / PPTX export.
 */
export interface FormattedSegment {
  text: string;
  underline: boolean;
  bold: boolean;
}

export function parseFormattedSegments(text: string): FormattedSegment[] {
  if (!text) return [];
  const tokens = text.split(/(<u>[\s\S]*?<\/u>|\*\*[\s\S]*?\*\*)/g);
  const segments: FormattedSegment[] = [];
  for (const token of tokens) {
    if (!token) continue;
    if (token.startsWith('<u>') && token.endsWith('</u>')) {
      segments.push({text: token.slice(3, -4), underline: true, bold: true});
    } else if (token.startsWith('**') && token.endsWith('**')) {
      segments.push({text: token.slice(2, -2), underline: false, bold: true});
    } else {
      segments.push({text: token, underline: false, bold: false});
    }
  }
  return segments;
}
