import React, {useEffect, useRef, useState} from 'react';
import {EditorContent, useEditor} from '@tiptap/react';
import {
  Bold,
  Eraser,
  Highlighter,
  ImagePlus,
  Italic,
  Languages,
  Redo2,
  Sparkles,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import {
  compactRichHtmlToInline,
  normalizeLegacyToRichHtml,
  sanitizeRichHtml,
} from '../../services/documentExportAdapter';
import {createStudioTiptapExtensions} from './tiptapExtensions';
import {EnglishIPAPicker} from './EnglishIPAPicker';

interface CompactAnswerEditorProps {
  value: string;
  onChange: (nextHtml: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  spellCheckLang?: 'en-GB' | 'en-US' | 'vi' | 'off';
  onFirstEditNotice?: () => void;
}

export const CompactAnswerEditor: React.FC<CompactAnswerEditorProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Nhập phương án...',
  disabled = false,
  spellCheckLang = 'off',
  onFirstEditNotice,
}) => {
  const [focused, setFocused] = useState(false);
  const [pickerTab, setPickerTab] = useState<'ipa' | 'special' | null>(null);
  const [plainPaste, setPlainPaste] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef<string>(value);
  const notifiedEditRef = useRef(false);

  const editor = useEditor({
    extensions: createStudioTiptapExtensions({
      mode: 'compact',
      placeholder,
    }),
    content: normalizeLegacyToRichHtml(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          'studio-richtext-compact min-h-[38px] px-3 py-1.5 text-[15.5px] focus:outline-none',
        spellcheck: spellCheckLang === 'off' ? 'false' : 'true',
        lang: spellCheckLang === 'off' ? 'en' : spellCheckLang,
      },
      handlePaste: (view, event) => {
        if (plainPaste) {
          const text = event.clipboardData?.getData('text/plain') || '';
          if (text) {
            event.preventDefault();
            view.dispatch(view.state.tr.insertText(text));
            return true;
          }
        }
        const html = event.clipboardData?.getData('text/html');
        if (html) {
          const cleaned = sanitizeRichHtml(html);
          if (cleaned) {
            event.preventDefault();
            editor?.commands.insertContent(cleaned);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({editor: ed}) => {
      const compact = compactRichHtmlToInline(ed.getHTML());
      lastEmittedRef.current = compact;
      if (!notifiedEditRef.current && onFirstEditNotice) {
        notifiedEditRef.current = true;
        onFirstEditNotice();
      }
      onChange(compact);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value;
      const normalized = normalizeLegacyToRichHtml(value);
      if (editor.getHTML() !== normalized) {
        editor.commands.setContent(normalized || '<p></p>', {emitUpdate: false});
      }
    }
  }, [value, editor]);

  // Close floating mini toolbar only when clicking outside the whole component
  useEffect(() => {
    const handleOutside = (ev: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        setFocused(false);
        setPickerTab(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      if (src.startsWith('data:image/')) {
        editor.chain().focus().setImage({src, alt: file.name}).run();
      }
    };
    reader.readAsDataURL(file);
  };

  if (!editor) return null;

  return (
    <div
      ref={containerRef}
      className="relative"
      onFocusCapture={() => {
        if (!disabled) setFocused(true);
      }}
    >
      {/* Contextual Mini Toolbar — shown ONLY when this specific answer option is active */}
      {focused && !disabled && (
        <div
          className="mb-1 flex flex-wrap items-center gap-0.5 rounded-xl border border-blue-200 bg-blue-50/95 px-1.5 py-1 shadow-xs"
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            title="Gạch chân phần bôi đen (Ctrl+U) — dùng cho phát âm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition-colors ${
              editor.isActive('underline')
                ? 'bg-[#2563EB] text-white'
                : 'bg-white text-[#1E40AF] border border-blue-200 hover:bg-blue-100'
            }`}
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
            <span>Gạch chân</span>
          </button>

          <button
            type="button"
            title="In đậm (Ctrl+B)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('bold')
                ? 'bg-[#2563EB] text-white'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            title="In nghiêng (Ctrl+I)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('italic')
                ? 'bg-[#2563EB] text-white'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            title="Tô sáng màu vàng"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleHighlight({color: '#FEF08A'}).run()}
            className={`p-1.5 rounded-lg transition-colors ${
              editor.isActive('highlight')
                ? 'bg-amber-300 text-slate-900'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <Highlighter className="w-3.5 h-3.5" />
          </button>

          <span className="w-px h-4 bg-blue-200 mx-0.5" />

          <button
            type="button"
            title="Chèn ký hiệu phiên âm IPA"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPickerTab((curr) => (curr === 'ipa' ? null : 'ipa'))}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition-colors ${
              pickerTab === 'ipa'
                ? 'bg-[#2563EB] text-white'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            IPA
          </button>

          <button
            type="button"
            title="Chèn ký tự đặc biệt"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPickerTab((curr) => (curr === 'special' ? null : 'special'))}
            className={`p-1.5 rounded-lg transition-colors ${
              pickerTab === 'special'
                ? 'bg-[#2563EB] text-white'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            title="Chèn hình ảnh vào phương án"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => imgInputRef.current?.click()}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-white"
          >
            <ImagePlus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            title="Hoàn tác (Ctrl+Z)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().undo().run()}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-white"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            title="Làm lại (Ctrl+Y)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().redo().run()}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-white"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            title="Xóa toàn bộ định dạng đang chọn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().unsetAllMarks().run()}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-white"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            title={
              plainPaste
                ? 'Đang bật: Dán văn bản thuần (nhấn để chuyển sang giữ định dạng)'
                : 'Đang bật: Dán giữ định dạng (nhấn để chuyển sang văn bản thuần)'
            }
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPlainPaste((v) => !v)}
            className={`ml-auto rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
              plainPaste
                ? 'bg-slate-200 text-slate-800'
                : 'bg-white text-[#1E40AF] border border-blue-200'
            }`}
          >
            {plainPaste ? 'Dán thuần' : 'Dán giữ định dạng'}
          </button>
        </div>
      )}

      {/* IPA / Special Char Popover */}
      {pickerTab && !disabled && (
        <div className="absolute left-0 top-full mt-1 z-50">
          <EnglishIPAPicker
            initialTab={pickerTab}
            onInsert={(sym) => {
              editor.chain().focus().insertContent(sym).run();
            }}
            onWrapSelection={(left, right) => {
              const {from, to} = editor.state.selection;
              const selected = editor.state.doc.textBetween(from, to, ' ');
              editor
                .chain()
                .focus()
                .insertContent(`${left}${selected}${right}`)
                .run();
            }}
            onClose={() => setPickerTab(null)}
          />
        </div>
      )}

      {/* Editor Input Box */}
      <div
        className={`flex items-start rounded-xl border transition-colors ${
          disabled
            ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
            : focused
              ? 'border-[#2563EB] bg-white ring-2 ring-blue-100'
              : 'border-slate-300 bg-white hover:border-slate-400'
        }`}
      >
        {label && (
          <span className="px-2.5 py-2 text-xs font-extrabold text-[#1E40AF] bg-slate-50 border-r border-slate-200 rounded-l-xl select-none shrink-0">
            {label}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <EditorContent editor={editor} />
        </div>
      </div>

      <input
        ref={imgInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleImageFile}
        className="hidden"
      />
    </div>
  );
};
