import React, {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Activity,
  Box,
  CheckCircle2,
  Columns,
  Eye,
  EyeOff,
  Mic,
  Play,
  Square,
  Trash2,
  Volume2,
  Wind,
} from 'lucide-react';
import type {
  ArticulatorPose,
  PronunciationSimulation,
} from '../../../types/interactiveLab';
import {buildVocalTract3D} from './ThreeSceneBuilder';
import {
  playLabSoundEffect,
  playPitchContour,
  playStressBeatPattern,
  speakLabText,
  startLocalMicRecording,
  type MicRecordingSession,
} from '../../../services/labAudioService';

interface PronunciationLabEngineProps {
  simulation: PronunciationSimulation;
  accent: 'en-GB' | 'en-US';
  onAccentChange?: (next: 'en-GB' | 'en-US') => void;
  onActivityComplete?: (correct: number, total: number) => void;
}

const SagittalDiagram2D: React.FC<{
  pose: ArticulatorPose;
  showLabels: boolean;
  slowMotion: boolean;
  compact?: boolean;
}> = ({pose, showLabels, slowMotion, compact = false}) => {
  // Map normalized pose values (0..1) into clean SVG anatomical coordinates (viewBox 0 0 360 280)
  const jawOffset = pose.jawDrop * 24;
  const lipOpen = 8 + pose.lipOpening * 26;
  const lipRound = pose.lipRounding * 14;
  const tipX = 76 + pose.tongueTipX * 82;
  const tipY = 166 - pose.tongueTipY * 56 + jawOffset * 0.4;
  const bodyX = 148 + pose.tongueBodyX * 68;
  const bodyY = 180 - pose.tongueBodyY * 58 + jawOffset * 0.35;
  const velumY = pose.velumOpen ? 128 : 104;
  const airColor = pose.voiced ? '#f59e0b' : '#06b6d4';

  return (
    <svg
      viewBox="0 0 360 280"
      className={`w-full ${compact ? 'h-[220px]' : 'h-[290px]'} rounded-xl bg-slate-50 border border-slate-200`}
      role="img"
      aria-label={`Mặt cắt 2D cơ quan phát âm cho âm ${pose.phoneme}`}
    >
      {/* Head outer contour */}
      <path
        d="M 85 26 C 175 10, 295 36, 308 128 C 314 176, 292 228, 265 266 L 195 266 L 195 224 C 145 232, 92 232, 74 202 C 62 184, 70 165, 62 152 C 44 146, 44 128, 60 116 C 52 94, 62 46, 85 26 Z"
        fill="#f8fafc"
        stroke="#94a3b8"
        strokeWidth="2"
      />

      {/* Nasal cavity */}
      <path
        d="M 74 96 C 110 56, 206 54, 240 100 C 216 106, 178 96, 126 102 Z"
        fill={pose.velumOpen ? '#bae6fd' : '#e0f2fe'}
        stroke="#0284c7"
        strokeWidth="1.5"
      />

      {/* Hard palate & Alveolar ridge */}
      <path
        d="M 88 124 C 102 108, 146 98, 200 104"
        fill="none"
        stroke="#e11d48"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="96" cy="118" r="5" fill="#fb7185" />

      {/* Movable Soft Palate (Velum) */}
      <path
        d={`M 198 104 Q 222 ${velumY - 6}, 234 ${velumY}`}
        fill="none"
        stroke="#f43f5e"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Pharynx & Larynx airway */}
      <path
        d="M 244 100 L 244 256 L 218 256 L 218 148"
        fill="#fff1f2"
        stroke="#fda4af"
        strokeWidth="1.5"
      />

      {/* Upper & Lower Teeth */}
      <rect x="78" y="122" width="10" height="16" rx="2" fill="#ffffff" stroke="#64748b" strokeWidth="1.3" />
      <rect
        x="80"
        y={144 + jawOffset}
        width="10"
        height="15"
        rx="2"
        fill="#ffffff"
        stroke="#64748b"
        strokeWidth="1.3"
      />

      {/* Upper & Lower Lips */}
      <ellipse cx={64 - lipRound * 0.6} cy={130 - lipOpen * 0.25} rx={10 + lipRound * 0.35} ry="8" fill="#e11d48" />
      <ellipse
        cx={65 - lipRound * 0.6}
        cy={142 + lipOpen * 0.65 + jawOffset * 0.45}
        rx={10 + lipRound * 0.35}
        ry="8"
        fill="#e11d48"
      />

      {/* Articulated Tongue (Root + Body + Tip) */}
      <path
        d={`M 218 228 Q 214 190, ${bodyX} ${bodyY} Q ${(bodyX + tipX) / 2} ${Math.min(bodyY, tipY) - 8}, ${tipX} ${tipY} Q ${tipX + 18} ${tipY + 26}, 158 ${208 + jawOffset * 0.45} L 218 228 Z`}
        fill="#ef4444"
        fillOpacity="0.88"
        stroke="#b91c1c"
        strokeWidth="2"
      />

      {/* Vocal Cords in Larynx */}
      <g transform="translate(231, 232)">
        <ellipse
          cx="0"
          cy="0"
          rx={pose.voiced ? 11 : 9}
          ry="4.5"
          fill={pose.voiced ? '#f59e0b' : '#cbd5e1'}
          stroke={pose.voiced ? '#b45309' : '#64748b'}
          strokeWidth="1.5"
        />
        {pose.voiced && (
          <path
            d="M -16 0 Q -12 -6, -8 0 T 0 0 T 8 0 T 16 0"
            fill="none"
            stroke="#dc2626"
            strokeWidth="2"
          >
            <animate
              attributeName="opacity"
              values="0.3;1;0.3"
              dur={slowMotion ? '1.6s' : '0.45s'}
              repeatCount="indefinite"
            />
          </path>
        )}
      </g>

      {/* Animated Airflow Stream */}
      <path
        d={
          pose.velumOpen || pose.airflow === 'nasal'
            ? 'M 231 245 L 231 112 Q 204 74, 134 78 Q 92 84, 52 96'
            : `M 231 245 L 231 136 Q 186 116, ${Math.max(90, tipX)} ${Math.max(114, tipY - 12)} L 34 138`
        }
        fill="none"
        stroke={airColor}
        strokeWidth="3.2"
        strokeDasharray="6 6"
        strokeLinecap="round"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="24"
          to="0"
          dur={slowMotion ? '2.4s' : '0.85s'}
          repeatCount="indefinite"
        />
      </path>

      {/* Toggleable Anatomical Labels */}
      {showLabels && (
        <g fontSize="9.5" fontWeight="700" fill="#1e293b">
          <text x="12" y="92" fill="#0369a1">Khoang mũi</text>
          <text x="14" y="132" fill="#be123c">Môi</text>
          <text x="14" y="156" fill="#334155">Răng</text>
          <text x="108" y="42" fill="#be123c">Ngạc cứng</text>
          <line x1="138" y1="45" x2="146" y2="100" stroke="#94a3b8" strokeDasharray="2 2" />
          <text x="206" y="46" fill="#e11d48">Ngạc mềm (Velum)</text>
          <line x1="230" y1="50" x2="220" y2={velumY - 4} stroke="#94a3b8" strokeDasharray="2 2" />
          <text x="86" y="218" fill="#b91c1c">Đầu & Thân lưỡi</text>
          <text x="256" y="170" fill="#475569">Hầu</text>
          <text x="254" y="236" fill={pose.voiced ? '#b45309' : '#475569'}>
            {pose.voiced ? 'Dây thanh (Rung)' : 'Dây thanh (Mở)'}
          </text>
        </g>
      )}
    </svg>
  );
};

