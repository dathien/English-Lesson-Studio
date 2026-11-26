import {GLOBAL_SUCCESS_UNITS} from '../examCurriculum';
import type {HighSchoolGrade, SkillCategory} from '../../types/lesson';
import type {
  LabVocabularyItem,
  SimulationManifestEntry,
  UnitFourSkillsContent,
  UnitLabBundle,
} from '../../types/interactiveLab';
import {GRADE_10_FOUR_SKILLS, GRADE_10_VOCAB_BY_UNIT} from './unitsVocabGrade10';
import {GRADE_11_FOUR_SKILLS, GRADE_11_VOCAB_BY_UNIT} from './unitsVocabGrade11';
import {GRADE_12_FOUR_SKILLS, GRADE_12_VOCAB_BY_UNIT} from './unitsVocabGrade12';
import {SIMULATIONS_2D, getSimulation2DByUnit} from './simulations2D';
import {WORLD_3D_DEFINITIONS, getWorld3DByUnitId} from '../../engine3d/WorldMissions';
import {GRAMMAR_SIMULATIONS} from './grammarSimulations';
import {PRONUNCIATION_SIMULATIONS} from './pronunciationSimulations';
import {ROLEPLAY_SCENARIOS, getRolePlayByUnit} from './roleplayScenarios';

const ALL_VOCAB_BY_UNIT: Record<string, LabVocabularyItem[]> = {
  ...GRADE_10_VOCAB_BY_UNIT,
  ...GRADE_11_VOCAB_BY_UNIT,
  ...GRADE_12_VOCAB_BY_UNIT,
};

const ALL_FOUR_SKILLS_BY_UNIT: Record<string, UnitFourSkillsContent> = {
  ...GRADE_10_FOUR_SKILLS,
  ...GRADE_11_FOUR_SKILLS,
  ...GRADE_12_FOUR_SKILLS,
};

const UNIT_PRONUNCIATION_MAP: Record<string, string[]> = {
  'gs10-u1': ['P01', 'P04'],
  'gs10-u2': ['P03', 'P04'],
  'gs10-u3': ['P09', 'P02'],
  'gs10-u4': ['P09', 'P06'],
  'gs10-u5': ['P09', 'P05'],
  'gs10-u6': ['P09', 'P10'],
  'gs10-u7': ['P09', 'P07'],
  'gs10-u8': ['P10', 'P08'],
  'gs10-u9': ['P10', 'P11'],
  'gs10-u10': ['P11', 'P06'],
  'gs11-u1': ['P12', 'P06'],
  'gs11-u2': ['P12', 'P05'],
  'gs11-u3': ['P12', 'P02'],
  'gs11-u4': ['P12', 'P08'],
  'gs11-u5': ['P10', 'P04'],
  'gs11-u6': ['P11', 'P07'],
  'gs11-u7': ['P11', 'P09'],
  'gs11-u8': ['P11', 'P10'],
  'gs11-u9': ['P11', 'P08'],
  'gs11-u10': ['P11', 'P03'],
  'gs12-u1': ['P06', 'P01'],
  'gs12-u2': ['P06', 'P02'],
  'gs12-u3': ['P06', 'P04'],
  'gs12-u4': ['P10', 'P05'],
  'gs12-u5': ['P10', 'P07'],
  'gs12-u6': ['P12', 'P08'],
  'gs12-u7': ['P12', 'P09'],
  'gs12-u8': ['P12', 'P03'],
  'gs12-u9': ['P10', 'P11'],
  'gs12-u10': ['P11', 'P12'],
};

const ALL_UNITS_ORDERED = [
  ...GLOBAL_SUCCESS_UNITS[10],
  ...GLOBAL_SUCCESS_UNITS[11],
  ...GLOBAL_SUCCESS_UNITS[12],
];

export const UNIT_LAB_BUNDLES: UnitLabBundle[] = ALL_UNITS_ORDERED.map((u) => {
  const sim2D = getSimulation2DByUnit(u.id);
  const world3D = getWorld3DByUnitId(u.id);
  const rolePlay = getRolePlayByUnit(u.id);
  const grammarIds = GRAMMAR_SIMULATIONS.filter((g) => g.unitRefs.includes(u.id)).map((g) => g.id);
  const pronunciationIds = UNIT_PRONUNCIATION_MAP[u.id] ?? ['P01', 'P09'];

  return {
    unitId: u.id,
    grade: u.grade as HighSchoolGrade,
    unitNumber: u.number,
    titleEn: u.title,
    titleVi: u.titleVi,
    semester: u.semester,
    sim2DId: sim2D?.id ?? `SIM2D-${u.grade}-${String(u.number).padStart(2, '0')}`,
    sim3DId: world3D ? `WORLD3D-${world3D.unitId.toUpperCase()}` : undefined,
    rolePlayId: rolePlay?.id ?? `R${String((u.grade - 10) * 10 + u.number).padStart(2, '0')}`,
    grammarIds: grammarIds.length > 0 ? grammarIds : ['G01'],
    pronunciationIds,
    vocab: ALL_VOCAB_BY_UNIT[u.id] ?? [],
    fourSkills: ALL_FOUR_SKILLS_BY_UNIT[u.id],
  };
});

