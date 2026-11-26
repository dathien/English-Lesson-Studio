import React, {useEffect, useState} from 'react';
import {Check, FolderPlus, Layers, Plus, X} from 'lucide-react';
import type {HighSchoolGrade, LessonProject, Slide} from '../../types/lesson';
import type {LabCategory} from '../../types/interactiveLab';
import {getAllSavedLessons, saveLessonToDB} from '../../services/storage';

interface InsertToLessonModalProps {
  open: boolean;
  onClose: () => void;
  simulationRef: {
    simulationId: string;
    category: LabCategory;
    titleEn: string;
    titleVi: string;
    grade: HighSchoolGrade;
    unitId?: string;
    unitNumber?: number;
    summaryVi?: string;
  };
  onInserted?: (lesson: LessonProject) => void;
}

export const InsertToLessonModal: React.FC<InsertToLessonModalProps> = ({
  open,
  onClose,
  simulationRef,
  onInserted,
}) => {
  const [lessons, setLessons] = useState<LessonProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string>('__new__');
  const [newLessonTitle, setNewLessonTitle] = useState(
    `Lớp ${simulationRef.grade} · ${simulationRef.titleVi}`
  );
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSavedBanner(null);
    setNewLessonTitle(`Lớp ${simulationRef.grade} · ${simulationRef.titleVi}`);
    setLoading(true);
    getAllSavedLessons()
      .then((list) => {
        setLessons(list);
        if (list.length > 0) setSelectedLessonId(list[0].id);
        else setSelectedLessonId('__new__');
      })
      .finally(() => setLoading(false));
  }, [open, simulationRef]);

  if (!open) return null;

  const buildSlide = (order: number): Slide => ({
    id: `slide-lab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    order,
    title: simulationRef.titleEn,
    subtitle: simulationRef.titleVi,
    skill:
      simulationRef.category === 'grammar'
        ? 'grammar'
        : simulationRef.category === 'pronunciation'
          ? 'pronunciation'
          : simulationRef.category === 'roleplay'
            ? 'speaking'
            : 'vocabulary',
    activityType: 'interactive_lab_sim',
    instruction:
      simulationRef.summaryVi ||
      'Tương tác trực tiếp với mô phỏng 2D/3D trên màn hình trình chiếu và thực hành các nhiệm vụ tiếng Anh.',
    bullets: [
      `Mô phỏng tương tác: ${simulationRef.titleEn}`,
      `Chủ đề Tiếng Việt: ${simulationRef.titleVi}`,
      `Khối lớp: Lớp ${simulationRef.grade}${simulationRef.unitNumber ? ` · Unit ${simulationRef.unitNumber}` : ''}`,
    ],
    teacherNotes: `Slide gắn mô phỏng trực tiếp (${simulationRef.simulationId}). Khi trình chiếu, giáo viên và học sinh có thể thao tác trực tiếp trên màn hình.`,
    interactiveLabRef: {
      simulationId: simulationRef.simulationId,
      category: simulationRef.category,
      titleEn: simulationRef.titleEn,
      titleVi: simulationRef.titleVi,
      grade: simulationRef.grade,
      unitId: simulationRef.unitId,
      unitNumber: simulationRef.unitNumber,
      summaryVi: simulationRef.summaryVi,
    },
  });

  const handleInsert = async () => {
    setSaving(true);
    try {
      let targetLesson: LessonProject;
      if (selectedLessonId === '__new__') {
        const title = newLessonTitle.trim() || `Lớp ${simulationRef.grade} · ${simulationRef.titleVi}`;
        const coverSlide: Slide = {
          id: `slide-cover-${Date.now()}`,
          order: 1,
          title,
          subtitle: `English Lesson Studio · Lớp ${simulationRef.grade}`,
          skill: 'review',
          activityType: 'title_slide',
          instruction: 'Bài giảng có tích hợp Không gian học Tiếng Anh tương tác 2D/3D.',
          bullets: [simulationRef.titleEn, simulationRef.titleVi],
        };
        const simSlide = buildSlide(2);
        targetLesson = await saveLessonToDB({
          id: `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title,
          grade: simulationRef.grade,
          educationLevel: 'high_school',
          skill: simSlide.skill,
          topic: simulationRef.titleEn,
          description: `Bài giảng tích hợp mô phỏng tương tác ${simulationRef.titleVi}.`,
          curriculumNote: `Chương trình GDPT 2018 · Tiếng Anh Lớp ${simulationRef.grade}`,
          isSample: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          themeId: 'light_classroom',
          slides: [coverSlide, simSlide],
        });
      } else {
        const existing = lessons.find((l) => l.id === selectedLessonId);
        if (!existing) return;
        const simSlide = buildSlide(existing.slides.length + 1);
        targetLesson = await saveLessonToDB({
          ...existing,
          slides: [...existing.slides, simSlide],
          updatedAt: Date.now(),
        });
      }

      setSavedBanner(`Đã chèn slide mô phỏng vào bài giảng "${targetLesson.title}" thành công!`);
      onInserted?.(targetLesson);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-slate-900">Chèn mô phỏng vào Bài giảng</h3>
              <p className="text-[13px] text-slate-600">{simulationRef.titleEn}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-[14px] text-blue-950">
            <span className="font-semibold">Slide sẽ chạy trực tiếp khi trình chiếu:</span> Giáo viên có thể mở trong{' '}
            <strong>Bài của tôi</strong> → <strong>Trình chiếu</strong> để tương tác 2D/3D ngay trên máy chiếu hoặc tivi lớp học.
          </div>

          {loading ? (
            <p className="text-[15px] text-slate-500">Đang tải danh sách bài giảng đã lưu...</p>
          ) : (
            <div className="space-y-2.5">
              <label className="block text-[15px] font-semibold text-slate-800">
                Chọn bài giảng đích
              </label>

              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors ${
                  selectedLessonId === '__new__'
                    ? 'border-blue-600 bg-blue-50/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="targetLesson"
                  checked={selectedLessonId === '__new__'}
                  onChange={() => setSelectedLessonId('__new__')}
                  className="h-4 w-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
                    <FolderPlus className="h-4 w-4 text-blue-600" />
                    Tạo bài giảng mới chứa slide mô phỏng này
                  </div>
                  {selectedLessonId === '__new__' && (
                    <input
                      type="text"
                      value={newLessonTitle}
                      onChange={(e) => setNewLessonTitle(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 focus:border-blue-500 focus:outline-none"
                      placeholder="Nhập tên bài giảng mới..."
                    />
                  )}
                </div>
              </label>

              {lessons.length > 0 && (
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {lessons.map((lesson) => (
                    <label
                      key={lesson.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                        selectedLessonId === lesson.id
                          ? 'border-blue-600 bg-blue-50/50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="targetLesson"
                        checked={selectedLessonId === lesson.id}
                        onChange={() => setSelectedLessonId(lesson.id)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-semibold text-slate-900">
                          {lesson.title}
                        </div>
                        <div className="text-[13px] text-slate-500">
                          Lớp {lesson.grade} · {lesson.slides.length} slide
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {savedBanner && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] font-semibold text-emerald-900">
              <Check className="h-5 w-5 shrink-0 text-emerald-600" />
              <span>{savedBanner}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-[15px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleInsert}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-[15px] font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {saving ? 'Đang chèn...' : 'Chèn vào bài giảng'}
          </button>
        </div>
      </div>
    </div>
  );
};
