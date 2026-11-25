import {Node, mergeAttributes, type Extensions} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import {
  Color,
  FontFamily,
  FontSize,
  LineHeight,
  TextStyle,
} from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import {Table, TableCell, TableHeader, TableRow} from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';

/**
 * Custom Tiptap Audio Embed node so teachers can attach playable MP3/WAV audio clips
 * inside Listening prompts, transcripts, or pronunciation exercises.
 */
export const StudioAudioNode = Node.create({
  name: 'studioAudio',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: {default: null},
      title: {default: 'Tệp âm thanh đính kèm'},
    };
  },

  parseHTML() {
    return [{tag: 'audio[src]'}];
  },

  renderHTML({HTMLAttributes}) {
    const src = String(HTMLAttributes.src || '');
    const safe = /^(https?:|data:audio\/)/i.test(src);
    if (!safe) {
      return ['span', {}, ''];
    }
    return [
      'audio',
      mergeAttributes(HTMLAttributes, {
        controls: 'true',
        'data-studio-audio': 'true',
        class: 'w-full max-w-md my-2 rounded-lg',
      }),
    ];
  },
});

export function createStudioTiptapExtensions(options: {
  mode: 'full' | 'compact';
  placeholder?: string;
  allowAudio?: boolean;
}) {
  const {mode, placeholder = 'Nhập nội dung...', allowAudio = false} = options;

  const base: Extensions = [
    StarterKit.configure({
      // Disable duplicate underline & link from StarterKit v3 so we configure them explicitly below
      underline: false,
      link: false,
      heading: mode === 'full' ? {levels: [2, 3, 4]} : false,
      blockquote: mode === 'full' ? {} : false,
      codeBlock: false,
      horizontalRule: false,
    }),
    Underline,
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    Highlight.configure({multicolor: true}),
    Superscript,
    Subscript,
    Image.configure({
      inline: mode === 'compact',
      allowBase64: true,
    }),
    Placeholder.configure({
      placeholder,
    }),
  ];

  if (mode === 'full') {
    base.push(
      LineHeight.configure({
        types: ['textStyle'],
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Table.configure({
        resizable: false,
      }),
      TableRow,
      TableHeader,
      TableCell,
    );
  }

  if (allowAudio) {
    base.push(StudioAudioNode);
  }

  return base;
}
