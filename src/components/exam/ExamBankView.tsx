import React, {useMemo, useRef, useState} from 'react';
import * as XLSX from 'xlsx';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  COGNITIVE_LABELS,
  type CognitiveLevel,
  type HighSchoolGrade,
} from '../../types/lesson';
import type {
  BankQuestionRecord,
  ExamQuestionFormat,
  ExamSkillKey,
  VerificationStatus,
} from '../../types/exam';
import {
  EXAM_FORMAT_LABELS,
  EXAM_SKILL_LABELS,
  VERIFICATION_STATUS_LABELS,
} from '../../types/exam';
import {GLOBAL_SUCCESS_UNITS} from '../../data/examCurriculum';
import {RenderFormattedText as FormattedText} from '../../utils/richText';

interface ExamBankViewProps {
  bankQuestions: BankQuestionRecord[];
  customIds: Set<string>;
  onSaveQuestion: (item: BankQuestionRecord) => Promise<void>;
  onBulkImportQuestions: (items: BankQuestionRecord[]) => Promise<void>;
  onDeleteQuestion: (id: string) => Promise<void>;
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
const LEVELS: CognitiveLevel[] = ['recognition', 'comprehension', 'application', 'high_application'];

function createEmptyBankQuestion(grade: HighSchoolGrade = 10): BankQuestionRecord {
  const now = Date.now();
  const unit = GLOBAL_SUCCESS_UNITS[grade][0];
  return {
    id: `bank-custom-${now}-${Math.random().toString(36).slice(2, 6)}`,
    grade,
    textbookId: 'global_success',
    unitId: unit?.id || `gs-${grade}-u1`,
    topic: unit ? `Unit ${unit.number}: ${unit.title}` : 'Chủ điểm tự chọn',
    skill: 'language',
    cognitiveLevel: 'recognition',
    questionType: 'mcq',
    format: 'mcq',
    prompt: '',
    options: [
      {id: 'a', label: 'A', text: ''},
      {id: 'b', label: 'B', text: ''},
      {id: 'c', label: 'C', text: ''},
      {id: 'd', label: 'D', text: ''},
    ],
    correctAnswer: 'A',
    acceptedAnswers: [],
    explanation: '',
    points: 0.25,
    sourceLabel: 'Giáo viên tự biên soạn',
    verificationStatus: 'teacher_authored',
    tags: ['GDPT 2018'],
    createdAt: now,
    updatedAt: now,
  };
}

export const ExamBankView: React.FC<ExamBankViewProps> = ({
  bankQuestions,
  customIds,
  onSaveQuestion,
  onBulkImportQuestions,
  onDeleteQuestion,
}) => {
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<HighSchoolGrade | 'all'>('all');
  const [skillFilter, setSkillFilter] = useState<ExamSkillKey | 'all'>('all');
  const [levelFilter, setLevelFilter] = useState<CognitiveLevel | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const [editingItem, setEditingItem] = useState<BankQuestionRecord | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const PAGE_SIZE = 20;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bankQuestions.filter((item) => {
      if (gradeFilter !== 'all' && item.grade !== gradeFilter) return false;
      if (skillFilter !== 'all' && item.skill !== skillFilter) return false;
      if (levelFilter !== 'all' && item.cognitiveLevel !== levelFilter) return false;
      if (statusFilter !== 'all' && item.verificationStatus !== statusFilter) return false;
      if (q) {
        const hay = `${item.prompt} ${item.topic} ${item.explanation} ${item.sourceLabel} ${item.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [bankQuestions, gradeFilter, skillFilter, levelFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const showNotice = (msg: string) => {
    setStatusNotice(msg);
    window.setTimeout(() => setStatusNotice((curr) => (curr === msg ? null : curr)), 3500);
  };

  const handleSaveEditor = async () => {
    if (!editingItem) return;
    if (!editingItem.prompt.trim()) {
      showNotice('Vui lòng nhập nội dung câu hỏi trước khi lưu.');
      return;
    }
    const cleaned: BankQuestionRecord = {
      ...editingItem,
      prompt: editingItem.prompt.trim(),
      correctAnswer: editingItem.correctAnswer.trim(),
      explanation: editingItem.explanation.trim(),
      updatedAt: Date.now(),
    };
    await onSaveQuestion(cleaned);
    setEditingItem(null);
    showNotice('Đã lưu câu hỏi vào Ngân hàng câu hỏi cục bộ (IndexedDB).');
  };

  const handleDuplicate = async (item: BankQuestionRecord) => {
    const now = Date.now();
    const copy: BankQuestionRecord = {
      ...structuredClone(item),
      id: `bank-copy-${now}-${Math.random().toString(36).slice(2, 6)}`,
      sourceLabel: `${item.sourceLabel} (Bản sao)`,
      verificationStatus: 'teacher_authored',
      createdAt: now,
      updatedAt: now,
    };
    await onSaveQuestion(copy);
    showNotice('Đã nhân bản câu hỏi vào kho cá nhân.');
  };

  const handleApproveAiItem = async (item: BankQuestionRecord) => {
    await onSaveQuestion({
      ...item,
      verificationStatus: 'approved',
      updatedAt: Date.now(),
    });
    showNotice('Đã xác nhận duyệt chuyên môn câu hỏi.');
  };

  const handleExportJson = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: 'english-lesson-studio-question-bank',
            exportedAt: new Date().toISOString(),
            count: filtered.length,
            questions: filtered,
          },
          null,
          2,
        ),
      ],
      {type: 'application/json'},
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ngan_Hang_Cau_Hoi_Tieng_Anh_THPT_${filtered.length}_cau.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportExcel = () => {
    const rows = filtered.map((q, idx) => ({
      STT: idx + 1,
      Lop: q.grade,
      ChuDe: q.topic,
      KyNang: EXAM_SKILL_LABELS[q.skill].vi,
      DangCau: EXAM_FORMAT_LABELS[q.format].vi,
      MucDo: COGNITIVE_LABELS[q.cognitiveLevel],
      NoiDung: q.prompt,
      PhuongAnA: q.options?.[0]?.text || '',
      PhuongAnB: q.options?.[1]?.text || '',
      PhuongAnC: q.options?.[2]?.text || '',
      PhuongAnD: q.options?.[3]?.text || '',
      DapAn: q.correctAnswer,
      Diem: q.points,
      GiaiThich: q.explanation,
      Nguon: q.sourceLabel,
      TrangThai: VERIFICATION_STATUS_LABELS[q.verificationStatus].label,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ngan hang cau hoi');
    const out = XLSX.write(wb, {bookType: 'xlsx', type: 'array'});
    const blob = new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ngan_Hang_Cau_Hoi_THPT_${filtered.length}_cau.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const lower = file.name.toLowerCase();
      const imported: BankQuestionRecord[] = [];
      const now = Date.now();

      if (lower.endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const rawList = Array.isArray(parsed) ? parsed : parsed?.questions;
        if (!Array.isArray(rawList)) {
          throw new Error('Tệp JSON không chứa mảng câu hỏi hợp lệ.');
        }
        for (let i = 0; i < rawList.length; i++) {
          const r = rawList[i];
          if (!r || typeof r.prompt !== 'string' || !r.prompt.trim()) continue;
          imported.push({
            ...createEmptyBankQuestion((r.grade === 11 || r.grade === 12 ? r.grade : 10)),
            ...r,
            id: `bank-imp-${now}-${i}`,
            createdAt: now,
            updatedAt: now,
          });
        }
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, {type: 'array'});
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
        rows.forEach((row, idx) => {
          const prompt = String(row.NoiDung || row.Prompt || row.CauHoi || '').trim();
          if (!prompt) return;
          const gradeNum = Number(row.Lop || row.Grade || 10);
          const grade: HighSchoolGrade = gradeNum === 11 ? 11 : gradeNum === 12 ? 12 : 10;
          const rawSkill = String(row.KyNang || row.Skill || 'language').toLowerCase();
          const skill: ExamSkillKey = rawSkill.includes('nghe') || rawSkill.includes('listen')
            ? 'listening'
            : rawSkill.includes('đọc') || rawSkill.includes('read')
              ? 'reading'
              : rawSkill.includes('viết') || rawSkill.includes('writ')
                ? 'writing'
                : rawSkill.includes('nói') || rawSkill.includes('speak')
                  ? 'speaking'
                  : 'language';
          const optA = String(row.PhuongAnA || row.A || '').trim();
          const optB = String(row.PhuongAnB || row.B || '').trim();
          const optC = String(row.PhuongAnC || row.C || '').trim();
          const optD = String(row.PhuongAnD || row.D || '').trim();
          const hasOpts = Boolean(optA || optB || optC || optD);
          imported.push({
            id: `bank-xlsx-${now}-${idx}`,
            grade,
            textbookId: 'global_success',
            unitId: `gs-${grade}-u1`,
            topic: String(row.ChuDe || row.Topic || `Chủ điểm Lớp ${grade}`),
            skill,
            cognitiveLevel: 'comprehension',
            questionType: hasOpts ? 'mcq' : 'short_answer',
            format: hasOpts ? 'mcq' : 'short_answer',
            prompt,
            options: hasOpts
              ? [
                  {id: 'a', label: 'A', text: optA},
                  {id: 'b', label: 'B', text: optB},
                  {id: 'c', label: 'C', text: optC},
                  {id: 'd', label: 'D', text: optD},
                ].filter((o) => o.text)
              : undefined,
            correctAnswer: String(row.DapAn || row.Answer || 'A').trim(),
            explanation: String(row.GiaiThich || row.Explanation || '').trim(),
            points: Number(row.Diem || 0.25) || 0.25,
            sourceLabel: String(row.Nguon || `Nhập từ ${file.name}`),
            verificationStatus: 'teacher_authored',
            tags: ['Nhập Excel'],
            createdAt: now,
            updatedAt: now,
          });
        });
      } else {
        throw new Error('Hỗ trợ nhập câu hỏi từ tệp .json, .xlsx, .xls hoặc .csv.');
      }

      if (imported.length === 0) {
        showNotice('Không tìm thấy câu hỏi hợp lệ trong tệp đã chọn.');
        return;
      }
      await onBulkImportQuestions(imported);
      showNotice(`Đã nhập thành công ${imported.length} câu hỏi vào Ngân hàng câu hỏi.`);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Không thể đọc tệp ngân hàng câu hỏi.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-[18px] border border-slate-200 bg-white p-5 flex flex-wrap items-start justify-between gap-4 shadow-xs">
        <div>
          <h2 className="font-display text-xl font-extrabold text-[#0F172A]">
            Ngân hàng câu hỏi Tiếng Anh THPT ({bankQuestions.length} câu)
          </h2>
          <p className="text-[15px] text-[#475569] mt-0.5">
            Quản lý tập trung theo lớp 10–11–12, kỹ năng, mức độ nhận thức và trạng thái kiểm duyệt. Lưu ngoại tuyến trên máy (IndexedDB).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEditingItem(createEmptyBankQuestion(gradeFilter === 'all' ? 10 : gradeFilter))}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1E40AF] px-4 py-2 text-sm font-bold text-white hover:opacity-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Thêm câu hỏi mới
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-[#0F172A] hover:bg-slate-50 whitespace-nowrap"
          >
            <Upload className="w-4 h-4 text-[#2563EB]" />
            Nhập JSON / Excel
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-[#0F172A] hover:bg-slate-50 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#10B981]" />
            Xuất Excel
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-[#0F172A] hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-slate-600" />
            Xuất JSON
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,.xlsx,.xls,.csv"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>

      {statusNotice && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-[#1E40AF] flex items-center justify-between gap-2">
          <span>{statusNotice}</span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="p-1 rounded-lg hover:bg-blue-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-[18px] border border-slate-200 bg-white p-4 grid grid-cols-1 md:grid-cols-12 gap-3 shadow-xs">
        <div className="md:col-span-4 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo từ khóa, chủ đề, đáp án, nguồn..."
            className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none"
          />
        </div>

        <select
          value={gradeFilter}
          onChange={(e) => {
            const v = e.target.value;
            setGradeFilter(v === 'all' ? 'all' : (Number(v) as HighSchoolGrade));
            setPage(1);
          }}
          className="md:col-span-2 rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          <option value="all">Tất cả khối lớp</option>
          <option value={10}>Lớp 10</option>
          <option value={11}>Lớp 11</option>
          <option value={12}>Lớp 12</option>
        </select>

        <select
          value={skillFilter}
          onChange={(e) => {
            setSkillFilter(e.target.value as ExamSkillKey | 'all');
            setPage(1);
          }}
          className="md:col-span-2 rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          <option value="all">Tất cả kỹ năng</option>
          {SKILLS.map((sk) => (
            <option key={sk} value={sk}>
              {EXAM_SKILL_LABELS[sk].vi}
            </option>
          ))}
        </select>

        <select
          value={levelFilter}
          onChange={(e) => {
            setLevelFilter(e.target.value as CognitiveLevel | 'all');
            setPage(1);
          }}
          className="md:col-span-2 rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          <option value="all">Tất cả mức độ</option>
          {LEVELS.map((lv) => (
            <option key={lv} value={lv}>
              {COGNITIVE_LABELS[lv]}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as VerificationStatus | 'all');
            setPage(1);
          }}
          className="md:col-span-2 rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          <option value="all">Mọi trạng thái</option>
          {(Object.keys(VERIFICATION_STATUS_LABELS) as VerificationStatus[]).map((st) => (
            <option key={st} value={st}>
              {VERIFICATION_STATUS_LABELS[st].label}
            </option>
          ))}
        </select>
      </div>

      {/* Results count */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#475569] px-1">
        <span>
          Hiển thị <strong className="text-[#0F172A]">{visibleItems.length}</strong> /{' '}
          <strong className="text-[#0F172A]">{filtered.length}</strong> câu hỏi phù hợp
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
            >
              Trước
            </button>
            <span className="text-xs font-mono-tabular px-2">
              Trang {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        )}
      </div>

      {/* Question Cards */}
      <div className="space-y-3">
        {visibleItems.map((item) => {
          const isCustom = customIds.has(item.id);
          const vMeta = VERIFICATION_STATUS_LABELS[item.verificationStatus];
          return (
            <article
              key={item.id}
              className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-xs hover:border-blue-300 transition-colors space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="text-[#2563EB]">Lớp {item.grade}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-[#0F172A]">{EXAM_SKILL_LABELS[item.skill].vi}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-600">{EXAM_FORMAT_LABELS[item.format].vi}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-indigo-700">{COGNITIVE_LABELS[item.cognitiveLevel]}</span>
                  <span className="text-slate-300">·</span>
                  <span className={`px-2 py-0.5 rounded-md border ${vMeta.colorClass}`}>
                    {vMeta.label}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.verificationStatus === 'ai_unverified' && (
                    <button
                      type="button"
                      onClick={() => handleApproveAiItem(item)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Duyệt
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingItem(structuredClone(item))}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-[#2563EB] hover:text-[#2563EB]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(item)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-[#2563EB] hover:text-[#2563EB]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Nhân bản
                  </button>
                  {isCustom && (
                    <button
                      type="button"
                      onClick={() => onDeleteQuestion(item.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa
                    </button>
                  )}
                </div>
              </div>

              <div className="text-[15px] font-medium text-[#0F172A] leading-relaxed">
                <FormattedText text={item.prompt} />
              </div>

              {item.options && item.options.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
                  {item.options.map((opt) => {
                    const isAns =
                      item.correctAnswer.trim().toUpperCase() === opt.label.trim().toUpperCase();
                    return (
                      <div
                        key={opt.id}
                        className={`rounded-lg px-2.5 py-1.5 border ${
                          isAns
                            ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950 font-semibold'
                            : 'border-slate-100 bg-slate-50/70 text-slate-700'
                        }`}
                      >
                        <span className="font-bold mr-1.5">{opt.label}.</span>
                        <FormattedText text={opt.text} />
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-[#475569]">
                <div>
                  <span className="font-bold text-emerald-700">Đáp án: {item.correctAnswer}</span>
                  {item.explanation && <span className="ml-2">— {item.explanation}</span>}
                </div>
                <span className="text-slate-500">
                  {item.topic} · {item.sourceLabel}
                </span>
              </div>
            </article>
          );
        })}

        {visibleItems.length === 0 && (
          <div className="rounded-[18px] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            Không tìm thấy câu hỏi nào khớp với bộ lọc hiện tại. Thử nới lỏng bộ lọc hoặc nhấn "Thêm câu hỏi mới".
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-extrabold text-[#0F172A]">
                {customIds.has(editingItem.id) ? 'Chỉnh sửa câu hỏi' : 'Thêm / Lưu bản sao câu hỏi'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-xs font-semibold text-slate-700 space-y-1">
                <span>Khối lớp</span>
                <select
                  value={editingItem.grade}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      grade: Number(e.target.value) as HighSchoolGrade,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value={10}>Lớp 10</option>
                  <option value={11}>Lớp 11</option>
                  <option value={12}>Lớp 12</option>
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-700 space-y-1">
                <span>Kỹ năng</span>
                <select
                  value={editingItem.skill}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      skill: e.target.value as ExamSkillKey,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  {SKILLS.map((sk) => (
                    <option key={sk} value={sk}>
                      {EXAM_SKILL_LABELS[sk].vi}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-700 space-y-1">
                <span>Mức độ nhận thức</span>
                <select
                  value={editingItem.cognitiveLevel}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      cognitiveLevel: e.target.value as CognitiveLevel,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  {LEVELS.map((lv) => (
                    <option key={lv} value={lv}>
                      {COGNITIVE_LABELS[lv]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-xs font-semibold text-slate-700 space-y-1">
                <span>Dạng câu hỏi</span>
                <select
                  value={editingItem.format}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      format: e.target.value as ExamQuestionFormat,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  {FORMATS.map((fmt) => (
                    <option key={fmt} value={fmt}>
                      {EXAM_FORMAT_LABELS[fmt].vi}
                    </option>
                  ))}
                </select>
              </label>

              <label className="sm:col-span-2 text-xs font-semibold text-slate-700 space-y-1">
                <span>Chủ đề / Unit</span>
                <input
                  type="text"
                  value={editingItem.topic}
                  onChange={(e) => setEditingItem({...editingItem, topic: e.target.value})}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="block text-xs font-semibold text-slate-700 space-y-1">
              <span>Nội dung câu hỏi (hỗ trợ thẻ &lt;u&gt;gạch chân&lt;/u&gt; cho phát âm)</span>
              <textarea
                rows={3}
                value={editingItem.prompt}
                onChange={(e) => setEditingItem({...editingItem, prompt: e.target.value})}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            {(editingItem.format === 'mcq' ||
              editingItem.format === 'true_false' ||
              editingItem.format === 'ordering') && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">Các phương án lựa chọn</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(editingItem.options || [
                    {id: 'a', label: 'A', text: ''},
                    {id: 'b', label: 'B', text: ''},
                    {id: 'c', label: 'C', text: ''},
                    {id: 'd', label: 'D', text: ''},
                  ]).map((opt, idx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <span className="w-6 text-center text-xs font-bold text-[#2563EB]">
                        {opt.label}
                      </span>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const nextOpts = [...(editingItem.options || [])];
                          nextOpts[idx] = {...opt, text: e.target.value};
                          setEditingItem({...editingItem, options: nextOpts});
                        }}
                        className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-xs font-semibold text-slate-700 space-y-1">
                <span>Đáp án đúng</span>
                <input
                  type="text"
                  value={editingItem.correctAnswer}
                  onChange={(e) => setEditingItem({...editingItem, correctAnswer: e.target.value})}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
                />
              </label>

              <label className="text-xs font-semibold text-slate-700 space-y-1">
                <span>Điểm câu hỏi</span>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="10"
                  value={editingItem.points}
                  onChange={(e) =>
                    setEditingItem({...editingItem, points: Number(e.target.value) || 0.25})
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono-tabular"
                />
              </label>

              <label className="text-xs font-semibold text-slate-700 space-y-1">
                <span>Trạng thái xác minh</span>
                <select
                  value={editingItem.verificationStatus}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      verificationStatus: e.target.value as VerificationStatus,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  {(Object.keys(VERIFICATION_STATUS_LABELS) as VerificationStatus[]).map((st) => (
                    <option key={st} value={st}>
                      {VERIFICATION_STATUS_LABELS[st].label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block text-xs font-semibold text-slate-700 space-y-1">
              <span>Giải thích đáp án chi tiết</span>
              <textarea
                rows={2}
                value={editingItem.explanation}
                onChange={(e) => setEditingItem({...editingItem, explanation: e.target.value})}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEditor}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-[#1E40AF]"
              >
                <Check className="w-4 h-4" />
                Lưu vào Ngân hàng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
