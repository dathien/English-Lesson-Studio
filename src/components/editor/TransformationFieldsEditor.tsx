import React, {useMemo, useState} from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Lightbulb,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  CognitiveLevel,
  HighSchoolGrade,
  QuestionItem,
  SentenceTransformationMeta,
  TransformationSubtype,
} from '../../types/lesson';
import {
  COGNITIVE_LABELS,
  TRANSFORMATION_SUBTYPE_LABELS,
} from '../../types/lesson';
import {GLOBAL_SUCCESS_UNITS} from '../../data/examCurriculum';
import {
  buildTransformationPromptText,
  DEFAULT_TRANSFORMATION_GRADING_RULES,
  inferTransformationMeta,
} from '../../services/sentenceTransformationEngine';
import {QuestionRenderer, type QuestionAnswerMap} from '../interactive/QuestionRenderer';

export interface TransformationEditorValue {
  prompt: string;
  correctAnswer: string;
  acceptedAnswers: string[];
  explanation: string;
  cognitiveLevel: CognitiveLevel;
  points?: number;
  grade?: HighSchoolGrade;
  unitId?: string;
  transformation: SentenceTransformationMeta;
}

interface TransformationFieldsEditorProps {
  value: TransformationEditorValue;
  onChange: (next: TransformationEditorValue) => void;
  showGradeUnitFields?: boolean;
  showPointsField?: boolean;
  compact?: boolean;
}

const SUBTYPES: TransformationSubtype[] = [
  'given_start',
  'keyword',
  'keyword_unchanged',
  'gap_completion',
  'full_rewrite',
];

