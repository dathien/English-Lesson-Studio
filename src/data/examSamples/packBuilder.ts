import type {CognitiveLevel, HighSchoolGrade} from '../../types/lesson';
import type {
  CurriculumScope,
  ExamBlueprint,
  ExamDossier,
  ExamQuestionFormat,
  ExamQuestionItem,
  ExamSemester,
  ExamSkillKey,
  ExamTypeId,
  QuestionGroup,
} from '../../types/exam';
import {
  createDefaultSpeakingRubric,
  createDefaultWritingRubric,
  createGraduation2025MatrixRows,
  createPeriodicCV7991MatrixRows,
  GLOBAL_SUCCESS_UNITS,
  OFFICIAL_SOURCE_REFERENCES,
} from '../examCurriculum';
import {
  recalculateMatrixRow,
  syncAnswerKeyAndMarkingGuide,
  syncSpecificationFromBlueprint,
} from '../../services/examEngine';
import {inferTransformationMeta} from '../../services/sentenceTransformationEngine';

export interface SimpleMCQSpec {
  prompt: string;
  options: [string, string, string, string];
  answer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  level: CognitiveLevel;
  unitId: string;
  pronunciation?: boolean;
}

export interface SimpleTFSpec {
  prompt: string;
  answer: 'T' | 'F';
  explanation: string;
  level: CognitiveLevel;
  unitId: string;
}

export interface SimpleTransformSpec {
  prompt: string;
  answer: string;
  acceptedAnswers: string[];
  explanation: string;
  level: CognitiveLevel;
  unitId: string;
}

export interface PeriodicPackSeed {
  id: string;
  grade: HighSchoolGrade;
  examType: ExamTypeId;
  semester: ExamSemester;
  title: string;
  examTitleUpper: string;
  unitIds: string[];
  topicSummary: string;
  listeningPart1Title: string;
  listeningPart1Transcript: string;
  listeningPart1Items: SimpleTFSpec[];
  listeningPart2Title: string;
  listeningPart2Transcript: string;
  listeningPart2Items: SimpleMCQSpec[];
  phoneticsItems: SimpleMCQSpec[];
  vocabGrammarItems: SimpleMCQSpec[];
  clozeTitle: string;
  clozeParagraphs: string[];
  clozeItems: SimpleMCQSpec[];
  readingTitle: string;
  readingParagraphs: string[];
  readingItems: SimpleMCQSpec[];
  transformationItems: SimpleTransformSpec[];
  essayPrompt: string;
  essayOutline: string[];
  essaySample: string;
  essayUnitId: string;
}

function makeMcqOptions(opts: [string, string, string, string]) {
  return (['A', 'B', 'C', 'D'] as const).map((label, idx) => ({
    id: `${label.toLowerCase()}`,
    label,
    text: opts[idx],
  }));
}

