import React, {useRef, useState} from 'react';
import {
  Archive,
  Clock,
  Copy,
  Download,
  Edit3,
  FilePlus2,
  FolderOpen,
  MonitorPlay,
  Search,
  Timer,
  Trash2,
  Upload,
} from 'lucide-react';
import type {ExamDossier} from '../../types/exam';
import {DEFAULT_EXPORT_OPTIONS, EXAM_STATUS_LABELS} from '../../types/exam';
import {
  exportExamDossierAsJson,
  importExamDossierFromJsonFile,
} from '../../services/storage';
import {downloadFullExamZip} from '../../services/examExporters';

interface ExamHistoryViewProps {
  dossiers: ExamDossier[];
  activeDossierId: string;
  onOpenDossier: (dossier: ExamDossier) => void;
  onDuplicateDossier: (dossier: ExamDossier) => Promise<void>;
  onDeleteDossier: (id: string) => Promise<void>;
  onImportDossier: (dossier: ExamDossier) => void;
  onCreateNew: () => void;
  onPresentDossier: (dossier: ExamDossier) => void;
  onPracticeDossier: (dossier: ExamDossier) => void;
}

export const ExamHistoryView: React.FC<ExamHistoryViewProps> = ({
  dossiers,
  activeDossierId,
  onOpenDossier,
  onDuplicateDossier,
  onDeleteDossier,
  onImportDossier,
  onCreateNew,
  onPresentDossier,
  onPracticeDossier,
}) => {
  const [query, setQuery] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [zippingId, setZippingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = dossiers.filter((d) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${d.title} ${d.exam.header.examTitle} lớp ${d.scope.grade}`.toLowerCase().includes(q);
  });

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const imported = await importExamDossierFromJsonFile(file);
      onImportDossier(imported);
      setImportMsg(`Đã nhập thành công hồ sơ "${imported.title}".`);
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : 'Không thể đọc tệp .exam.json.');
    }
  };

  const handleZip = async (d: ExamDossier) => {
    setZippingId(d.id);
    try {
      await downloadFullExamZip(d, {
        ...DEFAULT_EXPORT_OPTIONS,
        selectedCodes:
          d.versions.length > 0
            ? d.versions.map((v) => v.code)
            : [d.exam.header.examCode || '101'],
      });
    } finally {
      setZippingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[18px] border border-slate-200 bg-white p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="font-display text-xl font-extrabold text-[#0F172A]">
            Lịch sử hồ sơ đề đã tạo ({dossiers.length})
          </h2>
          <p className="text-[15px] text-[#475569] mt-0.5">
            Toàn bộ ma trận, bản đặc tả, đề, mã đề, đáp án và âm thanh đính kèm được lưu bền vững trên trình duyệt (IndexedDB) và sao lưu dưới dạng tệp .exam.json.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1E40AF] px-4 py-2 text-sm font-bold text-white hover:opacity-95 whitespace-nowrap"
          >
            <FilePlus2 className="w-4 h-4" />
            Tạo bộ đề mới
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-[#0F172A] hover:bg-slate-50 whitespace-nowrap"
          >
            <Upload className="w-4 h-4 text-[#2563EB]" />
            Mở tệp .exam.json
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.exam.json"
            onChange={handleImportJson}
            className="hidden"
          />
        </div>
      </div>

      {importMsg && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-[#1E40AF]">
          {importMsg}
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên đề, lớp..."
          className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-slate-300 bg-white p-10 text-center space-y-3">
          <FolderOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-base font-bold text-[#0F172A]">
            Chưa có hồ sơ đề kiểm tra nào được lưu trên máy.
          </p>
          <p className="text-sm text-[#475569] max-w-md mx-auto">
            Tạo bộ đề mới ở mục "Tạo bộ đề kiểm tra", nhấn "Lưu hồ sơ" hoặc nhân bản một bộ đề mẫu từ "Kho đề tham khảo".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((d) => {
            const st = EXAM_STATUS_LABELS[d.status];
            const isActive = d.id === activeDossierId;
            return (
              <article
                key={d.id}
                className={`rounded-[18px] border bg-white p-5 shadow-xs flex flex-col justify-between gap-4 ${
                  isActive ? 'border-[#2563EB] ring-2 ring-blue-100' : 'border-slate-200'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[#2563EB]">
                      Lớp {d.scope.grade} · {d.scope.durationMinutes} phút ·{' '}
                      {d.exam.questions.length} câu
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border font-semibold ${st.colorClass}`}>
                      {st.label}
                    </span>
                  </div>

                  <h3 className="font-display text-[17px] font-extrabold text-[#0F172A] leading-snug">
                    {d.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Cập nhật: {new Date(d.updatedAt).toLocaleString('vi-VN')}
                    </span>
                    {d.versions.length > 0 && (
                      <span className="font-semibold text-indigo-700">
                        {d.versions.length} mã đề đã trộn
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onOpenDossier(d)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] px-3 py-2 text-xs font-bold text-white hover:bg-[#1E40AF] whitespace-nowrap"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Mở chỉnh sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => onPresentDossier(d)}
                    className="inline-flex items-center gap-1 rounded-xl border border-cyan-300 bg-cyan-50 px-2.5 py-2 text-xs font-semibold text-cyan-900 hover:bg-cyan-100"
                    title="Chuyển thành bài trình chiếu"
                  >
                    <MonitorPlay className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onPracticeDossier(d)}
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                    title="Làm bài thử tính giờ"
                  >
                    <Timer className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicateDossier(d)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    title="Nhân bản hồ sơ"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => exportExamDossierAsJson(d)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    title="Sao lưu .exam.json"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={zippingId === d.id}
                    onClick={() => handleZip(d)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    title="Xuất trọn bộ ZIP"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDossier(d.id)}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    title="Xóa hồ sơ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