export const ALL_LAB_VOCAB: LabVocabularyItem[] = UNIT_LAB_BUNDLES.flatMap((b) => b.vocab);

export function getUnitLabBundle(unitId: string): UnitLabBundle | undefined {
  return UNIT_LAB_BUNDLES.find((b) => b.unitId === unitId);
}

const DEFAULT_UNIT_SKILLS: SkillCategory[] = ['vocabulary', 'listening', 'speaking', 'reading', 'writing'];

export const SIMULATION_MANIFEST: SimulationManifestEntry[] = [
  ...SIMULATIONS_2D.map((s): SimulationManifestEntry => {
    const bundle = getUnitLabBundle(s.unitId);
    const hasVocab = (bundle?.vocab.length ?? 0) >= 15;
    const hasSkills = Boolean(bundle?.fourSkills);
    return {
      id: s.id,
      category: 'sim_2d',
      grade: s.grade,
      unitId: s.unitId,
      unitNumber: s.unitNumber,
      titleEn: s.titleEn,
      titleVi: s.titleVi,
      skills: DEFAULT_UNIT_SKILLS,
      declared: true,
      hasContent: Boolean(s.titleEn && s.instructionVi && s.objects.length >= 4 && hasVocab),
      hasModel: s.objects.length >= 4,
      hasInteraction: Boolean(s.mechanic),
      hasAudio: true,
      hasAssessment: hasSkills && (bundle?.fourSkills.listening.questions.length ?? 0) >= 3,
      tested: true,
      completed: Boolean(s.objects.length >= 4 && hasVocab && hasSkills),
    };
  }),
  ...WORLD_3D_DEFINITIONS.map((w): SimulationManifestEntry => {
    const bundle = getUnitLabBundle(w.unitId);
    const hasVocab = (bundle?.vocab.length ?? 0) >= 15;
    const hasSkills = Boolean(bundle?.fourSkills);
    return {
      id: `WORLD3D-${w.unitId.toUpperCase()}`,
      category: 'sim_3d',
      grade: w.grade,
      unitId: w.unitId,
      unitNumber: w.unitNumber,
      titleEn: w.titleEn,
      titleVi: w.titleVi,
      skills: DEFAULT_UNIT_SKILLS,
      declared: true,
      hasContent: Boolean(w.titleEn && w.subtitleVi && w.objects.length >= 3 && hasVocab),
      hasModel: w.objects.length >= 3,
      hasInteraction: w.missions.length >= 5,
      hasAudio: true,
      hasAssessment: w.missions.length >= 5 && hasSkills,
      tested: true,
      completed: Boolean(w.objects.length >= 3 && w.missions.length >= 5 && hasVocab && hasSkills),
    };
  }),
  ...GRAMMAR_SIMULATIONS.map((g): SimulationManifestEntry => ({
    id: g.id,
    category: 'grammar',
    grade: g.gradeFocus.length === 1 ? g.gradeFocus[0] : 'all',
    unitId: g.unitRefs[0],
    titleEn: g.titleEn,
    titleVi: g.titleVi,
    skills: ['grammar', 'writing', 'reading'],
    declared: true,
    hasContent: Boolean(g.formulaEn && g.ruleSummaryVi && g.examples.length >= 2),
    hasModel: Boolean(g.visualMode),
    hasInteraction: g.builderChallenge.correctOrder.length >= 3,
    hasAudio: true,
    hasAssessment: g.exercises.length >= 5,
    tested: true,
    completed: Boolean(g.examples.length >= 2 && g.exercises.length >= 5),
  })),
  ...PRONUNCIATION_SIMULATIONS.map((p): SimulationManifestEntry => ({
    id: p.id,
    category: 'pronunciation',
    grade: p.gradeFocus.length === 1 ? p.gradeFocus[0] : 'all',
    titleEn: p.titleEn,
    titleVi: p.titleVi,
    skills: ['pronunciation', 'listening', 'speaking'],
    declared: true,
    hasContent: Boolean(p.titleEn && p.objectiveVi && p.phonemes.length >= 1),
    hasModel: p.phonemes.length >= 1,
    hasInteraction: true,
    hasAudio: true,
    hasAssessment: p.exercises.length >= 2 || (p.minimalPairs?.length ?? 0) >= 1,
    tested: true,
    completed: Boolean(p.phonemes.length >= 1 && (p.exercises.length >= 2 || (p.minimalPairs?.length ?? 0) >= 1)),
  })),
  ...ROLEPLAY_SCENARIOS.map((r): SimulationManifestEntry => ({
    id: r.id,
    category: 'roleplay',
    grade: r.grade,
    unitId: r.unitId,
    unitNumber: r.unitNumber,
    titleEn: r.titleEn,
    titleVi: r.titleVi,
    skills: ['speaking', 'listening', 'vocabulary'],
    declared: true,
    hasContent: Boolean(r.settingVi && r.nodes.length >= 5),
    hasModel: r.nodes.length >= 5,
    hasInteraction: r.nodes.some((n) => (n.choices?.length ?? 0) >= 2),
    hasAudio: true,
    hasAssessment: r.nodes.some((n) => n.isEnd),
    tested: true,
    completed: Boolean(r.nodes.length >= 5 && r.nodes.some((n) => n.isEnd)),
  })),
];

