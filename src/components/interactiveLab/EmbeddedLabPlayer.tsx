import React, {useCallback, useMemo, useRef, useState} from 'react';
import {Box, CheckCircle2, Layers, RotateCcw, Volume2} from 'lucide-react';
import type {HighSchoolGrade} from '../../types/lesson';
import type {LabCategory} from '../../types/interactiveLab';
import {
  getWorld3DByUnitId,
  evaluateMissionProgress,
  isWorld3DUnit,
} from '../../engine3d/WorldMissions';
import {World3DStage} from '../../engine3d/World3DStage';
import {worldAudio} from '../../engine3d/AudioManager';
import type {BuiltWorld3DScene, World3DRuntimeState} from '../../engine3d/types';
import {getSimulation2DById, getSimulation2DByUnit} from '../../data/interactiveLab/simulations2D';
import {GRAMMAR_SIMULATIONS} from '../../data/interactiveLab/grammarSimulations';
import {PRONUNCIATION_SIMULATIONS} from '../../data/interactiveLab/pronunciationSimulations';
import {ROLEPLAY_SCENARIOS} from '../../data/interactiveLab/roleplayScenarios';
import {Simulation2DCanvas} from './engines/Simulation2DCanvas';
import {GrammarDynamicEngine} from './engines/GrammarDynamicEngine';
import {PronunciationLabEngine} from './engines/PronunciationLabEngine';
import {RolePlayEngine} from './engines/RolePlayEngine';

interface EmbeddedLabPlayerProps {
  labRef: {
    simulationId: string;
    category: LabCategory;
    titleEn: string;
    titleVi: string;
    grade: HighSchoolGrade;
    unitId?: string;
    unitNumber?: number;
    summaryVi?: string;
  };
}

