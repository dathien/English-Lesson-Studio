import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Headphones,
  Mic,
  PenTool,
  ShieldCheck,
} from 'lucide-react';
import {COGNITIVE_LABELS} from '../../types/lesson';
import type {Exam, ExamDossier, ExamRubric, MarkingGuide} from '../../types/exam';
import {DEFAULT_EXPORT_OPTIONS, EXAM_SKILL_LABELS} from '../../types/exam';
import {auditExamAnswers} from '../../services/examEngine';
import {downloadAnswerKeyDocx} from '../../services/examExporters';

interface ExamAnswerRubricStepProps {
  dossier: ExamDossier;
  onUpdateExam: (nextExam: Exam) => void;
  onUpdateMarkingGuide: (nextGuide: MarkingGuide) => void;
  onNextStep: () => void;
}

export const ExamAnswerRubricStep: React.FC<ExamAnswerRubricStepProps> = ({
  dossier,
  onUpdateExam,
  onUpdateMarkingGuide,
  onNextStep,
}) => {
  const {exam, answerKey, markingGuide} = dossier;
  const auditIssues = auditExamAnswers(exam, answerKey);
  const auditErrors = auditIssues.filter((i) => i.severity === 'error');

  const updateQuestionField = (
    questionId: string,
    patch: {correctAnswer?: string; acceptedAnswers?: string[]; explanation?: string},
  ) => {
    const nextQs = exam.questions.map((q) => (q.id === questionId ? {...q, ...patch} : q));
    onUpdateExam({...exam, questions: nextQs});
  };

  const updateRubricCriterion = (
    kind: 'writing' | 'speaking',
    criterionId: string,
    patch: {name?: string; weightPercent?: number; maxScore?: number},
  ) => {
    const target: ExamRubric =
      kind === 'writing' ? markingGuide.writingRubric : markingGuide.speakingRubric;
    const nextCriteria = target.criteria.map((c) =>
      c.id === criterionId ? {...c, ...patch} : c,
    );
    const nextTotal = Math.round(nextCriteria.reduce((s, c) => s + c.maxScore, 0) * 100) / 100;
    const updatedRubric: ExamRubric = {...target, totalScore: nextTotal, criteria: nextCriteria};
    onUpdateMarkingGuide(
      kind === 'writing'
        ? {...markingGuide, writingRubric: updatedRubric}
        : {...markingGuide, speakingRubric: updatedRubric},
    );
  };

  return (
    <div className="space-y-6">
      {/* Header + Independent Audit Banner */}
      <div className="rounded-[18px] border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-extrabold text-[#0F172A]">
              Bước 5: Đáp án, Kiểm định độc lập &amp; Rubric hướng dẫn chấm
            </h2>
            <p className="text-[15px] text-[#475569] mt-0.5">
              Tự động tổng hợp bảng đáp án, kiểm tra trùng phương án/thiếu đáp án/lệch khóa, kèm transcript bài nghe và Rubric Writing–Speaking tùy chỉnh (không tự chấm điểm ảo bằng AI).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => downloadAnswerKeyDocx(dossier, DEFAULT_EXPORT_OPTIONS)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-[#0F172A] hover:bg-slate-50"
            >
              <Download className="w-4 h-4 text-[#2563EB]" />
              Xuất Word Đáp án &amp; HDC
            </button>
            <button
              type="button"
              onClick={onNextStep}
              className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-[#1E40AF]"
            >
              Sang Xem trước &amp; Xuất trọn bộ →
            </button>
          </div>
        </div>

        {/* Independent Answer Audit Result */}
        <div
          className={`rounded-xl border p-4 ${
            auditErrors.length === 0
              ? 'border-emerald-200 bg-emerald-50/70'
              : 'border-rose-300 bg-rose-50'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {auditErrors.length === 0 ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 flex-1">
              <div className="font-bold text-[15px] text-[#0F172A]">
                {auditErrors.length === 0
                  ? `Kiểm định đáp án độc lập: Đạt 100% (${answerKey.entries.length} câu · Tổng ${answerKey.totalPoints.toFixed(2)} điểm — không thiếu đáp án, không trùng phương án)`
                  : `Phát hiện ${auditErrors.length} lỗi đáp án cần xử lý trước khi xuất đề`}
              </div>
              {auditIssues.length > 0 && (
                <ul className="list-disc pl-5 text-sm space-y-0.5 text-slate-800">
                  {auditIssues.map((iss) => (
                    <li key={iss.id}>{iss.message}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Answer Key Table */}
      <div className="rounded-[18px] border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 font-bold text-[16px] text-[#0F172A] flex items-center justify-between">
          <span>Bảng đáp án chi tiết (Mã đề {answerKey.examCode})</span>
          <span className="text-sm font-mono-tabular text-[#2563EB]">
            Tổng: {answerKey.totalPoints.toFixed(2)} điểm
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-[15px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-xs font-bold uppercase text-slate-700">
                <th className="p-3 text-center w-16">Câu</th>
                <th className="p-3 w-36">Kỹ năng</th>
                <th className="p-3 w-28 text-center">Mức độ</th>
                <th className="p-3 w-52">Đáp án chuẩn</th>
                <th className="p-3 w-56">Phương án tương đương (nếu có)</th>
                <th className="p-3 text-center w-20">Điểm</th>
                <th className="p-3">Giải thích chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {answerKey.entries.map((entry) => (
                <tr key={entry.questionId} className="hover:bg-blue-50/20 align-top">
                  <td className="p-2.5 text-center font-bold font-mono-tabular text-[#0F172A]">
                    {entry.questionNumber}
                  </td>
                  <td className="p-2.5 text-sm font-medium text-slate-700">
                    {EXAM_SKILL_LABELS[entry.skill].vi}
                  </td>
                  <td className="p-2.5 text-center text-xs font-semibold text-[#1E40AF]">
                    {COGNITIVE_LABELS[entry.cognitiveLevel]}
                  </td>
                  <td className="p-2.5">
                    <input
                      type="text"
                      value={entry.correctAnswer}
                      onChange={(e) =>
                        updateQuestionField(entry.questionId, {correctAnswer: e.target.value})
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-bold text-emerald-800"
                    />
                  </td>
                  <td className="p-2.5">
                    <input
                      type="text"
                      value={(entry.acceptedAnswers || []).join(' | ')}
                      onChange={(e) =>
                        updateQuestionField(entry.questionId, {
                          acceptedAnswers: e.target.value
                            .split('|')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Phân cách bằng dấu |"
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                    />
                  </td>
                  <td className="p-2.5 text-center font-bold font-mono-tabular text-[#2563EB]">
                    {entry.points.toFixed(2)}
                  </td>
                  <td className="p-2.5">
                    <input
                      type="text"
                      value={entry.explanation}
                      onChange={(e) =>
                        updateQuestionField(entry.questionId, {explanation: e.target.value})
                      }
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Listening Transcripts for Answer Key */}
      {markingGuide.listeningTranscripts.length > 0 && (
        <div className="rounded-[18px] border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
          <h3 className="font-bold text-[16px] text-[#0F172A] flex items-center gap-2">
            <Headphones className="w-5 h-5 text-[#2563EB]" />
            Transcript bài nghe (in kèm bộ Đáp án của giáo viên)
          </h3>
          {markingGuide.listeningTranscripts.map((tr) => (
            <div key={tr.groupId} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
              <div className="font-bold text-sm text-[#1E40AF]">{tr.title}</div>
              <p className="text-[15px] text-slate-800 leading-relaxed whitespace-pre-line">
                {tr.transcript}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Customizable Writing & Speaking Rubrics */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {(['writing', 'speaking'] as const).map((kind) => {
          const rubric =
            kind === 'writing' ? markingGuide.writingRubric : markingGuide.speakingRubric;
          const Icon = kind === 'writing' ? PenTool : Mic;
          return (
            <div
              key={kind}
              className="rounded-[18px] border border-slate-200 bg-white p-5 space-y-3.5 shadow-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-[16px] text-[#0F172A] flex items-center gap-2">
                  <Icon className="w-5 h-5 text-[#2563EB]" />
                  {rubric.title}
                </h3>
                <span className="text-sm font-extrabold font-mono-tabular text-[#2563EB]">
                  Tổng: {rubric.totalScore.toFixed(2)} đ
                </span>
              </div>
              <p className="text-xs text-[#475569]">
                Giáo viên chấm trực tiếp theo tiêu chí và có thể chỉnh tỷ trọng/điểm tối đa phù hợp quy định tổ chuyên môn.
              </p>
              <div className="space-y-2.5">
                {rubric.criteria.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-sm text-[#0F172A]">{c.name}</span>
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <label className="flex items-center gap-1">
                          Tỷ trọng %:
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={c.weightPercent}
                            onChange={(e) =>
                              updateRubricCriterion(kind, c.id, {
                                weightPercent: Number(e.target.value) || 0,
                              })
                            }
                            className="w-14 rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-center font-mono-tabular"
                          />
                        </label>
                        <label className="flex items-center gap-1">
                          Điểm tối đa:
                          <input
                            type="number"
                            step={0.05}
                            min={0}
                            max={10}
                            value={c.maxScore}
                            onChange={(e) =>
                              updateRubricCriterion(kind, c.id, {
                                maxScore: Number(e.target.value) || 0,
                              })
                            }
                            className="w-16 rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-center font-bold text-[#2563EB] font-mono-tabular"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="text-xs text-[#475569]">
                      <CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-600 mr-1" />
                      {c.levels[0]?.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
