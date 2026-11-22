import React, {useMemo, useRef, useState} from 'react';
import {
  Copy,
  Edit3,
  FileDown,
  Play,
  Printer,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import type {Grade, LessonProject, SkillCategory} from '../types/lesson';
import {SKILL_LABELS, SKILL_SHORT_LABELS} from '../types/lesson';
import {
  exportLessonToPowerPoint,
  exportLessonToWord,
  printLessonAsPDF,
} from '../services/exporters';
import {exportLessonAsJson, importLessonFromJsonFile} from '../services/storage';

interface LibraryViewProps {
  selectedGrade: Grade;
  onSelectGrade: (g: Grade) => void;
  sampleLessons: LessonProject[];
  savedLessons: LessonProject[];
  onPresent: (lesson: LessonProject) => void;
  onEdit: (lesson: LessonProject) => void;
  onDuplicateToSaved: (lesson: LessonProject) => Promise<void>;
  onDeleteSaved: (id: string) => Promise<void>;
  onImportedJson: (lesson: LessonProject) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  selectedGrade,
  onSelectGrade,
  sampleLessons,
  savedLessons,
  onPresent,
  onEdit,
  onDuplicateToSaved,
  onDeleteSaved,
  onImportedJson,
}) => {
  const [tab, setTab] = useState<'samples' | 'saved'>('samples');
  const [skillFilter, setSkillFilter] = useState<SkillCategory | 'all'>('all');
  const [gradeScope, setGradeScope] = useState<Grade | 'all'>(selectedGrade);
  const [query, setQuery] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const sourceList = tab === 'samples' ? sampleLessons : savedLessons;

  const filtered = useMemo(() => {
    return sourceList.filter((item) => {
      if (gradeScope !== 'all' && item.grade !== gradeScope) return false;
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
  }, [sourceList, gradeScope, skillFilter, query]);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Kho bài giảng Tiếng Anh THPT 10–11–12
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {sampleLessons.length} bài mẫu tự biên soạn bám sát Chương trình GDPT 2018 (3 bài Listening mỗi khối 10–11–12 nghe ngay, đủ 4 kỹ năng, Từ vựng, Ngữ pháp, Phát âm, Ôn tập) và các bài giảng đã lưu cục bộ.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".json,.ess.json,application/json"
            onChange={handleJsonUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            Nhập dự án JSON
          </button>
        </div>
      </div>

      {importError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
          {importError}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tab Switcher */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('samples')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'samples'
                  ? 'bg-white text-[#0F4C81] shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kho bài mẫu ({sampleLessons.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('saved')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'saved'
                  ? 'bg-white text-[#0F4C81] shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bài giảng đã lưu ({savedLessons.length})
            </button>
          </div>

          {/* Grade Filter */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setGradeScope('all')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                gradeScope === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Tất cả khối
            </button>
            {([10, 11, 12] as Grade[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGradeScope(g);
                  onSelectGrade(g);
                }}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                  gradeScope === g
                    ? 'bg-white text-[#0F4C81] shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Lớp {g}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value as SkillCategory | 'all')}
            aria-label="Lọc theo kỹ năng"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            <option value="all">Tất cả kỹ năng</option>
            {(Object.keys(SKILL_LABELS) as SkillCategory[]).map((sk) => (
              <option key={sk} value={sk}>
                {SKILL_SHORT_LABELS[sk]}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm tên bài, chủ đề..."
              className="rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm w-56 outline-none focus:border-[#0284C7]"
            />
          </div>
        </div>
      </div>

      {/* Lesson Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-2">
          <p className="font-semibold text-slate-900">
            {tab === 'saved'
              ? 'Chưa có bài giảng nào được lưu trong bộ lọc này.'
              : 'Không tìm thấy bài mẫu phù hợp.'}
          </p>
          <p className="text-sm text-slate-500">
            {tab === 'saved'
              ? 'Bạn có thể tạo bài mới từ tài liệu Word/PDF/ảnh hoặc sao chép một bài mẫu để chỉnh sửa.'
              : 'Thử chọn "Tất cả khối" hoặc đổi từ khóa tìm kiếm.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((lesson) => (
            <article
              key={lesson.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-[#0F4C81]">Lớp {lesson.grade}</span>
                  <span aria-hidden="true">·</span>
                  <span>{SKILL_SHORT_LABELS[lesson.skill]}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{lesson.topic}</span>
                </div>

                <h2 className="text-base font-bold text-slate-900 leading-snug">{lesson.title}</h2>
                <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                  {lesson.description}
                </p>

                <div className="text-xs text-slate-500 pt-1 font-mono-tabular">
                  {lesson.slides.length} slide ·{' '}
                  {lesson.slides.reduce((acc, s) => acc + (s.questions?.length || 0), 0)} câu hỏi tương tác
                </div>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onPresent(lesson)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0F4C81] px-3 py-2 text-sm font-medium text-white hover:bg-[#0B3A63] whitespace-nowrap"
                  >
                    <Play className="w-4 h-4" />
                    Trình chiếu
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(lesson)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Edit3 className="w-4 h-4" />
                    Biên tập
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => exportLessonToPowerPoint(lesson)}
                      className="inline-flex items-center gap-1 hover:text-[#0F4C81]"
                      title="Xuất PowerPoint (.pptx)"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      PPTX
                    </button>
                    <button
                      type="button"
                      onClick={() => exportLessonToWord(lesson, {includeAnswers: true})}
                      className="inline-flex items-center gap-1 hover:text-[#0284C7]"
                      title="Xuất Word (.docx)"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      Word
                    </button>
                    <button
                      type="button"
                      onClick={() => printLessonAsPDF(lesson, {includeAnswers: true})}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                      title="Xuất PDF / In"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => exportLessonAsJson(lesson)}
                      className="hover:text-emerald-700"
                      title="Xuất tệp JSON dự án"
                    >
                      JSON
                    </button>
                  </div>

                  {lesson.isSample ? (
                    <button
                      type="button"
                      onClick={() => onDuplicateToSaved(lesson)}
                      className="inline-flex items-center gap-1 text-[#0284C7] hover:underline font-medium"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Lưu bản sao
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDeleteSaved(lesson.id)}
                      className="inline-flex items-center gap-1 text-rose-600 hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
