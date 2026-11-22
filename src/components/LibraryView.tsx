import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  BookOpen,
  BookMarked,
  Check,
  ClipboardCheck,
  Clock,
  Copy,
  Edit3,
  FileDown,
  FilePlus2,
  Headphones,
  Layers,
  Mic,
  PenTool,
  Play,
  Printer,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import type {EducationLevel, Grade, LessonProject, SkillCategory} from '../types/lesson';
import {EDUCATION_LEVEL_SHORT, getEducationLevelFromGrade} from '../types/lesson';
import {SKILL_SHORT_LABELS} from '../types/lesson';
import {
  exportLessonToPowerPoint,
  exportLessonToWord,
  printLessonAsPDF,
} from '../services/exporters';
import {exportLessonAsJson, importLessonFromJsonFile} from '../services/storage';

interface LibraryViewProps {
  initialTab?: 'samples' | 'saved';
  selectedGrade: Grade;
  onSelectGrade: (g: Grade) => void;
  sampleLessons: LessonProject[];
  savedLessons: LessonProject[];
  loadingSaved?: boolean;
  onPresent: (lesson: LessonProject) => void;
  onEdit: (lesson: LessonProject) => void;
  onCreateNew: () => void;
  onOpenAssessment: () => void;
  onDuplicateToSaved: (lesson: LessonProject) => Promise<void>;
  onDeleteSaved: (id: string) => Promise<void>;
  onImportedJson: (lesson: LessonProject) => void;
}

export const SKILL_VISUAL_META: Record<
  SkillCategory,
  {icon: React.ComponentType<{className?: string}>; iconBg: string; iconColor: string; label: string}
