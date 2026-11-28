import React, {useEffect, useMemo, useState} from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Volume2,
  XCircle,
} from 'lucide-react';
import type {GrammarComponentToken, GrammarSimulation} from '../../../types/interactiveLab';
import {playLabSoundEffect, speakLabText} from '../../../services/labAudioService';
import {
  bankRecordsToQuestionItems,
  getTransformationsByTopicKeywords,
} from '../../../data/sentenceTransformationBank';
import {QuestionRenderer, type QuestionAnswerMap} from '../../interactive/QuestionRenderer';

interface GrammarDynamicEngineProps {
  grammar: GrammarSimulation;
  accent?: 'en-GB' | 'en-US';
  onActivityComplete?: (correct: number, total: number) => void;
}

const ROLE_COLORS: Record<GrammarComponentToken['role'], string> = {
  subject: 'bg-blue-100 text-blue-900 border-blue-300',
  aux: 'bg-amber-100 text-amber-900 border-amber-300',
  verb: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  object: 'bg-violet-100 text-violet-900 border-violet-300',
  adverb: 'bg-cyan-100 text-cyan-900 border-cyan-300',
  connector: 'bg-rose-100 text-rose-900 border-rose-300',
  clause: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  complement: 'bg-teal-100 text-teal-900 border-teal-300',
};