const VocalTract3DView: React.FC<{
  pose: ArticulatorPose;
  slowMotion: boolean;
}> = ({pose, slowMotion}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const poseRef = useRef(pose);
  poseRef.current = pose;
  const slowRef = useRef(slowMotion);
  slowRef.current = slowMotion;
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'low-power'});
    } catch {
      setFallback(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(el.clientWidth || 440, el.clientHeight || 300);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.innerHTML = '';
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f8fafc');
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = env.texture;

    const camera = new THREE.PerspectiveCamera(42, (el.clientWidth || 440) / (el.clientHeight || 300), 0.1, 40);
    camera.position.set(-0.6, 0.4, 5.4);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 2.6;
    controls.maxDistance = 9;
    controls.target.set(-0.25, 0.1, 0);

    scene.add(new THREE.HemisphereLight('#ffffff', '#cbd5e1', 0.95));
    const dir = new THREE.DirectionalLight('#ffffff', 1.25);
    dir.position.set(4, 6, 5);
    scene.add(dir);

    const tract = buildVocalTract3D(poseRef.current);
    scene.add(tract.root);

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 440;
      const h = el.clientHeight || 300;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(el);

    const clock = new THREE.Clock();
    let rafId = 0;
    const loop = () => {
      rafId = requestAnimationFrame(loop);
      tract.update(clock.elapsedTime, poseRef.current, slowRef.current);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.dispose();
      tract.dispose();
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
    };
  }, []);

  if (fallback) {
    return (
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
        Thiết bị hiện không hỗ trợ WebGL 3D. Vui lòng sử dụng chế độ Mặt cắt 2D ngay bên cạnh.
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
      <div ref={hostRef} className="w-full h-[290px]" />
      <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 shadow-sm">
        Kéo chuột để xoay mô hình khoang phát âm 3D · Cuộn để phóng to
      </div>
    </div>
  );
};

