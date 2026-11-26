import React, {useEffect, useMemo, useState} from 'react';
import {
  CheckCircle2,
  Compass,
  Info,
  Music,
  RotateCcw,
  Sparkles,
  Volume2,
  XCircle,
} from 'lucide-react';
import type {
  InteractiveObject,
  SimulationScene2D,
} from '../../../types/interactiveLab';
import {
  playInstrumentSound,
  playLabSoundEffect,
  speakLabText,
} from '../../../services/labAudioService';

interface Simulation2DCanvasProps {
  scene: SimulationScene2D;
  selectedObjectId: string | null;
  onSelectObject: (obj: InteractiveObject) => void;
  accent?: 'en-GB' | 'en-US';
  customLabels?: Record<string, {labelEn: string; labelVi: string; descriptionVi: string}>;
  onActivityComplete?: () => void;
}

const THEME_BG: Record<string, string> = {
  home: 'from-amber-50 via-orange-50/40 to-sky-50',
  eco: 'from-emerald-50 via-teal-50/50 to-sky-50',
  music: 'from-slate-900 via-indigo-950 to-slate-900',
  community: 'from-rose-50 via-amber-50/40 to-sky-50',
  tech: 'from-slate-900 via-blue-950 to-cyan-950',
  world: 'from-sky-50 via-blue-50 to-indigo-50',
  classroom: 'from-indigo-50 via-white to-sky-50',
  heritage: 'from-amber-50 via-stone-100 to-orange-50',
  city: 'from-sky-100/70 via-slate-50 to-indigo-50',
  career: 'from-blue-50 via-slate-50 to-emerald-50',
};