export const TransformationFieldsEditor: React.FC<TransformationFieldsEditorProps> = ({
  value,
  onChange,
  showGradeUnitFields = true,
  showPointsField = false,
  compact = false,
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<QuestionAnswerMap>({});
  const [previewChecked, setPreviewChecked] = useState(false);
  const [previewShowKey, setPreviewShowKey] = useState(false);

  const meta: SentenceTransformationMeta = useMemo(() => {
    const base =
      value.transformation && value.transformation.originalSentence !== undefined
        ? value.transformation
        : inferTransformationMeta({
            prompt: value.prompt,
            correctAnswer: value.correctAnswer,
            acceptedAnswers: value.acceptedAnswers,
            explanation: value.explanation,
          });
    return {
      ...base,
      gradingRules: {
        ...DEFAULT_TRANSFORMATION_GRADING_RULES,
        ...(base.gradingRules || {}),
      },
      hints: base.hints || [],
    };
  }, [value]);

  const grade: HighSchoolGrade = value.grade || meta.grade || 10;
  const unitsForGrade = GLOBAL_SUCCESS_UNITS[grade] || [];

  const updateMeta = (patch: Partial<SentenceTransformationMeta>, extra?: Partial<TransformationEditorValue>) => {
    const nextMeta: SentenceTransformationMeta = {
      ...meta,
      ...patch,
      gradingRules: {
        ...DEFAULT_TRANSFORMATION_GRADING_RULES,
        ...(meta.gradingRules || {}),
        ...(patch.gradingRules || {}),
      },
    };
    const syncedPrompt = buildTransformationPromptText(nextMeta);
    onChange({
      ...value,
      ...extra,
      prompt: syncedPrompt || value.prompt,
      transformation: nextMeta,
    });
  };

  const acceptedList = value.acceptedAnswers || [];
  const hintsList = meta.hints || [];

  const previewQuestion: QuestionItem = useMemo(
    () => ({
      id: 'teacher-preview-tf',
      number: 1,
      type: 'transformation',
      prompt: buildTransformationPromptText(meta) || value.prompt,
      correctAnswer: value.correctAnswer,
      acceptedAnswers: acceptedList,
      explanation: value.explanation,
      cognitiveLevel: value.cognitiveLevel,
      transformation: meta,
    }),
    [meta, value, acceptedList],
  );

  return (
    <div
      className={`rounded-xl border border-indigo-200 bg-indigo-50/35 ${
        compact ? 'p-3 space-y-3' : 'p-4 space-y-4'
      }`}
    >
      {/* Header & Live Preview Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold uppercase tracking-wide text-indigo-900">
            Cấu hình Viết lại câu đồng nghĩa (Sentence Transformation)
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setPreviewOpen((v) => !v);
            setPreviewChecked(false);
          }}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
            previewOpen
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50'
          }`}
        >
          {previewOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {previewOpen ? 'Đóng xem thử HS' : 'Xem thử giao diện HS'}
        </button>
      </div>

      {/* Live Student Preview Box */}
      {previewOpen && (
        <div className="rounded-xl border border-indigo-200 bg-white p-3.5 space-y-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span className="font-semibold text-indigo-800">
              Chế độ thử nghiệm trực tiếp như học sinh (nhập thử để kiểm tra chấm điểm)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPreviewChecked(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Chấm thử
              </button>
              <button
                type="button"
                onClick={() => setPreviewShowKey((v) => !v)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {previewShowKey ? 'Ẩn đáp án' : 'Hiện đáp án'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewAnswers({});
                  setPreviewChecked(false);
                }}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                Xóa thử
              </button>
            </div>
          </div>
          <QuestionRenderer
            questions={[previewQuestion]}
            answers={previewAnswers}
            onChangeAnswer={(qId, val) => {
              setPreviewAnswers((p) => ({...p, [qId]: val}));
              setPreviewChecked(false);
            }}
            checked={previewChecked}
            showAnswers={previewShowKey}
            showExplanations={previewShowKey}
          />
        </div>
      )}

      {/* Row 1: Subtype, Grade, Unit, Level, Points */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="sm:col-span-2">
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
            Dạng viết lại câu (5 dạng chuẩn)
          </label>
          <select
            value={meta.subtype}
            onChange={(e) => {
              const nextSub = e.target.value as TransformationSubtype;
              updateMeta({
                subtype: nextSub,
                keepKeywordUnchanged:
                  nextSub === 'keyword_unchanged' ? true : meta.keepKeywordUnchanged,
              });
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900"
          >
            {SUBTYPES.map((st) => (
              <option key={st} value={st}>
                {TRANSFORMATION_SUBTYPE_LABELS[st].vi}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
            Mức độ nhận thức
          </label>
          <select
            value={value.cognitiveLevel}
            onChange={(e) =>
              onChange({...value, cognitiveLevel: e.target.value as CognitiveLevel})
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900"
          >
            {(Object.keys(COGNITIVE_LABELS) as CognitiveLevel[]).map((lv) => (
              <option key={lv} value={lv}>
                {COGNITIVE_LABELS[lv]}
              </option>
            ))}
          </select>
        </div>

        {showPointsField && (
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Điểm số
            </label>
            <input
              type="number"
              step={0.05}
              min={0.1}
              max={5}
              value={value.points ?? meta.points ?? 0.25}
              onChange={(e) => {
                const pts = Math.max(0.1, Number(e.target.value) || 0.25);
                updateMeta({points: pts}, {points: pts});
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono-tabular"
            />
          </div>
        )}
      </div>

      {showGradeUnitFields && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Khối lớp
            </label>
            <select
              value={grade}
              onChange={(e) => {
                const g = Number(e.target.value) as HighSchoolGrade;
                const firstUnit = GLOBAL_SUCCESS_UNITS[g]?.[0]?.id || `gs${g}-u1`;
                updateMeta({grade: g, unitId: firstUnit}, {grade: g, unitId: firstUnit});
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            >
              <option value={10}>Lớp 10</option>
              <option value={11}>Lớp 11</option>
              <option value={12}>Lớp 12</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Unit (Global Success)
            </label>
            <select
              value={value.unitId || meta.unitId || ''}
              onChange={(e) =>
                updateMeta({unitId: e.target.value}, {unitId: e.target.value})
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            >
              <option value="">-- Chọn Unit --</option>
              {unitsForGrade.map((u) => (
                <option key={u.id} value={u.id}>
                  Unit {u.number}: {u.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Chủ điểm ngữ pháp
            </label>
            <input
              type="text"
              value={meta.grammarTopic || ''}
              onChange={(e) => updateMeta({grammarTopic: e.target.value})}
              placeholder="VD: Passive Voice, Reported Speech, Cleft Sentences..."
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            />
          </div>
        </div>
      )}

      {/* Row 2: Original Sentence & Instruction */}
      <div className="space-y-2.5">
        <div>
          <label className="text-[11px] font-semibold text-slate-700 block mb-1">
            Câu gốc (Original Sentence) *
          </label>
          <textarea
            rows={2}
            value={meta.originalSentence}
            onChange={(e) => updateMeta({originalSentence: e.target.value})}
            placeholder="VD: Although cyberbullying causes serious mental stress, many students hesitate to report it."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
            Yêu cầu viết lại (Instruction — tùy chọn)
          </label>
          <input
            type="text"
            value={meta.instruction || ''}
            onChange={(e) => updateMeta({instruction: e.target.value})}
            placeholder="VD: Rewrite the sentence without changing its meaning. / Do not change the word given."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
          />
        </div>
      </div>

      {/* Row 3: Format-specific fields (Given Start/End, Gap Template, Keyword, Word Limit) */}
      {meta.subtype === 'gap_completion' ? (
        <div>
          <label className="text-[11px] font-semibold text-slate-700 block mb-1">
            Mẫu câu có chỗ trống (dùng <code className="bg-slate-200 px-1 rounded">___</code> cho mỗi chỗ trống)
          </label>
          <input
            type="text"
            value={meta.gapTemplate || ''}
            onChange={(e) => updateMeta({gapTemplate: e.target.value})}
            placeholder="VD: The ___ housing prices get, the ___ it becomes for young workers."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Phần đầu cho trước (Given Start — tùy chọn)
            </label>
            <input
              type="text"
              value={meta.givenStart || ''}
              onChange={(e) => updateMeta({givenStart: e.target.value})}
              placeholder="VD: Despite / More than 200 trees"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Phần cuối cho trước (Given End — tùy chọn)
            </label>
            <input
              type="text"
              value={meta.givenEnd || ''}
              onChange={(e) => updateMeta({givenEnd: e.target.value})}
              placeholder="VD: it is today."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
        <div>
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
            Từ khóa yêu cầu (Keyword)
          </label>
          <input
            type="text"
            value={meta.keyword || ''}
            onChange={(e) => updateMeta({keyword: e.target.value})}
            placeholder="VD: DESPITE, TOO, UNLESS..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold uppercase"
          />
        </div>
        <div className="flex items-center gap-2 pb-1.5">
          <input
            id="tf-keep-kw"
            type="checkbox"
            checked={Boolean(meta.keepKeywordUnchanged)}
            onChange={(e) => updateMeta({keepKeywordUnchanged: e.target.checked})}
            className="rounded border-slate-300 text-indigo-600"
          />
          <label htmlFor="tf-keep-kw" className="text-xs font-medium text-slate-700 cursor-pointer">
            Không biến đổi dạng từ khóa
          </label>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Số từ tối thiểu
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={meta.wordLimit?.min ?? ''}
              onChange={(e) => {
                const min = e.target.value ? Number(e.target.value) : undefined;
                const max = meta.wordLimit?.max;
                updateMeta({
                  wordLimit: min || max ? {min, max} : undefined,
                });
              }}
              placeholder="VD: 2"
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono-tabular"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Số từ tối đa
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={meta.wordLimit?.max ?? ''}
              onChange={(e) => {
                const max = e.target.value ? Number(e.target.value) : undefined;
                const min = meta.wordLimit?.min;
                updateMeta({
                  wordLimit: min || max ? {min, max} : undefined,
                });
              }}
              placeholder="VD: 5"
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono-tabular"
            />
          </div>
        </div>
      </div>

      {/* Row 4: Primary Answer & Accepted Equivalents */}
      <div className="space-y-2.5 pt-1 border-t border-indigo-100">
        <div>
          <label className="text-[11px] font-semibold text-emerald-800 block mb-1">
            Đáp án chuẩn chính (Model Answer) *
          </label>
          <input
            type="text"
            value={value.correctAnswer}
            onChange={(e) => onChange({...value, correctAnswer: e.target.value})}
            placeholder="Nhập câu đáp án chuẩn hoàn chỉnh..."
            className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-950"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-700">
              Các đáp án tương đương được chấp nhận ({acceptedList.length})
            </label>
            <button
              type="button"
              onClick={() =>
                onChange({...value, acceptedAnswers: [...acceptedList, '']})
              }
              className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
            >
              <Plus className="w-3 h-3" />
              Thêm đáp án chấp nhận
            </button>
          </div>
          {acceptedList.map((acc, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <input
                type="text"
                value={acc}
                onChange={(e) => {
                  const next = [...acceptedList];
                  next[idx] = e.target.value;
                  onChange({...value, acceptedAnswers: next});
                }}
                placeholder={`Phương án đúng tương đương #${idx + 1}...`}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  const next = acceptedList.filter((_, i) => i !== idx);
                  onChange({...value, acceptedAnswers: next});
                }}
                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                title="Xóa phương án này"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Row 5: Progressive Hints */}
      <div className="space-y-1.5 pt-1 border-t border-indigo-100">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-amber-800 inline-flex items-center gap-1">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            Gợi ý từng bước (ẩn trong chế độ thi chính thức) ({hintsList.length})
          </label>
          <button
            type="button"
            onClick={() => updateMeta({hints: [...hintsList, '']})}
            className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-50"
          >
            <Plus className="w-3 h-3" />
            Thêm gợi ý
          </button>
        </div>
        {hintsList.map((hint, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-amber-700 w-12 shrink-0">
              Bước {idx + 1}:
            </span>
            <input
              type="text"
              value={hint}
              onChange={(e) => {
                const next = [...hintsList];
                next[idx] = e.target.value;
                updateMeta({hints: next});
              }}
              placeholder={`Gợi ý bước ${idx + 1}...`}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            />
            <button
              type="button"
              onClick={() => {
                const next = hintsList.filter((_, i) => i !== idx);
                updateMeta({hints: next});
              }}
              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
              title="Xóa gợi ý"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Row 6: Structure Pattern & Explanation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1 border-t border-indigo-100">
        <div>
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
            Công thức / Cấu trúc ngữ pháp
          </label>
          <input
            type="text"
            value={meta.structurePattern || ''}
            onChange={(e) => updateMeta({structurePattern: e.target.value})}
            placeholder="VD: Although + S + V ↔ Despite + N-phrase"
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
            Ghi chú ôn tập ngữ pháp
          </label>
          <input
            type="text"
            value={meta.grammarReviewNote || ''}
            onChange={(e) => updateMeta({grammarReviewNote: e.target.value})}
            placeholder="VD: Unit 9 · Nhượng bộ Although / Despite"
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
          />
        </div>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
          Giải thích chi tiết (Explanation)
        </label>
        <textarea
          rows={2}
          value={value.explanation}
          onChange={(e) => onChange({...value, explanation: e.target.value})}
          placeholder="Giải thích rõ vì sao chuyển đổi sang cấu trúc này và các lỗi học sinh hay mắc..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
        />
      </div>

      {/* Row 7: Grading Rules */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-indigo-100 text-xs text-slate-700">
        <span className="font-semibold text-slate-600">Quy tắc chấm điểm:</span>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={meta.gradingRules?.allowContractions !== false}
            onChange={(e) =>
              updateMeta({
                gradingRules: {...meta.gradingRules, allowContractions: e.target.checked},
              })
            }
          />
          Chấp nhận viết tắt (haven&apos;t ↔ have not)
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={meta.gradingRules?.acceptRemainingOnly !== false}
            onChange={(e) =>
              updateMeta({
                gradingRules: {...meta.gradingRules, acceptRemainingOnly: e.target.checked},
              })
            }
          />
          Chấp nhận chỉ gõ phần còn thiếu
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(meta.gradingRules?.caseSensitive)}
            onChange={(e) =>
              updateMeta({
                gradingRules: {...meta.gradingRules, caseSensitive: e.target.checked},
              })
            }
          />
          Phân biệt chữ hoa/thường
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(meta.gradingRules?.strictPunctuation)}
            onChange={(e) =>
              updateMeta({
                gradingRules: {...meta.gradingRules, strictPunctuation: e.target.checked},
              })
            }
          />
          Chặt chẽ dấu câu
        </label>
      </div>
    </div>
  );
};
