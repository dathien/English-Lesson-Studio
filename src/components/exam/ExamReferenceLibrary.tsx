import React, {useRef, useState} from 'react';
import {
  Archive,
  BookOpen,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  GraduationCap,
  Headphones,
  MonitorPlay,
  ShieldCheck,
  Timer,
  Trash2,
  Upload,
} from 'lucide-react';
import type {HighSchoolGrade} from '../../types/lesson';
import type {ExamDossier, SourceReference} from '../../types/exam';
import {DEFAULT_EXPORT_OPTIONS} from '../../types/exam';
import {
  ALL_GRADUATION_EXAM_PACKS,
  ALL_PERIODIC_EXAM_PACKS,
} from '../../data/examSamples';
import {
  GRADUATION_2025_STRUCTURE_NOTE,
  OFFICIAL_SOURCE_REFERENCES,
} from '../../data/examCurriculum';
import {downloadFullExamZip} from '../../services/examExporters';
import {processUploadedFiles} from '../../services/documentParser';

interface ExamReferenceLibraryProps {
  teacherReferences: SourceReference[];
  onAddTeacherReference: (ref: SourceReference) => void;
  onRemoveTeacherReference: (id: string) => void;
  onOpenDossierInWorkspace: (dossier: ExamDossier, duplicateAsOwn?: boolean) => void;
  onPresentDossier: (dossier: ExamDossier) => void;
  onPracticeDossier: (dossier: ExamDossier) => void;
}

