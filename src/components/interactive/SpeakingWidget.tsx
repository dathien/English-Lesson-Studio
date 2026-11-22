import React, {useEffect, useRef, useState} from 'react';
import {
  CheckCircle2,
  Download,
  Mic,
  Save,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import type {RubricScoreEntry, SpeakingTaskConfig, StudentSubmission} from '../../types/lesson';
import {
  deleteSubmissionFromDB,
  getSubmissionsByLesson,
  saveSubmissionToDB,
} from '../../services/storage';

interface SpeakingWidgetProps {
  lessonId: string;
  slideId: string;
  task: SpeakingTaskConfig;
  imageUrl?: string;
  imageCaption?: string;
  darkSurface?: boolean;
}

function speakText(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-GB';
  utter.rate = 0.92;
  window.speechSynthesis.speak(utter);
}

export const SpeakingWidget: React.FC<SpeakingWidgetProps> = ({
  lessonId,
  slideId,
  task,
  imageUrl,
  imageCaption,
  darkSurface = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);

  const [studentName, setStudentName] = useState('Học sinh 1');
  const [teacherComment, setTeacherComment] = useState('');
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    task.rubricCriteria.forEach((c) => {
      init[c.id] = 0;
    });
    return init;
  });
  const [savedRecordings, setSavedRecordings] = useState<StudentSubmission[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    getSubmissionsByLesson(lessonId).then((list) => {
      if (!active) return;
      setSavedRecordings(list.filter((s) => s.type === 'speaking' && s.slideId === slideId));
    });
    return () => {
      active = false;
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
    };
  }, [lessonId, slideId]);

  const startRecording = async () => {
    setMicError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError('Trình duyệt hiện tại không hỗ trợ MediaRecorder API để ghi âm.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mimeType ? new MediaRecorder(stream, {mimeType}) : new MediaRecorder(stream);
      chunksRef.current = [];

      // Real Web Audio API input level meter
      const AudioCtx = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const dataArr = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(dataArr);
          const avg = dataArr.reduce((acc, v) => acc + v, 0) / dataArr.length;
          setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      }

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {type: recorder.mimeType || 'audio/webm'});
        const reader = new FileReader();
        reader.onload = () => setAudioDataUrl(String(reader.result || ''));
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        setMicLevel(0);
        audioCtxRef.current?.close().catch(() => {});
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSec(0);
      timerRef.current = window.setInterval(() => {
        setRecordSec((s) => s + 1);
      }, 1000);
    } catch {
      setMicError('Không thể truy cập micro. Vui lòng cấp quyền sử dụng micro trong trình duyệt.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  };

  const maxTotal = task.rubricCriteria.reduce((sum, c) => sum + c.maxScore, 0);
  const currentTotal = task.rubricCriteria.reduce((sum, c) => sum + (scores[c.id] || 0), 0);

  const handleSaveSubmission = async () => {
    const rubricEntries: RubricScoreEntry[] = task.rubricCriteria.map((c) => ({
      criterionId: c.id,
      score: scores[c.id] || 0,
    }));
    const record: StudentSubmission = {
      id: `spk-${Date.now()}`,
      lessonId,
      slideId,
      type: 'speaking',
      studentName: studentName.trim() || 'Học sinh',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      audioDataUrl: audioDataUrl || undefined,
      audioDurationSec: recordSec,
      teacherComment: teacherComment.trim(),
      rubricScores: rubricEntries,
      totalScore: Number(currentTotal.toFixed(1)),
      maxScore: maxTotal,
    };
    await saveSubmissionToDB(record);
    const updated = await getSubmissionsByLesson(lessonId);
    setSavedRecordings(updated.filter((s) => s.type === 'speaking' && s.slideId === slideId));
    setSaveMessage('Đã lưu bản ghi âm và nhận xét đánh giá vào IndexedDB.');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleDeleteSaved = async (id: string) => {
    await deleteSubmissionFromDB(id);
    setSavedRecordings((prev) => prev.filter((item) => item.id !== id));
  };

  const cardClass = darkSurface
    ? 'bg-slate-800/80 border-slate-700 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left: Prompt, Picture, IPA & Dialogue */}
      <div className="lg:col-span-7 space-y-4">
        <div className={`rounded-xl border p-4 space-y-3 ${cardClass}`}>
          <h4 className="font-semibold text-[#0F4C81]">Nhiệm vụ luyện nói (Speaking Prompt)</h4>
          <p className="leading-relaxed">{task.prompt}</p>

          {imageUrl && (
            <figure className="space-y-1.5">
              <img
                src={imageUrl}
                alt={imageCaption || 'Hình ảnh luyện nói'}
                referrerPolicy="no-referrer"
                className="w-full max-h-64 object-cover rounded-lg border border-slate-200"
              />
              {imageCaption && <figcaption className="text-xs text-slate-500">{imageCaption}</figcaption>}
            </figure>
          )}

          {task.cues && task.cues.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-semibold text-slate-500">Gợi ý triển khai ý:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {task.cues.map((cue, idx) => (
                  <li key={idx}>{cue}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* IPA Pronunciation Drills */}
        {task.ipaFocus && task.ipaFocus.length > 0 && (
          <div className={`rounded-xl border p-4 space-y-2.5 ${cardClass}`}>
            <h4 className="font-semibold text-[#0F4C81]">Luyện phát âm &amp; Phiên âm IPA</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {task.ipaFocus.map((item, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border p-3 flex items-start justify-between gap-2 ${
                    darkSurface ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="font-semibold">{item.text}</div>
                    <div className="font-mono-tabular text-xs text-[#0284C7]">{item.ipa}</div>
                    {item.note && <div className="text-xs text-slate-500 mt-0.5">{item.note}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => speakText(item.text)}
                    title="Phát âm mẫu trình duyệt"
                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#0284C7] shrink-0"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sample Dialogue */}
        {task.sampleDialogue && task.sampleDialogue.length > 0 && (
          <div className={`rounded-xl border p-4 space-y-2.5 ${cardClass}`}>
            <h4 className="font-semibold text-[#0F4C81]">Hội thoại mẫu (Pair Work / Role-play)</h4>
            <div className="space-y-2">
              {task.sampleDialogue.map((turn, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border p-3 flex items-start justify-between gap-3 ${
                    darkSurface ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-slate-50/70'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-[#0284C7]">{turn.speaker}</div>
                    <div className="text-sm">{turn.line}</div>
                    {turn.ipa && <div className="font-mono-tabular text-xs text-slate-500">{turn.ipa}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => speakText(turn.line)}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#0284C7] shrink-0"
                    title="Nghe câu mẫu"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: Real Voice Recorder + Teacher 6-Criterion Rubric */}
      <div className="lg:col-span-5 space-y-4">
        <div className={`rounded-xl border p-4 space-y-3 ${cardClass}`}>
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-[#0F4C81]">Ghi âm bài nói (MediaRecorder)</h4>
            <span className="font-mono-tabular text-xs text-slate-500">
              {Math.floor(recordSec / 60)}:{String(recordSec % 60).padStart(2, '0')}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isRecording ? (
              <button
                type="button"
                onClick={startRecording}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B3A63] whitespace-nowrap"
              >
                <Mic className="w-4 h-4" />
                Bắt đầu ghi âm
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 whitespace-nowrap"
              >
                <Square className="w-4 h-4" />
                Dừng ghi âm
              </button>
            )}

            {audioDataUrl && (
              <a
                href={audioDataUrl}
                download={`speaking-${studentName.replace(/\s+/g, '_')}.webm`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Tải bản ghi
              </a>
            )}
          </div>

          {isRecording && (
            <div className="space-y-1">
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-[#0284C7] transition-all duration-75"
                  style={{width: `${Math.max(8, micLevel)}%`}}
                />
              </div>
              <p className="text-xs text-slate-500">Đang thu âm trực tiếp từ micro...</p>
            </div>
          )}

          {micError && (
            <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
              {micError}
            </p>
          )}

          {audioDataUrl && (
            <div className="pt-1 space-y-1">
              <p className="text-xs font-medium text-slate-500">Nghe lại bản ghi âm:</p>
              <audio controls src={audioDataUrl} className="w-full h-10" />
            </div>
          )}

          <p className="text-xs text-slate-500">
            Lưu ý: Hệ thống không chấm điểm phát âm ngẫu nhiên theo thời lượng. Giáo viên nghe bản ghi và đánh giá chính xác theo bảng tiêu chí bên dưới.
          </p>
        </div>

        {/* 6-Criterion Speaking Rubric */}
        <div className={`rounded-xl border p-4 space-y-3 ${cardClass}`}>
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-[#0F4C81]">Bảng tiêu chí đánh giá Speaking</h4>
            <span className="font-mono-tabular text-sm font-bold text-[#0F4C81]">
              {currentTotal.toFixed(1)} / {maxTotal} điểm
            </span>
          </div>

          <input
            type="text"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Họ tên học sinh / Nhóm"
            className={`w-full rounded-lg border px-3 py-2 text-sm ${
              darkSurface ? 'border-slate-600 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-900'
            }`}
          />

          <div className="space-y-2.5 max-h-60 overflow-y-auto studio-scroll pr-1">
            {task.rubricCriteria.map((c) => (
              <div key={c.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{c.name}</span>
                  <span className="font-mono-tabular font-semibold text-[#0284C7]">
                    {(scores[c.id] || 0).toFixed(1)} / {c.maxScore}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={c.maxScore}
                  step={0.5}
                  value={scores[c.id] || 0}
                  onChange={(e) =>
                    setScores((prev) => ({...prev, [c.id]: Number(e.target.value)}))
                  }
                  aria-label={c.name}
                  className="w-full accent-[#0284C7]"
                />
                <p className="text-[11px] text-slate-500">{c.description}</p>
              </div>
            ))}
          </div>

          <textarea
            value={teacherComment}
            onChange={(e) => setTeacherComment(e.target.value)}
            rows={2}
            placeholder="Nhận xét của giáo viên (phát âm, ngữ điệu, từ vựng, phản xạ)..."
            className={`w-full rounded-lg border px-3 py-2 text-sm ${
              darkSurface ? 'border-slate-600 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-900'
            }`}
          />

          <button
            type="button"
            onClick={handleSaveSubmission}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Save className="w-4 h-4" />
            Lưu bản ghi &amp; điểm đánh giá
          </button>

          {saveMessage && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              {saveMessage}
            </p>
          )}
        </div>

        {/* Saved Recordings List */}
        {savedRecordings.length > 0 && (
          <div className={`rounded-xl border p-4 space-y-2.5 ${cardClass}`}>
            <h5 className="text-sm font-semibold">Bản ghi đã lưu ({savedRecordings.length})</h5>
            <div className="space-y-2 max-h-48 overflow-y-auto studio-scroll">
              {savedRecordings.map((rec) => (
                <div
                  key={rec.id}
                  className={`rounded-lg border p-2.5 text-xs space-y-1.5 ${
                    darkSurface ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      {rec.studentName} · <span className="font-mono-tabular text-[#0284C7]">{rec.totalScore}/{rec.maxScore}đ</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSaved(rec.id)}
                      className="text-slate-400 hover:text-rose-600"
                      title="Xóa bản ghi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {rec.audioDataUrl && <audio controls src={rec.audioDataUrl} className="w-full h-8" />}
                  {rec.teacherComment && <p className="text-slate-600">Nhận xét: {rec.teacherComment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
