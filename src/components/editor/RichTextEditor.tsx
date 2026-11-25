import React, {useEffect, useMemo, useRef, useState} from 'react';
import {EditorContent, useEditor} from '@tiptap/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ClipboardCopy,
  Eraser,
  Headphones,
  Highlighter,
  ImagePlus,
  Italic,
  Languages,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Palette,
  Redo2,
  Replace,
  Search,
  Sparkles,
  SpellCheck2,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
  X,
} from 'lucide-react';
import {
  normalizeLegacyToRichHtml,
  sanitizeRichHtml,
  stripHtmlToPlainText,
} from '../../services/documentExportAdapter';
import {createStudioTiptapExtensions} from './tiptapExtensions';
import {EnglishIPAPicker} from './EnglishIPAPicker';

export type SpellCheckLanguage = 'en-GB' | 'en-US' | 'vi' | 'off';

interface RichTextEditorProps {
  value: string;
  onChange: (nextHtml: string) => void;
  label?: string;
  placeholder?: string;
  minHeightClass?: string;
  compactToolbar?: boolean;
  allowAudio?: boolean;
  allowFullscreen?: boolean;
  disabled?: boolean;
  defaultSpellCheck?: SpellCheckLanguage;
  disableProofreadHints?: boolean;
  draftKey?: string;
  showApplyCancel?: boolean;
  onApply?: (html: string) => void;
  onCancel?: () => void;
}

const FONT_FAMILIES = [
  {label: 'Mặc định (Be Vietnam Pro)', value: ''},
  {label: 'Times New Roman', value: 'Times New Roman'},
  {label: 'Arial', value: 'Arial'},
  {label: 'Calibri', value: 'Calibri'},
  {label: 'Charis SIL (IPA)', value: 'Charis SIL'},
];

const FONT_SIZES = ['13px', '14px', '15px', '16px', '18px', '20px', '24px', '28px'];
const LINE_HEIGHTS = ['1.15', '1.4', '1.6', '1.8', '2.0'];

const TEXT_COLORS = [
  {label: 'Mặc định', value: '#0F172A'},
  {label: 'Xanh đậm', value: '#1E40AF'},
  {label: 'Xanh dương', value: '#2563EB'},
  {label: 'Đỏ', value: '#DC2626'},
  {label: 'Xanh lục', value: '#059669'},
  {label: 'Cam', value: '#EA580C'},
  {label: 'Tím', value: '#7C3AED'},
  {label: 'Xám', value: '#475569'},
];

const HIGHLIGHT_COLORS = [
  {label: 'Vàng', value: '#FEF08A'},
  {label: 'Xanh lá nhạt', value: '#BBF7D0'},
  {label: 'Xanh trời nhạt', value: '#BAE6FD'},
  {label: 'Hồng nhạt', value: '#FBCFE8'},
  {label: 'Cam nhạt', value: '#FED7AA'},
];

interface ProofreadHint {
  id: string;
  message: string;
}

/**
 * Lightweight, non-destructive English typographical checker.
 * NEVER auto-replaces content and can be toggled off for Error Identification questions.
 */
