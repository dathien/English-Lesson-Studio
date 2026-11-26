import React, {useEffect, useRef, useState} from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Languages,
  MessageSquare,
  Mic,
  RotateCcw,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import type {RolePlayChoice, RolePlayScenario} from '../../../types/interactiveLab';
import {
  playLabSoundEffect,
  speakLabText,
  startLocalMicRecording,
  type MicRecordingSession,
} from '../../../services/labAudioService';

interface RolePlayEngineProps {
  scenario: RolePlayScenario;
  accent?: 'en-GB' | 'en-US';
  onComplete?: (score: number, turns: number) => void;
}

interface TranscriptTurn {
  speaker: 'npc' | 'student';
  name: string;
  textEn: string;
  textVi?: string;
  feedbackVi?: string;
  registerTag?: string;
  scoreDelta?: number;
}

export const RolePlayEngine: React.FC<RolePlayEngineProps> = ({
  scenario,
  accent = 'en-GB',
  onComplete,
}) => {
  const [currentNodeId, setCurrentNodeId] = useState(scenario.startNodeId);
  const [history, setHistory] = useState<TranscriptTurn[]>([]);
  const [score, setScore] = useState(0);
  const [showVi, setShowVi] = useState(true);
  const [showHints, setShowHints] = useState(true);

  // Local mic practice
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const recorderRef = useRef<MicRecordingSession | null>(null);

  const currentNode = scenario.nodes.find((n) => n.id === currentNodeId) ?? scenario.nodes[0];

  useEffect(() => {
    const start = scenario.nodes.find((n) => n.id === scenario.startNodeId) ?? scenario.nodes[0];
    setCurrentNodeId(start.id);
    setScore(0);
    setHistory([
      {
        speaker: 'npc',
        name: `${start.npcName} (${start.npcRole})`,
        textEn: start.npcLineEn,
        textVi: start.npcLineVi,
      },
    ]);
  }, [scenario.id, scenario.startNodeId, scenario.nodes]);

  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  const handleSelectChoice = (choice: RolePlayChoice) => {
    const nextScore = score + choice.scoreDelta;
    setScore(nextScore);
    playLabSoundEffect(choice.scoreDelta >= 2 ? 'correct' : 'click');
    speakLabText(choice.textEn, accent);

    const nextNode = scenario.nodes.find((n) => n.id === choice.nextNodeId);
    const additions: TranscriptTurn[] = [
      {
        speaker: 'student',
        name: `Bạn (${scenario.studentRoleVi})`,
        textEn: choice.textEn,
        feedbackVi: choice.feedbackVi,
        registerTag: choice.registerTag,
        scoreDelta: choice.scoreDelta,
      },
    ];

    if (nextNode) {
      additions.push({
        speaker: 'npc',
        name: `${nextNode.npcName} (${nextNode.npcRole})`,
        textEn: nextNode.npcLineEn,
        textVi: nextNode.npcLineVi,
      });
      setCurrentNodeId(nextNode.id);
      if (nextNode.isEnd) {
        onComplete?.(nextScore, nextNode.turnNumber);
      }
    }

    setHistory((prev) => [...prev, ...additions]);
  };

  const handleRestart = () => {
    const start = scenario.nodes.find((n) => n.id === scenario.startNodeId) ?? scenario.nodes[0];
    setCurrentNodeId(start.id);
    setScore(0);
    setHistory([
      {
        speaker: 'npc',
        name: `${start.npcName} (${start.npcRole})`,
        textEn: start.npcLineEn,
        textVi: start.npcLineVi,
      },
    ]);
    playLabSoundEffect('click');
  };

  const handleToggleMic = async () => {
    setMicError(null);
    if (isRecording && recorderRef.current) {
      const url = await recorderRef.current.stop();
      recorderRef.current = null;
      setIsRecording(false);
      if (url) {
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        setRecordedUrl(url);
      }
      return;
    }
    try {
      const session = await startLocalMicRecording();
      recorderRef.current = session;
      setIsRecording(true);
    } catch (err) {
      setMicError(err instanceof Error ? err.message : 'Không thể bật micro trên thiết bị.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {/* Main Conversation Stream */}
      <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-blue-100">
              {scenario.id} · Nhập vai giao tiếp phân nhánh
            </div>
            <h3 className="text-base font-extrabold">{scenario.titleEn}</h3>
            <p className="text-xs text-blue-100">{scenario.settingVi}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-white/15 text-xs font-bold">
              Lượt {currentNode?.turnNumber ?? 1} · Điểm giao tiếp: {score}
            </span>
            <button
              type="button"
              onClick={() => setShowVi((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold"
            >
              <Languages className="w-3.5 h-3.5" />
              {showVi ? 'Ẩn dịch' : 'Hiện dịch'}
            </button>
            <button
              type="button"
              onClick={handleRestart}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Chơi lại
            </button>
          </div>
        </div>

        {/* Chat Log */}
        <div className="p-4 space-y-3 max-h-[380px] overflow-y-auto bg-slate-50/60">
          {history.map((turn, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${turn.speaker === 'student' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 border shadow-sm ${
                  turn.speaker === 'student'
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-white text-slate-900 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span
                    className={`text-[11px] font-bold ${
                      turn.speaker === 'student' ? 'text-blue-100' : 'text-indigo-700'
                    }`}
                  >
                    {turn.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => speakLabText(turn.textEn, accent)}
                    className={`p-1 rounded-md transition ${
                      turn.speaker === 'student'
                        ? 'hover:bg-blue-500 text-white'
                        : 'hover:bg-slate-100 text-blue-600'
                    }`}
                    title="Nghe câu thoại"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm font-medium leading-relaxed">{turn.textEn}</p>
                {showVi && turn.textVi && (
                  <p className="text-xs text-slate-500 mt-1 pt-1 border-t border-slate-100">{turn.textVi}</p>
                )}
              </div>

              {turn.feedbackVi && (
                <div className="mt-1.5 max-w-[88%] rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs text-emerald-900 flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    {turn.registerTag && <strong className="mr-1">[{turn.registerTag}]</strong>}
                    {turn.feedbackVi}
                    {turn.scoreDelta !== undefined && (
                      <strong className="ml-1 text-emerald-700">(+{turn.scoreDelta} điểm)</strong>
                    )}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Choices or Completion Evaluation */}
        <div className="p-4 border-t border-slate-200 bg-white space-y-2.5">
          {currentNode?.isEnd ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-sm">
                <Award className="w-5 h-5 text-emerald-600" />
                <span>Hoàn thành tình huống giao tiếp! Tổng điểm: {score}</span>
              </div>
              <p className="text-xs text-emerald-800">{currentNode.endSummaryVi}</p>
              <button
                type="button"
                onClick={handleRestart}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
              >
                Thử nhánh hội thoại khác
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                  Chọn câu trả lời phù hợp với vai của bạn ({scenario.studentRoleVi}):
                </span>
                {currentNode?.branchTag && (
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px]">
                    Nhánh: {currentNode.branchTag}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {(currentNode?.choices ?? []).map((ch, i) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => handleSelectChoice(ch)}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition flex items-start justify-between gap-2 group"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-800">
                        <span className="inline-block w-5 text-blue-600 font-bold">{String.fromCharCode(65 + i)}.</span>
                        {ch.textEn}
                      </div>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                      {ch.registerTag}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Helper Panel: Objective + Vocab/Structure Hints + Local Mic Recording */}
      <div className="lg:col-span-4 space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
          <div className="text-xs font-extrabold text-slate-900">Mục tiêu nhiệm vụ</div>
          <p className="text-xs text-slate-600 leading-relaxed">{scenario.objectiveVi}</p>
          <div className="text-xs text-slate-700 pt-1 border-t border-slate-100">
            <strong>Vai của bạn:</strong> {scenario.studentRoleVi}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              Gợi ý từ vựng & cấu trúc lượt này
            </span>
            <button
              type="button"
              onClick={() => setShowHints((v) => !v)}
              className="text-[11px] font-bold text-blue-600 hover:underline"
            >
              {showHints ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
          {showHints && currentNode && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {currentNode.vocabHints.map((v, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => speakLabText(v, accent)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold hover:bg-blue-100"
                  >
                    <Volume2 className="w-3 h-3" />
                    {v}
                  </button>
                ))}
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-700">
                <div className="font-bold text-slate-800 mb-0.5">Khung câu gợi ý:</div>
                <div className="italic">{currentNode.structureHintEn}</div>
              </div>
            </div>
          )}
        </div>

        {/* Local Voice Practice */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5">
          <div className="text-xs font-extrabold text-slate-900">Tự luyện nói & nghe lại (Micro cục bộ)</div>
          <p className="text-[11px] text-slate-600">
            Đọc to câu trả lời bạn chọn trước khi bấm gửi để rèn phản xạ giao tiếp tự nhiên.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleMic}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                isRecording
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {isRecording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              {isRecording ? 'Dừng ghi âm' : 'Ghi âm câu trả lời'}
            </button>
            {recordedUrl && (
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(recordedUrl);
                  setRecordedUrl(null);
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                title="Xóa bản ghi"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          {recordedUrl && <audio controls src={recordedUrl} className="w-full h-9" />}
          {micError && <p className="text-[11px] text-rose-600">{micError}</p>}
        </div>
      </div>
    </div>
  );
};
