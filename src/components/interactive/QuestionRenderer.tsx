import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  GripVertical,
  HelpCircle,
  Lightbulb,
  Link2,
  PlusCircle,
  Volume2,
  XCircle,
} from 'lucide-react';
import type {
  EducationLevel,
  QuestionItem,
  TransformationEvaluationResult,
} from '../../types/lesson';
import {TRANSFORMATION_SUBTYPE_LABELS} from '../../types/lesson';
import {
  countSurfaceWords,
  evaluateSentenceTransformation,
  getGapTemplateSegments,
  getTeacherAcceptedAnswers,
  inferTransformationMeta,
  saveTeacherAcceptedAnswer,
} from '../../services/sentenceTransformationEngine';
import {saveTransformationAttempt} from '../../services/storage';
import {RenderFormattedText, stripFormattingTags} from '../../utils/richText';

export interface QuestionAnswerMap {
  [questionId: string]: string | string[] | Record<string, string>;
}

interface QuestionRendererProps {
  questions: QuestionItem[];
  answers: QuestionAnswerMap;
  onChangeAnswer: (questionId: string, value: string | string[] | Record<string, string>) => void;
  checked: boolean;
  showAnswers: boolean;
  showExplanations: boolean;
  onJumpToTimestamp?: (sec: number) => void;
  darkSurface?: boolean;
  fontScale?: number;
  presenterMode?: boolean;
  educationLevel?: EducationLevel;
  /** Disables hints during active timed exams until submitted */
  officialExamMode?: boolean;
  /** External hint step controlled by SlidePresenter bottom toolbar */
  presenterHintLevel?: number;
  /** Optional callback when teacher confirms a needs_teacher_review answer */
  onTeacherAcceptAnswer?: (questionId: string, acceptedSentence: string) => void;
}

const PASTEL_OPTIONS = [
  {
    base: 'bg-[#EFF6FF]/90 border-[#BFDBFE] hover:bg-[#DBEAFE]/80 hover:border-[#2563EB] text-[#0F172A]',
    badge: 'bg-[#2563EB] text-white',
  },
  {
    base: 'bg-[#ECFEFF]/90 border-[#A5F3FC] hover:bg-[#CFFAFE]/80 hover:border-[#06B6D4] text-[#0F172A]',
    badge: 'bg-[#0891B2] text-white',
  },
  {
    base: 'bg-[#ECFDF5]/90 border-[#A7F3D0] hover:bg-[#D1FAE5]/80 hover:border-[#10B981] text-[#0F172A]',
    badge: 'bg-[#059669] text-white',
  },
  {
    base: 'bg-[#FFF7ED]/90 border-[#FED7AA] hover:bg-[#FFEDD5]/80 hover:border-[#F97316] text-[#0F172A]',
    badge: 'bg-[#EA580C] text-white',
  },
];

function normalizeText(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[.?!]+$/, '');
}

export function evaluateQuestion(
  q: QuestionItem,
  userVal: string | string[] | Record<string, string> | undefined,
): boolean | null {
  if (userVal === undefined || userVal === '') return null;

  if (q.type === 'matching' && q.matchingPairs) {
    const map = typeof userVal === 'object' && !Array.isArray(userVal) ? userVal : {};
    if (Object.keys(map).length === 0) return null;
    return q.matchingPairs.every((p) => map[p.left] === p.right);
  }

  if ((q.type === 'ordering' || q.type === 'word_order') && q.orderItems) {
    const arr = Array.isArray(userVal) ? userVal : [];
    if (arr.length === 0) return null;
    return arr.every((item, idx) => item === q.orderItems![idx]);
  }

  const strVal = typeof userVal === 'string' ? userVal : '';
  if (!strVal.trim()) return null;

  if (q.type === 'transformation') {
    const tfResult = evaluateSentenceTransformation(q, strVal);
    return tfResult.isPass;
  }

  if (q.acceptedAnswers && q.acceptedAnswers.length > 0) {
    const norm = normalizeText(strVal);
    return (
      normalizeText(q.correctAnswer) === norm ||
      q.acceptedAnswers.some((acc) => normalizeText(acc) === norm)
    );
  }

  return normalizeText(strVal) === normalizeText(q.correctAnswer);
}

