import React, {useRef, useState} from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import type {
  ActivityType,
  Grade,
  LessonProject,
  ParsedDocumentDraft,
  QuestionType,
  SkillCategory,
} from '../types/lesson';
import {SKILL_LABELS} from '../types/lesson';
import {
  convertDraftToLesson,
  parseStructuredEnglishText,
  processUploadedFiles,
} from '../services/documentParser';
import {RenderFormattedText} from '../utils/richText';

interface ImportWizardProps {
  defaultGrade: Grade;
  defaultSkill?: SkillCategory;
  aiAvailable: boolean;
  onLessonCreated: (lesson: LessonProject, openMode: 'editor' | 'present') => void;
  onGradeChange?: (grade: Grade) => void;
}

const LESSON_TYPE_OPTIONS: Array<{value: '' | ActivityType; label: string}> = [
  {value: '', label: 'Tự động theo cấu trúc tài liệu'},
  {value: 'reading_mcq', label: 'Đọc hiểu & Trắc nghiệm'},
  {value: 'listening_mcq', label: 'Nghe hiểu (Listening)'},
  {value: 'speaking_discussion', label: 'Luyện nói & Thảo luận'},
  {value: 'writing_essay', label: 'Luyện viết đoạn / Bài luận'},
  {value: 'grammar_mcq', label: 'Luyện tập Ngữ pháp'},
  {value: 'pron_ed_s', label: 'Phát âm gạch chân / Trọng âm'},
  {value: 'vocab_flashcards', label: 'Từ vựng & Flashcards IPA'},
  {value: 'review_mixed', label: 'Đề ôn tập / Kiểm tra tổng hợp'},
];

const SAMPLE_PASTE_TEXT = `UNIT 1: PRONUNCIATION & READING PRACTICE
Read the following passage and mark the letter A, B, C, or D on your answer sheet.
Urban rooftop gardens are transforming crowded high-rise districts into cooler, greener neighbourhoods. By collecting rainwater and shading concrete roofs, these shared spaces lower indoor temperatures during hot summer afternoons while giving students hands-on lessons in sustainable food growing.

1. What is one direct environmental benefit of rooftop gardens mentioned in the passage?
A. They increase traffic speed in crowded districts.
B. They lower indoor temperatures and collect rainwater.
C. They replace all public parks in major cities.
D. They eliminate the need for school science labs.
Answer: B
Explanation: Đoạn văn nêu rõ "By collecting rainwater and shading concrete roofs, these shared spaces lower indoor temperatures".

2. Choose the word whose underlined part is pronounced differently:
A. work<u>ed</u>   B. watch<u>ed</u>   C. stopp<u>ed</u>   D. play<u>ed</u>
Answer: D
Explanation: A, B, C phát âm đuôi -ed là /t/; riêng D (played) phát âm là /d/.`;

