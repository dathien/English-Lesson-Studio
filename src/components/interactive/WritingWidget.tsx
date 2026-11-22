import React, {useEffect, useState} from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  Grade,
  RubricScoreEntry,
  StudentSubmission,
  WritingAIFeedback,
  WritingTaskConfig,
} from '../../types/lesson';
import {requestWritingFeedbackAI} from '../../services/aiService';
import {
  deleteSubmissionFromDB,
  getSubmissionsByLesson,
  saveSubmissionToDB,
} from '../../services/storage';

interface WritingWidgetProps {
  lessonId: string;
  slideId: string;
  grade: Grade;
  task: WritingTaskConfig;
  imageUrl?: string;
  imageCaption?: string;
  darkSurface?: boolean;
}

export const WritingWidget: React.FC<WritingWidgetProps> = ({
  lessonId,
  slideId,
  grade,
  task,
  imageUrl,
  imageCaption,
  darkSurface = false,
}) => {
  const [studentName, setStudentName] = useState('Học sinh 1');
  const [text, setText] = useState('');
  const [showOutline, setShowOutline] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<WritingAIFeedback | null>(null);
  const [teacherComment, setTeacherComment] = useState('');
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    task.rubricCriteria.forEach((c) => {
      init[c.id] = 0;
    });
    return init;
  });
  const [savedDrafts, setSavedDrafts] = useState<StudentSubmission[]>([]);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const maxTotal = task.rubricCriteria.reduce((sum, c) => sum + c.maxScore, 0);
  const currentTotal = task.rubricCriteria.reduce((sum, c) => sum + (scores[c.id] || 0), 0);

  useEffect(() => {
    let active = true;
    getSubmissionsByLesson(lessonId).then((list) => {
      if (!active) return;
      setSavedDrafts(list.filter((s) => s.type === 'writing' && s.slideId === slideId));
    });
    return () => {
      active = false;
    };
  }, [lessonId, slideId]);

  const handleRequestAIFeedback = async () => {
    setAiLoading(true);
    setAiError(null);
    const res = await requestWritingFeedbackAI({
      promptText: task.prompt,
      studentText: text,
      grade,
    });
    setAiLoading(false);
    if (res.ok && res.feedback) {
      setAiFeedback(res.feedback);
    } else {
      setAiError(res.error || 'Không thể nhận xét bài viết lúc này.');
    }
  };

  const handleSave = async () => {
    const rubricEntries: RubricScoreEntry[] = task.rubricCriteria.map((c) => ({
      criterionId: c.id,
      score: scores[c.id] || 0,
    }));
    const record: StudentSubmission = {
      id: `wrt-${Date.now()}`,
      lessonId,
      slideId,
      type: 'writing',
      studentName: studentName.trim() || 'Học sinh',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      textContent: text,
      wordCount,
      aiFeedback: aiFeedback || undefined,
      teacherComment: teacherComment.trim(),
      rubricScores: rubricEntries,
      totalScore: Number(currentTotal.toFixed(1)),
      maxScore: maxTotal,
    };
    await saveSubmissionToDB(record);
    const updated = await getSubmissionsByLesson(lessonId);
    setSavedDrafts(updated.filter((s) => s.type === 'writing' && s.slideId === slideId));
    setSaveToast('Đã lưu bài viết và nhận xét vào IndexedDB.');
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleLoadDraft = (draft: StudentSubmission) => {
    setStudentName(draft.studentName);
    setText(draft.textContent || '');
    setTeacherComment(draft.teacherComment || '');
    setAiFeedback(draft.aiFeedback || null);
    if (draft.rubricScores) {
      const next: Record<string, number> = {};
      draft.rubricScores.forEach((r) => {
        next[r.criterionId] = r.score;
      });
      setScores(next);
    }
  };

  const handleDeleteDraft = async (id: string) => {
    await deleteSubmissionFromDB(id);
    setSavedDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const cardClass = darkSurface
    ? 'bg-slate-800/80 border-slate-700 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left: Prompt, Picture, Outline, Useful Expressions */}
      <div className="lg:col-span-5 space-y-4">
        <div className={`rounded-xl border p-4 space-y-3 ${cardClass}`}>
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-[#0F4C81]">Đề bài Writing</h4>
            <span className="font-mono-tabular text-xs text-slate-500">
              Yêu cầu: {task.minWords}–{task.maxWords} từ
            </span>
          </div>
          <p className="leading-relaxed text-sm">{task.prompt}</p>

          {imageUrl && (
            <figure className="space-y-1.5">
              <img
                src={imageUrl}
                alt={imageCaption || 'Hình ảnh gợi ý luyện viết'}
                referrerPolicy="no-referrer"
                className="w-full max-h-56 object-cover rounded-lg border border-slate-200"
              />
              {imageCaption && <figcaption className="text-xs text-slate-500">{imageCaption}</figcaption>}
            </figure>
          )}
        </div>

        <div className={`rounded-xl border p-4 space-y-2.5 ${cardClass}`}>
          <button
            type="button"
            onClick={() => setShowOutline((v) => !v)}
            className="w-full flex items-center justify-between text-sm font-semibold text-[#0F4C81]"
          >
            <span>Gợi ý lập dàn ý &amp; Cấu trúc câu</span>
            {showOutline ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showOutline && (
            <div className="space-y-3 pt-1 text-sm">
              <ul className="list-disc pl-5 space-y-1">
                {task.outlineHints.map((hint, idx) => (
                  <li key={idx}>{hint}</li>
                ))}
              </ul>

              {task.usefulExpressions.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-slate-200/70">
                  <p className="text-xs font-semibold text-slate-500">
                    Cụm từ gợi ý (bấm để chèn khung mở đầu):
                  </p>
                  <div className="space-y-1.5">
                    {task.usefulExpressions.map((expr, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setText((prev) => (prev ? `${prev}\n${expr} ` : `${expr} `))}
                        className={`w-full text-left rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                          darkSurface
                            ? 'border-slate-700 bg-slate-900/60 hover:border-sky-400'
                            : 'border-slate-200 bg-slate-50 hover:border-[#0284C7] hover:bg-white'
                        }`}
                      >
                        {expr}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Saved student essays */}
        {savedDrafts.length > 0 && (
          <div className={`rounded-xl border p-4 space-y-2 ${cardClass}`}>
            <h5 className="text-sm font-semibold">Bài viết đã lưu ({savedDrafts.length})</h5>
            <div className="space-y-2 max-h-44 overflow-y-auto studio-scroll">
              {savedDrafts.map((d) => (
                <div
                  key={d.id}
                  className={`rounded-lg border p-2.5 text-xs flex items-center justify-between gap-2 ${
                    darkSurface ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleLoadDraft(d)}
                    className="text-left flex-1 min-w-0 hover:text-[#0284C7]"
                  >
                    <div className="font-semibold truncate">{d.studentName}</div>
                    <div className="text-slate-500 font-mono-tabular">
                      {d.wordCount || 0} từ · {d.totalScore ?? 0}/{d.maxScore ?? maxTotal} điểm
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDraft(d.id)}
                    className="text-slate-400 hover:text-rose-600 p-1"
                    title="Xóa bài viết"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: Writing Editor + AI Feedback + Teacher Rubric */}
      <div className="lg:col-span-7 space-y-4">
        <div className={`rounded-xl border p-4 space-y-3 ${cardClass}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Tên học sinh..."
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                darkSurface ? 'border-slate-600 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-900'
              }`}
            />
            <div className="font-mono-tabular text-sm">
              Số từ:{' '}
              <span
                className={`font-bold ${
                  wordCount >= task.minWords && wordCount <= task.maxWords
                    ? 'text-emerald-600'
                    : wordCount > 0
                      ? 'text-[#0284C7]'
                      : 'text-slate-500'
                }`}
              >
                {wordCount}
              </span>{' '}
              <span className="text-slate-500">/ {task.minWords}–{task.maxWords}</span>
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
            placeholder="Nhập bài viết Tiếng Anh của học sinh tại đây..."
            className={`w-full rounded-lg border p-3.5 leading-relaxed outline-none focus:ring-2 focus:ring-[#0284C7] ${
              darkSurface
                ? 'border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-400'
                : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
            }`}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B3A63] whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              Lưu bài viết
            </button>

            <button
              type="button"
              onClick={handleRequestAIFeedback}
              disabled={aiLoading || wordCount < 10}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm font-medium text-[#0F4C81] hover:bg-sky-100 disabled:opacity-50 whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              {aiLoading ? 'Đang phân tích lỗi...' : 'Nhận xét ngữ pháp & từ vựng (AI)'}
            </button>
          </div>

          {saveToast && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              {saveToast}
            </p>
          )}
          {aiError && (
            <p className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              {aiError}
            </p>
          )}
        </div>

        {/* Structured AI Feedback (Grammar/Vocab/Structure only - never writes full essay) */}
        {aiFeedback && (
          <div className={`rounded-xl border p-4 space-y-3 text-sm ${cardClass}`}>
            <h4 className="font-semibold text-[#0F4C81]">Nhận xét gợi ý chỉnh sửa (AI)</h4>
            <p>{aiFeedback.summary}</p>
            {aiFeedback.strengths.length > 0 && (
              <div>
                <p className="font-semibold text-emerald-700 text-xs mb-1">Điểm mạnh:</p>
                <ul className="list-disc pl-5 space-y-0.5 text-xs">
                  {aiFeedback.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {aiFeedback.grammarIssues.length > 0 && (
              <div>
                <p className="font-semibold text-rose-700 text-xs mb-1">Lỗi ngữ pháp cần sửa:</p>
                <div className="space-y-1.5">
                  {aiFeedback.grammarIssues.map((g, i) => (
                    <div key={i} className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-xs text-slate-800">
                      <span className="line-through text-rose-600">{g.original}</span> →{' '}
                      <span className="font-semibold text-emerald-700">{g.suggestion}</span>
                      <div className="text-slate-600 mt-0.5">{g.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {aiFeedback.vocabularySuggestions.length > 0 && (
              <div>
                <p className="font-semibold text-[#0284C7] text-xs mb-1">Gợi ý từ vựng:</p>
                <ul className="list-disc pl-5 space-y-0.5 text-xs">
                  {aiFeedback.vocabularySuggestions.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Teacher Rubric & Editable Comment */}
        <div className={`rounded-xl border p-4 space-y-3 ${cardClass}`}>
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-[#0F4C81]">Giáo viên nhận xét &amp; Chấm tiêu chí</h4>
            <span className="font-mono-tabular text-sm font-bold text-[#0F4C81]">
              {currentTotal.toFixed(1)} / {maxTotal} điểm
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {task.rubricCriteria.map((c) => (
              <div key={c.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold truncate">{c.name}</span>
                  <span className="font-mono-tabular text-[#0284C7] font-semibold">
                    {(scores[c.id] || 0).toFixed(1)}/{c.maxScore}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={c.maxScore}
                  step={0.5}
                  value={scores[c.id] || 0}
                  onChange={(e) => setScores((p) => ({...p, [c.id]: Number(e.target.value)}))}
                  aria-label={c.name}
                  className="w-full accent-[#0284C7]"
                />
              </div>
            ))}
          </div>

          <textarea
            value={teacherComment}
            onChange={(e) => setTeacherComment(e.target.value)}
            rows={2}
            placeholder="Giáo viên chỉnh sửa / bổ sung nhận xét cho học sinh..."
            className={`w-full rounded-lg border px-3 py-2 text-sm ${
              darkSurface ? 'border-slate-600 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-900'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
