import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Box,
  CheckCircle2,
  Clock,
  Database,
  Edit3,
  Eye,
  EyeOff,
  FileAudio,
  Headphones,
  HelpCircle,
  Info,
  Languages,
  Layers,
  Maximize2,
  Mic,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
  Square,
  Star,
  Trash2,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import type {
  GraphicsQuality,
  LabUserProgress,
  TeacherCustomization,
  UnitLabBundle,
} from '../../types/interactiveLab';
import type {BankQuestionRecord} from '../../types/exam';
import type {
  BuiltWorld3DScene,
  CameraViewMode,
  LearningMode3D,
  World3DDefinition,
  World3DRuntimeState,
} from '../../engine3d/types';
import {evaluateMissionProgress} from '../../engine3d/WorldMissions';
import {World3DStage} from '../../engine3d/World3DStage';
import {worldAudio} from '../../engine3d/AudioManager';
import {getSimulation2DByUnit} from '../../data/interactiveLab/simulations2D';
import {Simulation2DCanvas} from './engines/Simulation2DCanvas';
import {VisualVocabDrawer} from './engines/VisualVocabDrawer';
import {TeacherLabEditor} from './TeacherLabEditor';
import {InsertToLessonModal} from './InsertToLessonModal';
import {RichTextEditor} from '../editor/RichTextEditor';
import {QuestionRenderer, type QuestionAnswerMap} from '../interactive/QuestionRenderer';
import {
  bankRecordsToQuestionItems,
  getTransformationsByUnit,
  TRANSFORMATION_BANK_ATTRIBUTION,
} from '../../data/sentenceTransformationBank';
import {stripHtmlToPlainText} from '../../services/documentExportAdapter';
import {
  bulkSaveBankQuestionsToDB,
  getLabCustomizationByTarget,
  saveLabProgressToDB,
} from '../../services/storage';
import {
  speakLabText,
  startLocalMicRecording,
  type MicRecordingSession,
} from '../../services/labAudioService';

interface InteractiveWorldWorkspaceProps {
  bundle: UnitLabBundle;
  world3D?: World3DDefinition;
  initialMode: '3d' | '2d';
  progress: LabUserProgress;
  onUpdateProgress: (next: LabUserProgress) => void;
  onBack: () => void;
  onFullscreenChange?: (isFull: boolean) => void;
}

type BottomTab = 'skills' | 'vocab' | 'exam_bank' | 'teacher';
type SkillSubTab = 'listening' | 'speaking' | 'reading' | 'writing';

