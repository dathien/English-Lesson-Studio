import type {BankQuestionRecord, ExamDossier} from '../../types/exam';
import {ALL_SAMPLE_LESSONS} from '../samples';
import {CURATED_TRANSFORMATION_BANK} from '../sentenceTransformationBank';
import {inferTransformationMeta} from '../../services/sentenceTransformationEngine';
import {PERIODIC_GRADE_10_PACKS} from './periodicGrade10';
import {PERIODIC_GRADE_11_PACKS} from './periodicGrade11';
import {PERIODIC_GRADE_12_PACKS} from './periodicGrade12';
import {GRADUATION_PACK_01} from './graduationPack1';
import {GRADUATION_PACK_02} from './graduationPack2';
import {GRADUATION_PACK_03} from './graduationPack3';

export const ALL_PERIODIC_EXAM_PACKS: ExamDossier[] = [
  ...PERIODIC_GRADE_10_PACKS,
  ...PERIODIC_GRADE_11_PACKS,
  ...PERIODIC_GRADE_12_PACKS,
];

export const ALL_GRADUATION_EXAM_PACKS: ExamDossier[] = [
  GRADUATION_PACK_01,
  GRADUATION_PACK_02,
  GRADUATION_PACK_03,
];

export const ALL_SAMPLE_EXAM_PACKS: ExamDossier[] = [
  ...ALL_PERIODIC_EXAM_PACKS,
  ...ALL_GRADUATION_EXAM_PACKS,
];

/**
 * Unified Searchable Question Bank seeded from:
 * - All 12 THPT Periodic Sample Exam Packs (12 × 35 = 420 authentic questions)
 * - All 3 THPT Graduation 2025 Sample Exam Packs (3 × 40 = 120 authentic questions)
 * - Compatible items from existing 30 THPT Sample Lessons
 */
export function buildInitialQuestionBank(): BankQuestionRecord[] {
  const bank: BankQuestionRecord[] = [];
  const seenIds = new Set<string>();

  for (const pack of ALL_SAMPLE_EXAM_PACKS) {
    const groupMap = new Map(pack.exam.groups.map((g) => [g.id, g]));
    for (const q of pack.exam.questions) {
      if (seenIds.has(q.id)) continue;
      seenIds.add(q.id);
      const grp = q.groupId ? groupMap.get(q.groupId) : undefined;
      bank.push({
        id: q.id,
        grade: q.grade,
        textbookId: q.textbookId,
        unitId: q.unitId,
        topic: q.topic,
        skill: q.skill,
        cognitiveLevel: q.cognitiveLevel,
        questionType: q.questionType,
        format: q.format,
        prompt: q.prompt,
        options: q.options,
        correctAnswer: q.correctAnswer,
        acceptedAnswers: q.acceptedAnswers,
        explanation: q.explanation,
        points: q.points,
        sourceLabel: q.sourceLabel,
        groupId: q.groupId,
        stimulusTitle: q.stimulusTitle || grp?.stimulusTitle,
        stimulusParagraphs: q.stimulusParagraphs || grp?.stimulusParagraphs,
        audioTranscript: q.audioTranscript || grp?.audio?.transcript,
        verificationStatus: q.verificationStatus,
        tags: q.tags,
        transformation: q.transformation,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
      });
    }
  }

  // Merge curated Global Success 10–11–12 Sentence Transformation bank into the SAME unified bank
  for (const tfItem of CURATED_TRANSFORMATION_BANK) {
    if (seenIds.has(tfItem.id)) continue;
    seenIds.add(tfItem.id);
    bank.push(tfItem);
  }

  // Also enrich with existing 30 THPT sample lesson questions
  for (const lesson of ALL_SAMPLE_LESSONS) {
    if (lesson.grade < 10) continue;
    const grade = lesson.grade as 10 | 11 | 12;
    const skill =
      lesson.skill === 'listening' ||
      lesson.skill === 'speaking' ||
      lesson.skill === 'reading' ||
      lesson.skill === 'writing'
        ? lesson.skill
        : 'language';

    for (const slide of lesson.slides) {
      if (!slide.questions || slide.questions.length === 0) continue;
      for (const sq of slide.questions) {
        const id = `lessonbank-${lesson.id}-${sq.id}`;
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        const format =
          sq.type === 'true_false'
            ? 'true_false'
            : sq.type === 'transformation'
              ? 'transformation'
              : sq.type === 'gap_fill'
                ? 'gap_fill'
                : sq.type === 'ordering'
                  ? 'ordering'
                  : 'mcq';
        bank.push({
          id,
          grade,
          textbookId: 'global-success',
          unitId: `gs${grade}-u1`,
          topic: lesson.topic,
          skill,
          cognitiveLevel: sq.cognitiveLevel || 'comprehension',
          questionType: sq.type,
          format,
          prompt: sq.prompt,
          options: sq.options,
          correctAnswer: sq.correctAnswer,
          acceptedAnswers: sq.acceptedAnswers,
          explanation: sq.explanation || `Trích từ bài giảng mẫu "${lesson.title}".`,
          points: 0.25,
          sourceLabel: `Kho bài mẫu · ${lesson.title}`,
          groupId: slide.passage || slide.audio ? `lesson-grp-${slide.id}` : undefined,
          stimulusTitle: slide.passage?.title || slide.title,
          stimulusParagraphs: slide.passage?.paragraphs,
          audioTranscript: slide.audio?.transcript,
          verificationStatus: 'teacher_authored',
          tags: [`Lớp ${grade}`, lesson.skill, lesson.topic],
          transformation:
            format === 'transformation'
              ? sq.transformation || {
                  ...inferTransformationMeta(sq),
                  grade,
                  unitId: `gs${grade}-u1`,
                  grammarTopic: lesson.topic,
                }
              : undefined,
          createdAt: lesson.createdAt,
          updatedAt: lesson.updatedAt,
        });
      }
    }
  }

  return bank;
}

export const INITIAL_EXAM_QUESTION_BANK: BankQuestionRecord[] = buildInitialQuestionBank();
