import React, {useEffect, useMemo, useState} from 'react';
import {
  CheckCircle2,
  Clock,
  FileDown,
  Play,
  Printer,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  CognitiveLevel,
  Grade,
  LessonProject,
  QuestionItem,
  QuestionType,
  SkillCategory,
} from '../types/lesson';
import {
  COGNITIVE_LABELS,
  SKILL_LABELS,
  SKILL_SHORT_LABELS,
} from '../types/lesson';
import {buildQuestionBank} from '../data/samples';
import {exportLessonToWord, printLessonAsPDF} from '../services/exporters';
import {
  evaluateQuestion,
  QuestionRenderer,
  type QuestionAnswerMap,
} from './interactive/QuestionRenderer';

interface AssessmentCenterProps {
  allLessons: LessonProject[];
  defaultGrade: Grade;
  onConvertToLesson: (lesson: LessonProject) => void;
}

type ExamMode = 'regular' | 'midterm' | 'final' | 'review' | 'skill';

const EXAM_MODE_META: Record<ExamMode, {label: string; defaultDuration: number; defaultCount: number}> = {
  regular: {label: 'Kiểm tra thường xuyên (15 phút)', defaultDuration: 15, defaultCount: 6},
  midterm: {label: 'Kiểm tra giữa kỳ (45 phút)', defaultDuration: 45, defaultCount: 12},
  final: {label: 'Kiểm tra cuối kỳ (50 phút)', defaultDuration: 50, defaultCount: 16},
  review: {label: 'Ôn tập tổng hợp', defaultDuration: 30, defaultCount: 10},
  skill: {label: 'Luyện tập theo kỹ năng', defaultDuration: 20, defaultCount: 8},
};