export const ImportWizard: React.FC<ImportWizardProps> = ({
  defaultGrade,
  defaultSkill,
  aiAvailable,
  onLessonCreated,
  onGradeChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pastedText, setPastedText] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [grade, setGrade] = useState<Grade>(defaultGrade);
  const [skillHint, setSkillHint] = useState<SkillCategory | ''>(defaultSkill || '');
  const [activityHint, setActivityHint] = useState<'' | ActivityType>('');
  const [useAIRefinement, setUseAIRefinement] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<ParsedDocumentDraft | null>(null);

  const handleFilesAdded = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const valid = Array.from(fileList).filter(
      (f) =>
        /\.(docx|pdf|jpe?g|png|webp)$/i.test(f.name) ||
        /^image\/(jpeg|png|webp)$/i.test(f.type) ||
        f.type === 'application/pdf',
    );
    if (valid.length === 0) {
      setErrorMsg('Định dạng tệp chưa được hỗ trợ. Vui lòng chọn DOCX, PDF hoặc ảnh JPG/PNG/WebP.');
      return;
    }
    setSelectedFiles((prev) => [...prev, ...valid]);
    setErrorMsg(null);
  };

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0 && pastedText.trim().length < 20) {
      setErrorMsg(
        'Vui lòng tải lên tệp Word (.docx), PDF, ảnh chụp hoặc dán nội dung tài liệu (tối thiểu 20 ký tự).',
      );
      return;
    }

    setProcessing(true);
    setErrorMsg(null);
    setStep(2);

    try {
      let result: ParsedDocumentDraft;
      if (selectedFiles.length > 0) {
        setProcessingStage(
          `Đang trích xuất nội dung từ ${selectedFiles.length} tệp (${selectedFiles.map((f) => f.name).join(', ')})...`,
        );
        result = await processUploadedFiles(
          selectedFiles,
          grade,
          skillHint || undefined,
          useAIRefinement && aiAvailable,
        );
      } else {
        setProcessingStage('Đang phân tích cấu trúc đoạn văn, câu hỏi và đáp án từ văn bản dán...');
        result = parseStructuredEnglishText(pastedText, {
          grade,
          skillHint: skillHint || undefined,
        });
      }
      setDraft(result);
      setStep(3);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không thể đọc tệp tài liệu. Vui lòng kiểm tra lại định dạng DOCX/PDF/ảnh.',
      );
      setStep(1);
    } finally {
      setProcessing(false);
      setProcessingStage('');
    }
  };

  const handleCreateLesson = (mode: 'editor' | 'present') => {
    if (!draft) return;
    const lesson = convertDraftToLesson(draft);
    if (activityHint) {
      lesson.activityFocus = activityHint;
    }
    onLessonCreated(lesson, mode);
  };

  const addEmptyQuestion = () => {
    if (!draft) return;
    const nextNum =
      draft.questions.length > 0
        ? Math.max(...draft.questions.map((q) => q.number)) + 1
        : 1;
    setDraft({
      ...draft,
      questions: [
        ...draft.questions,
        {
          id: `manual-q-${Date.now()}`,
          number: nextNum,
          type: 'mcq',
          prompt: `Nội dung câu hỏi ${nextNum}`,
          options: [
            {id: 'a', label: 'A', text: 'Phương án A'},
            {id: 'b', label: 'B', text: 'Phương án B'},
            {id: 'c', label: 'C', text: 'Phương án C'},
            {id: 'd', label: 'D', text: 'Phương án D'},
          ],
          correctAnswer: '',
          explanation: '',
          uncertain: true,
        },
      ],
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* STEP 1: Elevated Hero Upload & Conversion Studio Card */}
      {step === 1 && (
        <div className="h-full rounded-[20px] border border-slate-200/90 bg-white p-5 sm:p-6 shadow-lg shadow-blue-950/5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">
                  Tải tài liệu &amp; Tạo bài trình chiếu
                </h2>
                <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
                  Hỗ trợ Word (.docx), PDF và nhiều ảnh chụp đề bài
                </p>
              </div>
              <span className="text-xs font-semibold text-[#2563EB] shrink-0">
                Bước 1 / 3
              </span>
            </div>

            {/* Drag & Drop Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFilesAdded(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-5 text-center cursor-pointer transition-all duration-200 space-y-2 ${
                isDragging
                  ? 'border-[#2563EB] bg-blue-50/90 scale-[1.01]'
                  : 'border-blue-200 bg-[#F8FAFC] hover:border-[#2563EB] hover:bg-blue-50/40'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-100/80 text-[#2563EB] flex items-center justify-center mx-auto">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="font-semibold text-[15px] text-[#0F172A]">
                Kéo thả tệp vào đây hoặc nhấn để chọn tệp
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                DOCX giữ nguyên gạch chân <code className="font-mono-tabular">&lt;u&gt;</code> và đoạn đọc hiểu · PDF &amp; ảnh chụp JPG/PNG/WebP
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".docx,.pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => handleFilesAdded(e.target.files)}
                className="hidden"
              />
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-1.5 max-h-28 overflow-y-auto studio-scroll">
                {selectedFiles.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {f.type.startsWith('image/') ? (
                        <ImageIcon className="w-4 h-4 text-[#06B6D4] shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-[#2563EB] shrink-0" />
                      )}
                      <span className="truncate font-semibold text-[#0F172A]">{f.name}</span>
                      <span className="text-slate-400 font-mono-tabular shrink-0">
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1"
                      title="Xóa tệp"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Collapsible Direct Text Paste (Offline friendly) */}
            <div className="rounded-xl border border-slate-200/80 bg-[#F8FAFC]/70">
              <button
                type="button"
                onClick={() => setPasteOpen((v) => !v)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs font-semibold text-[#475569] hover:text-[#0F172A]"
              >
                <span className="inline-flex items-center gap-1.5">
                  <ClipboardPaste className="w-3.5 h-3.5 text-[#2563EB]" />
                  Hoặc dán trực tiếp nội dung văn bản / đề bài
                  {pastedText.trim().length > 0 && (
                    <span className="text-[#10B981]">({pastedText.trim().length} ký tự)</span>
                  )}
                </span>
                {pasteOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {pasteOpen && (
                <div className="px-3.5 pb-3 space-y-2 border-t border-slate-200/70 pt-2.5">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setPastedText(SAMPLE_PASTE_TEXT)}
                      className="text-xs font-semibold text-[#2563EB] hover:underline"
                    >
                      Điền thử văn bản mẫu
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Dán bài đọc, câu hỏi 1. 2. 3., các phương án A. B. C. D. và đáp án..."
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm outline-none focus:border-[#2563EB]"
                  />
                </div>
              )}
            </div>

            {/* Grade Selector */}
            <div>
              <label className="text-xs font-semibold text-[#475569] block mb-1.5">
                Chọn khối lớp
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                {([10, 11, 12] as Grade[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setGrade(g);
                      onGradeChange?.(g);
                    }}
                    className={`py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                      grade === g
                        ? 'bg-white text-[#2563EB] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Lớp {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Skill & Lesson Type 2-Column Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#475569] block mb-1.5">
                  Chọn kỹ năng
                </label>
                <select
                  value={skillHint}
                  onChange={(e) => setSkillHint(e.target.value as SkillCategory | '')}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-[#0F172A] outline-none focus:border-[#2563EB]"
                >
                  <option value="">Tự động nhận diện</option>
                  {(Object.keys(SKILL_LABELS) as SkillCategory[]).map((sk) => (
                    <option key={sk} value={sk}>
                      {SKILL_LABELS[sk]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#475569] block mb-1.5">
                  Chọn dạng bài
                </label>
                <select
                  value={activityHint}
                  onChange={(e) => setActivityHint(e.target.value as '' | ActivityType)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-[#0F172A] outline-none focus:border-[#2563EB]"
                >
                  {LESSON_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value || 'auto'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Optional AI Structuring Toggle */}
            <label className="flex items-start gap-2.5 text-xs text-[#475569] cursor-pointer">
              <input
                type="checkbox"
                checked={useAIRefinement}
                disabled={!aiAvailable}
                onChange={(e) => setUseAIRefinement(e.target.checked)}
                className="mt-0.5 accent-[#2563EB]"
              />
              <span>
                <strong className="font-semibold text-[#0F172A]">Tăng cường phân tích cấu trúc AI</strong>{' '}
                ({aiAvailable ? 'khả dụng trực tuyến' : 'đang ngoại tuyến — dùng bộ phân tích cục bộ'})
              </span>
            </label>
          </div>

          <div className="space-y-2.5 pt-2">
            {errorMsg && (
              <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5">
                {errorMsg}
              </p>
            )}

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={processing}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1E40AF] px-5 py-3.5 text-[15px] font-bold text-white shadow-md shadow-blue-600/20 hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              Tạo bài trình chiếu
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Real Async Processing & Skeleton Loading State */}
      {step === 2 && (
        <div className="h-full rounded-[20px] border border-slate-200 bg-white p-6 sm:p-8 shadow-lg shadow-blue-950/5 flex flex-col justify-center space-y-6">
          <div className="text-center space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-[#0F172A]">
              Đang xử lý tài liệu thực tế...
            </h3>
            <p className="text-sm text-[#475569] max-w-md mx-auto">
              {processingStage || 'Hệ thống đang trích xuất tiêu đề, bài đọc, gạch chân phát âm và danh sách câu hỏi.'}
            </p>
          </div>

          {/* Genuine Skeleton Preview while waiting for async parser/OCR */}
          <div className="space-y-3 pt-2">
            <div className="h-4 w-2/5 rounded-lg studio-skeleton" />
            <div className="h-16 w-full rounded-2xl studio-skeleton" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-12 rounded-xl studio-skeleton" />
              <div className="h-12 rounded-xl studio-skeleton" />
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Verification & Direct Editing before Generating Slides */}
      {step === 3 && draft && (
        <div className="rounded-[20px] border border-slate-200 bg-white p-5 sm:p-6 shadow-lg shadow-blue-950/5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="text-xs font-bold text-[#2563EB]">Bước 3 / 3 · Xác nhận nội dung</div>
              <h3 className="text-lg font-bold text-[#0F172A] mt-0.5">
                Kiểm tra &amp; Chỉnh sửa nội dung trích xuất
              </h3>
              <p className="text-xs text-[#475569] mt-0.5">
                {draft.sourceFiles.join(', ')} · {draft.passages.length} bài đọc ·{' '}
                {draft.questions.length} câu hỏi ·{' '}
                {draft.usedAI ? 'Phân tích AI thị giác/ngôn ngữ' : 'Phân tích cấu trúc cục bộ'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                Tải lại
              </button>
              <button
                type="button"
                onClick={() => handleCreateLesson('editor')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#2563EB] px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#2563EB] hover:bg-blue-50 whitespace-nowrap"
              >
                <Layers className="w-4 h-4" />
                Mở Biên tập
              </button>
              <button
                type="button"
                onClick={() => handleCreateLesson('present')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1E40AF] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:opacity-95 whitespace-nowrap"
              >
                Trình chiếu ngay
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {draft.warnings.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 space-y-1.5 text-sm text-amber-950">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Lưu ý kiểm tra từ bộ phân tích
              </div>
              <ul className="list-disc pl-6 space-y-1 text-xs">
                {draft.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Metadata Edit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-[#475569] block mb-1">Tiêu đề bài giảng</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft({...draft, title: e.target.value})}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#475569] block mb-1">Kỹ năng chính</label>
              <select
                value={draft.skill}
                onChange={(e) => setDraft({...draft, skill: e.target.value as SkillCategory})}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
              >
                {(Object.keys(SKILL_LABELS) as SkillCategory[]).map((sk) => (
                  <option key={sk} value={sk}>
                    {SKILL_LABELS[sk]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Extracted Images Preview */}
          {draft.extractedImages.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[#475569]">
                Hình ảnh trích xuất ({draft.extractedImages.length}):
              </span>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {draft.extractedImages.map((img, idx) => (
                  <img
                    key={idx}
                    src={img.dataUrl}
                    alt={img.name}
                    className="h-20 w-32 object-cover rounded-xl border border-slate-200 shrink-0"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Intact Reading Passages Review */}
          {draft.passages.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="font-bold text-[#1E40AF] text-sm">
                Đoạn đọc hiểu giữ nguyên văn ({draft.passages.length})
              </h4>
              {draft.passages.map((p, pIdx) => (
                <div key={pIdx} className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3.5 space-y-2">
                  <input
                    type="text"
                    value={p.title || ''}
                    onChange={(e) => {
                      const next = structuredClone(draft);
                      next.passages[pIdx].title = e.target.value;
                      setDraft(next);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-semibold"
                  />
                  <textarea
                    rows={3}
                    value={p.paragraphs.join('\n\n')}
                    onChange={(e) => {
                      const next = structuredClone(draft);
                      next.passages[pIdx].paragraphs = e.target.value
                        .split(/\n{2,}/)
                        .map((x) => x.trim())
                        .filter(Boolean);
                      setDraft(next);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm leading-relaxed"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Extracted Questions Verification List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-[#1E40AF] text-sm">
                Câu hỏi đã nhận diện ({draft.questions.length})
              </h4>
              <button
                type="button"
                onClick={addEmptyQuestion}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm câu hỏi
              </button>
            </div>

            {draft.questions.length === 0 ? (
              <p className="text-sm text-[#475569] italic">
                Chưa có câu hỏi nào được trích xuất. Bạn có thể bấm "Thêm câu hỏi" hoặc tạo slide ngay từ bài đọc / ảnh đã trích xuất.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto studio-scroll pr-1">
                {draft.questions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className={`rounded-2xl border p-3.5 space-y-2.5 ${
                      q.uncertain
                        ? 'border-amber-300 bg-amber-50/40'
                        : 'border-slate-200 bg-[#F8FAFC]/60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-[#2563EB]">Question {q.number}</span>
                        {q.uncertain ? (
                          <span className="inline-flex items-center gap-1 text-amber-800 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Cần kiểm tra
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#10B981] font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Đã xác nhận
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={q.type}
                          onChange={(e) => {
                            const next = structuredClone(draft);
                            next.questions[qIdx].type = e.target.value as QuestionType;
                            setDraft(next);
                          }}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                        >
                          <option value="mcq">Trắc nghiệm (MCQ)</option>
                          <option value="pronunciation_underlined">Phát âm gạch chân</option>
                          <option value="true_false">True / False</option>
                          <option value="gap_fill">Điền từ</option>
                          <option value="transformation">Viết lại câu</option>
                          <option value="error_correction">Tìm lỗi sai</option>
                          <option value="word_order">Sắp xếp từ</option>
                          <option value="short_answer">Trả lời ngắn</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const next = structuredClone(draft);
                            next.questions.splice(qIdx, 1);
                            setDraft(next);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600"
                          title="Xóa câu hỏi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={q.prompt}
                      onChange={(e) => {
                        const next = structuredClone(draft);
                        next.questions[qIdx].prompt = e.target.value;
                        setDraft(next);
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm"
                    />

                    {(q.prompt.includes('<u>') || q.options?.some((o) => o.text.includes('<u>'))) && (
                      <div className="text-xs text-slate-600 bg-blue-50/70 border border-blue-200 rounded-xl px-3 py-1.5">
                        <span className="font-semibold text-[#1E40AF] mr-1.5">Xem trước gạch chân:</span>
                        <RenderFormattedText text={q.prompt} />{' '}
                        {q.options?.map((o) => (
                          <span key={o.id} className="ml-3">
                            <strong>{o.label}.</strong> <RenderFormattedText text={o.text} />
                          </span>
                        ))}
                      </div>
                    )}

                    {q.options && q.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, oIdx) => (
                          <div key={opt.id} className="flex items-center gap-1.5">
                            <span className="text-xs font-bold w-5">{opt.label}.</span>
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => {
                                const next = structuredClone(draft);
                                if (next.questions[qIdx].options) {
                                  next.questions[qIdx].options![oIdx].text = e.target.value;
                                }
                                setDraft(next);
                              }}
                              className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={q.correctAnswer}
                        onChange={(e) => {
                          const next = structuredClone(draft);
                          next.questions[qIdx].correctAnswer = e.target.value;
                          next.questions[qIdx].uncertain = !e.target.value.trim();
                          setDraft(next);
                        }}
                        placeholder="Đáp án đúng..."
                        className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={q.explanation || ''}
                        onChange={(e) => {
                          const next = structuredClone(draft);
                          next.questions[qIdx].explanation = e.target.value;
                          setDraft(next);
                        }}
                        placeholder="Giải thích (tùy chọn)..."
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
