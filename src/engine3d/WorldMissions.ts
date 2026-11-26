import type {
  World3DDefinition,
  World3DRuntimeState,
  World3DUnitId,
  WorldMissionDef,
} from './types';
import {WORLDS_GRADE_10} from './missionsGrade10';
import {WORLDS_GRADE_11} from './missionsGrade11';
import {WORLDS_GRADE_12} from './missionsGrade12';

export const WORLD_3D_DEFINITIONS: World3DDefinition[] = [
  ...WORLDS_GRADE_10,
  ...WORLDS_GRADE_11,
  ...WORLDS_GRADE_12,
];

export const WORLD_3D_UNIT_IDS: World3DUnitId[] = WORLD_3D_DEFINITIONS.map((w) => w.unitId);

export const TOTAL_3D_MISSIONS: number = WORLD_3D_DEFINITIONS.reduce(
  (sum, w) => sum + w.missions.length,
  0
);

export function getWorld3DByUnitId(unitId: string): World3DDefinition | undefined {
  return WORLD_3D_DEFINITIONS.find((w) => w.unitId === unitId);
}

export function isWorld3DUnit(unitId: string): unitId is World3DUnitId {
  return WORLD_3D_UNIT_IDS.includes(unitId as World3DUnitId);
}

export interface MissionEvaluation {
  completed: boolean;
  completedStepCount: number;
  totalSteps: number;
  nextRequiredActionId: string | null;
  stepStatuses: boolean[];
}

export function evaluateMissionProgress(
  mission: WorldMissionDef,
  actionHistory: World3DRuntimeState['actionHistory']
): MissionEvaluation {
  const totalSteps = mission.requiredSequence.length;
  if (totalSteps === 0) {
    return {
      completed: true,
      completedStepCount: 0,
      totalSteps: 0,
      nextRequiredActionId: null,
      stepStatuses: [],
    };
  }

  if (!mission.ordered) {
    const doneSet = new Set(actionHistory.map((h) => h.actionId));
    let doneCount = 0;
    let nextId: string | null = null;
    const stepStatuses: boolean[] = [];
    for (const step of mission.requiredSequence) {
      const done = doneSet.has(step.actionId);
      stepStatuses.push(done);
      if (done) {
        doneCount++;
      } else if (!nextId) {
        nextId = step.actionId;
      }
    }
    return {
      completed: doneCount === totalSteps,
      completedStepCount: doneCount,
      totalSteps,
      nextRequiredActionId: nextId,
      stepStatuses,
    };
  }

  let stepIdx = 0;
  for (const ev of actionHistory) {
    if (stepIdx < totalSteps && ev.actionId === mission.requiredSequence[stepIdx].actionId) {
      stepIdx++;
    }
  }
  const stepStatuses = mission.requiredSequence.map((_, i) => i < stepIdx);

  return {
    completed: stepIdx === totalSteps,
    completedStepCount: stepIdx,
    totalSteps,
    nextRequiredActionId: stepIdx < totalSteps ? mission.requiredSequence[stepIdx].actionId : null,
    stepStatuses,
  };
}
