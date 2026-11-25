import React, {useEffect, useMemo, useState} from 'react';
import {
  CheckCircle2,
  Clock,
  Headphones,
  RotateCcw,
  Send,
  X,
  XCircle,
} from 'lucide-react';
import type {ExamDossier, ExamQuestionItem} from '../../types/exam';
import {RenderFormattedText as FormattedText} from '../../utils/richText';
import {ListeningWidget} from '../interactive/ListeningWidget';

interface ExamTimedPracticeModalProps {
  dossier: ExamDossier;
  onClose: () => void;
}

function normalizeAnswer(val: string): string {
  return val
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, '')
    .replace(/\s+/g, ' ');
}

function isObjectiveCorrect(q: ExamQuestionItem, userAns: string): boolean {
  if (!userAns.trim()) return false;
  if (q.format === 'mcq' || q.format === 'true_false' || q.format === 'ordering') {
    return userAns.trim().toUpperCase() === q.correctAnswer.trim().toUpperCase();
  }
  const normUser = normalizeAnswer(userAns);
  if (normUser === normalizeAnswer(q.correctAnswer)) return true;
  if (q.acceptedAnswers?.some((a) => normalizeAnswer(a) === normUser)) return true;
  return false;
}

export const ExamTimedPracticeModal: React.FC<ExamTimedPracticeModalProps> = ({
  dossier,
  onClose,
}) => {
  const totalSeconds = Math.max(60, dossier.scope.durationMinutes * 60);
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setSubmitted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [submitted]);

  const results = useMemo(() => {
    let objectiveEarned = 0;
    let objectiveMax = 0;
    let objectiveCorrectCount = 0;
    let objectiveTotalCount = 0;
    let manualReviewCount = 0;
    let manualReviewMax = 0;

    for (const q of dossier.exam.questions) {
      if (q.format === 'essay' || q.format === 'speaking') {
        manualReviewCount += 1;
        manualReviewMax += q.points;
      } else {
        objectiveTotalCount += 1;
        objectiveMax += q.points;
        if (isObjectiveCorrect(q, answers[q.id] || '')) {
          objectiveCorrectCount += 1;
          objectiveEarned += q.points;
        }
      }
    }

    return {
      objectiveEarned: Math.round(objectiveEarned * 100) / 100,
      objectiveMax: Math.round(objectiveMax * 100) / 100,
      objectiveCorrectCount,
      objectiveTotalCount,
      manualReviewCount,
      manualReviewMax: Math.round(manualReviewMax * 100) / 100,
    };
  }, [dossier.exam.questions, answers]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const answeredCount = dossier.exam.questions.filter((q) => (answers[q.id] || '').trim()).length;

  const handleRestart = () => {
    setAnswers({});
    setSecondsLeft(totalSeconds);
    setSubmitted(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F8FAFC] flex flex-col">
      {/* Top Bar */}
      <header className="bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="min-w-0">
          <div className="text-xs text-blue-100 font-semibold">
            Chế độ làm bài thử tính giờ · {dossier.exam.header.gradeLabel} · Mã đề{' '}
            {dossier.exam.header.examCode}
          </div>
          <h2 className="font-display text-base sm:text-lg font-extrabold truncate">
            {dossier.title}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold font-mono-tabular ${
              secondsLeft < 300 && !submitted
                ? 'bg-rose-500 text-white'
                : 'bg-white/15 text-white border border-white/25'
            }`}
          >
            <Clock className="w-4 h-4" />
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </div>

          <span className="hidden sm:inline text-xs font-semibold text-blue-100 font-mono-tabular">
            Đã làm {answeredCount}/{dossier.exam.questions.length}
          </span>

          {!submitted ? (
            <button
              type="button"
              onClick={() => setSubmitted(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-1.5 text-sm font-bold text-white hover:bg-emerald-600"
            >
              <Send className="w-4 h-4" />
              Nộp bài
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRestart}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 border border-white/25 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-white/25"
            >
              <RotateCcw className="w-4 h-4" />
              Làm lại
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white"
            aria-label="Đóng chế độ làm bài thử"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Score Banner when Submitted */}
      {submitted && (
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-emerald-700">
                Kết quả chấm tự động phần khách quan
              </div>
              <div className="text-2xl font-display font-extrabold text-[#0F172A] font-mono-tabular">
                {results.objectiveEarned} / {results.objectiveMax} điểm{' '}
                <span className="text-sm font-semibold text-[#475569]">
                  ({results.objectiveCorrectCount}/{results.objectiveTotalCount} câu đúng)
                </span>
              </div>
            </div>
            {results.manualReviewCount > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 max-w-md">
                <strong>Lưu ý chấm tự luận/Nói ({results.manualReviewMax} điểm):</strong> Phần viết bài/trình bày nói không chấm điểm tự động giả lập. Giáo viên chấm trực tiếp theo Rubric và bài mẫu bên dưới.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Exam Paper Body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {dossier.exam.groups.map((group) => {
            const groupQuestions = dossier.exam.questions.filter((q) => q.groupId === group.id);
            if (groupQuestions.length === 0) return null;

            return (
              <section
                key={group.id}
                className="rounded-[20px] border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4"
              >
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-display text-base sm:text-lg font-extrabold text-[#1E40AF]">
                    {group.title}
                  </h3>
                  <p className="text-sm italic text-[#475569] mt-0.5">{group.instruction}</p>
                </div>

                {/* Playable Listening Audio */}
                {group.audio && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#1E40AF]">
                      <Headphones className="w-4 h-4" />
                      Trình phát bài nghe (Nghe trực tiếp không cần cài đặt thêm)
                    </div>
                    <ListeningWidget
                      grade={dossier.scope.grade}
                      lessonTitle={group.title}
                      readOnly
                      audioConfig={{
                        sourceMode: group.audio.sourceMode,
                        voiceAccent: group.audio.voiceAccent,
                        isSynthesized: group.audio.isSynthesized,
                        transcript: group.audio.transcript,
                        dataUrl: group.audio.dataUrl,
                        fileName: group.audio.fileName,
                        mimeType: group.audio.mimeType,
                        showTranscriptDefault: submitted,
                      }}
                    />
                  </div>
                )}

                {/* Reading / Notice / Leaflet Passage */}
                {group.stimulusParagraphs && group.stimulusParagraphs.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-2.5 text-[15px] text-[#0F172A] leading-relaxed">
                    {group.stimulusTitle && (
                      <div className="font-bold text-center text-base">
                        <FormattedText text={group.stimulusTitle} />
                      </div>
                    )}
                    {group.stimulusParagraphs.map((para, idx) => (
                      <p key={idx}>
                        <FormattedText text={para} />
                      </p>
                    ))}
                  </div>
                )}

                {/* Questions */}
                <div className="space-y-4">
                  {groupQuestions.map((q) => {
                    const userVal = answers[q.id] || '';
                    const isSubjective = q.format === 'essay' || q.format === 'speaking';
                    const correct = submitted && !isSubjective && isObjectiveCorrect(q, userVal);

                    return (
                      <div
                        key={q.id}
                        className={`rounded-2xl border p-4 space-y-3 ${
                          submitted && !isSubjective
                            ? correct
                              ? 'border-emerald-300 bg-emerald-50/40'
                              : 'border-rose-300 bg-rose-50/40'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-[15px] font-semibold text-[#0F172A] leading-relaxed">
                            <span className="text-[#2563EB] font-extrabold mr-1.5">
                              Question {q.number}.
                            </span>
                            <FormattedText text={q.prompt} />
                          </div>
                          <span className="text-xs font-mono-tabular font-semibold text-slate-500 shrink-0">
                            {q.points}đ
                          </span>
                        </div>

                        {q.options && q.options.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.options.map((opt) => {
                              const selected =
                                userVal.trim().toUpperCase() === opt.label.trim().toUpperCase();
                              const isRightOpt =
                                q.correctAnswer.trim().toUpperCase() ===
                                opt.label.trim().toUpperCase();
                              let style =
                                'border-slate-200 bg-white hover:border-blue-400 text-slate-800';
                              if (submitted) {
                                if (isRightOpt) {
                                  style =
                                    'border-emerald-500 bg-emerald-100/80 text-emerald-950 font-bold';
                                } else if (selected && !isRightOpt) {
                                  style = 'border-rose-400 bg-rose-100/80 text-rose-900';
                                }
                              } else if (selected) {
                                style = 'border-[#2563EB] bg-blue-50 text-[#1E40AF] font-bold';
                              }
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  disabled={submitted}
                                  onClick={() => setAnswers((prev) => ({...prev, [q.id]: opt.label}))}
                                  className={`text-left rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${style}`}
                                >
                                  <span className="font-bold mr-2">{opt.label}.</span>
                                  <FormattedText text={opt.text} />
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <textarea
                            rows={isSubjective ? 5 : 2}
                            disabled={submitted}
                            value={userVal}
                            onChange={(e) =>
                              setAnswers((prev) => ({...prev, [q.id]: e.target.value}))
                            }
                            placeholder={
                              isSubjective
                                ? 'Nhập bài viết của học sinh tại đây (giáo viên chấm bằng Rubric)...'
                                : 'Nhập câu trả lời của học sinh...'
                            }
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#2563EB] focus:outline-none disabled:bg-slate-50"
                          />
                        )}

                        {submitted && (
                          <div className="pt-2 border-t border-slate-200/70 text-xs space-y-1">
                            {!isSubjective ? (
                              <div className="flex items-center gap-1.5 font-bold">
                                {correct ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-rose-600" />
                                )}
                                <span className={correct ? 'text-emerald-700' : 'text-rose-700'}>
                                  Đáp án chuẩn: {q.correctAnswer}
                                </span>
                              </div>
                            ) : (
                              <div className="font-bold text-amber-800">
                                Gợi ý chấm tự luận (dùng kèm Rubric 5 tiêu chí):
                              </div>
                            )}
                            {q.explanation && (
                              <p className="text-slate-700 leading-relaxed">{q.explanation}</p>
                            )}
                            {q.sampleAnswer && (
                              <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-slate-800 mt-1">
                                <span className="font-bold text-[#1E40AF]">Bài mẫu tham khảo: </span>
                                {q.sampleAnswer}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};