function inspectBasicEnglishHints(plainText: string, lang: SpellCheckLanguage): ProofreadHint[] {
  if (lang !== 'en-GB' && lang !== 'en-US') return [];
  const hints: ProofreadHint[] = [];
  if (/\s{2,}/.test(plainText)) {
    hints.push({id: 'double-space', message: 'Phát hiện khoảng trắng kép thừa giữa các từ.'});
  }
  if (/\b([a-zA-Z]{2,})\s+\1\b/i.test(plainText)) {
    const m = plainText.match(/\b([a-zA-Z]{2,})\s+\1\b/i);
    hints.push({
      id: 'dup-word',
      message: `Từ lặp liên tiếp: "${m?.[0]}" (chỉ gợi ý, không tự thay thế).`,
    });
  }
  if (/\s+[,.;:?!]/.test(plainText)) {
    hints.push({id: 'space-before-punct', message: 'Có khoảng trắng đứng trước dấu câu (, . ; ? !).'});
  }
  return hints;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Soạn thảo nội dung trực quan (hỗ trợ bôi đen gạch chân, IPA, bảng, ảnh)...',
  minHeightClass = 'min-h-[110px]',
  compactToolbar = false,
  allowAudio = false,
  allowFullscreen = true,
  disabled = false,
  defaultSpellCheck = 'en-GB',
  disableProofreadHints = false,
  draftKey,
  showApplyCancel = false,
  onApply,
  onCancel,
}) => {
  const [spellLang, setSpellLang] = useState<SpellCheckLanguage>(defaultSpellCheck);
  const [pastePlain, setPastePlain] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pickerTab, setPickerTab] = useState<'ipa' | 'special' | null>(null);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showHighlightMenu, setShowHighlightMenu] = useState(false);
  const [showLinkBar, setShowLinkBar] = useState(false);
  const [linkInput, setLinkInput] = useState('https://');
  const [showFindBar, setShowFindBar] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [findMsg, setFindMsg] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [errorIdentificationMode, setErrorIdentificationMode] = useState(disableProofreadHints);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [draftRestoredNotice, setDraftRestoredNotice] = useState<string | null>(null);

  const imgInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const lastEmittedRef = useRef<string>(value);
  const initialValueRef = useRef<string>(value);

  const editor = useEditor({
    extensions: createStudioTiptapExtensions({
      mode: 'full',
      placeholder,
      allowAudio,
    }),
    content: normalizeLegacyToRichHtml(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        class: `studio-richtext ${minHeightClass} px-3.5 py-2.5 text-[16px] leading-relaxed focus:outline-none`,
        spellcheck: spellLang === 'off' ? 'false' : 'true',
        lang: spellLang === 'off' ? 'en' : spellLang,
      },
      handlePaste: (view, event) => {
        if (pastePlain) {
          const text = event.clipboardData?.getData('text/plain') || '';
          if (text) {
            event.preventDefault();
            view.dispatch(view.state.tr.insertText(text));
            return true;
          }
        }
        // Check for pasted clipboard images first
        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (it.type.startsWith('image/')) {
              const file = it.getAsFile();
              if (file) {
                event.preventDefault();
                const reader = new FileReader();
                reader.onload = () => {
                  const src = typeof reader.result === 'string' ? reader.result : '';
                  if (src.startsWith('data:image/')) {
                    editor?.chain().focus().setImage({src, alt: 'Ảnh dán từ clipboard'}).run();
                  }
                };
                reader.readAsDataURL(file);
                return true;
              }
            }
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
      const html = sanitizeRichHtml(ed.getHTML());
      lastEmittedRef.current = html;
      setIsDirty(html !== normalizeLegacyToRichHtml(initialValueRef.current));
      if (draftKey && typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(`els_draft_${draftKey}`, html);
        } catch {
          // ignore quota error
        }
      }
      if (!showApplyCancel) {
        onChange(html);
      }
    },
  });

  // Update spellcheck & editable attributes live
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
    const dom = editor.view.dom as HTMLElement;
    dom.setAttribute('spellcheck', spellLang === 'off' ? 'false' : 'true');
    if (spellLang !== 'off') {
      dom.setAttribute('lang', spellLang);
    }
  }, [editor, disabled, spellLang]);

  // Sync external value changes without clobbering cursor
  useEffect(() => {
    if (!editor) return;
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value;
      initialValueRef.current = value;
      const normalized = normalizeLegacyToRichHtml(value);
      if (editor.getHTML() !== normalized) {
        editor.commands.setContent(normalized || '<p></p>', {emitUpdate: false});
      }
      setIsDirty(false);
    }
  }, [value, editor]);

  // Offer draft recovery if a session draft exists
  useEffect(() => {
    if (!draftKey || !editor || typeof window === 'undefined') return;
    try {
      const savedDraft = window.sessionStorage.getItem(`els_draft_${draftKey}`);
      if (savedDraft && savedDraft !== normalizeLegacyToRichHtml(value)) {
        setDraftRestoredNotice('Có bản nháp chưa áp dụng được lưu tự động.');
      }
    } catch {
      // ignore
    }
  }, [draftKey, editor, value]);

  const plainText = useMemo(
    () => (editor ? stripHtmlToPlainText(editor.getHTML()) : stripHtmlToPlainText(value)),
    [editor, value, isDirty],
  );

  const proofreadHints = useMemo(() => {
    if (errorIdentificationMode || disabled) return [];
    return inspectBasicEnglishHints(plainText, spellLang);
  }, [plainText, spellLang, errorIdentificationMode, disabled]);

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleUploadAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      if (src.startsWith('data:audio/')) {
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'studioAudio',
            attrs: {src, title: file.name},
          })
          .run();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyLink = () => {
    if (!editor) return;
    const trimmed = linkInput.trim();
    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
      setShowLinkBar(false);
      return;
    }
    if (!/^(https?:|mailto:)/i.test(trimmed)) return;
    editor.chain().focus().extendMarkRange('link').setLink({href: trimmed}).run();
    setShowLinkBar(false);
  };

  const handleFindReplace = (replaceAll: boolean) => {
    if (!editor || !findText) return;
    const currentHtml = editor.getHTML();
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, replaceAll ? 'g' : '');
    let count = 0;
    // Only replace inside text nodes (outside HTML tags)
    const updatedHtml = currentHtml.replace(/(<[^>]+>)|([^<]+)/g, (_m, tag, text) => {
      if (tag) return tag;
      if (!replaceAll && count >= 1) return text;
      return String(text).replace(regex, (hit) => {
        if (!replaceAll && count >= 1) return hit;
        count += 1;
        return replaceText;
      });
    });
    if (count > 0) {
      editor.commands.setContent(updatedHtml, {emitUpdate: true});
      setFindMsg(`Đã thay thế ${count} vị trí.`);
    } else {
      setFindMsg('Không tìm thấy cụm từ cần tìm.');
    }
  };

  const handleCopyContent = async () => {
    if (!editor) return;
    const html = editor.getHTML();
    const text = stripHtmlToPlainText(html);
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const item = new ClipboardItem({
          'text/html': new Blob([html], {type: 'text/html'}),
          'text/plain': new Blob([text], {type: 'text/plain'}),
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 1800);
    } catch {
      // Fallback ignored silently
    }
  };

  const handleApplyClick = () => {
    if (!editor) return;
    const html = sanitizeRichHtml(editor.getHTML());
    if (draftKey && typeof window !== 'undefined') {
      window.sessionStorage.removeItem(`els_draft_${draftKey}`);
    }
    initialValueRef.current = html;
    lastEmittedRef.current = html;
    setIsDirty(false);
    setConfirmDiscard(false);
    onChange(html);
    onApply?.(html);
  };

  const handleCancelRequest = () => {
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    onCancel?.();
  };

  const handleConfirmDiscard = () => {
    if (draftKey && typeof window !== 'undefined') {
      window.sessionStorage.removeItem(`els_draft_${draftKey}`);
    }
    setIsDirty(false);
    setConfirmDiscard(false);
    onCancel?.();
  };

  if (!editor) return null;

  const wrapperClass = fullscreen
    ? 'fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6'
    : 'relative';

  const cardClass = fullscreen
    ? 'bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden'
    : `rounded-xl border transition-colors bg-white ${
        disabled ? 'border-slate-200 bg-slate-50 opacity-85' : 'border-slate-300 focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-blue-100'
      }`;

  return (
    <div className={wrapperClass}>
      <div className={cardClass}>
        {/* Optional Label & Fullscreen Header */}
        {(label || fullscreen) && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/70 rounded-t-xl">
            <span className="text-xs font-bold text-[#0F172A]">
              {label || 'Trình soạn thảo trực quan toàn màn hình'}
            </span>
            <div className="flex items-center gap-2">
              {disabled && (
                <span className="text-[11px] font-semibold text-amber-700">
                  Đang khóa — mở khóa để chỉnh sửa
                </span>
              )}
              {fullscreen && (
                <button
                  type="button"
                  onClick={() => setFullscreen(false)}
                  title="Thu gọn trình soạn thảo"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  Thu gọn
                </button>
              )}
            </div>
          </div>
        )}

        {/* Draft recovery notice */}
        {draftRestoredNotice && draftKey && !disabled && (
          <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
            <span>{draftRestoredNotice}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const saved = window.sessionStorage.getItem(`els_draft_${draftKey}`);
                  if (saved) {
                    editor.commands.setContent(saved, {emitUpdate: true});
                  }
                  setDraftRestoredNotice(null);
                }}
                className="font-bold text-[#1E40AF] hover:underline"
              >
                Khôi phục bản nháp
              </button>
              <button
                type="button"
                onClick={() => {
                  window.sessionStorage.removeItem(`els_draft_${draftKey}`);
                  setDraftRestoredNotice(null);
                }}
                className="text-slate-500 hover:text-slate-800"
              >
                Bỏ qua
              </button>
            </div>
          </div>
        )}

        {/* Main Word-Style Formatting Toolbar */}
        {!disabled && (
          <div
            className="border-b border-slate-200 bg-slate-50/90 px-2 py-1.5 flex flex-wrap items-center gap-1 relative"
            onMouseDown={(e) => {
              // Allow selects/inputs to receive focus normally; preserve selection on buttons
              const tag = (e.target as HTMLElement).tagName;
              if (tag !== 'SELECT' && tag !== 'INPUT') {
                e.preventDefault();
              }
            }}
          >
            {/* Undo / Redo */}
            <button
              type="button"
              title="Hoàn tác (Ctrl+Z)"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="p-1.5 rounded-lg text-slate-700 hover:bg-white disabled:opacity-35"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Làm lại (Ctrl+Y)"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="p-1.5 rounded-lg text-slate-700 hover:bg-white disabled:opacity-35"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            <span className="w-px h-5 bg-slate-200 mx-0.5" />

            {/* Font Family & Font Size (full mode) */}
            {!compactToolbar && (
              <>
                <select
                  aria-label="Chọn phông chữ"
                  title="Chọn phông chữ"
                  value={editor.getAttributes('textStyle').fontFamily || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) editor.chain().focus().unsetFontFamily().run();
                    else editor.chain().focus().setFontFamily(val).run();
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 max-w-[138px]"
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f.label} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Chọn cỡ chữ"
                  title="Chọn kích thước chữ"
                  value={editor.getAttributes('textStyle').fontSize || '16px'}
                  onChange={(e) => {
                    editor.chain().focus().setFontSize(e.target.value).run();
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-medium text-slate-700"
                >
                  {FONT_SIZES.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>

                <span className="w-px h-5 bg-slate-200 mx-0.5" />
              </>
            )}

            {/* Bold, Italic, Underline, Strike */}
            <button
              type="button"
              title="In đậm (Ctrl+B)"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded-lg transition-colors ${
                editor.isActive('bold')
                  ? 'bg-[#2563EB] text-white'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              <Bold className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="In nghiêng (Ctrl+I)"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded-lg transition-colors ${
                editor.isActive('italic')
                  ? 'bg-[#2563EB] text-white'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              <Italic className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Gạch chân (Ctrl+U) — bôi đen một phần từ để gạch chân phát âm"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded-lg transition-colors ${
                editor.isActive('underline')
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[#1E40AF] bg-blue-50 hover:bg-blue-100'
              }`}
            >
              <UnderlineIcon className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Gạch ngang chữ"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`p-1.5 rounded-lg transition-colors ${
                editor.isActive('strike')
                  ? 'bg-[#2563EB] text-white'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              <Strikethrough className="w-4 h-4" />
            </button>

            {/* Color & Highlight Popovers */}
            <div className="relative">
              <button
                type="button"
                title="Màu chữ"
                onClick={() => {
                  setShowColorMenu((v) => !v);
                  setShowHighlightMenu(false);
                }}
                className="p-1.5 rounded-lg text-slate-700 hover:bg-white"
              >
                <Palette className="w-4 h-4" />
              </button>
              {showColorMenu && (
                <div className="absolute left-0 top-full mt-1 z-40 rounded-xl border border-slate-200 bg-white shadow-lg p-2 flex items-center gap-1.5">
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onClick={() => {
                        editor.chain().focus().setColor(c.value).run();
                        setShowColorMenu(false);
                      }}
                      className="w-5 h-5 rounded-full border border-slate-300"
                      style={{backgroundColor: c.value}}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                title="Màu tô sáng (Highlight)"
                onClick={() => {
                  setShowHighlightMenu((v) => !v);
                  setShowColorMenu(false);
                }}
                className={`p-1.5 rounded-lg transition-colors ${
                  editor.isActive('highlight')
                    ? 'bg-amber-200 text-slate-900'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                <Highlighter className="w-4 h-4" />
              </button>
              {showHighlightMenu && (
                <div className="absolute left-0 top-full mt-1 z-40 rounded-xl border border-slate-200 bg-white shadow-lg p-2 flex items-center gap-1.5">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onClick={() => {
                        editor.chain().focus().toggleHighlight({color: c.value}).run();
                        setShowHighlightMenu(false);
                      }}
                      className="w-5 h-5 rounded-full border border-slate-300"
                      style={{backgroundColor: c.value}}
                    />
                  ))}
                  <button
                    type="button"
                    title="Bỏ tô sáng"
                    onClick={() => {
                      editor.chain().focus().unsetHighlight().run();
                      setShowHighlightMenu(false);
                    }}
                    className="text-[11px] font-semibold px-1.5 text-slate-600 hover:text-slate-900"
                  >
                    Bỏ
                  </button>
                </div>
              )}
            </div>

            {/* Superscript & Subscript */}
            {!compactToolbar && (
              <>
                <button
                  type="button"
                  title="Số mũ (Superscript)"
                  onClick={() => editor.chain().focus().toggleSuperscript().run()}
                  className={`p-1.5 rounded-lg transition-colors ${
                    editor.isActive('superscript')
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <SuperscriptIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Chỉ số dưới (Subscript)"
                  onClick={() => editor.chain().focus().toggleSubscript().run()}
                  className={`p-1.5 rounded-lg transition-colors ${
                    editor.isActive('subscript')
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <SubscriptIcon className="w-4 h-4" />
                </button>

                <span className="w-px h-5 bg-slate-200 mx-0.5" />

                {/* Alignment */}
                <button
                  type="button"
                  title="Căn trái"
                  onClick={() => editor.chain().focus().setTextAlign('left').run()}
                  className={`p-1.5 rounded-lg ${
                    editor.isActive({textAlign: 'left'})
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <AlignLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Căn giữa"
                  onClick={() => editor.chain().focus().setTextAlign('center').run()}
                  className={`p-1.5 rounded-lg ${
                    editor.isActive({textAlign: 'center'})
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <AlignCenter className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Căn phải"
                  onClick={() => editor.chain().focus().setTextAlign('right').run()}
                  className={`p-1.5 rounded-lg ${
                    editor.isActive({textAlign: 'right'})
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <AlignRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Căn đều hai bên"
                  onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                  className={`p-1.5 rounded-lg ${
                    editor.isActive({textAlign: 'justify'})
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <AlignJustify className="w-4 h-4" />
                </button>

                {/* Line height */}
                <select
                  aria-label="Giãn dòng"
                  title="Giãn dòng"
                  defaultValue="1.6"
                  onChange={(e) => {
                    editor.chain().focus().setLineHeight(e.target.value).run();
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-medium text-slate-700"
                >
                  {LINE_HEIGHTS.map((lh) => (
                    <option key={lh} value={lh}>
                      Dòng {lh}
                    </option>
                  ))}
                </select>
              </>
            )}

            <span className="w-px h-5 bg-slate-200 mx-0.5" />

            {/* Lists */}
            <button
              type="button"
              title="Danh sách dấu đầu dòng"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded-lg ${
                editor.isActive('bulletList')
                  ? 'bg-[#2563EB] text-white'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Danh sách đánh số"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-1.5 rounded-lg ${
                editor.isActive('orderedList')
                  ? 'bg-[#2563EB] text-white'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
            </button>

            <span className="w-px h-5 bg-slate-200 mx-0.5" />

            {/* IPA & Special Chars */}
            <button
              type="button"
              title="Mở bảng ký hiệu ngữ âm IPA"
              onClick={() => setPickerTab((curr) => (curr === 'ipa' ? null : 'ipa'))}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition-colors ${
                pickerTab === 'ipa'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-white border border-slate-200 text-[#1E40AF] hover:bg-blue-50'
              }`}
            >
              <Languages className="w-3.5 h-3.5" />
              IPA
            </button>

            <button
              type="button"
              title="Chèn ký tự đặc biệt tiếng Anh"
              onClick={() => setPickerTab((curr) => (curr === 'special' ? null : 'special'))}
              className={`p-1.5 rounded-lg ${
                pickerTab === 'special'
                  ? 'bg-[#2563EB] text-white'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
            </button>

            {/* Media: Image, Table, Link, Audio */}
            <button
              type="button"
              title="Chèn hình ảnh từ máy tính"
              onClick={() => imgInputRef.current?.click()}
              className="p-1.5 rounded-lg text-slate-700 hover:bg-white"
            >
              <ImagePlus className="w-4 h-4" />
            </button>

            {!compactToolbar && (
              <>
                <button
                  type="button"
                  title="Chèn bảng biểu (3 cột × 3 hàng)"
                  onClick={() =>
                    editor
                      .chain()
                      .focus()
                      .insertTable({rows: 3, cols: 3, withHeaderRow: true})
                      .run()
                  }
                  className={`p-1.5 rounded-lg ${
                    editor.isActive('table')
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <TableIcon className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  title="Chèn / chỉnh sửa liên kết (URL)"
                  onClick={() => {
                    const prev = editor.getAttributes('link').href || 'https://';
                    setLinkInput(prev);
                    setShowLinkBar((v) => !v);
                  }}
                  className={`p-1.5 rounded-lg ${
                    editor.isActive('link')
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <Link2 className="w-4 h-4" />
                </button>
              </>
            )}

            {allowAudio && (
              <button
                type="button"
                title="Chèn tệp âm thanh MP3/WAV trực tiếp vào nội dung"
                onClick={() => audioInputRef.current?.click()}
                className="p-1.5 rounded-lg text-cyan-700 hover:bg-cyan-50"
              >
                <Headphones className="w-4 h-4" />
              </button>
            )}

            <span className="w-px h-5 bg-slate-200 mx-0.5" />

            {/* Find & Replace, Clear Format, Copy */}
            <button
              type="button"
              title="Tìm kiếm và thay thế văn bản"
              onClick={() => {
                setShowFindBar((v) => !v);
                setFindMsg(null);
              }}
              className={`p-1.5 rounded-lg ${
                showFindBar ? 'bg-[#2563EB] text-white' : 'text-slate-700 hover:bg-white'
              }`}
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Xóa định dạng vùng đang chọn"
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
              className="p-1.5 rounded-lg text-slate-700 hover:bg-white"
            >
              <Eraser className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Sao chép nội dung giữ nguyên định dạng"
              onClick={handleCopyContent}
              className="p-1.5 rounded-lg text-slate-700 hover:bg-white"
            >
              {copyFeedback ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <ClipboardCopy className="w-4 h-4" />
              )}
            </button>

            {/* Paste Mode Toggle */}
            <button
              type="button"
              title={
                pastePlain
                  ? 'Chế độ dán: Văn bản thuần (nhấn để chuyển sang giữ định dạng từ Word)'
                  : 'Chế độ dán: Giữ định dạng từ Word/Web (nhấn để dán văn bản thuần)'
              }
              onClick={() => setPastePlain((v) => !v)}
              className={`rounded-lg px-2 py-1 text-[11px] font-semibold border transition-colors ${
                pastePlain
                  ? 'border-slate-300 bg-slate-100 text-slate-700'
                  : 'border-blue-200 bg-white text-[#1E40AF]'
              }`}
            >
              {pastePlain ? 'Dán thuần' : 'Dán giữ định dạng'}
            </button>

            {/* Spellcheck Language Selector */}
            <div className="inline-flex items-center gap-1 ml-auto">
              <SpellCheck2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                aria-label="Kiểm tra chính tả"
                title="Chọn ngôn ngữ kiểm tra chính tả trình duyệt"
                value={spellLang}
                onChange={(e) => setSpellLang(e.target.value as SpellCheckLanguage)}
                className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-semibold text-slate-700"
              >
                <option value="en-GB">English (UK)</option>
                <option value="en-US">English (US)</option>
                <option value="vi">Tiếng Việt</option>
                <option value="off">Tắt chính tả</option>
              </select>

              {allowFullscreen && !fullscreen && (
                <button
                  type="button"
                  title="Mở rộng toàn màn hình (thuận tiện cho bài đọc dài)"
                  onClick={() => setFullscreen(true)}
                  className="p-1.5 rounded-lg text-slate-700 hover:bg-white"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Active Table Context Row */}
            {editor.isActive('table') && (
              <div className="w-full pt-1 mt-1 border-t border-slate-200 flex flex-wrap items-center gap-1 text-[11px]">
                <span className="font-bold text-slate-600 mr-1">Bảng:</span>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  className="rounded-md bg-white border border-slate-200 px-2 py-0.5 font-semibold hover:bg-blue-50"
                >
                  + Hàng
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                  className="rounded-md bg-white border border-slate-200 px-2 py-0.5 font-semibold hover:bg-blue-50"
                >
                  + Cột
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteRow().run()}
                  className="rounded-md bg-white border border-slate-200 px-2 py-0.5 font-semibold hover:bg-rose-50"
                >
                  - Hàng
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                  className="rounded-md bg-white border border-slate-200 px-2 py-0.5 font-semibold hover:bg-rose-50"
                >
                  - Cột
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className="rounded-md bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 font-semibold"
                >
                  Xóa bảng
                </button>
              </div>
            )}

            {/* IPA / Special Char Popover */}
            {pickerTab && (
              <div className="absolute left-2 top-full mt-1 z-50">
                <EnglishIPAPicker
                  initialTab={pickerTab}
                  onInsert={(sym) => editor.chain().focus().insertContent(sym).run()}
                  onWrapSelection={(left, right) => {
                    const {from, to} = editor.state.selection;
                    const selected = editor.state.doc.textBetween(from, to, ' ');
                    editor.chain().focus().insertContent(`${left}${selected}${right}`).run();
                  }}
                  onClose={() => setPickerTab(null)}
                />
              </div>
            )}
          </div>
        )}

        {/* Link Insert Sub-bar */}
        {showLinkBar && !disabled && (
          <div className="px-3 py-2 bg-blue-50/70 border-b border-blue-100 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-[#1E40AF]">Liên kết URL:</span>
            <input
              type="url"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="https://..."
              className="flex-1 min-w-[180px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs"
            />
            <button
              type="button"
              onClick={handleApplyLink}
              className="rounded-lg bg-[#2563EB] px-3 py-1 font-bold text-white"
            >
              Chèn
            </button>
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().unsetLink().run();
                setShowLinkBar(false);
              }}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700"
            >
              Gỡ liên kết
            </button>
            <button
              type="button"
              onClick={() => setShowLinkBar(false)}
              className="p-1 text-slate-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Find & Replace Sub-bar */}
        {showFindBar && !disabled && (
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2 text-xs">
            <input
              type="text"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              placeholder="Tìm cụm từ..."
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs w-40"
            />
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Thay thế bằng..."
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs w-40"
            />
            <button
              type="button"
              onClick={() => handleFindReplace(false)}
              className="inline-flex items-center gap-1 rounded-lg bg-[#2563EB] px-2.5 py-1 font-bold text-white"
            >
              <Replace className="w-3.5 h-3.5" />
              Thay 1 lần
            </button>
            <button
              type="button"
              onClick={() => handleFindReplace(true)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700"
            >
              Thay tất cả
            </button>
            {findMsg && <span className="text-[#1E40AF] font-semibold">{findMsg}</span>}
            <button
              type="button"
              onClick={() => setShowFindBar(false)}
              className="ml-auto p-1 text-slate-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Editable Canvas */}
        <div className={fullscreen ? 'flex-1 overflow-y-auto studio-scroll' : ''}>
          <EditorContent editor={editor} />
        </div>

        {/* Non-destructive Proofreading Hints Strip */}
        {proofreadHints.length > 0 && (
          <div className="px-3 py-1.5 bg-amber-50/70 border-t border-amber-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-900">
            <div>
              <strong>Gợi ý kiểm tra trình bày:</strong>{' '}
              {proofreadHints.map((h) => h.message).join(' · ')}
            </div>
            <button
              type="button"
              onClick={() => setErrorIdentificationMode(true)}
              className="font-semibold text-amber-800 hover:underline whitespace-nowrap"
            >
              Tắt gợi ý (câu tìm lỗi sai)
            </button>
          </div>
        )}

        {/* Optional Apply / Cancel Footer with Unsaved Warning */}
        {showApplyCancel && !disabled && (
          <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 rounded-b-xl">
            {confirmDiscard ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-rose-800 font-semibold">
                <span>Có thay đổi chưa lưu. Bạn chắc chắn muốn hủy bỏ?</span>
                <button
                  type="button"
                  onClick={handleConfirmDiscard}
                  className="rounded-lg bg-rose-600 px-2.5 py-1 text-white font-bold"
                >
                  Hủy thay đổi
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(false)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-slate-700"
                >
                  Tiếp tục sửa
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-slate-500">
                {isDirty ? 'Đã chỉnh sửa (tự lưu bản nháp tạm)' : 'Chưa có thay đổi mới'}
              </span>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={handleCancelRequest}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApplyClick}
                className="inline-flex items-center gap-1 rounded-lg bg-[#2563EB] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#1E40AF]"
              >
                <Check className="w-3.5 h-3.5" />
                Áp dụng
              </button>
            </div>
          </div>
        )}

        <input
          ref={imgInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleUploadImage}
          className="hidden"
        />
        {allowAudio && (
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm"
            onChange={handleUploadAudio}
            className="hidden"
          />
        )}
      </div>
    </div>
  );
};