export const InteractiveWorldWorkspace: React.FC<InteractiveWorldWorkspaceProps> = ({
  bundle,
  world3D,
  initialMode,
  progress,
  onUpdateProgress,
  onBack,
  onFullscreenChange,
}) => {
  const sim2D = useMemo(() => getSimulation2DByUnit(bundle.unitId), [bundle.unitId]);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>(
    initialMode === '3d' && world3D ? '3d' : '2d'
  );
  const [learningMode, setLearningMode] = useState<LearningMode3D>('practice');
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('overview');
  const [quality, setQuality] = useState<GraphicsQuality>('standard');
  const [accent, setAccent] = useState<'en-GB' | 'en-US'>('en-GB');
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showHint, setShowHint] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Mission & 3D State
  const [missionIdx, setMissionIdx] = useState(0);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
    world3D?.objects[0]?.id ?? null
  );
  const [completedMissionIds, setCompletedMissionIds] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [challengeSec, setChallengeSec] = useState(0);
  const [lastFeedback, setLastFeedback] = useState<{
    en: string;
    vi: string;
    tone: 'ok' | 'warn';
  } | null>(null);
  const [sceneResetKey, setSceneResetKey] = useState(0);

  const sceneApiRef = useRef<BuiltWorld3DScene | null>(null);
  const [worldState, setWorldState] = useState<World3DRuntimeState>({
    flags: {},
    values: {},
    strings: {},
    actionHistory: [],
    heldItemId: null,
    characterPos: [0, 0, 4.4],
  });

  // Modals & Lower Tabs
  const [bottomTab, setBottomTab] = useState<BottomTab>('skills');
  const [skillTab, setSkillTab] = useState<SkillSubTab>('listening');
  const [insertOpen, setInsertOpen] = useState(false);
  const [customization, setCustomization] = useState<TeacherCustomization | null>(null);

  // 4-Skill interactive states
  const [showTranscript, setShowTranscript] = useState(false);
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);
  const [listeningAnswers, setListeningAnswers] = useState<Record<string, string>>({});
  const [listeningChecked, setListeningChecked] = useState(false);
  const [readingAnswers, setReadingAnswers] = useState<Record<string, string>>({});
  const [readingChecked, setReadingChecked] = useState(false);
  const [writingHtml, setWritingHtml] = useState<string>(
    progress.writingDrafts[bundle.unitId] || ''
  );
  const [writingSavedMsg, setWritingSavedMsg] = useState<string | null>(null);
  const [bankPushedMsg, setBankPushedMsg] = useState<string | null>(null);

  // Speaking local mic recorder
  const micRef = useRef<MicRecordingSession | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const targetSimId = viewMode === '3d' && world3D ? `WORLD3D-${world3D.unitId}` : bundle.sim2DId;
  const isFavorite = progress.favorites.includes(bundle.unitId);

  useEffect(() => {
    worldAudio.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    onFullscreenChange?.(isFullscreen);
    return () => onFullscreenChange?.(false);
  }, [isFullscreen, onFullscreenChange]);

  useEffect(() => {
    getLabCustomizationByTarget(targetSimId).then((c) => {
      setCustomization(c ?? null);
      if (c?.customAudioDataUrl) setCustomAudioUrl(c.customAudioDataUrl);
    });
  }, [targetSimId]);

  const unitCodeId = `gs${bundle.grade}-u${bundle.unitNumber}`;
  const unitTransformationItems = useMemo(
    () => bankRecordsToQuestionItems(getTransformationsByUnit(unitCodeId)),
    [unitCodeId],
  );
  const [tfAnswers, setTfAnswers] = useState<QuestionAnswerMap>({});
  const [tfChecked, setTfChecked] = useState(false);
  const [tfShowKey, setTfShowKey] = useState(false);

  useEffect(() => {
    setTfAnswers({});
    setTfChecked(false);
    setTfShowKey(false);
  }, [unitCodeId]);

  // Challenge timer
  useEffect(() => {
    if (learningMode !== 'challenge' || paused) return;
    const id = window.setInterval(() => setChallengeSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [learningMode, paused]);

  // Reset hints visibility when changing mode
  useEffect(() => {
    if (learningMode === 'challenge') {
      setShowHint(false);
      setShowTranslation(false);
    } else {
      setShowTranslation(true);
    }
  }, [learningMode]);

  const handleSceneReady = useCallback((api: BuiltWorld3DScene) => {
    sceneApiRef.current = api;
    setWorldState(api.getInitialState());
  }, []);

  const activeMission = world3D?.missions[missionIdx] ?? null;

  const handleExecuteAction = useCallback(
    (
      actionId: string,
      payload?: {objectId?: string; targetId?: string; value?: number | string | boolean}
    ) => {
      const api = sceneApiRef.current;
      if (!api) return;
      setWorldState((prev) => {
        const res = api.performAction(actionId, prev, payload);
        if (res.soundKey) worldAudio.playEffect(res.soundKey);
        if (res.spokenEn && !muted) worldAudio.speakEnglish(res.spokenEn, accent);
        if (res.feedbackVi || res.feedbackEn) {
          setLastFeedback({
            en: res.feedbackEn,
            vi: res.feedbackVi,
            tone: res.changed ? 'ok' : 'warn',
          });
        }

        // Check mission completion across all missions in this world
        if (world3D && res.changed) {
          const newlyCompleted: string[] = [];
          for (const m of world3D.missions) {
            const evalRes = evaluateMissionProgress(m, res.nextState.actionHistory);
            if (evalRes.completed) newlyCompleted.push(m.id);
          }
          if (newlyCompleted.length > 0) {
            setCompletedMissionIds((oldIds) => {
              const merged = Array.from(new Set([...oldIds, ...newlyCompleted]));
              const addedCount = merged.length - oldIds.length;
              if (addedCount > 0) {
                worldAudio.playEffect('success');
                setScore((sc) => sc + addedCount * 20);
                // Persist unit completion if all 5 missions finished
                if (merged.length >= world3D.missions.length) {
                  const nextProg: LabUserProgress = {
                    ...progress,
                    completedIds: Array.from(new Set([...progress.completedIds, bundle.unitId])),
                    quizScores: {
                      ...progress.quizScores,
                      [bundle.unitId]: {
                        correct: merged.length,
                        total: world3D.missions.length,
                        updatedAt: Date.now(),
                      },
                    },
                  };
                  saveLabProgressToDB(nextProg).then(onUpdateProgress);
                }
              }
              return merged;
            });
          }
        }
        return res.nextState;
      });
    },
    [accent, bundle.unitId, muted, onUpdateProgress, progress, world3D]
  );

  const handleResetSimulation = () => {
    if (sceneApiRef.current) {
      setWorldState(sceneApiRef.current.getInitialState());
    }
    setCompletedMissionIds([]);
    setScore(0);
    setChallengeSec(0);
    setLastFeedback(null);
    setSceneResetKey((k) => k + 1);
  };

  const handleToggleFavorite = async () => {
    const nextFavs = isFavorite
      ? progress.favorites.filter((id) => id !== bundle.unitId)
      : [...progress.favorites, bundle.unitId];
    const saved = await saveLabProgressToDB({...progress, favorites: nextFavs});
    onUpdateProgress(saved);
  };

  const handleSaveWriting = async () => {
    const nextProg: LabUserProgress = {
      ...progress,
      writingDrafts: {
        ...progress.writingDrafts,
        [bundle.unitId]: writingHtml,
      },
    };
    const saved = await saveLabProgressToDB(nextProg);
    onUpdateProgress(saved);
    setWritingSavedMsg('Đã lưu bài viết của bạn vào bộ nhớ máy!');
    window.setTimeout(() => setWritingSavedMsg(null), 3000);
  };

  const handlePushToExamBank = async () => {
    const now = Date.now();
    const records: BankQuestionRecord[] = [];
    const {listening, reading} = bundle.fourSkills;

    listening.questions.forEach((q, idx) => {
      records.push({
        id: `lab-bank-${bundle.unitId}-listen-${idx}-${now}`,
        grade: bundle.grade,
        textbookId: 'global_success',
        unitId: bundle.unitId,
        topic: bundle.titleEn,
        skill: 'listening',
        cognitiveLevel: idx === 0 ? 'recognition' : 'comprehension',
        questionType: 'mcq',
        format: 'mcq',
        prompt: q.prompt,
        options: (q.options ?? []).map((opt, oi) => ({
          id: `opt-${oi}`,
          label: opt.label || String.fromCharCode(65 + oi),
          text: opt.text,
        })),
        correctAnswer: q.correctAnswer,
        explanation: q.explanationVi,
        points: 0.25,
        sourceLabel: `Interactive World 2D/3D · Lớp ${bundle.grade} Unit ${bundle.unitNumber}`,
        audioTranscript: listening.transcript,
        verificationStatus: 'teacher_authored',
        tags: ['interactive-lab', bundle.unitId, 'listening'],
        createdAt: now,
        updatedAt: now,
      });
    });

    reading.questions.forEach((q, idx) => {
      records.push({
        id: `lab-bank-${bundle.unitId}-read-${idx}-${now}`,
        grade: bundle.grade,
        textbookId: 'global_success',
        unitId: bundle.unitId,
        topic: bundle.titleEn,
        skill: 'reading',
        cognitiveLevel: idx === 0 ? 'comprehension' : 'application',
        questionType: 'mcq',
        format: 'mcq',
        prompt: q.prompt,
        options: (q.options ?? []).map((opt, oi) => ({
          id: `opt-${oi}`,
          label: opt.label || String.fromCharCode(65 + oi),
          text: opt.text,
        })),
        correctAnswer: q.correctAnswer,
        explanation: q.explanationVi,
        points: 0.25,
        sourceLabel: `Interactive World 2D/3D · Lớp ${bundle.grade} Unit ${bundle.unitNumber}`,
        stimulusTitle: reading.title,
        stimulusParagraphs: reading.paragraphs,
        verificationStatus: 'teacher_authored',
        tags: ['interactive-lab', bundle.unitId, 'reading'],
        createdAt: now,
        updatedAt: now,
      });
    });

    await bulkSaveBankQuestionsToDB(records);
    setBankPushedMsg(
      `Đã đẩy ${records.length} câu hỏi chuẩn vào Ngân hàng đề thi (mục Soạn đề & Đánh giá)!`
    );
  };

  const handleToggleMic = async () => {
    setMicError(null);
    if (isRecording && micRef.current) {
      const url = await micRef.current.stop();
      setRecordedAudioUrl(url);
      setIsRecording(false);
      micRef.current = null;
      return;
    }
    try {
      const session = await startLocalMicRecording();
      micRef.current = session;
      setIsRecording(true);
    } catch {
      setMicError('Không thể truy cập micro trên trình duyệt. Hãy kiểm tra quyền ghi âm.');
    }
  };

  const handleUploadLocalAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setCustomAudioUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const metrics = useMemo(() => {
    if (!sceneApiRef.current) return [];
    return sceneApiRef.current.getMetrics(worldState);
  }, [worldState]);

  const selectedObjectMeta = useMemo(() => {
    if (!world3D) return null;
    return world3D.objects.find((o) => o.id === selectedObjectId) ?? world3D.objects[0] ?? null;
  }, [selectedObjectId, world3D]);

  const activeMissionEval = useMemo(() => {
    if (!activeMission) return null;
    return evaluateMissionProgress(activeMission, worldState.actionHistory);
  }, [activeMission, worldState.actionHistory]);

  const totalMissions = world3D?.missions.length ?? 0;
  const missionPct =
    totalMissions > 0 ? Math.round((completedMissionIds.length / totalMissions) * 100) : 0;

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const wordCount = stripHtmlToPlainText(writingHtml)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return (
    <div
      className={`${
        isFullscreen
          ? 'fixed inset-0 z-50 flex flex-col overflow-y-auto bg-slate-100 p-3 sm:p-4'
          : 'mx-auto max-w-[1440px] space-y-5 px-4 py-5 sm:px-6'
      }`}
    >
      {/* =====================================================================
          ZONE 1: LESSON TITLE, PROGRESS & ACTION BAR
         ===================================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onBack}
              className="mt-0.5 inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-[14px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Danh mục
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-blue-100 px-2.5 py-0.5 text-[13px] font-bold text-blue-800">
                  Lớp {bundle.grade} · Unit {bundle.unitNumber}
                </span>
                {world3D && (
                  <span className="rounded-md bg-emerald-100 px-2.5 py-0.5 text-[13px] font-bold text-emerald-800">
                    Không gian 3D & 2D
                  </span>
                )}
                {learningMode === 'challenge' && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-0.5 text-[13px] font-bold text-amber-900">
                    <Clock className="h-3.5 w-3.5" />
                    {formatTimer(challengeSec)}
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-[20px] font-bold leading-snug text-slate-900 sm:text-[22px]">
                {customization?.customTitle || world3D?.titleEn || bundle.titleEn}
              </h1>
              <p className="text-[15px] text-slate-600">
                {world3D?.titleVi || bundle.titleVi}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {world3D && (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2">
                <div>
                  <div className="text-[12px] font-semibold text-slate-500">Tiến độ nhiệm vụ</div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all"
                        style={{width: `${missionPct}%`}}
                      />
                    </div>
                    <span className="text-[14px] font-bold text-slate-900">
                      {completedMissionIds.length}/{totalMissions}
                    </span>
                  </div>
                </div>
                <div className="h-7 w-px bg-slate-200" />
                <div>
                  <div className="text-[12px] font-semibold text-slate-500">Điểm</div>
                  <div className="flex items-center gap-1 text-[15px] font-bold text-blue-700">
                    <Award className="h-4 w-4" />
                    {score}
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleToggleFavorite}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[14px] font-semibold transition-colors ${
                isFavorite
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              title="Lưu vào danh sách yêu thích"
            >
              <Star className={`h-4 w-4 ${isFavorite ? 'fill-amber-400 text-amber-500' : ''}`} />
              Yêu thích
            </button>

            <button
              type="button"
              onClick={() => setInsertOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-[14px] font-semibold text-white hover:bg-blue-700"
            >
              <Layers className="h-4 w-4" />
              Chèn vào bài giảng
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen((f) => !f)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-[14px] font-semibold text-slate-800 hover:bg-slate-50"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {isFullscreen ? 'Thu gọn' : 'Toàn màn hình'}
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          ZONE 2 & ZONE 3: EXPANSIVE 3D/2D VIEWPORT + MISSION & ACTION CONSOLE
         ===================================================================== */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
        {/* ZONE 2: SIMULATION TOOLBAR + CANVAS */}
        <div className="flex flex-col gap-3">
          {/* Ergonomic Control Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
            {/* Left group: 3D/2D Switch + Learning Modes */}
            <div className="flex flex-wrap items-center gap-2">
              {world3D && (
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('3d')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px] font-semibold transition-colors ${
                      viewMode === '3d'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <Box className="h-4 w-4" />
                    3D
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('2d')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px] font-semibold transition-colors ${
                      viewMode === '2d'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="h-4 w-4" />
                    2D
                  </button>
                </div>
              )}

              {viewMode === '3d' && world3D && (
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
                  {(
                    [
                      ['explore', 'Khám phá'],
                      ['practice', 'Thực hành'],
                      ['challenge', 'Thử thách'],
                    ] as const
                  ).map(([mId, mLabel]) => (
                    <button
                      key={mId}
                      type="button"
                      onClick={() => setLearningMode(mId)}
                      className={`rounded-lg px-3 py-1.5 text-[14px] font-semibold transition-colors ${
                        learningMode === mId
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {mLabel}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right group: Camera, Pause, Reset, Audio, Labels, Quality */}
            <div className="flex flex-wrap items-center gap-1.5">
              {viewMode === '3d' && world3D && (
                <>
                  <select
                    aria-label="Chọn góc nhìn Camera 3D"
                    value={cameraMode}
                    onChange={(e) => setCameraMode(e.target.value as CameraViewMode)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[14px] font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="overview">Góc nhìn: Toàn cảnh</option>
                    <option value="closeup">Góc nhìn: Cận cảnh</option>
                    {world3D.hasCharacter && <option value="character">Góc nhìn: Nhân vật</option>}
                    <option value="top">Góc nhìn: Từ trên xuống</option>
                  </select>

                  <select
                    aria-label="Chất lượng đồ họa 3D"
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as GraphicsQuality)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[14px] font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="eco">Đồ họa: Tiết kiệm</option>
                    <option value="standard">Đồ họa: Tiêu chuẩn</option>
                    <option value="high">Đồ họa: Cao</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setPaused((p) => !p)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[14px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    {paused ? 'Tiếp tục' : 'Tạm dừng'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowLabels((s) => !s)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[14px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {showLabels ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    Nhãn
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setAccent((a) => (a === 'en-GB' ? 'en-US' : 'en-GB'))}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[14px] font-bold text-blue-700 hover:bg-blue-50"
                title="Đổi giọng đọc Anh–Anh / Anh–Mỹ"
              >
                {accent === 'en-GB' ? 'UK' : 'US'}
              </button>

              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50"
                title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              >
                {muted ? <VolumeX className="h-4 w-4 text-rose-600" /> : <Volume2 className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={handleResetSimulation}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[14px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                Làm lại
              </button>
            </div>
          </div>

          {/* Main 3D or 2D Canvas Stage */}
          {viewMode === '3d' && world3D ? (
            <div
              className={`overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-md ${
                isFullscreen ? 'h-[62vh] min-h-[460px]' : 'h-[540px] lg:h-[600px]'
              }`}
            >
              <World3DStage
                key={`${world3D.unitId}-${sceneResetKey}`}
                worldDef={world3D}
                quality={quality}
                paused={paused}
                muted={muted}
                cameraMode={cameraMode}
                showLabels={showLabels}
                accent={accent}
                selectedObjectId={selectedObjectId}
                activeMission={activeMission}
                worldState={worldState}
                onSelectObject={setSelectedObjectId}
                onExecuteAction={handleExecuteAction}
                onSceneReady={handleSceneReady}
                onSwitchTo2D={() => setViewMode('2d')}
              />
            </div>
          ) : sim2D ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <Simulation2DCanvas
                scene={sim2D}
                selectedObjectId={selectedObjectId}
                onSelectObject={(obj) => setSelectedObjectId(obj.id)}
                accent={accent}
                customLabels={customization?.customObjectLabels}
              />
            </div>
          ) : null}

          {/* Honest Educational Note for Illustrative Metrics / Rule-based Simulation */}
          {viewMode === '3d' && world3D?.scientificDisclaimerVi && (
            <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[14px] leading-relaxed text-sky-950">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
              <span>{world3D.scientificDisclaimerVi}</span>
            </div>
          )}
        </div>

        {/* ZONE 3: MISSIONS, OBJECT ACTIONS & REAL-TIME METRICS */}
        <div className="flex flex-col gap-4">
          {/* Active Mission Panel (for 3D Worlds) */}
          {viewMode === '3d' && world3D && activeMission && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[14px] font-bold uppercase tracking-wide text-blue-700">
                  Nhiệm vụ {missionIdx + 1} / {world3D.missions.length}
                </span>
                <div className="flex items-center gap-1.5">
                  {world3D.missions.map((m, idx) => {
                    const done = completedMissionIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setMissionIdx(idx);
                          setShowHint(false);
                        }}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-[14px] font-bold transition-colors ${
                          idx === missionIdx
                            ? 'bg-blue-600 text-white'
                            : done
                              ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                        title={m.titleVi}
                      >
                        {done ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              <h2 className="mt-2.5 text-[17px] font-bold text-slate-900">
                {activeMission.titleEn}
              </h2>
              <p className="mt-1 text-[15px] leading-relaxed text-slate-800">
                {activeMission.commandEn}
              </p>

              {showTranslation && (
                <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[14px] leading-relaxed text-slate-700">
                  {activeMission.commandVi}
                </p>
              )}

              {/* Mission utility buttons */}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => worldAudio.speakEnglish(activeMission.commandEn, accent)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[14px] font-semibold text-blue-800 hover:bg-blue-100"
                >
                  <Volume2 className="h-4 w-4" />
                  Nghe yêu cầu
                </button>
                <button
                  type="button"
                  onClick={() => setShowTranslation((t) => !t)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[14px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Languages className="h-4 w-4" />
                  {showTranslation ? 'Ẩn dịch' : 'Hiện dịch'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowHint((h) => !h)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[14px] font-semibold text-amber-900 hover:bg-amber-100"
                >
                  <HelpCircle className="h-4 w-4" />
                  Gợi ý
                </button>
              </div>

              {showHint && (
                <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[14px] text-amber-950">
                  <strong>Gợi ý:</strong> {activeMission.hintVi}
                </div>
              )}

              {/* Ordered Step Verification Checklist */}
              {activeMissionEval && (
                <div className="mt-3.5 space-y-1.5 border-t border-slate-100 pt-3">
                  <div className="text-[13px] font-semibold text-slate-500">
                    {activeMission.ordered
                      ? 'Trình tự thao tác bắt buộc:'
                      : 'Các hạng mục cần hoàn thành:'}
                  </div>
                  {activeMission.requiredSequence.map((step, sIdx) => {
                    const done = activeMissionEval.stepStatuses[sIdx];
                    return (
                      <div
                        key={`${step.actionId}-${sIdx}`}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[14px] ${
                          done
                            ? 'bg-emerald-50 font-semibold text-emerald-900'
                            : 'bg-slate-50 text-slate-700'
                        }`}
                      >
                        <CheckCircle2
                          className={`h-4 w-4 shrink-0 ${
                            done ? 'text-emerald-600' : 'text-slate-300'
                          }`}
                        />
                        <span>
                          {sIdx + 1}. {step.labelEn}
                          {showTranslation ? ` (${step.labelVi})` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Selected 3D Object Action Console */}
          {viewMode === '3d' && world3D && selectedObjectMeta && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
                    Đối tượng đang chọn
                  </div>
                  <h3 className="text-[17px] font-bold text-slate-900">
                    {selectedObjectMeta.labelEn}
                  </h3>
                  <div className="text-[14px] text-slate-600">
                    {selectedObjectMeta.labelVi}{' '}
                    <span className="font-mono text-blue-700">{selectedObjectMeta.ipa}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => worldAudio.speakEnglish(selectedObjectMeta.labelEn, accent)}
                  className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-700 hover:bg-blue-100"
                  title="Nghe phát âm"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-2 text-[14px] leading-relaxed text-slate-700">
                {showTranslation
                  ? selectedObjectMeta.descriptionVi
                  : selectedObjectMeta.descriptionEn}
              </p>

              {/* Quick Object Switcher */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {world3D.objects.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedObjectId(o.id)}
                    className={`rounded-md px-2.5 py-1 text-[13px] font-semibold transition-colors ${
                      o.id === selectedObjectMeta.id
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {o.labelEn}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="mt-3.5 flex flex-col gap-2">
                {selectedObjectMeta.actions.map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() =>
                      handleExecuteAction(act.id, {objectId: selectedObjectMeta.id})
                    }
                    className="flex items-center justify-between rounded-xl bg-blue-600 px-4 py-2.5 text-left text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                  >
                    <span>
                      {act.labelEn}
                      {showTranslation && (
                        <span className="block text-[13px] font-normal text-blue-100">
                          {act.labelVi}
                        </span>
                      )}
                    </span>
                    <Sparkles className="h-4 w-4 shrink-0" />
                  </button>
                ))}
              </div>

              {/* Extra 4-DOF Joint Sliders for Grade 12 Unit 6 Robotics Lab */}
              {world3D.hasRobotControls && (
                <div className="mt-4 space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800">
                    <Sliders className="h-4 w-4 text-blue-700" />
                    Điều khiển góc khớp Robot thủ công (4-DOF)
                  </div>
                  {[
                    {key: 'baseYawDeg', label: 'Đế xoay (Base Yaw)', min: -100, max: 100},
                    {key: 'shoulderDeg', label: 'Khớp vai (Shoulder)', min: -75, max: 15},
                    {key: 'elbowDeg', label: 'Khuỷu tay (Elbow)', min: -115, max: -20},
                  ].map((j) => (
                    <div key={j.key} className="text-[13px]">
                      <div className="flex justify-between font-semibold text-slate-700">
                        <span>{j.label}</span>
                        <span>{worldState.values[j.key] ?? 0}°</span>
                      </div>
                      <input
                        type="range"
                        min={j.min}
                        max={j.max}
                        value={worldState.values[j.key] ?? 0}
                        onChange={(e) =>
                          handleExecuteAction('robot_joint_tune', {
                            objectId: 'robot_arm',
                            targetId: j.key,
                            value: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full accent-blue-600"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Instant Action Feedback */}
              {lastFeedback && (
                <div
                  className={`mt-3 rounded-xl border px-3.5 py-2.5 text-[14px] leading-relaxed ${
                    lastFeedback.tone === 'ok'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                      : 'border-amber-300 bg-amber-50 text-amber-950'
                  }`}
                >
                  <div className="font-semibold">{lastFeedback.en}</div>
                  {showTranslation && lastFeedback.vi && (
                    <div className="mt-0.5 text-[13px] opacity-90">{lastFeedback.vi}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Real-time Live Metrics Panel */}
          {viewMode === '3d' && metrics.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-slate-900">
                  Trạng thái & Chỉ số trực quan
                </h3>
                {metrics.some((m) => m.illustrative) && (
                  <span className="rounded bg-sky-100 px-2 py-0.5 text-[12px] font-semibold text-sky-800">
                    Minh họa
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {metrics.map((m) => (
                  <div key={m.id}>
                    <div className="flex items-center justify-between text-[14px]">
                      <span className="font-medium text-slate-700">{m.labelVi}</span>
                      <span className="font-bold text-slate-900">{m.value}</span>
                    </div>
                    <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          m.tone === 'good'
                            ? 'bg-emerald-500'
                            : m.tone === 'bad'
                              ? 'bg-rose-500'
                              : m.tone === 'warn'
                                ? 'bg-amber-500'
                                : 'bg-blue-500'
                        }`}
                        style={{width: `${Math.max(4, Math.min(100, m.percent))}%`}}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2D Mode Companion Summary Card */}
          {viewMode === '2d' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-[17px] font-bold text-slate-900">
                Hoạt động 2D — Lớp {bundle.grade} Unit {bundle.unitNumber}
              </h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-slate-700">
                {sim2D?.instructionVi ||
                  'Khám phá các thành phần trực quan, bấm nghe phát âm và thực hành câu hỏi tiếng Anh ngay bên dưới.'}
              </p>
              {world3D && (
                <button
                  type="button"
                  onClick={() => setViewMode('3d')}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-blue-700"
                >
                  <Box className="h-4 w-4" />
                  Chuyển sang Không gian 3D tương tác
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          INTEGRATED 4-SKILL, VOCABULARY, EXAM BANK & TEACHER CUSTOMIZATION TABS
         ===================================================================== */}
      {!isFullscreen && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 px-4 pt-3">
            {(
              [
                ['skills', '4 Kỹ năng (Nghe · Nói · Đọc · Viết)', Headphones],
                ['vocab', `Từ vựng trực quan (${bundle.vocab.length} từ)`, BookOpen],
                ['exam_bank', 'Đẩy câu hỏi sang Ngân hàng Đề thi', Database],
                ['teacher', 'Chỉnh sửa nội dung (Giáo viên)', Edit3],
              ] as const
            ).map(([tId, label, Icon]) => (
              <button
                key={tId}
                type="button"
                onClick={() => setBottomTab(tId)}
                className={`inline-flex items-center gap-2 rounded-t-xl border-b-2 px-4 py-2.5 text-[15px] font-semibold transition-colors ${
                  bottomTab === tId
                    ? 'border-blue-600 bg-white text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* TAB 1: 4 SKILLS (LISTENING / SPEAKING / READING / WRITING) */}
            {bottomTab === 'skills' && (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['listening', 'Listening (Nghe hiểu)'],
                      ['speaking', 'Speaking (Luyện nói)'],
                      ['reading', 'Reading (Đọc hiểu)'],
                      ['writing', 'Writing (Luyện viết)'],
                    ] as const
                  ).map(([sId, sLabel]) => (
                    <button
                      key={sId}
                      type="button"
                      onClick={() => setSkillTab(sId)}
                      className={`rounded-xl px-4 py-2 text-[15px] font-semibold transition-colors ${
                        skillTab === sId
                          ? 'bg-blue-600 text-white'
                          : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {sLabel}
                    </button>
                  ))}
                </div>

                {/* LISTENING */}
                {skillTab === 'listening' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                      <div>
                        <h3 className="text-[17px] font-bold text-slate-900">
                          {bundle.fourSkills.listening.title}
                        </h3>
                        <p className="text-[14px] text-slate-600">
                          {bundle.fourSkills.listening.contextVi} ({accent === 'en-GB' ? 'Anh–Anh' : 'Anh–Mỹ'})
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            speakLabText(bundle.fourSkills.listening.transcript, {accent})
                          }
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-[15px] font-semibold text-white hover:bg-blue-700"
                        >
                          <Play className="h-4 w-4" />
                          Phát bài nghe
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowTranscript((s) => !s)}
                          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[14px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {showTranscript ? 'Ẩn Transcript' : 'Hiện Transcript'}
                        </button>
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[14px] font-semibold text-slate-700 hover:bg-slate-50">
                          <FileAudio className="h-4 w-4" />
                          Tải MP3/WAV
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={handleUploadLocalAudio}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {customAudioUrl && (
                      <audio controls src={customAudioUrl} className="w-full" />
                    )}

                    {showTranscript && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[15px] leading-relaxed text-slate-800">
                        <div className="mb-1 font-bold text-slate-900">Audio Transcript:</div>
                        {bundle.fourSkills.listening.transcript}
                      </div>
                    )}

                    <div className="space-y-3">
                      {bundle.fourSkills.listening.questions.map((q, idx) => {
                        const chosen = listeningAnswers[q.id];
                        const isRight = chosen === q.correctAnswer;
                        const opts = q.options ?? [];
                        return (
                          <div
                            key={q.id}
                            className="rounded-xl border border-slate-200 p-4 text-[15px]"
                          >
                            <div className="font-semibold text-slate-900">
                              Câu {idx + 1}: {q.prompt}
                            </div>
                            <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                              {opts.map((opt) => (
                                <button
                                  key={`${q.id}-${opt.label}`}
                                  type="button"
                                  onClick={() =>
                                    setListeningAnswers((prev) => ({...prev, [q.id]: opt.label}))
                                  }
                                  className={`rounded-lg border px-3.5 py-2 text-left text-[15px] transition-colors ${
                                    chosen === opt.label
                                      ? 'border-blue-600 bg-blue-50 font-semibold text-blue-900'
                                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                                  }`}
                                >
                                  <strong>{opt.label}.</strong> {opt.text}
                                </button>
                              ))}
                            </div>
                            {listeningChecked && (
                              <div
                                className={`mt-2.5 flex items-start gap-2 rounded-lg p-2.5 text-[14px] ${
                                  isRight
                                    ? 'bg-emerald-50 text-emerald-900'
                                    : 'bg-rose-50 text-rose-900'
                                }`}
                              >
                                {isRight ? (
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                ) : (
                                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                                )}
                                <span>
                                  Đáp án đúng: <strong>{q.correctAnswer}</strong>. {q.explanationVi}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setListeningChecked(true)}
                        className="rounded-xl bg-emerald-600 px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-emerald-700"
                      >
                        Kiểm tra đáp án Nghe hiểu
                      </button>
                    </div>
                  </div>
                )}

                {/* SPEAKING */}
                {skillTab === 'speaking' && (
                  <div className="space-y-4 text-[15px]">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-[17px] font-bold text-slate-900">
                        {bundle.fourSkills.speaking.promptEn}
                      </h3>
                      <p className="mt-1 text-slate-600">{bundle.fourSkills.speaking.promptVi}</p>
                      <div className="mt-3">
                        <div className="font-semibold text-slate-800">Khung câu & Cụm từ gợi ý:</div>
                        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-slate-700">
                          {bundle.fourSkills.speaking.sentenceFrames.map((exp, i) => (
                            <li key={i} className="flex items-center justify-between gap-2">
                              <span>{exp}</span>
                              <button
                                type="button"
                                onClick={() => speakLabText(exp, {accent})}
                                className="rounded p-1 text-blue-600 hover:bg-blue-100"
                                title="Nghe mẫu"
                              >
                                <Volume2 className="h-4 w-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={handleToggleMic}
                          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[15px] font-semibold text-white ${
                            isRecording
                              ? 'bg-rose-600 hover:bg-rose-700'
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {isRecording ? (
                            <>
                              <Square className="h-4 w-4" />
                              Dừng ghi âm
                            </>
                          ) : (
                            <>
                              <Mic className="h-4 w-4" />
                              Ghi âm giọng nói (tại máy)
                            </>
                          )}
                        </button>
                        {recordedAudioUrl && (
                          <button
                            type="button"
                            onClick={() => setRecordedAudioUrl(null)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-[14px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Xóa bản ghi
                          </button>
                        )}
                      </div>
                      {micError && (
                        <p className="mt-2 text-[14px] font-medium text-rose-700">{micError}</p>
                      )}
                      {recordedAudioUrl && (
                        <div className="mt-3">
                          <audio controls src={recordedAudioUrl} className="w-full" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* READING */}
                {skillTab === 'reading' && (
                  <div className="space-y-4 text-[15px]">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-[18px] font-bold text-slate-900">
                          {bundle.fourSkills.reading.title}
                        </h3>
                        <button
                          type="button"
                          onClick={() =>
                            speakLabText(bundle.fourSkills.reading.paragraphs.join(' '), {accent})
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[14px] font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          <Volume2 className="h-4 w-4" />
                          Nghe đọc đoạn văn
                        </button>
                      </div>
                      <div className="mt-3 space-y-2.5 leading-relaxed text-slate-800">
                        {bundle.fourSkills.reading.paragraphs.map((para, pIdx) => (
                          <p key={pIdx}>{para}</p>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {bundle.fourSkills.reading.questions.map((q, idx) => {
                        const chosen = readingAnswers[q.id];
                        const isRight = chosen === q.correctAnswer;
                        const opts = q.options ?? [];
                        return (
                          <div key={q.id} className="rounded-xl border border-slate-200 p-4">
                            <div className="font-semibold text-slate-900">
                              Câu {idx + 1}: {q.prompt}
                            </div>
                            <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                              {opts.map((opt) => (
                                <button
                                  key={`${q.id}-${opt.label}`}
                                  type="button"
                                  onClick={() =>
                                    setReadingAnswers((prev) => ({...prev, [q.id]: opt.label}))
                                  }
                                  className={`rounded-lg border px-3.5 py-2 text-left text-[15px] ${
                                    chosen === opt.label
                                      ? 'border-blue-600 bg-blue-50 font-semibold text-blue-900'
                                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                                  }`}
                                >
                                  <strong>{opt.label}.</strong> {opt.text}
                                </button>
                              ))}
                            </div>
                            {readingChecked && (
                              <div
                                className={`mt-2.5 rounded-lg p-2.5 text-[14px] ${
                                  isRight
                                    ? 'bg-emerald-50 text-emerald-900'
                                    : 'bg-rose-50 text-rose-900'
                                }`}
                              >
                                Đáp án đúng: <strong>{q.correctAnswer}</strong>. {q.explanationVi}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setReadingChecked(true)}
                        className="rounded-xl bg-emerald-600 px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-emerald-700"
                      >
                        Kiểm tra đáp án Đọc hiểu
                      </button>
                    </div>
                  </div>
                )}

                {/* WRITING (Tiptap WYSIWYG) */}
                {skillTab === 'writing' && (
                  <div className="space-y-4 text-[15px]">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-[17px] font-bold text-slate-900">
                        {activeMission?.writingPromptEn || bundle.fourSkills.writing.promptEn}
                      </h3>
                      <p className="mt-1 text-slate-600">{bundle.fourSkills.writing.promptVi}</p>
                      <div className="mt-2.5 text-[14px] text-slate-700">
                        <strong>Gợi ý dàn ý:</strong>{' '}
                        {bundle.fourSkills.writing.outlineHints.join(' · ')}
                      </div>
                    </div>

                    <RichTextEditor
                      value={writingHtml}
                      onChange={setWritingHtml}
                      placeholder="Viết đoạn văn tiếng Anh của bạn tại đây (hỗ trợ bôi đậm, in nghiêng, gạch chân trực quan)..."
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[14px] font-semibold text-slate-600">
                        Số từ hiện tại: {wordCount} từ (mục tiêu:{' '}
                        {bundle.fourSkills.writing.minWords}–{bundle.fourSkills.writing.maxWords} từ)
                      </span>
                      <div className="flex items-center gap-3">
                        {writingSavedMsg && (
                          <span className="text-[14px] font-semibold text-emerald-700">
                            {writingSavedMsg}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={handleSaveWriting}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-blue-700"
                        >
                          <Save className="h-4 w-4" />
                          Lưu bài viết
                        </button>
                      </div>
                    </div>

                    {/* Curated Unit Sentence Transformation Practice (only for Units with matching grammar) */}
                    {unitTransformationItems.length > 0 && (
                      <div className="mt-6 pt-5 border-t border-slate-200 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="text-[16px] font-bold text-slate-900 flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-blue-600" />
                              Thực hành Viết lại câu đồng nghĩa — Lớp {bundle.grade} · Unit {bundle.unitNumber}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {TRANSFORMATION_BANK_ATTRIBUTION}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setTfChecked(true)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Kiểm tra câu viết lại
                            </button>
                            <button
                              type="button"
                              onClick={() => setTfShowKey((v) => !v)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {tfShowKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              {tfShowKey ? 'Ẩn đáp án' : 'Đáp án & Lời giải'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTfAnswers({});
                                setTfChecked(false);
                                setTfShowKey(false);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Làm lại
                            </button>
                          </div>
                        </div>

                        <QuestionRenderer
                          questions={unitTransformationItems}
                          answers={tfAnswers}
                          onChangeAnswer={(qId, val) => {
                            setTfAnswers((prev) => ({...prev, [qId]: val}));
                            setTfChecked(false);
                          }}
                          checked={tfChecked}
                          showAnswers={tfShowKey}
                          showExplanations={tfShowKey}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: VISUAL VOCABULARY DRAWER */}
            {bottomTab === 'vocab' && (
              <VisualVocabDrawer
                vocab={bundle.vocab}
                accent={accent}
                unitTitleEn={bundle.titleEn}
              />
            )}

            {/* TAB 3: PUSH TO EXAM QUESTION BANK */}
            {bottomTab === 'exam_bank' && (
              <div className="space-y-4 text-[15px]">
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-slate-800">
                  <h3 className="text-[17px] font-bold text-blue-950">
                    Đồng bộ câu hỏi sang Ngân hàng Đề kiểm tra
                  </h3>
                  <p className="mt-1">
                    Nhấn nút bên dưới để thêm toàn bộ câu hỏi Nghe hiểu (
                    {bundle.fourSkills.listening.questions.length} câu) và Đọc hiểu (
                    {bundle.fourSkills.reading.questions.length} câu) của{' '}
                    <strong>
                      Lớp {bundle.grade} · Unit {bundle.unitNumber}
                    </strong>{' '}
                    vào Ngân hàng đề thi dùng chung cho module <strong>Soạn đề & Đánh giá</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={handlePushToExamBank}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-blue-700"
                  >
                    <Database className="h-4 w-4" />
                    Đẩy câu hỏi vào Ngân hàng Đề thi
                  </button>
                  {bankPushedMsg && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-100 px-3.5 py-2 text-[14px] font-semibold text-emerald-900">
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                      {bankPushedMsg}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: TEACHER CUSTOMIZATION EDITOR */}
            {bottomTab === 'teacher' && (
              <TeacherLabEditor
                targetId={targetSimId}
                category={viewMode === '3d' && world3D ? 'sim_3d' : 'sim_2d'}
                defaultTitle={world3D?.titleEn || bundle.titleEn}
                defaultInstruction={
                  world3D?.subtitleVi || sim2D?.instructionVi || bundle.titleVi
                }
                defaultObjects={sim2D?.objects}
                defaultTranscript={bundle.fourSkills.listening.transcript}
                defaultSpeakingPrompt={bundle.fourSkills.speaking.promptEn}
                defaultWritingPrompt={bundle.fourSkills.writing.promptEn}
                existingCustomization={customization}
                onSaved={(saved) => {
                  setCustomization(saved);
                  if (saved?.customAudioDataUrl) setCustomAudioUrl(saved.customAudioDataUrl);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Insert into Lesson Modal */}
      <InsertToLessonModal
        open={insertOpen}
        onClose={() => setInsertOpen(false)}
        simulationRef={{
          simulationId: targetSimId,
          category: viewMode === '3d' && world3D ? 'sim_3d' : 'sim_2d',
          titleEn: world3D?.titleEn || bundle.titleEn,
          titleVi: world3D?.titleVi || bundle.titleVi,
          grade: bundle.grade,
          unitId: bundle.unitId,
          unitNumber: bundle.unitNumber,
          summaryVi: world3D?.subtitleVi || sim2D?.instructionVi,
        }}
      />
    </div>
  );
};