function speakWord(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(stripFormattingTags(text));
  utter.lang = 'en-GB';
  utter.rate = 0.92;
  window.speechSynthesis.speak(utter);
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  questions,
  answers,
  onChangeAnswer,
  checked,
  showAnswers,
  showExplanations,
  onJumpToTimestamp,
  darkSurface = false,
  fontScale = 1,
  presenterMode = false,
  educationLevel = 'high_school',
  officialExamMode = false,
  presenterHintLevel = 0,
  onTeacherAcceptAnswer,
}) => {
  const [selectedLeftMap, setSelectedLeftMap] = useState<Record<string, string>>({});
  const [dragState, setDragState] = useState<{qId: string; index: number} | null>(null);
  const [hintStepByQ, setHintStepByQ] = useState<Record<string, number>>({});
  const [teacherVersion, setTeacherVersion] = useState(0);
  const lastLoggedRef = useRef<string>('');
  const isPrimary = educationLevel === 'primary';

  // Evaluate transformation items via shared rule engine
  const transformationEvalMap = useMemo(() => {
    const out: Record<string, TransformationEvaluationResult> = {};
    if (!checked) return out;
    for (const q of questions) {
      if (q.type !== 'transformation') continue;
      const val = typeof answers[q.id] === 'string' ? (answers[q.id] as string) : '';
      out[q.id] = evaluateSentenceTransformation(q, val);
    }
    return out;
  }, [checked, questions, answers, teacherVersion]);

  // Persist transformation attempts for mistake review whenever checked transitions true
  useEffect(() => {
    if (!checked) return;
    const tfQuestions = questions.filter((q) => q.type === 'transformation');
    if (tfQuestions.length === 0) return;

    const signature = tfQuestions
      .map((q) => `${q.id}:${typeof answers[q.id] === 'string' ? answers[q.id] : ''}:${teacherVersion}`)
      .join('|');
    if (signature === lastLoggedRef.current) return;
    lastLoggedRef.current = signature;

    for (const q of tfQuestions) {
      const val = typeof answers[q.id] === 'string' ? (answers[q.id] as string) : '';
      if (!val.trim()) continue;
      const evalRes = transformationEvalMap[q.id];
      if (!evalRes) continue;
      const meta = inferTransformationMeta(q);
      void saveTransformationAttempt({
        questionId: q.id,
        unitId: meta.unitId,
        grade: meta.grade,
        grammarTopic: meta.grammarTopic,
        promptPreview: meta.originalSentence,
        userAnswer: evalRes.reconstructedSentence || val,
        status: evalRes.status,
        errorCategories: evalRes.diagnostics.map((d) => d.category),
        scoreRatio: evalRes.scoreRatio,
      });
    }
  }, [checked, questions, answers, transformationEvalMap, teacherVersion]);

  const shuffledDefaults = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const q of questions) {
      if ((q.type === 'ordering' || q.type === 'word_order') && q.orderItems && q.orderItems.length > 1) {
        const items = [...q.orderItems];
        const rotated = items.map((_, i) => items[(i * 2 + 1) % items.length]);
        const same = rotated.every((v, idx) => v === items[idx]);
        out[q.id] = same ? [...items].reverse() : rotated;
      }
      if (q.type === 'matching' && q.matchingPairs && q.matchingPairs.length > 1) {
        const rights = q.matchingPairs.map((p) => p.right);
        const rotated = rights.map((_, i) => rights[(i + 1) % rights.length]);
        out[`match-${q.id}`] = rotated;
      }
    }
    return out;
  }, [questions]);

  const cardBg = darkSurface
    ? 'bg-slate-800/90 border-slate-700 text-slate-100 shadow-sm'
    : isPrimary
      ? 'bg-white border-sky-200/90 text-[#0F172A] shadow-md shadow-sky-900/5'
      : 'bg-white border-slate-200/90 text-[#0F172A] shadow-xs';
  const mutedText = darkSurface ? 'text-slate-300' : 'text-[#475569]';

  const baseFontPx = presenterMode
    ? Math.round((isPrimary ? 20 : 17) * fontScale)
    : Math.round((isPrimary ? 17.5 : 15.5) * fontScale);

  return (
    <div className={presenterMode ? 'space-y-5' : 'space-y-4'} style={{fontSize: `${baseFontPx}px`}}>
      {questions.map((q) => {
        const userVal = answers[q.id];
        const isCorrect = checked ? evaluateQuestion(q, userVal) : null;
        const tfMeta = q.type === 'transformation' ? inferTransformationMeta(q) : null;
        const tfEval = q.type === 'transformation' && checked ? transformationEvalMap[q.id] : null;
        const teacherAcceptedExtra =
          q.type === 'transformation' ? getTeacherAcceptedAnswers(q.id) : [];

        return (
          <div
            key={q.id}
            className={`${isPrimary ? 'rounded-[24px] border-2' : 'rounded-[18px] border'} transition-all duration-200 ${
              presenterMode ? 'p-5 sm:p-6' : 'p-4 sm:p-5'
            } ${cardBg}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="flex-1 min-w-0 leading-relaxed font-semibold">
                <span
                  className={`font-extrabold mr-2 tabular-nums ${
                    darkSurface ? 'text-sky-300' : isPrimary ? 'text-[#F97316]' : 'text-[#2563EB]'
                  }`}
                >
                  {isPrimary ? `Câu ${q.number}.` : `Question ${q.number}.`}
                </span>
                {q.type === 'transformation' && tfMeta ? (
                  <span>
                    <RenderFormattedText text={tfMeta.originalSentence} />
                  </span>
                ) : (
                  <RenderFormattedText text={q.prompt} />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {isPrimary && (
                  <button
                    type="button"
                    onClick={() => speakWord(q.prompt)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-[#EA580C] hover:bg-orange-100 whitespace-nowrap transition-colors"
                    title="Nghe đọc câu hỏi"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Nghe đọc</span>
                  </button>
                )}
                {typeof q.timestampSec === 'number' && onJumpToTimestamp && (
                  <button
                    type="button"
                    onClick={() => onJumpToTimestamp(q.timestampSec!)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#1E40AF] hover:bg-blue-100 whitespace-nowrap transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span className="tabular-nums">
                      {Math.floor(q.timestampSec / 60)}:
                      {String(Math.floor(q.timestampSec % 60)).padStart(2, '0')}
                    </span>
                  </button>
                )}

                {q.type === 'transformation' && tfEval ? (
                  <>
                    {tfEval.status === 'correct' && (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" />
                        Chính xác
                      </span>
                    )}
                    {tfEval.status === 'minor_format_error' && (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-300 px-3 py-1 text-xs font-bold text-amber-800">
                        <AlertTriangle className="w-4 h-4" />
                        Đúng · Lỗi trình bày nhỏ
                      </span>
                    )}
                    {tfEval.status === 'needs_teacher_review' && (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 border border-indigo-300 px-3 py-1 text-xs font-bold text-indigo-800">
                        <HelpCircle className="w-4 h-4" />
                        Cần giáo viên xem xét
                      </span>
                    )}
                    {tfEval.status === 'incorrect' && (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700">
                        <XCircle className="w-4 h-4" />
                        Chưa chính xác
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {checked && isCorrect === true && (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" />
                        Chính xác
                      </span>
                    )}
                    {checked && isCorrect === false && (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700">
                        <XCircle className="w-4 h-4" />
                        Chưa đúng
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* MCQ / True-False / Error Correction / Pronunciation Underlined */}
            {(q.type === 'mcq' ||
              q.type === 'true_false' ||
              q.type === 'error_correction' ||
              q.type === 'pronunciation_underlined') &&
              q.options && (
                <div
                  className={`grid gap-3 ${
                    q.options.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-lg' : 'grid-cols-1 md:grid-cols-2'
                  }`}
                >
                  {q.options.map((opt, optIdx) => {
                    const selected = userVal === opt.label;
                    const isRightOpt =
                      normalizeText(q.correctAnswer) === normalizeText(opt.label) ||
                      normalizeText(q.correctAnswer) === normalizeText(opt.text);
                    const pastel = PASTEL_OPTIONS[optIdx % PASTEL_OPTIONS.length];

                    let optStyle = darkSurface
                      ? 'border-slate-700 bg-slate-900/70 hover:border-blue-400 hover:bg-slate-800 text-slate-100'
                      : pastel.base;
                    let badgeStyle = darkSurface
                      ? 'bg-slate-700 text-slate-100'
                      : pastel.badge;

                    if (selected && !checked && !showAnswers) {
                      optStyle = darkSurface
                        ? 'border-[#38BDF8] bg-[#1E3A8A]/70 text-white ring-2 ring-[#38BDF8]/70 shadow-sm'
                        : 'border-[#2563EB] bg-[#DBEAFE] text-[#1E3A8A] ring-2 ring-[#2563EB]/70 shadow-sm';
                      badgeStyle = 'bg-[#1E40AF] text-white';
                    }
                    if ((checked || showAnswers) && isRightOpt) {
                      optStyle = darkSurface
                        ? 'border-[#10B981] bg-emerald-950/70 text-emerald-100 ring-2 ring-[#10B981]'
                        : 'border-[#10B981] bg-[#D1FAE5] text-emerald-950 ring-2 ring-[#10B981] shadow-sm';
                      badgeStyle = 'bg-[#10B981] text-white';
                    } else if (checked && selected && !isRightOpt) {
                      optStyle = darkSurface
                        ? 'border-rose-500 bg-rose-950/70 text-rose-100 ring-2 ring-rose-500'
                        : 'border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-500';
                      badgeStyle = 'bg-rose-600 text-white';
                    }

                    return (
                      <div key={opt.id} className="flex items-stretch gap-2">
                        <button
                          type="button"
                          onClick={() => onChangeAnswer(q.id, opt.label)}
                          className={`flex-1 flex items-center justify-between gap-3 ${
                            isPrimary ? 'rounded-3xl border-2 px-5 py-4' : 'rounded-2xl border px-4 py-3'
                          } text-left transition-all duration-200 active:scale-[0.99] ${optStyle}`}
                        >
                          <span className="flex items-center gap-3 min-w-0">
                            <span
                              className={`${
                                isPrimary ? 'w-10 h-10 text-base' : 'w-8 h-8 text-sm'
                              } rounded-full flex items-center justify-center font-bold shrink-0 transition-colors ${badgeStyle}`}
                            >
                              {opt.label}
                            </span>
                            <span className="flex flex-col gap-1.5 min-w-0">
                              {opt.imageUrl && (
                                <img
                                  src={opt.imageUrl}
                                  alt={opt.text || opt.label}
                                  className="h-24 w-32 object-cover rounded-xl border border-slate-200"
                                />
                              )}
                              <span className={`${isPrimary ? 'font-bold' : 'font-medium'} leading-snug`}>
                                <RenderFormattedText text={opt.text} />
                              </span>
                            </span>
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            {opt.ipa && (showAnswers || checked) && (
                              <span className="font-mono-tabular text-xs opacity-75">
                                {opt.ipa}
                              </span>
                            )}
                            {(checked || showAnswers) && isRightOpt && (
                              <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0" />
                            )}
                            {checked && selected && !isRightOpt && (
                              <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                            )}
                          </span>
                        </button>
                        {(isPrimary || q.type === 'pronunciation_underlined') && (
                          <button
                            type="button"
                            onClick={() => speakWord(opt.text)}
                            title="Nghe phát âm mẫu"
                            className={`px-3 rounded-2xl border transition-colors shrink-0 ${
                              darkSurface
                                ? 'border-slate-700 bg-slate-900 text-slate-300 hover:text-sky-300 hover:border-sky-400'
                                : 'border-slate-200 bg-white text-slate-600 hover:text-[#2563EB] hover:border-[#2563EB]'
                            }`}
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            {/* Gap Fill / Short Answer */}
            {(q.type === 'gap_fill' || q.type === 'short_answer') && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={typeof userVal === 'string' ? userVal : ''}
                  onChange={(e) => onChangeAnswer(q.id, e.target.value)}
                  placeholder="Nhập từ hoặc câu trả lời của bạn..."
                  className={`w-full rounded-xl border px-4 py-3 outline-none transition-all focus:ring-2 focus:ring-[#2563EB] ${
                    darkSurface
                      ? 'border-slate-600 bg-slate-900 text-white placeholder:text-slate-400'
                      : 'border-slate-300 bg-[#F8FAFC] focus:bg-white text-[#0F172A] placeholder:text-slate-400'
                  }`}
                />
              </div>
            )}

            {/* Rich 5-Format Sentence Transformation Workspace */}
            {q.type === 'transformation' && tfMeta && (() => {
              const strVal = typeof userVal === 'string' ? userVal : '';
              const hints = tfMeta.hints || [];
              const localHintStep = hintStepByQ[q.id] || 0;
              const effectiveHintStep = officialExamMode
                ? 0
                : Math.min(hints.length, Math.max(localHintStep, presenterHintLevel));
              const typedWordCount = countSurfaceWords(strVal.replace(/\|\|\|/g, ' '));
              const isMultiGap =
                tfMeta.subtype === 'gap_completion' &&
                Boolean(tfMeta.gapTemplate && /_{2,}/.test(tfMeta.gapTemplate));
              const gapSegments = isMultiGap && tfMeta.gapTemplate
                ? getGapTemplateSegments(tfMeta.gapTemplate)
                : [];
              const gapCount = Math.max(0, gapSegments.length - 1);
              const gapValues = isMultiGap
                ? Array.from({length: gapCount}, (_, i) => strVal.split('|||')[i] || '')
                : [];

              return (
                <div className="space-y-3">
                  {/* Metadata & Constraints Strip */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`inline-flex items-center rounded-lg border px-2.5 py-1 font-semibold ${
                        darkSurface
                          ? 'border-slate-600 bg-slate-900 text-sky-300'
                          : 'border-blue-200 bg-blue-50/90 text-[#1E40AF]'
                      }`}
                    >
                      {TRANSFORMATION_SUBTYPE_LABELS[tfMeta.subtype].short}
                    </span>

                    {tfMeta.keyword && (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-bold ${
                          darkSurface
                            ? 'border-amber-500/60 bg-amber-950/60 text-amber-200'
                            : 'border-amber-300 bg-amber-50 text-amber-900'
                        }`}
                      >
                        Từ khóa: <strong className="tracking-wide uppercase">{tfMeta.keyword}</strong>
                        {tfMeta.keepKeywordUnchanged && (
                          <span className="font-medium opacity-80">· giữ nguyên dạng</span>
                        )}
                      </span>
                    )}

                    {tfMeta.wordLimit && (tfMeta.wordLimit.min || tfMeta.wordLimit.max) && (
                      <span
                        className={`inline-flex items-center rounded-lg border px-2.5 py-1 font-semibold tabular-nums ${
                          darkSurface
                            ? 'border-cyan-600/60 bg-cyan-950/50 text-cyan-200'
                            : 'border-cyan-200 bg-cyan-50 text-cyan-900'
                        }`}
                      >
                        Giới hạn:{' '}
                        {tfMeta.wordLimit.min && tfMeta.wordLimit.max
                          ? `${tfMeta.wordLimit.min}–${tfMeta.wordLimit.max} từ`
                          : tfMeta.wordLimit.max
                            ? `tối đa ${tfMeta.wordLimit.max} từ`
                            : `tối thiểu ${tfMeta.wordLimit.min} từ`}
                      </span>
                    )}

                    {tfMeta.grammarTopic && !officialExamMode && (
                      <span className={`text-xs ${mutedText}`}>· {tfMeta.grammarTopic}</span>
                    )}
                  </div>

                  {/* Rewrite Instruction */}
                  {tfMeta.instruction && (
                    <p className={`text-sm italic ${mutedText}`}>{tfMeta.instruction}</p>
                  )}

                  {/* Input Area: Multi-gap OR Given-start / Full-rewrite Auto-expanding Textarea */}
                  {isMultiGap ? (
                    <div
                      className={`rounded-2xl border p-4 leading-loose flex flex-wrap items-center gap-y-2 gap-x-1.5 ${
                        darkSurface
                          ? 'border-slate-700 bg-slate-900/80 text-slate-100'
                          : 'border-slate-200 bg-[#F8FAFC] text-[#0F172A]'
                      }`}
                    >
                      {gapSegments.map((seg, idx) => (
                        <React.Fragment key={idx}>
                          {seg && <span className="font-medium">{seg}</span>}
                          {idx < gapCount && (
                            <input
                              type="text"
                              value={gapValues[idx] || ''}
                              onChange={(e) => {
                                const next = [...gapValues];
                                next[idx] = e.target.value;
                                onChangeAnswer(q.id, next.join('|||'));
                              }}
                              placeholder={`Chỗ trống ${idx + 1}...`}
                              className={`inline-block min-w-[120px] sm:min-w-[155px] rounded-xl border-2 px-3 py-1.5 text-[15px] font-semibold outline-none transition-all focus:ring-2 focus:ring-[#2563EB] ${
                                darkSurface
                                  ? 'border-sky-500/60 bg-slate-950 text-white placeholder:text-slate-500'
                                  : 'border-blue-300 bg-white text-[#0F172A] placeholder:text-slate-400'
                              }`}
                            />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <div
                      className={`rounded-2xl border p-3.5 space-y-2.5 ${
                        darkSurface
                          ? 'border-slate-700 bg-slate-900/70'
                          : 'border-slate-200 bg-[#F8FAFC]'
                      }`}
                    >
                      {(tfMeta.givenStart || tfMeta.givenEnd) && (
                        <div className="flex flex-wrap items-baseline gap-1.5 text-sm">
                          <span className={`font-semibold ${mutedText}`}>Bắt đầu / khung câu:</span>
                          {tfMeta.givenStart && (
                            <span
                              className={`font-bold px-2 py-0.5 rounded-md ${
                                darkSurface
                                  ? 'bg-sky-950 text-sky-200'
                                  : 'bg-blue-100/80 text-[#1E3A8A]'
                              }`}
                            >
                              {tfMeta.givenStart}
                            </span>
                          )}
                          <span className="opacity-60 font-mono">__________</span>
                          {tfMeta.givenEnd && (
                            <span
                              className={`font-bold px-2 py-0.5 rounded-md ${
                                darkSurface
                                  ? 'bg-sky-950 text-sky-200'
                                  : 'bg-blue-100/80 text-[#1E3A8A]'
                              }`}
                            >
                              {tfMeta.givenEnd}
                            </span>
                          )}
                        </div>
                      )}

                      <textarea
                        rows={Math.max(2, Math.min(5, Math.ceil((strVal.length || 1) / 72)))}
                        value={strVal}
                        onChange={(e) => onChangeAnswer(q.id, e.target.value)}
                        placeholder={
                          tfMeta.givenStart
                            ? `Nhập phần tiếp theo sau "${tfMeta.givenStart}" hoặc viết cả câu hoàn chỉnh...`
                            : 'Nhập câu viết lại đồng nghĩa hoàn chỉnh...'
                        }
                        className={`w-full rounded-xl border px-4 py-3 text-[15.5px] leading-relaxed resize-y outline-none transition-all focus:ring-2 focus:ring-[#2563EB] ${
                          darkSurface
                            ? 'border-slate-600 bg-slate-950 text-white placeholder:text-slate-400'
                            : 'border-slate-300 bg-white text-[#0F172A] placeholder:text-slate-400'
                        }`}
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className={mutedText}>
                          {tfMeta.givenStart
                            ? 'Hỗ trợ nhập cả câu hoàn chỉnh hoặc chỉ phần còn thiếu.'
                            : 'Giữ nguyên ý nghĩa câu gốc và kiểm tra lại thì, trật tự từ, dấu câu.'}
                        </span>
                        <span
                          className={`font-mono-tabular font-semibold ${
                            tfMeta.wordLimit?.max && typedWordCount > tfMeta.wordLimit.max
                              ? 'text-rose-600'
                              : mutedText
                          }`}
                        >
                          {typedWordCount} từ
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Progressive Hint Controls (strictly hidden in officialExamMode) */}
                  {!officialExamMode && hints.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setHintStepByQ((prev) => ({
                              ...prev,
                              [q.id]:
                                (prev[q.id] || 0) >= hints.length ? 0 : (prev[q.id] || 0) + 1,
                            }))
                          }
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            darkSurface
                              ? 'border-amber-600/60 bg-amber-950/50 text-amber-200 hover:bg-amber-950'
                              : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                          }`}
                        >
                          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                          {effectiveHintStep === 0
                            ? `Xem gợi ý (0/${hints.length})`
                            : effectiveHintStep < hints.length
                              ? `Xem thêm gợi ý (${effectiveHintStep}/${hints.length})`
                              : `Ẩn gợi ý (${hints.length}/${hints.length})`}
                        </button>
                      </div>

                      {effectiveHintStep > 0 && (
                        <div
                          className={`rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm space-y-1.5 ${
                            darkSurface
                              ? 'border-amber-700/60 bg-amber-950/35 text-amber-100'
                              : 'border-amber-200 bg-amber-50/75 text-amber-950'
                          }`}
                        >
                          {hints.slice(0, effectiveHintStep).map((h, hIdx) => (
                            <div key={hIdx} className="flex items-start gap-2">
                              <span className="font-bold text-amber-700 dark:text-amber-300 shrink-0">
                                Gợi ý {hIdx + 1}:
                              </span>
                              <span>{h}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rich Evaluation & Diagnostic Error Breakdown */}
                  {checked && tfEval && (
                    <div
                      className={`rounded-2xl border p-3.5 text-sm space-y-2.5 ${
                        tfEval.status === 'correct'
                          ? darkSurface
                            ? 'border-emerald-700 bg-emerald-950/50 text-emerald-100'
                            : 'border-emerald-200 bg-emerald-50/90 text-emerald-950'
                          : tfEval.status === 'minor_format_error'
                            ? darkSurface
                              ? 'border-amber-600 bg-amber-950/50 text-amber-100'
                              : 'border-amber-300 bg-amber-50 text-amber-950'
                            : tfEval.status === 'needs_teacher_review'
                              ? darkSurface
                                ? 'border-indigo-600 bg-indigo-950/50 text-indigo-100'
                                : 'border-indigo-200 bg-indigo-50 text-indigo-950'
                              : darkSurface
                                ? 'border-rose-700 bg-rose-950/50 text-rose-100'
                                : 'border-rose-200 bg-rose-50/90 text-rose-950'
                      }`}
                    >
                      <div className="font-semibold">{tfEval.summaryVi}</div>

                      {tfEval.reconstructedSentence && tfMeta.givenStart && (
                        <div className="text-xs opacity-85">
                          <span className="font-semibold">Câu ghép hoàn chỉnh của bạn: </span>
                          <span className="italic">{tfEval.reconstructedSentence}</span>
                        </div>
                      )}

                      {tfEval.diagnostics.length > 0 && (
                        <ul className="space-y-1 text-xs">
                          {tfEval.diagnostics.map((diag, dIdx) => (
                            <li key={dIdx} className="flex items-start gap-2">
                              <span className="font-bold shrink-0">• {diag.labelVi}:</span>
                              <span>{diag.detailVi}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Teacher quick override for plausible equivalent answers */}
                      {tfEval.canTeacherApprove && tfEval.reconstructedSentence && (
                        <div className="pt-1.5 border-t border-current/15 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs opacity-85">
                            Hệ thống chấm theo tập đáp án chuẩn &amp; quy tắc ngữ pháp cục bộ. Nếu câu này đúng nghĩa và ngữ pháp:
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              saveTeacherAcceptedAnswer(q.id, tfEval.reconstructedSentence);
                              onTeacherAcceptAnswer?.(q.id, tfEval.reconstructedSentence);
                              setTeacherVersion((v) => v + 1);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Xác nhận &amp; thêm vào đáp án chấp nhận
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Interactive Pair Matching */}
            {q.type === 'matching' && q.matchingPairs && (
              <div className="space-y-3">
                <p className={`text-sm ${mutedText}`}>
                  Chọn một mục ở cột trái, sau đó chọn định nghĩa tương ứng ở cột phải để nối cặp.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="space-y-2.5">
                    {q.matchingPairs.map((pair, idx) => {
                      const currentMap =
                        typeof userVal === 'object' && !Array.isArray(userVal) ? userVal : {};
                      const isSelected = selectedLeftMap[q.id] === pair.left;
                      const matchedRight = currentMap[pair.left];
                      const pairCorrect = checked && matchedRight === pair.right;
                      const pairWrong = checked && matchedRight && matchedRight !== pair.right;

                      return (
                        <button
                          key={pair.id}
                          type="button"
                          onClick={() =>
                            setSelectedLeftMap((prev) => ({...prev, [q.id]: pair.left}))
                          }
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                            pairCorrect
                              ? 'border-[#10B981] bg-[#D1FAE5] text-emerald-950'
                              : pairWrong
                                ? 'border-rose-500 bg-rose-50 text-rose-950'
                                : isSelected
                                  ? 'border-[#2563EB] bg-[#DBEAFE] text-[#1E40AF] ring-2 ring-[#2563EB]/60'
                                  : darkSurface
                                    ? 'border-slate-700 bg-slate-900/70 text-slate-100'
                                    : 'border-blue-200/80 bg-[#EFF6FF]/60 text-[#0F172A] hover:bg-[#EFF6FF]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">
                              {idx + 1}. {pair.left}
                            </span>
                            {matchedRight && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB]">
                                <Link2 className="w-3.5 h-3.5" />
                                Đã nối
                              </span>
                            )}
                          </div>
                          {matchedRight && (
                            <p className="mt-1 text-xs opacity-80 truncate">→ {matchedRight}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-2.5">
                    {(shuffledDefaults[`match-${q.id}`] || q.matchingPairs.map((p) => p.right)).map(
                      (rightText, rIdx) => {
                        const currentMap =
                          typeof userVal === 'object' && !Array.isArray(userVal) ? userVal : {};
                        const pairedLeft = Object.entries(currentMap).find(
                          ([, r]) => r === rightText,
                        )?.[0];

                        return (
                          <button
                            key={`${q.id}-r-${rIdx}`}
                            type="button"
                            onClick={() => {
                              const activeLeft = selectedLeftMap[q.id];
                              if (!activeLeft) return;
                              const nextMap = {...currentMap, [activeLeft]: rightText};
                              onChangeAnswer(q.id, nextMap);
                              setSelectedLeftMap((prev) => {
                                const copy = {...prev};
                                delete copy[q.id];
                                return copy;
                              });
                            }}
                            className={`w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                              pairedLeft
                                ? 'border-[#06B6D4] bg-[#ECFEFF] text-[#0F172A]'
                                : darkSurface
                                  ? 'border-slate-700 bg-slate-900/70 text-slate-100 hover:border-sky-400'
                                  : 'border-slate-200 bg-white text-[#0F172A] hover:border-[#2563EB]'
                            }`}
                          >
                            <span className="font-bold text-[#2563EB] mr-2">
                              {String.fromCharCode(65 + rIdx)}.
                            </span>
                            <span>{rightText}</span>
                            {pairedLeft && (
                              <span className="block mt-1 text-xs font-semibold text-[#1E40AF]">
                                Nối với: {pairedLeft}
                              </span>
                            )}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Drag-and-Drop & Button Reordering */}
            {(q.type === 'ordering' || q.type === 'word_order') && q.orderItems && (
              <div className="space-y-2.5">
                <p className={`text-sm ${mutedText}`}>
                  Kéo thả thẻ hoặc bấm mũi tên Lên / Xuống để sắp xếp đúng thứ tự.
                </p>
                {(() => {
                  const currentList = Array.isArray(userVal)
                    ? userVal
                    : shuffledDefaults[q.id] || q.orderItems;

                  const moveItem = (fromIdx: number, toIdx: number) => {
                    if (toIdx < 0 || toIdx >= currentList.length) return;
                    const next = [...currentList];
                    const [moved] = next.splice(fromIdx, 1);
                    next.splice(toIdx, 0, moved);
                    onChangeAnswer(q.id, next);
                  };

                  return (
                    <div
                      className={
                        q.type === 'word_order' ? 'flex flex-wrap gap-2.5' : 'space-y-2.5'
                      }
                    >
                      {currentList.map((item, idx) => {
                        const slotCorrect = checked && q.orderItems![idx] === item;
                        const slotWrong = checked && q.orderItems![idx] !== item;

                        return (
                          <div
                            key={`${q.id}-ord-${idx}-${item}`}
                            draggable
                            onDragStart={() => setDragState({qId: q.id, index: idx})}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (dragState && dragState.qId === q.id && dragState.index !== idx) {
                                moveItem(dragState.index, idx);
                              }
                              setDragState(null);
                            }}
                            className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 cursor-grab active:cursor-grabbing transition-all duration-200 ${
                              slotCorrect
                                ? 'border-[#10B981] bg-[#D1FAE5] text-emerald-950'
                                : slotWrong
                                  ? 'border-rose-500 bg-rose-50 text-rose-950'
                                  : darkSurface
                                    ? 'border-slate-700 bg-slate-900 text-slate-100'
                                    : 'border-slate-200 bg-[#F8FAFC] text-[#0F172A] hover:bg-white hover:border-[#2563EB]'
                            }`}
                          >
                            <GripVertical className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="font-mono-tabular text-xs font-bold text-[#2563EB] shrink-0">
                              {idx + 1}.
                            </span>
                            <span className="flex-1 font-medium">{item}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => moveItem(idx, idx - 1)}
                                disabled={idx === 0}
                                aria-label="Di chuyển lên"
                                className="p-1.5 rounded-lg hover:bg-slate-200/70 disabled:opacity-30"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveItem(idx, idx + 1)}
                                disabled={idx === currentList.length - 1}
                                aria-label="Di chuyển xuống"
                                className="p-1.5 rounded-lg hover:bg-slate-200/70 disabled:opacity-30"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Teacher-Controlled Answer & Explanation Reveal */}
            {(showAnswers || showExplanations) && (
              <div
                className={`mt-4 rounded-2xl border px-4 py-3 text-sm space-y-1.5 ${
                  darkSurface
                    ? 'border-emerald-700/60 bg-emerald-950/50 text-emerald-100'
                    : 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
                }`}
              >
                {showAnswers && (
                  <div className="space-y-1.5">
                    <div>
                      <span className="font-bold">Đáp án chuẩn: </span>
                      {q.type === 'matching' && q.matchingPairs ? (
                        <span>
                          {q.matchingPairs.map((p) => `${p.left} → ${p.right}`).join(' · ')}
                        </span>
                      ) : (q.type === 'ordering' || q.type === 'word_order') && q.orderItems ? (
                        <span>{q.orderItems.join(q.type === 'word_order' ? ' ' : ' → ')}</span>
                      ) : (
                        <span className="font-bold text-[#059669] dark:text-emerald-300">
                          <RenderFormattedText text={q.correctAnswer || 'Chưa thiết lập'} />
                        </span>
                      )}
                    </div>

                    {q.type === 'transformation' &&
                      ((q.acceptedAnswers && q.acceptedAnswers.length > 0) ||
                        teacherAcceptedExtra.length > 0) && (
                        <div className="text-xs space-y-0.5">
                          <span className="font-semibold">Các đáp án tương đương được chấp nhận:</span>
                          <ul className="list-disc pl-5 space-y-0.5">
                            {Array.from(
                              new Set([
                                ...(q.acceptedAnswers || []),
                                ...teacherAcceptedExtra,
                              ].filter((a) => a && a.trim() && a.trim() !== q.correctAnswer.trim())),
                            ).map((acc, aIdx) => (
                              <li key={aIdx}>{acc}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                )}
                {showExplanations && q.type === 'transformation' && tfMeta?.structurePattern && (
                  <div className="text-xs flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    <span className="font-bold">Cấu trúc:</span>
                    <span className="font-mono">{tfMeta.structurePattern}</span>
                  </div>
                )}
                {showExplanations && q.explanation && (
                  <div className={darkSurface ? 'text-slate-200' : 'text-slate-700'}>
                    <span className="font-bold">Lời giải: </span>
                    <RenderFormattedText text={q.explanation} />
                  </div>
                )}
                {showExplanations && q.type === 'transformation' && tfMeta?.grammarReviewNote && (
                  <div className="text-xs opacity-80">
                    <span className="font-semibold">Ghi chú ngữ pháp: </span>
                    {tfMeta.grammarReviewNote}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
