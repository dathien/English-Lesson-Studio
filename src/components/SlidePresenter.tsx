import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  ListChecks,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';
import type {EducationLevel, LessonProject, SlideThemeId} from '../types/lesson';
import {
  ACTIVITY_LABELS,
  EDUCATION_LEVEL_SHORT,
  getEducationLevelFromGrade,
  SKILL_SHORT_LABELS,
} from '../types/lesson';
import {RenderFormattedText} from '../utils/richText';
import {ListeningWidget} from './interactive/ListeningWidget';
import {
  evaluateQuestion,
  QuestionRenderer,
  type QuestionAnswerMap,
} from './interactive/QuestionRenderer';
import {ReadingSplitView} from './interactive/ReadingSplitView';
import {SpeakingWidget} from './interactive/SpeakingWidget';
import {VocabFlashcards} from './interactive/VocabFlashcards';
import {WritingWidget} from './interactive/WritingWidget';
import {EmbeddedLabPlayer} from './interactiveLab/EmbeddedLabPlayer';

interface SlidePresenterProps {
  lesson: LessonProject;
  initialSlideIndex?: number;
  initialFontScale?: number;
  initialShowNotes?: boolean;
  initialTheme?: SlideThemeId;
  onExit: () => void;
}

interface PresenterThemeSpec {
  id: SlideThemeId;
  label: string;
  swatch: string;
  outerBg: string;
  topBar: string;
  bottomBar: string;
  cardStage: string;
  accentText: string;
  primaryBtn: string;
  dark: boolean;
}

const PRESENTER_THEMES: Record<SlideThemeId, PresenterThemeSpec> = {
  light_classroom: {
    id: 'light_classroom',
    label: 'Sáng',
    swatch: '#FFFFFF',
    outerBg: 'bg-gradient-to-br from-[#F8FAFC] via-[#EFF6FF]/60 to-[#F1F5F9] text-[#0F172A]',
    topBar: 'bg-white/95 border-slate-200/90 text-[#0F172A]',
    bottomBar: 'bg-white/95 border-slate-200/90 text-[#0F172A]',
    cardStage: 'bg-white border-slate-200/90 text-[#0F172A] shadow-lg shadow-slate-900/5',
    accentText: 'text-[#2563EB]',
    primaryBtn: 'bg-gradient-to-r from-[#2563EB] to-[#1E40AF] text-white',
    dark: false,
  },
  dark_theater: {
    id: 'dark_theater',
    label: 'Tối',
    swatch: '#0F172A',
    outerBg: 'bg-[#0B1120] text-slate-100',
    topBar: 'bg-slate-900/95 border-slate-800 text-slate-100',
    bottomBar: 'bg-slate-900/95 border-slate-800 text-slate-100',
    cardStage: 'bg-slate-900 border-slate-800 text-slate-100 shadow-2xl shadow-black/40',
    accentText: 'text-sky-300',
    primaryBtn: 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white',
    dark: true,
  },
  ocean_blue: {
    id: 'ocean_blue',
    label: 'Xanh biển',
    swatch: '#2563EB',
    outerBg: 'bg-gradient-to-br from-[#DBEAFE] via-[#EFF6FF] to-[#CFFAFE] text-[#0F172A]',
    topBar: 'bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#0284C7] border-blue-700/30 text-white',
    bottomBar: 'bg-white/95 border-blue-200 text-[#0F172A]',
    cardStage: 'bg-white/98 border-blue-200/90 text-[#0F172A] shadow-xl shadow-blue-900/10',
    accentText: 'text-[#2563EB]',
    primaryBtn: 'bg-gradient-to-r from-[#2563EB] to-[#06B6D4] text-white',
    dark: false,
  },
  emerald_fresh: {
    id: 'emerald_fresh',
    label: 'Xanh lá',
    swatch: '#10B981',
    outerBg: 'bg-gradient-to-br from-[#D1FAE5] via-[#ECFDF5] to-[#F0FDF4] text-[#0F172A]',
    topBar: 'bg-gradient-to-r from-[#047857] via-[#059669] to-[#10B981] border-emerald-700/30 text-white',
    bottomBar: 'bg-white/95 border-emerald-200 text-[#0F172A]',
    cardStage: 'bg-white/98 border-emerald-200/90 text-[#0F172A] shadow-xl shadow-emerald-900/10',
    accentText: 'text-[#059669]',
    primaryBtn: 'bg-gradient-to-r from-[#059669] to-[#10B981] text-white',
    dark: false,
  },
  bright_orange: {
    id: 'bright_orange',
    label: 'Cam sáng',
    swatch: '#F97316',
    outerBg: 'bg-gradient-to-br from-[#FFEDD5] via-[#FFF7ED] to-[#FEF3C7] text-[#0F172A]',
    topBar: 'bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#F97316] border-orange-700/30 text-white',
    bottomBar: 'bg-white/95 border-orange-200 text-[#0F172A]',
    cardStage: 'bg-white/98 border-orange-200/90 text-[#0F172A] shadow-xl shadow-orange-900/10',
    accentText: 'text-[#EA580C]',
    primaryBtn: 'bg-gradient-to-r from-[#EA580C] to-[#F97316] text-white',
    dark: false,
  },
  // Legacy compatibility mappings
  projector_contrast: {
    id: 'projector_contrast',
    label: 'Sáng',
    swatch: '#FFFFFF',
    outerBg: 'bg-white text-slate-950',
    topBar: 'bg-slate-950 border-slate-800 text-white',
    bottomBar: 'bg-white border-slate-300 text-slate-950',
    cardStage: 'bg-white border-slate-300 text-slate-950 shadow-md',
    accentText: 'text-[#1E40AF]',
    primaryBtn: 'bg-[#1E40AF] text-white',
    dark: false,
  },
  warm_paper: {
    id: 'warm_paper',
    label: 'Sáng',
    swatch: '#FAF7F2',
    outerBg: 'bg-[#FAF7F2] text-stone-900',
    topBar: 'bg-white/95 border-stone-200 text-stone-900',
    bottomBar: 'bg-white/95 border-stone-200 text-stone-900',
    cardStage: 'bg-white border-stone-200 text-stone-900 shadow-md',
    accentText: 'text-[#2563EB]',
    primaryBtn: 'bg-[#2563EB] text-white',
    dark: false,
  },
};

