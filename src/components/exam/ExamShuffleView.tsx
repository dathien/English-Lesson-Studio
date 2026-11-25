import React, {useState} from 'react';
import {
  CheckCircle2,
  Download,
  Printer,
  ShieldAlert,
  ShieldCheck,
  Shuffle,
} from 'lucide-react';
import type {ExamDossier, ExamVersion, ShuffleOptions} from '../../types/exam';
import {DEFAULT_EXPORT_OPTIONS} from '../../types/exam';
import {hasDependentOptionText, shuffleExamVersions} from '../../services/examEngine';
import {
  downloadExamExcel,
  downloadStudentExamDocx,
  printStudentExamPdf,
} from '../../services/examExporters';

interface ExamShuffleViewProps {
  dossier: ExamDossier;
  onUpdateVersions: (versions: ExamVersion[]) => void;
}

export const ExamShuffleView: React.FC<ExamShuffleViewProps> = ({
  dossier,
  onUpdateVersions,
}) => {
  const [codesInput, setCodesInput] = useState(
    dossier.versions.length > 0
      ? dossier.versions.map((v) => v.code).join(', ')
      : '101, 102, 103, 104',
  );
  const [options, setOptions] = useState<ShuffleOptions>({
    shuffleStandaloneQuestions: true,
    shuffleOptions: true,
    shuffleCompatibleGroups: false,
  });

  const protectedGroups = dossier.exam.groups.filter((g) => g.protectOrder);
  const dependentOptQuestions = dossier.exam.questions.filter(
    (q) => q.protectOptionShuffle || hasDependentOptionText(q.options),
  );

  const handleGenerateVersions = () => {
    const codes = codesInput
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const versions = shuffleExamVersions(dossier, codes, options);
    onUpdateVersions(versions);
  };

  return (
    <div className="space-y-6">
      {/* Config Card */}
      <div className="rounded-[18px] border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-extrabold text-[#0F172A] flex items-center gap-2">
              <Shuffle className="w-6 h-6 text-[#2563EB]" />
              Trộn mã đề thông minh &amp; Kiểm tra tương đương độ khó
            </h2>
            <p className="text-[15px] text-[#475569] mt-0.5">
              Sinh đồng loạt nhiều mã đề (101, 102, 103, 104...) và tự động ánh xạ bảng đáp án từng mã. Hệ thống bảo vệ tuyệt đối câu hỏi chùm và phương án phụ thuộc.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateVersions}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1E40AF] px-5 py-2.5 text-[15px] font-bold text-white shadow-xs hover:opacity-95"
          >
            <Shuffle className="w-4 h-4" />
            Trộn và sinh các mã đề ngay
          </button>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-slate-100">
          <div className="lg:col-span-5">
            <label className="block text-sm font-bold text-[#334155] mb-1.5">
              Danh sách mã đề cần tạo (cách nhau bởi dấu phẩy)
            </label>
            <input
              type="text"
              value={codesInput}
              onChange={(e) => setCodesInput(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] font-mono-tabular font-semibold"
              placeholder="101, 102, 103, 104"
            />
          </div>
          <div className="lg:col-span-7 flex flex-wrap items-center gap-4 pt-2">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#334155] cursor-pointer">
              <input
                type="checkbox"
                checked={options.shuffleStandaloneQuestions}
                onChange={(e) =>
                  setOptions({...options, shuffleStandaloneQuestions: e.target.checked})
                }
                className="w-4 h-4 accent-[#2563EB]"
              />
              Đảo thứ tự câu độc lập
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#334155] cursor-pointer">
              <input
                type="checkbox"
                checked={options.shuffleOptions}
                onChange={(e) => setOptions({...options, shuffleOptions: e.target.checked})}
                className="w-4 h-4 accent-[#2563EB]"
              />
              Đảo phương án A–B–C–D
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#334155] cursor-pointer">
              <input
                type="checkbox"
                checked={options.shuffleCompatibleGroups}
                onChange={(e) =>
                  setOptions({...options, shuffleCompatibleGroups: e.target.checked})
                }
                className="w-4 h-4 accent-[#2563EB]"
              />
              Đảo vị trí nhóm bài độc lập
            </label>
          </div>
        </div>

        {/* Strict Protection Indicators */}
        <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-4 text-sm text-emerald-950 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Quy tắc bảo vệ tự động đang bật cho đề này:
          </div>
          <p>
            • Bảo vệ nguyên vẹn thứ tự <strong>{protectedGroups.length} nhóm câu hỏi chùm</strong> (Reading passages, Listening scripts, Notice/Leaflet Cloze, Ordering) — không tách rời câu hỏi khỏi ngữ liệu và không làm lệch số chỗ trống.
          </p>
          <p>
            • Bảo vệ phương án phụ thuộc (ví dụ "Both A and B", "All of the above"): hiện phát hiện <strong>{dependentOptQuestions.length}</strong> câu có phương án cố định.
          </p>
        </div>
      </div>

      {/* Generated Versions & Equivalence Verification */}
      {dossier.versions.length > 0 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dossier.versions.map((ver) => (
              <div
                key={ver.code}
                className="rounded-[18px] border border-slate-200 bg-white p-5 space-y-3 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-xl bg-[#2563EB] text-white px-3 py-1 font-mono-tabular font-extrabold text-[15px]">
                      Mã đề {ver.code}
                    </span>
                    {ver.equivalenceChecked ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Đạt tương đương 100%
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Cần kiểm tra lại
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        downloadStudentExamDocx(dossier, DEFAULT_EXPORT_OPTIONS, ver.code)
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-[#0F172A] hover:bg-slate-50"
                    >
                      <Download className="w-3.5 h-3.5 text-[#2563EB]" />
                      Word
                    </button>
                    <button
                      type="button"
                      onClick={() => printStudentExamPdf(dossier, ver.code)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-[#0F172A] hover:bg-slate-50"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#2563EB]" />
                      In/PDF
                    </button>
                  </div>
                </div>

                <ul className="text-xs text-[#475569] space-y-1">
                  {ver.equivalenceReport.map((line, idx) => (
                    <li key={idx}>• {line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Multi-Code Answer Key Comparison Table */}
          <div className="rounded-[18px] border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-[16px] text-[#0F172A]">
                Bảng đối chiếu đáp án theo từng mã đề
              </span>
              <button
                type="button"
                onClick={() => downloadExamExcel(dossier)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-700"
              >
                <Download className="w-4 h-4" />
                Xuất Excel đáp án các mã đề
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-center text-[15px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-xs font-bold uppercase text-slate-700">
                    <th className="p-2.5 w-20">Câu</th>
                    {dossier.versions.map((v) => (
                      <th key={v.code} className="p-2.5 font-mono-tabular">
                        Mã {v.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono-tabular">
                  {dossier.versions[0]?.answerKey.entries.map((_, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-blue-50/30">
                      <td className="p-2 font-bold text-slate-600">{rowIdx + 1}</td>
                      {dossier.versions.map((v) => (
                        <td key={v.code} className="p-2 font-bold text-[#0F172A] max-w-[200px] truncate">
                          {v.answerKey.entries[rowIdx]?.correctAnswer || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