export const GrammarDynamicEngine: React.FC<GrammarDynamicEngineProps> = ({
  grammar,
  accent = 'en-GB',
  onActivityComplete,
}) => {
  const [exampleIdx, setExampleIdx] = useState(0);
  const [showTransformed, setShowTransformed] = useState(false);

  // Sentence Builder state
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [builderChecked, setBuilderChecked] = useState<null | boolean>(null);

  // 5-Exercise Quiz state
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Matching Sentence Transformation practice for this grammar topic
  const matchingTransformations = useMemo(() => {
    const rawWords = `${grammar.titleEn} ${grammar.titleVi} ${grammar.id}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) =>
        [
          'passive',
          'reported',
          'conditional',
          'relative',
          'participle',
          'gerund',
          'cleft',
          'comparative',
          'superlative',
          'modal',
          'causative',
          'perfect',
          'continuous',
          'unless',
          'despite',
          'infinitive',
        ].includes(w),
      );
    if (rawWords.length === 0) return [];
    return bankRecordsToQuestionItems(getTransformationsByTopicKeywords(rawWords).slice(0, 4));
  }, [grammar.titleEn, grammar.titleVi, grammar.id]);

  const [tfAnswers, setTfAnswers] = useState<QuestionAnswerMap>({});
  const [tfChecked, setTfChecked] = useState(false);
  const [tfShowKey, setTfShowKey] = useState(false);

  useEffect(() => {
    setExampleIdx(0);
    setShowTransformed(false);
    setSelectedBlocks([]);
    setBuilderChecked(null);
    setAnswers({});
    setQuizSubmitted(false);
    setTfAnswers({});
    setTfChecked(false);
    setTfShowKey(false);
  }, [grammar.id]);

  const currentExample = grammar.examples[exampleIdx] ?? grammar.examples[0];
  const activeTokens =
    showTransformed && currentExample?.afterTokens
      ? currentExample.afterTokens
      : currentExample?.beforeTokens ?? [];

  const activeSentence = activeTokens.map((t) => t.text).join(' ');

  const availableBlocks = grammar.builderChallenge.shuffledBlocks.filter((b, idx) => {
    // Handle duplicate strings cleanly by counting occurrences
    const totalInPool = grammar.builderChallenge.shuffledBlocks
      .slice(0, idx + 1)
      .filter((x) => x === b).length;
    const usedCount = selectedBlocks.filter((x) => x === b).length;
    return totalInPool > usedCount;
  });

  const handleCheckBuilder = () => {
    const isCorrect =
      selectedBlocks.length === grammar.builderChallenge.correctOrder.length &&
      selectedBlocks.every((blk, i) => blk === grammar.builderChallenge.correctOrder[i]);
    setBuilderChecked(isCorrect);
    playLabSoundEffect(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) {
      speakLabText(selectedBlocks.join(' '), accent);
    }
  };

  const handleSubmitQuiz = () => {
    setQuizSubmitted(true);
    let correct = 0;
    for (const q of grammar.exercises) {
      const userAns = (answers[q.id] ?? '').trim().toLowerCase();
      const target = q.correctAnswer.trim().toLowerCase();
      const accepted = (q.acceptedAnswers ?? []).map((a) => a.trim().toLowerCase());
      if (userAns === target || accepted.includes(userAns)) {
        correct++;
      }
    }
    playLabSoundEffect(correct >= Math.ceil(grammar.exercises.length * 0.6) ? 'correct' : 'click');
    onActivityComplete?.(correct, grammar.exercises.length);
  };

  const quizCorrectCount = grammar.exercises.reduce((acc, q) => {
    const userAns = (answers[q.id] ?? '').trim().toLowerCase();
    const target = q.correctAnswer.trim().toLowerCase();
    const accepted = (q.acceptedAnswers ?? []).map((a) => a.trim().toLowerCase());
    return acc + (userAns === target || accepted.includes(userAns) ? 1 : 0);
  }, 0);

  return (
    <div className="space-y-5">
      {/* 1. Formula & Animated Timeline / Transformation Stage */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{grammar.code} · Ngữ pháp động trực quan</span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">
              {grammar.titleEn} <span className="text-slate-500 font-semibold">({grammar.titleVi})</span>
            </h3>
            <p className="text-sm text-slate-600 mt-1">{grammar.ruleSummaryVi}</p>
          </div>
          <div className="rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-mono font-semibold">
            {grammar.formulaEn}
          </div>
        </div>

        {/* Example Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-500">Ví dụ minh họa:</span>
          {grammar.examples.map((ex, i) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => {
                setExampleIdx(i);
                setShowTransformed(false);
                playLabSoundEffect('click');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                i === exampleIdx
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Ví dụ {i + 1}: {ex.contextVi}
            </button>
          ))}
        </div>

        {/* Visual Animated Timeline (Past -> Present -> Future) */}
        {(currentExample?.timelinePos !== undefined || currentExample?.timelineSpan) && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-3">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Trục thời gian ngữ pháp
              </span>
              <span>Quá khứ ← Hiện tại → Tương lai</span>
            </div>
            <div className="relative h-10 flex items-center">
              <div className="w-full h-2 rounded-full bg-slate-200 relative overflow-hidden">
                {currentExample.timelineSpan && (
                  <div
                    className="absolute top-0 bottom-0 bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500 rounded-full"
                    style={{
                      left: `${currentExample.timelineSpan[0]}%`,
                      width: `${Math.max(6, currentExample.timelineSpan[1] - currentExample.timelineSpan[0])}%`,
                    }}
                  />
                )}
              </div>
              {/* Present marker */}
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                <div className="w-0.5 h-6 bg-slate-400" />
                <span className="text-[10px] font-bold text-slate-500 mt-0.5">NOW</span>
              </div>
              {/* Event dot */}
              {currentExample.timelinePos !== undefined && (
                <div
                  className="absolute -translate-x-1/2 transition-all duration-500"
                  style={{left: `${currentExample.timelinePos}%`}}
                >
                  <div className="w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-md" />
                </div>
              )}
            </div>
            <div className="flex justify-between text-[11px] font-semibold text-slate-500 mt-2">
              <span>Past (Quá khứ)</span>
              <span>Present (Hiện tại)</span>
              <span>Future (Tương lai)</span>
            </div>
          </div>
        )}

        {/* Color-Coded Token Transformation Stage */}
        {currentExample && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-blue-900">
                {showTransformed && currentExample.afterLabel
                  ? currentExample.afterLabel
                  : currentExample.beforeLabel}
              </span>
              <div className="flex items-center gap-2">
                {currentExample.afterTokens && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowTransformed((v) => !v);
                      playLabSoundEffect('click');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    {showTransformed ? 'Xem câu gốc' : 'Biến đổi cấu trúc'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => speakLabText(activeSentence, accent)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                  Đọc mẫu
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 py-2">
              {activeTokens.map((tok, idx) => (
                <div
                  key={`${tok.text}-${idx}`}
                  className={`px-3 py-2 rounded-xl border transition-all duration-300 ${ROLE_COLORS[tok.role]}`}
                >
                  <div className="text-sm font-extrabold">{tok.text}</div>
                  <div className="text-[10px] font-semibold opacity-80 mt-0.5">{tok.labelVi}</div>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-700 bg-white/80 rounded-lg px-3 py-2 border border-slate-200">
              <strong>Giải thích:</strong> {currentExample.noteVi}
            </p>
          </div>
        )}
      </div>

      {/* 2. Interactive Sentence Builder Challenge */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-extrabold text-slate-900">
            Thử thách ghép câu tương tác (Sentence Builder)
          </h4>
          <button
            type="button"
            onClick={() => {
              setSelectedBlocks([]);
              setBuilderChecked(null);
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-blue-600"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Xóa ghép lại
          </button>
        </div>
        <p className="text-xs text-slate-600">{grammar.builderChallenge.instructionVi}</p>

        {/* Answer Drop Slot */}
        <div className="min-h-[56px] rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/30 p-3 flex flex-wrap gap-2 items-center">
          {selectedBlocks.length === 0 ? (
            <span className="text-xs text-slate-400">Bấm các khối từ bên dưới theo đúng thứ tự ngữ pháp...</span>
          ) : (
            selectedBlocks.map((blk, i) => (
              <button
                key={`${blk}-${i}`}
                type="button"
                onClick={() => {
                  setSelectedBlocks((prev) => prev.filter((_, idx) => idx !== i));
                  setBuilderChecked(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-sm hover:bg-blue-700"
              >
                {blk}
              </button>
            ))
          )}
        </div>

        {/* Available Shuffled Blocks */}
        <div className="flex flex-wrap gap-2">
          {availableBlocks.map((blk, idx) => (
            <button
              key={`${blk}-${idx}`}
              type="button"
              onClick={() => {
                playLabSoundEffect('click');
                setSelectedBlocks((prev) => [...prev, blk]);
                setBuilderChecked(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold hover:bg-blue-50 hover:border-blue-400 transition"
            >
              + {blk}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            disabled={selectedBlocks.length === 0}
            onClick={handleCheckBuilder}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
          >
            Kiểm tra câu đã ghép
          </button>
          {builderChecked !== null && (
            <div
              className={`flex items-center gap-1.5 text-xs font-semibold ${
                builderChecked ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {builderChecked ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Chính xác! {grammar.builderChallenge.explanationVi}</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  <span>
                    Chưa đúng thứ tự. Đáp án gợi ý: <strong>{grammar.builderChallenge.correctOrder.join(' ')}</strong>
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. 5 Practice Exercises */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            Bài tập thực hành nhanh ({grammar.exercises.length} câu)
          </h4>
          {quizSubmitted && (
            <span className="px-3 py-1 rounded-lg bg-blue-100 text-blue-800 text-xs font-extrabold">
              Kết quả: {quizCorrectCount}/{grammar.exercises.length} câu đúng
            </span>
          )}
        </div>

        <div className="space-y-3">
          {grammar.exercises.map((q, idx) => {
            const chosen = answers[q.id] ?? '';
            const isCorrect =
              chosen.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase() ||
              (q.acceptedAnswers ?? []).some((a) => a.trim().toLowerCase() === chosen.trim().toLowerCase());

            return (
              <div key={q.id} className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/50 space-y-2">
                <div className="text-sm font-semibold text-slate-900">
                  Câu {idx + 1}. {q.prompt}
                </div>
                {q.options && q.options.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt) => {
                      const active = chosen === opt.label;
                      const showRight = quizSubmitted && opt.label === q.correctAnswer;
                      const showWrong = quizSubmitted && active && opt.label !== q.correctAnswer;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => {
                            if (!quizSubmitted) setAnswers((prev) => ({...prev, [q.id]: opt.label}));
                          }}
                          className={`text-left px-3 py-2 rounded-lg border text-xs font-medium transition ${
                            showRight
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold'
                              : showWrong
                                ? 'bg-rose-50 border-rose-500 text-rose-900'
                                : active
                                  ? 'bg-blue-600 border-blue-600 text-white font-bold'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400'
                          }`}
                        >
                          <span className="font-bold mr-1.5">{opt.label}.</span>
                          {opt.text}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={chosen}
                    disabled={quizSubmitted}
                    onChange={(e) => setAnswers((prev) => ({...prev, [q.id]: e.target.value}))}
                    placeholder="Nhập đáp án tiếng Anh..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                  />
                )}

                {quizSubmitted && (
                  <div
                    className={`text-xs rounded-lg px-3 py-2 ${
                      isCorrect ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'
                    }`}
                  >
                    <strong>{isCorrect ? 'Đúng!' : `Đáp án đúng: ${q.correctAnswer}.`}</strong> {q.explanationVi}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {!quizSubmitted ? (
            <button
              type="button"
              onClick={handleSubmitQuiz}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
            >
              Chấm điểm bài tập ngữ pháp
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAnswers({});
                setQuizSubmitted(false);
              }}
              className="px-4 py-2 rounded-xl bg-slate-200 text-slate-800 text-xs font-bold hover:bg-slate-300"
            >
              Làm lại bài tập
            </button>
          )}
        </div>
      </div>

      {/* 4. Matching Sentence Transformation Practice */}
      {matchingTransformations.length > 0 && (
        <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Vận dụng Viết lại câu đồng nghĩa ({matchingTransformations.length} câu)
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTfChecked(true)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
              >
                Kiểm tra
              </button>
              <button
                type="button"
                onClick={() => setTfShowKey((v) => !v)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                {tfShowKey ? 'Ẩn đáp án' : 'Đáp án & Lời giải'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTfAnswers({});
                  setTfChecked(false);
                  setTfShowKey(false);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
              >
                Làm lại
              </button>
            </div>
          </div>

          <QuestionRenderer
            questions={matchingTransformations}
            answers={tfAnswers}
            onChangeAnswer={(qId, val) => {
              setTfAnswers((p) => ({...p, [qId]: val}));
              setTfChecked(false);
            }}
            checked={tfChecked}
            showAnswers={tfShowKey}
            showExplanations={tfShowKey}
          />
        </div>
      )}
    </div>
  );
};