export const ExamReferenceLibrary: React.FC<ExamReferenceLibraryProps> = ({
  teacherReferences,
  onAddTeacherReference,
  onRemoveTeacherReference,
  onOpenDossierInWorkspace,
  onPresentDossier,
  onPracticeDossier,
}) => {
  const [activeTab, setActiveTab] = useState<'periodic' | 'graduation' | 'sources'>('periodic');
  const [gradeFilter, setGradeFilter] = useState<HighSchoolGrade | 'all'>('all');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);

  const periodicFiltered = ALL_PERIODIC_EXAM_PACKS.filter(
    (p) => gradeFilter === 'all' || p.scope.grade === gradeFilter,
  );

  const handleQuickZip = async (dossier: ExamDossier) => {
    setExportingId(dossier.id);
    try {
      await downloadFullExamZip(dossier, {
        ...DEFAULT_EXPORT_OPTIONS,
        selectedCodes: [dossier.exam.header.examCode || '101'],
      });
    } finally {
      setExportingId(null);
    }
  };

  const handleUploadReferenceDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadingRef(true);
    setUploadFeedback(null);
    try {
      let preview = '';
      if (file.name.toLowerCase().endsWith('.txt')) {
        preview = (await file.text()).slice(0, 1200);
      } else {
        const parsed = await processUploadedFiles([file], 12, undefined, false);
        const combined = [
          parsed.title,
          parsed.instructions,
          ...parsed.passages.flatMap((p) => p.paragraphs),
          parsed.transcript,
          ...parsed.questions.slice(0, 6).map((q) => q.prompt),
        ]
          .filter(Boolean)
          .join('\n');
        preview = combined.slice(0, 1200);
      }
      const ref: SourceReference = {
        id: `teacher-ref-${Date.now()}`,
        title: file.name.replace(/\.[^.]+$/, ''),
        category: 'teacher_uploaded',
        description: `Tài liệu gốc do giáo viên tải lên (${file.name}) làm căn cứ ra đề và đối chiếu chuyên môn.`,
        uploadedFileName: file.name,
        uploadedContentPreview: preview || 'Đã lưu tên tài liệu tham khảo gốc của giáo viên.',
        addedAt: Date.now(),
      };
      onAddTeacherReference(ref);
      setUploadFeedback(`Đã thêm tài liệu tham khảo gốc "${file.name}".`);
    } catch (err) {
      setUploadFeedback(
        err instanceof Error
          ? err.message
          : 'Không đọc được nội dung tệp. Hỗ trợ .docx, .pdf, .txt.',
      );
    } finally {
      setUploadingRef(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Tabs */}
      <div className="rounded-[18px] border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
        <div>
          <h2 className="font-display text-xl font-extrabold text-[#0F172A]">
            Kho bộ đề tham khảo &amp; Tài liệu căn cứ chuyên môn
          </h2>
          <p className="text-[15px] text-[#475569] mt-0.5">
            Gồm 12 bộ đề định kỳ THPT lớp 10–11–12, 3 bộ đề ôn thi Tốt nghiệp THPT 40 câu tự biên soạn chuẩn cấu trúc 2025 và danh mục nguồn văn bản chính thức.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('periodic')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              activeTab === 'periodic'
                ? 'bg-[#2563EB] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            12 Bộ đề định kỳ THPT (10–11–12)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('graduation')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              activeTab === 'graduation'
                ? 'bg-[#2563EB] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            3 Bộ đề ôn thi Tốt nghiệp THPT (40 câu)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sources')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              activeTab === 'sources'
                ? 'bg-[#2563EB] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Nguồn tham khảo &amp; Tài liệu của giáo viên ({OFFICIAL_SOURCE_REFERENCES.length + teacherReferences.length})
          </button>
        </div>
      </div>

      {/* TAB 1: 12 PERIODIC EXAM PACKS */}
      {activeTab === 'periodic' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl">
              <button
                type="button"
                onClick={() => setGradeFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                  gradeFilter === 'all' ? 'bg-[#2563EB] text-white' : 'text-slate-600'
                }`}
              >
                Tất cả (12 bộ)
              </button>
              {([10, 11, 12] as HighSchoolGrade[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGradeFilter(g)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    gradeFilter === g ? 'bg-[#2563EB] text-white' : 'text-slate-600'
                  }`}
                >
                  Lớp {g} (4 bộ)
                </button>
              ))}
            </div>
            <p className="text-xs font-medium text-[#475569]">
              Đầy đủ: Ma trận · Bản đặc tả · Đề 10 điểm · Audio Listening phát ngay · Đáp án &amp; Rubric
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {periodicFiltered.map((pack) => {
              const hasListening = pack.exam.groups.some((g) => g.skill === 'listening');
              return (
                <article
                  key={pack.id}
                  className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-xs hover:border-blue-300 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                      <span className="text-[#2563EB]">
                        Lớp {pack.scope.grade} · {pack.scope.textbookName}
                      </span>
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Đủ bộ CV 7991
                      </span>
                    </div>

                    <h3 className="font-display text-[17px] font-extrabold text-[#0F172A] leading-snug">
                      {pack.title}
                    </h3>

                    <p className="text-xs text-[#475569] leading-relaxed">
                      {pack.sourceAttribution}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-600 font-mono-tabular pt-1">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
                        {pack.scope.durationMinutes} phút
                      </span>
                      <span>{pack.exam.questions.length} câu · 10,0 điểm</span>
                      {hasListening && (
                        <span className="inline-flex items-center gap-1 text-cyan-700 font-semibold">
                          <Headphones className="w-3.5 h-3.5" />
                          Listening phát ngay
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onOpenDossierInWorkspace(pack, false)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1E40AF] px-3 py-2 text-xs font-bold text-white hover:opacity-95 whitespace-nowrap"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Mở trọn bộ
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenDossierInWorkspace(pack, true)}
                      title="Nhân bản lưu vào Lịch sử đề của tôi"
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#2563EB]" />
                      Nhân bản
                    </button>
                    <button
                      type="button"
                      onClick={() => onPracticeDossier(pack)}
                      className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 whitespace-nowrap"
                    >
                      <Timer className="w-3.5 h-3.5" />
                      Thi thử
                    </button>
                    <button
                      type="button"
                      onClick={() => onPresentDossier(pack)}
                      className="inline-flex items-center gap-1 rounded-xl border border-cyan-300 bg-cyan-50 px-2.5 py-2 text-xs font-semibold text-cyan-900 hover:bg-cyan-100 whitespace-nowrap"
                    >
                      <MonitorPlay className="w-3.5 h-3.5" />
                      Trình chiếu
                    </button>
                    <button
                      type="button"
                      disabled={exportingId === pack.id}
                      onClick={() => handleQuickZip(pack)}
                      title="Xuất trọn bộ ZIP (Ma trận, Đặc tả, Đề, Đáp án, Excel, OMR)"
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap disabled:opacity-50"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      {exportingId === pack.id ? '...' : 'ZIP'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: 3 GRADUATION 2025 PRACTICE PACKS */}
      {activeTab === 'graduation' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-[#1E40AF] space-y-1">
            <div className="font-bold">
              Cấu trúc chuẩn Đề thi Tốt nghiệp THPT môn Tiếng Anh áp dụng từ năm 2025
            </div>
            <p className="text-slate-700 leading-relaxed">{GRADUATION_2025_STRUCTURE_NOTE}</p>
            <p className="text-xs font-semibold text-amber-800 pt-1">
              Lưu ý minh bạch: Các đề ôn tập dưới đây đều được tự biên soạn mới bám sát cấu trúc 40 câu trắc nghiệm (50 phút, 0,25 điểm/câu) — không mạo danh đề thi gốc chính thức.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {ALL_GRADUATION_EXAM_PACKS.map((pack) => (
              <article
                key={pack.id}
                className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-xs hover:border-blue-300 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-[#2563EB]">
                    Ôn thi Tốt nghiệp THPT · Cấu trúc từ 2025
                  </div>
                  <h3 className="font-display text-[17px] font-extrabold text-[#0F172A] leading-snug">
                    {pack.title}
                  </h3>
                  <p className="text-xs text-[#475569] leading-relaxed">
                    {pack.sourceAttribution}
                  </p>
                  <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs text-slate-700 space-y-1 font-mono-tabular">
                    <div>• 40 câu MCQ × 0,25 điểm = 10,0 điểm</div>
                    <div>• Thời gian làm bài: 50 phút</div>
                    <div>• 6 phần: Notice (6), Leaflet (6), Ordering (5), Cloze (5), Reading 1 (8), Reading 2 (10)</div>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDossierInWorkspace(pack, false)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1E40AF] py-2 text-xs font-bold text-white hover:opacity-95"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Mở bộ đề
                    </button>
                    <button
                      type="button"
                      onClick={() => onPracticeDossier(pack)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      <Timer className="w-3.5 h-3.5" />
                      Thi thử 50p
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onPresentDossier(pack)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan-300 bg-cyan-50 py-2 text-xs font-semibold text-cyan-900 hover:bg-cyan-100"
                    >
                      <MonitorPlay className="w-3.5 h-3.5" />
                      Trình chiếu chữa đề
                    </button>
                    <button
                      type="button"
                      disabled={exportingId === pack.id}
                      onClick={() => handleQuickZip(pack)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      {exportingId === pack.id ? 'Đang nén...' : 'Tải trọn bộ ZIP'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: OFFICIAL SOURCES & TEACHER UPLOADED REFERENCE DOCS */}
      {activeTab === 'sources' && (
        <div className="space-y-5">
          {/* Teacher Upload Box */}
          <div className="rounded-[18px] border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-extrabold text-[#0F172A]">
                  Tài liệu gốc / Đề tham khảo của giáo viên hoặc Sở GD&amp;ĐT
                </h3>
                <p className="text-sm text-[#475569]">
                  Tải lên Công văn hướng dẫn của Sở, khung ma trận trường hoặc đề thi gốc (.docx, .pdf, .txt) để lưu đối chiếu trong hồ sơ.
                </p>
              </div>
              <button
                type="button"
                disabled={uploadingRef}
                onClick={() => refFileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-[#1E40AF] disabled:opacity-50 whitespace-nowrap"
              >
                <Upload className="w-4 h-4" />
                {uploadingRef ? 'Đang đọc tệp...' : 'Tải tài liệu gốc'}
              </button>
              <input
                ref={refFileInputRef}
                type="file"
                accept=".docx,.pdf,.txt"
                onChange={handleUploadReferenceDoc}
                className="hidden"
              />
            </div>

            {uploadFeedback && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 px-3.5 py-2 text-xs font-semibold text-[#1E40AF]">
                {uploadFeedback}
              </div>
            )}

            {teacherReferences.length > 0 && (
              <div className="space-y-2 pt-2">
                {teacherReferences.map((ref) => (
                  <div
                    key={ref.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#0F172A]">
                        <FileText className="w-4 h-4 text-[#2563EB] shrink-0" />
                        <span className="truncate">{ref.title}</span>
                      </div>
                      <p className="text-xs text-[#475569]">{ref.description}</p>
                      {ref.uploadedContentPreview && (
                        <p className="text-xs text-slate-600 line-clamp-2 bg-white border border-slate-200 rounded-lg p-2 mt-1">
                          {ref.uploadedContentPreview}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveTeacherReference(ref.id)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 shrink-0"
                      title="Xóa tài liệu tham khảo này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 7 Official Reference URLs */}
          <div className="rounded-[18px] border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
            <h3 className="font-display text-base font-extrabold text-[#0F172A]">
              7 Nguồn văn bản pháp quy &amp; Đề tham khảo chính thức
            </h3>
            <div className="divide-y divide-slate-100">
              {OFFICIAL_SOURCE_REFERENCES.map((src, idx) => (
                <div
                  key={src.id}
                  className="py-3 flex flex-wrap items-start justify-between gap-3"
                >
                  <div className="space-y-1 max-w-2xl">
                    <div className="text-sm font-bold text-[#0F172A]">
                      {idx + 1}. {src.title}
                    </div>
                    <p className="text-xs text-[#475569] leading-relaxed">{src.description}</p>
                    {src.note && (
                      <p className="text-xs text-blue-700 font-medium">{src.note}</p>
                    )}
                  </div>
                  {src.url && (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#2563EB] hover:bg-blue-50 whitespace-nowrap"
                    >
                      Mở nguồn gốc
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
