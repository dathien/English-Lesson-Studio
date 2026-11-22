import {openDB, type DBSchema, type IDBPDatabase} from 'idb';
import type {AppSettings, LessonProject, StudentSubmission} from '../types/lesson';

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
}

const DB_NAME = 'english-slide-studio-db';
const DB_VERSION = 1;

export const DEFAULT_SETTINGS: AppSettings = {
  defaultGrade: 10,
  defaultTheme: 'light_classroom',
  presenterFontScale: 1,
  showTeacherNotesByDefault: false,
  teacherName: 'Giáo viên Tiếng Anh THPT',
  schoolName: 'Trường THPT',
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
