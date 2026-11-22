import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  BookOpenCheck,
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
  Palette,
  Pause,
  Play,
  RotateCcw,
  Type,
  X,
} from 'lucide-react';
import type {LessonProject, SlideThemeId} from '../types/lesson';
import {ACTIVITY_LABELS, SKILL_SHORT_LABELS} from '../types/lesson';
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

interface SlidePresenterProps {
  lesson: LessonProject;
  initialSlideIndex?: number;
  initialFontScale?: number;
  initialShowNotes?: boolean;
  onExit: () => void;
}

const THEME_CONFIG: Record<
  SlideThemeId,
  {label: string; stage: string; header: string; dark: boolean}
> = {
  light_classroom: {
    label: 'Sáng lớp học',
    stage: 'bg-[#F8FAFC] text-[#0F172A] border-slate-200',
    header: 'bg-[#0F4C81] text-white',
    dark: false,
  },
  projector_contrast: {
    label: 'Máy chiếu tương phản cao',
    stage: 'bg-white text-slate-950 border-slate-300',
    header: 'bg-slate-950 text-white',
    dark: false,
  },
  warm_paper: {
    label: 'Giấy ấm dịu mắt',
    stage: 'bg-[#FAF7F2] text-stone-900 border-stone-200',
    header: 'bg-[#1E3A5F] text-white',
    dark: false,
  },
  dark_theater: {
    label: 'Trình chiếu tối',
    stage: 'bg-slate-950 text-slate-100 border-slate-800',
    header: 'bg-slate-900 text-slate-100 border-b border-slate-800',
    dark: true,
  },
};

