import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileText,
  Headphones,
  Loader2,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import type {
  AudioSourceMode,
  AudioTimestamp,
  Grade,
  ListeningAudioConfig,
  QuestionItem,
  VoiceAccent,
} from '../../types/lesson';
import {generateListeningQuestionsAI, generateSpeechTTS} from '../../services/aiService';

interface ListeningWidgetProps {
  audioConfig: ListeningAudioConfig;
  grade: Grade;
  lessonTitle?: string;
  topic?: string;
  onUpdateAudio?: (next: ListeningAudioConfig) => void;
  onAppendQuestions?: (questions: QuestionItem[]) => void;
  jumpRequestSec?: number | null;
  darkSurface?: boolean;
  readOnly?: boolean;
}

const SPEED_OPTIONS = [0.8, 1, 1.15] as const;

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function splitTranscriptToSegments(transcript: string): string[] {
  const cleaned = transcript.trim();
  if (!cleaned) return [];
  const lines = cleaned
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const segments: string[] = [];
  for (const line of lines) {
    const sentences = line.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [line];
    for (const s of sentences) {
      const trimmed = s.trim();
      if (trimmed) segments.push(trimmed);
    }
  }
  return segments;
}

export const ListeningWidget: React.FC<ListeningWidgetProps> = ({
  audioConfig,
  grade,
  lessonTitle,
  topic,
  onUpdateAudio,
  onAppendQuestions,
  jumpRequestSec,
  darkSurface = false,
  readOnly = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeUtteranceIdRef = useRef(0);

  const sourceMode: AudioSourceMode =
    audioConfig.sourceMode || (audioConfig.dataUrl ? 'uploaded' : 'builtin');
  const accent: VoiceAccent = audioConfig.voiceAccent || 'en-GB';

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showTranscript, setShowTranscript] = useState(Boolean(audioConfig.showTranscriptDefault));
  const [loopSegment, setLoopSegment] = useState<{start: number; end: number} | null>(null);

  // Web Speech API state & real device voice inspection
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [activeSegmentIdx, setActiveSegmentIdx] = useState(0);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);

  // TTS WAV generation state (Option C)
  const [ttsGenerating, setTtsGenerating] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [ttsSuccess, setTtsSuccess] = useState<string | null>(null);

  // AI Question generation state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState<string | null>(null);

  const hasNativeAudio = Boolean(audioConfig.dataUrl);
  const transcriptSegments = useMemo(
    () => splitTranscriptToSegments(audioConfig.transcript || ''),
    [audioConfig.transcript],
  );

  // Inspect actual Web Speech voices available on user's device
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices();
      setAvailableVoices(list);
    };
    loadVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', loadVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    setShowTranscript(Boolean(audioConfig.showTranscriptDefault));
  }, [audioConfig.showTranscriptDefault]);

  // Stop any playing audio/speech when audioConfig changes
  useEffect(() => {
    activeUtteranceIdRef.current += 1;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setActiveSegmentIdx(0);
    setCurrentTime(0);
    setDuration(0);
  }, [audioConfig.dataUrl, audioConfig.transcript, sourceMode]);

  useEffect(() => {
    if (typeof jumpRequestSec === 'number' && audioRef.current && hasNativeAudio) {
      audioRef.current.currentTime = jumpRequestSec;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
      setIsPaused(false);
    }
  }, [jumpRequestSec, hasNativeAudio]);

  const matchedVoices = useMemo(() => {
    const gb = availableVoices.filter((v) => v.lang.toLowerCase().startsWith('en-gb'));
    const us = availableVoices.filter((v) => v.lang.toLowerCase().startsWith('en-us'));
    const anyEn = availableVoices.filter((v) => v.lang.toLowerCase().startsWith('en'));
    return {
      gb: gb[0] || null,
      us: us[0] || null,
      fallbackEn: anyEn[0] || null,
    };
  }, [availableVoices]);

  const activeBrowserVoice =
    accent === 'en-GB'
      ? matchedVoices.gb || matchedVoices.fallbackEn
      : matchedVoices.us || matchedVoices.fallbackEn;

  // Speak transcript segments cleanly with Play / Pause / Replay / Speed support
  const speakFromSegment = (startIdx: number, rateOverride?: number, accentOverride?: VoiceAccent) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSpeechNotice('Trình duyệt không hỗ trợ Web Speech API. Vui lòng tải tệp MP3/WAV hoặc tạo tệp WAV trực tuyến.');
      return;
    }
    if (transcriptSegments.length === 0) {
      setSpeechNotice('Chưa có nội dung transcript để phát giọng đọc.');
      return;
    }

    setSpeechNotice(null);
    window.speechSynthesis.cancel();
    const runId = ++activeUtteranceIdRef.current;
    const effectiveRate = rateOverride ?? playbackRate;
    const effectiveAccent = accentOverride ?? accent;
    const chosenVoice =
      effectiveAccent === 'en-GB'
        ? matchedVoices.gb || matchedVoices.fallbackEn
        : matchedVoices.us || matchedVoices.fallbackEn;

    setIsPlaying(true);
    setIsPaused(false);

    const speakNext = (idx: number) => {
      if (runId !== activeUtteranceIdRef.current) return;
      if (idx >= transcriptSegments.length) {
        setIsPlaying(false);
        setIsPaused(false);
        setActiveSegmentIdx(0);
        return;
      }

      setActiveSegmentIdx(idx);
      const utter = new SpeechSynthesisUtterance(transcriptSegments[idx]);
      utter.lang = chosenVoice?.lang || effectiveAccent;
      if (chosenVoice) utter.voice = chosenVoice;
      utter.rate = effectiveRate;
      utter.onend = () => {
        if (runId === activeUtteranceIdRef.current) {
          speakNext(idx + 1);
        }
      };
      utter.onerror = () => {
        if (runId === activeUtteranceIdRef.current) {
          setIsPlaying(false);
          setIsPaused(false);
        }
      };
      window.speechSynthesis.speak(utter);
    };

    speakNext(Math.min(Math.max(0, startIdx), transcriptSegments.length - 1));
  };

  const handlePlayPause = () => {
    if (hasNativeAudio) {
      const el = audioRef.current;
      if (!el) return;
      if (el.paused) {
        el.playbackRate = playbackRate;
        el.play().catch(() => {});
        setIsPlaying(true);
        setIsPaused(false);
      } else {
        el.pause();
        setIsPlaying(false);
        setIsPaused(true);
      }
      return;
    }

    // Built-in / Synthesized Speech Playback (immediate on first click, works offline)
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSpeechNotice('Trình duyệt không hỗ trợ phát giọng đọc tổng hợp.');
      return;
    }

    if (isPlaying && !isPaused) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      setIsPaused(true);
    } else if (isPaused && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
    } else {
      speakFromSegment(activeSegmentIdx);
    }
  };

  const handleReplay = () => {
    setLoopSegment(null);
    if (hasNativeAudio && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
      setIsPaused(false);
      return;
    }
    speakFromSegment(0);
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (hasNativeAudio && audioRef.current) {
      audioRef.current.playbackRate = rate;
    } else if (isPlaying) {
      speakFromSegment(activeSegmentIdx, rate);
    }
  };

  const handleAccentChange = (nextAccent: VoiceAccent) => {
    if (onUpdateAudio) {
      onUpdateAudio({
        ...audioConfig,
        voiceAccent: nextAccent,
      });
    }
    if (!hasNativeAudio && isPlaying) {
      speakFromSegment(activeSegmentIdx, playbackRate, nextAccent);
    }
  };

  const handleSwitchSourceMode = (mode: AudioSourceMode) => {
    if (!onUpdateAudio || mode === sourceMode) return;
    const hadTimestamps = Boolean(audioConfig.timestamps && audioConfig.timestamps.length > 0);

    if (mode === 'builtin') {
      onUpdateAudio({
        ...audioConfig,
        sourceMode: 'builtin',
        dataUrl: undefined,
        fileName: undefined,
        mimeType: undefined,
        isSynthesized: true,
        timestampsNeedReview: hadTimestamps ? true : audioConfig.timestampsNeedReview,
      });
    } else {
      onUpdateAudio({
        ...audioConfig,
        sourceMode: mode,
        timestampsNeedReview: hadTimestamps ? true : audioConfig.timestampsNeedReview,
      });
    }
    setTtsError(null);
    setTtsSuccess(null);
  };

  const handleUploadAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateAudio) return;
    const hadTimestamps = Boolean(audioConfig.timestamps && audioConfig.timestamps.length > 0);
    const reader = new FileReader();
    reader.onload = () => {
      onUpdateAudio({
        ...audioConfig,
        sourceMode: 'uploaded',
        dataUrl: String(reader.result || ''),
        fileName: file.name,
        mimeType: file.type,
        isSynthesized: false,
        timestampsNeedReview: hadTimestamps,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleUploadTranscriptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateAudio) return;
    const text = await file.text();
    onUpdateAudio({
      ...audioConfig,
      transcript: text.trim(),
    });
    e.target.value = '';
  };

  const handleGenerateRealTTS = async () => {
    if (!audioConfig.transcript?.trim()) {
      setTtsError('Vui lòng nhập hoặc dán transcript trước khi tạo giọng đọc.');
      return;
    }
    setTtsGenerating(true);
    setTtsError(null);
    setTtsSuccess(null);

    const res = await generateSpeechTTS({
      text: audioConfig.transcript,
      accent,
    });
    setTtsGenerating(false);

    if (res.ok && res.dataUrl && onUpdateAudio) {
      const hadTimestamps = Boolean(audioConfig.timestamps && audioConfig.timestamps.length > 0);
      onUpdateAudio({
        ...audioConfig,
        sourceMode: 'tts',
        dataUrl: res.dataUrl,
        mimeType: res.mimeType || 'audio/wav',
        fileName: `listening-${accent}-${Date.now()}.wav`,
        voiceAccent: accent,
        isSynthesized: true,
        timestampsNeedReview: hadTimestamps,
      });
      setTtsSuccess(
        `Đã tạo tệp giọng đọc tổng hợp WAV (${accent === 'en-GB' ? 'Anh-Anh' : 'Anh-Mỹ'}). Bạn có thể nhấn Play để nghe thử hoặc tải tệp WAV xuống.`,
      );
    } else {
      setTtsError(
        res.error ||
          'Không thể tạo tệp WAV trực tuyến lúc này. Bạn vẫn có thể nhấn "Nghe thử (Web Speech)" bằng giọng đọc tổng hợp trên thiết bị.',
      );
    }
  };

  const handleAddTimestamp = () => {
    if (!onUpdateAudio) return;
    const existing = audioConfig.timestamps || [];
    const nextNum = existing.length + 1;
    const startSec = hasNativeAudio ? Math.floor(currentTime) : activeSegmentIdx * 8;
    const ts: AudioTimestamp = {
      id: `ts-${Date.now()}`,
      questionNumber: nextNum,
      label: `Câu ${nextNum}`,
      startSec,
      endSec: hasNativeAudio
        ? Math.min(startSec + 15, Math.floor(duration || startSec + 15))
        : startSec + 10,
    };
    onUpdateAudio({
      ...audioConfig,
      timestamps: [...existing, ts],
      timestampsNeedReview: false,
    });
  };

  const handleUpdateTimestamp = (tsId: string, patch: Partial<AudioTimestamp>) => {
    if (!onUpdateAudio || !audioConfig.timestamps) return;
    onUpdateAudio({
      ...audioConfig,
      timestamps: audioConfig.timestamps.map((t) => (t.id === tsId ? {...t, ...patch} : t)),
    });
  };

  const handleDeleteTimestamp = (tsId: string) => {
    if (!onUpdateAudio || !audioConfig.timestamps) return;
    onUpdateAudio({
      ...audioConfig,
      timestamps: audioConfig.timestamps.filter((t) => t.id !== tsId),
    });
  };

  const handleClearTimestamps = () => {
    if (!onUpdateAudio) return;
    onUpdateAudio({
      ...audioConfig,
      timestamps: [],
      timestampsNeedReview: false,
    });
  };

  const handleConfirmTimestamps = () => {
    if (!onUpdateAudio) return;
    onUpdateAudio({
      ...audioConfig,
      timestampsNeedReview: false,
    });
  };

  const handleGenerateQuestions = async () => {
    if (!audioConfig.transcript || !onAppendQuestions) return;
    setAiLoading(true);
    setAiStatusMsg(null);
    const res = await generateListeningQuestionsAI({
      transcript: audioConfig.transcript,
      grade,
      questionType: 'mcq',
      count: 3,
    });
    setAiLoading(false);
    if (res.ok && res.questions && res.questions.length > 0) {
      onAppendQuestions(res.questions);
      setAiStatusMsg(`Đã tạo ${res.questions.length} câu hỏi từ transcript. Giáo viên hãy kiểm tra lại đáp án.`);
    } else {
      setAiStatusMsg(res.error || 'Không thể tạo câu hỏi từ transcript lúc này.');
    }
  };

  const surface = darkSurface
    ? 'bg-slate-800/80 border-slate-700 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  const mutedText = darkSurface ? 'text-slate-300' : 'text-slate-600';

  const sourceDescriptor = hasNativeAudio
    ? audioConfig.isSynthesized
      ? `Giọng đọc tổng hợp (WAV · ${accent === 'en-GB' ? 'Anh-Anh' : 'Anh-Mỹ'})`
      : `Âm thanh giáo viên tải lên (${audioConfig.fileName || 'Audio'})`
    : `Giọng đọc tổng hợp có sẵn (${accent === 'en-GB' ? 'Anh-Anh' : 'Anh-Mỹ'}${
        activeBrowserVoice ? ` · ${activeBrowserVoice.name}` : ''
      })`;

  const canPlayAnything = hasNativeAudio || transcriptSegments.length > 0;

  return (
    <div className={`rounded-xl border p-4 sm:p-5 space-y-4 ${surface}`}>
      {/* Standardized Listening Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200/70">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-[#0F4C81]">
            <Headphones className="w-4 h-4 text-[#0284C7] shrink-0" />
            <span>LISTENING – LUYỆN NGHE</span>
          </div>

          {lessonTitle && (
            <h3 className="text-base font-bold leading-snug">{lessonTitle}</h3>
          )}

          <div className={`flex flex-wrap items-center gap-2 text-xs ${mutedText}`}>
            <span className="font-semibold text-[#0F4C81]">Lớp {grade}</span>
            {topic && (
              <>
                <span aria-hidden="true">·</span>
                <span>Chủ đề: {topic}</span>
              </>
            )}
            {hasNativeAudio && duration > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">Thời lượng: {formatTime(duration)}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{sourceDescriptor}</span>
          </div>

          {audioConfig.skillObjective && (
            <p className={`text-xs ${mutedText}`}>
              <span className="font-semibold">Mục tiêu kỹ năng: </span>
              {audioConfig.skillObjective}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowTranscript((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
            darkSurface
              ? 'border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-700'
              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
          }`}
        >
          {showTranscript ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showTranscript ? 'Ẩn transcript' : 'Hiện transcript'}
        </button>
      </div>

      {/* Unified Ready-to-Play Audio Player (Works immediately for Built-in, Uploaded, and TTS WAV) */}
      <div
        className={`rounded-xl border p-3.5 space-y-3 ${
          darkSurface ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-slate-50/80'
        }`}
      >
        {hasNativeAudio && (
          <audio
            ref={audioRef}
            src={audioConfig.dataUrl}
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration);
              e.currentTarget.playbackRate = playbackRate;
            }}
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              setCurrentTime(t);
              if (loopSegment && t >= loopSegment.end) {
                e.currentTarget.currentTime = loopSegment.start;
              }
            }}
            onEnded={() => {
              setIsPlaying(false);
              setIsPaused(false);
            }}
          />
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handlePlayPause}
            disabled={!canPlayAnything}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B3A63] disabled:opacity-40 whitespace-nowrap"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? 'Tạm dừng' : isPaused ? 'Tiếp tục' : 'Play'}
          </button>

          <button
            type="button"
            onClick={handleReplay}
            disabled={!canPlayAnything}
            className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-40 whitespace-nowrap ${
              darkSurface
                ? 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
            }`}
            title="Nghe lại từ đầu"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Nghe lại
          </button>

          {hasNativeAudio ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
                  }
                }}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                title="Lùi lại 5 giây"
              >
                -5s
              </button>

              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setCurrentTime(v);
                  if (audioRef.current) audioRef.current.currentTime = v;
                }}
                aria-label="Thanh thời gian bài nghe"
                className="flex-1 min-w-[140px] accent-[#0284C7]"
              />

              <span className="font-mono-tabular text-xs font-medium text-slate-600 whitespace-nowrap">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </>
          ) : (
            <div className="flex-1 min-w-[160px] flex items-center gap-2.5">
              <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-[#0284C7] transition-all duration-200"
                  style={{
                    width:
                      transcriptSegments.length > 0 && (isPlaying || isPaused)
                        ? `${Math.round(((activeSegmentIdx + 1) / transcriptSegments.length) * 100)}%`
                        : '0%',
                  }}
                />
              </div>
              <span className="font-mono-tabular text-xs text-slate-500 whitespace-nowrap">
                {transcriptSegments.length > 0
                  ? `Đoạn ${Math.min(activeSegmentIdx + 1, transcriptSegments.length)}/${transcriptSegments.length}`
                  : '0/0'}
              </span>
            </div>
          )}
        </div>

        {/* Speed Controls (0.8x, 1x, 1.15x) + Accent & Download (ONLY when real audio file exists) */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={mutedText}>Tốc độ:</span>
            {SPEED_OPTIONS.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => handleSpeedChange(rate)}
                className={`rounded-md px-2.5 py-1 font-mono-tabular font-medium transition-colors ${
                  playbackRate === rate
                    ? 'bg-[#0284C7] text-white font-semibold'
                    : darkSurface
                      ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {rate}×
              </button>
            ))}

            {!hasNativeAudio && (
              <div className="inline-flex items-center gap-1 ml-2 pl-2 border-l border-slate-300">
                <span className={mutedText}>Giọng:</span>
                <button
                  type="button"
                  onClick={() => handleAccentChange('en-GB')}
                  className={`rounded-md px-2 py-1 font-medium ${
                    accent === 'en-GB'
                      ? 'bg-[#0F4C81] text-white'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  Anh-Anh
                </button>
                <button
                  type="button"
                  onClick={() => handleAccentChange('en-US')}
                  className={`rounded-md px-2 py-1 font-medium ${
                    accent === 'en-US'
                      ? 'bg-[#0F4C81] text-white'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  Anh-Mỹ
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {loopSegment && (
              <button
                type="button"
                onClick={() => setLoopSegment(null)}
                className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-amber-950 font-medium"
              >
                <Repeat className="w-3.5 h-3.5" />
                Lặp {formatTime(loopSegment.start)}–{formatTime(loopSegment.end)} · Tắt
              </button>
            )}

            {/* Download button ONLY appears when there is an actual audio file (WAV/MP3), NEVER for Web Speech API */}
            {hasNativeAudio && audioConfig.dataUrl && (
              <a
                href={audioConfig.dataUrl}
                download={audioConfig.fileName || 'listening-audio.wav'}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-100 font-medium whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Tải tệp âm thanh
              </a>
            )}
          </div>
        </div>

        {speechNotice && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
            {speechNotice}
          </p>
        )}
      </div>

      {/* Teacher Edit Mode: 3 Audio Source Options ("Nguồn âm thanh") */}
      {!readOnly && onUpdateAudio && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[#0F4C81]">Nguồn âm thanh</span>
            <span className="text-xs text-slate-500">
              Chọn 1 trong 3 phương án sử dụng cho bài nghe
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(
              [
                {id: 'builtin', num: '1', label: 'Dùng bài nghe có sẵn'},
                {id: 'uploaded', num: '2', label: 'Tải âm thanh của tôi'},
                {id: 'tts', num: '3', label: 'Tạo giọng đọc từ transcript'},
              ] as Array<{id: AudioSourceMode; num: string; label: string}>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSwitchSourceMode(opt.id)}
                className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                  sourceMode === opt.id
                    ? 'border-[#0284C7] bg-sky-50 text-[#0F4C81] font-semibold ring-1 ring-[#0284C7]'
                    : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-white'
                }`}
              >
                {opt.num}. {opt.label}
              </button>
            ))}
          </div>

          {/* Option A Info */}
          {sourceMode === 'builtin' && (
            <p className="text-xs text-slate-600 leading-relaxed">
              Đang sử dụng <strong>bài nghe có sẵn</strong> (giọng đọc tổng hợp từ transcript). Giáo viên nhấn <strong>Play</strong> ở trên để phát ngay trên lớp mà không cần tải thêm tệp.
            </p>
          )}

          {/* Option B: Teacher Upload MP3/WAV + Separate Transcript */}
          {sourceMode === 'uploaded' && (
            <div className="space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-3.5 py-2 font-medium text-white hover:bg-[#0B3A63] cursor-pointer whitespace-nowrap">
                  <Upload className="w-3.5 h-3.5" />
                  {audioConfig.fileName && !audioConfig.isSynthesized
                    ? 'Thay tệp âm thanh khác (MP3/WAV...)'
                    : 'Tải tệp âm thanh (MP3, WAV, M4A, OGG)'}
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleUploadAudio}
                    className="hidden"
                  />
                </label>

                <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap">
                  <FileText className="w-3.5 h-3.5" />
                  Tải transcript riêng (.txt)
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    onChange={handleUploadTranscriptFile}
                    className="hidden"
                  />
                </label>

                {hasNativeAudio && (
                  <button
                    type="button"
                    onClick={handleAddTimestamp}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 font-medium text-[#0F4C81] hover:bg-sky-100 whitespace-nowrap"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    Đánh dấu mốc {formatTime(currentTime)}
                  </button>
                )}
              </div>
              <p className="text-slate-500">
                Tệp âm thanh tải lên được lưu trực tiếp cùng bài giảng trong IndexedDB để phát lại ổn định ngay cả khi ngoại tuyến.
              </p>
            </div>
          )}

          {/* Option C: Create Voice from Transcript (Anh-Anh / Anh-Mỹ, Preview, Real Gemini WAV TTS) */}
          {sourceMode === 'tts' && (
            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-700">Chọn giọng đọc:</span>
                <button
                  type="button"
                  onClick={() => handleAccentChange('en-GB')}
                  className={`rounded-lg border px-3 py-1.5 font-medium ${
                    accent === 'en-GB'
                      ? 'border-[#0F4C81] bg-[#0F4C81] text-white'
                      : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  Anh-Anh (en-GB){matchedVoices.gb ? ' · Có sẵn trên máy' : ''}
                </button>
                <button
                  type="button"
                  onClick={() => handleAccentChange('en-US')}
                  className={`rounded-lg border px-3 py-1.5 font-medium ${
                    accent === 'en-US'
                      ? 'border-[#0F4C81] bg-[#0F4C81] text-white'
                      : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  Anh-Mỹ (en-US){matchedVoices.us ? ' · Có sẵn trên máy' : ''}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateRealTTS}
                  disabled={ttsGenerating || !audioConfig.transcript?.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-3.5 py-2 font-semibold text-white hover:bg-[#0B3A63] disabled:opacity-50 whitespace-nowrap"
                >
                  {ttsGenerating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                  {ttsGenerating ? 'Đang tạo tệp giọng đọc WAV...' : 'Tạo giọng đọc (tệp WAV)'}
                </button>

                <button
                  type="button"
                  onClick={() => speakFromSegment(0)}
                  disabled={!audioConfig.transcript?.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" />
                  Nghe thử nhanh (Web Speech)
                </button>
              </div>

              <p className="text-slate-500">
                Nút <strong>Tạo giọng đọc (tệp WAV)</strong> tạo tệp âm thanh WAV thực tế có thời lượng chuẩn và cho phép tải xuống. Khi không có mạng, nút <strong>Nghe thử nhanh</strong> dùng giọng đọc tổng hợp trình duyệt (Web Speech API không xuất tệp MP3).
              </p>

              {ttsSuccess && (
                <p className="flex items-center gap-1.5 font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {ttsSuccess}
                </p>
              )}
              {ttsError && (
                <p className="font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  {ttsError}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Timestamp Integrity Check after Changing Audio Source */}
      {audioConfig.timestampsNeedReview &&
        audioConfig.timestamps &&
        audioConfig.timestamps.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 space-y-2">
            <div className="flex items-start gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                Nguồn âm thanh đã thay đổi — các mốc thời gian câu hỏi cũ có thể không còn khớp với bản ghi hiện tại.
              </span>
            </div>
            {!readOnly && onUpdateAudio && (
              <div className="flex flex-wrap items-center gap-2 pl-6">
                <button
                  type="button"
                  onClick={handleClearTimestamps}
                  className="rounded-lg border border-amber-400 bg-white px-2.5 py-1 font-semibold text-amber-950 hover:bg-amber-100"
                >
                  Xóa các mốc cũ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTimestamps}
                  className="rounded-lg bg-amber-700 px-2.5 py-1 font-semibold text-white hover:bg-amber-800"
                >
                  Đã chỉnh sửa khớp nguồn mới
                </button>
              </div>
            )}
          </div>
        )}

      {/* Question Timestamps (Only shown when matched to native audio OR editable in teacher mode) */}
      {audioConfig.timestamps &&
        audioConfig.timestamps.length > 0 &&
        (hasNativeAudio || !readOnly) && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className={`font-semibold ${mutedText}`}>
                Mốc thời gian theo câu hỏi{audioConfig.timestampsNeedReview ? ' (Cần kiểm tra lại)' : ''}:
              </span>
            </div>

            {readOnly ? (
              !audioConfig.timestampsNeedReview ? (
                <div className="flex flex-wrap items-center gap-2">
                  {audioConfig.timestamps.map((ts) => (
                    <button
                      key={ts.id}
                      type="button"
                      onClick={() => {
                        if (audioRef.current && hasNativeAudio) {
                          audioRef.current.currentTime = ts.startSec;
                          if (ts.endSec && ts.endSec > ts.startSec) {
                            setLoopSegment({start: ts.startSec, end: ts.endSec});
                          }
                          audioRef.current.play().catch(() => {});
                          setIsPlaying(true);
                          setIsPaused(false);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:border-[#0284C7] hover:text-[#0F4C81]"
                    >
                      <span className="font-semibold">Q{ts.questionNumber}</span>
                      <span>· {ts.label}</span>
                      <span className="font-mono-tabular text-[#0284C7]">
                        ({formatTime(ts.startSec)}
                        {ts.endSec ? `–${formatTime(ts.endSec)}` : ''})
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-amber-800">
                  Mốc thời gian đang tạm ẩn khi trình chiếu cho đến khi giáo viên cập nhật lại cho khớp nguồn âm thanh mới.
                </p>
              )
            ) : (
              <div className="space-y-1.5">
                {audioConfig.timestamps.map((ts) => (
                  <div
                    key={ts.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs"
                  >
                    <span className="font-semibold text-[#0F4C81]">Q{ts.questionNumber}</span>
                    <input
                      type="text"
                      value={ts.label}
                      onChange={(e) => handleUpdateTimestamp(ts.id, {label: e.target.value})}
                      className="flex-1 min-w-[120px] rounded border border-slate-300 bg-white px-2 py-1"
                    />
                    <label className="flex items-center gap-1 font-mono-tabular">
                      Từ (s):
                      <input
                        type="number"
                        min={0}
                        value={ts.startSec}
                        onChange={(e) =>
                          handleUpdateTimestamp(ts.id, {startSec: Math.max(0, Number(e.target.value))})
                        }
                        className="w-16 rounded border border-slate-300 bg-white px-1.5 py-1"
                      />
                    </label>
                    <label className="flex items-center gap-1 font-mono-tabular">
                      Đến (s):
                      <input
                        type="number"
                        min={0}
                        value={ts.endSec ?? ts.startSec + 10}
                        onChange={(e) =>
                          handleUpdateTimestamp(ts.id, {endSec: Math.max(0, Number(e.target.value))})
                        }
                        className="w-16 rounded border border-slate-300 bg-white px-1.5 py-1"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDeleteTimestamp(ts.id)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                      title="Xóa mốc thời gian"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      {/* Transcript Viewer */}
      {showTranscript && (
        <div
          className={`rounded-lg border p-3.5 text-sm leading-relaxed space-y-2 ${
            darkSurface ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-800'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#0F4C81]">TRANSCRIPT BÀI NGHE</span>
            {onAppendQuestions && audioConfig.transcript && (
              <button
                type="button"
                onClick={handleGenerateQuestions}
                disabled={aiLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-xs font-medium text-[#0F4C81] hover:bg-sky-50 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {aiLoading ? 'Đang tạo câu hỏi...' : 'Tạo câu hỏi từ Transcript (AI)'}
              </button>
            )}
          </div>
          {audioConfig.transcript ? (
            <p className="whitespace-pre-line">{audioConfig.transcript}</p>
          ) : (
            <p className="text-slate-500 italic">
              Chưa có transcript cho tệp âm thanh này. Giáo viên có thể nhập hoặc tải tệp .txt trong Trình biên tập.
            </p>
          )}
          {aiStatusMsg && <p className="text-xs font-medium text-amber-700">{aiStatusMsg}</p>}
        </div>
      )}
    </div>
  );
};
