import React, {useState} from 'react';
import {
  Archive,
  CheckSquare,
  Download,
  FileSpreadsheet,
  FileText,
  MonitorPlay,
  Printer,
  Timer,
} from 'lucide-react';
import type {ExamDossier, ExportFormatOptions} from '../../types/exam';
import {DEFAULT_EXPORT_OPTIONS} from '../../types/exam';
import {
  downloadAnswerKeyDocx,
  downloadExamExcel,
  downloadFullExamZip,
  downloadMatrixDocx,
  downloadOmrSheetDocx,
  downloadSpecificationDocx,
  downloadStudentExamDocx,
  printMatrixOrSpecPdf,
  printStudentExamPdf,
} from '../../services/examExporters';
import {RenderFormattedText as FormattedText} from '../../utils/richText';

interface ExamPreviewExportStepProps {
  dossier: ExamDossier;
  onConvertAndPresent: (mode: 'by_group' | 'per_question') => void;
  onOpenTimedPractice: () => void;
}

export const ExamPreviewExportStep: React.FC<ExamPreviewExportStepProps> = ({
  dossier,
  onConvertAndPresent,
  onOpenTimedPractice,
}) => {
  const [opts, setOpts] = useState<ExportFormatOptions>({
    ...DEFAULT_EXPORT_OPTIONS,
    selectedCodes:
      dossier.versions.length > 0
        ? dossier.versions.map((v) => v.code)
        : [dossier.exam.header.examCode || '101'],
  });
  const [previewTab, setPreviewTab] = useState<'student' | 'answer' | 'omr'>('student');
  const [selectedCode, setSelectedCode] = useState<string>(
    dossier.versions[0]?.code || dossier.exam.header.examCode || '101',
  );
  const [exportingZip, setExportingZip] = useState(false);

  const activeVer = dossier.versions.find((v) => v.code === selectedCode);
  const activeGroups = activeVer ? activeVer.groups : dossier.exam.groups;
  const activeQuestions = activeVer ? activeVer.questions : dossier.exam.questions;
  const activeAnswerKey = activeVer ? activeVer.answerKey : dossier.answerKey;

  const handleZipExport = async () => {
    setExportingZip(true);
    try {
      await downloadFullExamZip(dossier, opts);
    } finally {
      setExportingZip(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1-Click Export & Presentation Hub */}
      <div className="rounded-[18px] border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-5 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-extrabold text-[#0F172A]">
              Bước 6: Xem trước chuẩn in A4, Xuất trọn bộ hồ sơ &amp; Trình chiếu tương tác
            </h2>
            <p className="text-[15px] text-[#475569] mt-0.5">
              Đề học sinh và Đáp án giáo viên được tách biệt hoàn toàn. Xuất từng tệp Word/PDF/Excel hoặc tải 1 tệp ZIP đầy đủ toàn bộ hồ sơ.
            </p>
          </div>
          <button
            type="button"
            disabled={exportingZip}
            onClick={handleZipExport}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1E40AF] px-5 py-3 text-[15px] font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-60 whitespace-nowrap"
          >
            <Archive className="w-5 h-5" />
            {exportingZip ? 'Đang đóng gói ZIP...' : 'Xuất trọn bộ hồ sơ (.ZIP)'}
          </button>
        </div>

        {/* Formatting Options */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-blue-100">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Phông chữ Word</label>
            <select
              value={opts.fontFamily}
              onChange={(e) =>
                setOpts({
                  ...opts,
                  fontFamily: e.target.value as ExportFormatOptions['fontFamily'],
                })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
            >
              <option value="Times New Roman">Times New Roman (Chuẩn văn bản)</option>
              <option value="Arial">Arial</option>
              <option value="Calibri">Calibri</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Cỡ chữ (pt)</label>
            <select
              value={opts.fontSizePt}
              onChange={(e) => setOpts({...opts, fontSizePt: Number(e.target.value) || 13})}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
            >
              <option value={12}>12 pt</option>
              <option value={13}>13 pt (Chuẩn đề thi)</option>
              <option value={14}>14 pt (Chữ lớn dễ đọc)</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={opts.matrixLandscape}
                onChange={(e) =>
                  setOpts({
                    ...opts,
                    matrixLandscape: e.target.checked,
                    specLandscape: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-[#2563EB]"
              />
              Ma trận &amp; Đặc tả khổ ngang (Landscape)
            </label>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={opts.includeOmrSheet}
                onChange={(e) => setOpts({...opts, includeOmrSheet: e.target.checked})}
                className="w-4 h-4 accent-[#2563EB]"
              />
              Kèm Phiếu trả lời trắc nghiệm
            </label>
          </div>
        </div>

        {/* Individual Download Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => downloadMatrixDocx(dossier, opts)}
            className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-[#0F172A] hover:border-[#2563EB] hover:bg-blue-50/40"
          >
            <FileText className="w-4 h-4 text-[#2563EB] shrink-0" />
            <span>1. Ma trận đề (.docx)</span>
          </button>
          <button
            type="button"
            onClick={() => downloadSpecificationDocx(dossier, opts)}
            className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-[#0F172A] hover:border-[#2563EB] hover:bg-blue-50/40"
          >
            <FileText className="w-4 h-4 text-[#2563EB] shrink-0" />
            <span>2. Bản đặc tả (.docx)</span>
          </button>
          <button
            type="button"
            onClick={() => downloadStudentExamDocx(dossier, opts, selectedCode)}
            className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-[#0F172A] hover:border-[#2563EB] hover:bg-blue-50/40"
          >
            <Download className="w-4 h-4 text-[#2563EB] shrink-0" />
            <span>3. Đề học sinh · Mã {selectedCode} (.docx)</span>
          </button>
          <button
            type="button"
            onClick={() => downloadAnswerKeyDocx(dossier, opts)}
            className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-[#0F172A] hover:border-emerald-500 hover:bg-emerald-50/40"
          >
            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>4. Đáp án + HDC + Transcript + Rubric (.docx)</span>
          </button>
          <button
            type="button"
            onClick={() => downloadExamExcel(dossier)}
            className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-[#0F172A] hover:border-emerald-500 hover:bg-emerald-50/40"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>5. Bảng Excel Ma trận &amp; Đáp án (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={() => downloadOmrSheetDocx(dossier, opts)}
            className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-[#0F172A] hover:border-[#2563EB] hover:bg-blue-50/40"
          >
            <FileText className="w-4 h-4 text-slate-600 shrink-0" />
            <span>6. Phiếu trả lời trắc nghiệm OMR (.docx)</span>
          </button>
        </div>

        {/* Direct Presentation & Timed Practice Integration (Section XV) */}
        <div className="pt-3 border-t border-blue-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-bold text-[#1E40AF]">
            Trình chiếu chữa đề &amp; Luyện tập trực tiếp (không cần nhập lại):
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onConvertAndPresent('by_group')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <MonitorPlay className="w-4 h-4" />
              Trình chiếu theo nhóm bài
            </button>
            <button
              type="button"
              onClick={() => onConvertAndPresent('per_question')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50"
            >
              <MonitorPlay className="w-4 h-4" />
              Trình chiếu từng câu (Chữa đề)
            </button>
            <button
              type="button"
              onClick={onOpenTimedPractice}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#F97316] px-4 py-2 text-sm font-bold text-white hover:bg-orange-600"
            >
              <Timer className="w-4 h-4" />
              Thi thử bấm giờ ({dossier.scope.durationMinutes} phút)
            </button>
          </div>
        </div>
      </div>

      {/* Print-Accurate Preview Area */}
      <div className="rounded-[18px] border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                {id: 'student', label: 'Bản in Đề học sinh (A4)'},
                {id: 'answer', label: 'Bản Đáp án giáo viên'},
                {id: 'omr', label: 'Phiếu tô trắc nghiệm OMR'},
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPreviewTab(t.id)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                  previewTab === t.id
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}

            {dossier.versions.length > 0 && (
              <select
                value={selectedCode}
                onChange={(e) => setSelectedCode(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold font-mono-tabular"
              >
                {dossier.versions.map((v) => (
                  <option key={v.code} value={v.code}>
                    Mã đề {v.code}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => printStudentExamPdf(dossier, selectedCode)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-[#0F172A] hover:bg-slate-100"
            >
              <Printer className="w-4 h-4 text-[#2563EB]" />
              In / Lưu PDF Đề
            </button>
            <button
              type="button"
              onClick={() => printMatrixOrSpecPdf(dossier, 'matrix')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              In Ma trận
            </button>
          </div>
        </div>

        {/* Simulated A4 Paper Preview */}
        <div className="p-6 sm:p-10 bg-slate-100/70">
          <div
            className="mx-auto max-w-[820px] bg-white border border-slate-300 shadow-md p-8 sm:p-12 text-[#0F172A] space-y-5"
            style={{fontFamily: '"Times New Roman", Times, serif', fontSize: `${opts.fontSizePt + 2}px`}}
          >
            {previewTab === 'student' && (
              <>
                <div className="grid grid-cols-2 gap-4 border-b-2 border-slate-800 pb-3 text-center leading-snug">
                  <div>
                    <div className="uppercase text-sm">
                      {dossier.exam.header.departmentName || 'SỞ GD&ĐT ...................................'}
                    </div>
                    <div className="uppercase font-bold text-sm">
                      {dossier.exam.header.schoolName || 'TRƯỜNG THPT .................................'}
                    </div>
                    <div className="mt-1 inline-block border border-slate-800 px-3 py-0.5 font-bold text-sm">
                      MÃ ĐỀ: {selectedCode}
                    </div>
                  </div>
                  <div>
                    <div className="uppercase font-bold">{dossier.exam.header.examTitle}</div>
                    <div className="font-bold text-sm">
                      NĂM HỌC {dossier.exam.header.academicYear} — MÔN: TIẾNG ANH ({dossier.exam.header.gradeLabel})
                    </div>
                    <div className="italic text-sm">
                      Thời gian làm bài: {dossier.exam.header.durationMinutes} phút (không kể thời gian phát đề)
                    </div>
                  </div>
                </div>

                <div className="text-sm">
                  Họ và tên thí sinh: ......................................................... Số báo danh: ....................... Lớp: ..........
                </div>

                {[...activeGroups]
                  .sort((a, b) => a.order - b.order)
                  .map((group) => {
                    const qs = activeQuestions
                      .filter((q) => q.groupId === group.id)
                      .sort((a, b) => a.number - b.number);
                    if (qs.length === 0) return null;
                    return (
                      <div key={group.id} className="space-y-2.5">
                        <div className="font-bold uppercase">{group.title}</div>
                        <div className="italic text-[0.95em]">
                          <FormattedText text={group.instruction} />
                        </div>
                        {group.stimulusParagraphs && group.stimulusParagraphs.length > 0 && (
                          <div className="border border-slate-300 bg-slate-50/70 p-4 space-y-2 text-justify">
                            {group.stimulusTitle && (
                              <div className="font-bold text-center">{group.stimulusTitle}</div>
                            )}
                            {group.stimulusParagraphs.map((p, idx) => (
                              <p key={idx}>
                                <FormattedText text={p} />
                              </p>
                            ))}
                          </div>
                        )}
                        <div className="space-y-2">
                          {qs.map((q) => (
                            <div key={q.id} className="space-y-1">
                              <div className="whitespace-pre-line">
                                <strong>Question {q.number}.</strong>{' '}
                                <FormattedText text={q.prompt} />
                              </div>
                              {q.options && q.options.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 pl-4">
                                  {q.options.map((o) => (
                                    <div key={o.id}>
                                      <strong>{o.label}.</strong> <FormattedText text={o.text} />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                <div className="text-center font-bold pt-4">——— HẾT ———</div>
              </>
            )}

            {previewTab === 'answer' && (
              <div className="space-y-4">
                <div className="text-center font-bold uppercase text-lg">
                  ĐÁP ÁN &amp; HƯỚNG DẪN CHẤM — MÃ ĐỀ {activeAnswerKey.examCode}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  {activeAnswerKey.entries.map((e) => (
                    <div key={e.questionId} className="border border-slate-300 px-2.5 py-1.5">
                      <strong>Câu {e.questionNumber}:</strong> <FormattedText text={e.correctAnswer} /> ({e.points}đ)
                    </div>
                  ))}
                </div>
              </div>
            )}

            {previewTab === 'omr' && (
              <div className="space-y-4">
                <div className="text-center font-bold uppercase text-lg">
                  PHIẾU TRẢ LỜI TRẮC NGHIỆM (MÃ ĐỀ {selectedCode})
                </div>
                <div className="text-sm">
                  Họ và tên: ................................................... Lớp: .......... SBD: ....................
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {activeQuestions
                    .filter((q) => q.options && q.options.length > 0)
                    .map((q) => (
                      <div
                        key={q.id}
                        className="flex items-center justify-between border-b border-slate-200 py-1 px-2"
                      >
                        <strong>Câu {q.number}</strong>
                        <div className="flex gap-3 font-sans">
                          {['A', 'B', 'C', 'D'].map((l) => (
                            <span
                              key={l}
                              className="w-6 h-6 rounded-full border border-slate-700 inline-flex items-center justify-center text-xs"
                            >
                              {l}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