export const SlidePresenter: React.FC<SlidePresenterProps> = ({
  lesson,
  initialSlideIndex = 0,
  initialFontScale = 1,
  initialShowNotes = false,
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

  const [themeId, setThemeId] = useState<SlideThemeId>(lesson.themeId || 'light_classroom');
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
  const theme = THEME_CONFIG[themeId];

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

  const cycleTheme = () => {
    const keys: SlideThemeId[] = ['light_classroom', 'projector_contrast', 'warm_paper', 'dark_theater'];
    const nextIdx = (keys.indexOf(themeId) + 1) % keys.length;
    setThemeId(keys[nextIdx]);
  };

  if (!currentSlide) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 text-white p-6">
        <p className="text-lg mb-4">Bài giảng hiện chưa có slide nào.</p>
        <button
          type="button"
          onClick={onExit}
          className="rounded-lg bg-white px-4 py-2 text-slate-900 font-medium"
        >
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col ${
        theme.dark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Main 16:9 Presentation Viewport (never obscured by toolbars) */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        <div
          className={`w-full max-w-[1440px] h-full max-h-full aspect-video rounded-2xl border shadow-lg flex flex-col overflow-hidden ${theme.stage}`}
        >
          {/* Slide Header Band */}
          <div className={`px-5 py-3 flex items-center justify-between gap-4 shrink-0 ${theme.header}`}>
            <div className="min-w-0">
              <div className="text-xs opacity-80 flex items-center gap-2">
                <span>Tiếng Anh Lớp {lesson.grade}</span>
                <span aria-hidden="true">·</span>
                <span>{SKILL_SHORT_LABELS[currentSlide.skill]}</span>
                <span aria-hidden="true">·</span>
                <span>{ACTIVITY_LABELS[currentSlide.activityType]}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold truncate mt-0.5">{currentSlide.title}</h2>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {scoreSummary && (
                <div className="rounded-lg bg-emerald-600 px-3 py-1 text-xs sm:text-sm font-semibold text-white tabular-nums whitespace-nowrap">
                  Kết quả: {scoreSummary.correct}/{scoreSummary.total}
                </div>
              )}
              <span className="font-mono-tabular text-sm opacity-90 whitespace-nowrap">
                Slide {slideIdx + 1} / {lesson.slides.length}
              </span>
            </div>
          </div>

          {/* Slide Scrollable Stage Content */}
          <div className="flex-1 min-h-0 overflow-y-auto studio-scroll p-5 sm:p-7 space-y-5">
            {currentSlide.subtitle && (
              <p className={`text-base font-medium ${theme.dark ? 'text-sky-300' : 'text-[#0284C7]'}`}>
                {currentSlide.subtitle}
              </p>
            )}

            {currentSlide.instruction && (
              <div
                className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${
                  theme.dark
                    ? 'border-slate-700 bg-slate-900/70 text-slate-200'
                    : 'border-sky-200 bg-sky-50/70 text-slate-800'
                }`}
                style={{fontSize: `${Math.round(15 * fontScale)}px`}}
              >
                <span className="font-semibold text-[#0284C7] mr-1.5">Hướng dẫn:</span>
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
                      className={`rounded-xl border p-3.5 flex items-start gap-3 ${
                        theme.dark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <span className="font-mono-tabular text-sm font-bold text-[#0284C7] shrink-0 mt-0.5">
                        0{idx + 1}.
                      </span>
                      <span>
                        <RenderFormattedText text={b} />
                      </span>
                    </li>
                  ))}
                </ul>

                {currentSlide.imageUrl && (
                  <figure className="lg:col-span-5 space-y-1.5">
                    <img
                      src={currentSlide.imageUrl}
                      alt={currentSlide.imageCaption || currentSlide.title}
                      referrerPolicy="no-referrer"
                      className="w-full rounded-xl border border-slate-200 object-cover max-h-80"
                    />
                    {currentSlide.imageCaption && (
                      <figcaption className="text-xs text-slate-500">{currentSlide.imageCaption}</figcaption>
                    )}
                  </figure>
                )}
              </div>
            )}

            {/* Embedded Video if present */}
            {currentSlide.videoUrl && (
              <div className="rounded-xl overflow-hidden border border-slate-200 max-w-2xl">
                <video controls src={currentSlide.videoUrl} className="w-full max-h-72 bg-black" />
              </div>
            )}

            {/* Listening Audio Bar (linked with questions below) */}
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

            {/* Reading Split View (Intact Passage Left + Grouped Questions Right) */}
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
              />
            )}

            {/* Vocabulary Flashcards */}
            {currentSlide.vocabItems && currentSlide.vocabItems.length > 0 && (
              <VocabFlashcards items={currentSlide.vocabItems} darkSurface={theme.dark} />
            )}

            {/* Speaking Interactive Studio */}
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

            {/* Writing Interactive Studio */}
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

            {/* Standalone Questions (when not already rendered inside ReadingSplitView) */}
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
              />
            )}

            {/* Teacher Notes Panel (Toggleable) */}
            {showNotes && (
              <div
                className={`rounded-xl border p-4 text-sm ${
                  theme.dark
                    ? 'border-amber-700/60 bg-amber-950/30 text-amber-100'
                    : 'border-amber-200 bg-amber-50 text-amber-950'
                }`}
              >
                <div className="font-semibold mb-1">Ghi chú dành cho Giáo viên (Teacher Notes)</div>
                <p>
                  {currentSlide.teacherNotes ||
                    'Chưa có ghi chú riêng cho slide này. Giáo viên có thể thêm ghi chú trong Trình biên tập.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Classroom Timer Popover */}
      {timerOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-72 rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Đồng hồ lớp học (Timer)</span>
            <button
              type="button"
              onClick={() => setTimerOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-center font-mono-tabular text-4xl font-bold text-[#0F4C81]">
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
                className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-100 font-mono-tabular"
              >
                {preset / 60}p
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTimerRunning((v) => !v)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0F4C81] py-2 text-xs font-medium text-white hover:bg-[#0B3A63]"
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
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50"
            >
              Đặt lại
            </button>
          </div>
        </div>
      )}

      {/* Slide / Questions Outline Drawer */}
      {showOutline && (
        <div className="fixed bottom-20 left-4 z-50 w-80 max-h-80 overflow-y-auto studio-scroll rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-xl space-y-1.5">
          <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-200">
            <span className="font-semibold text-sm">Danh sách Slide &amp; Câu hỏi</span>
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
              className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                i === slideIdx
                  ? 'bg-sky-50 text-[#0F4C81] font-semibold'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className="truncate">
                {i + 1}. {s.title}
              </div>
              <div className="text-xs text-slate-500">
                {SKILL_SHORT_LABELS[s.skill]}
                {s.questions?.length ? ` · ${s.questions.length} câu hỏi` : ''}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Bottom Docked Control Toolbar (Never covers slide content) */}
      <div
        className={`shrink-0 border-t px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 ${
          theme.dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
        }`}
      >
        {/* Navigation & Questions List */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={goPrev}
            disabled={slideIdx === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={slideIdx >= lesson.slides.length - 1}
            className="inline-flex items-center gap-1 rounded-lg bg-[#0F4C81] px-3 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-[#0B3A63] whitespace-nowrap"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowOutline((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 whitespace-nowrap"
          >
            <ListChecks className="w-4 h-4" />
            Questions
          </button>
        </div>

        {/* Teacher-Controlled Interactive Grading Buttons */}
        {hasQuestions && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCheckedSlides((p) => ({...p, [currentSlide.id]: true}))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4" />
              Check Answer
            </button>
            <button
              type="button"
              onClick={handleTryAgain}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
            <button
              type="button"
              onClick={() =>
                setShowAnswersSlides((p) => ({...p, [currentSlide.id]: !p[currentSlide.id]}))
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium whitespace-nowrap ${
                isShowAnswers
                  ? 'border-[#0284C7] bg-sky-50 text-[#0F4C81]'
                  : 'border-slate-300 hover:bg-slate-100'
              }`}
            >
              {isShowAnswers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              Show Answer
            </button>
            <button
              type="button"
              onClick={() =>
                setShowExplanationsSlides((p) => ({...p, [currentSlide.id]: !p[currentSlide.id]}))
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium whitespace-nowrap ${
                isShowExplanations
                  ? 'border-[#0284C7] bg-sky-50 text-[#0F4C81]'
                  : 'border-slate-300 hover:bg-slate-100'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              Show Explanation
            </button>
          </div>
        )}

        {/* Classroom Utilities: Font Size, Theme, Timer, Notes, Fullscreen, Exit */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex items-center rounded-lg border border-slate-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setFontScale((s) => Math.max(0.85, Number((s - 0.1).toFixed(2))))}
              className="px-2.5 py-2 text-xs font-semibold hover:bg-slate-100"
              title="Giảm cỡ chữ"
            >
              A-
            </button>
            <span className="px-1.5 text-xs text-slate-500 flex items-center gap-1">
              <Type className="w-3.5 h-3.5" />
            </span>
            <button
              type="button"
              onClick={() => setFontScale((s) => Math.min(1.35, Number((s + 0.1).toFixed(2))))}
              className="px-2.5 py-2 text-xs font-semibold hover:bg-slate-100"
              title="Tăng cỡ chữ"
            >
              A+
            </button>
          </div>

          <button
            type="button"
            onClick={cycleTheme}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-medium hover:bg-slate-100 whitespace-nowrap"
            title={`Đổi giao diện: ${theme.label}`}
          >
            <Palette className="w-4 h-4" />
            <span className="hidden xl:inline">{theme.label}</span>
          </button>

          <button
            type="button"
            onClick={() => setTimerOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium whitespace-nowrap ${
              timerRunning
                ? 'border-amber-400 bg-amber-50 text-amber-900'
                : 'border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span className="font-mono-tabular">
              {timerRunning
                ? `${Math.floor(timerSec / 60)}:${String(timerSec % 60).padStart(2, '0')}`
                : 'Timer'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium whitespace-nowrap ${
              showNotes
                ? 'border-amber-400 bg-amber-50 text-amber-900'
                : 'border-slate-300 hover:bg-slate-100'
            }`}
            title="Ẩn/Hiện ghi chú giáo viên"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden lg:inline">Notes</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-medium hover:bg-slate-100 whitespace-nowrap"
            title="Toàn màn hình"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            <span className="hidden xl:inline">Fullscreen</span>
          </button>

          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 whitespace-nowrap"
          >
            <BookOpenCheck className="w-4 h-4 hidden" />
            <X className="w-4 h-4" />
            Exit
          </button>
        </div>
      </div>
    </div>
  );
};
