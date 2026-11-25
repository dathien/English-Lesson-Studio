import React, {useEffect, useMemo, useState} from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookMarked,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Eye,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  History,
  ListChecks,
  Save,
  Settings2,
  ShieldAlert,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import type {HighSchoolGrade, LessonProject} from '../../types/lesson';
import type {
  BankQuestionRecord,
  CurriculumScope,
  Exam,
  ExamBlueprint,
  ExamDossier,
  ExamStatus,
  ExamVersion,
  MarkingGuide,
  SourceReference,
  Specification,
} from '../../types/exam';
import {EXAM_STATUS_LABELS} from '../../types/exam';
import {
  ALL_PERIODIC_EXAM_PACKS,
  INITIAL_EXAM_QUESTION_BANK,
} from '../../data/examSamples';
import {GLOBAL_SUCCESS_UNITS} from '../../data/examCurriculum';
import {
  canMarkReadyToExport,
  convertExamToLessonProject,
  createNewExamDossier,
  generateBlueprintFromScope,
  generateExamFromBlueprint,
  syncAnswerKeyAndMarkingGuide,
  syncBlueprintFromSpecification,
  syncSpecificationFromBlueprint,
  validateExamDossier,
} from '../../services/examEngine';
import {
  bulkSaveBankQuestionsToDB,
  deleteBankQuestionFromDB,
  deleteExamDossierFromDB,
  getAllBankQuestions,
  getAllExamDossiers,
  saveBankQuestionToDB,
  saveExamDossierToDB,
} from '../../services/storage';
import {ExamConfigStep} from './ExamConfigStep';
import {ExamMatrixStep} from './ExamMatrixStep';
import {ExamSpecStep} from './ExamSpecStep';
import {ExamComposerStep} from './ExamComposerStep';
import {ExamAnswerRubricStep} from './ExamAnswerRubricStep';
import {ExamShuffleView} from './ExamShuffleView';
import {ExamPreviewExportStep} from './ExamPreviewExportStep';
import {ExamBankView} from './ExamBankView';
import {ExamReferenceLibrary} from './ExamReferenceLibrary';
import {ExamHistoryView} from './ExamHistoryView';
import {ExamTimedPracticeModal} from './ExamTimedPracticeModal';

type ExamStudioSection =
  | 'config'
  | 'matrix'
  | 'spec'
  | 'composer'
  | 'answers'
  | 'preview'
  | 'shuffle'
  | 'bank'
  | 'library'
  | 'history'
  | 'guide';

interface ExamStudioProps {
  defaultGrade: HighSchoolGrade;
  defaultSchoolName?: string;
  aiAvailable: boolean;
  onPresentLesson: (lesson: LessonProject) => void;
  onSaveAndEditLesson?: (lesson: LessonProject) => Promise<void>;
}

const WORKFLOW_STEPS: Array<{id: ExamStudioSection; step: number; label: string}> = [
  {id: 'config', step: 1, label: 'Cấu hình'},
  {id: 'matrix', step: 2, label: 'Ma trận'},
  {id: 'spec', step: 3, label: 'Bản đặc tả'},
  {id: 'composer', step: 4, label: 'Đề kiểm tra'},
  {id: 'answers', step: 5, label: 'Đáp án & Rubric'},
  {id: 'preview', step: 6, label: 'Xem trước & Xuất'},
];

