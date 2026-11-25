import React, {useRef, useState} from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Clock,
  FileText,
  Sparkles,
  Upload,
} from 'lucide-react';
import type {HighSchoolGrade} from '../../types/lesson';
import type {
  CurriculumScope,
  ExamDossier,
  ExamSemester,
  ExamSkillKey,
  ExamTypeId,
  GraduationMode,
} from '../../types/exam';
import {EXAM_SKILL_LABELS} from '../../types/exam';
import {
  DEFAULT_TEXTBOOKS,
  EXAM_TYPE_PRESETS,
  GLOBAL_SUCCESS_UNITS,
  GRADUATION_2025_STRUCTURE_NOTE,
  GRADUATION_2027_DISCLAIMER,
} from '../../data/examCurriculum';

interface ExamConfigStepProps {
  dossier: ExamDossier;
  onChangeScope: (nextScope: CurriculumScope, nextHeader?: Partial<ExamDossier['exam']['header']>) => void;
  onGenerateFullPack: () => void;
  onNextStep: () => void;
}

const ALL_SKILLS: ExamSkillKey[] = ['listening', 'language', 'reading', 'writing', 'speaking'];

export const ExamConfigStep: React.FC<ExamConfigStepProps> = ({
  dossier,
  onChangeScope,
  onGenerateFullPack,
  onNextStep,
}) => {
  const {scope, exam} = dossier;
  const [customUnitInput, setCustomUnitInput] = useState('');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedPreset = EXAM_TYPE_PRESETS.find((p) => p.id === scope.examType);
  const isGraduation = Boolean(selectedPreset?.isGraduationType);
  const selectedBook = DEFAULT_TEXTBOOKS.find((b) => b.id === scope.textbookId) || DEFAULT_TEXTBOOKS[0];
  const verifiedUnits = selectedBook.verifiedUnitsAvailable
    ? GLOBAL_SUCCESS_UNITS[scope.grade]
    : [];

  const handleGradeChange = (grade: HighSchoolGrade) => {
    const defaultUnits =
      scope.textbookId === 'global-success'
        ? GLOBAL_SUCCESS_UNITS[grade]
            .filter((u) => (scope.semester === 'hk1' ? u.semester === 'hk1' : scope.semester === 'hk2' ? u.semester === 'hk2' : true))
            .slice(0, isGraduation ? 10 : 3)
            .map((u) => u.id)
        : [];
    const matched = GLOBAL_SUCCESS_UNITS[grade].filter((u) => defaultUnits.includes(u.id));
    onChangeScope(
      {
        ...scope,
        grade,
        selectedUnitIds: defaultUnits,
        selectedTopics: matched.flatMap((u) => u.topics),
        knowledgeUnits: matched.flatMap((u) => u.knowledgeUnits),
        learningOutcomes: matched.flatMap((u) => u.learningOutcomes),
      },
      {gradeLabel: `Lớp ${grade}`},
    );
  };

  const handleExamTypeChange = (examType: ExamTypeId) => {
    const preset = EXAM_TYPE_PRESETS.find((p) => p.id === examType);
    if (!preset) return;
    let nextSemester: ExamSemester = scope.semester;
    let nextUnits = scope.selectedUnitIds;

    if (examType === 'midterm_1') {
      nextSemester = 'hk1';
      nextUnits = GLOBAL_SUCCESS_UNITS[scope.grade].slice(0, 3).map((u) => u.id);
    } else if (examType === 'final_1') {
      nextSemester = 'hk1';
      nextUnits = GLOBAL_SUCCESS_UNITS[scope.grade].slice(0, 5).map((u) => u.id);
    } else if (examType === 'midterm_2') {
      nextSemester = 'hk2';
      nextUnits = GLOBAL_SUCCESS_UNITS[scope.grade].slice(5, 8).map((u) => u.id);
    } else if (examType === 'final_2') {
      nextSemester = 'hk2';
      nextUnits = GLOBAL_SUCCESS_UNITS[scope.grade].slice(5, 10).map((u) => u.id);
    } else if (preset.isGraduationType) {
      nextSemester = 'full_year';
      nextUnits = GLOBAL_SUCCESS_UNITS[12].map((u) => u.id);
    }

    const nextGrade: HighSchoolGrade = preset.isGraduationType ? 12 : scope.grade;
    const matched = GLOBAL_SUCCESS_UNITS[nextGrade].filter((u) => nextUnits.includes(u.id));

    onChangeScope(
      {
        ...scope,
        grade: nextGrade,
        examType,
        semester: nextSemester,
        durationMinutes: preset.defaultDuration,
        skills: [...preset.defaultSkills],
        selectedUnitIds: scope.textbookId === 'global-success' ? nextUnits : scope.selectedUnitIds,
        selectedTopics: matched.flatMap((u) => u.topics),
        knowledgeUnits: matched.flatMap((u) => u.knowledgeUnits),
        learningOutcomes: matched.flatMap((u) => u.learningOutcomes),
      },
      {
        examTitle: preset.name.toUpperCase(),
        durationMinutes: preset.defaultDuration,
        gradeLabel: `Lớp ${nextGrade}`,
        semesterLabel:
          nextSemester === 'hk1' ? 'Học kỳ I' : nextSemester === 'hk2' ? 'Học kỳ II' : 'Cả năm',
      },
    );
  };

  const toggleUnit = (unitId: string) => {
    const exists = scope.selectedUnitIds.includes(unitId);
    const nextIds = exists
      ? scope.selectedUnitIds.filter((id) => id !== unitId)
      : [...scope.selectedUnitIds, unitId];
    const matched = GLOBAL_SUCCESS_UNITS[scope.grade].filter((u) => nextIds.includes(u.id));
    onChangeScope({
      ...scope,
      selectedUnitIds: nextIds,
      selectedTopics: matched.flatMap((u) => u.topics),
      knowledgeUnits: matched.flatMap((u) => u.knowledgeUnits),
      learningOutcomes: matched.flatMap((u) => u.learningOutcomes),
    });
  };

  const toggleSkill = (sk: ExamSkillKey) => {
    if (isGraduation) return; // Graduation 2025–2026 strictly Reading + Language MCQ
    const exists = scope.skills.includes(sk);
    const next = exists ? scope.skills.filter((s) => s !== sk) : [...scope.skills, sk];
    if (next.length === 0) return;
    onChangeScope({...scope, skills: next});
  };

  const handleUploadCurriculumDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.csv')
        ? await file.text()
        : `Đã đính kèm tài liệu chương trình/PPCT: ${file.name} (${Math.round(file.size / 1024)} KB).`;
      onChangeScope({
        ...scope,
        customCurriculumDocName: file.name,
        customCurriculumNotes: text.slice(0, 2000),
      });
      setUploadStatus(`Đã tải tài liệu phân phối chương trình "${file.name}".`);
    } catch {
      setUploadStatus('Không đọc được tệp, vui lòng chọn tệp văn bản hoặc Word/PDF.');
    }
    e.target.value = '';
  };

  const addCustomTopic = () => {
    const trimmed = customUnitInput.trim();
    if (!trimmed) return;
    onChangeScope({
      ...scope,
      selectedTopics: [...scope.selectedTopics, trimmed],
    });
    setCustomUnitInput('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with 1-Click Full Pack Generation */}
      <div className="rounded-[18px] border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <h2 className="font-display text-xl font-extrabold text-[#0F172A]">
            Bước 1: Cấu hình phạm vi chương trình &amp; loại đề kiểm tra
          </h2>
          <p className="text-[15px] text-[#475569]">
            Chọn khối lớp, bộ sách, Unit đã xác minh và loại bài kiểm tra. Hệ thống tự động tạo đồng bộ Ma trận → Bản đặc tả → Đề thi → Đáp án &amp; Rubric.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerateFullPack}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1E40AF] px-5 py-3 text-[15px] font-bold text-white shadow-sm hover:opacity-95 transition-opacity whitespace-nowrap"
        >
          <Sparkles className="w-5 h-5" />
          Tạo trọn bộ hồ sơ (1 chạm)
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Grade, Exam Type, Duration, Textbook */}
        <div className="lg:col-span-7 space-y-5">
          {/* Grade + Year + Semester */}
          <div className="rounded-[18px] border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
            <h3 className="text-[16px] font-bold text-[#0F172A] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#2563EB]" />
              Khối lớp, năm học &amp; bộ sách giáo khoa
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">Khối lớp THPT</label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
                  {([10, 11, 12] as HighSchoolGrade[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleGradeChange(g)}
                      className={`py-2 rounded-lg text-[15px] font-bold transition-all ${
                        scope.grade === g
                          ? 'bg-[#2563EB] text-white shadow-xs'
                          : 'text-slate-700 hover:bg-white'
                      }`}
                    >
                      Lớp {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">Năm học</label>
                <input
                  type="text"
                  value={scope.academicYear}
                  onChange={(e) =>
                    onChangeScope(
                      {...scope, academicYear: e.target.value},
                      {academicYear: e.target.value},
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-[15px] text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                  placeholder="2025–2026"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">Học kỳ</label>
                <select
                  value={scope.semester}
                  onChange={(e) => {
                    const sem = e.target.value as ExamSemester;
                    onChangeScope(
                      {...scope, semester: sem},
                      {
                        semesterLabel:
                          sem === 'hk1' ? 'Học kỳ I' : sem === 'hk2' ? 'Học kỳ II' : 'Cả năm',
                      },
                    );
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-[15px] text-[#0F172A] bg-white focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="hk1">Học kỳ I</option>
                  <option value="hk2">Học kỳ II</option>
                  <option value="full_year">Cả năm</option>
                </select>
              </div>
            </div>

            {/* Textbook Selection + Upload Custom Curriculum */}
            <div className="space-y-2.5 pt-1">
              <label className="block text-sm font-semibold text-[#334155]">
                Bộ sách giáo khoa / Tài liệu phân phối chương trình
              </label>
              <select
                value={scope.textbookId}
                onChange={(e) => {
                  const book = DEFAULT_TEXTBOOKS.find((b) => b.id === e.target.value) || DEFAULT_TEXTBOOKS[0];
                  onChangeScope({
                    ...scope,
                    textbookId: book.id,
                    textbookName: book.name,
                    selectedUnitIds: book.verifiedUnitsAvailable
                      ? GLOBAL_SUCCESS_UNITS[scope.grade].slice(0, 3).map((u) => u.id)
                      : [],
                  });
                }}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] text-[#0F172A] bg-white focus:border-[#2563EB] focus:outline-none"
              >
                {DEFAULT_TEXTBOOKS.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.name} — {book.publisher}
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm text-[#475569]">
                <span>{selectedBook.note}</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-[#2563EB] hover:bg-blue-50 whitespace-nowrap"
                >
                  <Upload className="w-4 h-4" />
                  Tải PPCT / SGK riêng
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.pdf,.txt,.csv,.xlsx"
                  className="hidden"
                  onChange={handleUploadCurriculumDoc}
                />
              </div>
              {uploadStatus && (
                <p className="text-sm font-medium text-emerald-700">{uploadStatus}</p>
              )}
            </div>
          </div>

          {/* 12 Exam Types & Configurable Duration */}
          <div className="rounded-[18px] border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[16px] font-bold text-[#0F172A] flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#2563EB]" />
                Loại bài kiểm tra &amp; Thời lượng (tùy chỉnh linh hoạt)
              </h3>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-[#334155]">Thời gian (phút):</label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={scope.durationMinutes}
                  onChange={(e) => {
                    const mins = Math.max(5, Math.min(180, Number(e.target.value) || 45));
                    onChangeScope({...scope, durationMinutes: mins}, {durationMinutes: mins});
                  }}
                  className="w-24 rounded-xl border border-slate-300 px-3 py-1.5 text-[15px] font-bold text-[#2563EB] text-center focus:border-[#2563EB] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {EXAM_TYPE_PRESETS.map((preset) => {
                const active = scope.examType === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleExamTypeChange(preset.id)}
                    className={`text-left rounded-xl border p-3 transition-all ${
                      active
                        ? 'border-[#2563EB] bg-blue-50/70 ring-1 ring-[#2563EB]'
                        : 'border-slate-200 hover:border-blue-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[15px] text-[#0F172A]">{preset.shortName}</span>
                      <span className="text-xs font-semibold text-[#2563EB]">{preset.recommendedRange}</span>
                    </div>
                    <p className="text-xs text-[#475569] mt-1 line-clamp-2">{preset.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Graduation 2025–2026 vs 2027 Reference Toggle */}
            {isGraduation && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-[15px] text-amber-900">
                      Chế độ cấu trúc thi Tốt nghiệp THPT (40 câu TNKQ · 50 phút · 0,25 đ/câu)
                    </div>
                    <p className="text-sm text-amber-900/90">
                      {scope.graduationMode === '2027_reference'
                        ? GRADUATION_2027_DISCLAIMER
                        : GRADUATION_2025_STRUCTURE_NOTE}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(
                    [
                      {id: '2025_2026', label: 'Chuẩn năm 2025–2026 (đã xác minh)'},
                      {id: '2027_reference', label: 'Ôn thi 2027 (tham khảo định dạng 2025–2026)'},
                    ] as Array<{id: GraduationMode; label: string}>
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onChangeScope({...scope, graduationMode: m.id})}
                      className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                        scope.graduationMode === m.id
                          ? 'bg-amber-700 text-white border-amber-700'
                          : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Skills Selector */}
            <div className="space-y-2 pt-1">
              <label className="block text-sm font-semibold text-[#334155]">
                Kỹ năng &amp; mảng kiến thức đánh giá {isGraduation && '(Cố định theo cấu trúc TN THPT 2025: Đọc & Ngôn ngữ TNKQ)'}
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_SKILLS.map((sk) => {
                  const active = scope.skills.includes(sk);
                  return (
                    <button
                      key={sk}
                      type="button"
                      disabled={isGraduation}
                      onClick={() => toggleSkill(sk)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all ${
                        active
                          ? 'border-[#2563EB] bg-[#2563EB] text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400'
                      } ${isGraduation ? 'opacity-65 cursor-not-allowed' : ''}`}
                    >
                      {active && <Check className="w-4 h-4" />}
                      {EXAM_SKILL_LABELS[sk].en} ({EXAM_SKILL_LABELS[sk].vi})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Verified Units + Editable Exam Header (No fake school names!) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Verified Units Selection */}
          <div className="rounded-[18px] border border-slate-200 bg-white p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[16px] font-bold text-[#0F172A]">
                Phạm vi Unit đã xác minh (Lớp {scope.grade})
              </h3>
              {verifiedUnits.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allIds = verifiedUnits.map((u) => u.id);
                    const allSelected = scope.selectedUnitIds.length === allIds.length;
                    const nextIds = allSelected ? allIds.slice(0, 3) : allIds;
                    const matched = verifiedUnits.filter((u) => nextIds.includes(u.id));
                    onChangeScope({
                      ...scope,
                      selectedUnitIds: nextIds,
                      selectedTopics: matched.flatMap((u) => u.topics),
                      knowledgeUnits: matched.flatMap((u) => u.knowledgeUnits),
                      learningOutcomes: matched.flatMap((u) => u.learningOutcomes),
                    });
                  }}
                  className="text-sm font-semibold text-[#2563EB] hover:underline"
                >
                  {scope.selectedUnitIds.length === verifiedUnits.length ? 'Thu gọn' : 'Chọn tất cả'}
                </button>
              )}
            </div>

            {verifiedUnits.length > 0 ? (
              <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                {verifiedUnits.map((u) => {
                  const checked = scope.selectedUnitIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                        checked
                          ? 'border-blue-300 bg-blue-50/70'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUnit(u.id)}
                        className="mt-1 w-4 h-4 rounded accent-[#2563EB]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-bold text-[#0F172A]">
                          Unit {u.number}: {u.title}
                        </div>
                        <div className="text-xs text-[#475569]">
                          {u.titleVi} · {u.semester === 'hk1' ? 'HK I' : 'HK II'} · {u.knowledgeUnits[2] || u.knowledgeUnits[0]}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[#475569]">
                  Với bộ sách khác, giáo viên nhập trực tiếp tên Unit/chủ đề theo phân phối chương trình của trường:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customUnitInput}
                    onChange={(e) => setCustomUnitInput(e.target.value)}
                    placeholder="VD: Unit 1: Feelings..."
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-[15px]"
                  />
                  <button
                    type="button"
                    onClick={addCustomTopic}
                    className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white"
                  >
                    Thêm
                  </button>
                </div>
                {scope.selectedTopics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {scope.selectedTopics.map((t, idx) => (
                      <span
                        key={`${t}-${idx}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-sm text-slate-800"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Editable Exam Header (Blank School Name by default — NEVER fabricate) */}
          <div className="rounded-[18px] border border-slate-200 bg-white p-5 space-y-3.5 shadow-xs">
            <h3 className="text-[16px] font-bold text-[#0F172A] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2563EB]" />
              Thông tin tiêu đề đề kiểm tra (tự tùy chỉnh)
            </h3>
            <p className="text-xs text-[#475569]">
              Hệ thống không tự bịa tên Sở hoặc tên trường. Để trống nếu muốn in dòng chấm (....) để giáo viên điền tay.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1">Sở Giáo dục và Đào tạo</label>
                <input
                  type="text"
                  value={exam.header.departmentName}
                  onChange={(e) => onChangeScope(scope, {departmentName: e.target.value})}
                  placeholder="Để trống hoặc nhập tên Sở GD&ĐT..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-[15px]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1">Trường THPT</label>
                <input
                  type="text"
                  value={exam.header.schoolName}
                  onChange={(e) => onChangeScope(scope, {schoolName: e.target.value})}
                  placeholder="Để trống hoặc nhập tên Trường THPT..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-[15px]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-[#334155] mb-1">Tên kỳ kiểm tra</label>
                  <input
                    type="text"
                    value={exam.header.examTitle}
                    onChange={(e) => onChangeScope(scope, {examTitle: e.target.value})}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-[15px] font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#334155] mb-1">Mã đề gốc</label>
                  <input
                    type="text"
                    value={exam.header.examCode}
                    onChange={(e) => onChangeScope(scope, {examCode: e.target.value})}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-[15px] font-mono-tabular"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onNextStep}
                className="rounded-xl bg-blue-50 text-[#2563EB] hover:bg-blue-100 px-4 py-2.5 text-[15px] font-bold transition-colors"
              >
                Tiếp tục sang Ma trận đề →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
