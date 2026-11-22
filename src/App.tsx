import React, {useEffect, useMemo, useState} from 'react';
import {
  ArrowRight,
  BookOpen,
  Edit3,
  FilePlus2,
  Headphones,
  Menu,
  Mic,
  PenTool,
  Play,
  Presentation,
  Volume2,
  X,
} from 'lucide-react';
import type {AppSettings, Grade, LessonProject, SkillCategory} from './types/lesson';
import {
  DEFAULT_SPEAKING_RUBRIC,
  DEFAULT_WRITING_RUBRIC,
  SKILL_LABELS,
  SKILL_SHORT_LABELS,
} from './types/lesson';
import {ALL_SAMPLE_LESSONS, SAMPLE_LESSONS_BY_GRADE} from './data/samples';
import {
  DEFAULT_SETTINGS,
  deleteLessonFromDB,
  getAllSavedLessons,
  loadSettingsFromDB,
  saveLessonToDB,
  saveSettingsToDB,
} from './services/storage';
import {checkAIStatus, type AIStatus} from './services/aiService';
import {AssessmentCenter} from './components/AssessmentCenter';
import {GuideView} from './components/GuideView';
import {ImportWizard} from './components/ImportWizard';
import {LibraryView} from './components/LibraryView';
import {OfflineIndicator, PWAInstallButton} from './components/PWAInstallButton';
import {SettingsView} from './components/SettingsView';
import {SlideEditor} from './components/SlideEditor';
import {SlidePresenter} from './components/SlidePresenter';

type ActiveRoute = 'home' | 'library' | 'assessment' | 'editor' | 'guide' | 'settings';

function createBlankLesson(grade: Grade, skill: SkillCategory): LessonProject {
  const now = Date.now();
  return {
    id: `lesson-${now}-${Math.random().toString(36).slice(2, 6)}`,
    title: `Bài giảng ${SKILL_SHORT_LABELS[skill]} · Tiếng Anh Lớp ${grade}`,
    grade,
    skill,
    topic: 'Chủ đề mới',
    description: 'Bài giảng tạo mới trực tiếp trong English Slide Studio.',
    curriculumNote: `Chương trình GDPT 2018 · Tiếng Anh Lớp ${grade}`,
    isSample: false,
    createdAt: now,
    updatedAt: now,
    themeId: 'light_classroom',
    slides: [
      {
        id: `slide-init-1-${now}`,
        order: 0,
        title: `Bài giảng ${SKILL_SHORT_LABELS[skill]} — Lớp ${grade}`,
        subtitle: 'Mục tiêu tiết học và hoạt động tương tác',
        skill,
        activityType: 'title_slide',
        instruction: 'Chỉnh sửa tiêu đề, nội dung hoặc thêm câu hỏi tương tác ngay trong khung bên phải.',
        bullets: [
          'Mục tiêu kiến thức và kỹ năng trọng tâm theo Chương trình GDPT 2018.',
          'Hoạt động tương tác trực tiếp trên máy chiếu hoặc thiết bị học sinh.',
        ],
      },
      {
        id: `slide-init-2-${now}`,
        order: 1,
        title: `Hoạt động ${SKILL_SHORT_LABELS[skill]}`,
        skill,
        activityType:
          skill === 'reading'
            ? 'reading_mcq'
            : skill === 'listening'
              ? 'listening_mcq'
              : skill === 'speaking'
                ? 'speaking_discussion'
                : skill === 'writing'
                  ? 'writing_paragraph'
                  : skill === 'vocabulary'
                    ? 'vocab_flashcards'
                    : skill === 'pronunciation'
                      ? 'pron_vowels_consonants'
                      : 'grammar_mcq',
        instruction: 'Complete the activity below.',
        ...(skill === 'reading'
          ? {
              passage: {
                title: 'Reading Passage',
                paragraphs: ['Nhập hoặc dán bài đọc nguyên văn tại đây...'],
              },
            }
          : {}),
        ...(skill === 'listening'
          ? {
              audio: {
                sourceMode: 'builtin' as const,
                voiceAccent: 'en-GB' as const,
                isSynthesized: true,
                skillObjective: '',
                transcript: '',
                showTranscriptDefault: false,
                timestamps: [],
              },
            }
          : {}),
        ...(skill === 'speaking'
          ? {
              speakingTask: {
                prompt: 'Discuss the topic in pairs for 2 minutes and record your response.',
                cues: ['Introduce your viewpoint', 'Provide two reasons', 'Give a real-life example'],
                rubricCriteria: DEFAULT_SPEAKING_RUBRIC,
              },
            }
          : {}),
        ...(skill === 'writing'
          ? {
              writingTask: {
                prompt: 'Write a structured paragraph (120–150 words) about the lesson topic.',
                minWords: 120,
                maxWords: 150,
                outlineHints: ['Topic sentence', 'Supporting argument 1', 'Supporting argument 2', 'Conclusion'],
                usefulExpressions: ['In my opinion,', 'Firstly,', 'Moreover,', 'To sum up,'],
                rubricCriteria: DEFAULT_WRITING_RUBRIC,
              },
            }
          : {}),
        ...(skill !== 'speaking' && skill !== 'writing' && skill !== 'vocabulary'
          ? {
              questions: [
                {
                  id: `q-init-${now}`,
                  number: 1,
                  type: skill === 'pronunciation' ? 'pronunciation_underlined' : 'mcq',
                  prompt:
                    skill === 'pronunciation'
                      ? 'Choose the word whose underlined part is pronounced differently:'
                      : 'Choose the best answer to complete the sentence:',
                  options: [
                    {id: 'a', label: 'A', text: skill === 'pronunciation' ? 'work<u>ed</u>' : 'Option A'},
                    {id: 'b', label: 'B', text: skill === 'pronunciation' ? 'watch<u>ed</u>' : 'Option B'},
                    {id: 'c', label: 'C', text: skill === 'pronunciation' ? 'stopp<u>ed</u>' : 'Option C'},
                    {id: 'd', label: 'D', text: skill === 'pronunciation' ? 'play<u>ed</u>' : 'Option D'},
                  ],
                  correctAnswer: skill === 'pronunciation' ? 'D' : 'A',
                  explanation: '',
                },
              ],
            }
          : {}),
      },
    ],
  };
}