const SELECTABLE_THEME_IDS: SlideThemeId[] = [
  'light_classroom',
  'dark_theater',
  'ocean_blue',
  'emerald_fresh',
  'bright_orange',
];

export const SlidePresenter: React.FC<SlidePresenterProps> = ({
  lesson,
  initialSlideIndex = 0,
  initialFontScale = 1,
  initialShowNotes = false,
  initialTheme,
  onExit,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [slideIdx, setSlideIdx] = useState(
    Math.min(Math.max(0, initialSlideIndex), Math.max(0, lesson.slides.length - 1)),
  );
  const [answersBySlide, setAnswersBySlide] = useState<Record<string, QuestionAnswerMap>>({});
  const [checkedSlides, setCheckedSlides] = useState<Record<string, boolean>>({});
  const [showAnswersSlides, setShowAnswersSlides] = useState<Record<string, boolean>>({});
  const [showExplanationsSlides, setShowExplanationsSlides] = useState<Record<string, boolean>>({});

  const [themeId, setThemeId] = useState<SlideThemeId>(
    initialTheme || lesson.themeId || 'light_classroom',
  );
  const [fontScale, setFontScale] = useState(initialFontScale);
  const [showNotes, setShowNotes] = useState(initialShowNotes);
  const [showOutline, setShowOutline] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [jumpAudioSec, setJumpAudioSec] = useState<number | null>(null);

  // Classroom Timer
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerSec, setTimerSec] = useState(180);
  const [timerRunning, setTimerRunning] = useState(false);

  const currentSlide = lesson.slides[slideIdx];
  const educationLevel: EducationLevel =
    lesson.educationLevel || getEducationLevelFromGrade(lesson.grade);
  const isPrimary = educationLevel === 'primary';
  const isSecondary = educationLevel === 'secondary';
  const effectiveFontScale = isPrimary
    ? Math.min(1.4, Number((fontScale * 1.12).toFixed(2)))
    : fontScale;

  const theme = PRESENTER_THEMES[themeId] || PRESENTER_THEMES.light_classroom;
  const isColoredTopBar =
    themeId === 'ocean_blue' ||
    themeId === 'emerald_fresh' ||
    themeId === 'bright_orange' ||
    themeId === 'dark_theater' ||
    themeId === 'projector_contrast';

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setTimerSec((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const goPrev = useCallback(() => {
    setSlideIdx((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setSlideIdx((i) => Math.min(lesson.slides.length - 1, i + 1));
  }, [lesson.slides.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape' && !document.fullscreenElement) {
        onExit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev, onExit]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen may be restricted in certain preview frames
    }
  };

  const slideAnswers = currentSlide ? answersBySlide[currentSlide.id] || {} : {};
  const isChecked = currentSlide ? Boolean(checkedSlides[currentSlide.id]) : false;
  const isShowAnswers = currentSlide ? Boolean(showAnswersSlides[currentSlide.id]) : false;
  const isShowExplanations = currentSlide ? Boolean(showExplanationsSlides[currentSlide.id]) : false;

  const hasQuestions = Boolean(currentSlide?.questions && currentSlide.questions.length > 0);
  const isReadingLayout = Boolean(currentSlide?.passage);
  const isWideActivity = Boolean(
    currentSlide?.passage ||
      currentSlide?.speakingTask ||
      currentSlide?.writingTask ||
      currentSlide?.audio ||
      currentSlide?.interactiveLabRef ||
      (currentSlide?.vocabItems && currentSlide.vocabItems.length > 0),
  );

  const scoreSummary = useMemo(() => {
    if (!currentSlide?.questions || !isChecked) return null;
    let correct = 0;
    for (const q of currentSlide.questions) {
      if (evaluateQuestion(q, slideAnswers[q.id]) === true) {
        correct++;
      }
    }
    return {correct, total: currentSlide.questions.length};
  }, [currentSlide, isChecked, slideAnswers]);

  const handleAnswerChange = (qId: string, val: string | string[] | Record<string, string>) => {
    if (!currentSlide) return;
    setAnswersBySlide((prev) => ({
      ...prev,
      [currentSlide.id]: {
        ...(prev[currentSlide.id] || {}),
        [qId]: val,
      },
    }));
  };

  const handleTryAgain = () => {
    if (!currentSlide) return;
    setAnswersBySlide((prev) => ({...prev, [currentSlide.id]: {}}));
    setCheckedSlides((prev) => ({...prev, [currentSlide.id]: false}));
    setShowAnswersSlides((prev) => ({...prev, [currentSlide.id]: false}));
    setShowExplanationsSlides((prev) => ({...prev, [currentSlide.id]: false}));
  };

  if (!currentSlide) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 text-white p-6">
        <p className="text-lg mb-4">Bài giảng hiện chưa có slide nào.</p>
        <button
          type="button"
          onClick={onExit}
          className="rounded-xl bg-white px-5 py-2.5 text-slate-900 font-semibold"
        >
          Quay lại
        </button>
      </div>
    );
  }

  const topBtnClass = isColoredTopBar
    ? 'border-white/25 bg-white/10 text-white hover:bg-white/20'
    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100';

  return (
    <div ref={containerRef} className={`fixed inset-0 z-50 flex flex-col ${theme.outerBg}`}>
      {/* COMPACT TOP CONTROL TOOLBAR (Never covers slide content) */}
      <header
        className={`shrink-0 border-b px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 backdrop-blur-sm ${theme.topBar}`}
      >
        {/* Left: Lesson info + Questions List button */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setShowOutline((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${topBtnClass}`}
            title="Mở danh sách slide và câu hỏi"
          >
            <ListChecks className="w-4 h-4" />
            <span>Danh sách</span>
          </button>

          <div className="min-w-0 hidden sm:block">
            <div className="text-xs opacity-80 flex items-center gap-1.5 truncate">
              <span className="font-semibold">
                {EDUCATION_LEVEL_SHORT[educationLevel]} · Lớp {lesson.grade}
              </span>
              <span aria-hidden="true">·</span>
              <span>{SKILL_SHORT_LABELS[currentSlide.skill]}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular font-semibold">
                Slide {slideIdx + 1}/{lesson.slides.length}
              </span>
            </div>
            <div className="text-sm font-bold truncate max-w-[260px] lg:max-w-[360px]">
              {lesson.title}
            </div>
          </div>
        </div>

        {/* Center: 5 Direct Theme Buttons */}
        <div
          className={`flex items-center gap-1 p-1 rounded-xl border ${
            isColoredTopBar
              ? 'border-white/20 bg-black/15'
              : 'border-slate-200 bg-slate-100/90'
          }`}
          role="group"
          aria-label="Chọn giao diện trình chiếu"
        >
          {SELECTABLE_THEME_IDS.map((tId) => {
            const spec = PRESENTER_THEMES[tId];
            const active = themeId === tId;
            return (
              <button
                key={tId}
                type="button"
                onClick={() => setThemeId(tId)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap ${
                  active
                    ? isColoredTopBar
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'bg-white text-[#2563EB] shadow-xs'
                    : isColoredTopBar
                      ? 'text-white/85 hover:text-white hover:bg-white/10'
                      : 'text-slate-600 hover:text-slate-900'
                }`}
                title={`Giao diện ${spec.label}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0"
                  style={{backgroundColor: spec.swatch}}
                  aria-hidden="true"
                />
                <span className="hidden md:inline">{spec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Font Scale, Timer, Notes, Fullscreen, Exit */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className={`inline-flex items-center rounded-xl border overflow-hidden ${
              isColoredTopBar ? 'border-white/25 bg-white/10' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <button
              type="button"
              onClick={() => setFontScale((s) => Math.max(0.85, Number((s - 0.1).toFixed(2))))}
              className="px-2.5 py-1.5 text-xs font-bold hover:opacity-80 transition-opacity"
              title="Giảm cỡ chữ"
            >
              A-
            </button>
            <span className="px-1.5 text-xs opacity-70 font-mono-tabular hidden sm:inline">
              {Math.round(fontScale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setFontScale((s) => Math.min(1.35, Number((s + 0.1).toFixed(2))))}
              className="px-2.5 py-1.5 text-xs font-bold hover:opacity-80 transition-opacity"
              title="Tăng cỡ chữ"
            >
              A+
            </button>
          </div>

          <button
            type="button"
            onClick={() => setTimerOpen((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              timerRunning ? 'border-amber-400 bg-amber-400 text-slate-950' : topBtnClass
            }`}
            title="Đồng hồ bấm giờ"
          >
            <Clock className="w-4 h-4" />
            <span className="font-mono-tabular hidden sm:inline">
              {timerRunning
                ? `${Math.floor(timerSec / 60)}:${String(timerSec % 60).padStart(2, '0')}`
                : 'Timer'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              showNotes ? 'border-amber-400 bg-amber-100 text-amber-950' : topBtnClass
            }`}
            title="Ghi chú giáo viên"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden xl:inline">Notes</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${topBtnClass}`}
            title="Toàn màn hình"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            <span className="hidden xl:inline">Toàn màn hình</span>
          </button>

          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white hover:bg-rose-700 transition-colors whitespace-nowrap"
          >
            <X className="w-4 h-4" />
            <span>Thoát</span>
          </button>
        </div>
      </header>

      {/* CENTERPIECE PRESENTATION STAGE */}
      <div className="flex-1 min-h-0 overflow-y-auto studio-scroll px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide.id}
            initial={{opacity: 0, y: 10}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -8}}
            transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
            className={`mx-auto w-full ${
              isReadingLayout || isWideActivity ? 'max-w-[1380px]' : 'max-w-[1060px]'
            }`}
          >
            {/* Large Centered Luminous Content Card (Adaptive by Education Level) */}
            <div
              className={`${
                isPrimary
                  ? 'rounded-[26px] border-2 p-6 sm:p-8 lg:p-9 space-y-6'
                  : 'rounded-[20px] border p-5 sm:p-7 lg:p-8 space-y-6'
              } ${theme.cardStage}`}
            >
              {/* Slide Title & Context Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/70 dark:border-slate-800 pb-4">
                <div className="space-y-1 min-w-0">
                  <div
                    className={`text-xs sm:text-sm font-semibold flex flex-wrap items-center gap-2 ${
                      isPrimary && !theme.dark ? 'text-[#EA580C]' : theme.accentText
                    }`}
                  >
                    <span>
                      Tiếng Anh {EDUCATION_LEVEL_SHORT[educationLevel]} · Lớp {lesson.grade}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{SKILL_SHORT_LABELS[currentSlide.skill]}</span>
                    <span aria-hidden="true">·</span>
                    <span>{ACTIVITY_LABELS[currentSlide.activityType]}</span>
                  </div>
                  <h2
                    className="font-display font-bold tracking-tight leading-snug"
                    style={{fontSize: `${Math.round((isPrimary ? 28 : 24) * fontScale)}px`}}
                  >
                    {currentSlide.title}
                  </h2>
                  {currentSlide.subtitle && (
                    <p
                      className={`text-sm sm:text-base font-medium ${
                        theme.dark ? 'text-slate-300' : 'text-[#475569]'
                      }`}
                    >
                      {currentSlide.subtitle}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {scoreSummary && (
                    <div className="rounded-xl bg-[#10B981] px-3.5 py-1.5 text-sm font-bold text-white tabular-nums shadow-xs">
                      Đúng {scoreSummary.correct}/{scoreSummary.total} câu
                    </div>
                  )}
                  <span
                    className={`font-mono-tabular text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-xl border ${
                      theme.dark
                        ? 'border-slate-700 bg-slate-800 text-slate-200'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {slideIdx + 1} / {lesson.slides.length}
                  </span>
                </div>
              </div>

              {/* Instruction Callout */}
              {currentSlide.instruction && (
                <div
                  className={`rounded-2xl border px-4 py-3.5 leading-relaxed ${
                    theme.dark
                      ? 'border-slate-700 bg-slate-800/80 text-slate-200'
                      : isPrimary
                        ? 'border-orange-200 bg-[#FFF7ED] text-[#0F172A]'
                        : isSecondary
                          ? 'border-cyan-200 bg-[#ECFEFF]/70 text-[#0F172A]'
                          : 'border-blue-100 bg-[#EFF6FF]/70 text-[#0F172A]'
                  }`}
                  style={{fontSize: `${Math.round(15.5 * effectiveFontScale)}px`}}
                >
                  <span
                    className={`font-bold mr-1.5 ${
                      isPrimary && !theme.dark ? 'text-[#EA580C]' : theme.accentText
                    }`}
                  >
                    Yêu cầu:
                  </span>
                  <RenderFormattedText text={currentSlide.instruction} />
                </div>
              )}

              {/* Cover / Theory Bullets + Optional Image */}
              {currentSlide.bullets && currentSlide.bullets.length > 0 && (
                <div
                  className={`grid gap-6 items-center ${
                    currentSlide.imageUrl ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
                  }`}
                >
                  <ul
                    className={`${
                      currentSlide.imageUrl ? 'lg:col-span-7' : 'col-span-1'
                    } space-y-3 leading-relaxed`}
                    style={{fontSize: `${Math.round(17 * fontScale)}px`}}
                  >
                    {currentSlide.bullets.map((b, idx) => (
                      <li
                        key={idx}
                        className={`rounded-2xl border p-4 flex items-start gap-3.5 ${
                          theme.dark
                            ? 'border-slate-800 bg-slate-800/60'
                            : 'border-slate-200/90 bg-[#F8FAFC]'
                        }`}
                      >
                        <span
                          className={`font-mono-tabular text-sm font-bold shrink-0 mt-0.5 ${theme.accentText}`}
                        >
                          0{idx + 1}.
                        </span>
                        <span>
                          <RenderFormattedText text={b} />
                        </span>
                      </li>
                    ))}
                  </ul>

                  {currentSlide.imageUrl && (
                    <figure className="lg:col-span-5 space-y-2">
                      <img
                        src={currentSlide.imageUrl}
                        alt={currentSlide.imageCaption || currentSlide.title}
                        referrerPolicy="no-referrer"
                        className="w-full rounded-2xl border border-slate-200 object-cover max-h-80 shadow-xs"
                      />
                      {currentSlide.imageCaption && (
                        <figcaption className="text-xs opacity-75">
                          {currentSlide.imageCaption}
                        </figcaption>
                      )}
                    </figure>
                  )}
                </div>
              )}

              {/* Embedded Video if present */}
              {currentSlide.videoUrl && (
                <div className="rounded-2xl overflow-hidden border border-slate-200 max-w-2xl mx-auto">
                  <video controls src={currentSlide.videoUrl} className="w-full max-h-80 bg-black" />
                </div>
              )}

              {/* Dedicated Listening Layout */}
              {currentSlide.audio && (
                <ListeningWidget
                  audioConfig={currentSlide.audio}
                  grade={lesson.grade}
                  lessonTitle={lesson.title}
                  topic={lesson.topic}
                  jumpRequestSec={jumpAudioSec}
                  darkSurface={theme.dark}
                  readOnly
                />
              )}

              {/* Dedicated Reading Split View (Passage intact left + Questions right) */}
              {currentSlide.passage && (
                <ReadingSplitView
                  passage={currentSlide.passage}
                  questions={currentSlide.questions}
                  imageUrl={currentSlide.imageUrl}
                  imageCaption={currentSlide.imageCaption}
                  answers={slideAnswers}
                  onChangeAnswer={handleAnswerChange}
                  checked={isChecked}
                  showAnswers={isShowAnswers}
                  showExplanations={isShowExplanations}
                  darkSurface={theme.dark}
                  fontScale={fontScale}
                  educationLevel={educationLevel}
                />
              )}

              {/* Vocabulary Flashcards */}
              {currentSlide.vocabItems && currentSlide.vocabItems.length > 0 && (
                <VocabFlashcards items={currentSlide.vocabItems} darkSurface={theme.dark} />
              )}

              {/* Dedicated Speaking Studio */}
              {currentSlide.speakingTask && (
                <SpeakingWidget
                  lessonId={lesson.id}
                  slideId={currentSlide.id}
                  task={currentSlide.speakingTask}
                  imageUrl={currentSlide.imageUrl}
                  imageCaption={currentSlide.imageCaption}
                  darkSurface={theme.dark}
                />
              )}

              {/* Dedicated Writing Studio */}
              {currentSlide.writingTask && (
                <WritingWidget
                  lessonId={lesson.id}
                  slideId={currentSlide.id}
                  grade={lesson.grade}
                  task={currentSlide.writingTask}
                  imageUrl={currentSlide.imageUrl}
                  imageCaption={currentSlide.imageCaption}
                  darkSurface={theme.dark}
                />
              )}

              {/* Embedded Live 2D/3D Interactive World Simulation */}
              {currentSlide.interactiveLabRef && (
                <EmbeddedLabPlayer labRef={currentSlide.interactiveLabRef} />
              )}

              {/* Standalone Illustration on Question / Listening Slides (Especially vivid for Primary & Secondary) */}
              {currentSlide.imageUrl &&
                (!currentSlide.bullets || currentSlide.bullets.length === 0) &&
                !currentSlide.passage &&
                !currentSlide.speakingTask &&
                !currentSlide.writingTask && (
                  <figure className="mx-auto max-w-2xl space-y-2 text-center">
                    <img
                      src={currentSlide.imageUrl}
                      alt={currentSlide.imageCaption || currentSlide.title}
                      referrerPolicy="no-referrer"
                      className={`mx-auto rounded-2xl border object-contain shadow-sm ${
                        isPrimary
                          ? 'max-h-72 border-sky-200 bg-sky-50/40 p-2'
                          : 'max-h-64 border-slate-200 bg-slate-50 p-1.5'
                      }`}
                    />
                    {currentSlide.imageCaption && (
                      <figcaption className="text-xs opacity-75">
                        {currentSlide.imageCaption}
                      </figcaption>
                    )}
                  </figure>
                )}

              {/* Centered Questions (when not already inside ReadingSplitView) */}
              {!currentSlide.passage && currentSlide.questions && currentSlide.questions.length > 0 && (
                <QuestionRenderer
                  questions={currentSlide.questions}
                  answers={slideAnswers}
                  onChangeAnswer={handleAnswerChange}
                  checked={isChecked}
                  showAnswers={isShowAnswers}
                  showExplanations={isShowExplanations}
                  onJumpToTimestamp={(sec) => setJumpAudioSec(sec)}
                  darkSurface={theme.dark}
                  fontScale={fontScale}
                  educationLevel={educationLevel}
                  presenterMode
                />
              )}

              {/* Teacher Notes Panel */}
              {showNotes && (
                <div
                  className={`rounded-2xl border p-4 text-sm ${
                    theme.dark
                      ? 'border-amber-700/60 bg-amber-950/40 text-amber-100'
                      : 'border-amber-200 bg-amber-50 text-amber-950'
                  }`}
                >
                  <div className="font-bold mb-1">Ghi chú dành cho Giáo viên (Teacher Notes)</div>
                  <p>
                    {currentSlide.teacherNotes ||
                      'Chưa có ghi chú riêng cho slide này. Giáo viên có thể thêm ghi chú trong Trình biên tập.'}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Classroom Timer Floating Card */}
      {timerOpen && (
        <div className="fixed top-16 right-4 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm">Đồng hồ lớp học (Timer)</span>
            <button
              type="button"
              onClick={() => setTimerOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-center font-mono-tabular text-4xl font-bold text-[#2563EB]">
            {Math.floor(timerSec / 60)}:{String(timerSec % 60).padStart(2, '0')}
          </div>
          <div className="flex items-center justify-center gap-1.5">
            {[60, 180, 300, 600].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setTimerRunning(false);
                  setTimerSec(preset);
                }}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 font-mono-tabular"
              >
                {preset / 60}p
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTimerRunning((v) => !v)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
            >
              {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {timerRunning ? 'Tạm dừng' : 'Bắt đầu'}
            </button>
            <button
              type="button"
              onClick={() => {
                setTimerRunning(false);
                setTimerSec(180);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
            >
              Đặt lại
            </button>
          </div>
        </div>
      )}

      {/* Slide & Question Outline Drawer */}
      {showOutline && (
        <div className="fixed top-16 left-4 z-50 w-80 max-h-[70vh] overflow-y-auto studio-scroll rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-2xl space-y-1.5">
          <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-200">
            <span className="font-bold text-sm">Danh sách Slide &amp; Câu hỏi</span>
            <button
              type="button"
              onClick={() => setShowOutline(false)}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {lesson.slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSlideIdx(i);
                setShowOutline(false);
              }}
              className={`w-full text-left rounded-xl px-3 py-2.5 text-sm transition-colors ${
                i === slideIdx
                  ? 'bg-blue-50 text-[#1E40AF] font-bold border border-blue-200'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className="truncate">
                {i + 1}. {s.title}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {SKILL_SHORT_LABELS[s.skill]}
                {s.questions?.length ? ` · ${s.questions.length} câu hỏi` : ''}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* BOTTOM DOCKED NAVIGATION & GRADING BAR (Never covers questions or footer) */}
      <footer
        className={`shrink-0 border-t px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 ${theme.bottomBar}`}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={slideIdx === 0}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold disabled:opacity-40 transition-colors whitespace-nowrap ${
              theme.dark
                ? 'border-slate-700 hover:bg-slate-800 text-slate-100'
                : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Trước</span>
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={slideIdx >= lesson.slides.length - 1}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-95 whitespace-nowrap shadow-xs ${theme.primaryBtn}`}
          >
            <span>Tiếp theo</span>
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="hidden lg:inline text-xs opacity-60 ml-1">
            Phím mũi tên ← / →
          </span>
        </div>

        {/* Teacher-Controlled Grading Actions */}
        {hasQuestions && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCheckedSlides((p) => ({...p, [currentSlide.id]: true}))}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#10B981] px-4 py-2 text-sm font-semibold text-white hover:bg-[#059669] shadow-xs transition-colors whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4" />
              Check Answer
            </button>
            <button
              type="button"
              onClick={handleTryAgain}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                theme.dark
                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100'
                  : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
            <button
              type="button"
              onClick={() =>
                setShowAnswersSlides((p) => ({...p, [currentSlide.id]: !p[currentSlide.id]}))
              }
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                isShowAnswers
                  ? 'border-[#2563EB] bg-blue-50 text-[#1E40AF]'
                  : theme.dark
                    ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              {isShowAnswers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              Đáp án
            </button>
            <button
              type="button"
              onClick={() =>
                setShowExplanationsSlides((p) => ({...p, [currentSlide.id]: !p[currentSlide.id]}))
              }
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                isShowExplanations
                  ? 'border-[#2563EB] bg-blue-50 text-[#1E40AF]'
                  : theme.dark
                    ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              Lời giải
            </button>
          </div>
        )}
      </footer>
    </div>
  );
};
