import type {
  CognitiveLevel,
  HighSchoolGrade,
  QuestionOption,
  QuestionType,
} from './lesson';

export type ExamSkillKey =
  | 'listening'
  | 'speaking'
  | 'reading'
  | 'writing'
  | 'language';

export type ExamSemester = 'hk1' | 'hk2' | 'full_year';

export type ExamTypeId =
  | 'regular'
  | 'short_custom'
  | 'midterm_1'
  | 'final_1'
  | 'midterm_2'
  | 'final_2'
  | 'unit_test'
  | 'skill_test'
  | 'retest'
  | 'survey'
  | 'graduation_mock'
  | 'graduation_practice';

export type ExamQuestionFormat =
  | 'mcq'
  | 'true_false'
  | 'short_answer'
  | 'gap_fill'
  | 'matching'
  | 'ordering'
  | 'transformation'
  | 'essay'
  | 'speaking';

export type MatrixTemplateMode =
  | 'cv_7991'
  | 'school_english'
  | 'graduation_2025'
  | 'custom_uploaded';

export type GraduationMode = '2025_2026' | '2027_reference';

export type VerificationStatus =
  | 'official_verified'
  | 'reference_sourced'
  | 'teacher_authored'
  | 'ai_unverified'
  | 'approved';

export type ExamStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'ready_to_export';

export interface VerifiedUnit {
  id: string;
  grade: HighSchoolGrade;
  number: number;
  title: string;
  titleVi: string;
  semester: 'hk1' | 'hk2';
  theme: string;
  topics: string[];
  knowledgeUnits: string[];
  learningOutcomes: string[];
}

export interface TextbookConfig {
  id: string;
  name: string;
  publisher: string;
  verifiedUnitsAvailable: boolean;
  note?: string;
  isCustom?: boolean;
  unitsByGrade: Record<HighSchoolGrade, VerifiedUnit[]>;
}

export interface SourceReference {
  id: string;
  title: string;
  url?: string;
  category:
    | 'legal_cv'
    | 'school_reference'
    | 'graduation_reference'
    | 'teacher_uploaded';
  description: string;
  note?: string;
  uploadedFileName?: string;
  uploadedContentPreview?: string;
  addedAt?: number;
}

export interface CurriculumScope {
  grade: HighSchoolGrade;
  academicYear: string;
  semester: ExamSemester;
  textbookId: string;
  textbookName: string;
  selectedUnitIds: string[];
  selectedTopics: string[];
  knowledgeUnits: string[];
  learningOutcomes: string[];
  skills: ExamSkillKey[];
  examType: ExamTypeId;
  durationMinutes: number;
  graduationMode: GraduationMode;
  customCurriculumDocName?: string;
  customCurriculumNotes?: string;
}

export interface ExamMatrixRow {
  id: string;
  order: number;
  skill: ExamSkillKey;
  topic: string;
  testContent: string;
  knowledgeUnit: string;
  questionFormat: ExamQuestionFormat;
  recognitionCount: number;
  comprehensionCount: number;
  applicationCount: number;
  highApplicationCount: number;
  questionCount: number;
  scoringUnits: number;
  points: number;
  percentage: number;
  unitIds?: string[];
  learningOutcome?: string;
  locked?: boolean;
}

export interface ExamBlueprint {
  id: string;
  templateMode: MatrixTemplateMode;
  includeHighApplication: boolean;
  bilingualHeaders: boolean;
  totalScoreTarget: number;
  rows: ExamMatrixRow[];
  notes?: string;
  customTemplateFileName?: string;
}

export interface SpecificationRow {
  id: string;
  matrixRowId: string;
  order: number;
  skill: ExamSkillKey;
  topic: string;
  knowledgeContent: string;
  learningOutcome: string;
  assessmentDescriptor: string;
  questionFormat: ExamQuestionFormat;
  cognitiveLevel: CognitiveLevel;
  questionCount: number;
  questionPositions: string;
  points: number;
}

export interface Specification {
  id: string;
  rows: SpecificationRow[];
  updatedAt: number;
}

export interface AudioAsset {
  sourceMode: 'builtin' | 'uploaded' | 'tts';
  transcript: string;
  voiceAccent: 'en-GB' | 'en-US';
  isSynthesized: boolean;
  dataUrl?: string;
  fileName?: string;
  mimeType?: string;
  durationSec?: number;
  showTranscriptInKey: boolean;
}

