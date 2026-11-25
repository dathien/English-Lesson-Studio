import {openDB, type DBSchema, type IDBPDatabase} from 'idb';
import type {AppSettings, LessonProject, StudentSubmission} from '../types/lesson';
import type {BankQuestionRecord, ExamDossier} from '../types/exam';

interface SlideStudioDB extends DBSchema {
  lessons: {
    key: string;
    value: LessonProject;
    indexes: {'by-updated': number; 'by-grade': number};
  };
  submissions: {
    key: string;
    value: StudentSubmission;
    indexes: {'by-lesson': string; 'by-updated': number};
  };
  settings: {
    key: string;
    value: AppSettings;
  };
  examDossiers: {
    key: string;
    value: ExamDossier;
    indexes: {'by-updated': number; 'by-grade': number};
  };
  questionBank: {
    key: string;
    value: BankQuestionRecord;
    indexes: {'by-grade': number; 'by-skill': string; 'by-updated': number};
  };
}

const DB_NAME = 'english-slide-studio-db';
const DB_VERSION = 2;

export const DEFAULT_SETTINGS: AppSettings = {
  defaultGrade: 10,
  defaultTheme: 'light_classroom',
  presenterFontScale: 1,
  showTeacherNotesByDefault: false,
  teacherName: 'Giáo viên Tiếng Anh THPT',
  schoolName: '',
};

let dbPromise: Promise<IDBPDatabase<SlideStudioDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SlideStudioDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('lessons')) {
          const lessonStore = db.createObjectStore('lessons', {keyPath: 'id'});
          lessonStore.createIndex('by-updated', 'updatedAt');
          lessonStore.createIndex('by-grade', 'grade');
        }
        if (!db.objectStoreNames.contains('submissions')) {
          const subStore = db.createObjectStore('submissions', {keyPath: 'id'});
          subStore.createIndex('by-lesson', 'lessonId');
          subStore.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
        if (!db.objectStoreNames.contains('examDossiers')) {
          const examStore = db.createObjectStore('examDossiers', {keyPath: 'id'});
          examStore.createIndex('by-updated', 'updatedAt');
          examStore.createIndex('by-grade', 'scope.grade');
        }
        if (!db.objectStoreNames.contains('questionBank')) {
          const bankStore = db.createObjectStore('questionBank', {keyPath: 'id'});
          bankStore.createIndex('by-grade', 'grade');
          bankStore.createIndex('by-skill', 'skill');
          bankStore.createIndex('by-updated', 'updatedAt');
        }
      },
    });
  }
  return dbPromise;
}

export async function getAllSavedLessons(): Promise<LessonProject[]> {
  const db = await getDB();
  const list = await db.getAll('lessons');
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getSavedLessonById(id: string): Promise<LessonProject | undefined> {
  const db = await getDB();
  return db.get('lessons', id);
}

export async function saveLessonToDB(lesson: LessonProject): Promise<LessonProject> {
  const db = await getDB();
  const updated: LessonProject = {
    ...lesson,
    isSample: false,
    updatedAt: Date.now(),
  };
  await db.put('lessons', updated);
  return updated;
}

export async function deleteLessonFromDB(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('lessons', id);
}

export async function getSubmissionsByLesson(lessonId: string): Promise<StudentSubmission[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('submissions', 'by-lesson', lessonId);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getAllSubmissions(): Promise<StudentSubmission[]> {
  const db = await getDB();
  const all = await db.getAll('submissions');
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveSubmissionToDB(submission: StudentSubmission): Promise<StudentSubmission> {
  const db = await getDB();
  const record = {...submission, updatedAt: Date.now()};
  await db.put('submissions', record);
  return record;
}

export async function deleteSubmissionFromDB(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('submissions', id);
}

export async function loadSettingsFromDB(): Promise<AppSettings> {
  const db = await getDB();
  const stored = await db.get('settings', 'app-settings');
  return stored ? {...DEFAULT_SETTINGS, ...stored} : DEFAULT_SETTINGS;
}

export async function saveSettingsToDB(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', settings, 'app-settings');
}

export function exportLessonAsJson(lesson: LessonProject): void {
  const payload = {
    format: 'english-slide-studio-project',
    version: 1,
    exportedAt: new Date().toISOString(),
    lesson,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = lesson.title.replace(/[^a-zA-Z0-9\u00C0-\u1EF9\s_-]/g, '').trim().replace(/\s+/g, '_') || 'bai_giang';
  a.href = url;
  a.download = `${safeName}.ess.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importLessonFromJsonFile(file: File): Promise<LessonProject> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const raw: LessonProject = parsed?.lesson ?? parsed;
  if (!raw || typeof raw.title !== 'string' || !Array.isArray(raw.slides)) {
    throw new Error('Tệp JSON không đúng định dạng dự án English Slide Studio.');
  }
  const imported: LessonProject = {
    ...raw,
    id: `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    isSample: false,
    updatedAt: Date.now(),
    createdAt: raw.createdAt || Date.now(),
  };
  return saveLessonToDB(imported);
}

// --- Exam Dossiers & Question Bank (IndexedDB v2, offline-first) ---

export async function getAllExamDossiers(): Promise<ExamDossier[]> {
  const db = await getDB();
  const list = await db.getAll('examDossiers');
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveExamDossierToDB(dossier: ExamDossier): Promise<ExamDossier> {
  const db = await getDB();
  const record: ExamDossier = {
    ...dossier,
    isSample: false,
    updatedAt: Date.now(),
  };
  await db.put('examDossiers', record);
  return record;
}

export async function deleteExamDossierFromDB(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('examDossiers', id);
}

export function exportExamDossierAsJson(dossier: ExamDossier): void {
  const payload = {
    format: 'english-lesson-studio-exam-dossier',
    version: 1,
    exportedAt: new Date().toISOString(),
    dossier,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName =
    dossier.title
      .replace(/[^a-zA-Z0-9\u00C0-\u1EF9\s_-]/g, '')
      .trim()
      .replace(/\s+/g, '_') || 'ho_so_de_kiem_tra';
  a.href = url;
  a.download = `${safeName}.exam.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importExamDossierFromJsonFile(file: File): Promise<ExamDossier> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const raw: ExamDossier = parsed?.dossier ?? parsed;
  if (!raw || !raw.blueprint || !raw.exam || !Array.isArray(raw.exam.questions)) {
    throw new Error('Tệp JSON không đúng định dạng Hồ sơ đề kiểm tra của English Lesson Studio.');
  }
  const imported: ExamDossier = {
    ...raw,
    id: `exam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    isSample: false,
    createdAt: raw.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  return saveExamDossierToDB(imported);
}

export async function getAllBankQuestions(): Promise<BankQuestionRecord[]> {
  const db = await getDB();
  const list = await db.getAll('questionBank');
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveBankQuestionToDB(item: BankQuestionRecord): Promise<BankQuestionRecord> {
  const db = await getDB();
  const record: BankQuestionRecord = {...item, updatedAt: Date.now()};
  await db.put('questionBank', record);
  return record;
}

export async function bulkSaveBankQuestionsToDB(items: BankQuestionRecord[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('questionBank', 'readwrite');
  for (const item of items) {
    await tx.store.put({...item, updatedAt: Date.now()});
  }
  await tx.done;
}

export async function deleteBankQuestionFromDB(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('questionBank', id);
}