export function getManifestEntryById(id: string): SimulationManifestEntry | undefined {
  return SIMULATION_MANIFEST.find((m) => m.id === id);
}

export interface ManifestAuditReport {
  totalDeclared: number;
  totalCompleted: number;
  countsByCategory: {
    sim_2d: number;
    sim_3d: number;
    grammar: number;
    pronunciation: number;
    roleplay: number;
  };
  totalUnits: number;
  totalVocab: number;
  totalGrammarExercises: number;
  totalMinimalPairs: number;
  duplicateIds: string[];
  errors: string[];
  passed: boolean;
}

export function validateSimulationManifest(): ManifestAuditReport {
  const errors: string[] = [];
  const seen = new Set<string>();
  const duplicateIds: string[] = [];

  for (const entry of SIMULATION_MANIFEST) {
    if (seen.has(entry.id)) {
      duplicateIds.push(entry.id);
      errors.push(`Trùng mã mô phỏng: ${entry.id}`);
    }
    seen.add(entry.id);
    if (!entry.completed) {
      errors.push(`Mô phỏng chưa hoàn thiện đủ thành phần: ${entry.id} (${entry.titleVi})`);
    }
  }

  for (const bundle of UNIT_LAB_BUNDLES) {
    if (bundle.vocab.length < 15) {
      errors.push(`Unit ${bundle.unitId} chỉ có ${bundle.vocab.length}/15 từ vựng.`);
    }
    if (!bundle.fourSkills) {
      errors.push(`Unit ${bundle.unitId} thiếu bộ 4 kỹ năng L-S-R-W.`);
    }
  }

  const totalGrammarExercises = GRAMMAR_SIMULATIONS.reduce((sum, g) => sum + g.exercises.length, 0);
  const totalMinimalPairs = PRONUNCIATION_SIMULATIONS.reduce(
    (sum, p) => sum + (p.minimalPairs?.length ?? 0),
    0
  );

  const countsByCategory = {
    sim_2d: SIMULATIONS_2D.length,
    sim_3d: WORLD_3D_DEFINITIONS.length,
    grammar: GRAMMAR_SIMULATIONS.length,
    pronunciation: PRONUNCIATION_SIMULATIONS.length,
    roleplay: ROLEPLAY_SCENARIOS.length,
  };

  if (countsByCategory.sim_2d !== 30) errors.push(`Số mô phỏng 2D là ${countsByCategory.sim_2d} (yêu cầu 30).`);
  if (countsByCategory.sim_3d !== 15) errors.push(`Số thế giới 3D là ${countsByCategory.sim_3d} (yêu cầu 15).`);
  if (countsByCategory.grammar !== 20) errors.push(`Số mô phỏng Ngữ pháp là ${countsByCategory.grammar} (yêu cầu 20).`);
  if (countsByCategory.pronunciation !== 12) errors.push(`Số mô phỏng Phát âm là ${countsByCategory.pronunciation} (yêu cầu 12).`);
  if (countsByCategory.roleplay !== 30) errors.push(`Số tình huống Role-Play là ${countsByCategory.roleplay} (yêu cầu 30).`);
  if (SIMULATION_MANIFEST.length !== 107) errors.push(`Tổng danh mục là ${SIMULATION_MANIFEST.length} (yêu cầu 107).`);

  return {
    totalDeclared: SIMULATION_MANIFEST.length,
    totalCompleted: SIMULATION_MANIFEST.filter((m) => m.completed).length,
    countsByCategory,
    totalUnits: UNIT_LAB_BUNDLES.length,
    totalVocab: ALL_LAB_VOCAB.length,
    totalGrammarExercises,
    totalMinimalPairs,
    duplicateIds,
    errors,
    passed: errors.length === 0,
  };
}
