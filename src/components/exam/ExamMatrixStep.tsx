import React, {useRef, useState} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  ExamBlueprint,
  ExamDossier,
  ExamMatrixRow,
  ExamQuestionFormat,
  ExamSkillKey,
  MatrixTemplateMode,
} from '../../types/exam';
import {
  DEFAULT_EXPORT_OPTIONS,
  EXAM_FORMAT_LABELS,
  EXAM_SKILL_LABELS,
} from '../../types/exam';
import {
  generateBlueprintFromScope,
  getMatrixSummary,
  parseCustomMatrixFile,
  recalculateMatrixRow,
} from '../../services/examEngine';
import {downloadMatrixDocx, printMatrixOrSpecPdf} from '../../services/examExporters';

interface ExamMatrixStepProps {
  dossier: ExamDossier;
  onUpdateBlueprint: (next: ExamBlueprint, autoSyncSpec?: boolean) => void;
  onSyncAndGenerateExam: () => void;
  onNextStep: () => void;
}

const SKILLS: ExamSkillKey[] = ['listening', 'language', 'reading', 'writing', 'speaking'];
const FORMATS: ExamQuestionFormat[] = [
  'mcq',
  'true_false',
  'short_answer',
  'gap_fill',
  'matching',
  'ordering',
  'transformation',
  'essay',
  'speaking',
];

