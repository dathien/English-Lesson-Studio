import React, {useEffect, useMemo, useState} from 'react';
import {motion} from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ClipboardCheck,
  Clock,
  Copy,
  Edit3,
  FilePlus2,
  GraduationCap,
  Headphones,
  Menu,
  Mic,
  PenTool,
  Play,
  X,
} from 'lucide-react';
import type {AppSettings, Grade, LessonProject, SkillCategory} from './types/lesson';
import {
  DEFAULT_SPEAKING_RUBRIC,
  DEFAULT_WRITING_RUBRIC,
  SKILL_SHORT_LABELS,
} from './types/lesson';
import {ALL_SAMPLE_LESSONS} from './data/samples';
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
import {ExamStudio} from './components/exam/ExamStudio';
import {GuideView} from './components/GuideView';
import {ImportWizard} from './components/ImportWizard';
import {
  getLessonDurationLabel,
  LibraryView,
  SKILL_VISUAL_META,
} from './components/LibraryView';
import {OfflineIndicator, PWAInstallButton} from './components/PWAInstallButton';
import {SettingsView} from './components/SettingsView';
import {SlideEditor} from './components/SlideEditor';
import {SlidePresenter} from './components/SlidePresenter';

import {EnglishInteractiveLab} from './components/EnglishInteractiveLab';

type ActiveRoute =
  | 'interactive_lab'
  | 'home'
  | 'samples'
  | 'my_lessons'
  | 'assessment'
  | 'editor'
  | 'guide'
  | 'settings';

