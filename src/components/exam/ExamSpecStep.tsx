import React from 'react';
import {ArrowLeftRight, Download, Printer, RefreshCw} from 'lucide-react';
import {COGNITIVE_LABELS} from '../../types/lesson';
import type {ExamDossier, Specification, SpecificationRow} from '../../types/exam';
import {
  DEFAULT_EXPORT_OPTIONS,
  EXAM_FORMAT_LABELS,
  EXAM_SKILL_LABELS,
} from '../../types/exam';
import {downloadSpecificationDocx, printMatrixOrSpecPdf} from '../../services/examExporters';
import {CompactAnswerEditor} from '../editor/CompactAnswerEditor';

interface ExamSpecStepProps {
  dossier: ExamDossier;
  onUpdateSpecification: (next: Specification, syncBackToMatrix?: boolean) => void;
  onResyncFromMatrix: () => void;
  onNextStep: () => void;
}

export const ExamSpecStep: React.FC<ExamSpecStepProps> = ({
  dossier,
  onUpdateSpecification,
  onResyncFromMatrix,
  onNextStep,
}) => {
  const {specification} = dossier;

  const updateSpecRow = (id: string, patch: Partial<SpecificationRow>, syncMatrix = false) => {
    const nextRows = specification.rows.map((r) => (r.id === id ? {...r, ...patch} : r));
    onUpdateSpecification({...specification, rows: nextRows, updatedAt: Date.now()}, syncMatrix);
  };

  const totalQs = specification.rows.reduce((s, r) => s + r.questionCount, 0);
  const totalPts = specification.rows.reduce((s, r) => s + r.points, 0);

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="rounded-[18px] border border-slate-200 bg-white p-5 flex flex-wrap items-start justify-between gap-4 shadow-xs">
        <div>
          <h2 className="font-display text-xl font-extrabold text-[#0F172A]">
            Bước 3: Bản đặc tả đề kiểm tra (Đồng bộ 2 chiều với Ma trận)
          </h2>
          <p className="text-[15px] text-[#475569] mt-0.5">
            Mô tả cụ thể Yêu cầu cần đạt, Biểu hiện cần đánh giá và Vị trí câu hỏi cho từng mức độ nhận thức. Chỉnh sửa số câu/điểm sẽ cập nhật ngược về Ma trận.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onResyncFromMatrix}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-bold text-[#2563EB] hover:bg-blue-100"
          >
            <RefreshCw className="w-4 h-4" />
            Đồng bộ lại từ Ma trận
          </button>
          <button
            type="button"
            onClick={() => downloadSpecificationDocx(dossier, DEFAULT_EXPORT_OPTIONS)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-[#0F172A] hover:bg-slate-50"
          >
            <Download className="w-4 h-4 text-[#2563EB]" />
            Xuất Word
          </button>
          <button
            type="button"
            onClick={() => printMatrixOrSpecPdf(dossier, 'spec')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-[#0F172A] hover:bg-slate-50"
          >
            <Printer className="w-4 h-4 text-[#2563EB]" />
            In / PDF ngang
          </button>
        </div>
      </div>

      {/* Horizontal-scroll Safe Table */}
      <div className="rounded-[18px] border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1220px] border-collapse text-left text-[15px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wide">
                <th className="p-3 text-center w-12">STT</th>
                <th className="p-3 w-36">Kỹ năng / Chủ đề</th>
                <th className="p-3 w-52">Nội dung kiến thức</th>
                <th className="p-3 w-64">Yêu cầu cần đạt</th>
                <th className="p-3 w-72">Biểu hiện cần đánh giá (cụ thể)</th>
                <th className="p-3 w-36">Dạng câu hỏi</th>
                <th className="p-3 text-center w-28">Mức độ</th>
                <th className="p-3 text-center w-20">Số câu</th>
                <th className="p-3 text-center w-28">Vị trí câu</th>
                <th className="p-3 text-center w-24">Điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {specification.rows.map((sr) => (
                <tr key={sr.id} className="hover:bg-blue-50/25 align-top">
                  <td className="p-2.5 text-center font-bold text-slate-600 font-mono-tabular">
                    {sr.order}
                  </td>
                  <td className="p-2.5">
                    <div className="font-bold text-[#0F172A] text-sm">
                      {EXAM_SKILL_LABELS[sr.skill].vi}
                    </div>
                    <div className="text-xs text-[#475569] mt-0.5 line-clamp-2">{sr.topic}</div>
                  </td>
                  <td className="p-2.5">
                    <CompactAnswerEditor
                      value={sr.knowledgeContent}
                      onChange={(nextHtml) => updateSpecRow(sr.id, {knowledgeContent: nextHtml})}
                      placeholder="Nội dung kiến thức..."
                      spellCheckLang="vi"
                    />
                  </td>
                  <td className="p-2.5">
                    <CompactAnswerEditor
                      value={sr.learningOutcome}
                      onChange={(nextHtml) =>
                        updateSpecRow(sr.id, {learningOutcome: nextHtml}, true)
                      }
                      placeholder="Yêu cầu cần đạt..."
                      spellCheckLang="vi"
                    />
                  </td>
                  <td className="p-2.5">
                    <CompactAnswerEditor
                      value={sr.assessmentDescriptor}
                      onChange={(nextHtml) =>
                        updateSpecRow(sr.id, {assessmentDescriptor: nextHtml})
                      }
                      placeholder="Biểu hiện cần đánh giá..."
                      spellCheckLang="vi"
                    />
                  </td>
                  <td className="p-2.5 text-sm text-slate-700 font-medium">
                    {EXAM_FORMAT_LABELS[sr.questionFormat].vi}
                  </td>
                  <td className="p-2.5 text-center">
                    <span className="inline-block rounded-lg bg-blue-50 text-[#1E40AF] px-2.5 py-1 text-xs font-bold">
                      {COGNITIVE_LABELS[sr.cognitiveLevel]}
                    </span>
                  </td>
                  <td className="p-2.5 text-center">
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={sr.questionCount}
                      onChange={(e) =>
                        updateSpecRow(
                          sr.id,
                          {questionCount: Math.max(0, Number(e.target.value) || 0)},
                          true,
                        )
                      }
                      className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm font-bold font-mono-tabular"
                    />
                  </td>
                  <td className="p-2.5 text-center">
                    <input
                      type="text"
                      value={sr.questionPositions}
                      onChange={(e) => updateSpecRow(sr.id, {questionPositions: e.target.value})}
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm font-mono-tabular"
                    />
                  </td>
                  <td className="p-2.5 text-center">
                    <input
                      type="number"
                      step={0.25}
                      min={0}
                      max={10}
                      value={sr.points}
                      onChange={(e) =>
                        updateSpecRow(
                          sr.id,
                          {points: Math.max(0, Number(e.target.value) || 0)},
                          true,
                        )
                      }
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm font-bold text-[#2563EB] font-mono-tabular"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50/70 border-t-2 border-blue-200 font-bold text-[#0F172A]">
                <td colSpan={7} className="p-3">
                  <span className="inline-flex items-center gap-1.5">
                    <ArrowLeftRight className="w-4 h-4 text-[#2563EB]" />
                    TỔNG CỘNG BẢN ĐẶC TẢ ({specification.rows.length} tiêu chí đặc tả)
                  </span>
                </td>
                <td className="p-3 text-center font-mono-tabular">{totalQs} câu</td>
                <td className="p-3 text-center font-mono-tabular">Câu 1–{totalQs}</td>
                <td className="p-3 text-center font-mono-tabular text-[#2563EB]">
                  {totalPts.toFixed(2)} đ
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onNextStep}
            className="rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1E40AF]"
          >
            Tiếp tục sang Soạn thảo đề →
          </button>
        </div>
      </div>
    </div>
  );
};