export const ExamMatrixStep: React.FC<ExamMatrixStepProps> = ({
  dossier,
  onUpdateBlueprint,
  onSyncAndGenerateExam,
  onNextStep,
}) => {
  const {blueprint, scope} = dossier;
  const summary = getMatrixSummary(blueprint);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const bi = blueprint.bilingualHeaders;
  const hasHigh = blueprint.includeHighApplication;

  const updateRow = (rowId: string, patch: Partial<ExamMatrixRow>) => {
    const nextRows = blueprint.rows.map((r) =>
      r.id === rowId
        ? recalculateMatrixRow({...r, ...patch}, hasHigh, blueprint.totalScoreTarget)
        : r,
    );
    onUpdateBlueprint({...blueprint, rows: nextRows}, true);
  };

  const addRow = () => {
    const nextOrder = blueprint.rows.length + 1;
    const newRow = recalculateMatrixRow(
      {
        id: `row-${Date.now()}-${nextOrder}`,
        order: nextOrder,
        skill: 'language',
        topic: `Tiếng Anh lớp ${scope.grade}`,
        testContent: 'Nội dung kiểm tra mới',
        knowledgeUnit: 'Đơn vị kiến thức trọng tâm',
        questionFormat: 'mcq',
        recognitionCount: 2,
        comprehensionCount: 2,
        applicationCount: 0,
        highApplicationCount: 0,
        questionCount: 4,
        scoringUnits: 4,
        points: 1.0,
        percentage: 10,
        learningOutcome: 'Nhập yêu cầu cần đạt cụ thể cho nội dung kiểm tra này.',
      },
      hasHigh,
      blueprint.totalScoreTarget,
    );
    onUpdateBlueprint({...blueprint, rows: [...blueprint.rows, newRow]}, true);
  };

  const deleteRow = (rowId: string) => {
    const filtered = blueprint.rows
      .filter((r) => r.id !== rowId)
      .map((r, idx) => ({...r, order: idx + 1}));
    onUpdateBlueprint({...blueprint, rows: filtered}, true);
  };

  const applyPreset = (mode: MatrixTemplateMode) => {
    const fresh = generateBlueprintFromScope(scope, mode);
    onUpdateBlueprint(
      {
        ...fresh,
        bilingualHeaders: blueprint.bilingualHeaders,
        includeHighApplication: blueprint.includeHighApplication,
      },
      true,
    );
  };

  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const {rows, warnings} = await parseCustomMatrixFile(file);
      if (rows.length > 0) {
        onUpdateBlueprint(
          {
            ...blueprint,
            templateMode: 'custom_uploaded',
            customTemplateFileName: file.name,
            rows,
          },
          true,
        );
      }
      setUploadMsg(warnings.join(' '));
    } catch (err) {
      setUploadMsg(err instanceof Error ? err.message : 'Không thể đọc tệp mẫu ma trận.');
    }
    e.target.value = '';
  };

  const scoreValid = Math.abs(summary.totalPoints - blueprint.totalScoreTarget) <= 0.01;
  const pctValid = Math.abs(summary.totalPercentage - 100) <= 0.2;

  return (
    <div className="space-y-5">
      {/* Toolbar & Presets */}
      <div className="rounded-[18px] border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-extrabold text-[#0F172A]">
              Bước 2: Ma trận đề kiểm tra (Công văn 7991/BGDĐT-GDTrH)
            </h2>
            <p className="text-[15px] text-[#475569] mt-0.5">
              Chỉnh sửa trực tiếp số câu từng mức độ và điểm số — hệ thống tự cộng tổng, cảnh báo sai lệch và đồng bộ 2 chiều với Bản đặc tả.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => downloadMatrixDocx(dossier, DEFAULT_EXPORT_OPTIONS)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-[#0F172A] hover:bg-slate-50"
            >
              <Download className="w-4 h-4 text-[#2563EB]" />
              Xuất Word
            </button>
            <button
              type="button"
              onClick={() => printMatrixOrSpecPdf(dossier, 'matrix')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-[#0F172A] hover:bg-slate-50"
            >
              <Printer className="w-4 h-4 text-[#2563EB]" />
              In / PDF ngang
            </button>
            <button
              type="button"
              onClick={onSyncAndGenerateExam}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1E40AF] px-4 py-2 text-sm font-bold text-white hover:opacity-95"
            >
              <RefreshCw className="w-4 h-4" />
              Đồng bộ Đặc tả &amp; Sinh đề
            </button>
          </div>
        </div>

        {/* Preset & Option Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#475569]">Mẫu ma trận:</span>
            <button
              type="button"
              onClick={() => applyPreset('cv_7991')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                blueprint.templateMode === 'cv_7991'
                  ? 'bg-[#2563EB] text-white border-[#2563EB]'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Chuẩn Công văn 7991
            </button>
            <button
              type="button"
              onClick={() => applyPreset('school_english')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                blueprint.templateMode === 'school_english'
                  ? 'bg-[#2563EB] text-white border-[#2563EB]'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Mẫu tổ Tiếng Anh
            </button>
            <button
              type="button"
              onClick={() => applyPreset('graduation_2025')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                blueprint.templateMode === 'graduation_2025'
                  ? 'bg-[#2563EB] text-white border-[#2563EB]'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Tốt nghiệp THPT 2025 (40 câu)
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-300 bg-slate-50 text-[#0F172A] hover:bg-slate-100"
            >
              <Upload className="w-4 h-4 text-[#2563EB]" />
              Tải mẫu Word/Excel của trường
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.docx"
              className="hidden"
              onChange={handleUploadTemplate}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-[#334155]">
              <input
                type="checkbox"
                checked={bi}
                onChange={(e) => onUpdateBlueprint({...blueprint, bilingualHeaders: e.target.checked}, false)}
                className="w-4 h-4 accent-[#2563EB]"
              />
              Tiêu đề song ngữ Việt – Anh
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-[#334155]">
              <input
                type="checkbox"
                checked={hasHigh}
                onChange={(e) => {
                  const inc = e.target.checked;
                  onUpdateBlueprint(
                    {
                      ...blueprint,
                      includeHighApplication: inc,
                      rows: blueprint.rows.map((r) =>
                        recalculateMatrixRow(r, inc, blueprint.totalScoreTarget),
                      ),
                    },
                    true,
                  );
                }}
                className="w-4 h-4 accent-[#2563EB]"
              />
              Thêm cột Vận dụng cao (khi mẫu trường yêu cầu)
            </label>
          </div>
        </div>

        {uploadMsg && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-900">
            {uploadMsg}
          </div>
        )}
      </div>

      {/* Live Score & Cognitive Ratio Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div
          className={`rounded-2xl border p-3.5 ${
            scoreValid && pctValid
              ? 'border-emerald-200 bg-emerald-50/70'
              : 'border-rose-300 bg-rose-50'
          }`}
        >
          <div className="text-xs font-semibold text-slate-600">Tổng điểm / Tỷ lệ</div>
          <div className="text-xl font-extrabold font-mono-tabular mt-0.5 flex items-center gap-1.5">
            {scoreValid && pctValid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            )}
            <span>
              {summary.totalPoints.toFixed(2)} đ ({summary.totalPercentage.toFixed(0)}%)
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
          <div className="text-xs font-semibold text-slate-600">Tổng số câu hỏi</div>
          <div className="text-xl font-extrabold font-mono-tabular text-[#0F172A] mt-0.5">
            {summary.totalQuestions} câu
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
          <div className="text-xs font-semibold text-slate-600">Nhận biết (NB)</div>
          <div className="text-xl font-extrabold font-mono-tabular text-[#2563EB] mt-0.5">
            {summary.recognition} câu ({summary.recognitionPct}%)
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
          <div className="text-xs font-semibold text-slate-600">Thông hiểu (TH)</div>
          <div className="text-xl font-extrabold font-mono-tabular text-[#0891B2] mt-0.5">
            {summary.comprehension} câu ({summary.comprehensionPct}%)
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
          <div className="text-xs font-semibold text-slate-600">Vận dụng {hasHigh ? '+ VDC' : '(VD)'}</div>
          <div className="text-xl font-extrabold font-mono-tabular text-[#EA580C] mt-0.5">
            {summary.application + summary.highApplication} câu ({(summary.applicationPct + summary.highApplicationPct).toFixed(1)}%)
          </div>
        </div>
      </div>

      {/* Horizontal-Scroll Safe Editable Matrix Table (No Clipping!) */}
      <div className="rounded-[18px] border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] border-collapse text-left text-[15px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wide">
                <th className="p-3 text-center w-12">{bi ? 'STT / No.' : 'STT'}</th>
                <th className="p-3 w-40">{bi ? 'Kỹ năng / Skill' : 'Kỹ năng / Chủ đề'}</th>
                <th className="p-3 w-56">{bi ? 'Nội dung kiểm tra / Content' : 'Nội dung kiểm tra'}</th>
                <th className="p-3 w-52">{bi ? 'Đơn vị kiến thức / Knowledge' : 'Đơn vị kiến thức'}</th>
                <th className="p-3 w-44">{bi ? 'Dạng câu hỏi / Format' : 'Dạng câu hỏi'}</th>
                <th className="p-3 text-center w-16">{bi ? 'NB / Rec' : 'NB'}</th>
                <th className="p-3 text-center w-16">{bi ? 'TH / Comp' : 'TH'}</th>
                <th className="p-3 text-center w-16">{bi ? 'VD / App' : 'VD'}</th>
                {hasHigh && <th className="p-3 text-center w-16">{bi ? 'VDC / High' : 'VDC'}</th>}
                <th className="p-3 text-center w-20">{bi ? 'Số câu' : 'Số câu'}</th>
                <th className="p-3 text-center w-24">{bi ? 'Điểm / Pts' : 'Điểm'}</th>
                <th className="p-3 text-center w-20">%</th>
                <th className="p-3 text-center w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {blueprint.rows.map((rawRow) => {
                const row = recalculateMatrixRow(rawRow, hasHigh, blueprint.totalScoreTarget);
                return (
                  <tr key={row.id} className="hover:bg-blue-50/30 align-top">
                    <td className="p-2.5 text-center font-bold text-slate-600 font-mono-tabular">
                      {row.order}
                    </td>
                    <td className="p-2.5 space-y-1.5">
                      <select
                        value={row.skill}
                        onChange={(e) => updateRow(row.id, {skill: e.target.value as ExamSkillKey})}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-semibold bg-white"
                      >
                        {SKILLS.map((sk) => (
                          <option key={sk} value={sk}>
                            {EXAM_SKILL_LABELS[sk].vi}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={row.topic}
                        onChange={(e) => updateRow(row.id, {topic: e.target.value})}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600"
                        placeholder="Chủ đề / Unit"
                      />
                    </td>
                    <td className="p-2.5">
                      <textarea
                        rows={2}
                        value={row.testContent}
                        onChange={(e) => updateRow(row.id, {testContent: e.target.value})}
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm leading-snug"
                      />
                    </td>
                    <td className="p-2.5">
                      <textarea
                        rows={2}
                        value={row.knowledgeUnit}
                        onChange={(e) => updateRow(row.id, {knowledgeUnit: e.target.value})}
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm leading-snug"
                      />
                    </td>
                    <td className="p-2.5">
                      <select
                        value={row.questionFormat}
                        onChange={(e) =>
                          updateRow(row.id, {questionFormat: e.target.value as ExamQuestionFormat})
                        }
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white"
                      >
                        {FORMATS.map((f) => (
                          <option key={f} value={f}>
                            {EXAM_FORMAT_LABELS[f].vi}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={row.recognitionCount}
                        onChange={(e) =>
                          updateRow(row.id, {recognitionCount: Number(e.target.value) || 0})
                        }
                        className="w-14 rounded-lg border border-slate-300 px-1.5 py-1.5 text-center text-sm font-bold font-mono-tabular"
                      />
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={row.comprehensionCount}
                        onChange={(e) =>
                          updateRow(row.id, {comprehensionCount: Number(e.target.value) || 0})
                        }
                        className="w-14 rounded-lg border border-slate-300 px-1.5 py-1.5 text-center text-sm font-bold font-mono-tabular"
                      />
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={row.applicationCount}
                        onChange={(e) =>
                          updateRow(row.id, {applicationCount: Number(e.target.value) || 0})
                        }
                        className="w-14 rounded-lg border border-slate-300 px-1.5 py-1.5 text-center text-sm font-bold font-mono-tabular"
                      />
                    </td>
                    {hasHigh && (
                      <td className="p-2.5 text-center">
                        <input
                          type="number"
                          min={0}
                          max={40}
                          value={row.highApplicationCount}
                          onChange={(e) =>
                            updateRow(row.id, {highApplicationCount: Number(e.target.value) || 0})
                          }
                          className="w-14 rounded-lg border border-slate-300 px-1.5 py-1.5 text-center text-sm font-bold font-mono-tabular"
                        />
                      </td>
                    )}
                    <td className="p-2.5 text-center font-extrabold font-mono-tabular text-[#0F172A]">
                      {row.questionCount}
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="number"
                        step={0.25}
                        min={0}
                        max={10}
                        value={row.points}
                        onChange={(e) => updateRow(row.id, {points: Number(e.target.value) || 0})}
                        className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm font-bold text-[#2563EB] font-mono-tabular"
                      />
                    </td>
                    <td className="p-2.5 text-center font-semibold font-mono-tabular text-slate-700">
                      {row.percentage.toFixed(1)}%
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => deleteRow(row.id)}
                        title="Xóa dòng ma trận"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50/70 border-t-2 border-blue-200 font-bold text-[#0F172A]">
                <td colSpan={5} className="p-3">
                  TỔNG CỘNG MA TRẬN ({blueprint.rows.length} dòng)
                </td>
                <td className="p-3 text-center font-mono-tabular">{summary.recognition}</td>
                <td className="p-3 text-center font-mono-tabular">{summary.comprehension}</td>
                <td className="p-3 text-center font-mono-tabular">{summary.application}</td>
                {hasHigh && (
                  <td className="p-3 text-center font-mono-tabular">{summary.highApplication}</td>
                )}
                <td className="p-3 text-center font-mono-tabular">{summary.totalQuestions}</td>
                <td
                  className={`p-3 text-center font-mono-tabular ${
                    scoreValid ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {summary.totalPoints.toFixed(2)}
                </td>
                <td
                  className={`p-3 text-center font-mono-tabular ${
                    pctValid ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {summary.totalPercentage.toFixed(1)}%
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-[#0F172A] hover:border-[#2563EB] hover:text-[#2563EB]"
          >
            <Plus className="w-4 h-4" />
            Thêm dòng ma trận
          </button>

          <button
            type="button"
            onClick={onNextStep}
            className="rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1E40AF]"
          >
            Xem &amp; chỉnh Bản đặc tả →
          </button>
        </div>
      </div>
    </div>
  );
};