export type QuestionGroupType =
  | 'listening_script'
  | 'reading_passage'
  | 'notice_cloze'
  | 'leaflet_cloze'
  | 'cloze_completion'
  | 'arrangement_block'
  | 'standalone_section';

export interface QuestionGroup {
  id: string;
  order: number;
  title: string;
  skill: ExamSkillKey;
  groupType: QuestionGroupType;
  instruction: string;
  stimulusTitle?: string;
  stimulusParagraphs?: string[];
  audio?: AudioAsset;
  protectOrder: boolean;
  matrixRowId?: string;
}

export interface BankQuestionRecord {
  id: string;
  grade: HighSchoolGrade;
  textbookId: string;
  unitId: string;
  topic: string;
  skill: ExamSkillKey;
  cognitiveLevel: CognitiveLevel;
  questionType: QuestionType | 'essay' | 'speaking';
  format: ExamQuestionFormat;
  prompt: string;
  options?: QuestionOption[];
  correctAnswer: string;
  acceptedAnswers?: string[];
  explanation: string;
  points: number;
  sourceReferenceId?: string;
  sourceLabel: string;
  groupId?: string;
  stimulusTitle?: string;
  stimulusParagraphs?: string[];
  audioTranscript?: string;
  verificationStatus: VerificationStatus;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ExamQuestionItem extends BankQuestionRecord {
  number: number;
  matrixRowId?: string;
  specRowId?: string;
  sectionOrder: number;
  locked?: boolean;
  protectOptionShuffle?: boolean;
  sampleAnswer?: string;
  wordLimit?: {min: number; max: number};
  speakingCues?: string[];
}

export interface ExamHeaderMeta {
  departmentName: string;
  schoolName: string;
  examTitle: string;
  subject: string;
  gradeLabel: string;
  academicYear: string;
  semesterLabel: string;
  durationMinutes: number;
  examCode: string;
  questionCountLabel: string;
  scaleLabel: string;
  studentInstructions: string;
}

export interface Exam {
  id: string;
  header: ExamHeaderMeta;
  groups: QuestionGroup[];
  questions: ExamQuestionItem[];
}

export interface AnswerKeyEntry {
  questionNumber: number;
  questionId: string;
  skill: ExamSkillKey;
  cognitiveLevel: CognitiveLevel;
  questionFormat: ExamQuestionFormat;
  correctAnswer: string;
  acceptedAnswers?: string[];
  points: number;
  explanation: string;
  sectionTitle: string;
}

export interface AnswerKey {
  examCode: string;
  generatedAt: number;
  entries: AnswerKeyEntry[];
  totalPoints: number;
}

export interface RubricLevelDescriptor {
  levelName: string;
  scoreRange: string;
  description: string;
}

export interface ExamRubricCriterion {
  id: string;
  name: string;
  weightPercent: number;
  maxScore: number;
  levels: RubricLevelDescriptor[];
}

export interface ExamRubric {
  id: string;
  skill: 'writing' | 'speaking';
  title: string;
  totalScore: number;
  criteria: ExamRubricCriterion[];
}

export interface EssaySampleGuide {
  questionNumber: number;
  prompt: string;
  outlinePoints: string[];
  sampleResponse: string;
  maxScore: number;
}

export interface MarkingGuide {
  generalInstructions: string;
  listeningTranscripts: Array<{
    groupId: string;
    title: string;
    transcript: string;
  }>;
  essaySampleGuides: EssaySampleGuide[];
  writingRubric: ExamRubric;
  speakingRubric: ExamRubric;
}

export interface ShuffleOptions {
  shuffleStandaloneQuestions: boolean;
  shuffleOptions: boolean;
  shuffleCompatibleGroups: boolean;
}

export interface ExamVersion {
  code: string;
  generatedAt: number;
  groups: QuestionGroup[];
  questions: ExamQuestionItem[];
  answerKey: AnswerKey;
  equivalenceChecked: boolean;
  equivalenceReport: string[];
}

export interface ExamValidationIssue {
  id: string;
  severity: 'error' | 'warning';
  code: string;
  section: 'matrix' | 'specification' | 'exam' | 'listening' | 'answers' | 'shuffle';
  message: string;
  questionNumber?: number;
}

export interface ExamDossier {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: ExamStatus;
  isSample: boolean;
  sampleCategory?: 'periodic' | 'graduation';
  sourceAttribution: string;
  scope: CurriculumScope;
  blueprint: ExamBlueprint;
  specification: Specification;
  exam: Exam;
  answerKey: AnswerKey;
  markingGuide: MarkingGuide;
  versions: ExamVersion[];
  sourceReferences: SourceReference[];
}

export interface ExportFormatOptions {
  fontFamily: 'Times New Roman' | 'Arial' | 'Calibri';
  fontSizePt: number;
  matrixLandscape: boolean;
  specLandscape: boolean;
  includeHeaderBox: boolean;
  includeOmrSheet: boolean;
  includeTranscriptInAnswerKey: boolean;
  includeRubricsInAnswerKey: boolean;
  selectedCodes: string[];
}

export const EXAM_SKILL_LABELS: Record<ExamSkillKey, {vi: string; en: string}> = {
  listening: {vi: 'Nghe hiểu', en: 'Listening'},
  speaking: {vi: 'Kỹ năng Nói', en: 'Speaking'},
  reading: {vi: 'Đọc hiểu', en: 'Reading'},
  writing: {vi: 'Kỹ năng Viết', en: 'Writing'},
  language: {vi: 'Kiến thức ngôn ngữ', en: 'Language'},
};

export const EXAM_FORMAT_LABELS: Record<ExamQuestionFormat, {vi: string; en: string}> = {
  mcq: {vi: 'Trắc nghiệm nhiều lựa chọn', en: 'Multiple Choice (MCQ)'},
  true_false: {vi: 'Đúng / Sai', en: 'True / False'},
  short_answer: {vi: 'Trả lời ngắn', en: 'Short Answer'},
  gap_fill: {vi: 'Điền khuyết / Điền từ', en: 'Gap Filling'},
  matching: {vi: 'Nối ghép', en: 'Matching'},
  ordering: {vi: 'Sắp xếp câu / đoạn', en: 'Ordering / Arrangement'},
  transformation: {vi: 'Viết lại câu', en: 'Sentence Transformation'},
  essay: {vi: 'Tự luận / Viết đoạn – bài', en: 'Paragraph / Essay Writing'},
  speaking: {vi: 'Vấn đáp / Trình bày nói', en: 'Speaking Task'},
};

export const EXAM_STATUS_LABELS: Record<
  ExamStatus,
  {label: string; description: string; colorClass: string}
> = {
  draft: {
    label: 'Bản nháp',
    description: 'Đang biên soạn, chưa hoàn tất kiểm tra định chuẩn.',
    colorClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  pending_review: {
    label: 'Chờ kiểm duyệt',
    description: 'Đã soạn nội dung, chờ tổ chuyên môn hoặc giáo viên rà soát.',
    colorClass: 'bg-amber-50 text-amber-800 border-amber-300',
  },
  approved: {
    label: 'Đã duyệt',
    description: 'Nội dung chuyên môn đã được giáo viên xác nhận.',
    colorClass: 'bg-blue-50 text-blue-800 border-blue-300',
  },
  ready_to_export: {
    label: 'Sẵn sàng xuất đề',
    description: 'Đạt 100% kiểm định đồng bộ ma trận, bản đặc tả, đáp án và âm thanh.',
    colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  },
};

export const VERIFICATION_STATUS_LABELS: Record<
  VerificationStatus,
  {label: string; colorClass: string}
> = {
  official_verified: {
    label: 'Đã xác minh chuẩn',
    colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  reference_sourced: {
    label: 'Nguồn tham khảo',
    colorClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  },
  teacher_authored: {
    label: 'Tự biên soạn',
    colorClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  ai_unverified: {
    label: 'AI gợi ý · Chưa kiểm duyệt',
    colorClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  approved: {
    label: 'Đã duyệt',
    colorClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
};

export const DEFAULT_EXPORT_OPTIONS: ExportFormatOptions = {
  fontFamily: 'Times New Roman',
  fontSizePt: 13,
  matrixLandscape: true,
  specLandscape: true,
  includeHeaderBox: true,
  includeOmrSheet: true,
  includeTranscriptInAnswerKey: true,
  includeRubricsInAnswerKey: true,
  selectedCodes: ['101'],
};
