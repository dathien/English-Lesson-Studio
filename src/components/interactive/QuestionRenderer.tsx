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
import type {QuestionItem} from '../../types/lesson';
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
}

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
}) => {
  const [selectedLeftMap, setSelectedLeftMap] = useState<Record<string, string>>({});
  const [dragState, setDragState] = useState<{qId: string; index: number} | null>(null);

  // Deterministic initial shuffle for ordering/matching so items aren't already solved on load
  const shuffledDefaults = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const q of questions) {
      if ((q.type === 'ordering' || q.type === 'word_order') && q.orderItems && q.orderItems.length > 1) {
        const items = [...q.orderItems];
        // Deterministic rotation/interleave
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
    ? 'bg-slate-800/80 border-slate-700 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';
  const mutedText = darkSurface ? 'text-slate-300' : 'text-slate-600';

  return (
    <div className="space-y-4" style={{fontSize: `${Math.round(15.5 * fontScale)}px`}}>
      {questions.map((q) => {
        const userVal = answers[q.id];
        const isCorrect = checked ? evaluateQuestion(q, userVal) : null;

        return (
          <div key={q.id} className={`rounded-xl border p-4 transition-colors ${cardBg}`}>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div className="flex-1 min-w-0 leading-relaxed">
                <span className="font-semibold text-[#0284C7] mr-2 tabular-nums">
                  Question {q.number}.
                </span>
                <RenderFormattedText text={q.prompt} />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {typeof q.timestampSec === 'number' && onJumpToTimestamp && (
                  <button
                    type="button"
                    onClick={() => onJumpToTimestamp(q.timestampSec!)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-[#0F4C81] hover:bg-sky-100 whitespace-nowrap"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span className="tabular-nums">
                      {Math.floor(q.timestampSec / 60)}:{String(Math.floor(q.timestampSec % 60)).padStart(2, '0')}
                    </span>
                  </button>
                )}

                {checked && isCorrect === true && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    Chính xác
                  </span>
                )}
                {checked && isCorrect === false && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
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
                  className={`grid gap-2.5 ${
                    q.options.length === 2 ? 'grid-cols-2 max-w-md' : 'grid-cols-1 sm:grid-cols-2'
                  }`}
                >
                  {q.options.map((opt) => {
                    const selected = userVal === opt.label;
                    const isRightOpt =
                      normalizeText(q.correctAnswer) === normalizeText(opt.label) ||
                      normalizeText(q.correctAnswer) === normalizeText(opt.text);

                    let optStyle = darkSurface
                      ? 'border-slate-700 bg-slate-900/60 hover:border-sky-400 text-slate-100'
                      : 'border-slate-200 bg-slate-50/70 hover:border-[#0284C7] hover:bg-white text-slate-900';

                    if (selected && !checked && !showAnswers) {
                      optStyle = 'border-[#0284C7] bg-sky-50 text-[#0F4C81] ring-1 ring-[#0284C7]';
                    }
                    if ((checked || showAnswers) && isRightOpt) {
                      optStyle = 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600';
                    } else if (checked && selected && !isRightOpt) {
                      optStyle = 'border-rose-500 bg-rose-50 text-rose-950 ring-1 ring-rose-500';
                    }

                    return (
                      <div key={opt.id} className="flex items-stretch gap-1.5">
                        <button
                          type="button"
                          onClick={() => onChangeAnswer(q.id, opt.label)}
                          className={`flex-1 flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${optStyle}`}
                        >
                          <span className="flex items-baseline gap-2">
                            <span className="font-semibold shrink-0">{opt.label}.</span>
                            <span>
                              <RenderFormattedText text={opt.text} />
                            </span>
                          </span>
                          {opt.ipa && (showAnswers || checked) && (
                            <span className="font-mono-tabular text-xs text-slate-500 shrink-0">
                              {opt.ipa}
                            </span>
                          )}
                        </button>
                        {q.type === 'pronunciation_underlined' && (
                          <button
                            type="button"
                            onClick={() => speakWord(opt.text)}
                            title="Nghe phát âm mẫu trình duyệt"
                            className="px-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#0284C7] hover:border-[#0284C7] transition-colors"
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
                  className={`w-full rounded-lg border px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[#0284C7] ${
                    darkSurface
                      ? 'border-slate-600 bg-slate-900 text-white placeholder:text-slate-400'
                      : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>
            )}

            {/* Interactive Pair Matching */}
            {q.type === 'matching' && q.matchingPairs && (
              <div className="space-y-3">
                <p className={`text-xs ${mutedText}`}>
                  Chọn một mục ở cột trái, sau đó chọn định nghĩa tương ứng ở cột phải để nối cặp.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
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
                          className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                            pairCorrect
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                              : pairWrong
                                ? 'border-rose-500 bg-rose-50 text-rose-950'
                                : isSelected
                                  ? 'border-[#0284C7] bg-sky-50 text-[#0F4C81] ring-1 ring-[#0284C7]'
                                  : darkSurface
                                    ? 'border-slate-700 bg-slate-900/70 text-slate-100'
                                    : 'border-slate-200 bg-slate-50 text-slate-900 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">
                              {idx + 1}. {pair.left}
                            </span>
                            {matchedRight && (
                              <span className="inline-flex items-center gap-1 text-xs text-[#0284C7]">
                                <Link2 className="w-3.5 h-3.5" />
                                Đã nối
                              </span>
                            )}
                          </div>
                          {matchedRight && (
                            <p className="mt-1 text-xs text-slate-600 truncate">→ {matchedRight}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
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
                            className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                              pairedLeft
                                ? 'border-sky-300 bg-sky-50/70 text-slate-900'
                                : darkSurface
                                  ? 'border-slate-700 bg-slate-900/70 text-slate-100 hover:border-sky-400'
                                  : 'border-slate-200 bg-white text-slate-800 hover:border-[#0284C7]'
                            }`}
                          >
                            <span className="font-semibold text-slate-500 mr-2">
                              {String.fromCharCode(65 + rIdx)}.
                            </span>
                            <span>{rightText}</span>
                            {pairedLeft && (
                              <span className="block mt-1 text-xs font-medium text-[#0F4C81]">
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

            {/* Drag-and-Drop & Button Reordering (Word Order / Listening Order / Dialogue Order) */}
            {(q.type === 'ordering' || q.type === 'word_order') && q.orderItems && (
              <div className="space-y-2">
                <p className={`text-xs ${mutedText}`}>
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
                        q.type === 'word_order'
                          ? 'flex flex-wrap gap-2'
                          : 'space-y-2'
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
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-grab active:cursor-grabbing transition-colors ${
                              slotCorrect
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                                : slotWrong
                                  ? 'border-rose-500 bg-rose-50 text-rose-950'
                                  : darkSurface
                                    ? 'border-slate-700 bg-slate-900 text-slate-100'
                                    : 'border-slate-200 bg-slate-50 text-slate-900 hover:bg-white'
                            }`}
                          >
                            <GripVertical className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="font-mono-tabular text-xs font-semibold text-[#0284C7] shrink-0">
                              {idx + 1}.
                            </span>
                            <span className="flex-1">{item}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => moveItem(idx, idx - 1)}
                                disabled={idx === 0}
                                aria-label="Di chuyển lên"
                                className="p-1 rounded hover:bg-slate-200/70 disabled:opacity-30"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveItem(idx, idx + 1)}
                                disabled={idx === currentList.length - 1}
                                aria-label="Di chuyển xuống"
                                className="p-1 rounded hover:bg-slate-200/70 disabled:opacity-30"
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

            {/* Answer & Explanation Reveal (Teacher Controlled!) */}
            {(showAnswers || showExplanations) && (
              <div
                className={`mt-3 rounded-lg border px-3.5 py-2.5 text-sm space-y-1 ${
                  darkSurface
                    ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-100'
                    : 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                }`}
              >
                {showAnswers && (
                  <div>
                    <span className="font-semibold">Đáp án: </span>
                    {q.type === 'matching' && q.matchingPairs ? (
                      <span>
                        {q.matchingPairs.map((p) => `${p.left} → ${p.right}`).join(' · ')}
                      </span>
                    ) : (q.type === 'ordering' || q.type === 'word_order') && q.orderItems ? (
                      <span>{q.orderItems.join(q.type === 'word_order' ? ' ' : ' → ')}</span>
                    ) : (
                      <span className="font-semibold">{q.correctAnswer || 'Chưa thiết lập'}</span>
                    )}
                  </div>
                )}
                {showExplanations && q.explanation && (
                  <div className={darkSurface ? 'text-slate-200' : 'text-slate-700'}>
                    <span className="font-semibold">Giải thích: </span>
                    {q.explanation}
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