export default function App() {
  const [route, setRoute] = useState<ActiveRoute>('home');
  const [selectedGrade, setSelectedGrade] = useState<Grade>(10);
  const [quickSkill, setQuickSkill] = useState<SkillCategory>('reading');
  const [savedLessons, setSavedLessons] = useState<LessonProject[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [aiStatus, setAiStatus] = useState<AIStatus>({configured: false, online: true});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [editingLesson, setEditingLesson] = useState<LessonProject | null>(null);
  const [presentingState, setPresentingState] = useState<{
    lesson: LessonProject;
    startIndex: number;
  } | null>(null);

  useEffect(() => {
    getAllSavedLessons().then(setSavedLessons).catch(() => {});
    loadSettingsFromDB()
      .then((s) => {
        setSettings(s);
        setSelectedGrade(s.defaultGrade);
      })
      .catch(() => {});
    checkAIStatus().then(setAiStatus).catch(() => {});
  }, []);

  const allLessons = useMemo(
    () => [...savedLessons, ...ALL_SAMPLE_LESSONS],
    [savedLessons],
  );

  const gradeSamples = SAMPLE_LESSONS_BY_GRADE[selectedGrade];

  const handleSaveLesson = async (lesson: LessonProject) => {
    const saved = await saveLessonToDB(lesson);
    setSavedLessons((prev) => {
      const idx = prev.findIndex((item) => item.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setEditingLesson(saved);
  };

  const handleOpenEditor = (lesson: LessonProject) => {
    // If editing a built-in sample, clone it cleanly with a new user ID on save
    const target = lesson.isSample
      ? {
          ...structuredClone(lesson),
          id: `custom-${lesson.id}-${Date.now()}`,
          isSample: false,
          title: `${lesson.title} (Bản chỉnh sửa)`,
        }
      : lesson;
    setEditingLesson(target);
    setRoute('editor');
  };

  const handleCreateNewLesson = () => {
    const fresh = createBlankLesson(selectedGrade, quickSkill);
    setEditingLesson(fresh);
    setRoute('editor');
    setMobileMenuOpen(false);
  };

  const handleLessonFromWizard = async (
    lesson: LessonProject,
    openMode: 'editor' | 'present',
  ) => {
    const saved = await saveLessonToDB(lesson);
    setSavedLessons((prev) => [saved, ...prev]);
    if (openMode === 'present') {
      setPresentingState({lesson: saved, startIndex: 0});
    } else {
      setEditingLesson(saved);
      setRoute('editor');
    }
  };

  const handleDuplicateSample = async (sample: LessonProject) => {
    const copy: LessonProject = {
      ...structuredClone(sample),
      id: `copy-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      title: `${sample.title} (Bản của tôi)`,
      isSample: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const saved = await saveLessonToDB(copy);
    setSavedLessons((prev) => [saved, ...prev]);
  };

  const handleDeleteSaved = async (id: string) => {
    await deleteLessonFromDB(id);
    setSavedLessons((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveSettings = async (next: AppSettings) => {
    await saveSettingsToDB(next);
    setSettings(next);
    setSelectedGrade(next.defaultGrade);
  };

  const navItems: Array<{id: ActiveRoute; label: string}> = [
    {id: 'home', label: 'Trang chủ'},
    {id: 'library', label: 'Kho bài giảng'},
    {id: 'assessment', label: 'Kiểm tra'},
    {id: 'guide', label: 'Hướng dẫn'},
    {id: 'settings', label: 'Cài đặt'},
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Strict 3-Zone Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setRoute('home')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#0284C7] rounded-md"
          >
            <Presentation className="w-6 h-6 text-[#0F4C81] shrink-0" />
            <span className="font-display text-lg font-bold tracking-tight text-[#0F4C81]">
              English Slide Studio
            </span>
          </button>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav
            aria-label="Điều hướng chính"
            className="hidden md:flex items-center gap-6 text-[15px] font-medium text-slate-600"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRoute(item.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  route === item.id
                    ? 'border-[#0F4C81] text-[#0F4C81] font-semibold'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCreateNewLesson}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B3A63] transition-colors whitespace-nowrap shrink-0"
            >
              <FilePlus2 className="w-4 h-4" />
              Tạo bài mới
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Mở menu điều hướng"
              className="md:hidden p-2 rounded-lg border border-slate-200 text-slate-700"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setRoute(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`block w-full text-left rounded-lg px-3 py-2.5 text-sm font-medium ${
                  route === item.id ? 'bg-sky-50 text-[#0F4C81] font-semibold' : 'text-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Workspace Grade Switcher & PWA Install Bar (Non-sticky to preserve viewport space) */}
      {route !== 'editor' && (
        <div className="border-b border-slate-200/80 bg-slate-50/90">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                Khối lớp đang chọn:
              </span>
              <div className="inline-flex items-center gap-1 p-0.5 bg-slate-200/80 rounded-lg">
                {([10, 11, 12] as Grade[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGrade(g)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      selectedGrade === g
                        ? 'bg-white text-[#0F4C81] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Lớp {g}
                  </button>
                ))}
              </div>
              <span className="hidden sm:inline text-xs text-slate-500">
                Chương trình GDPT 2018 · {ALL_SAMPLE_LESSONS.length} bài mẫu · {savedLessons.length} bài đã lưu
              </span>
            </div>

            <PWAInstallButton compact />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1">
        {route === 'home' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-12">
            {/* Hero Section: Two-Column Balanced Academic Introduction */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
                <div className="text-sm font-medium text-[#0284C7]">
                  Hệ thống soạn bài &amp; trình chiếu Tiếng Anh THPT 10 · 11 · 12
                </div>
                <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-slate-900 leading-tight max-w-2xl">
                  Chuyển tài liệu giảng dạy thành bài trình chiếu tương tác 16:9
                </h1>
                <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
                  Tải trực tiếp tệp Word, PDF hoặc ảnh chụp đề bài để nhận diện cấu trúc, giữ nguyên bài đọc và phần gạch chân phát âm. Dạy trọn vẹn 4 kỹ năng Listening, Speaking, Reading, Writing và xuất Word, PDF, PowerPoint ngay cả khi ngoại tuyến.
                </p>

                {/* Quick Create Skill Strip */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <select
                    value={quickSkill}
                    onChange={(e) => setQuickSkill(e.target.value as SkillCategory)}
                    aria-label="Chọn kỹ năng tạo bài nhanh"
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800"
                  >
                    {(Object.keys(SKILL_LABELS) as SkillCategory[]).map((sk) => (
                      <option key={sk} value={sk}>
                        {SKILL_LABELS[sk]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleCreateNewLesson}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0F4C81] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3A63] whitespace-nowrap"
                  >
                    Soạn bài Lớp {selectedGrade} ngay
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoute('library')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Xem kho {ALL_SAMPLE_LESSONS.length} bài mẫu
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="h-full min-h-[240px] rounded-2xl border border-slate-200 overflow-hidden bg-slate-100">
                  <img
                    src="/src/assets/images/studio_hero_classroom_1795348357830.jpg"
                    alt="Không gian lớp học Tiếng Anh THPT hiện đại với bảng trình chiếu tương tác 16:9"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </section>

            {/* Primary Studio Action: Document Upload & 6-Step Conversion */}
            <section id="document-import" className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-display text-2xl font-bold text-slate-900">
                    Tải tài liệu &amp; Chuyển thành bài trình chiếu
                  </h2>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Hỗ trợ DOCX, PDF lớp văn bản, PDF scan và nhiều ảnh chụp JPG/PNG/WebP.
                  </p>
                </div>
              </div>

              <ImportWizard
                defaultGrade={selectedGrade}
                aiAvailable={aiStatus.online && aiStatus.configured}
                onLessonCreated={handleLessonFromWizard}
              />
            </section>

            {/* 4-Skill + Language Focus Quick Access Matrix for Selected Grade */}
            <section className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-bold text-slate-900">
                    Kho bài mẫu Tiếng Anh Lớp {selectedGrade} ({gradeSamples.length} chuyên đề sẵn sàng trình chiếu)
                  </h2>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Nội dung mẫu tự biên soạn theo yêu cầu cần đạt Chương trình GDPT 2018 — gồm 3 bài Listening nghe ngay cùng Speaking, Reading, Writing, Vocabulary, Grammar, Pronunciation và Ôn tập.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRoute('library')}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F4C81] hover:underline whitespace-nowrap"
                >
                  Mở toàn bộ kho {ALL_SAMPLE_LESSONS.length} bài
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {gradeSamples.map((lesson) => {
                  const Icon =
                    lesson.skill === 'listening'
                      ? Headphones
                      : lesson.skill === 'speaking'
                        ? Mic
                        : lesson.skill === 'reading'
                          ? BookOpen
                          : lesson.skill === 'writing'
                            ? PenTool
                            : lesson.skill === 'pronunciation'
                              ? Volume2
                              : Presentation;

                  return (
                    <article
                      key={lesson.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col justify-between gap-4 hover:border-[#0284C7] transition-colors"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-[#0F4C81]">
                            {SKILL_SHORT_LABELS[lesson.skill]}
                          </span>
                          <Icon className="w-4 h-4 text-[#0284C7] shrink-0" />
                        </div>
                        <h3 className="font-bold text-[15px] text-slate-900 leading-snug">
                          {lesson.title}
                        </h3>
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {lesson.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setPresentingState({lesson, startIndex: 0})}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0F4C81] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0B3A63] whitespace-nowrap"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Trình chiếu
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditor(lesson)}
                          className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Sửa
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* Saved Lessons Section (IndexedDB Local Projects) */}
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-2xl font-bold text-slate-900">
                  Bài giảng đã lưu trên máy ({savedLessons.length})
                </h2>
                {savedLessons.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRoute('library')}
                    className="text-sm font-semibold text-[#0F4C81] hover:underline"
                  >
                    Quản lý tất cả
                  </button>
                )}
              </div>

              {savedLessons.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">
                      Chưa có bài giảng tự tạo nào được lưu trong IndexedDB.
                    </p>
                    <p className="text-sm text-slate-600">
                      Hãy tải tài liệu Word/PDF/ảnh ở khung trên hoặc bấm "Tạo bài mới" — bài giảng của bạn sẽ tự động lưu cục bộ để mở lại cả khi không có mạng.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateNewLesson}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                  >
                    + Tạo bài giảng đầu tiên
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedLessons.slice(0, 6).map((lesson) => (
                    <article
                      key={lesson.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="text-xs text-slate-500">
                          Lớp {lesson.grade} · {SKILL_SHORT_LABELS[lesson.skill]} ·{' '}
                          <span className="font-mono-tabular">{lesson.slides.length} slide</span>
                        </div>
                        <h3 className="font-bold text-base text-slate-900 truncate">{lesson.title}</h3>
                        <p className="text-xs text-slate-500">
                          Cập nhật: {new Date(lesson.updatedAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setPresentingState({lesson, startIndex: 0})}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0F4C81] py-1.5 text-xs font-semibold text-white hover:bg-[#0B3A63]"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Trình chiếu
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditor(lesson)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Chỉnh sửa
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {route === 'library' && (
          <LibraryView
            selectedGrade={selectedGrade}
            onSelectGrade={setSelectedGrade}
            sampleLessons={ALL_SAMPLE_LESSONS}
            savedLessons={savedLessons}
            onPresent={(lesson) => setPresentingState({lesson, startIndex: 0})}
            onEdit={handleOpenEditor}
            onDuplicateToSaved={handleDuplicateSample}
            onDeleteSaved={handleDeleteSaved}
            onImportedJson={(lesson) => {
              setSavedLessons((prev) => [lesson, ...prev]);
            }}
          />
        )}

        {route === 'assessment' && (
          <AssessmentCenter
            allLessons={allLessons}
            defaultGrade={selectedGrade}
            onConvertToLesson={async (testLesson) => {
              const saved = await saveLessonToDB(testLesson);
              setSavedLessons((prev) => [saved, ...prev]);
              setPresentingState({lesson: saved, startIndex: 0});
            }}
          />
        )}

        {route === 'editor' && editingLesson && (
          <SlideEditor
            lesson={editingLesson}
            onSave={handleSaveLesson}
            onPresent={(updated, idx) => {
              setEditingLesson(updated);
              setPresentingState({lesson: updated, startIndex: idx});
            }}
            onBack={() => setRoute('library')}
          />
        )}

        {route === 'guide' && <GuideView />}

        {route === 'settings' && (
          <SettingsView
            settings={settings}
            savedLessonsCount={savedLessons.length}
            aiStatus={aiStatus}
            onSaveSettings={handleSaveSettings}
            onLessonImported={(lesson) => {
              setSavedLessons((prev) => [lesson, ...prev]);
              setEditingLesson(lesson);
              setRoute('editor');
            }}
          />
        )}
      </div>

      {/* Required Copyright Footer (visible on Home, Library, Assessment, Guide, Settings, and Editor; never covers Fullscreen Presenter) */}
      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-center">
          <p className="text-sm font-medium text-slate-700">
            Copyright © 2025 - Phát triển bởi Thầy Hồ Nguyễn Đa Thiện
          </p>
        </div>
      </footer>

      {/* Fullscreen 16:9 Interactive Presentation Overlay */}
      {presentingState && (
        <SlidePresenter
          lesson={presentingState.lesson}
          initialSlideIndex={presentingState.startIndex}
          initialFontScale={settings.presenterFontScale}
          initialShowNotes={settings.showTeacherNotesByDefault}
          onExit={() => setPresentingState(null)}
        />
      )}

      {/* Honest Offline Mode Banner */}
      <OfflineIndicator />
    </div>
  );
}
