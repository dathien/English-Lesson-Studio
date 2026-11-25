import React, {useMemo, useState} from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  GripVertical,
  Link2,
  Volume2,
  XCircle,
} from 'lucide-react';
import type {EducationLevel, QuestionItem} from '../../types/lesson';
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

  if (q.acceptedAnswers && q.acceptedAnswers.length > 0) {
    const norm = normalizeText(strVal);
    return q.acceptedAnswers.some((acc) => normalizeText(acc) === norm);
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
}) => {
  const [selectedLeftMap, setSelectedLeftMap] = useState<Record<string, string>>({});
  const [dragState, setDragState] = useState<{qId: string; index: number} | null>(null);
  const isPrimary = educationLevel === 'primary';

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
                <RenderFormattedText text={q.prompt} />
              </div>

              <div className="flex items-center gap-2 shrink-0">
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

            {/* Gap Fill / Short Answer / Transformation */}
            {(q.type === 'gap_fill' || q.type === 'short_answer' || q.type === 'transformation') && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={typeof userVal === 'string' ? userVal : ''}
                  onChange={(e) => onChangeAnswer(q.id, e.target.value)}
                  placeholder={
                    q.type === 'transformation'
                      ? 'Nhập câu viết lại hoàn chỉnh...'
                      : 'Nhập từ hoặc câu trả lời của bạn...'
                  }
                  className={`w-full rounded-xl border px-4 py-3 outline-none transition-all focus:ring-2 focus:ring-[#2563EB] ${
                    darkSurface
                      ? 'border-slate-600 bg-slate-900 text-white placeholder:text-slate-400'
                      : 'border-slate-300 bg-[#F8FAFC] focus:bg-white text-[#0F172A] placeholder:text-slate-400'
                  }`}
                />
              </div>
            )}

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
                  <div>
                    <span className="font-bold">Đáp án đúng: </span>
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
                )}
                {showExplanations && q.explanation && (
                  <div className={darkSurface ? 'text-slate-200' : 'text-slate-700'}>
                    <span className="font-bold">Lời giải: </span>
                    <RenderFormattedText text={q.explanation} />
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
