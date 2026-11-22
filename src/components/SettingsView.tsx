import React, {useRef, useState} from 'react';
import {CheckCircle2, Database, Save, Upload} from 'lucide-react';
import type {AppSettings, Grade, LessonProject, SlideThemeId} from '../types/lesson';
import type {AIStatus} from '../services/aiService';
import {importLessonFromJsonFile} from '../services/storage';
import {PWAInstallButton} from './PWAInstallButton';

interface SettingsViewProps {
  settings: AppSettings;
  savedLessonsCount: number;
  aiStatus: AIStatus;
  onSaveSettings: (next: AppSettings) => Promise<void>;
  onLessonImported: (lesson: LessonProject) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  savedLessonsCount,
  aiStatus,
  onSaveSettings,
  onLessonImported,
}) => {
  const [form, setForm] = useState<AppSettings>(settings);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(form);
    setSavedNotice('Đã lưu cài đặt hệ thống vào IndexedDB.');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const lesson = await importLessonFromJsonFile(file);
      onLessonImported(lesson);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Không thể nhập tệp JSON dự án.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
          Cài đặt hệ thống &amp; Ứng dụng Offline
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Tùy chỉnh thông số giảng dạy mặc định, quản lý sao lưu dự án và cài đặt PWA trên máy tính.
        </p>
      </div>

      <form onSubmit={handleSave} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <h2 className="font-semibold text-base text-[#0F4C81]">Thông số mặc định cho giáo viên</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Tên giáo viên</label>
            <input
              type="text"
              value={form.teacherName}
              onChange={(e) => setForm({...form, teacherName: e.target.value})}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Đơn vị / Trường THPT</label>
            <input
              type="text"
              value={form.schoolName}
              onChange={(e) => setForm({...form, schoolName: e.target.value})}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Khối lớp mặc định</label>
            <select
              value={form.defaultGrade}
              onChange={(e) => setForm({...form, defaultGrade: Number(e.target.value) as Grade})}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value={10}>Lớp 10</option>
              <option value={11}>Lớp 11</option>
              <option value={12}>Lớp 12</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Giao diện trình chiếu</label>
            <select
              value={form.defaultTheme}
              onChange={(e) => setForm({...form, defaultTheme: e.target.value as SlideThemeId})}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="light_classroom">Sáng lớp học</option>
              <option value="projector_contrast">Máy chiếu tương phản cao</option>
              <option value="warm_paper">Giấy ấm dịu mắt</option>
              <option value="dark_theater">Trình chiếu tối</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              Tỷ lệ chữ trình chiếu ({Math.round(form.presenterFontScale * 100)}%)
            </label>
            <input
              type="range"
              min={0.85}
              max={1.35}
              step={0.05}
              value={form.presenterFontScale}
              onChange={(e) => setForm({...form, presenterFontScale: Number(e.target.value)})}
              className="w-full mt-2 accent-[#0284C7]"
            />
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.showTeacherNotesByDefault}
            onChange={(e) => setForm({...form, showTeacherNotesByDefault: e.target.checked})}
            className="accent-[#0284C7]"
          />
          Hiển thị sẵn khung Ghi chú giáo viên (Teacher Notes) khi bắt đầu trình chiếu
        </label>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B3A63]"
          >
            <Save className="w-4 h-4" />
            Lưu cài đặt
          </button>
          {savedNotice && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              {savedNotice}
            </span>
          )}
        </div>
      </form>

      {/* PWA & Offline Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-semibold text-base text-[#0F4C81]">
              Cài đặt ứng dụng độc lập (PWA) &amp; Hoạt động ngoại tuyến
            </h2>
            <p className="text-sm text-slate-600">
              Cài trên Windows hoặc macOS để mở nhanh từ Desktop/Start Menu và trình chiếu ổn định khi lớp học không có Wi-Fi.
            </p>
          </div>
          <PWAInstallButton />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200 text-sm">
          <div className="space-y-1">
            <div className="font-semibold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-[#0284C7]" />
              Dữ liệu cục bộ IndexedDB
            </div>
            <p className="text-xs text-slate-600">
              Hiện đang lưu <strong className="font-mono-tabular">{savedLessonsCount}</strong> bài giảng tự soạn/nhập cùng các bản ghi âm và bài viết học sinh trên trình duyệt này.
            </p>
          </div>

          <div className="space-y-1">
            <div className="font-semibold text-slate-900">Dịch vụ AI phía máy chủ</div>
            <p className="text-xs text-slate-600">
              {!aiStatus.online
                ? 'Đang ngoại tuyến — các tính năng AI trực tuyến tạm ngưng, toàn bộ chức năng cục bộ hoạt động bình thường.'
                : aiStatus.configured
                  ? 'Đã kết nối an toàn qua máy chủ (không yêu cầu giáo viên nhập API key).'
                  : 'Chưa kích hoạt dịch vụ AI trên máy chủ — hệ thống vận hành đầy đủ bằng bộ phân tích cấu trúc cục bộ.'}
            </p>
          </div>
        </div>
      </div>

      {/* Import JSON Project */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-base text-slate-900">Nhập dự án từ tệp JSON (.ess.json)</h2>
          <p className="text-sm text-slate-600">
            Mở lại bài giảng đã sao lưu hoặc nhận chia sẻ từ đồng nghiệp trong tổ Tiếng Anh.
          </p>
          {importError && <p className="text-xs text-rose-700 font-medium">{importError}</p>}
        </div>
        <div>
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json,.ess.json,application/json"
            onChange={handleImportJson}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            <Upload className="w-4 h-4" />
            Nhập tệp dự án (.json)
          </button>
        </div>
      </div>
    </div>
  );
};