export const PronunciationLabEngine: React.FC<PronunciationLabEngineProps> = ({
  simulation,
  accent,
  onAccentChange,
  onActivityComplete,
}) => {
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [showLabels, setShowLabels] = useState(true);
  const [slowMotion, setSlowMotion] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [compareIdx, setCompareIdx] = useState(1);

  // Local microphone recorder
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const recorderRef = useRef<MicRecordingSession | null>(null);

  // Exercises state
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setSelectedIdx(0);
    setCompareIdx(simulation.phonemes.length > 1 ? 1 : 0);
    setCompareMode(false);
    setAnswers({});
    setSubmitted(false);
  }, [simulation.id, simulation.phonemes.length]);

  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  const activePose = simulation.phonemes[selectedIdx] ?? simulation.phonemes[0];
  const comparePose = simulation.phonemes[compareIdx] ?? simulation.phonemes[0];

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
      setMicError(err instanceof Error ? err.message : 'Không thể truy cập micro trên thiết bị.');
    }
  };

  const handleSubmitQuiz = () => {
    setSubmitted(true);
    let correct = 0;
    for (const q of simulation.exercises) {
      if ((answers[q.id] ?? '').trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
        correct++;
      }
    }
    playLabSoundEffect(correct > 0 ? 'correct' : 'click');
    onActivityComplete?.(correct, simulation.exercises.length);
  };

  return (
    <div className="space-y-5">
      {/* 1. Articulatory 2D + 3D Vocal Tract Studio */}
      {activePose && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
                <Wind className="w-3.5 h-3.5" />
                {simulation.code} · Phòng thí nghiệm Ngữ âm 2D & 3D
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 mt-1.5">
                {simulation.titleEn} <span className="text-slate-500 font-semibold">({simulation.titleVi})</span>
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">{simulation.objectiveVi}</p>
            </div>

            {/* Mode & Controls */}
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('2d')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    viewMode === '2d' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Mặt cắt 2D
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('3d')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    viewMode === '3d' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  <Box className="w-3.5 h-3.5" />
                  Khoang miệng 3D
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSlowMotion((v) => !v)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  slowMotion
                    ? 'bg-amber-100 border-amber-400 text-amber-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {slowMotion ? 'Chậm (0.5x)' : 'Tốc độ chuẩn'}
              </button>

              <button
                type="button"
                onClick={() => setShowLabels((v) => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                {showLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                Nhãn giải phẫu
              </button>

              {simulation.phonemes.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setCompareMode((v) => !v)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    compareMode
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  So sánh 2 âm
                </button>
              )}

              {onAccentChange && (
                <button
                  type="button"
                  onClick={() => onAccentChange(accent === 'en-GB' ? 'en-US' : 'en-GB')}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-blue-200 bg-blue-50 text-blue-800"
                >
                  Giọng: {accent === 'en-GB' ? 'Anh-Anh (UK)' : 'Anh-Mỹ (US)'}
                </button>
              )}
            </div>
          </div>

          {/* Phoneme Selector Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {simulation.phonemes.map((p, idx) => (
              <button
                key={`${p.phoneme}-${idx}`}
                type="button"
                onClick={() => {
                  setSelectedIdx(idx);
                  playLabSoundEffect('click');
                  if (p.sampleWords[0]) {
                    speakLabText(p.sampleWords[0].word, accent, slowMotion ? 0.65 : 0.92);
                  }
                }}
                className={`px-3.5 py-2 rounded-xl border text-left transition ${
                  idx === selectedIdx
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50 text-slate-800 border-slate-200 hover:border-blue-400'
                }`}
              >
                <div className="font-ipa text-base font-bold leading-none">{p.phoneme}</div>
                <div className={`text-[10px] mt-1 ${idx === selectedIdx ? 'text-blue-100' : 'text-slate-500'}`}>
                  {p.voiced ? 'Hữu thanh (Rung)' : 'Vô thanh'}
                </div>
              </button>
            ))}
          </div>

          {/* Main Visualizer: Single (2D or 3D) OR Compare 2 Sounds */}
          {compareMode && simulation.phonemes.length >= 2 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {pose: activePose, idx: selectedIdx, setIdx: setSelectedIdx, label: 'Âm A'},
                {pose: comparePose, idx: compareIdx, setIdx: setCompareIdx, label: 'Âm B'},
              ].map((slot) => (
                <div key={slot.label} className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">{slot.label}</span>
                    <select
                      value={slot.idx}
                      onChange={(e) => slot.setIdx(Number(e.target.value))}
                      className="text-xs font-ipa font-bold border border-slate-300 rounded-lg px-2 py-1 bg-white"
                    >
                      {simulation.phonemes.map((ph, i) => (
                        <option key={i} value={i}>
                          {ph.phoneme} — {ph.nameVi}
                        </option>
                      ))}
                    </select>
                  </div>
                  <SagittalDiagram2D pose={slot.pose} showLabels={showLabels} slowMotion={slowMotion} compact />
                  <div className="text-xs text-slate-700">
                    <strong>Vị trí:</strong> {slot.pose.placeVi} · <strong>Dây thanh:</strong>{' '}
                    {slot.pose.voiced ? 'Có rung' : 'Không rung'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-7">
                {viewMode === '2d' ? (
                  <SagittalDiagram2D pose={activePose} showLabels={showLabels} slowMotion={slowMotion} />
                ) : (
                  <VocalTract3DView pose={activePose} slowMotion={slowMotion} />
                )}
              </div>

              <div className="lg:col-span-5 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-ipa text-2xl font-extrabold text-blue-700">
                        {accent === 'en-US' && activePose.ipaUs ? activePose.ipaUs : activePose.phoneme}
                      </div>
                      <div className="text-xs font-bold text-slate-800">{activePose.nameVi}</div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        activePose.voiced
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-cyan-100 text-cyan-900'
                      }`}
                    >
                      {activePose.voiced ? 'Hữu thanh (Dây thanh rung)' : 'Vô thanh (Hơi thở)'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 space-y-1 pt-1 border-t border-slate-200">
                    <p><strong>Vị trí cấu âm:</strong> {activePose.placeVi}</p>
                    <p><strong>Phương thức:</strong> {activePose.mannerVi}</p>
                    <p><strong>Mẹo luyện phát âm:</strong> {activePose.tipVi}</p>
                  </div>
                </div>

                {/* Sample Words + Audio */}
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-slate-600">Từ mẫu (Bấm để nghe phát âm):</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activePose.sampleWords.map((sw, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => speakLabText(sw.word, accent, slowMotion ? 0.65 : 0.92)}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:border-blue-400 text-left transition"
                      >
                        <div>
                          <div className="text-sm font-bold text-slate-900">{sw.word}</div>
                          <div className="font-ipa text-xs text-blue-700">
                            {accent === 'en-US' && sw.ipaUs ? sw.ipaUs : sw.ipaUk}
                          </div>
                          <div className="text-[11px] text-slate-500">{sw.meaningVi}</div>
                        </div>
                        <Volume2 className="w-4 h-4 text-blue-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sample Sentence + Local Mic Practice */}
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-blue-900">Câu luyện tập</span>
                    <button
                      type="button"
                      onClick={() => speakLabText(activePose.sampleSentence, accent, slowMotion ? 0.72 : 0.94)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Nghe câu mẫu
                    </button>
                  </div>
                  <p className="text-xs font-medium text-slate-800">{activePose.sampleSentence}</p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleToggleMic}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        isRecording
                          ? 'bg-rose-600 text-white'
                          : 'bg-white border border-slate-300 text-slate-800 hover:border-blue-400'
                      }`}
                    >
                      {isRecording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-rose-600" />}
                      {isRecording ? 'Dừng ghi âm' : 'Ghi âm giọng đọc (cục bộ)'}
                    </button>
                    {recordedUrl && (
                      <div className="flex items-center gap-2">
                        <audio controls src={recordedUrl} className="h-8 max-w-[180px]" />
                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(recordedUrl);
                            setRecordedUrl(null);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                          title="Xóa bản ghi cục bộ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  {micError && <p className="text-[11px] text-rose-600">{micError}</p>}
                  <p className="text-[10px] text-slate-500">
                    Bản ghi âm chỉ lưu tạm trên thiết bị của bạn để tự nghe lại và so sánh với giọng mẫu (không gửi ra máy chủ, không chấm điểm AI giả lập).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Minimal Pairs Trainer (when present) */}
      {simulation.minimalPairs && simulation.minimalPairs.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h4 className="text-sm font-extrabold text-slate-900">
            Luyện cặp tối thiểu (Minimal Pairs — {simulation.minimalPairs.length} cặp đối chiếu)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {simulation.minimalPairs.map((mp) => (
              <div key={mp.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-ipa text-sm font-extrabold text-blue-700">{mp.pairLabel}</span>
                  <span className="text-[11px] text-slate-500">{mp.differenceVi}</span>
                </div>
                <div className="space-y-1.5">
                  {mp.pairs.map((pair, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 bg-white rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => speakLabText(pair.leftWord, accent, slowMotion ? 0.7 : 0.92)}
                        className="inline-flex items-center gap-1 font-bold text-slate-900 hover:text-blue-700"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                        {pair.leftWord} <span className="font-ipa font-normal text-slate-500">{pair.leftIpa}</span>
                      </button>
                      <span className="text-[10px] text-slate-400">vs</span>
                      <button
                        type="button"
                        onClick={() => speakLabText(pair.rightWord, accent, slowMotion ? 0.7 : 0.92)}
                        className="inline-flex items-center gap-1 font-bold text-slate-900 hover:text-emerald-700"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                        {pair.rightWord} <span className="font-ipa font-normal text-slate-500">{pair.rightIpa}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Word & Sentence Stress Rhythmic Bars */}
      {simulation.stressItems && simulation.stressItems.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h4 className="text-sm font-extrabold text-slate-900">
            Mô phỏng Trọng âm & Nhịp điệu (Stress & Rhythm Visualizer)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {simulation.stressItems.map((item, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{item.text}</div>
                    <div className="font-ipa text-xs text-blue-700">{item.ipaUk}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playStressBeatPattern(item.syllables.map((s) => s.stressed));
                      setTimeout(() => speakLabText(item.text, accent, slowMotion ? 0.72 : 0.92), 350);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
                  >
                    <Play className="w-3 h-3" />
                    Nghe nhịp
                  </button>
                </div>
                <div className="flex items-end gap-2 h-14 px-2">
                  {item.syllables.map((syl, sIdx) => (
                    <div key={sIdx} className="flex flex-col items-center gap-1 flex-1">
                      <div
                        className={`w-full rounded-t-lg transition-all ${
                          syl.stressed ? 'h-9 bg-blue-600' : 'h-4 bg-slate-300'
                        }`}
                      />
                      <span
                        className={`text-xs ${
                          syl.stressed ? 'font-extrabold text-blue-800' : 'font-medium text-slate-600'
                        }`}
                      >
                        {syl.text}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-600">{item.ruleVi}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Intonation Pitch Contour Visualizer */}
      {simulation.intonationItems && simulation.intonationItems.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-blue-600" />
            Biểu đồ Đường cao độ Ngữ điệu (Intonation Pitch Contour)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {simulation.intonationItems.map((item, idx) => {
              const pts = item.pitchPoints
                .map((p, i) => {
                  const x = 16 + (i / Math.max(1, item.pitchPoints.length - 1)) * 268;
                  const y = 74 - (p / 100) * 58;
                  return `${x},${y}`;
                })
                .join(' ');
              return (
                <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-indigo-700">{item.patternLabelVi}</span>
                    <button
                      type="button"
                      onClick={() => {
                        playPitchContour(item.pitchPoints);
                        setTimeout(() => speakLabText(item.sentence, accent, 0.9), 250);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Nghe ngữ điệu
                    </button>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{item.sentence}</p>
                  <svg viewBox="0 0 300 84" className="w-full h-20 bg-white rounded-lg border border-slate-200">
                    <polyline fill="none" stroke="#2563eb" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
                    {item.pitchPoints.map((p, i) => {
                      const x = 16 + (i / Math.max(1, item.pitchPoints.length - 1)) * 268;
                      const y = 74 - (p / 100) * 58;
                      return <circle key={i} cx={x} cy={y} r="4" fill="#1d4ed8" />;
                    })}
                  </svg>
                  <p className="text-[11px] text-slate-600">{item.meaningVi}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Connected Speech Linking / Elision / Assimilation */}
      {simulation.connectedItems && simulation.connectedItems.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h4 className="text-sm font-extrabold text-slate-900">
            Nối âm – Nuốt âm – Đồng hóa (Connected Speech)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {simulation.connectedItems.map((ci, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-slate-900">{ci.written}</span>
                  <button
                    type="button"
                    onClick={() => speakLabText(ci.written, accent, slowMotion ? 0.72 : 0.94)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Nghe
                  </button>
                </div>
                <div className="font-ipa text-xs text-blue-700 font-semibold">{ci.spokenIpa}</div>
                <p className="text-xs text-slate-600">{ci.highlightNoteVi}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Pronunciation Quick Check Exercises */}
      {simulation.exercises.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h4 className="text-sm font-extrabold text-slate-900">
            Bài kiểm tra nhận diện phát âm ({simulation.exercises.length} câu)
          </h4>
          <div className="space-y-3">
            {simulation.exercises.map((q, idx) => {
              const chosen = answers[q.id] ?? '';
              return (
                <div key={q.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
                  <div className="text-sm font-semibold text-slate-900">
                    Câu {idx + 1}. {q.prompt}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(q.options ?? []).map((opt) => {
                      const active = chosen === opt.label;
                      const isRight = submitted && opt.label === q.correctAnswer;
                      const isWrong = submitted && active && opt.label !== q.correctAnswer;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => {
                            if (!submitted) setAnswers((prev) => ({...prev, [q.id]: opt.label}));
                          }}
                          className={`text-left px-3 py-2 rounded-lg border text-xs font-medium transition ${
                            isRight
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold'
                              : isWrong
                                ? 'bg-rose-50 border-rose-500 text-rose-900'
                                : active
                                  ? 'bg-blue-600 border-blue-600 text-white font-bold'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400'
                          }`}
                        >
                          <span className="font-bold mr-1.5">{opt.label}.</span>
                          {opt.text}
                        </button>
                      );
                    })}
                  </div>
                  {submitted && (
                    <div className="text-xs text-slate-700 bg-white rounded-lg border border-slate-200 px-3 py-2">
                      <CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-600 mr-1" />
                      <strong>Đáp án {q.correctAnswer}:</strong> {q.explanationVi}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div>
            {!submitted ? (
              <button
                type="button"
                onClick={handleSubmitQuiz}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
              >
                Chấm điểm phát âm
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAnswers({});
                  setSubmitted(false);
                }}
                className="px-4 py-2 rounded-xl bg-slate-200 text-slate-800 text-xs font-bold"
              >
                Làm lại
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
