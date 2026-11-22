import type {Grade, HighSchoolGrade, LessonProject, QuestionItem, SkillCategory} from '../../types/lesson';
import {GRADE_10_SAMPLES} from './grade10';
import {GRADE_11_SAMPLES} from './grade11';
import {GRADE_12_SAMPLES} from './grade12';

export const SAMPLE_LESSONS_BY_GRADE: Record<HighSchoolGrade, LessonProject[]> = {
  10: GRADE_10_SAMPLES,
  11: GRADE_11_SAMPLES,
  12: GRADE_12_SAMPLES,
};

export const ALL_SAMPLE_LESSONS: LessonProject[] = [
  ...GRADE_10_SAMPLES,
  ...GRADE_11_SAMPLES,
  ...GRADE_12_SAMPLES,
];

export interface BankQuestionEntry {
  question: QuestionItem;
  grade: Grade;
  skill: SkillCategory;
  topic: string;
  lessonTitle: string;
  passageTitle?: string;
  passageParagraphs?: string[];
  audioTranscript?: string;
}

/**
 * Extracts a searchable, filterable Question Bank from all sample lessons + user saved lessons.
 */
export function buildQuestionBank(lessons: LessonProject[]): BankQuestionEntry[] {
  const entries: BankQuestionEntry[] = [];
  for (const lesson of lessons) {
    for (const slide of lesson.slides) {
      if (!slide.questions || slide.questions.length === 0) continue;
      for (const q of slide.questions) {
        entries.push({
          question: q,
          grade: lesson.grade,
          skill: slide.skill || lesson.skill,
          topic: lesson.topic,
          lessonTitle: lesson.title,
          passageTitle: slide.passage?.title,
          passageParagraphs: slide.passage?.paragraphs,
          audioTranscript: slide.audio?.transcript,
        });
      }
    }
  }
  return entries;
}