export const AssessmentCenter: React.FC<AssessmentCenterProps> = ({
  allLessons,
  defaultGrade,
  onConvertToLesson,
}) => {
  const bank = useMemo(() => buildQuestionBank(allLessons), [allLessons]);

  const [examMode, setExamMode] = useState<ExamMode>('regular');
  const [grade, setGrade] = useState<Grade>(defaultGrade);
  const [skillFilter, setSkillFilter] = useState<SkillCategory | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<QuestionType | 'all'>('all');
  const [levelFilter, setLevelFilter] = useState<CognitiveLevel | 'all'>('all');
  const [topicQuery, setTopicQuery] = useState('');
  const [questionCount, setQuestionCount] = useState(6);
  const [durationMin, setDurationMin] = useState(15);

  const [activeQuestions, setActiveQuestions] = useState<QuestionItem[] | null>(null);
  const [answers, setAnswers] = useState<QuestionAnswerMap>({});
  const [submitted, setSubmitted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);

  const filteredPool = useMemo(() => {
    return bank.filter((entry) => {
      if (entry.grade !== grade) return false;
      if (skillFilter !== 'all' && entry.skill !== skillFilter) return false;
      if (typeFilter !== 'all' && entry.question.type !== typeFilter) return false;
      if (levelFilter !== 'all' && (entry.question.cognitiveLevel || 'comprehension') !== levelFilter) {
        return false;
      }
      if (
        topicQuery.trim() &&
        !`${entry.topic} ${entry.lessonTitle} ${entry.question.prompt}`
          .toLowerCase()
          .includes(topicQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [bank, grade, skillFilter, typeFilter, levelFilter, topicQuery]);

  useEffect(() => {
    if (!activeQuestions || submitted) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setSubmitted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeQuestions, submitted]);

  const handleModeChange = (mode: ExamMode) => {
    setExamMode(mode);
    setDurationMin(EXAM_MODE_META[mode].defaultDuration);
    setQuestionCount(EXAM_MODE_META[mode].defaultCount);
  };

  const handleGenerateTest = () => {
    const selected = filteredPool.slice(0, Math.min(questionCount, filteredPool.length)).map((e, idx) => ({
      ...structuredClone(e.question),
      id: `test-q-${idx}-${Date.now()}`,
      number: idx + 1,
    }));
    setActiveQuestions(selected);
    setAnswers({});
    setSubmitted(false);
    setSecondsLeft(durationMin * 60);
  };

  const buildLessonFromTest = (): LessonProject => {
    const now = Date.now();
    return {
      id: `assessment-${now}`,
      title: `${EXAM_MODE_META[examMode].label} · Tiếng Anh Lớp ${grade}`,
      grade,
      skill: skillFilter === 'all' ? 'review' : skillFilter,
      topic: topicQuery || 'Đề kiểm tra tổng hợp',
      description: `Đề kiểm tra gồm ${activeQuestions?.length || 0} câu hỏi · Thời gian ${durationMin} phút.`,
      curriculumNote: `Ngân hàng câu hỏi English Slide Studio · Lớp ${grade}`,
      createdAt: now,
      updatedAt: now,
      themeId: 'light_classroom',
      slides: [
        {
          id: `test-slide-${now}`,
          order: 0,
          title: `${EXAM_MODE_META[examMode].label} — Lớp ${grade}`,
          skill: skillFilter === 'all' ? 'review' : skillFilter,
          activityType: 'review_mixed',
          instruction: `Thời gian làm bài: ${durationMin} phút. Hoàn thành tất cả các câu hỏi dưới đây.`,
          questions: activeQuestions || [],
        },
      ],
    };
  };

  const resultStats = useMemo(() => {
    if (!activeQuestions || !submitted) return null;
    let correct = 0;
    activeQuestions.forEach((q) => {
      if (evaluateQuestion(q, answers[q.id]) === true) correct++;
    });
    const total = activeQuestions.length;
    const score10 = total > 0 ? ((correct / total) * 10).toFixed(2) : '0.00';
    return {correct, total, score10};
  }, [activeQuestions, answers, submitted]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Kiểm tra &amp; Đánh giá Tiếng Anh THPT
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Tạo đề từ ngân hàng câu hỏi ({bank.length} câu sẵn có từ 24 bài mẫu &amp; bài của bạn), chấm tự động câu khách quan và xuất Word/PDF.
          </p>
        </div>
      </div>

      {!activeQuestions ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Config Panel */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2 font-semibold text-[#0F4C81]">
              <SlidersHorizontal className="w-4 h-4" />
              Cấu hình ma trận đề kiểm tra
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Hình thức kiểm tra</label>
              <div className="grid grid-cols-1 gap-1.5">
                {(Object.keys(EXAM_MODE_META) as ExamMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleModeChange(m)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      examMode === m
                        ? 'border-[#0284C7] bg-sky-50 text-[#0F4C81] font-semibold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {EXAM_MODE_META[m].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Khối lớp</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(Number(e.target.value) as Grade)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value={10}>Lớp 10</option>
                  <option value={11}>Lớp 11</option>
                  <option value={12}>Lớp 12</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Kỹ năng</label>
                <select
                  value={skillFilter}
                  onChange={(e) => setSkillFilter(e.target.value as SkillCategory | 'all')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="all">Tất cả kỹ năng</option>
                  {(Object.keys(SKILL_LABELS) as SkillCategory[]).map((sk) => (
                    <option key={sk} value={sk}>
                      {SKILL_SHORT_LABELS[sk]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Dạng câu hỏi</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as QuestionType | 'all')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="all">Tất cả dạng</option>
                  <option value="mcq">Trắc nghiệm (MCQ)</option>
                  <option value="pronunciation_underlined">Phát âm gạch chân</option>
                  <option value="true_false">True / False</option>
                  <option value="gap_fill">Điền từ (Gap Fill)</option>
                  <option value="error_correction">Tìm lỗi sai</option>
                  <option value="transformation">Viết lại câu</option>
                  <option value="matching">Nối cặp</option>
                  <option value="ordering">Sắp xếp trình tự</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Mức độ nhận thức</label>
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value as CognitiveLevel | 'all')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="all">Tất cả mức độ</option>
                  {(Object.keys(COGNITIVE_LABELS) as CognitiveLevel[]).map((lv) => (
                    <option key={lv} value={lv}>
                      {COGNITIVE_LABELS[lv]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Lọc theo chủ đề / từ khóa</label>
              <input
                type="text"
                value={topicQuery}
                onChange={(e) => setTopicQuery(e.target.value)}
                placeholder="VD: Family, Environment, Heritage, AI..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Số câu (tối đa {filteredPool.length})
                </label>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, filteredPool.length)}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Thời gian (phút)</label>
                <input
                  type="number"
                  min={5}
                  max={90}
                  value={durationMin}
                  onChange={(e) => setDurationMin(Math.max(5, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateTest}
              disabled={filteredPool.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F4C81] py-3 text-sm font-semibold text-white hover:bg-[#0B3A63] disabled:opacity-40"
            >
              <Play className="w-4 h-4" />
              Bắt đầu làm bài / Tạo đề ({Math.min(questionCount, filteredPool.length)} câu)
            </button>
          </div>

          {/* Bank Preview Table */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                Ngân hàng câu hỏi phù hợp ({filteredPool.length} câu)
              </h2>
              <span className="text-xs text-slate-500">Khối Lớp {grade}</span>
            </div>

            {filteredPool.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                Không tìm thấy câu hỏi nào khớp bộ lọc. Hãy mở rộng mức độ nhận thức hoặc kỹ năng.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto studio-scroll pr-1">
                {filteredPool.map((entry, idx) => (
                  <div key={`${entry.question.id}-${idx}`} className="py-3 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-[#0F4C81]">
                        {SKILL_SHORT_LABELS[entry.skill]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{entry.topic}</span>
                      <span aria-hidden="true">·</span>
                      <span>{COGNITIVE_LABELS[entry.question.cognitiveLevel || 'comprehension']}</span>
                    </div>
                    <p className="text-sm text-slate-800 line-clamp-2">
                      {entry.question.prompt.replace(/<\/?u>/g, '')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Active Timed Assessment Runner */
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-lg text-slate-900">
                {EXAM_MODE_META[examMode].label} · Lớp {grade}
              </h2>
              <p className="text-xs text-slate-500">
                {activeQuestions.length} câu hỏi khách quan · Tự động chấm điểm theo đáp án chuẩn
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono-tabular text-sm font-semibold text-[#0F4C81]">
                <Clock className="w-4 h-4" />
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </div>

              {!submitted ? (
                <button
                  type="button"
                  onClick={() => setSubmitted(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Nộp bài &amp; Chấm điểm
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAnswers({});
                    setSubmitted(false);
                    setSecondsLeft(durationMin * 60);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4" />
                  Làm lại
                </button>
              )}

              <button
                type="button"
                onClick={() => exportLessonToWord(buildLessonFromTest(), {includeAnswers: true})}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 whitespace-nowrap"
              >
                <FileDown className="w-4 h-4" />
                Xuất Word
              </button>

              <button
                type="button"
                onClick={() => printLessonAsPDF(buildLessonFromTest(), {includeAnswers: true})}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 whitespace-nowrap"
              >
                <Printer className="w-4 h-4" />
                In / PDF
              </button>

              <button
                type="button"
                onClick={() => onConvertToLesson(buildLessonFromTest())}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-3 py-2 text-sm font-medium text-white hover:bg-[#0B3A63] whitespace-nowrap"
              >
                <Play className="w-4 h-4" />
                Chuyển thành Slide
              </button>

              <button
                type="button"
                onClick={() => setActiveQuestions(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Tạo đề khác
              </button>
            </div>
          </div>

          {resultStats && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-emerald-950">Kết quả chấm tự động</div>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Đáp án đúng và lời giải thích chi tiết đã được hiển thị bên dưới từng câu hỏi.
                </p>
              </div>
              <div className="flex items-center gap-6 font-mono-tabular">
                <div>
                  <span className="text-xs text-emerald-800 block">Số câu đúng</span>
                  <span className="text-2xl font-bold text-emerald-950">
                    {resultStats.correct} / {resultStats.total}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-emerald-800 block">Quy đổi thang 10</span>
                  <span className="text-2xl font-bold text-[#0F4C81]">{resultStats.score10}</span>
                </div>
              </div>
            </div>
          )}

          <QuestionRenderer
            questions={activeQuestions}
            answers={answers}
            onChangeAnswer={(qId, val) => setAnswers((p) => ({...p, [qId]: val}))}
            checked={submitted}
            showAnswers={submitted}
            showExplanations={submitted}
          />
        </div>
      )}
    </div>
  );
};