function createBlankLesson(grade: Grade, skill: SkillCategory): LessonProject {
  const now = Date.now();
  return {
    id: `lesson-${now}-${Math.random().toString(36).slice(2, 6)}`,
    title: `Bài giảng ${SKILL_SHORT_LABELS[skill]} · Tiếng Anh Lớp ${grade}`,
    grade,
    skill,
    topic: 'Chủ đề mới',
    description: 'Bài giảng tạo mới trực tiếp trong English Lesson Studio.',
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
        instruction:
          'Chỉnh sửa tiêu đề, nội dung hoặc thêm câu hỏi tương tác ngay trong bảng thuộc tính bên phải.',
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
                cues: [
                  'Introduce your viewpoint',
                  'Provide two reasons',
                  'Give a real-life example',
                ],
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
                outlineHints: [
                  'Topic sentence',
                  'Supporting argument 1',
                  'Supporting argument 2',
                  'Conclusion',
                ],
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
                    {
                      id: 'a',
                      label: 'A',
                      text: skill === 'pronunciation' ? 'work<u>ed</u>' : 'Option A',
                    },
                    {
                      id: 'b',
                      label: 'B',
                      text: skill === 'pronunciation' ? 'watch<u>ed</u>' : 'Option B',
                    },
                    {
                      id: 'c',
                      label: 'C',
                      text: skill === 'pronunciation' ? 'stopp<u>ed</u>' : 'Option C',
                    },
                    {
                      id: 'd',
                      label: 'D',
                      text: skill === 'pronunciation' ? 'play<u>ed</u>' : 'Option D',
                    },
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

const HOME_FILTER_SKILLS: Array<SkillCategory | 'all'> = [
  'all',
  'listening',
  'speaking',
  'reading',
  'writing',
  'vocabulary',
  'grammar',
  'pronunciation',
];

export default function App() {
  const [route, setRoute] = useState<ActiveRoute>('home');
  const [selectedGrade, setSelectedGrade] = useState<Grade>(10);
  const [homeGradeFilter, setHomeGradeFilter] = useState<Grade | 'all'>('all');
  const [homeSkillFilter, setHomeSkillFilter] = useState<SkillCategory | 'all'>('all');
  const [savedLessons, setSavedLessons] = useState<LessonProject[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [aiStatus, setAiStatus] = useState<AIStatus>({configured: false, online: true});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [assessmentMode, setAssessmentMode] = useState<'exam_studio' | 'quick_quiz'>('exam_studio');

  const [editingLesson, setEditingLesson] = useState<LessonProject | null>(null);
  const [presentingState, setPresentingState] = useState<{
    lesson: LessonProject;
    startIndex: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    getAllSavedLessons()
      .then((list) => {
        if (mounted) setSavedLessons(list);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingSaved(false);
      });

    loadSettingsFromDB()
      .then((s) => {
        if (mounted) {
          setSettings(s);
          setSelectedGrade(s.defaultGrade);
        }
      })
      .catch(() => {});

    checkAIStatus()
      .then((st) => {
        if (mounted) setAiStatus(st);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const allLessons = useMemo(
    () => [...savedLessons, ...ALL_SAMPLE_LESSONS],
    [savedLessons],
  );

  const filteredHomeSamples = useMemo(() => {
    return ALL_SAMPLE_LESSONS.filter((lesson) => {
      if (homeGradeFilter !== 'all' && lesson.grade !== homeGradeFilter) return false;
      if (homeSkillFilter !== 'all' && lesson.skill !== homeSkillFilter) return false;
      return true;
    }).slice(0, 9);
  }, [homeGradeFilter, homeSkillFilter]);

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

  const handleCreateNewLesson = (skill: SkillCategory = 'reading') => {
    const fresh = createBlankLesson(selectedGrade, skill);
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
    setCopiedId(sample.id);
    window.setTimeout(() => setCopiedId((curr) => (curr === sample.id ? null : curr)), 2200);
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
    {id: 'samples', label: 'Kho bài mẫu'},
    {id: 'my_lessons', label: 'Bài của tôi'},
    {id: 'assessment', label: 'Soạn đề & Đánh giá'},
    {id: 'interactive_lab', label: 'Học tương tác'},
    {id: 'guide', label: 'Hướng dẫn'},
    {id: 'settings', label: 'Cài đặt'},
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Blue Gradient Header */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#0284C7] text-white shadow-md shadow-blue-950/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-[68px] py-2.5 flex items-center justify-between gap-4 lg:gap-8">
          {/* Left: Logo + Official Name + Concise Descriptor */}
          <button
            type="button"
            onClick={() => {
              setRoute('home');
              setMobileMenuOpen(false);
            }}
            className="flex items-center gap-3 text-left min-w-0 shrink-0 focus-visible:outline-2 focus-visible:outline-white/80 rounded-xl"
          >
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0 shadow-xs">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg sm:text-[19px] font-extrabold tracking-tight leading-tight whitespace-nowrap">
                English Lesson Studio
              </div>
              <div className="text-xs text-blue-100/90 leading-tight truncate hidden sm:block mt-0.5">
                Hệ thống soạn bài &amp; trình chiếu Tiếng Anh THPT · Lớp 10 · 11 · 12
              </div>
            </div>
          </button>

          {/* Right: 6 Clean Single-Line Nav Links */}
          <nav
            aria-label="Điều hướng chính"
            className="hidden 2xl:flex items-center gap-1 text-[14px] xl:text-[15px] font-medium"
          >
            {navItems.map((item) => {
              const active = route === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRoute(item.id)}
                  className={`px-3 py-2 rounded-xl transition-all duration-150 whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-[#1E40AF] font-bold shadow-xs'
                      : 'text-blue-50 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Compact Mobile / Tablet Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
            className="2xl:hidden p-2.5 rounded-xl bg-white/15 border border-white/25 text-white hover:bg-white/25 transition-colors shrink-0"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Collapsible Mobile / Tablet Drawer */}
        {mobileMenuOpen && (
          <div className="2xl:hidden border-t border-white/15 bg-[#1E40AF] px-4 py-3 space-y-1.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setRoute(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`block w-full text-left rounded-xl px-4 py-3 text-[15px] font-semibold transition-colors ${
                  route === item.id
                    ? 'bg-white text-[#1E40AF]'
                    : 'text-blue-50 hover:bg-white/10'
                }`}
              >
                {item.label}
              </button>
            ))}
            <div className="pt-2 border-t border-white/15 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleCreateNewLesson()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#06B6D4] px-3.5 py-2.5 text-sm font-bold text-slate-950"
              >
                <FilePlus2 className="w-4 h-4" />
                Tạo bài mới
              </button>
              <button
                type="button"
                onClick={() => {
                  setRoute('assessment');
                  setMobileMenuOpen(false);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2.5 text-sm font-semibold text-white"
              >
                <ClipboardCheck className="w-4 h-4" />
                Kiểm tra
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0">
        {route === 'interactive_lab' && <EnglishInteractiveLab />}
        {route === 'home' && (
          <motion.div
            key="route-home"
            initial={{opacity: 0, y: 8}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.22, ease: [0.16, 1, 0.3, 1]}}
            className="max-w-7xl mx-auto px-4 sm:px-6 py-7 sm:py-10 space-y-12"
          >
            {/* TWO-COLUMN HERO SECTION */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-8 items-stretch">
              {/* Left Column: Headline, Description, 4 Skills, Balanced Educational Illustration */}
              <div className="lg:col-span-6 flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div className="text-sm font-bold text-[#2563EB]">
                    Tiếng Anh THPT · Lớp 10 · 11 · 12 · Chương trình GDPT 2018
                  </div>
                  <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-[#0F172A] leading-[1.15]">
                    Soạn bài &amp; Trình chiếu Tiếng Anh thông minh
                  </h1>
                  <p className="text-base text-[#475569] leading-relaxed max-w-xl">
                    Chuyển tài liệu Word (.docx), PDF hoặc nhiều ảnh chụp thành bài trình chiếu tương tác 16:9 chuẩn sư phạm — giữ nguyên bài đọc, phần gạch chân phát âm và xuất Word, PDF, PowerPoint.
                  </p>

                  {/* 4 Core Skills Strip (Clean structured labels, no garish badge soup) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    {[
                      {
                        key: 'listening' as SkillCategory,
                        label: 'Listening',
                        icon: Headphones,
                        tint: 'text-[#2563EB] bg-blue-50/90 border-blue-100',
                      },
                      {
                        key: 'speaking' as SkillCategory,
                        label: 'Speaking',
                        icon: Mic,
                        tint: 'text-[#0891B2] bg-cyan-50/90 border-cyan-100',
                      },
                      {
                        key: 'reading' as SkillCategory,
                        label: 'Reading',
                        icon: BookOpen,
                        tint: 'text-[#059669] bg-emerald-50/90 border-emerald-100',
                      },
                      {
                        key: 'writing' as SkillCategory,
                        label: 'Writing',
                        icon: PenTool,
                        tint: 'text-[#EA580C] bg-orange-50/90 border-orange-100',
                      },
                    ].map((sk) => {
                      const Icon = sk.icon;
                      return (
                        <button
                          key={sk.key}
                          type="button"
                          onClick={() => {
                            setHomeSkillFilter(sk.key);
                            document
                              .getElementById('sample-showcase')
                              ?.scrollIntoView({behavior: 'smooth'});
                          }}
                          className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-bold transition-all hover:-translate-y-0.5 hover:shadow-xs ${sk.tint}`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{sk.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Educational Illustration + Quick Studio Actions */}
                <div className="space-y-3.5">
                  <div className="rounded-[20px] border border-slate-200/90 overflow-hidden bg-gradient-to-br from-blue-50 to-cyan-50 shadow-sm aspect-[16/9]">
                    <img
                      src="/src/assets/images/studio_hero_classroom_1795348357830.jpg"
                      alt="Không gian giảng dạy Tiếng Anh THPT hiện đại với bài trình chiếu tương tác 16:9"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleCreateNewLesson('reading')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-300 px-3.5 py-2 text-sm font-semibold text-[#0F172A] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors whitespace-nowrap"
                      >
                        <FilePlus2 className="w-4 h-4 text-[#2563EB]" />
                        Soạn bài trống
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAssessmentMode('exam_studio');
                          setRoute('assessment');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-300 px-3.5 py-2 text-sm font-semibold text-[#0F172A] hover:border-[#10B981] hover:text-[#059669] transition-colors whitespace-nowrap"
                      >
                        <ClipboardCheck className="w-4 h-4 text-[#10B981]" />
                        Soạn đề &amp; Đánh giá
                      </button>
                    </div>
                    <PWAInstallButton compact />
                  </div>
                </div>
              </div>

              {/* Right Column: Prominent Upload & Conversion Studio Card */}
              <div className="lg:col-span-6">
                <ImportWizard
                  defaultGrade={selectedGrade}
                  aiAvailable={aiStatus.online && aiStatus.configured}
                  onGradeChange={setSelectedGrade}
                  onLessonCreated={handleLessonFromWizard}
                />
              </div>
            </section>

            {/* SAMPLE LIBRARY PREVIEW SECTION */}
            <section id="sample-showcase" className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-[#2563EB]">
                    Sẵn sàng mở trình chiếu ngay trên lớp
                  </div>
                  <h2 className="font-display text-2xl sm:text-[28px] font-extrabold text-[#0F172A]">
                    Kho bài mẫu Tiếng Anh THPT ({ALL_SAMPLE_LESSONS.length} bài)
                  </h2>
                  <p className="text-[15px] text-[#475569]">
                    Tự biên soạn bám sát Chương trình GDPT 2018 — gồm 9 bài Listening nghe ngay cùng Speaking, Reading, Writing, Vocabulary, Grammar và Pronunciation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRoute('samples')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-[#2563EB] hover:bg-blue-100 transition-colors whitespace-nowrap"
                >
                  Xem toàn bộ kho bài mẫu
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Clean Interactive Filter Strip */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs">
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setHomeGradeFilter('all')}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                      homeGradeFilter === 'all'
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
                        setHomeGradeFilter(g);
                        setSelectedGrade(g);
                      }}
                      className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                        homeGradeFilter === g
                          ? 'bg-white text-[#2563EB] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Lớp {g}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {HOME_FILTER_SKILLS.map((sk) => {
                    const active = homeSkillFilter === sk;
                    const label = sk === 'all' ? 'Tất cả kỹ năng' : SKILL_VISUAL_META[sk].label;
                    return (
                      <button
                        key={sk}
                        type="button"
                        onClick={() => setHomeSkillFilter(sk)}
                        className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                          active
                            ? 'bg-[#2563EB] text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Uniform-Height Sample Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
                {filteredHomeSamples.map((lesson) => {
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
                      <div className="flex items-start gap-3.5 mb-3">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${meta.iconBg} ${meta.iconColor}`}
                        >
                          <SkillIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#475569] truncate">
                            <span className="text-[#2563EB]">Lớp {lesson.grade}</span>
                            <span aria-hidden="true">·</span>
                            <span>{SKILL_SHORT_LABELS[lesson.skill]}</span>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{lesson.topic}</span>
                          </div>
                          <h3 className="text-[17px] font-bold text-[#0F172A] leading-snug line-clamp-2 mt-1 min-h-[2.8rem]">
                            {lesson.title}
                          </h3>
                        </div>
                      </div>

                      <p className="text-[15px] text-[#475569] line-clamp-2 leading-relaxed min-h-[3rem] mb-3.5">
                        {lesson.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-[#475569] font-mono-tabular mb-4">
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

                      <div className="mt-auto pt-3.5 border-t border-slate-100 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPresentingState({lesson, startIndex: 0})}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1E40AF] px-3 py-2.5 text-sm font-semibold text-white hover:opacity-95 transition-opacity whitespace-nowrap"
                        >
                          <Play className="w-4 h-4" />
                          Mở bài
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditor(lesson)}
                          className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-[#0F172A] hover:bg-slate-50 transition-colors whitespace-nowrap"
                        >
                          <Edit3 className="w-4 h-4 text-[#2563EB]" />
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateSample(lesson)}
                          title="Sao chép vào Bài của tôi"
                          className={`inline-flex items-center justify-center rounded-xl border px-2.5 py-2.5 transition-colors ${
                            isCopied
                              ? 'border-emerald-300 bg-emerald-50 text-[#10B981]'
                              : 'border-slate-300 bg-white text-slate-600 hover:border-[#2563EB] hover:text-[#2563EB]'
                          }`}
                        >
                          {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* MY SAVED LESSONS SECTION */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-[#0F172A]">
                    Bài giảng của tôi ({savedLessons.length})
                  </h2>
                  <p className="text-sm text-[#475569] mt-0.5">
                    Lưu tự động trong trình duyệt (IndexedDB) — mở lại và trình chiếu ngay cả khi ngoại tuyến.
                  </p>
                </div>
                {savedLessons.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRoute('my_lessons')}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-[#2563EB] hover:underline whitespace-nowrap"
                  >
                    Quản lý tất cả
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              {loadingSaved ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {[1, 2, 3].map((k) => (
                    <div key={k} className="rounded-[18px] border border-slate-200 bg-white p-5 space-y-3">
                      <div className="h-4 w-32 rounded studio-skeleton" />
                      <div className="h-5 w-4/5 rounded studio-skeleton" />
                      <div className="h-9 w-full rounded-xl studio-skeleton" />
                    </div>
                  ))}
                </div>
              ) : savedLessons.length === 0 ? (
                <div className="rounded-[20px] border border-slate-200/90 bg-white p-6 flex flex-wrap items-center justify-between gap-4 shadow-xs">
                  <div className="space-y-1">
                    <p className="font-bold text-base text-[#0F172A]">
                      Chưa có bài giảng cá nhân nào được lưu trên máy.
                    </p>
                    <p className="text-sm text-[#475569]">
                      Tải tài liệu Word/PDF/ảnh ở khung phía trên, bấm "Sao chép bài" từ Kho bài mẫu hoặc tạo bài mới ngay bây giờ.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCreateNewLesson('reading')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 whitespace-nowrap"
                  >
                    <FilePlus2 className="w-4 h-4" />
                    Tạo bài giảng đầu tiên
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
                  {savedLessons.slice(0, 6).map((lesson) => {
                    const meta = SKILL_VISUAL_META[lesson.skill];
                    const SkillIcon = meta.icon;
                    return (
                      <article
                        key={lesson.id}
                        className="h-full rounded-[18px] border border-slate-200/90 bg-white p-5 shadow-xs hover:shadow-md hover:border-blue-300 edtech-card flex flex-col justify-between gap-4"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.iconBg} ${meta.iconColor}`}
                          >
                            <SkillIcon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="text-xs font-semibold text-[#475569]">
                              <span className="text-[#2563EB]">Lớp {lesson.grade}</span> ·{' '}
                              {SKILL_SHORT_LABELS[lesson.skill]} ·{' '}
                              <span className="font-mono-tabular">{lesson.slides.length} slide</span>
                            </div>
                            <h3 className="font-bold text-[16px] text-[#0F172A] line-clamp-2 leading-snug">
                              {lesson.title}
                            </h3>
                            <p className="text-xs text-slate-500">
                              Cập nhật: {new Date(lesson.updatedAt).toLocaleString('vi-VN')}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setPresentingState({lesson, startIndex: 0})}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1E40AF] py-2 text-sm font-semibold text-white hover:opacity-95"
                          >
                            <Play className="w-4 h-4" />
                            Mở bài
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditor(lesson)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 py-2 text-sm font-semibold text-[#0F172A] hover:bg-slate-50"
                          >
                            <Edit3 className="w-4 h-4 text-[#2563EB]" />
                            Chỉnh sửa
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </motion.div>
        )}

        {(route === 'samples' || route === 'my_lessons') && (
          <motion.div
            key={`route-${route}`}
            initial={{opacity: 0, y: 8}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
          >
            <LibraryView
              initialTab={route === 'my_lessons' ? 'saved' : 'samples'}
              selectedGrade={selectedGrade}
              onSelectGrade={setSelectedGrade}
              sampleLessons={ALL_SAMPLE_LESSONS}
              savedLessons={savedLessons}
              loadingSaved={loadingSaved}
              onPresent={(lesson) => setPresentingState({lesson, startIndex: 0})}
              onEdit={handleOpenEditor}
              onCreateNew={() => handleCreateNewLesson('reading')}
              onOpenAssessment={() => setRoute('assessment')}
              onDuplicateToSaved={handleDuplicateSample}
              onDeleteSaved={handleDeleteSaved}
              onImportedJson={(lesson) => {
                setSavedLessons((prev) => [lesson, ...prev]);
              }}
            />
          </motion.div>
        )}

        {route === 'assessment' && (
          <motion.div
            key="route-assessment"
            initial={{opacity: 0, y: 8}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
          >
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl shadow-xs">
                <button
                  type="button"
                  onClick={() => setAssessmentMode('exam_studio')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                    assessmentMode === 'exam_studio'
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Soạn đề, Ma trận &amp; Bản đặc tả THPT
                </button>
                <button
                  type="button"
                  onClick={() => setAssessmentMode('quick_quiz')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                    assessmentMode === 'quick_quiz'
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Đề luyện nhanh từ kho bài giảng
                </button>
              </div>
            </div>

            {assessmentMode === 'exam_studio' ? (
              <ExamStudio
                defaultGrade={
                  selectedGrade >= 10 ? (selectedGrade as 10 | 11 | 12) : 10
                }
                defaultSchoolName={settings.schoolName}
                aiAvailable={aiStatus.online && aiStatus.configured}
                onPresentLesson={(lesson) =>
                  setPresentingState({lesson, startIndex: 0})
                }
                onSaveAndEditLesson={async (lesson) => {
                  const saved = await saveLessonToDB(lesson);
                  setSavedLessons((prev) => [saved, ...prev]);
                  setEditingLesson(saved);
                  setRoute('editor');
                }}
              />
            ) : (
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
          </motion.div>
        )}

        {route === 'editor' && editingLesson && (
          <SlideEditor
            lesson={editingLesson}
            onSave={handleSaveLesson}
            onPresent={(updated, idx) => {
              setEditingLesson(updated);
              setPresentingState({lesson: updated, startIndex: idx});
            }}
            onBack={() => setRoute('my_lessons')}
          />
        )}

        {route === 'guide' && (
          <motion.div
            key="route-guide"
            initial={{opacity: 0, y: 8}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
          >
            <GuideView />
          </motion.div>
        )}

        {route === 'settings' && (
          <motion.div
            key="route-settings"
            initial={{opacity: 0, y: 8}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
          >
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
          </motion.div>
        )}
      </main>

      {/* Required Centered Copyright Footer (Visible on Home & all management/editor views; never covers Fullscreen Presenter) */}
      <footer className="border-t border-slate-200/90 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-center">
          <p className="text-sm font-medium text-[#475569]">
            Copyright © 2025 - Phát triển bởi Thầy Hồ Nguyễn Đa Thiện
          </p>
        </div>
      </footer>

      {/* Fullscreen Interactive Presentation Overlay */}
      {presentingState && (
        <SlidePresenter
          lesson={presentingState.lesson}
          initialSlideIndex={presentingState.startIndex}
          initialFontScale={settings.presenterFontScale}
          initialShowNotes={settings.showTeacherNotesByDefault}
          initialTheme={settings.defaultTheme}
          onExit={() => setPresentingState(null)}
        />
      )}

      {/* Honest Offline Mode Banner */}
      <OfflineIndicator />
    </div>
  );
}
