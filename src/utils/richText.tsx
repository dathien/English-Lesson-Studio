import React from 'react';
import {RichTextRenderer} from '../components/editor/RichTextRenderer';
import {
  parseRichInlineRuns,
  stripHtmlToPlainText,
} from '../services/documentExportAdapter';

/**
 * Safely renders rich-text HTML (from Tiptap WYSIWYG editor) and legacy
 * `<u>...</u>` / `**...**` text without using dangerouslySetInnerHTML.
 * Strictly preserves underlined pronunciation characters, IPA symbols, colors, highlights, tables, lists, and images.
 */
export function RenderFormattedText({
  text,
  className,
  inline = true,
}: {
  text: string;
  className?: string;
  inline?: boolean;
}) {
  if (!text) return null;
  return <RichTextRenderer content={text} className={className} inline={inline} />;
}

/**
 * Strips HTML and legacy formatting tags for plain text comparisons or search.
 */
export function stripFormattingTags(text: string): string {
  return stripHtmlToPlainText(text);
}

/**
 * Splits rich text into styled segments preserving underline, bold, italic, strike, color, highlight, etc.
 */
export interface FormattedSegment {
  text: string;
  underline: boolean;
  bold: boolean;
  italic?: boolean;
  strike?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  color?: string;
  highlight?: string;
  fontFamily?: string;
  fontSizePt?: number;
}

export function parseFormattedSegments(text: string): FormattedSegment[] {
  if (!text) return [];
  return parseRichInlineRuns(text).map((run) => ({
    text: run.text,
    underline: Boolean(run.underline),
    bold: Boolean(run.bold),
    italic: run.italic,
    strike: run.strike,
    superscript: run.superscript,
    subscript: run.subscript,
    color: run.color,
    highlight: run.highlight,
    fontFamily: run.fontFamily,
    fontSizePt: run.fontSizePt,
  }));
}
