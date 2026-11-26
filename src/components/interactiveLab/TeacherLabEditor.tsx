import React, {useEffect, useState} from 'react';
import {
  Check,
  Copy,
  Eye,
  FileAudio,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import type {
  InteractiveObject,
  LabCategory,
  TeacherCustomization,
} from '../../types/interactiveLab';
import {RichTextEditor} from '../editor/RichTextEditor';
import {stripHtmlToPlainText} from '../../services/documentExportAdapter';
import {
  deleteLabCustomizationFromDB,
  saveLabCustomizationToDB,
} from '../../services/storage';

interface TeacherLabEditorProps {
  targetId: string;
  category: LabCategory;
  defaultTitle: string;
  defaultInstruction: string;
  defaultObjects?: InteractiveObject[];
  defaultTranscript?: string;
  defaultSpeakingPrompt?: string;
  defaultWritingPrompt?: string;
  existingCustomization?: TeacherCustomization | null;
  onSaved: (next: TeacherCustomization | null) => void;
  onClose?: () => void;
}

export const TeacherLabEditor: React.FC<TeacherLabEditorProps> = ({
  targetId,
  category,
  defaultTitle,
  defaultInstruction,
  defaultObjects = [],
  defaultTranscript = '',
  defaultSpeakingPrompt = '',
  defaultWritingPrompt = '',
  existingCustomization,
  onSaved,
  onClose,
}) => {
  const [title, setTitle] = useState(existingCustomization?.customTitle ?? defaultTitle);
  const [instructionHtml, setInstructionHtml] = useState(
    existingCustomization?.customInstruction ?? defaultInstruction
  );
  const [transcriptHtml, setTranscriptHtml] = useState(
    existingCustomization?.customTranscript ?? defaultTranscript
  );
  const [speakingHtml, setSpeakingHtml] = useState(
    existingCustomization?.customSpeakingPrompt ?? defaultSpeakingPrompt
  );
  const [writingHtml, setWritingHtml] = useState(
    existingCustomization?.customWritingPrompt ?? defaultWritingPrompt
  );
  const [objectLabels, setObjectLabels] = useState<
    Record<string, {labelEn: string; labelVi: string; descriptionVi: string}>
  >(() => {
    const base: Record<string, {labelEn: string; labelVi: string; descriptionVi: string}> = {};
    for (const obj of defaultObjects) {
      const ov = existingCustomization?.customObjectLabels?.[obj.id];
      base[obj.id] = {
        labelEn: ov?.labelEn ?? obj.labelEn,
        labelVi: ov?.labelVi ?? obj.labelVi,
        descriptionVi: ov?.descriptionVi ?? obj.descriptionVi,
      };
    }
    return base;
  });
  const [audioDataUrl, setAudioDataUrl] = useState<string | undefined>(
    existingCustomization?.customAudioDataUrl
  );
  const [audioFileName, setAudioFileName] = useState<string | undefined>(
    existingCustomization?.customAudioFileName
  );
  const [previewMode, setPreviewMode] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(existingCustomization?.customTitle ?? defaultTitle);
    setInstructionHtml(existingCustomization?.customInstruction ?? defaultInstruction);
    setTranscriptHtml(existingCustomization?.customTranscript ?? defaultTranscript);
    setSpeakingHtml(existingCustomization?.customSpeakingPrompt ?? defaultSpeakingPrompt);
    setWritingHtml(existingCustomization?.customWritingPrompt ?? defaultWritingPrompt);
    setAudioDataUrl(existingCustomization?.customAudioDataUrl);
    setAudioFileName(existingCustomization?.customAudioFileName);
  }, [
    targetId,
    existingCustomization,
    defaultTitle,
    defaultInstruction,
    defaultTranscript,
    defaultSpeakingPrompt,
    defaultWritingPrompt,
  ]);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setStatusMessage('Tệp âm thanh vượt quá 10MB. Vui lòng chọn tệp MP3/WAV nhẹ hơn.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAudioDataUrl(reader.result);
        setAudioFileName(file.name);
        setStatusMessage(`Đã đính kèm tệp âm thanh: ${file.name}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const buildRecord = (isDraft: boolean, suffix = ''): TeacherCustomization => ({
    id: suffix ? `custom::${targetId}::${suffix}` : `custom::${targetId}`,
    targetId,
    category,
    customTitle: title.trim() || defaultTitle,
    customInstruction: instructionHtml,
    customObjectLabels: defaultObjects.length > 0 ? objectLabels : undefined,
    customTranscript: transcriptHtml || undefined,
    customSpeakingPrompt: speakingHtml || undefined,
    customWritingPrompt: writingHtml || undefined,
    customAudioDataUrl: audioDataUrl,
    customAudioFileName: audioFileName,
    isDraft,
    updatedAt: Date.now(),
  });

  const handleSave = async (isDraft: boolean) => {
    setSaving(true);
    try {
      const rec = buildRecord(isDraft);
      await saveLabCustomizationToDB(rec);
      onSaved(rec);
      setStatusMessage(
        isDraft
          ? 'Đã lưu bản nháp tùy chỉnh cục bộ trong trình duyệt.'
          : 'Đã áp dụng phiên bản tùy chỉnh giáo viên (bản gốc mặc định vẫn được giữ nguyên).'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateCopy = async () => {
    setSaving(true);
    try {
      const copy = buildRecord(true, `copy-${Date.now()}`);
      await saveLabCustomizationToDB(copy);
      setStatusMessage('Đã nhân bản thành một bản sao nháp riêng trong IndexedDB.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefault = async () => {
    setSaving(true);
    try {
      await deleteLabCustomizationFromDB(`custom::${targetId}`);
      onSaved(null);
      setTitle(defaultTitle);
      setInstructionHtml(defaultInstruction);
      setTranscriptHtml(defaultTranscript);
      setSpeakingHtml(defaultSpeakingPrompt);
      setWritingHtml(defaultWritingPrompt);
      setAudioDataUrl(undefined);
      setAudioFileName(undefined);
      const resetObjs: Record<string, {labelEn: string; labelVi: string; descriptionVi: string}> = {};
      for (const obj of defaultObjects) {
        resetObjs[obj.id] = {
          labelEn: obj.labelEn,
          labelVi: obj.labelVi,
          descriptionVi: obj.descriptionVi,
        };
      }
      setObjectLabels(resetObjs);
      setStatusMessage('Đã khôi phục nguyên trạng bản gốc mặc định của hệ thống.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-base font-extrabold text-slate-900">
            Chế độ Chỉnh sửa cho Giáo viên (Trình soạn thảo trực quan Tiptap)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Mọi thay đổi được lưu dưới dạng bản tùy chỉnh riêng trong máy — không bao giờ làm hỏng học liệu gốc.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              previewMode
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            {previewMode ? 'Quay lại chỉnh sửa' : 'Xem trước'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleDuplicateCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            <Copy className="w-3.5 h-3.5" />
            Nhân bản
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Khôi phục bản gốc
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-3.5 py-2 text-xs font-semibold text-blue-900">
          {statusMessage}
        </div>
      )}

      {previewMode ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
          <div className="text-xs font-bold uppercase text-indigo-700">Bản xem trước sau tùy chỉnh</div>
          <h4 className="text-lg font-extrabold text-slate-900">{title}</h4>
          <p className="text-sm text-slate-700">{stripHtmlToPlainText(instructionHtml)}</p>
          {defaultObjects.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              {defaultObjects.map((o) => {
                const ed = objectLabels[o.id];
                return (
                  <div key={o.id} className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs">
                    <div className="font-bold text-slate-900">
                      {ed?.labelEn} — <span className="text-blue-700">{ed?.labelVi}</span>
                    </div>
                    <div className="text-slate-600 mt-0.5">{ed?.descriptionVi}</div>
                  </div>
                );
              })}
            </div>
          )}
          {audioDataUrl && (
            <div className="pt-2">
              <div className="text-xs font-bold text-slate-700 mb-1">Âm thanh giáo viên tải lên ({audioFileName}):</div>
              <audio controls src={audioDataUrl} className="w-full max-w-md h-9" />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Custom Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tiêu đề hoạt động hiển thị trên lớp
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Instruction via Tiptap WYSIWYG */}
          <RichTextEditor
            label="Hướng dẫn thực hành cho học sinh (Soạn thảo trực quan Tiptap — hỗ trợ gạch chân, IPA, tô màu)"
            value={instructionHtml}
            onChange={setInstructionHtml}
            compactToolbar
            minHeightClass="min-h-[92px]"
            defaultSpellCheck="vi"
          />

          {/* Interactive Object Labels */}
          {defaultObjects.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700">
                Chỉnh sửa nhãn & chú thích vật thể tương tác ({defaultObjects.length} vật thể)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {defaultObjects.map((obj) => {
                  const cur = objectLabels[obj.id] ?? {
                    labelEn: obj.labelEn,
                    labelVi: obj.labelVi,
                    descriptionVi: obj.descriptionVi,
                  };
                  return (
                    <div
                      key={obj.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={cur.labelEn}
                          onChange={(e) =>
                            setObjectLabels((prev) => ({
                              ...prev,
                              [obj.id]: {...cur, labelEn: e.target.value},
                            }))
                          }
                          placeholder="Nhãn tiếng Anh"
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                        />
                        <input
                          type="text"
                          value={cur.labelVi}
                          onChange={(e) =>
                            setObjectLabels((prev) => ({
                              ...prev,
                              [obj.id]: {...cur, labelVi: e.target.value},
                            }))
                          }
                          placeholder="Nghĩa tiếng Việt"
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                        />
                      </div>
                      <input
                        type="text"
                        value={cur.descriptionVi}
                        onChange={(e) =>
                          setObjectLabels((prev) => ({
                            ...prev,
                            [obj.id]: {...cur, descriptionVi: e.target.value},
                          }))
                        }
                        placeholder="Giải thích ngắn gọn..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-700"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Listening Transcript + Audio Upload */}
          {defaultTranscript && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <RichTextEditor
                label="Tùy chỉnh Transcript bài nghe (Listening)"
                value={transcriptHtml}
                onChange={setTranscriptHtml}
                compactToolbar
                minHeightClass="min-h-[96px]"
                defaultSpellCheck="en-GB"
              />
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                <FileAudio className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-[200px]">
                  <div className="text-xs font-bold text-slate-800">
                    Đính kèm tệp âm thanh MP3/WAV riêng (tùy chọn)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {audioFileName ? `Đang dùng: ${audioFileName}` : 'Nếu không tải tệp, hệ thống dùng giọng đọc tích hợp sẵn.'}
                  </div>
                </div>
                <label className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer">
                  Chọn tệp MP3/WAV
                  <input type="file" accept="audio/mpeg,audio/wav,audio/*" onChange={handleAudioUpload} className="hidden" />
                </label>
                {audioDataUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setAudioDataUrl(undefined);
                      setAudioFileName(undefined);
                    }}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                    title="Gỡ tệp âm thanh"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Custom Speaking & Writing Prompts */}
          {defaultSpeakingPrompt && (
            <RichTextEditor
              label="Tùy chỉnh đề bài Nói (Speaking Prompt)"
              value={speakingHtml}
              onChange={setSpeakingHtml}
              compactToolbar
              minHeightClass="min-h-[80px]"
              defaultSpellCheck="en-GB"
            />
          )}

          {defaultWritingPrompt && (
            <RichTextEditor
              label="Tùy chỉnh đề bài Viết (Writing Prompt)"
              value={writingHtml}
              onChange={setWritingHtml}
              compactToolbar
              minHeightClass="min-h-[80px]"
              defaultSpellCheck="en-GB"
            />
          )}
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <X className="w-3.5 h-3.5" />
            Hủy
          </button>
        )}
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSave(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          Lưu bản nháp
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSave(false)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" />
          Áp dụng ngay
        </button>
      </div>
    </div>
  );
};