export const Simulation2DCanvas: React.FC<Simulation2DCanvasProps> = ({
  scene,
  selectedObjectId,
  onSelectObject,
  accent = 'en-GB',
  customLabels,
  onActivityComplete,
}) => {
  const isDarkTheme = scene.sceneTheme === 'music' || scene.sceneTheme === 'tech';
  const [sliderValue, setSliderValue] = useState<number>(scene.sliderConfig?.defaultValue ?? 50);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [pendingObjectId, setPendingObjectId] = useState<string | null>(null);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{tone: 'good' | 'bad' | 'info'; message: string} | null>(null);
  const [playedIds, setPlayedIds] = useState<string[]>([]);

  useEffect(() => {
    setSliderValue(scene.sliderConfig?.defaultValue ?? 50);
    setAssignments({});
    setPendingObjectId(null);
    setOrderedIds([]);
    setFeedback(null);
    setPlayedIds([]);
  }, [scene.id, scene.sliderConfig?.defaultValue]);

  const getDisplay = (obj: InteractiveObject) => ({
    labelEn: customLabels?.[obj.id]?.labelEn || obj.labelEn,
    labelVi: customLabels?.[obj.id]?.labelVi || obj.labelVi,
    descriptionVi: customLabels?.[obj.id]?.descriptionVi || obj.descriptionVi,
  });

  const hasZoneTask = Boolean(
    scene.targetZones &&
      scene.targetZones.length > 0 &&
      (scene.mechanic === 'hotspot_drag_assign' ||
        scene.mechanic === 'sorting_bins' ||
        scene.mechanic === 'planner_builder' ||
        scene.mechanic === 'decision_board')
  );

  const assignableObjects = useMemo(
    () => (hasZoneTask ? scene.objects.filter((o) => Boolean(o.targetZoneId)) : []),
    [hasZoneTask, scene.objects]
  );

  const correctAssignmentsCount = useMemo(() => {
    let count = 0;
    for (const obj of assignableObjects) {
      if (assignments[obj.id] === obj.targetZoneId) count++;
    }
    return count;
  }, [assignableObjects, assignments]);

  const handleObjectTrigger = (obj: InteractiveObject) => {
    const disp = getDisplay(obj);
    onSelectObject(obj);

    if (!playedIds.includes(obj.id)) {
      const next = [...playedIds, obj.id];
      setPlayedIds(next);
      if (!hasZoneTask && scene.mechanic !== 'timeline_order' && next.length >= Math.min(4, scene.objects.length)) {
        onActivityComplete?.();
      }
    }

    if (scene.mechanic === 'music_stage' && obj.soundType && obj.soundType !== 'speech') {
      playInstrumentSound(obj.soundType);
      setTimeout(() => speakLabText(disp.labelEn, accent), 380);
      setFeedback({
        tone: 'info',
        message: `Đang phát âm thanh mô phỏng nhạc cụ "${disp.labelEn}" (${disp.labelVi}).`,
      });
      return;
    }

    playLabSoundEffect('click');
    speakLabText(disp.labelEn, accent);

    if (hasZoneTask && obj.targetZoneId) {
      setPendingObjectId(obj.id);
      setFeedback({
        tone: 'info',
        message: `Đã chọn "${disp.labelEn}". Hãy kéo hoặc bấm vào khu vực phù hợp để ghép.`,
      });
    } else if (scene.mechanic === 'timeline_order' || scene.mechanic === 'food_chain' || scene.mechanic === 'workflow_nodes') {
      if (!orderedIds.includes(obj.id)) {
        const expectedIdx = orderedIds.length;
        const expectedObj = scene.objects[expectedIdx];
        if (expectedObj && expectedObj.id === obj.id) {
          const nextOrder = [...orderedIds, obj.id];
          setOrderedIds(nextOrder);
          playLabSoundEffect('correct');
          setFeedback({
            tone: 'good',
            message: `Chính xác bước ${nextOrder.length}/${scene.objects.length}: ${disp.labelEn} (${disp.labelVi}).`,
          });
          if (nextOrder.length === scene.objects.length) {
            onActivityComplete?.();
          }
        } else {
          playLabSoundEffect('incorrect');
          setFeedback({
            tone: 'bad',
            message: `Chưa đúng thứ tự! Gợi ý bước tiếp theo: "${expectedObj?.labelVi ?? ''}".`,
          });
        }
      }
    }
  };

  const assignObjectToZone = (objectId: string, zoneId: string) => {
    const obj = scene.objects.find((o) => o.id === objectId);
    const zone = scene.targetZones?.find((z) => z.id === zoneId);
    if (!obj || !zone) return;

    const isCorrect = obj.targetZoneId === zoneId;
    if (isCorrect) {
      playLabSoundEffect('correct');
      const next = {...assignments, [objectId]: zoneId};
      setAssignments(next);
      setPendingObjectId(null);
      setFeedback({
        tone: 'good',
        message: `Chính xác! "${getDisplay(obj).labelEn}" thuộc khu vực "${zone.labelEn}" (${zone.labelVi}).`,
      });
      const done = assignableObjects.every((item) => next[item.id] === item.targetZoneId);
      if (done) onActivityComplete?.();
    } else {
      playLabSoundEffect('incorrect');
      setFeedback({
        tone: 'bad',
        message: `"${getDisplay(obj).labelEn}" chưa phù hợp với "${zone.labelVi}". Thử chọn khu vực khác nhé!`,
      });
    }
  };

  const resetInteraction = () => {
    setAssignments({});
    setPendingObjectId(null);
    setOrderedIds([]);
    setSliderValue(scene.sliderConfig?.defaultValue ?? 50);
    setFeedback(null);
    playLabSoundEffect('click');
  };

  const bgGradient = THEME_BG[scene.sceneTheme] ?? 'from-blue-50 via-white to-slate-50';

  return (
    <div className="space-y-3">
      {/* Main Interactive 2D Stage */}
      <div
        className={`relative rounded-2xl border overflow-hidden ${
          isDarkTheme ? 'border-slate-700 text-white' : 'border-slate-200 text-slate-900'
        } bg-gradient-to-br ${bgGradient}`}
      >
        {/* Top Stage Bar */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b ${
            isDarkTheme ? 'border-slate-700/80 bg-slate-900/70' : 'border-slate-200/80 bg-white/85'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            {scene.mechanic === 'music_stage' ? (
              <Music className="w-4 h-4 text-cyan-400" />
            ) : (
              <Compass className={`w-4 h-4 ${isDarkTheme ? 'text-cyan-400' : 'text-blue-600'}`} />
            )}
            <span>{scene.instructionVi}</span>
          </div>
          <div className="flex items-center gap-2">
            {hasZoneTask && (
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800">
                Hoàn thành: {correctAssignmentsCount}/{assignableObjects.length}
              </span>
            )}
            {(scene.mechanic === 'timeline_order' ||
              scene.mechanic === 'food_chain' ||
              scene.mechanic === 'workflow_nodes') && (
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-800">
                Chuỗi bước: {orderedIds.length}/{scene.objects.length}
              </span>
            )}
            <button
              type="button"
              onClick={resetInteraction}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                isDarkTheme
                  ? 'border-slate-600 text-slate-200 hover:bg-slate-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Làm lại
            </button>
          </div>
        </div>

        {/* Before/After Interactive Slider Mode */}
        {scene.mechanic === 'before_after_slider' && scene.sliderConfig && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white/95 p-3.5 text-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {scene.sliderConfig.leftLabel}
                  </span>
                  <span className="text-xs font-bold text-amber-700">
                    Mức hiện tại: {sliderValue} {scene.sliderConfig.unitLabel}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {(sliderValue < 50 ? scene.sliderConfig.metricsAtMin : scene.sliderConfig.metricsAtMax).map(
                    (m, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200"
                      >
                        <span className="font-medium text-slate-700">{m.label}</span>
                        <span
                          className={`font-bold ${
                            m.tone === 'good'
                              ? 'text-emerald-700'
                              : m.tone === 'warn'
                                ? 'text-amber-700'
                                : 'text-rose-700'
                          }`}
                        >
                          {m.value}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white/95 p-3.5 text-slate-800 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-blue-700 mb-1">
                    Điều chỉnh thanh trượt mô phỏng
                  </div>
                  <p className="text-xs text-slate-600 mb-3">
                    Kéo thanh trượt để so sánh sự thay đổi trực quan giữa hai trạng thái và quan sát chỉ số cập nhật tức thì.
                  </p>
                </div>
                <div>
                  <input
                    type="range"
                    min={scene.sliderConfig.min}
                    max={scene.sliderConfig.max}
                    value={sliderValue}
                    onChange={(e) => {
                      setSliderValue(Number(e.target.value));
                      onActivityComplete?.();
                    }}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-[11px] font-semibold text-slate-600 mt-1">
                    <span>{scene.sliderConfig.leftLabel}</span>
                    <span>{scene.sliderConfig.rightLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Interactive SVG Spatial Canvas */}
        <div className="relative h-[360px] md:h-[400px] w-full overflow-hidden">
          {/* Decorative Grid + Connecting Paths SVG */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <defs>
              <pattern id={`grid-${scene.id}`} width="10" height="10" patternUnits="userSpaceOnUse">
                <path
                  d="M 10 0 L 0 0 0 10"
                  fill="none"
                  stroke={isDarkTheme ? 'rgba(148,163,184,0.14)' : 'rgba(148,163,184,0.22)'}
                  strokeWidth="0.25"
                />
              </pattern>
            </defs>
            <rect width="100" height="100" fill={`url(#grid-${scene.id})`} />

            {/* Connecting arrows for timeline / food_chain / workflow */}
            {(scene.mechanic === 'timeline_order' ||
              scene.mechanic === 'food_chain' ||
              scene.mechanic === 'workflow_nodes') &&
              scene.objects.slice(0, -1).map((obj, idx) => {
                const next = scene.objects[idx + 1];
                const isDone = orderedIds.includes(obj.id) && orderedIds.includes(next.id);
                return (
                  <line
                    key={`edge-${obj.id}`}
                    x1={obj.x}
                    y1={obj.y}
                    x2={next.x}
                    y2={next.y}
                    stroke={isDone ? '#10b981' : isDarkTheme ? '#64748b' : '#94a3b8'}
                    strokeWidth={isDone ? '0.8' : '0.45'}
                    strokeDasharray={isDone ? undefined : '1.5 1'}
                  />
                );
              })}

            {/* Visual dynamic tint for before/after slider */}
            {scene.mechanic === 'before_after_slider' && (
              <rect
                x="0"
                y="0"
                width={Math.min(100, Math.max(0, sliderValue))}
                height="100"
                fill="rgba(16, 185, 129, 0.14)"
              />
            )}
          </svg>

          {/* Target Drop Zones (for drag-assign / sorting bins / planner / decision board) */}
          {hasZoneTask &&
            scene.targetZones?.map((zone) => {
              const assignedHere = scene.objects.filter((o) => assignments[o.id] === zone.id);
              return (
                <div
                  key={zone.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData('text/plain');
                    if (draggedId) assignObjectToZone(draggedId, zone.id);
                  }}
                  onClick={() => {
                    if (pendingObjectId) {
                      assignObjectToZone(pendingObjectId, zone.id);
                    }
                  }}
                  style={{
                    left: `${zone.x}%`,
                    top: `${zone.y}%`,
                    transform: 'translate(-50%, -50%)',
                    borderColor: zone.accentHex || '#2563eb',
                  }}
                  className={`absolute min-w-[145px] max-w-[195px] rounded-xl border-2 border-dashed p-2.5 text-center transition cursor-pointer ${
                    pendingObjectId
                      ? 'bg-blue-50/95 ring-2 ring-blue-400/60 scale-[1.02]'
                      : isDarkTheme
                        ? 'bg-slate-800/90 text-white'
                        : 'bg-white/92 text-slate-800'
                  }`}
                >
                  <div className="text-xs font-extrabold leading-tight" style={{color: zone.accentHex || '#1d4ed8'}}>
                    {zone.labelEn}
                  </div>
                  <div className={`text-[11px] mt-0.5 ${isDarkTheme ? 'text-slate-300' : 'text-slate-600'}`}>
                    {zone.labelVi}
                  </div>
                  {assignedHere.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                      {assignedHere.map((item) => (
                        <span
                          key={item.id}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {getDisplay(item).labelEn}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          {/* Interactive Objects / Hotspots */}
          {scene.objects.map((obj, idx) => {
            const disp = getDisplay(obj);
            const isSelected = selectedObjectId === obj.id || pendingObjectId === obj.id;
            const isAssigned = Boolean(assignments[obj.id]);
            const orderNum = orderedIds.indexOf(obj.id) + 1;

            return (
              <button
                key={obj.id}
                type="button"
                draggable={hasZoneTask && !isAssigned}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', obj.id);
                  setPendingObjectId(obj.id);
                }}
                onClick={() => handleObjectTrigger(obj)}
                style={{
                  left: `${obj.x}%`,
                  top: `${obj.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute group px-3 py-2 rounded-xl border shadow-sm text-left transition-all max-w-[185px] ${
                  isAssigned
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-900 opacity-85'
                    : isSelected
                      ? 'bg-blue-600 text-white border-blue-700 ring-4 ring-blue-300/40 z-20 scale-105'
                      : isDarkTheme
                        ? 'bg-slate-800/95 text-white border-slate-600 hover:border-cyan-400 z-10'
                        : 'bg-white text-slate-800 border-slate-300 hover:border-blue-500 hover:shadow-md z-10'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{backgroundColor: isSelected ? '#ffffff' : obj.accentHex || '#2563eb'}}
                  />
                  <span className="text-xs font-bold leading-tight truncate">{disp.labelEn}</span>
                  <Volume2 className="w-3 h-3 shrink-0 opacity-75" />
                </div>
                <div
                  className={`text-[11px] leading-tight mt-0.5 truncate ${
                    isSelected ? 'text-blue-100' : isDarkTheme ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {disp.labelVi}
                </div>
                {orderNum > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shadow">
                    {orderNum}
                  </span>
                )}
                {!orderNum &&
                  (scene.mechanic === 'timeline_order' ||
                    scene.mechanic === 'food_chain' ||
                    scene.mechanic === 'workflow_nodes') && (
                    <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center">
                      ?
                    </span>
                  )}
                {scene.mechanic === 'music_stage' && (
                  <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded bg-cyan-500 text-white text-[9px] font-bold">
                    #{idx + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Interaction Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
            feedback.tone === 'good'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : feedback.tone === 'bad'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          {feedback.tone === 'good' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : feedback.tone === 'bad' ? (
            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Scientific / Pedagogical Accuracy Note */}
      {scene.scientificNote && (
        <div className="flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-600">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <span>{scene.scientificNote}</span>
        </div>
      )}
    </div>
  );
};
