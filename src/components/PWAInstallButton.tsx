import React, {useState} from 'react';
import {CheckCircle2, Download, WifiOff, X} from 'lucide-react';
import {useOnlineStatus, usePWAInstall} from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{compact?: boolean}> = ({compact = false}) => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-4 h-4" />
        Đã cài ứng dụng
      </span>
    );
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 rounded-lg border font-medium transition-colors whitespace-nowrap shrink-0 ${
          compact
            ? 'border-sky-200 bg-sky-50 px-3 py-1.5 text-xs text-[#0F4C81] hover:bg-sky-100'
            : 'border-[#0F4C81] bg-[#0F4C81] px-4 py-2 text-sm text-white hover:bg-[#0B3A63]'
        }`}
      >
        <Download className="w-4 h-4" />
        Cài đặt ứng dụng
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                Cài đặt English Slide Studio (PWA)
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {isIOS ? (
              <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700">
                <li>Mở ứng dụng bằng trình duyệt <strong>Safari</strong>.</li>
                <li>Chạm biểu tượng <strong>Chia sẻ (Share)</strong> ở thanh công cụ.</li>
                <li>Chọn <strong>Thêm vào Màn hình chính (Add to Home Screen)</strong>.</li>
              </ol>
            ) : (
              <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700">
                <li>
                  Trên <strong>Windows / macOS</strong>, dùng <strong>Google Chrome</strong> hoặc <strong>Microsoft Edge</strong>.
                </li>
                <li>
                  Nhấn biểu tượng <strong>Cài đặt ứng dụng (Install)</strong> ở góc phải thanh địa chỉ, hoặc vào menu trình duyệt → <strong>Lưu và chia sẻ → Cài đặt English Slide Studio</strong>.
                </li>
                <li>
                  Sau khi cài đặt, ứng dụng mở như phần mềm độc lập và hoạt động offline với toàn bộ bài đã lưu trong IndexedDB.
                </li>
              </ol>
            )}
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full rounded-lg bg-[#0F4C81] py-2.5 text-sm font-semibold text-white hover:bg-[#0B3A63]"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-950 shadow-md">
      <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
      <span>
        Đang ngoại tuyến (Offline) — Mở bài, chỉnh sửa, trình chiếu &amp; ghi âm vẫn hoạt động; tính năng AI trực tuyến tạm ngưng.
      </span>
    </div>
  );
};