export const ExamStudio: React.FC<ExamStudioProps> = ({
  defaultGrade,
  defaultSchoolName = '',
  aiAvailable,
  onPresentLesson,
}) => {
  const [section, setSection] = useState<ExamStudioSection>('config');
  const [savedDossiers, setSavedDossiers] = useState<ExamDossier[]>([]);
  const [customBank, setCustomBank] = useState<BankQuestionRecord[]>([]);
  const [teacherRefs, setTeacherRefs] = useState<SourceReference[]>([]);
  const [practiceDossier, setPracticeDossier] = useState<ExamDossier | null>(null);
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [dossier, setDossier] = useState<ExamDossier>(() => {
    const initialPack =
      ALL_PERIODIC_EXAM_PACKS.find((p) => p.scope.grade === defaultGrade) ||
      ALL_PERIODIC_EXAM_PACKS[0];
    const cloned = structuredClone(initialPack);
    cloned.id = `exam-draft-${Date.now()}`;
    cloned.isSample = false;
    cloned.status = 'draft';
    if (defaultSchoolName) {
      cloned.exam.header.schoolName = defaultSchoolName;
    }
    return cloned;
  });

  useEffect(() => {
    let mounted = true;
    getAllExamDossiers()
      .then((list) => {
        if (mounted) setSavedDossiers(list);
      })
      .catch(() => {});

    getAllBankQuestions()
      .then((list) => {
        if (mounted) setCustomBank(list);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const customBankIds = useMemo(() => new Set(customBank.map((q) => q.id)), [customBank]);

  const unifiedBank = useMemo(() => {
    const byId = new Map<string, BankQuestionRecord>();
    for (const q of INITIAL_EXAM_QUESTION_BANK) byId.set(q.id, q);
    for (const q of customBank) byId.set(q.id, q);
    return Array.from(byId.values());
  }, [customBank]);

  const validationIssues = useMemo(() => validateExamDossier(dossier), [dossier]);
  const errorIssues = useMemo(
    () => validationIssues.filter((i) => i.severity === 'error'),
    [validationIssues],
  );
  const warningIssues = useMemo(
    () => validationIssues.filter((i) => i.severity === 'warning'),
    [validationIssues],
  );
  const readyCheck = useMemo(() => canMarkReadyToExport(dossier), [dossier]);

  const notify = (type: 'success' | 'error', text: string) => {
    setStatusBanner({type, text});
    window.setTimeout(() => {
      setStatusBanner((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  };

  // Enforce strict single-source-of-truth synchronization whenever exam changes
  const commitDossierUpdate = (next: ExamDossier) => {
    const {answerKey, markingGuide} = syncAnswerKeyAndMarkingGuide(
      next.exam,
      next.markingGuide,
    );
    const synced: ExamDossier = {
      ...next,
      answerKey,
      markingGuide,
      updatedAt: Date.now(),
    };
    // Auto-downgrade from ready_to_export if edits introduce blocking errors
    if (synced.status === 'ready_to_export' && !canMarkReadyToExport(synced).allowed) {
      synced.status = 'pending_review';
    }
    setDossier(synced);
  };

  const handleSaveCurrentDossier = async () => {
    try {
      const saved = await saveExamDossierToDB(dossier);
      setDossier(saved);
      setSavedDossiers((prev) => {
        const idx = prev.findIndex((item) => item.id === saved.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = saved;
          return copy;
        }
        return [saved, ...prev];
      });
      notify('success', `Đã lưu hồ sơ "${saved.title}" vào bộ nhớ máy (IndexedDB).`);
    } catch {
      notify('error', 'Không thể lưu hồ sơ vào bộ nhớ trình duyệt.');
    }
  };

  const handleStatusChange = (targetStatus: ExamStatus) => {
    if (targetStatus === 'ready_to_export') {
      const check = canMarkReadyToExport(dossier);
      if (!check.allowed) {
        setShowValidationPanel(true);
        notify(
          'error',
          `Không thể đánh dấu "Sẵn sàng xuất đề": còn ${check.blockingErrors.length} lỗi kiểm định cần khắc phục.`,
        );
        return;
      }
    }
    setDossier((prev) => ({...prev, status: targetStatus, updatedAt: Date.now()}));
    notify('success', `Đã chuyển trạng thái hồ sơ sang "${EXAM_STATUS_LABELS[targetStatus].label}".`);
  };

  const handleChangeScope = (
    nextScope: CurriculumScope,
    nextHeader?: Partial<ExamDossier['exam']['header']>,
  ) => {
    const typeChanged =
      nextScope.examType !== dossier.scope.examType ||
      nextScope.grade !== dossier.scope.grade ||
      nextScope.graduationMode !== dossier.scope.graduationMode;

    const nextBlueprint = typeChanged
      ? generateBlueprintFromScope(nextScope)
      : dossier.blueprint;
    const nextSpec = syncSpecificationFromBlueprint(
      nextBlueprint,
      nextScope,
      typeChanged ? undefined : dossier.specification,
    );

    commitDossierUpdate({
      ...dossier,
      scope: nextScope,
      blueprint: nextBlueprint,
      specification: nextSpec,
      exam: {
        ...dossier.exam,
        header: {
          ...dossier.exam.header,
          ...(nextHeader || {}),
          gradeLabel: `Lớp ${nextScope.grade}`,
          academicYear: nextScope.academicYear,
          durationMinutes: nextScope.durationMinutes,
        },
      },
    });
  };

  const handleGenerateFullPack = () => {
    const fresh = createNewExamDossier(
      dossier.scope,
      unifiedBank,
      dossier.exam.header.schoolName,
    );
    fresh.id = dossier.id;
    fresh.exam.header = {
      ...fresh.exam.header,
      departmentName: dossier.exam.header.departmentName,
      schoolName: dossier.exam.header.schoolName,
    };
    setDossier(fresh);
    setSection('matrix');
    notify(
      'success',
      `Đã tạo đồng bộ Ma trận, Bản đặc tả, Đề (${fresh.exam.questions.length} câu) và Đáp án.`,
    );
  };

  const handleUpdateBlueprint = (nextBp: ExamBlueprint, autoSyncSpec = true) => {
    const nextSpec = autoSyncSpec
      ? syncSpecificationFromBlueprint(nextBp, dossier.scope, dossier.specification)
      : dossier.specification;
    commitDossierUpdate({
      ...dossier,
      blueprint: nextBp,
      specification: nextSpec,
    });
  };

  const handleUpdateSpecification = (nextSpec: Specification, syncBackToMatrix = false) => {
    const nextBp = syncBackToMatrix
      ? syncBlueprintFromSpecification(nextSpec, dossier.blueprint)
      : dossier.blueprint;
    commitDossierUpdate({
      ...dossier,
      blueprint: nextBp,
      specification: nextSpec,
    });
  };

  const handleSyncAndGenerateExam = () => {
    const regenerated = generateExamFromBlueprint(dossier, unifiedBank);
    setDossier(regenerated);
    setSection('composer');
    notify(
      'success',
      `Đã đồng bộ ${regenerated.exam.questions.length} câu hỏi từ Ma trận (giữ nguyên các câu đã khóa).`,
    );
  };

  const handleUpdateExam = (nextExam: Exam) => {
    commitDossierUpdate({
      ...dossier,
      exam: nextExam,
    });
  };

  const handleRegenerateSection = (matrixRowId: string) => {
    const updated = generateExamFromBlueprint(dossier, unifiedBank, {
      regenerateMatrixRowId: matrixRowId,
    });
    setDossier(updated);
    notify('success', 'Đã tái tạo lại phần câu hỏi theo ma trận (giữ nguyên câu đã khóa).');
  };

  const handleRegenerateQuestion = (questionId: string) => {
    const updated = generateExamFromBlueprint(dossier, unifiedBank, {
      regenerateQuestionId: questionId,
    });
    setDossier(updated);
  };

  const handleUpdateMarkingGuide = (nextGuide: MarkingGuide) => {
    setDossier((prev) => ({
      ...prev,
      markingGuide: nextGuide,
      updatedAt: Date.now(),
    }));
  };

  const handleUpdateVersions = (versions: ExamVersion[]) => {
    setDossier((prev) => ({
      ...prev,
      versions,
      updatedAt: Date.now(),
    }));
    notify('success', `Đã tạo ${versions.length} mã đề trộn thông minh kèm kiểm tra tương đương.`);
  };

  const handlePresentDossier = (
    target: ExamDossier,
    mode: 'by_group' | 'per_question' = 'by_group',
  ) => {
    const lesson = convertExamToLessonProject(target, mode);
    onPresentLesson(lesson);
  };

  const handleOpenFromLibrary = async (target: ExamDossier, duplicateAsOwn = false) => {
    const cloned = structuredClone(target);
    cloned.id = `exam-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    cloned.isSample = false;
    if (duplicateAsOwn) {
      cloned.title = `${target.title} (Bản của tôi)`;
      const saved = await saveExamDossierToDB(cloned);
      setSavedDossiers((prev) => [saved, ...prev]);
      setDossier(saved);
      notify('success', `Đã nhân bản "${saved.title}" vào Lịch sử đề đã tạo.`);
    } else {
      setDossier(cloned);
      notify('success', `Đã mở bộ đề "${cloned.title}" trong không gian soạn đề.`);
    }
    setSection('composer');
  };

  const handleCreateBlankDossier = () => {
    const units = GLOBAL_SUCCESS_UNITS[defaultGrade].slice(0, 3);
    const scope: CurriculumScope = {
      grade: defaultGrade,
      academicYear: '2025–2026',
      semester: 'hk1',
      textbookId: 'global_success',
      textbookName: 'Global Success (Tiếng Anh THPT)',
      selectedUnitIds: units.map((u) => u.id),
      selectedTopics: units.map((u) => `Unit ${u.number}: ${u.title}`),
      knowledgeUnits: units.flatMap((u) => u.knowledgeUnits).slice(0, 6),
      learningOutcomes: units.flatMap((u) => u.learningOutcomes).slice(0, 6),
      skills: ['listening', 'language', 'reading', 'writing'],
      examType: 'midterm_1',
      durationMinutes: 60,
      graduationMode: '2025_2026',
    };
    const fresh = createNewExamDossier(scope, unifiedBank, defaultSchoolName);
    setDossier(fresh);
    setSection('config');
    notify('success', 'Đã khởi tạo hồ sơ bộ đề mới.');
  };

  const sidebarItems: Array<{
    id: ExamStudioSection;
    label: string;
    icon: React.ComponentType<{className?: string}>;
    badge?: string;
  }> = [
    {id: 'config', label: '1. Tạo bộ đề kiểm tra', icon: Settings2},
    {id: 'matrix', label: '2. Ma trận đề', icon: FileSpreadsheet},
    {id: 'spec', label: '3. Bản đặc tả', icon: ListChecks},
    {
      id: 'composer',
      label: '4. Soạn thảo đề',
      icon: FileText,
      badge: `${dossier.exam.questions.length} câu`,
    },
    {id: 'answers', label: '5. Đáp án & Chấm', icon: ClipboardCheck},
    {id: 'preview', label: '6. Xem trước & Xuất', icon: Eye},
    {
      id: 'shuffle',
      label: 'Trộn mã đề',
      icon: Shuffle,
      badge: dossier.versions.length > 0 ? `${dossier.versions.length} mã` : undefined,
    },
    {
      id: 'bank',
      label: 'Ngân hàng câu hỏi',
      icon: Database,
      badge: `${unifiedBank.length}`,
    },
    {id: 'library', label: 'Kho đề tham khảo', icon: BookMarked, badge: '15 bộ'},
    {
      id: 'history',
      label: 'Lịch sử đề đã tạo',
      icon: History,
      badge: savedDossiers.length > 0 ? `${savedDossiers.length}` : undefined,
    },
    {id: 'guide', label: 'Hướng dẫn ra đề', icon: HelpCircle},
  ];

  const isWorkflowView = WORKFLOW_STEPS.some((w) => w.id === section);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Top Studio Header Bar */}
      <div className="rounded-[20px] border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#2563EB]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>SOẠN ĐỀ &amp; KIỂM TRA ĐÁNH GIÁ TIẾNG ANH THPT 10 · 11 · 12</span>
            </div>
            <input
              type="text"
              value={dossier.title}
              onChange={(e) => setDossier({...dossier, title: e.target.value})}
              aria-label="Tên hồ sơ bộ đề kiểm tra"
              className="w-full max-w-2xl font-display text-lg sm:text-xl font-extrabold text-[#0F172A] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#2563EB] focus:outline-none py-0.5"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Validation Trigger Button */}
            <button
              type="button"
              onClick={() => setShowValidationPanel((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                errorIssues.length > 0
                  ? 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100'
                  : warningIssues.length > 0
                    ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              {errorIssues.length > 0 ? (
                <AlertCircle className="w-4 h-4" />
              ) : warningIssues.length > 0 ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {errorIssues.length > 0
                ? `${errorIssues.length} lỗi chặn xuất`
                : warningIssues.length > 0
                  ? `${warningIssues.length} cảnh báo`
                  : 'Đạt chuẩn 100%'}
            </button>

            {/* Workflow Status Selector (strict ready_to_export guard) */}
            <select
              value={dossier.status}
              onChange={(e) => handleStatusChange(e.target.value as ExamStatus)}
              aria-label="Trạng thái kiểm duyệt hồ sơ đề"
              className={`rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer ${EXAM_STATUS_LABELS[dossier.status].colorClass}`}
            >
              <option value="draft">Bản nháp</option>
              <option value="pending_review">Chờ kiểm duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="ready_to_export">
                Sẵn sàng xuất đề {!readyCheck.allowed ? '(Đang có lỗi)' : ''}
              </option>
            </select>

            <button
              type="button"
              onClick={handleSaveCurrentDossier}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1E40AF] px-4 py-2 text-sm font-bold text-white hover:opacity-95 whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              Lưu hồ sơ
            </button>
          </div>
        </div>

        {/* 6-Step Progress Bar */}
        {isWorkflowView && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-100">
            {WORKFLOW_STEPS.map((st) => {
              const active = section === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSection(st.id)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all text-left ${
                    active
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/70'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0 ${
                      active ? 'bg-white text-[#2563EB]' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {st.step}
                  </span>
                  <span className="truncate">{st.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Status Toast / Feedback */}
        {statusBanner && (
          <div
            className={`rounded-xl border px-4 py-2.5 text-sm font-medium flex items-center gap-2 ${
              statusBanner.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            {statusBanner.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 shrink-0" />
            )}
            <span>{statusBanner.text}</span>
          </div>
        )}

        {/* Collapsible Live Validation Report */}
        {showValidationPanel && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[#0F172A]">
                Báo cáo kiểm định đồng bộ Ma trận · Bản đặc tả · Đề · Đáp án · Âm thanh
              </h3>
              <button
                type="button"
                onClick={() => setShowValidationPanel(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Thu gọn
              </button>
            </div>
            {validationIssues.length === 0 ? (
              <p className="text-xs font-semibold text-emerald-700">
                Hồ sơ đạt 100% tiêu chuẩn kiểm định: Tổng 10,0 điểm (100%), số câu khớp Ma trận — Bản đặc tả — Đề — Đáp án, bài nghe có audio/transcript hợp lệ. Giáo viên có thể chuyển sang "Sẵn sàng xuất đề".
              </p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {validationIssues.map((issue) => (
                  <li
                    key={issue.id}
                    className={`rounded-lg px-3 py-2 border ${
                      issue.severity === 'error'
                        ? 'border-rose-200 bg-rose-50 text-rose-900'
                        : 'border-amber-200 bg-amber-50 text-amber-900'
                    }`}
                  >
                    <strong className="mr-1.5">
                      {issue.severity === 'error' ? '[Lỗi chặn xuất]' : '[Cảnh báo]'}
                    </strong>
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Main Two-Column Workspace: Left Sidebar + Active Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Navigation Sidebar */}
        <aside className="lg:col-span-3 xl:col-span-2 rounded-[18px] border border-slate-200 bg-white p-3 shadow-xs lg:sticky lg:top-20">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1.5">
            Quy trình &amp; Kho đề
          </div>
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs sm:text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 lg:w-full text-left ${
                    active
                      ? 'bg-blue-50 text-[#1E40AF] font-bold border border-blue-200/80'
                      : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${active ? 'text-[#2563EB]' : 'text-slate-400'}`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge && (
                    <span
                      className={`text-[11px] font-mono-tabular px-1.5 py-0.5 rounded-md ${
                        active ? 'bg-[#2563EB] text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Active Section Canvas */}
        <div className="lg:col-span-9 xl:col-span-10 min-w-0">
          {section === 'config' && (
            <ExamConfigStep
              dossier={dossier}
              onChangeScope={handleChangeScope}
              onGenerateFullPack={handleGenerateFullPack}
              onNextStep={() => setSection('matrix')}
            />
          )}

          {section === 'matrix' && (
            <ExamMatrixStep
              dossier={dossier}
              onUpdateBlueprint={handleUpdateBlueprint}
              onSyncAndGenerateExam={handleSyncAndGenerateExam}
              onNextStep={() => setSection('spec')}
            />
          )}

          {section === 'spec' && (
            <ExamSpecStep
              dossier={dossier}
              onUpdateSpecification={handleUpdateSpecification}
              onResyncFromMatrix={() =>
                handleUpdateBlueprint(dossier.blueprint, true)
              }
              onNextStep={() => setSection('composer')}
            />
          )}

          {section === 'composer' && (
            <ExamComposerStep
              dossier={dossier}
              questionBank={unifiedBank}
              aiAvailable={aiAvailable}
              onUpdateExam={handleUpdateExam}
              onRegenerateWholeExam={handleSyncAndGenerateExam}
              onRegenerateSection={handleRegenerateSection}
              onRegenerateQuestion={handleRegenerateQuestion}
              onNextStep={() => setSection('answers')}
            />
          )}

          {section === 'answers' && (
            <ExamAnswerRubricStep
              dossier={dossier}
              onUpdateExam={handleUpdateExam}
              onUpdateMarkingGuide={handleUpdateMarkingGuide}
              onNextStep={() => setSection('preview')}
            />
          )}

          {section === 'preview' && (
            <ExamPreviewExportStep
              dossier={dossier}
              onConvertAndPresent={(mode) => handlePresentDossier(dossier, mode)}
              onOpenTimedPractice={() => setPracticeDossier(dossier)}
            />
          )}

          {section === 'shuffle' && (
            <ExamShuffleView
              dossier={dossier}
              onUpdateVersions={handleUpdateVersions}
            />
          )}

          {section === 'bank' && (
            <ExamBankView
              bankQuestions={unifiedBank}
              customIds={customBankIds}
              onSaveQuestion={async (item) => {
                const saved = await saveBankQuestionToDB(item);
                setCustomBank((prev) => {
                  const idx = prev.findIndex((q) => q.id === saved.id);
                  if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = saved;
                    return next;
                  }
                  return [saved, ...prev];
                });
              }}
              onBulkImportQuestions={async (items) => {
                await bulkSaveBankQuestionsToDB(items);
                const refreshed = await getAllBankQuestions();
                setCustomBank(refreshed);
              }}
              onDeleteQuestion={async (id) => {
                await deleteBankQuestionFromDB(id);
                setCustomBank((prev) => prev.filter((q) => q.id !== id));
              }}
            />
          )}

          {section === 'library' && (
            <ExamReferenceLibrary
              teacherReferences={teacherRefs}
              onAddTeacherReference={(ref) => setTeacherRefs((prev) => [ref, ...prev])}
              onRemoveTeacherReference={(id) =>
                setTeacherRefs((prev) => prev.filter((r) => r.id !== id))
              }
              onOpenDossierInWorkspace={handleOpenFromLibrary}
              onPresentDossier={(d) => handlePresentDossier(d, 'by_group')}
              onPracticeDossier={(d) => setPracticeDossier(d)}
            />
          )}

          {section === 'history' && (
            <ExamHistoryView
              dossiers={savedDossiers}
              activeDossierId={dossier.id}
              onOpenDossier={(d) => {
                setDossier(d);
                setSection('composer');
              }}
              onDuplicateDossier={async (d) => {
                const copy: ExamDossier = {
                  ...structuredClone(d),
                  id: `exam-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                  title: `${d.title} (Bản sao)`,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                const saved = await saveExamDossierToDB(copy);
                setSavedDossiers((prev) => [saved, ...prev]);
                notify('success', `Đã nhân bản hồ sơ "${saved.title}".`);
              }}
              onDeleteDossier={async (id) => {
                await deleteExamDossierFromDB(id);
                setSavedDossiers((prev) => prev.filter((d) => d.id !== id));
              }}
              onImportDossier={(imported) => {
                setSavedDossiers((prev) => [imported, ...prev]);
                setDossier(imported);
                setSection('composer');
              }}
              onCreateNew={handleCreateBlankDossier}
              onPresentDossier={(d) => handlePresentDossier(d, 'by_group')}
              onPracticeDossier={(d) => setPracticeDossier(d)}
            />
          )}

          {section === 'guide' && (
            <div className="rounded-[18px] border border-slate-200 bg-white p-6 space-y-5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-extrabold text-[#0F172A]">
                    Hướng dẫn quy trình 6 bước soạn bộ đề chuẩn GDPT 2018
                  </h2>
                  <p className="text-sm text-[#475569]">
                    Hoạt động hoàn toàn ngoại tuyến, không bắt buộc cấu hình API Key.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {[
                  {
                    step: 'Bước 1 · Cấu hình phạm vi',
                    desc: 'Chọn khối lớp 10–11–12, bộ sách (Global Success đã xác minh đầy đủ Unit 1–10 hoặc nhập PPCT riêng), loại bài kiểm tra (12 loại), thời lượng và chế độ đề Tốt nghiệp 2025.',
                  },
                  {
                    step: 'Bước 2 · Ma trận đồng bộ',
                    desc: 'Chọn mẫu CV 7991, mẫu trường Tiếng Anh, mẫu Tốt nghiệp 40 câu hoặc tải lên mẫu Excel/Word của trường. Mọi thay đổi số câu/điểm tự tính tổng 10,0 điểm và 100%.',
                  },
                  {
                    step: 'Bước 3 · Bản đặc tả 2 chiều',
                    desc: 'Tự sinh Yêu cầu cần đạt và Biểu hiện cần đánh giá cụ thể cho từng kỹ năng và mức độ nhận thức. Chỉnh sửa số câu/điểm trên Bản đặc tả sẽ cập nhật ngược về Ma trận.',
                  },
                  {
                    step: 'Bước 4 · Soạn đề & Âm thanh Listening',
                    desc: 'Chọn câu từ Ngân hàng câu hỏi, tự gõ/sửa trực tiếp, nhập từ Word/PDF/ảnh, khóa từng câu quan trọng trước khi tái tạo lại, và phát thử hoặc tải MP3/WAV cho bài Listening.',
                  },
                  {
                    step: 'Bước 5 · Đáp án, Kiểm toán & Rubric',
                    desc: 'Hệ thống tự sinh đáp án chuẩn, kiểm tra trùng phương án hoặc sai mã đáp án, đồng bộ transcript bài nghe và cung cấp Rubric chấm Writing & Speaking 5 tiêu chí tùy chỉnh.',
                  },
                  {
                    step: 'Bước 6 · Trộn mã đề, Xuất ZIP & Trình chiếu',
                    desc: 'Trộn nhiều mã đề 101–104 bảo vệ tuyệt đối nhóm bài đọc/nghe/sắp xếp và phương án phụ thuộc; xuất trọn bộ Word, PDF, Excel, OMR, ZIP; hoặc chuyển ngay sang Slide trình chiếu chữa đề.',
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5"
                  >
                    <div className="font-bold text-[#1E40AF]">{item.step}</div>
                    <p className="text-slate-700 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Timed Practice Modal */}
      {practiceDossier && (
        <ExamTimedPracticeModal
          dossier={practiceDossier}
          onClose={() => setPracticeDossier(null)}
        />
      )}
    </div>
  );
};
