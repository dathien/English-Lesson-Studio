import * as THREE from 'three';
import type {HighSchoolGrade} from '../types/lesson';
import type {GraphicsQuality} from '../types/interactiveLab';

export type World3DUnitId =
  | 'gs10-u1'
  | 'gs10-u2'
  | 'gs10-u3'
  | 'gs10-u5'
  | 'gs10-u9'
  | 'gs10-u10'
  | 'gs11-u3'
  | 'gs11-u5'
  | 'gs11-u6'
  | 'gs11-u10'
  | 'gs12-u2'
  | 'gs12-u3'
  | 'gs12-u4'
  | 'gs12-u6'
  | 'gs12-u8';

export type LearningMode3D = 'explore' | 'practice' | 'challenge';

export type CameraViewMode = 'overview' | 'closeup' | 'character' | 'top';

export interface WorldActionOption {
  id: string; // e.g. 'washer_open', 'clothes_load', 'washer_close', 'washer_start'
  labelEn: string;
  labelVi: string;
  objectId: string;
  requiresState?: Record<string, string | number | boolean>;
  hintIfBlockedVi?: string;
}

export interface WorldInteractiveObjectMeta {
  id: string;
  labelEn: string;
  labelVi: string;
  ipa: string;
  descriptionEn: string;
  descriptionVi: string;
  draggable?: boolean;
  dropTargetFor?: string[]; // list of objectIds that can be dropped here
  actions: WorldActionOption[];
}

export interface WorldMissionStep {
  actionId: string; // exact actionId recorded in actionLog OR state check
  labelEn: string;
  labelVi: string;
}

export interface WorldMissionDef {
  id: string;
  unitId: World3DUnitId;
  order: number;
  titleEn: string;
  titleVi: string;
  commandEn: string; // spoken by Listening prompt & displayed as English task
  commandVi: string;
  hintEn: string;
  hintVi: string;
  requiredSequence: WorldMissionStep[]; // verified IN ORDER for substantive completion
  ordered: boolean; // if true, steps must be performed in exact sequence
  points: number;
  targetObjectIds: string[];
  focusCameraPos?: [number, number, number];
  focusCameraTarget?: [number, number, number];
  vocabFocus: string[];
  writingPromptEn: string;
}

export interface World3DMetric {
  id: string;
  labelEn: string;
  labelVi: string;
  value: string;
  percent: number; // 0..100
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  illustrative?: boolean;
}

export interface World3DDefinition {
  unitId: World3DUnitId;
  grade: HighSchoolGrade;
  unitNumber: number;
  titleEn: string;
  titleVi: string;
  subtitleVi: string;
  environment: 'indoor' | 'outdoor' | 'studio';
  hasCharacter: boolean;
  hasDragDrop: boolean;
  hasPianoOrInstruments?: boolean;
  hasRobotControls?: boolean;
  initialCamera: {
    overview: {pos: [number, number, number]; target: [number, number, number]};
    closeup: {pos: [number, number, number]; target: [number, number, number]};
    top: {pos: [number, number, number]; target: [number, number, number]};
  };
  objects: WorldInteractiveObjectMeta[];
  missions: WorldMissionDef[]; // >= 5 substantive missions per Unit
  scientificDisclaimerVi?: string;
}

export interface World3DRuntimeState {
  flags: Record<string, boolean>;
  values: Record<string, number>;
  strings: Record<string, string>;
  actionHistory: Array<{actionId: string; objectId: string; timestamp: number}>;
  heldItemId: string | null;
  characterPos: [number, number, number];
}

export interface BuiltWorld3DScene {
  root: THREE.Group;
  interactables: THREE.Object3D[];
  draggables: THREE.Object3D[];
  dropZones: Array<{id: string; position: THREE.Vector3; radius: number; accepts: string[]}>;
  labelAnchors: Map<string, THREE.Vector3>;
  obstacles: Array<{minX: number; maxX: number; minZ: number; maxZ: number}>;
  walkBounds: {minX: number; maxX: number; minZ: number; maxZ: number};
  characterGroup?: THREE.Group;
  characterLimbs?: {
    leftLeg: THREE.Object3D;
    rightLeg: THREE.Object3D;
    leftArm: THREE.Object3D;
    rightArm: THREE.Object3D;
  };
  getInitialState: () => World3DRuntimeState;
  performAction: (
    actionId: string,
    state: World3DRuntimeState,
    payload?: {objectId?: string; targetId?: string; value?: number | string | boolean}
  ) => {
    changed: boolean;
    nextState: World3DRuntimeState;
    feedbackEn: string;
    feedbackVi: string;
    soundKey?: string;
    spokenEn?: string;
  };
  getMetrics: (state: World3DRuntimeState) => World3DMetric[];
  update: (
    elapsed: number,
    delta: number,
    state: World3DRuntimeState,
    paused: boolean
  ) => void;
  dispose: () => void;
}

export interface WorldStageProps {
  worldDef: World3DDefinition;
  quality: GraphicsQuality;
  paused: boolean;
  muted: boolean;
  cameraMode: CameraViewMode;
  showLabels: boolean;
  accent: 'en-GB' | 'en-US';
  selectedObjectId: string | null;
  activeMission: WorldMissionDef | null;
  worldState: World3DRuntimeState;
  onSelectObject: (objectId: string) => void;
  onExecuteAction: (
    actionId: string,
    payload?: {objectId?: string; targetId?: string; value?: number | string | boolean}
  ) => void;
  onSceneReady: (sceneApi: BuiltWorld3DScene) => void;
  onCharacterMove?: (pos: [number, number, number]) => void;
  onSwitchTo2D?: () => void;
}