> = {
  listening: {
    icon: Headphones,
    iconBg: 'bg-blue-50',
    iconColor: 'text-[#2563EB]',
    label: 'Listening',
  },
  speaking: {
    icon: Mic,
    iconBg: 'bg-cyan-50',
    iconColor: 'text-[#0891B2]',
    label: 'Speaking',
  },
  reading: {
    icon: BookOpen,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-[#059669]',
    label: 'Reading',
  },
  writing: {
    icon: PenTool,
    iconBg: 'bg-orange-50',
    iconColor: 'text-[#EA580C]',
    label: 'Writing',
  },
  vocabulary: {
    icon: BookMarked,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-[#1E40AF]',
    label: 'Vocabulary',
  },
  grammar: {
    icon: Layers,
    iconBg: 'bg-sky-50',
    iconColor: 'text-[#0284C7]',
    label: 'Grammar',
  },
  pronunciation: {
    icon: Volume2,
    iconBg: 'bg-teal-50',
    iconColor: 'text-[#0D9488]',
    label: 'Pronunciation',
  },
  review: {
    icon: Sparkles,
    iconBg: 'bg-amber-50',
    iconColor: 'text-[#D97706]',
    label: 'Ôn tập',
  },
};

export function getLessonDurationLabel(lesson: LessonProject): string | null {
  const totalSec = lesson.slides.reduce((sum, s) => {
    if (s.audio?.durationSec && s.audio.durationSec > 0) {
      return sum + Math.round(s.audio.durationSec);
    }
    const maxEnd = (s.audio?.timestamps || []).reduce(
      (max, ts) => (typeof ts.endSec === 'number' && ts.endSec > max ? ts.endSec : max),
      0,
    );
    return sum + (maxEnd > 0 ? Math.round(maxEnd) : 0);
  }, 0);
  if (totalSec <= 0) return null;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return mins > 0 ? `${mins}p ${String(secs).padStart(2, '0')}s` : `${secs}s`;
}

const FILTER_SKILLS: Array<SkillCategory | 'all'> = [
  'all',
  'listening',
  'speaking',
  'reading',
  'writing',
  'vocabulary',
  'grammar',
  'pronunciation',
  'review',
];

export const LibraryView: React.FC<LibraryViewProps> = ({
  initialTab = 'samples',
  selectedGrade,
  onSelectGrade,
  sampleLessons,
  savedLessons,
  loadingSaved = false,
  onPresent,
  onEdit,
  onCreateNew,
  onOpenAssessment,
  onDuplicateToSaved,
  onDeleteSaved,
  onImportedJson,
}) => {
  const [tab, setTab] = useState<'samples' | 'saved'>(initialTab);
  const [skillFilter, setSkillFilter] = useState<SkillCategory | 'all'>('all');
  const [gradeScope, setGradeScope] = useState<Grade | 'all'>('all');
  const [savedLevelFilter, setSavedLevelFilter] = useState<EducationLevel | 'all'>('all');
  const [query, setQuery] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const sourceList = tab === 'samples' ? sampleLessons : savedLessons;

  const filtered = useMemo(() => {
    return sourceList.filter((item) => {
      if (tab === 'samples') {
        if (gradeScope !== 'all' && item.grade !== gradeScope) return false;
      } else {
        if (savedLevelFilter !== 'all') {
          const itemLevel = item.educationLevel || getEducationLevelFromGrade(item.grade);
          if (itemLevel !== savedLevelFilter) return false;
        }
      }
      if (skillFilter !== 'all' && item.skill !== skillFilter) return false;
      if (
        query.trim() &&
        !`${item.title} ${item.topic} ${item.description}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [sourceList, tab, gradeScope, savedLevelFilter, skillFilter, query]);

  const handleJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const imported = await importLessonFromJsonFile(file);
      onImportedJson(imported);
      setTab('saved');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Tệp dự án không hợp lệ.');
    } finally {
      e.target.value = '';
    }
  };

  const handleCopy = async (lesson: LessonProject) => {
    await onDuplicateToSaved(lesson);
    setCopiedId(lesson.id);
    window.setTimeout(() => setCopiedId((curr) => (curr === lesson.id ? null : curr)), 2200);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 space-y-6">
      {/* Header Row */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="text-xs font-bold text-[#2563EB]">
            {tab === 'samples' ? 'Kho bài mẫu THPT 10 · 11 · 12' : 'Không gian lưu trữ cục bộ (IndexedDB)'}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0F172A]">
            {tab === 'samples' ? 'Kho bài mẫu Tiếng Anh chuẩn GDPT 2018' : 'Bài giảng của tôi'}
          </h1>
          <p className="text-[15px] text-[#475569]">
            {tab === 'samples'
              ? `${sampleLessons.length} bài mẫu tự biên soạn — gồm 9 bài Listening nghe ngay cùng Speaking, Reading, Writing, Vocabulary, Grammar và Pronunciation.`
              : `Quản lý ${savedLessons.length} bài giảng đã tạo, chỉnh sửa hoặc sao chép — luôn sẵn sàng trình chiếu ngay cả khi ngoại tuyến.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileRef}
            type="file"
            accept=".json,.ess.json,application/json"
            onChange={handleJsonUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={onOpenAssessment}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap transition-colors"
          >
            <ClipboardCheck className="w-4 h-4 text-[#2563EB]" />
            Tạo đề kiểm tra
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap transition-colors"
          >
            <Upload className="w-4 h-4 text-[#0891B2]" />
            Nhập JSON
          </button>
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 whitespace-nowrap transition-opacity"
          >
            <FilePlus2 className="w-4 h-4" />
            Tạo bài mới
          </button>
        </div>
      </div>

      {importError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {importError}
        </div>
      )}

      {/* Multi-Facet Filter Bar */}
      <div className="rounded-[18px] border border-slate-200/90 bg-white p-4 shadow-xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Source Tab Switcher + Grade Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setTab('samples')}
                className={`px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                  tab === 'samples'
                    ? 'bg-white text-[#2563EB] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kho bài mẫu ({sampleLessons.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('saved')}
                className={`px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                  tab === 'saved'
                    ? 'bg-white text-[#2563EB] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bài của tôi ({savedLessons.length})
              </button>
            </div>

            {tab === 'samples' ? (
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setGradeScope('all')}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                    gradeScope === 'all'
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất cả
                </button>
                {([10, 11, 12] as Grade[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setGradeScope(g);
                      onSelectGrade(g);
                    }}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                      gradeScope === g
                        ? 'bg-white text-[#2563EB] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Lớp {g}
                  </button>
                ))}
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                {(
                  [
                    {id: 'all', label: 'Tất cả cấp'},
                    {id: 'high_school', label: 'THPT (10–12)'},
                    {id: 'secondary', label: 'THCS (6–9)'},
                    {id: 'primary', label: 'Tiểu học (1–5)'},
                  ] as Array<{id: EducationLevel | 'all'; label: string}>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSavedLevelFilter(opt.id)}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                      savedLevelFilter === opt.id
                        ? 'bg-white text-[#2563EB] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:flex-initial min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm tên bài, chủ đề..."
              className="w-full sm:w-64 rounded-xl border border-slate-300 bg-[#F8FAFC] focus:bg-white pl-10 pr-3.5 py-2 text-sm outline-none focus:border-[#2563EB] transition-colors"
            />
          </div>
        </div>

        {/* Skill Filter Strip (All 8 skills cleanly accessible in 1 click) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          {FILTER_SKILLS.map((sk) => {
            const active = skillFilter === sk;
            const label = sk === 'all' ? 'Tất cả kỹ năng' : SKILL_VISUAL_META[sk].label;
            return (
              <button
                key={sk}
                type="button"
                onClick={() => setSkillFilter(sk)}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  active
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading Skeleton for Saved Tab */}
      {tab === 'saved' && loadingSaved ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map((k) => (
            <div key={k} className="rounded-[18px] border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl studio-skeleton" />
                <div className="h-4 w-32 rounded studio-skeleton" />
              </div>
              <div className="h-5 w-4/5 rounded studio-skeleton" />
              <div className="h-10 w-full rounded studio-skeleton" />
              <div className="h-10 w-full rounded-xl studio-skeleton" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[20px] border border-slate-200 bg-white p-12 text-center space-y-3">
          <p className="text-lg font-bold text-[#0F172A]">
            {tab === 'saved'
              ? 'Chưa có bài giảng nào trong "Bài của tôi" với bộ lọc này.'
              : 'Không tìm thấy bài mẫu phù hợp.'}
          </p>
          <p className="text-sm text-[#475569] max-w-md mx-auto">
            {tab === 'saved'
              ? 'Bạn có thể tạo bài mới, tải tài liệu Word/PDF/ảnh tại Trang chủ hoặc bấm "Sao chép bài" từ Kho bài mẫu.'
              : 'Thử chọn "Tất cả" hoặc thay đổi từ khóa tìm kiếm.'}
          </p>
          {tab === 'saved' && (
            <div className="pt-2 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={onCreateNew}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1E40AF]"
              >
                <FilePlus2 className="w-4 h-4" />
                Tạo bài mới
              </button>
              <button
                type="button"
                onClick={() => setTab('samples')}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Xem Kho bài mẫu
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Uniform-Height EdTech Card Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch">
          {filtered.map((lesson) => {
            const meta = SKILL_VISUAL_META[lesson.skill];
            const SkillIcon = meta.icon;
            const totalQuestions = lesson.slides.reduce(
              (acc, s) => acc + (s.questions?.length || 0),
              0,
            );
            const durationText = getLessonDurationLabel(lesson);
            const isCopied = copiedId === lesson.id;

            return (
              <article
                key={lesson.id}
                className="h-full rounded-[18px] border border-slate-200/90 bg-white p-5 shadow-xs hover:shadow-md hover:border-blue-300 edtech-card flex flex-col"
              >
                {/* Top Meta Header */}
                <div className="flex items-start gap-3.5 mb-3.5">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${meta.iconBg} ${meta.iconColor}`}
                  >
                    <SkillIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#475569] truncate">
                      <span className="text-[#2563EB]">
                        {EDUCATION_LEVEL_SHORT[lesson.educationLevel || getEducationLevelFromGrade(lesson.grade)]} · Lớp {lesson.grade}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{SKILL_SHORT_LABELS[lesson.skill]}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{lesson.topic}</span>
                    </div>
                    <h2 className="text-[17px] font-bold text-[#0F172A] leading-snug line-clamp-2 mt-1 min-h-[2.8rem]">
                      {lesson.title}
                    </h2>
                  </div>
                </div>

                {/* Description (Fixed 2-line rhythm so cards align evenly) */}
                <p className="text-[15px] text-[#475569] line-clamp-2 leading-relaxed min-h-[3rem] mb-4">
                  {lesson.description}
                </p>

                {/* Real Activity & Question Metrics */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[#475569] font-mono-tabular mb-4">
                  <span>{lesson.slides.length} hoạt động</span>
                  {totalQuestions > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{totalQuestions} câu hỏi</span>
                    </>
                  )}
                  {durationText && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-[#2563EB]">
                        <Clock className="w-3.5 h-3.5" />
                        {durationText}
                      </span>
                    </>
                  )}
                </div>

                {/* Pinned Uniform Action Footer */}
                <div className="mt-auto pt-3.5 border-t border-slate-100 space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => onPresent(lesson)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1E40AF] px-3.5 py-2.5 text-sm font-semibold text-white hover:opacity-95 transition-opacity whitespace-nowrap"
                    >
                      <Play className="w-4 h-4" />
                      Mở bài
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(lesson)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0F172A] hover:bg-slate-50 transition-colors whitespace-nowrap"
                    >
                      <Edit3 className="w-4 h-4 text-[#2563EB]" />
                      Chỉnh sửa
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs text-[#475569]">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => exportLessonToPowerPoint(lesson)}
                        className="inline-flex items-center gap-1 font-medium hover:text-[#2563EB]"
                        title="Xuất PowerPoint (.pptx)"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        PPTX
                      </button>
                      <button
                        type="button"
                        onClick={() => exportLessonToWord(lesson, {includeAnswers: true})}
                        className="inline-flex items-center gap-1 font-medium hover:text-[#2563EB]"
                        title="Xuất Word (.docx)"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        Word
                      </button>
                      <button
                        type="button"
                        onClick={() => printLessonAsPDF(lesson, {includeAnswers: true})}
                        className="inline-flex items-center gap-1 font-medium hover:text-[#0F172A]"
                        title="Xuất PDF / In"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => exportLessonAsJson(lesson)}
                        className="font-medium hover:text-[#10B981]"
                        title="Xuất tệp JSON dự án"
                      >
                        JSON
                      </button>
                    </div>

                    {lesson.isSample ? (
                      <button
                        type="button"
                        onClick={() => handleCopy(lesson)}
                        className={`inline-flex items-center gap-1 font-semibold whitespace-nowrap transition-colors ${
                          isCopied ? 'text-[#10B981]' : 'text-[#2563EB] hover:underline'
                        }`}
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {isCopied ? 'Đã sao chép' : 'Sao chép bài'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onDeleteSaved(lesson.id)}
                        className="inline-flex items-center gap-1 font-semibold text-rose-600 hover:underline whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