export const EmbeddedLabPlayer: React.FC<EmbeddedLabPlayerProps> = ({labRef}) => {
  const [viewMode, setViewMode] = useState<'3d' | '2d'>(
    labRef.category === 'sim_3d' && labRef.unitId && isWorld3DUnit(labRef.unitId) ? '3d' : '2d'
  );
  const [selectedObjId, setSelectedObjId] = useState<string | null>(null);
  const [missionIndex, setMissionIndex] = useState(0);
  const [feedbackVi, setFeedbackVi] = useState<string>('');
  const sceneApiRef = useRef<BuiltWorld3DScene | null>(null);
  const [worldState, setWorldState] = useState<World3DRuntimeState>({
    flags: {},
    values: {},
    strings: {},
    actionHistory: [],
    heldItemId: null,
    characterPos: [0, 0, 4.4],
  });

  const world3D = useMemo(
    () => (labRef.unitId ? getWorld3DByUnitId(labRef.unitId) : undefined),
    [labRef.unitId]
  );
  const sim2D = useMemo(
    () =>
      getSimulation2DById(labRef.simulationId) ||
      (labRef.unitId ? getSimulation2DByUnit(labRef.unitId) : undefined),
    [labRef.simulationId, labRef.unitId]
  );

  const handleSceneReady = useCallback((api: BuiltWorld3DScene) => {
    sceneApiRef.current = api;
    setWorldState(api.getInitialState());
  }, []);

  const handleAction = useCallback(
    (actionId: string, payload?: {objectId?: string; targetId?: string; value?: number | string | boolean}) => {
      const api = sceneApiRef.current;
      if (!api) return;
      setWorldState((prev) => {
        const res = api.performAction(actionId, prev, payload);
        if (res.soundKey) worldAudio.playEffect(res.soundKey);
        if (res.spokenEn) worldAudio.speakEnglish(res.spokenEn, 'en-GB');
        setFeedbackVi(res.feedbackVi || res.feedbackEn);
        return res.nextState;
      });
    },
    []
  );

  // 1. Grammar / Pronunciation / Role-Play embedded players
  if (labRef.category === 'grammar') {
    const grammar = GRAMMAR_SIMULATIONS.find((g) => g.id === labRef.simulationId);
    if (grammar) {
      return (
        <div className="max-h-[68vh] overflow-y-auto rounded-xl bg-white p-4 text-slate-900">
          <GrammarDynamicEngine grammar={grammar} accent="en-GB" />
        </div>
      );
    }
  }

  if (labRef.category === 'pronunciation') {
    const pron = PRONUNCIATION_SIMULATIONS.find((p) => p.id === labRef.simulationId);
    if (pron) {
      return (
        <div className="max-h-[68vh] overflow-y-auto rounded-xl bg-white p-4 text-slate-900">
          <PronunciationLabEngine simulation={pron} accent="en-GB" />
        </div>
      );
    }
  }

  if (labRef.category === 'roleplay') {
    const rp = ROLEPLAY_SCENARIOS.find((r) => r.id === labRef.simulationId);
    if (rp) {
      return (
        <div className="max-h-[68vh] overflow-y-auto rounded-xl bg-white p-4 text-slate-900">
          <RolePlayEngine scenario={rp} accent="en-GB" />
        </div>
      );
    }
  }

  // 2. Interactive 3D World embedded inside Slide Presenter
  if (viewMode === '3d' && world3D) {
    const activeMission = world3D.missions[missionIndex] ?? world3D.missions[0];
    const selectedMeta =
      world3D.objects.find((o) => o.id === selectedObjId) ?? world3D.objects[0];
    const progress = evaluateMissionProgress(activeMission, worldState.actionHistory);

    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
          <div>
            <div className="text-[16px] font-bold text-slate-900">{world3D.titleEn}</div>
            <div className="text-[13px] text-slate-600">{activeMission.commandEn}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => worldAudio.speakEnglish(activeMission.commandEn, 'en-GB')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[13px] font-semibold text-blue-800 hover:bg-blue-100"
            >
              <Volume2 className="h-4 w-4" />
              Nghe lệnh
            </button>
            {sim2D && (
              <button
                type="button"
                onClick={() => setViewMode('2d')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Layers className="h-4 w-4" />
                Chuyển 2D
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (sceneApiRef.current) setWorldState(sceneApiRef.current.getInitialState());
                setFeedbackVi('');
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Làm lại
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_290px]">
          <div className="h-[410px] overflow-hidden rounded-xl border border-slate-200">
            <World3DStage
              worldDef={world3D}
              quality="standard"
              paused={false}
              muted={false}
              cameraMode="overview"
              showLabels={true}
              accent="en-GB"
              selectedObjectId={selectedObjId}
              activeMission={activeMission}
              worldState={worldState}
              onSelectObject={setSelectedObjId}
              onExecuteAction={handleAction}
              onSceneReady={handleSceneReady}
              onSwitchTo2D={() => setViewMode('2d')}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left">
            <div>
              <div className="flex items-center justify-between text-[13px] font-semibold text-blue-800">
                <span>Nhiệm vụ {missionIndex + 1}/{world3D.missions.length}</span>
                {progress.completed && (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Hoàn thành
                  </span>
                )}
              </div>
              <p className="mt-1 text-[14px] font-semibold text-slate-900">{activeMission.titleVi}</p>
              <p className="mt-0.5 text-[13px] text-slate-600">{activeMission.commandVi}</p>
              <div className="mt-2 flex gap-1.5">
                {world3D.missions.map((m, idx) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMissionIndex(idx)}
                    className={`h-7 w-7 rounded-md text-[12px] font-bold ${
                      idx === missionIndex
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {selectedMeta && (
              <div className="border-t border-slate-200 pt-2.5">
                <div className="text-[14px] font-bold text-slate-900">{selectedMeta.labelEn}</div>
                <div className="text-[12px] text-slate-600">{selectedMeta.labelVi} · {selectedMeta.ipa}</div>
                <div className="mt-2 flex flex-col gap-1.5">
                  {selectedMeta.actions.map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => handleAction(act.id, {objectId: selectedMeta.id})}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-left text-[13px] font-semibold text-white hover:bg-blue-700"
                    >
                      {act.labelEn}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {feedbackVi && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[13px] font-medium text-emerald-900">
                {feedbackVi}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. 2D Simulation fallback / direct player
  if (sim2D) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 shadow-lg">
        {world3D && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-[14px] font-semibold text-white hover:bg-blue-700"
            >
              <Box className="h-4 w-4" />
              Mở Không gian 3D
            </button>
          </div>
        )}
        <Simulation2DCanvas
          scene={sim2D}
          selectedObjectId={selectedObjId}
          onSelectObject={(obj) => setSelectedObjId(obj.id)}
          accent="en-GB"
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-[15px] text-slate-700">
      Đang tải mô phỏng tương tác: <strong>{labRef.titleEn}</strong> ({labRef.titleVi})
    </div>
  );
};