export function buildPeriodicSampleDossier(seed: PeriodicPackSeed): ExamDossier {
  const units = GLOBAL_SUCCESS_UNITS[seed.grade].filter((u) => seed.unitIds.includes(u.id));
  const scope: CurriculumScope = {
    grade: seed.grade,
    academicYear: '2025–2026',
    semester: seed.semester,
    textbookId: 'global-success',
    textbookName: 'Tiếng Anh Global Success (Kết nối tri thức)',
    selectedUnitIds: seed.unitIds,
    selectedTopics: units.flatMap((u) => u.topics),
    knowledgeUnits: units.flatMap((u) => u.knowledgeUnits),
    learningOutcomes: units.flatMap((u) => u.learningOutcomes),
    skills: ['listening', 'language', 'reading', 'writing'],
    examType: seed.examType,
    durationMinutes: 60,
    graduationMode: '2025_2026',
  };

  const matrixRows = createPeriodicCV7991MatrixRows(
    ['listening', 'language', 'reading', 'writing'],
    seed.topicSummary,
    false,
  ).map((r) => recalculateMatrixRow(r, false, 10));

  const blueprint: ExamBlueprint = {
    id: `bp-${seed.id}`,
    templateMode: 'cv_7991',
    includeHighApplication: false,
    bilingualHeaders: false,
    totalScoreTarget: 10,
    rows: matrixRows,
    notes: 'Đề mẫu tự biên soạn bám sát Global Success (GDPT 2018) và Công văn 7991/BGDĐT-GDTrH.',
  };

  const specification = syncSpecificationFromBlueprint(blueprint, scope);

  const groups: QuestionGroup[] = [
    {
      id: `${seed.id}-g1`,
      order: 1,
      title: 'PART 1. LISTENING — TASK 1 (True / False)',
      skill: 'listening',
      groupType: 'listening_script',
      instruction:
        'Listen to the recording twice and decide whether the following statements are True (T) or False (F).',
      stimulusTitle: seed.listeningPart1Title,
      audio: {
        sourceMode: 'builtin',
        transcript: seed.listeningPart1Transcript,
        voiceAccent: 'en-GB',
        isSynthesized: true,
        showTranscriptInKey: true,
      },
      protectOrder: true,
      matrixRowId: matrixRows[0].id,
    },
    {
      id: `${seed.id}-g2`,
      order: 2,
      title: 'PART 1. LISTENING — TASK 2 (Multiple Choice)',
      skill: 'listening',
      groupType: 'listening_script',
      instruction:
        'Listen to the recording twice and mark the letter A, B, C, or D to indicate the correct answer to each question.',
      stimulusTitle: seed.listeningPart2Title,
      audio: {
        sourceMode: 'builtin',
        transcript: seed.listeningPart2Transcript,
        voiceAccent: 'en-US',
        isSynthesized: true,
        showTranscriptInKey: true,
      },
      protectOrder: true,
      matrixRowId: matrixRows[1].id,
    },
    {
      id: `${seed.id}-g3`,
      order: 3,
      title: 'PART 2. LANGUAGE — PHONETICS (Pronunciation & Word Stress)',
      skill: 'language',
      groupType: 'standalone_section',
      instruction:
        'Mark the letter A, B, C, or D to indicate the word whose underlined part differs from the other three in pronunciation (Q9–10) or differs in primary stress (Q11–12).',
      protectOrder: false,
      matrixRowId: matrixRows[2].id,
    },
    {
      id: `${seed.id}-g4`,
      order: 4,
      title: 'PART 2. LANGUAGE — VOCABULARY & GRAMMAR',
      skill: 'language',
      groupType: 'standalone_section',
      instruction:
        'Mark the letter A, B, C, or D to indicate the correct answer to each of the following questions.',
      protectOrder: false,
      matrixRowId: matrixRows[3].id,
    },
    {
      id: `${seed.id}-g5`,
      order: 5,
      title: 'PART 3. READING — TASK 1 (Guided Cloze Test)',
      skill: 'reading',
      groupType: 'cloze_completion',
      instruction:
        'Read the following passage and mark the letter A, B, C, or D to indicate the correct word or phrase that best fits each of the numbered blanks.',
      stimulusTitle: seed.clozeTitle,
      stimulusParagraphs: seed.clozeParagraphs,
      protectOrder: true,
      matrixRowId: matrixRows[4].id,
    },
    {
      id: `${seed.id}-g6`,
      order: 6,
      title: 'PART 3. READING — TASK 2 (Reading Comprehension)',
      skill: 'reading',
      groupType: 'reading_passage',
      instruction:
        'Read the following passage and mark the letter A, B, C, or D to indicate the correct answer to each of the questions.',
      stimulusTitle: seed.readingTitle,
      stimulusParagraphs: seed.readingParagraphs,
      protectOrder: true,
      matrixRowId: matrixRows[5].id,
    },
    {
      id: `${seed.id}-g7`,
      order: 7,
      title: 'PART 4. WRITING — TASK 1 (Sentence Transformation)',
      skill: 'writing',
      groupType: 'standalone_section',
      instruction:
        'Rewrite or combine the following sentences without changing their original meaning.',
      protectOrder: false,
      matrixRowId: matrixRows[6].id,
    },
    {
      id: `${seed.id}-g8`,
      order: 8,
      title: 'PART 4. WRITING — TASK 2 (Paragraph / Short Essay Writing)',
      skill: 'writing',
      groupType: 'standalone_section',
      instruction:
        'Write a well-structured paragraph (120–150 words) on the topic below.',
      protectOrder: true,
      matrixRowId: matrixRows[7].id,
    },
  ];

  const now = 1762000000000;
  const questions: ExamQuestionItem[] = [];
  let qNum = 1;

  const pushQuestion = (item: Omit<ExamQuestionItem, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => {
    questions.push({
      ...item,
      id: `${seed.id}-q${qNum}`,
      number: qNum++,
      createdAt: now,
      updatedAt: now,
    });
  };

  // Q1–4: Listening T/F
  for (const item of seed.listeningPart1Items) {
    pushQuestion({
      grade: seed.grade,
      textbookId: 'global-success',
      unitId: item.unitId,
      topic: seed.topicSummary,
      skill: 'listening',
      cognitiveLevel: item.level,
      questionType: 'true_false',
      format: 'true_false',
      prompt: item.prompt,
      options: [
        {id: 't', label: 'T', text: 'True'},
        {id: 'f', label: 'F', text: 'False'},
      ],
      correctAnswer: item.answer,
      explanation: item.explanation,
      points: 0.25,
      sourceLabel: `Bộ đề mẫu tự biên soạn · ${seed.title}`,
      groupId: groups[0].id,
      audioTranscript: seed.listeningPart1Transcript,
      matrixRowId: matrixRows[0].id,
      sectionOrder: 1,
      verificationStatus: 'teacher_authored',
      tags: [`Lớp ${seed.grade}`, 'Listening', 'CV 7991'],
    });
  }

  // Q5–8: Listening MCQ
  for (const item of seed.listeningPart2Items) {
    pushQuestion({
      grade: seed.grade,
      textbookId: 'global-success',
      unitId: item.unitId,
      topic: seed.topicSummary,
      skill: 'listening',
      cognitiveLevel: item.level,
      questionType: 'mcq',
      format: 'mcq',
      prompt: item.prompt,
      options: makeMcqOptions(item.options),
      correctAnswer: item.answer,
      explanation: item.explanation,
      points: 0.25,
      sourceLabel: `Bộ đề mẫu tự biên soạn · ${seed.title}`,
      groupId: groups[1].id,
      audioTranscript: seed.listeningPart2Transcript,
      matrixRowId: matrixRows[1].id,
      sectionOrder: 2,
      verificationStatus: 'teacher_authored',
      tags: [`Lớp ${seed.grade}`, 'Listening', 'CV 7991'],
    });
  }

  // Q9–12: Phonetics
  for (const item of seed.phoneticsItems) {
    pushQuestion({
      grade: seed.grade,
      textbookId: 'global-success',
      unitId: item.unitId,
      topic: seed.topicSummary,
      skill: 'language',
      cognitiveLevel: item.level,
      questionType: item.pronunciation ? 'pronunciation_underlined' : 'mcq',
      format: 'mcq',
      prompt: item.prompt,
      options: makeMcqOptions(item.options),
      correctAnswer: item.answer,
      explanation: item.explanation,
      points: 0.25,
      sourceLabel: `Bộ đề mẫu tự biên soạn · ${seed.title}`,
      groupId: groups[2].id,
      matrixRowId: matrixRows[2].id,
      sectionOrder: 3,
      verificationStatus: 'teacher_authored',
      tags: [`Lớp ${seed.grade}`, 'Phonetics', 'Language'],
    });
  }

  // Q13–20: Vocabulary & Grammar
  for (const item of seed.vocabGrammarItems) {
    pushQuestion({
      grade: seed.grade,
      textbookId: 'global-success',
      unitId: item.unitId,
      topic: seed.topicSummary,
      skill: 'language',
      cognitiveLevel: item.level,
      questionType: 'mcq',
      format: 'mcq',
      prompt: item.prompt,
      options: makeMcqOptions(item.options),
      correctAnswer: item.answer,
      explanation: item.explanation,
      points: 0.25,
      sourceLabel: `Bộ đề mẫu tự biên soạn · ${seed.title}`,
      groupId: groups[3].id,
      matrixRowId: matrixRows[3].id,
      sectionOrder: 4,
      verificationStatus: 'teacher_authored',
      tags: [`Lớp ${seed.grade}`, 'Vocabulary & Grammar', 'Language'],
    });
  }

  // Q21–25: Guided Cloze
  for (const item of seed.clozeItems) {
    pushQuestion({
      grade: seed.grade,
      textbookId: 'global-success',
      unitId: item.unitId,
      topic: seed.topicSummary,
      skill: 'reading',
      cognitiveLevel: item.level,
      questionType: 'mcq',
      format: 'mcq',
      prompt: item.prompt,
      options: makeMcqOptions(item.options),
      correctAnswer: item.answer,
      explanation: item.explanation,
      points: 0.25,
      sourceLabel: `Bộ đề mẫu tự biên soạn · ${seed.title}`,
      groupId: groups[4].id,
      stimulusTitle: seed.clozeTitle,
      stimulusParagraphs: seed.clozeParagraphs,
      matrixRowId: matrixRows[4].id,
      sectionOrder: 5,
      verificationStatus: 'teacher_authored',
      tags: [`Lớp ${seed.grade}`, 'Reading Cloze'],
    });
  }

  // Q26–30: Reading Comprehension
  for (const item of seed.readingItems) {
    pushQuestion({
      grade: seed.grade,
      textbookId: 'global-success',
      unitId: item.unitId,
      topic: seed.topicSummary,
      skill: 'reading',
      cognitiveLevel: item.level,
      questionType: 'mcq',
      format: 'mcq',
      prompt: item.prompt,
      options: makeMcqOptions(item.options),
      correctAnswer: item.answer,
      explanation: item.explanation,
      points: 0.25,
      sourceLabel: `Bộ đề mẫu tự biên soạn · ${seed.title}`,
      groupId: groups[5].id,
      stimulusTitle: seed.readingTitle,
      stimulusParagraphs: seed.readingParagraphs,
      matrixRowId: matrixRows[5].id,
      sectionOrder: 6,
      verificationStatus: 'teacher_authored',
      tags: [`Lớp ${seed.grade}`, 'Reading Comprehension'],
    });
  }

  // Q31–34: Sentence Transformation
  for (const item of seed.transformationItems) {
    const inferredMeta = inferTransformationMeta({
      prompt: item.prompt,
      correctAnswer: item.answer,
      acceptedAnswers: item.acceptedAnswers,
      explanation: item.explanation,
    });
    pushQuestion({
      grade: seed.grade,
      textbookId: 'global-success',
      unitId: item.unitId,
      topic: seed.topicSummary,
      skill: 'writing',
      cognitiveLevel: item.level,
      questionType: 'transformation',
      format: 'transformation',
      prompt: item.prompt,
      correctAnswer: item.answer,
      acceptedAnswers: item.acceptedAnswers,
      explanation: item.explanation,
      points: 0.25,
      sourceLabel: `Bộ đề mẫu tự biên soạn · ${seed.title}`,
      groupId: groups[6].id,
      matrixRowId: matrixRows[6].id,
      sectionOrder: 7,
      verificationStatus: 'teacher_authored',
      tags: [`Lớp ${seed.grade}`, 'Writing Transformation'],
      transformation: {
        ...inferredMeta,
        grade: seed.grade,
        unitId: item.unitId,
        grammarTopic: seed.topicSummary,
        points: 0.25,
      },
    });
  }

  // Q35: Paragraph Writing (1.5 pts)
  pushQuestion({
    grade: seed.grade,
    textbookId: 'global-success',
    unitId: seed.essayUnitId,
    topic: seed.topicSummary,
    skill: 'writing',
    cognitiveLevel: 'application',
    questionType: 'essay',
    format: 'essay',
    prompt: seed.essayPrompt,
    correctAnswer: 'Chấm theo Rubric Writing 5 tiêu chí (tối đa 1,50 điểm).',
    sampleAnswer: seed.essaySample,
    wordLimit: {min: 120, max: 150},
    explanation: `Gợi ý dàn ý: ${seed.essayOutline.join(' → ')}`,
    points: 1.5,
    sourceLabel: `Bộ đề mẫu tự biên soạn · ${seed.title}`,
    groupId: groups[7].id,
    matrixRowId: matrixRows[7].id,
    sectionOrder: 8,
    verificationStatus: 'teacher_authored',
    tags: [`Lớp ${seed.grade}`, 'Paragraph Writing'],
  });

  const exam = {
    id: `exam-${seed.id}`,
    header: {
      departmentName: '',
      schoolName: '',
      examTitle: seed.examTitleUpper,
      subject: 'TIẾNG ANH',
      gradeLabel: `Lớp ${seed.grade}`,
      academicYear: '2025–2026',
      semesterLabel: seed.semester === 'hk1' ? 'Học kỳ I' : 'Học kỳ II',
      durationMinutes: 60,
      examCode: '101',
      questionCountLabel: `${questions.length} câu`,
      scaleLabel: '10 điểm',
      studentInstructions:
        'Thí sinh làm bài cẩn thận, không sử dụng tài liệu. Giám thị không giải thích gì thêm.',
    },
    groups,
    questions,
  };

  const {answerKey, markingGuide} = syncAnswerKeyAndMarkingGuide(exam, {
    generalInstructions:
      'Chấm điểm theo thang điểm 10. Phần trắc nghiệm 0,25 điểm/câu; phần viết lại câu chấp nhận phương án tương đương đúng ngữ pháp; phần viết đoạn văn chấm theo Rubric 5 tiêu chí.',
    listeningTranscripts: [],
    essaySampleGuides: [
      {
        questionNumber: 35,
        prompt: seed.essayPrompt,
        outlinePoints: seed.essayOutline,
        sampleResponse: seed.essaySample,
        maxScore: 1.5,
      },
    ],
    writingRubric: createDefaultWritingRubric(1.5),
    speakingRubric: createDefaultSpeakingRubric(2.0),
  });

  return {
    id: seed.id,
    title: seed.title,
    createdAt: now,
    updatedAt: now,
    status: 'ready_to_export',
    isSample: true,
    sampleCategory: 'periodic',
    sourceAttribution:
      'Tự biên soạn bám sát SGK Global Success (GDPT 2018) & Công văn 7991/BGDĐT-GDTrH',
    scope,
    blueprint,
    specification,
    exam,
    answerKey,
    markingGuide,
    versions: [],
    sourceReferences: [...OFFICIAL_SOURCE_REFERENCES],
  };
}

export interface GraduationPackSeed {
  id: string;
  title: string;
  examTitleUpper: string;
  examCode: string;
  topicSummary: string;
  noticeTitle: string;
  noticeParagraphs: string[];
  noticeItems: SimpleMCQSpec[]; // 6 items
  leafletTitle: string;
  leafletParagraphs: string[];
  leafletItems: SimpleMCQSpec[]; // 6 items
  arrangementItems: SimpleMCQSpec[]; // 5 items
  clozeTitle: string;
  clozeParagraphs: string[];
  clozeItems: SimpleMCQSpec[]; // 5 items
  reading1Title: string;
  reading1Paragraphs: string[];
  reading1Items: SimpleMCQSpec[]; // 8 items
  reading2Title: string;
  reading2Paragraphs: string[];
  reading2Items: SimpleMCQSpec[]; // 10 items
}

export function buildGraduationSampleDossier(seed: GraduationPackSeed): ExamDossier {
  const all12Units = GLOBAL_SUCCESS_UNITS[12];
  const scope: CurriculumScope = {
    grade: 12,
    academicYear: '2025–2026',
    semester: 'full_year',
    textbookId: 'global-success',
    textbookName: 'Tiếng Anh Global Success 12 (Kết nối tri thức)',
    selectedUnitIds: all12Units.map((u) => u.id),
    selectedTopics: all12Units.flatMap((u) => u.topics),
    knowledgeUnits: all12Units.flatMap((u) => u.knowledgeUnits),
    learningOutcomes: all12Units.flatMap((u) => u.learningOutcomes),
    skills: ['reading', 'language'],
    examType: 'graduation_practice',
    durationMinutes: 50,
    graduationMode: '2025_2026',
  };

  const matrixRows = createGraduation2025MatrixRows(seed.topicSummary).map((r) =>
    recalculateMatrixRow(r, false, 10),
  );
  const blueprint: ExamBlueprint = {
    id: `bp-${seed.id}`,
    templateMode: 'graduation_2025',
    includeHighApplication: false,
    bilingualHeaders: false,
    totalScoreTarget: 10,
    rows: matrixRows,
    notes:
      'Tự biên soạn bám sát cấu trúc đề thi tốt nghiệp THPT môn Tiếng Anh áp dụng từ năm 2025 (40 câu TNKQ, 50 phút, 0,25 điểm/câu).',
  };
  const specification = syncSpecificationFromBlueprint(blueprint, scope);

  const groups: QuestionGroup[] = [
    {
      id: `${seed.id}-g1`,
      order: 1,
      title: 'PART 1. NOTICE / ADVERTISEMENT CLOZE (Questions 1–6)',
      skill: 'reading',
      groupType: 'notice_cloze',
      instruction:
        'Read the following announcement/advertisement and mark the letter A, B, C, or D on your answer sheet to indicate the option that best fits each of the numbered blanks from 1 to 6.',
      stimulusTitle: seed.noticeTitle,
      stimulusParagraphs: seed.noticeParagraphs,
      protectOrder: true,
      matrixRowId: matrixRows[0].id,
    },
    {
      id: `${seed.id}-g2`,
      order: 2,
      title: 'PART 2. LEAFLET CLOZE (Questions 7–12)',
      skill: 'reading',
      groupType: 'leaflet_cloze',
      instruction:
        'Read the following leaflet and mark the letter A, B, C, or D on your answer sheet to indicate the option that best fits each of the numbered blanks from 7 to 12.',
      stimulusTitle: seed.leafletTitle,
      stimulusParagraphs: seed.leafletParagraphs,
      protectOrder: true,
      matrixRowId: matrixRows[1].id,
    },
    {
      id: `${seed.id}-g3`,
      order: 3,
      title: 'PART 3. DIALOGUE, LETTER & PARAGRAPH ARRANGEMENT (Questions 13–17)',
      skill: 'language',
      groupType: 'arrangement_block',
      instruction:
        'Mark the letter A, B, C, or D on your answer sheet to indicate the best arrangement of utterances or sentences to make a meaningful exchange or text in each of the following questions from 13 to 17.',
      protectOrder: true,
      matrixRowId: matrixRows[2].id,
    },
    {
      id: `${seed.id}-g4`,
      order: 4,
      title: 'PART 4. TEXT COMPLETION CLOZE (Questions 18–22)',
      skill: 'reading',
      groupType: 'cloze_completion',
      instruction:
        'Read the following passage and mark the letter A, B, C, or D on your answer sheet to indicate the option that best fits each of the numbered blanks from 18 to 22.',
      stimulusTitle: seed.clozeTitle,
      stimulusParagraphs: seed.clozeParagraphs,
      protectOrder: true,
      matrixRowId: matrixRows[3].id,
    },
    {
      id: `${seed.id}-g5`,
      order: 5,
      title: 'PART 5. READING COMPREHENSION 1 (Questions 23–30)',
      skill: 'reading',
      groupType: 'reading_passage',
      instruction:
        'Read the following passage and mark the letter A, B, C, or D on your answer sheet to indicate the best answer to each of the following questions from 23 to 30.',
      stimulusTitle: seed.reading1Title,
      stimulusParagraphs: seed.reading1Paragraphs,
      protectOrder: true,
      matrixRowId: matrixRows[4].id,
    },
    {
      id: `${seed.id}-g6`,
      order: 6,
      title: 'PART 6. READING COMPREHENSION 2 (Questions 31–40)',
      skill: 'reading',
      groupType: 'reading_passage',
      instruction:
        'Read the following passage and mark the letter A, B, C, or D on your answer sheet to indicate the best answer to each of the following questions from 31 to 40.',
      stimulusTitle: seed.reading2Title,
      stimulusParagraphs: seed.reading2Paragraphs,
      protectOrder: true,
      matrixRowId: matrixRows[5].id,
    },
  ];

  const now = 1762000000000;
  const questions: ExamQuestionItem[] = [];
  let qNum = 1;

  const sections: Array<{
    items: SimpleMCQSpec[];
    group: QuestionGroup;
    skill: ExamSkillKey;
    format: ExamQuestionFormat;
    matrixRowId: string;
    sectionOrder: number;
    stimulusTitle?: string;
    stimulusParagraphs?: string[];
  }> = [
    {
      items: seed.noticeItems,
      group: groups[0],
      skill: 'reading',
      format: 'mcq',
      matrixRowId: matrixRows[0].id,
      sectionOrder: 1,
      stimulusTitle: seed.noticeTitle,
      stimulusParagraphs: seed.noticeParagraphs,
    },
    {
      items: seed.leafletItems,
      group: groups[1],
      skill: 'reading',
      format: 'mcq',
      matrixRowId: matrixRows[1].id,
      sectionOrder: 2,
      stimulusTitle: seed.leafletTitle,
      stimulusParagraphs: seed.leafletParagraphs,
    },
    {
      items: seed.arrangementItems,
      group: groups[2],
      skill: 'language',
      format: 'ordering',
      matrixRowId: matrixRows[2].id,
      sectionOrder: 3,
    },
    {
      items: seed.clozeItems,
      group: groups[3],
      skill: 'reading',
      format: 'mcq',
      matrixRowId: matrixRows[3].id,
      sectionOrder: 4,
      stimulusTitle: seed.clozeTitle,
      stimulusParagraphs: seed.clozeParagraphs,
    },
    {
      items: seed.reading1Items,
      group: groups[4],
      skill: 'reading',
      format: 'mcq',
      matrixRowId: matrixRows[4].id,
      sectionOrder: 5,
      stimulusTitle: seed.reading1Title,
      stimulusParagraphs: seed.reading1Paragraphs,
    },
    {
      items: seed.reading2Items,
      group: groups[5],
      skill: 'reading',
      format: 'mcq',
      matrixRowId: matrixRows[5].id,
      sectionOrder: 6,
      stimulusTitle: seed.reading2Title,
      stimulusParagraphs: seed.reading2Paragraphs,
    },
  ];

  for (const sec of sections) {
    for (const item of sec.items) {
      questions.push({
        id: `${seed.id}-q${qNum}`,
        number: qNum++,
        grade: 12,
        textbookId: 'global-success',
        unitId: item.unitId,
        topic: seed.topicSummary,
        skill: sec.skill,
        cognitiveLevel: item.level,
        questionType: sec.format === 'ordering' ? 'ordering' : 'mcq',
        format: sec.format,
        prompt: item.prompt,
        options: makeMcqOptions(item.options),
        correctAnswer: item.answer,
        explanation: item.explanation,
        points: 0.25,
        sourceLabel: `Đề ôn TN THPT tự biên soạn · ${seed.title}`,
        groupId: sec.group.id,
        stimulusTitle: sec.stimulusTitle,
        stimulusParagraphs: sec.stimulusParagraphs,
        matrixRowId: sec.matrixRowId,
        sectionOrder: sec.sectionOrder,
        verificationStatus: 'teacher_authored',
        tags: ['Lớp 12', 'Tốt nghiệp THPT 2025', sec.group.groupType],
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  const exam = {
    id: `exam-${seed.id}`,
    header: {
      departmentName: '',
      schoolName: '',
      examTitle: seed.examTitleUpper,
      subject: 'TIẾNG ANH',
      gradeLabel: 'Lớp 12',
      academicYear: '2025–2026',
      semesterLabel: 'Cả năm',
      durationMinutes: 50,
      examCode: seed.examCode,
      questionCountLabel: '40 câu trắc nghiệm',
      scaleLabel: '10 điểm (0,25 điểm/câu)',
      studentInstructions:
        'Đề thi gồm 40 câu trắc nghiệm nhiều lựa chọn A, B, C, D. Thời gian làm bài 50 phút, không kể thời gian phát đề.',
    },
    groups,
    questions,
  };

  const {answerKey, markingGuide} = syncAnswerKeyAndMarkingGuide(exam, {
    generalInstructions:
      'Mỗi câu trắc nghiệm đúng được 0,25 điểm. Tổng điểm toàn bài là 10,0 điểm (40 câu × 0,25 điểm). Đề tự biên soạn bám sát cấu trúc đề thi tốt nghiệp THPT áp dụng từ năm 2025.',
    listeningTranscripts: [],
    essaySampleGuides: [],
    writingRubric: createDefaultWritingRubric(1.5),
    speakingRubric: createDefaultSpeakingRubric(2.0),
  });

  return {
    id: seed.id,
    title: seed.title,
    createdAt: now,
    updatedAt: now,
    status: 'ready_to_export',
    isSample: true,
    sampleCategory: 'graduation',
    sourceAttribution:
      'Tự biên soạn bám sát cấu trúc đề thi tốt nghiệp THPT môn Tiếng Anh áp dụng từ năm 2025 (40 câu · 50 phút)',
    scope,
    blueprint,
    specification,
    exam,
    answerKey,
    markingGuide,
    versions: [],
    sourceReferences: [...OFFICIAL_SOURCE_REFERENCES],
  };
}
