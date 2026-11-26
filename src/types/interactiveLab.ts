import type {CognitiveLevel, HighSchoolGrade, SkillCategory} from './lesson';

export type LabCategory =
  | 'sim_2d'
  | 'sim_3d'
  | 'grammar'
  | 'pronunciation'
  | 'roleplay';

export type GraphicsQuality = 'eco' | 'standard' | 'high';

export type SourceProvenance =
  | 'textbook_reference'
  | 'teacher_authored_interactive'
  | 'topic_extension'
  | 'pending_verification';

export const SOURCE_PROVENANCE_LABELS: Record<
  SourceProvenance,
  {label: string; shortLabel: string; badgeClass: string}
> = {
  textbook_reference: {
    label: 'Tham chiếu chủ đề SGK Global Success (GDPT 2018)',
    shortLabel: 'Tham chiếu SGK',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  teacher_authored_interactive: {
    label: 'Học liệu tương tác biên soạn theo chủ đề Unit',
    shortLabel: 'Tương tác biên soạn',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  topic_extension: {
    label: 'Từ vựng / tình huống mở rộng cùng chủ điểm',
    shortLabel: 'Mở rộng chủ đề',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  pending_verification: {
    label: 'Cần giáo viên đối chiếu theo bộ sách của trường',
    shortLabel: 'Cần đối chiếu',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
};

export interface SourceReferenceNote {
  id: string;
  label: string;
  provenance: SourceProvenance;
  detail: string;
}

export interface LabVocabularyItem {
  id: string;
  unitId: string;
  word: string;
  ipaUk: string;
  ipaUs?: string;
  partOfSpeech: string;
  meaningVi: string;
  example: string;
  contextNote: string;
  objectRefId?: string;
  provenance: SourceProvenance;
}

export interface InteractiveObject {
  id: string;
  labelEn: string;
  labelVi: string;
  ipa: string;
  descriptionVi: string;
  exampleEn: string;
  category?: string;
  // Normalized 2D coordinates (0..100) for SVG 2D stage
  x: number;
  y: number;
  // Optional 3D world anchor for Three.js raycast / label projection
  pos3d?: [number, number, number];
  accentHex?: string;
  soundType?: 'speech' | 'guitar' | 'piano' | 'drum' | 'flute' | 'violin' | 'danbau' | 'chime' | 'click';
  targetZoneId?: string;
}

export interface InteractiveTargetZone {
  id: string;
  labelEn: string;
  labelVi: string;
  descriptionVi?: string;
  x: number;
  y: number;
  accentHex?: string;
}

export type Scene2DMechanic =
  | 'hotspot_drag_assign'
  | 'sorting_bins'
  | 'music_stage'
  | 'timeline_order'
  | 'interactive_map'
  | 'before_after_slider'
  | 'planner_builder'
  | 'food_chain'
  | 'decision_board'
  | 'workflow_nodes';

export interface SimulationScene2D {
  id: string;
  unitId: string;
  grade: HighSchoolGrade;
  unitNumber: number;
  titleEn: string;
  titleVi: string;
  subtitleVi: string;
  mechanic: Scene2DMechanic;
  objectiveVi: string;
  instructionVi: string;
  sceneTheme: string;
  objects: InteractiveObject[];
  targetZones?: InteractiveTargetZone[];
  sliderConfig?: {
    leftLabel: string;
    rightLabel: string;
    unitLabel: string;
    min: number;
    max: number;
    defaultValue: number;
    metricsAtMin: Array<{label: string; value: string; tone: 'good' | 'warn' | 'bad'}>;
    metricsAtMax: Array<{label: string; value: string; tone: 'good' | 'warn' | 'bad'}>;
  };
  provenance: SourceProvenance;
  scientificNote?: string;
}

export type Scene3DKind =
  | 'g10_u1_house'
  | 'g10_u2_green_community'
  | 'g10_u3_music_stage'
  | 'g10_u5_invention_expo'
  | 'g10_u7_world_globe'
  | 'g10_u8_future_classroom'
  | 'g10_u9_env_before_after'
  | 'g10_u10_ecotourism_park'
  | 'g11_u1_healthy_env'
  | 'g11_u3_smart_city'
  | 'g11_u4_asean_expo'
  | 'g11_u5_greenhouse_effect'
  | 'g11_u6_heritage_tour'
  | 'g11_u8_independent_apartment'
  | 'g11_u10_ecosystem'
  | 'g12_u2_multicultural_expo'
  | 'g12_u3_smart_green_house'
  | 'g12_u4_village_to_city'
  | 'g12_u5_job_interview'
  | 'g12_u6_ai_expo'
  | 'g12_u7_newsroom'
  | 'g12_u8_wildlife_reserve'
  | 'g12_u9_career_fair';

export interface Scene3DControlOption {
  id: string;
  labelVi: string;
  kind: 'toggle' | 'slider' | 'mode';
  defaultValue: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  modes?: Array<{value: string; label: string}>;
}

export interface SimulationScene3D {
  id: string;
  unitId: string;
  grade: HighSchoolGrade;
  unitNumber: number;
  sceneKind: Scene3DKind;
  titleEn: string;
  titleVi: string;
  subtitleVi: string;
  objectiveVi: string;
  instructionVi: string;
  environmentType: 'indoor' | 'outdoor' | 'studio';
  objects: InteractiveObject[];
  controls: Scene3DControlOption[];
  fallback2DSimId: string;
  provenance: SourceProvenance;
  modelDisclaimerVi?: string;
}

export interface LabAssessmentQuestion {
  id: string;
  unitId: string;
  grade: HighSchoolGrade;
  skill: SkillCategory;
  cognitiveLevel: CognitiveLevel;
  format: 'mcq' | 'true_false' | 'gap_fill';
  prompt: string;
  options?: Array<{label: string; text: string}>;
  correctAnswer: string;
  acceptedAnswers?: string[];
  explanationVi: string;
  learningOutcome: string;
  points: number;
  sourceLabel: string;
}

export interface UnitFourSkillsContent {
  unitId: string;
  listening: {
    title: string;
    contextVi: string;
    transcript: string;
    accent: 'en-GB' | 'en-US';
    questions: LabAssessmentQuestion[];
  };
  speaking: {
    title: string;
    promptEn: string;
    promptVi: string;
    sentenceFrames: string[];
    rubricHints: string[];
  };
  reading: {
    title: string;
    paragraphs: string[];
    highlightedTerms: string[];
    questions: LabAssessmentQuestion[];
  };
  writing: {
    title: string;
    promptEn: string;
    promptVi: string;
    minWords: number;
    maxWords: number;
    outlineHints: string[];
    sampleParagraph: string;
  };
}

export interface GrammarComponentToken {
  text: string;
  role: 'subject' | 'aux' | 'verb' | 'object' | 'adverb' | 'connector' | 'clause' | 'complement';
  labelVi: string;
}

export interface GrammarTransformExample {
  id: string;
  contextVi: string;
  beforeLabel: string;
  beforeTokens: GrammarComponentToken[];
  afterLabel?: string;
  afterTokens?: GrammarComponentToken[];
  timelinePos?: number; // 0 (past) -> 50 (present) -> 100 (future)
  timelineSpan?: [number, number];
  noteVi: string;
}

export interface GrammarSimulation {
  id: string; // G01..G20
  code: string;
  gradeFocus: HighSchoolGrade[];
  unitRefs: string[];
  titleEn: string;
  titleVi: string;
  category: 'tenses' | 'clauses' | 'voice_verb' | 'comparison_connectors';
  visualMode: 'timeline' | 'transform' | 'clause_builder' | 'scale';
  formulaEn: string;
  ruleSummaryVi: string;
  textbookAlignmentNote: string;
  examples: GrammarTransformExample[];
  builderChallenge: {
    instructionVi: string;
    shuffledBlocks: string[];
    correctOrder: string[];
    explanationVi: string;
  };
  exercises: LabAssessmentQuestion[]; // >= 5 per grammar simulation
}

export interface ArticulatorPose {
  phoneme: string; // e.g. /θ/
  ipaUs?: string;
  nameVi: string;
  mannerVi: string;
  placeVi: string;
  voiced: boolean;
  airflow: 'oral_continuous' | 'oral_plosive' | 'nasal' | 'lateral' | 'vowel_open' | 'affricate';
  // Normalized anatomical coordinates for 2D sagittal + 3D vocal tract animation
  lipRounding: number; // 0 (spread) .. 1 (rounded)
  lipOpening: number; // 0 (closed) .. 1 (wide open)
  jawDrop: number; // 0 .. 1
  tongueTipX: number; // 0 (teeth/interdental) .. 1 (back)
  tongueTipY: number; // 0 (low) .. 1 (high touching palate/alveolar)
  tongueBodyX: number; // 0 (front) .. 1 (back)
  tongueBodyY: number; // 0 (low) .. 1 (high)
  velumOpen: boolean; // true for /m, n, ŋ/
  sampleWords: Array<{word: string; ipaUk: string; ipaUs?: string; meaningVi: string}>;
  sampleSentence: string;
  tipVi: string;
}

export interface PronunciationMinimalPair {
  id: string;
  pairLabel: string; // e.g. /θ/ – /ð/
  leftPhoneme: string;
  rightPhoneme: string;
  differenceVi: string;
  pairs: Array<{
    leftWord: string;
    leftIpa: string;
    rightWord: string;
    rightIpa: string;
    meaningPairVi: string;
  }>;
}

export interface PronunciationSimulation {
  id: string; // P01..P12
  code: string;
  gradeFocus: HighSchoolGrade[];
  titleEn: string;
  titleVi: string;
  focusMode: 'articulatory' | 'minimal_pairs' | 'word_stress' | 'sentence_rhythm' | 'intonation' | 'connected_speech';
  objectiveVi: string;
  phonemes: ArticulatorPose[];
  minimalPairs?: PronunciationMinimalPair[];
  stressItems?: Array<{
    text: string;
    ipaUk: string;
    syllables: Array<{text: string; stressed: boolean}>;
    ruleVi: string;
  }>;
  intonationItems?: Array<{
    sentence: string;
    pattern: 'falling' | 'rising' | 'fall_rise';
    patternLabelVi: string;
    pitchPoints: number[]; // 0..100 normalized heights across phrase
    meaningVi: string;
  }>;
  connectedItems?: Array<{
    written: string;
    spokenIpa: string;
    phenomenon: 'linking' | 'elision' | 'assimilation';
    highlightNoteVi: string;
  }>;
  exercises: LabAssessmentQuestion[];
}

export interface RolePlayChoice {
  id: string;
  textEn: string;
  registerTag: string; // e.g. 'Lịch sự', 'Thuyết phục', 'Cần bổ sung ý'
  feedbackVi: string;
  scoreDelta: number;
  nextNodeId: string;
}

export interface RolePlayNode {
  id: string;
  turnNumber: number;
  npcName: string;
  npcRole: string;
  npcLineEn: string;
  npcLineVi: string;
  branchTag?: string;
  vocabHints: string[];
  structureHintEn: string;
  choices?: RolePlayChoice[];
  isEnd?: boolean;
  endSummaryVi?: string;
}

export interface RolePlayScenario {
  id: string; // R01..R30
  unitId: string;
  grade: HighSchoolGrade;
  unitNumber: number;
  titleEn: string;
  titleVi: string;
  settingVi: string;
  studentRoleVi: string;
  npcName: string;
  objectiveVi: string;
  startNodeId: string;
  nodes: RolePlayNode[];
  provenance: SourceProvenance;
}

export interface UnitLabBundle {
  unitId: string;
  grade: HighSchoolGrade;
  unitNumber: number;
  titleEn: string;
  titleVi: string;
  semester: 'hk1' | 'hk2';
  sim2DId: string;
  sim3DId?: string; // undefined for the 7 2D-only units (G10 U4/U6, G11 U2/U7/U9, G12 U1/U10)
  rolePlayId: string;
  grammarIds: string[];
  pronunciationIds: string[];
  vocab: LabVocabularyItem[]; // >= 15 per Unit
  fourSkills: UnitFourSkillsContent;
}

export interface TeacherCustomization {
  id: string; // e.g. custom::SIM2D-10-01
  targetId: string; // simulation/scenario/grammar/pronunciation ID
  category: LabCategory;
  customTitle?: string;
  customInstruction?: string;
  customObjectLabels?: Record<string, {labelEn: string; labelVi: string; descriptionVi: string}>;
  customTranscript?: string;
  customSpeakingPrompt?: string;
  customWritingPrompt?: string;
  customVocabOverrides?: LabVocabularyItem[];
  customQuestions?: LabAssessmentQuestion[];
  customAudioDataUrl?: string;
  customAudioFileName?: string;
  isDraft: boolean;
  updatedAt: number;
}

export interface LabUserProgress {
  id: string; // 'default-user'
  favorites: string[]; // simulation IDs
  recentIds: string[];
  completedIds: string[];
  quizScores: Record<string, {correct: number; total: number; updatedAt: number}>;
  writingDrafts: Record<string, string>; // keyed by unitId
  updatedAt: number;
}

export interface LabOfflinePackRecord {
  id: string; // e.g. 'unit::gs10-u1', 'grade::10', 'group::grammar'
  scopeType: 'unit' | 'grade' | 'group';
  labelVi: string;
  activityIds: string[];
  estimatedBytes: number;
  cachedAt: number;
  payloadJson: string;
}

export interface SimulationManifestEntry {
  id: string;
  category: LabCategory;
  grade: HighSchoolGrade | 'all';
  unitId?: string;
  unitNumber?: number;
  titleEn: string;
  titleVi: string;
  skills: SkillCategory[];
  declared: boolean;
  hasContent: boolean;
  hasModel: boolean;
  hasInteraction: boolean;
  hasAudio: boolean;
  hasAssessment: boolean;
  tested: boolean;
  completed: boolean;
}
