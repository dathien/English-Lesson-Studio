import React, {useEffect, useState} from 'react';
import {
  CheckCircle2,
  Download,
  HardDrive,
  Smartphone,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type {LabOfflinePackRecord} from '../../types/interactiveLab';
import {
  UNIT_LAB_BUNDLES,
  SIMULATION_MANIFEST,
} from '../../data/interactiveLab/SIMULATION_MANIFEST';
import {GRAMMAR_SIMULATIONS} from '../../data/interactiveLab/grammarSimulations';
import {PRONUNCIATION_SIMULATIONS} from '../../data/interactiveLab/pronunciationSimulations';
import {
  clearAllLabOfflinePacks,
  deleteLabOfflinePackFromDB,
  getAllLabOfflinePacks,
  saveLabOfflinePackToDB,
} from '../../services/storage';

interface LabOfflineManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const LabOfflineManagerModal: React.FC<LabOfflineManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [packs, setPacks] = useState<LabOfflinePackRecord[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pwaNotice, setPwaNotice] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<10 | 11 | 12>(10);

  const refreshPacks = async () => {
    const list = await getAllLabOfflinePacks();
    setPacks(list);
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshPacks();
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const totalBytes = packs.reduce((sum, p) => sum + p.estimatedBytes, 0);
  const cachedIds = new Set(packs.map((p) => p.id));

  const savePack = async (
    id: string,
    scopeType: LabOfflinePackRecord['scopeType'],
    labelVi: string,
    activityIds: string[],
    payload: unknown
  ) => {
    setBusyId(id);
    try {
      const payloadJson = JSON.stringify(payload);
      const estimatedBytes = new Blob([payloadJson]).size;
      const rec: LabOfflinePackRecord = {
        id,
        scopeType,
        labelVi,
        activityIds,
        estimatedBytes,
        cachedAt: Date.now(),
        payloadJson,
      };
      await saveLabOfflinePackToDB(rec);
      await refreshPacks();
    } finally {
      setBusyId(null);
    }
  };

  const handleDownloadGrade = async (grade: 10 | 11 | 12) => {
    const units = UNIT_LAB_BUNDLES.filter((u) => u.grade === grade);
    const actIds = SIMULATION_MANIFEST.filter((m) => m.grade === grade).map((m) => m.id);
    await savePack(`grade::${grade}`, 'grade', `Trọn bộ Lớp ${grade} (10 Units)`, actIds, units);
  };

  const handleDownloadGroup = async (group: 'grammar' | 'pronunciation') => {
    if (group === 'grammar') {
      await savePack(
        'group::grammar',
        'group',
        'Trọn bộ 20 Mô phỏng Ngữ pháp động (G01–G20)',
        GRAMMAR_SIMULATIONS.map((g) => g.id),
        GRAMMAR_SIMULATIONS
      );
    } else {
      await savePack(
        'group::pronunciation',
        'group',
        'Trọn bộ 12 Phòng thí nghiệm Phát âm 2D/3D (P01–P12)',
        PRONUNCIATION_SIMULATIONS.map((p) => p.id),
        PRONUNCIATION_SIMULATIONS
      );
    }
  };

  const handleDownloadUnit = async (unitId: string) => {
    const unit = UNIT_LAB_BUNDLES.find((u) => u.unitId === unitId);
    if (!unit) return;
    const actIds = [unit.sim2DId, ...(unit.sim3DId ? [unit.sim3DId] : []), unit.rolePlayId];
    await savePack(
      `unit::${unit.unitId}`,
      'unit',
      `Lớp ${unit.grade} · Unit ${unit.unitNumber}: ${unit.titleEn}`,
      actIds,
      unit
    );
  };

  const handleDeletePack = async (id: string) => {
    await deleteLabOfflinePackFromDB(id);
    await refreshPacks();
  };

  const handleClearAll = async () => {
    await clearAllLabOfflinePacks();
    await refreshPacks();
  };

  const handleTriggerPwaInstall = () => {
    setPwaNotice(
      'Toàn bộ 115 học liệu Interactive Lab đã được tích hợp cục bộ trong ứng dụng và lưu đệm IndexedDB. Để cài ra màn hình chính (PWA), hãy chọn biểu tượng "Cài đặt ứng dụng / Add to Home Screen" trên thanh địa chỉ trình duyệt Chrome/Edge/Safari.'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
      <div className="w-full max-w-3xl max-h-[88vh] rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Quản lý Học liệu Offline & Cài đặt Ứng dụng
              </h3>
              <p className="text-xs text-slate-500">
                Lưu sẵn gói dữ liệu vào bộ nhớ IndexedDB trên máy để giảng dạy ổn định khi lớp học mất mạng.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Status + PWA Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3.5">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                  isOnline
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                {isOnline ? 'Đang trực tuyến' : 'Đang ngoại tuyến (Offline)'}
              </span>
              <span className="text-xs text-slate-700">
                Đã lưu cục bộ: <strong>{packs.length} gói</strong> ({formatBytes(totalBytes)})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTriggerPwaInstall}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Cài app dùng offline
              </button>
              {packs.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold hover:bg-rose-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa bộ nhớ đệm
                </button>
              )}
            </div>
          </div>

          {pwaNotice && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
              {pwaNotice}
            </div>
          )}

          {/* Quick Grade & Group Packs */}
          <div className="space-y-2">
            <div className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
              Tải nhanh theo khối lớp & chuyên đề
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {([10, 11, 12] as const).map((g) => {
                const key = `grade::${g}`;
                const saved = cachedIds.has(key);
                return (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">Trọn bộ Lớp {g}</div>
                      <div className="text-[11px] text-slate-500">10 Units · 150 từ · 4 kỹ năng</div>
                    </div>
                    {saved ? (
                      <button
                        type="button"
                        onClick={() => handleDeletePack(key)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold"
                        title="Bấm để gỡ khỏi bộ nhớ đệm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Đã lưu
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === key}
                        onClick={() => handleDownloadGrade(g)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-blue-600"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Lưu máy
                      </button>
                    )}
                  </div>
                );
              })}

              {(
                [
                  {key: 'group::grammar', group: 'grammar', title: '20 Ngữ pháp động', sub: 'G01–G20 · 100 bài tập'},
                  {key: 'group::pronunciation', group: 'pronunciation', title: '12 Phát âm 2D/3D', sub: 'P01–P12 · 12 cặp tối thiểu'},
                ] as const
              ).map((item) => {
                const saved = cachedIds.has(item.key);
                return (
                  <div
                    key={item.key}
                    className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">{item.title}</div>
                      <div className="text-[11px] text-slate-500">{item.sub}</div>
                    </div>
                    {saved ? (
                      <button
                        type="button"
                        onClick={() => handleDeletePack(item.key)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Đã lưu
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === item.key}
                        onClick={() => handleDownloadGroup(item.group)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-blue-600"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Lưu máy
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-Unit Pack Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                Lưu riêng lẻ từng Unit
              </span>
              <div className="flex gap-1">
                {([10, 11, 12] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGrade(g)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      selectedGrade === g
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Lớp {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {UNIT_LAB_BUNDLES.filter((u) => u.grade === selectedGrade).map((u) => {
                const key = `unit::${u.unitId}`;
                const saved = cachedIds.has(key);
                return (
                  <div
                    key={u.unitId}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        Unit {u.unitNumber}: {u.titleEn}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {u.sim3DId ? '2D + 3D + Role-Play' : '2D + Role-Play'} · {u.vocab.length} từ
                      </div>
                    </div>
                    {saved ? (
                      <button
                        type="button"
                        onClick={() => handleDeletePack(key)}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Offline
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === key}
                        onClick={() => handleDownloadUnit(u.unitId)}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 text-[11px] font-bold hover:border-blue-500 hover:text-blue-700"
                      >
                        <Download className="w-3 h-3" />
                        Tải Unit
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
