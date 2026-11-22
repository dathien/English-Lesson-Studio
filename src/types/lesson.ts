export type HighSchoolGrade = 10 | 11 | 12;
export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type EducationLevel = 'primary' | 'secondary' | 'high_school';

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  primary: 'Tiểu học (Lớp 1–5)',
  secondary: 'THCS (Lớp 6–9)',
  high_school: 'THPT (Lớp 10–12)',
};

export const EDUCATION_LEVEL_SHORT: Record<EducationLevel, string> = {
  primary: 'Tiểu học',
  secondary: 'THCS',
  high_school: 'THPT',
};

export const GRADES_BY_LEVEL: Record<EducationLevel, Grade[]> = {
  primary: [1, 2, 3, 4, 5],
  secondary: [6, 7, 8, 9],
  high_school: [10, 11, 12],
};

export const ALL_GRADES: Grade[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function getEducationLevelFromGrade(grade: Grade): EducationLevel {
  if (grade <= 5) return 'primary';
  if (grade <= 9) return 'secondary';
  return 'high_school';
}

export type SkillCategory =
  | 'listening'
  | 'speaking'
  | 'reading'
  | 'writing'
  | 'vocabulary'
  | 'grammar'
  | 'pronunciation'
  | 'review';

export type ActivityType =
  // Listening
  | 'listening_mcq'
  | 'listening_tf'
  | 'listening_gap'
  | 'listening_matching'
  | 'listening_note'
  | 'listening_sentence'
  | 'listening_main_idea'
  | 'listening_specific'
  | 'listening_details'
  | 'listening_ordering'
  // Speaking
  | 'speaking_pronunciation'
  | 'speaking_read_aloud'
  | 'speaking_qa'
  | 'speaking_roleplay'
  | 'speaking_pair'
  | 'speaking_picture'
  | 'speaking_presentation'
  | 'speaking_discussion'
  | 'speaking_situation'
  // Reading
  | 'reading_mcq'
  | 'reading_tf'
  | 'reading_headings'
  | 'reading_matching_info'
  | 'reading_gap'
  | 'reading_cloze'
  | 'reading_vocab_context'
  | 'reading_reference'
  | 'reading_main_idea'
  | 'reading_inference'
  | 'reading_detailed'
  // Writing
  | 'writing_word_order'
  | 'writing_sentence_build'
  | 'writing_transformation'
  | 'writing_completion'
  | 'writing_paragraph'
  | 'writing_email'
  | 'writing_letter'
  | 'writing_guided'
  | 'writing_essay'
  | 'writing_picture'
  // Vocabulary
  | 'vocab_flashcards'
  | 'vocab_matching'
  | 'vocab_word_families'
  | 'vocab_collocations'
  | 'vocab_word_formation'
  | 'vocab_context'
  | 'vocab_games'
  // Grammar
  | 'grammar_mcq'
  | 'grammar_gap'
  | 'grammar_error'
  | 'grammar_transformation'
  | 'grammar_building'
  | 'grammar_practice'
  // Pronunciation
  | 'pron_vowels_consonants'
  | 'pron_minimal_pairs'
  | 'pron_word_stress'
  | 'pron_sentence_stress'
  | 'pron_intonation'
  | 'pron_ed_s'
  | 'pron_ipa'
  // General
  | 'title_slide'
  | 'theory_slide'
  | 'review_mixed';

export type QuestionType =
  | 'mcq'
  | 'true_false'
  | 'gap_fill'
  | 'matching'
  | 'ordering'
  | 'short_answer'
  | 'error_correction'
  | 'transformation'
  | 'word_order'
  | 'pronunciation_underlined';

export type CognitiveLevel =
  | 'recognition'
  | 'comprehension'
  | 'application'
  | 'high_application';

export interface QuestionOption {
  id: string;
  label: string;
  text: string;
  ipa?: string;
  imageUrl?: string;
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface QuestionItem {
  id: string;
  number: number;
  type: QuestionType;
  prompt: string;
  options?: QuestionOption[];
  correctAnswer: string;
  acceptedAnswers?: string[];
  matchingPairs?: MatchingPair[];
  orderItems?: string[];
  explanation?: string;
  cognitiveLevel?: CognitiveLevel;
  timestampSec?: number;
  uncertain?: boolean;
  tags?: string[];
}

export interface ReadingPassage {
  title?: string;
  paragraphs: string[];
  sourceNote?: string;
}

export interface AudioTimestamp {
  id: string;
  questionNumber: number;
  label: string;
  startSec: number;
  endSec?: number;
}

export type AudioSourceMode = 'builtin' | 'uploaded' | 'tts';
export type VoiceAccent = 'en-GB' | 'en-US';

export interface ListeningAudioConfig {
  sourceMode?: AudioSourceMode;
  dataUrl?: string;
  fileName?: string;
  mimeType?: string;
  transcript?: string;
  showTranscriptDefault?: boolean;
  voiceAccent?: VoiceAccent;
  isSynthesized?: boolean;
  skillObjective?: string;
  durationSec?: number;
  timestamps?: AudioTimestamp[];
  timestampsNeedReview?: boolean;
}

export interface VocabCardItem {
  id: string;
  word: string;
  ipa: string;
  partOfSpeech: string;
  meaningVi: string;
  example: string;
  collocations?: string[];
  wordFamily?: string[];
  stressPattern?: string;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  maxScore: number;
}

export interface SpeakingTaskConfig {
  prompt: string;
  sampleDialogue?: Array<{speaker: string; line: string; ipa?: string}>;
  cues?: string[];
  ipaFocus?: Array<{text: string; ipa: string; note?: string}>;
  rubricCriteria: RubricCriterion[];
}

export interface WritingTaskConfig {
  prompt: string;
  minWords: number;
  maxWords: number;
  outlineHints: string[];
  usefulExpressions: string[];
  rubricCriteria: RubricCriterion[];
}

export type SlideThemeId =
  | 'light_classroom'
  | 'dark_theater'
  | 'ocean_blue'
  | 'emerald_fresh'
  | 'bright_orange'
  | 'projector_contrast'
  | 'warm_paper';

export interface Slide {
  id: string;
  order: number;
  title: string;
  subtitle?: string;
  skill: SkillCategory;
  activityType: ActivityType;
  instruction?: string;
  bullets?: string[];
  teacherNotes?: string;
  accentColor?: string;
  transition?: 'none' | 'fade' | 'slide';
  passage?: ReadingPassage;
  audio?: ListeningAudioConfig;
  imageUrl?: string;
  imageCaption?: string;
  videoUrl?: string;
  questions?: QuestionItem[];
  vocabItems?: VocabCardItem[];
  speakingTask?: SpeakingTaskConfig;
  writingTask?: WritingTaskConfig;
}

export interface LessonProject {
  id: string;
  title: string;
  grade: Grade;
  educationLevel?: EducationLevel;
  skill: SkillCategory;
  activityFocus?: ActivityType;
  topic: string;
  description: string;
  curriculumNote: string;
  isSample?: boolean;
  createdAt: number;
  updatedAt: number;
  themeId: SlideThemeId;
  slides: Slide[];
}

export interface RubricScoreEntry {
  criterionId: string;
  score: number;
}

export interface StudentSubmission {
  id: string;
  lessonId: string;
  slideId: string;
  type: 'writing' | 'speaking' | 'assessment';
  studentName: string;
  createdAt: number;
  updatedAt: number;
  textContent?: string;
  wordCount?: number;
  audioDataUrl?: string;
  audioDurationSec?: number;
  aiFeedback?: WritingAIFeedback;
  teacherComment?: string;
  rubricScores?: RubricScoreEntry[];
  totalScore?: number;
  maxScore?: number;
}

export interface WritingAIFeedback {
  summary: string;
  strengths: string[];
  grammarIssues: Array<{original: string; suggestion: string; reason: string}>;
  vocabularySuggestions: string[];
  structureAdvice: string[];
}

export interface AppSettings {
  defaultGrade: Grade;
  defaultTheme: SlideThemeId;
  presenterFontScale: number;
  showTeacherNotesByDefault: boolean;
  teacherName: string;
  schoolName: string;
}

export interface ParsedDocumentDraft {
  sourceFiles: string[];
  title: string;
  grade: Grade;
  educationLevel: EducationLevel;
  detectedGrade: Grade | null;
  detectedLevel: EducationLevel | null;
  gradeConfidence: 'high' | 'medium' | 'none';
  gradeEvidence?: string;
  gradeNeedsConfirmation: boolean;
  skill: SkillCategory;
  detectedActivityType?: ActivityType;
  detectedSkillEvidence?: string;
  instructions: string;
  passages: ReadingPassage[];
  transcript: string;
  attachedAudioDataUrl?: string;
  attachedAudioName?: string;
  attachedAudioMimeType?: string;
  questions: Array<QuestionItem & {passageIndex?: number}>;
  extractedImages: Array<{name: string; dataUrl: string}>;
  pageCount?: number;
  warnings: string[];
  usedAI: boolean;
}

export const SKILL_LABELS: Record<SkillCategory, string> = {
  listening: 'Listening (Nghe hiểu)',
  speaking: 'Speaking (Luyện nói)',
  reading: 'Reading (Đọc hiểu)',
  writing: 'Writing (Luyện viết)',
  vocabulary: 'Vocabulary (Từ vựng)',
  grammar: 'Grammar (Ngữ pháp)',
  pronunciation: 'Pronunciation (Phát âm)',
  review: 'Ôn tập tổng hợp',
};

export const SKILL_SHORT_LABELS: Record<SkillCategory, string> = {
  listening: 'Listening',
  speaking: 'Speaking',
  reading: 'Reading',
  writing: 'Writing',
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  pronunciation: 'Pronunciation',
  review: 'Ôn tập',
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  listening_mcq: 'Listening · Multiple Choice',
  listening_tf: 'Listening · True / False',
  listening_gap: 'Listening · Gap Filling',
  listening_matching: 'Listening · Matching',
  listening_note: 'Listening · Note Completion',
  listening_sentence: 'Listening · Sentence Completion',
  listening_main_idea: 'Listening · Main Ideas',
  listening_specific: 'Listening · Specific Information',
  listening_details: 'Listening · Details',
  listening_ordering: 'Listening · Ordering',
  speaking_pronunciation: 'Speaking · Pronunciation Practice',
  speaking_read_aloud: 'Speaking · Read Aloud',
  speaking_qa: 'Speaking · Question & Answer',
  speaking_roleplay: 'Speaking · Role-play',
  speaking_pair: 'Speaking · Pair Work',
  speaking_picture: 'Speaking · Picture Description',
  speaking_presentation: 'Speaking · Short Presentation',
  speaking_discussion: 'Speaking · Discussion',
  speaking_situation: 'Speaking · Situation-based Communication',
  reading_mcq: 'Reading · Multiple Choice',
  reading_tf: 'Reading · True / False',
  reading_headings: 'Reading · Matching Headings',
  reading_matching_info: 'Reading · Matching Information',
  reading_gap: 'Reading · Gap Filling',
  reading_cloze: 'Reading · Cloze Test',
  reading_vocab_context: 'Reading · Vocabulary in Context',
  reading_reference: 'Reading · Reference Questions',
  reading_main_idea: 'Reading · Main Idea',
  reading_inference: 'Reading · Inference Questions',
  reading_detailed: 'Reading · Detailed Comprehension',
  writing_word_order: 'Writing · Word Ordering',
  writing_sentence_build: 'Writing · Sentence Building',
  writing_transformation: 'Writing · Sentence Transformation',
  writing_completion: 'Writing · Sentence Completion',
  writing_paragraph: 'Writing · Paragraph Writing',
  writing_email: 'Writing · Email Writing',
  writing_letter: 'Writing · Letter Writing',
  writing_guided: 'Writing · Guided Writing',
  writing_essay: 'Writing · Essay Writing',
  writing_picture: 'Writing · Writing from Pictures',
  vocab_flashcards: 'Vocabulary · Flashcards',
  vocab_matching: 'Vocabulary · Matching',
  vocab_word_families: 'Vocabulary · Word Families',
  vocab_collocations: 'Vocabulary · Collocations',
  vocab_word_formation: 'Vocabulary · Word Formation',
  vocab_context: 'Vocabulary · Vocabulary in Context',
  vocab_games: 'Vocabulary · Vocabulary Games',
  grammar_mcq: 'Grammar · Multiple Choice',
  grammar_gap: 'Grammar · Gap Filling',
  grammar_error: 'Grammar · Error Correction',
  grammar_transformation: 'Grammar · Sentence Transformation',
  grammar_building: 'Grammar · Sentence Building',
  grammar_practice: 'Grammar · Grammar Practice',
  pron_vowels_consonants: 'Pronunciation · Nguyên âm & Phụ âm',
  pron_minimal_pairs: 'Pronunciation · Phân biệt các âm',
  pron_word_stress: 'Pronunciation · Trọng âm từ (Word Stress)',
  pron_sentence_stress: 'Pronunciation · Trọng âm câu (Sentence Stress)',
  pron_intonation: 'Pronunciation · Ngữ điệu (Intonation)',
  pron_ed_s: 'Pronunciation · Đuôi -ed & -s/-es',
  pron_ipa: 'Pronunciation · Phiên âm IPA',
  title_slide: 'Trang bìa bài giảng',
  theory_slide: 'Kiến thức trọng tâm',
  review_mixed: 'Ôn tập tổng hợp',
};

export const COGNITIVE_LABELS: Record<CognitiveLevel, string> = {
  recognition: 'Nhận biết',
  comprehension: 'Thông hiểu',
  application: 'Vận dụng',
  high_application: 'Vận dụng cao',
};

export const DEFAULT_SPEAKING_RUBRIC: RubricCriterion[] = [
  {id: 'pronunciation', name: 'Pronunciation (Phát âm)', description: 'Phát âm rõ ràng, trọng âm từ và ngữ điệu tự nhiên.', maxScore: 2},
  {id: 'fluency', name: 'Fluency (Độ trôi chảy)', description: 'Nói mạch lạc, tốc độ hợp lý, hạn chế ngập ngừng kéo dài.', maxScore: 2},
  {id: 'vocabulary', name: 'Vocabulary (Từ vựng)', description: 'Sử dụng từ vựng phù hợp chủ đề và có sự đa dạng.', maxScore: 2},
  {id: 'grammar', name: 'Grammar (Ngữ pháp)', description: 'Đúng cấu trúc câu, chia thì chính xác và linh hoạt.', maxScore: 1.5},
  {id: 'interaction', name: 'Interaction (Tương tác)', description: 'Phản hồi tự nhiên, lắng nghe và duy trì hội thoại tốt.', maxScore: 1},
  {id: 'task', name: 'Task Achievement (Hoàn thành nhiệm vụ)', description: 'Trả lời đầy đủ yêu cầu đề bài và triển khai ý rõ ràng.', maxScore: 1.5},
];

export const DEFAULT_WRITING_RUBRIC: RubricCriterion[] = [
  {id: 'task_response', name: 'Task Achievement (Hoàn thành yêu cầu)', description: 'Đúng trọng tâm đề bài, đủ số từ quy định, ý tưởng thuyết phục.', maxScore: 3},
  {id: 'coherence', name: 'Coherence & Cohesion (Bố cục & Mạch lạc)', description: 'Chia đoạn rõ ràng, sử dụng từ nối hợp lý.', maxScore: 2.5},
  {id: 'lexical', name: 'Lexical Resource (Từ vựng)', description: 'Dùng từ chính xác, tự nhiên, đúng collocation.', maxScore: 2.5},
  {id: 'grammar_accuracy', name: 'Grammatical Range & Accuracy (Ngữ pháp)', description: 'Đa dạng cấu trúc câu, ít lỗi chính tả và ngữ pháp.', maxScore: 2},
];
