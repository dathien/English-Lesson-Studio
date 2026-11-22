import React, {useRef, useState} from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
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
}

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
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pastedText, setPastedText] = useState('');
  const [grade, setGrade] = useState<Grade>(defaultGrade);
  const [skillHint, setSkillHint] = useState<SkillCategory | ''>(defaultSkill || '');
  const [useAIRefinement, setUseAIRefinement] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<ParsedDocumentDraft | null>(null);

  const handleFilesAdded = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const valid = Array.from(fileList).filter((f) =>
      /\.(docx|pdf|jpe?g|png|webp)$/i.test(f.name) ||
      /^image\/(jpeg|png|webp)$/i.test(f.type) ||
      f.type === 'application/pdf',
    );
    setSelectedFiles((prev) => [...prev, ...valid]);
    setErrorMsg(null);
  };

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0 && pastedText.trim().length < 20) {
      setErrorMsg('Vui lòng tải lên tệp DOCX, PDF, ảnh chụp hoặc dán nội dung tài liệu (tối thiểu 20 ký tự).');
      return;
    }

    setProcessing(true);
    setErrorMsg(null);
    setStep(2);

    try {
      let result: ParsedDocumentDraft;
      if (selectedFiles.length > 0) {
        result = await processUploadedFiles(
          selectedFiles,
          grade,
          skillHint || undefined,
          useAIRefinement && aiAvailable,
        );
      } else {
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
    }
  };

  const handleCreateLesson = (mode: 'editor' | 'present') => {
    if (!draft) return;
    const lesson = convertDraftToLesson(draft);
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
    <div className="space-y-5">
      {/* 6-Step Progress Strip */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {[
          {n: 1, label: '1. Tải tài liệu'},
          {n: 2, label: '2. Phân tích cấu trúc'},
          {n: 3, label: '3. Kiểm tra & Chỉnh sửa'},
          {n: 4, label: '4–6. Tạo slide, biên tập & trình chiếu'},
        ].map((item, idx) => (
          <React.Fragment key={item.n}>
            {idx > 0 && <span aria-hidden="true">/</span>}
            <span
              className={
                step === item.n || (step === 3 && item.n === 3)
                  ? 'font-semibold text-[#0F4C81]'
                  : step > item.n
                    ? 'text-emerald-700 font-medium'
                    : 'text-slate-500'
              }
            >
              {item.label}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* STEP 1: Upload / Drag-and-Drop / Paste */}
      {step === 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Drag & Drop File Box */}
            <div className="lg:col-span-7 space-y-3">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFilesAdded(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 hover:border-[#0284C7] hover:bg-sky-50/40 transition-colors p-6 text-center cursor-pointer space-y-2.5"
              >
                <UploadCloud className="w-10 h-10 text-[#0284C7] mx-auto" />
                <div className="font-semibold text-slate-900">
                  Kéo thả hoặc chọn tệp Word (.docx), PDF, hoặc nhiều ảnh chụp (JPG, PNG, WebP)
                </div>
                <p className="text-xs text-slate-500">
                  DOCX giữ nguyên phần gạch chân phát âm (<code className="font-mono-tabular">&lt;u&gt;</code>), bài đọc gốc và câu hỏi chùm. PDF scan &amp; ảnh sử dụng AI thị giác khi trực tuyến.
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

              {selectedFiles.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-600">
                    Tệp đã chọn ({selectedFiles.length}):
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto studio-scroll">
                    {selectedFiles.map((f, idx) => (
                      <div
                        key={`${f.name}-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {f.type.startsWith('image/') ? (
                            <ImageIcon className="w-4 h-4 text-[#0284C7] shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-[#0F4C81] shrink-0" />
                          )}
                          <span className="truncate font-medium text-slate-800">{f.name}</span>
                          <span className="text-slate-400 font-mono-tabular shrink-0">
                            {(f.size / 1024).toFixed(0)} KB
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-slate-400 hover:text-rose-600"
                          title="Xóa tệp"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Or Paste Text directly */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600">
                    Hoặc dán trực tiếp nội dung đề / giáo án (hoạt động 100% offline):
                  </label>
                  <button
                    type="button"
                    onClick={() => setPastedText(SAMPLE_PASTE_TEXT)}
                    className="text-xs font-medium text-[#0284C7] hover:underline"
                  >
                    Điền thử văn bản mẫu
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Dán bài đọc, câu hỏi 1. 2. 3., các phương án A. B. C. D. và đáp án..."
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-[#0284C7]"
                />
              </div>
            </div>

            {/* Configuration Column */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="space-y-3.5">
                <h3 className="font-semibold text-slate-900">Thiết lập chuyển đổi bài giảng</h3>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                    Chọn khối lớp
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/70 rounded-lg">
                    {([10, 11, 12] as Grade[]).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGrade(g)}
                        className={`py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                          grade === g
                            ? 'bg-white text-[#0F4C81] shadow-xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Lớp {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                    Kỹ năng / Phân môn ưu tiên
                  </label>
                  <select
                    value={skillHint}
                    onChange={(e) => setSkillHint(e.target.value as SkillCategory | '')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Tự động nhận diện theo cấu trúc tài liệu</option>
                    {(Object.keys(SKILL_LABELS) as SkillCategory[]).map((sk) => (
                      <option key={sk} value={sk}>
                        {SKILL_LABELS[sk]}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-start gap-2.5 text-xs text-slate-700 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAIRefinement}
                    disabled={!aiAvailable}
                    onChange={(e) => setUseAIRefinement(e.target.checked)}
                    className="mt-0.5 accent-[#0284C7]"
                  />
                  <span>
                    <strong className="font-semibold">Tăng cường phân tích cấu trúc bằng AI</strong>{' '}
                    ({aiAvailable ? 'Đang khả dụng trực tuyến' : 'Đang ngoại tuyến / chưa kích hoạt — hệ thống dùng bộ phân tích cục bộ'}).
                  </span>
                </label>
              </div>

              <div className="space-y-2">
                {errorMsg && (
                  <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={processing}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F4C81] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0B3A63] disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  Phân tích &amp; Tạo bài trình chiếu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Processing */}
      {step === 2 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#0284C7] animate-spin mx-auto" />
          <h3 className="text-lg font-semibold text-slate-900">
            Đang đọc và phân tích cấu trúc tài liệu...
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Hệ thống đang trích xuất tiêu đề, bài đọc, phần gạch chân phát âm, câu hỏi chùm và đáp án mà không làm thay đổi nội dung đề gốc.
          </p>
        </div>
      )}

      {/* STEP 3: Verification & Direct Editing before Generating Slides */}
      {step === 3 && draft && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Bước 3 · Kiểm tra &amp; Chỉnh sửa nội dung trích xuất
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Nguồn: {draft.sourceFiles.join(', ')} · {draft.passages.length} bài đọc ·{' '}
                {draft.questions.length} câu hỏi ·{' '}
                {draft.usedAI ? 'Đã phân tích qua AI thị giác/ngôn ngữ' : 'Phân tích cấu trúc cục bộ'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                Tải lại tệp khác
              </button>
              <button
                type="button"
                onClick={() => handleCreateLesson('editor')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#0F4C81] px-4 py-2 text-sm font-semibold text-[#0F4C81] hover:bg-sky-50 whitespace-nowrap"
              >
                <Layers className="w-4 h-4" />
                Tạo &amp; Mở Trình biên tập
              </button>
              <button
                type="button"
                onClick={() => handleCreateLesson('present')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B3A63] whitespace-nowrap"
              >
                Tạo &amp; Trình chiếu ngay
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Warnings (honest notice for missing answers or unavailable OCR) */}
          {draft.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 space-y-1.5 text-sm text-amber-950">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Lưu ý kiểm tra từ hệ thống phân tích
              </div>
              <ul className="list-disc pl-6 space-y-1 text-xs">
                {draft.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Metadata Edit */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Tiêu đề bài giảng</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft({...draft, title: e.target.value})}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Kỹ năng chính</label>
              <select
                value={draft.skill}
                onChange={(e) => setDraft({...draft, skill: e.target.value as SkillCategory})}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
              <span className="text-xs font-semibold text-slate-600">
                Hình ảnh trích xuất ({draft.extractedImages.length}):
              </span>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {draft.extractedImages.map((img, idx) => (
                  <img
                    key={idx}
                    src={img.dataUrl}
                    alt={img.name}
                    className="h-24 w-36 object-cover rounded-lg border border-slate-200 shrink-0"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Intact Reading Passages Review */}
          {draft.passages.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-[#0F4C81] text-sm">
                Đoạn đọc hiểu giữ nguyên văn ({draft.passages.length})
              </h4>
              {draft.passages.map((p, pIdx) => (
                <div key={pIdx} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2">
                  <input
                    type="text"
                    value={p.title || ''}
                    onChange={(e) => {
                      const next = structuredClone(draft);
                      next.passages[pIdx].title = e.target.value;
                      setDraft(next);
                    }}
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-semibold"
                  />
                  <textarea
                    rows={4}
                    value={p.paragraphs.join('\n\n')}
                    onChange={(e) => {
                      const next = structuredClone(draft);
                      next.passages[pIdx].paragraphs = e.target.value
                        .split(/\n{2,}/)
                        .map((x) => x.trim())
                        .filter(Boolean);
                      setDraft(next);
                    }}
                    className="w-full rounded border border-slate-300 bg-white p-2.5 text-sm leading-relaxed"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Extracted Questions Verification List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-[#0F4C81] text-sm">
                Câu hỏi đã nhận diện ({draft.questions.length})
              </h4>
              <button
                type="button"
                onClick={addEmptyQuestion}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm câu hỏi thủ công
              </button>
            </div>

            {draft.questions.length === 0 ? (
              <p className="text-sm text-slate-500 italic">
                Chưa có câu hỏi nào được trích xuất. Bạn có thể bấm "Thêm câu hỏi thủ công" hoặc tạo slide ngay từ hình ảnh / bài đọc đã trích xuất.
              </p>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto studio-scroll pr-1">
                {draft.questions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className={`rounded-xl border p-3.5 space-y-2.5 ${
                      q.uncertain
                        ? 'border-amber-300 bg-amber-50/40'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-[#0F4C81]">Question {q.number}</span>
                        {q.uncertain ? (
                          <span className="inline-flex items-center gap-1 text-amber-800 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Cần kiểm tra đáp án / nội dung
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
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
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
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
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                    />

                    {/* Preview rendered underlines so teacher verifies exact underlined characters */}
                    {(q.prompt.includes('<u>') || q.options?.some((o) => o.text.includes('<u>'))) && (
                      <div className="text-xs text-slate-600 bg-sky-50/70 border border-sky-200 rounded-lg px-2.5 py-1.5">
                        <span className="font-semibold text-[#0F4C81] mr-1.5">Xem trước gạch chân:</span>
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
                              className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
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
                        className="rounded border border-emerald-300 bg-white px-2.5 py-1.5 text-xs"
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
                        className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
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
