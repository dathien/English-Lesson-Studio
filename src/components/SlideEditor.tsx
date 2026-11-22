import React, {useState} from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Copy,
  Download,
  FileDown,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Mic,
  PenLine,
  Play,
  Plus,
  Printer,
  Redo2,
  Save,
  Trash2,
  Underline,
  Undo2,
  Video,
  Volume2,
} from 'lucide-react';
import type {
  ActivityType,
  Grade,
  LessonProject,
  QuestionItem,
  QuestionType,
  SkillCategory,
  Slide,
  SlideThemeId,
  VocabCardItem,
} from '../types/lesson';
import {
  ACTIVITY_LABELS,
  DEFAULT_SPEAKING_RUBRIC,
  DEFAULT_WRITING_RUBRIC,
  SKILL_LABELS,
  SKILL_SHORT_LABELS,
} from '../types/lesson';
import {
  exportLessonToPowerPoint,
  exportLessonToWord,
  printLessonAsPDF,
} from '../services/exporters';
import {exportLessonAsJson} from '../services/storage';
import {RenderFormattedText} from '../utils/richText';
import {ListeningWidget} from './interactive/ListeningWidget';

interface SlideEditorProps {
  lesson: LessonProject;
  onSave: (updated: LessonProject) => Promise<void>;
  onPresent: (lesson: LessonProject, startIndex: number) => void;
  onBack: () => void;
}

type InspectorTab = 'slide' | 'passage' | 'questions' | 'audio' | 'vocab' | 'speaking' | 'writing' | 'media';

function createTemplateSlide(type: SkillCategory, order: number): Slide {
  const id = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  if (type === 'listening') {
    return {
      id,
      order,
      title: 'Listening Comprehension Activity',
      skill: 'listening',
      activityType: 'listening_mcq',
      instruction: 'Listen to the recording and choose the best answer.',
      audio: {
        sourceMode: 'builtin',
        voiceAccent: 'en-GB',
        isSynthesized: true,
        skillObjective: '',
        transcript: '',
        showTranscriptDefault: false,
        timestamps: [],
      },
      questions: [
        {
          id: `q-${Date.now()}`,
          number: 1,
          type: 'mcq',
          prompt: 'What is the main topic of the conversation?',
          options: [
            {id: 'a', label: 'A', text: 'Option A'},
            {id: 'b', label: 'B', text: 'Option B'},
            {id: 'c', label: 'C', text: 'Option C'},
            {id: 'd', label: 'D', text: 'Option D'},
          ],
          correctAnswer: 'A',
          explanation: '',
        },
      ],
    };
  }
  if (type === 'speaking') {
    return {
      id,
      order,
      title: 'Speaking Practice & Rubric',
      skill: 'speaking',
      activityType: 'speaking_discussion',
      instruction: 'Work in pairs and record your 1-minute response.',
      speakingTask: {
        prompt: 'Discuss your opinion on the lesson topic and provide two supporting reasons.',
        cues: ['State your opinion clearly', 'Give two specific examples', 'Conclude concisely'],
        ipaFocus: [{text: 'communication', ipa: '/kəˌmjuː.nɪˈkeɪ.ʃən/', note: 'Nhấn âm tiết 4'}],
        rubricCriteria: DEFAULT_SPEAKING_RUBRIC,
      },
    };
  }
  if (type === 'reading') {
    return {
      id,
      order,
      title: 'Reading Comprehension',
      skill: 'reading',
      activityType: 'reading_mcq',
      instruction: 'Read the passage on the left and answer the questions on the right.',
      passage: {
        title: 'Reading Passage Title',
        paragraphs: ['Nhập đoạn văn đọc hiểu gốc tại đây. Hệ thống giữ nguyên cấu trúc đoạn văn.'],
      },
      questions: [
        {
          id: `q-${Date.now()}`,
          number: 1,
          type: 'mcq',
          prompt: 'According to the passage, which statement is TRUE?',
          options: [
            {id: 'a', label: 'A', text: 'Option A'},
            {id: 'b', label: 'B', text: 'Option B'},
            {id: 'c', label: 'C', text: 'Option C'},
            {id: 'd', label: 'D', text: 'Option D'},
          ],
          correctAnswer: 'A',
          explanation: '',
        },
      ],
    };
  }
  if (type === 'writing') {
    return {
      id,
      order,
      title: 'Writing Practice',
      skill: 'writing',
      activityType: 'writing_paragraph',
      instruction: 'Write a coherent paragraph following the suggested outline.',
      writingTask: {
        prompt: 'Write a paragraph (120–150 words) on the topic of this unit.',
        minWords: 120,
        maxWords: 150,
        outlineHints: ['Topic sentence', 'Supporting idea 1 + example', 'Supporting idea 2 + example', 'Concluding sentence'],
        usefulExpressions: ['In my opinion,', 'Firstly,', 'In addition,', 'In conclusion,'],
        rubricCriteria: DEFAULT_WRITING_RUBRIC,
      },
    };
  }
  if (type === 'vocabulary') {
    return {
      id,
      order,
      title: 'Vocabulary Flashcards',
      skill: 'vocabulary',
      activityType: 'vocab_flashcards',
      instruction: 'Click each card to review IPA, meaning, and collocations.',
      vocabItems: [
        {
          id: `vc-${Date.now()}`,
          word: 'sustainable',
          ipa: '/səˈsteɪ.nə.bəl/',
          partOfSpeech: 'adj',
          meaningVi: 'bền vững',
          example: 'We should promote sustainable energy sources.',
          collocations: ['sustainable development'],
        },
      ],
    };
  }
  if (type === 'pronunciation') {
    return {
      id,
      order,
      title: 'Pronunciation & IPA Focus',
      skill: 'pronunciation',
      activityType: 'pron_vowels_consonants',
      instruction: 'Choose the word whose underlined part differs from the other three.',
      questions: [
        {
          id: `q-${Date.now()}`,
          number: 1,
          type: 'pronunciation_underlined',
          prompt: 'Choose the word whose underlined part is pronounced differently:',
          options: [
            {id: 'a', label: 'A', text: 'work<u>ed</u>', ipa: '/wɜːkt/'},
            {id: 'b', label: 'B', text: 'watch<u>ed</u>', ipa: '/wɒtʃt/'},
            {id: 'c', label: 'C', text: 'stopp<u>ed</u>', ipa: '/stɒpt/'},
            {id: 'd', label: 'D', text: 'play<u>ed</u>', ipa: '/pleɪd/'},
          ],
          correctAnswer: 'D',
          explanation: 'A, B, C đọc là /t/; D đọc là /d/.',
        },
      ],
    };
  }
  return {
    id,
    order,
    title: 'Grammar & Practice',
    skill: type,
    activityType: 'grammar_mcq',
    instruction: 'Choose the best answer to complete each sentence.',
    questions: [
      {
        id: `q-${Date.now()}`,
        number: 1,
        type: 'mcq',
        prompt: 'Complete the sentence with the correct grammatical structure.',
        options: [
          {id: 'a', label: 'A', text: 'Option A'},
          {id: 'b', label: 'B', text: 'Option B'},
          {id: 'c', label: 'C', text: 'Option C'},
          {id: 'd', label: 'D', text: 'Option D'},
        ],
        correctAnswer: 'A',
        explanation: '',
      },
    ],
  };
}

export const SlideEditor: React.FC<SlideEditorProps> = ({
  lesson: initialLesson,
  onSave,
  onPresent,
  onBack,
}) => {
  const [draft, setDraft] = useState<LessonProject>(() => structuredClone(initialLesson));
  const [history, setHistory] = useState<LessonProject[]>([]);
  const [future, setFuture] = useState<LessonProject[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('slide');
  const [dragSlideIdx, setDragSlideIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const activeSlide = draft.slides[selectedIdx] || draft.slides[0];

  const commitChange = (updater: (prev: LessonProject) => LessonProject) => {
    setDraft((prev) => {
      const next = updater(structuredClone(prev));
      setHistory((h) => [...h.slice(-24), prev]);
      setFuture([]);
      return next;
    });
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [draft, ...f]);
    setDraft(previous);
    setSelectedIdx((idx) => Math.min(idx, Math.max(0, previous.slides.length - 1)));
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, draft]);
    setDraft(next);
    setSelectedIdx((idx) => Math.min(idx, Math.max(0, next.slides.length - 1)));
  };

  const updateCurrentSlide = (patch: Partial<Slide>) => {
    if (!activeSlide) return;
    commitChange((prev) => {
      prev.slides[selectedIdx] = {...prev.slides[selectedIdx], ...patch};
      return prev;
    });
  };

  const handleAddSlide = (skill: SkillCategory) => {
    const newSlide = createTemplateSlide(skill, draft.slides.length);
    commitChange((prev) => {
      prev.slides.push(newSlide);
      return prev;
    });
    setSelectedIdx(draft.slides.length);
    setShowAddMenu(false);
    if (skill === 'reading') setInspectorTab('passage');
    else if (skill === 'listening') setInspectorTab('audio');
    else if (skill === 'speaking') setInspectorTab('speaking');
    else if (skill === 'writing') setInspectorTab('writing');
    else if (skill === 'vocabulary') setInspectorTab('vocab');
    else setInspectorTab('questions');
  };

  const handleDuplicateSlide = (idx: number) => {
    commitChange((prev) => {
      const copy = structuredClone(prev.slides[idx]);
      copy.id = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      copy.title = `${copy.title} (Bản sao)`;
      prev.slides.splice(idx + 1, 0, copy);
      prev.slides.forEach((s, i) => {
        s.order = i;
      });
      return prev;
    });
    setSelectedIdx(idx + 1);
  };

  const handleDeleteSlide = (idx: number) => {
    if (draft.slides.length <= 1) return;
    commitChange((prev) => {
      prev.slides.splice(idx, 1);
      prev.slides.forEach((s, i) => {
        s.order = i;
      });
      return prev;
    });
    setSelectedIdx((cur) => Math.max(0, Math.min(cur, draft.slides.length - 2)));
  };

  const moveSlide = (from: number, to: number) => {
    if (to < 0 || to >= draft.slides.length || from === to) return;
    commitChange((prev) => {
      const [moved] = prev.slides.splice(from, 1);
      prev.slides.splice(to, 0, moved);
      prev.slides.forEach((s, i) => {
        s.order = i;
      });
      return prev;
    });
    setSelectedIdx(to);
  };

  const handleSaveClick = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setStatusMessage('Đã lưu bài giảng vào IndexedDB thành công.');
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadSlideImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateCurrentSlide({imageUrl: String(reader.result || ''), imageCaption: file.name});
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSlideVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateCurrentSlide({videoUrl: String(reader.result || '')});
    };
    reader.readAsDataURL(file);
  };

  const addQuestionToSlide = (qType: QuestionType) => {
    const existing = activeSlide.questions || [];
    const nextNum = existing.length > 0 ? Math.max(...existing.map((q) => q.number)) + 1 : 1;
    const base: QuestionItem = {
      id: `q-${Date.now()}`,
      number: nextNum,
      type: qType,
      prompt:
        qType === 'pronunciation_underlined'
          ? 'Choose the word whose underlined part is pronounced differently:'
          : qType === 'word_order'
            ? 'Arrange the words to make a meaningful sentence:'
            : qType === 'matching'
              ? 'Match the items in column A with column B:'
              : `Nội dung câu hỏi số ${nextNum}`,
      correctAnswer: qType === 'mcq' || qType === 'pronunciation_underlined' ? 'A' : qType === 'true_false' ? 'True' : '',
      explanation: '',
    };

    if (qType === 'mcq' || qType === 'pronunciation_underlined' || qType === 'error_correction') {
      base.options = [
        {id: 'a', label: 'A', text: qType === 'pronunciation_underlined' ? 'work<u>ed</u>' : 'Option A'},
        {id: 'b', label: 'B', text: qType === 'pronunciation_underlined' ? 'play<u>ed</u>' : 'Option B'},
        {id: 'c', label: 'C', text: qType === 'pronunciation_underlined' ? 'watch<u>ed</u>' : 'Option C'},
        {id: 'd', label: 'D', text: qType === 'pronunciation_underlined' ? 'stopp<u>ed</u>' : 'Option D'},
      ];
    } else if (qType === 'true_false') {
      base.options = [
        {id: 't', label: 'True', text: 'True'},
        {id: 'f', label: 'False', text: 'False'},
      ];
    } else if (qType === 'matching') {
      base.matchingPairs = [
        {id: 'p1', left: 'Term 1', right: 'Definition 1'},
        {id: 'p2', left: 'Term 2', right: 'Definition 2'},
      ];
      base.correctAnswer = 'Matched all pairs';
    } else if (qType === 'ordering' || qType === 'word_order') {
      base.orderItems = ['Step 1', 'Step 2', 'Step 3'];
      base.correctAnswer = 'Step 1 → Step 2 → Step 3';
    }

    updateCurrentSlide({questions: [...existing, base]});
    setInspectorTab('questions');
  };

  const updateQuestion = (qIdx: number, patch: Partial<QuestionItem>) => {
    const list = structuredClone(activeSlide.questions || []);
    list[qIdx] = {...list[qIdx], ...patch};
    updateCurrentSlide({questions: list});
  };

  const removeQuestion = (qIdx: number) => {
    const list = structuredClone(activeSlide.questions || []);
    list.splice(qIdx, 1);
    updateCurrentSlide({questions: list});
  };

  const addVocabCard = () => {
    const list = structuredClone(activeSlide.vocabItems || []);
    const item: VocabCardItem = {
      id: `vc-${Date.now()}`,
      word: 'new word',
      ipa: '/njuː wɜːd/',
      partOfSpeech: 'n',
      meaningVi: 'nghĩa tiếng Việt',
      example: 'Write an example sentence here.',
      collocations: [],
    };
    list.push(item);
    updateCurrentSlide({vocabItems: list});
    setInspectorTab('vocab');
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-130px)] bg-[#F8FAFC]">
      {/* Editor Top Command Bar (Single Clean Row, Zero Overlap) */}
      <div className="border-b border-slate-200 bg-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            Thoát biên tập
          </button>

          <input
            type="text"
            value={draft.title}
            onChange={(e) => commitChange((p) => ({...p, title: e.target.value}))}
            aria-label="Tiêu đề bài giảng"
            className="min-w-[200px] sm:w-80 rounded-lg border border-transparent hover:border-slate-300 focus:border-[#0284C7] px-2.5 py-1.5 text-base font-semibold text-slate-900 outline-none"
          />

          <select
            value={draft.grade}
            onChange={(e) => commitChange((p) => ({...p, grade: Number(e.target.value) as Grade}))}
            aria-label="Khối lớp"
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-medium text-slate-800"
          >
            <option value={10}>Lớp 10</option>
            <option value={11}>Lớp 11</option>
            <option value={12}>Lớp 12</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length === 0}
              title="Hoàn tác (Undo)"
              className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-35"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={future.length === 0}
              title="Làm lại (Redo)"
              className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-35 border-l border-slate-200"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveClick}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Đang lưu...' : 'Lưu bài'}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              Xuất file
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg z-30 space-y-0.5 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false);
                    exportLessonToPowerPoint(draft);
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                >
                  <FileDown className="w-4 h-4 text-[#0F4C81]" />
                  Xuất PowerPoint (.pptx)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false);
                    exportLessonToWord(draft, {includeAnswers: true});
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                >
                  <FileDown className="w-4 h-4 text-[#0284C7]" />
                  Xuất Word (.docx)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false);
                    printLessonAsPDF(draft, {includeAnswers: true});
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  Xuất PDF / In bài tập
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false);
                    exportLessonAsJson(draft);
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                >
                  <Download className="w-4 h-4 text-emerald-700" />
                  Xuất JSON dự án (.ess.json)
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onPresent(draft, selectedIdx)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#0B3A63] whitespace-nowrap"
          >
            <Play className="w-4 h-4" />
            Trình chiếu 16:9
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-sm text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {statusMessage}
        </div>
      )}

      {/* 3-Pane Studio Workspace: Left Slides | Center Canvas | Right Object Inspector */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">
        {/* LEFT PANE: Slide List with Drag-and-Drop Reorder */}
        <aside className="lg:col-span-3 xl:col-span-2 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white flex flex-col max-h-[300px] lg:max-h-[calc(100vh-190px)]">
          <div className="p-3 border-b border-slate-200 flex items-center justify-between gap-2 relative">
            <span className="text-sm font-semibold text-slate-900">
              Slide ({draft.slides.length})
            </span>
            <button
              type="button"
              onClick={() => setShowAddMenu((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg bg-[#0F4C81] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#0B3A63] whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Thêm slide
            </button>

            {showAddMenu && (
              <div className="absolute left-3 right-3 top-12 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-20 grid grid-cols-1 gap-0.5 text-xs">
                {(
                  [
                    'listening',
                    'speaking',
                    'reading',
                    'writing',
                    'vocabulary',
                    'grammar',
                    'pronunciation',
                    'review',
                  ] as SkillCategory[]
                ).map((sk) => (
                  <button
                    key={sk}
                    type="button"
                    onClick={() => handleAddSlide(sk)}
                    className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-sky-50 hover:text-[#0F4C81] font-medium"
                  >
                    + {SKILL_LABELS[sk]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto studio-scroll p-2.5 space-y-2">
            {draft.slides.map((s, idx) => (
              <div
                key={s.id}
                draggable
                onDragStart={() => setDragSlideIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragSlideIdx !== null && dragSlideIdx !== idx) {
                    moveSlide(dragSlideIdx, idx);
                  }
                  setDragSlideIdx(null);
                }}
                onClick={() => setSelectedIdx(idx)}
                className={`rounded-xl border p-2.5 cursor-pointer transition-colors ${
                  idx === selectedIdx
                    ? 'border-[#0284C7] bg-sky-50/70 ring-1 ring-[#0284C7]'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 text-slate-400 shrink-0 mt-0.5 cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {idx + 1}. {s.title}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {SKILL_SHORT_LABELS[s.skill]}
                      {s.questions?.length ? ` · ${s.questions.length} câu` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 mt-2 pt-1.5 border-t border-slate-200/70">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveSlide(idx, idx - 1);
                    }}
                    disabled={idx === 0}
                    className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                    title="Đưa lên"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveSlide(idx, idx + 1);
                    }}
                    disabled={idx === draft.slides.length - 1}
                    className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                    title="Đưa xuống"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateSlide(idx);
                    }}
                    className="p-1 text-slate-500 hover:text-[#0284C7]"
                    title="Nhân bản slide"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSlide(idx);
                    }}
                    disabled={draft.slides.length <= 1}
                    className="p-1 text-slate-500 hover:text-rose-600 disabled:opacity-30"
                    title="Xóa slide"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* CENTER PANE: Live Editable Slide Canvas */}
        <main className="lg:col-span-5 xl:col-span-6 p-4 sm:p-6 overflow-y-auto studio-scroll max-h-[calc(100vh-190px)]">
          {activeSlide && (
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Quick Object Insert Strip */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Chèn nhanh vào slide:</span>
                <button
                  type="button"
                  onClick={() => addQuestionToSlide('mcq')}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:border-[#0284C7]"
                >
                  + Câu trắc nghiệm
                </button>
                <button
                  type="button"
                  onClick={() => addQuestionToSlide('gap_fill')}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:border-[#0284C7]"
                >
                  + Điền từ
                </button>
                <button
                  type="button"
                  onClick={() => addQuestionToSlide('pronunciation_underlined')}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:border-[#0284C7]"
                >
                  + Phát âm gạch chân
                </button>
                <button
                  type="button"
                  onClick={() => addQuestionToSlide('matching')}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:border-[#0284C7]"
                >
                  + Nối cặp
                </button>
                <button
                  type="button"
                  onClick={() => addQuestionToSlide('ordering')}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:border-[#0284C7]"
                >
                  + Kéo thả sắp xếp
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!activeSlide.passage) {
                      updateCurrentSlide({
                        passage: {title: 'Reading Passage', paragraphs: ['Nhập nội dung đoạn đọc tại đây...']},
                      });
                    }
                    setInspectorTab('passage');
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:border-[#0284C7]"
                >
                  + Bài đọc
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!activeSlide.audio) {
                      updateCurrentSlide({audio: {transcript: '', timestamps: []}});
                    }
                    setInspectorTab('audio');
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:border-[#0284C7]"
                >
                  + Âm thanh
                </button>
                <button
                  type="button"
                  onClick={addVocabCard}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:border-[#0284C7]"
                >
                  + Flashcard IPA
                </button>
              </div>

              {/* 16:9 Live Preview Canvas */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-[#0F4C81] px-5 py-3.5 text-white">
                  <div className="text-xs text-sky-200 mb-1">
                    Slide {selectedIdx + 1} · {SKILL_SHORT_LABELS[activeSlide.skill]} ·{' '}
                    {ACTIVITY_LABELS[activeSlide.activityType]}
                  </div>
                  <input
                    type="text"
                    value={activeSlide.title}
                    onChange={(e) => updateCurrentSlide({title: e.target.value})}
                    className="w-full bg-transparent text-lg font-bold text-white outline-none border-b border-transparent focus:border-sky-300"
                    placeholder="Tiêu đề slide..."
                  />
                </div>

                <div className="p-5 space-y-4">
                  {/* Direct Instruction Edit */}
                  <div onClick={() => setInspectorTab('slide')}>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">
                      Hướng dẫn hoạt động (Instruction)
                    </label>
                    <input
                      type="text"
                      value={activeSlide.instruction || ''}
                      onChange={(e) => updateCurrentSlide({instruction: e.target.value})}
                      placeholder="Nhập hướng dẫn ngắn gọn cho học sinh..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-800 focus:bg-white focus:border-[#0284C7] outline-none"
                    />
                  </div>

                  {/* Media Preview */}
                  {activeSlide.imageUrl && (
                    <div
                      onClick={() => setInspectorTab('media')}
                      className="rounded-xl border border-slate-200 p-2 cursor-pointer hover:border-[#0284C7]"
                    >
                      <img
                        src={activeSlide.imageUrl}
                        alt={activeSlide.imageCaption || activeSlide.title}
                        referrerPolicy="no-referrer"
                        className="w-full max-h-56 object-cover rounded-lg"
                      />
                      {activeSlide.imageCaption && (
                        <p className="text-xs text-slate-500 mt-1.5">{activeSlide.imageCaption}</p>
                      )}
                    </div>
                  )}

                  {/* Listening Audio Preview & 3-Source Teacher Manager */}
                  {activeSlide.audio && (
                    <div onClick={() => setInspectorTab('audio')}>
                      <ListeningWidget
                        audioConfig={activeSlide.audio}
                        grade={draft.grade}
                        lessonTitle={draft.title}
                        topic={draft.topic}
                        onUpdateAudio={(nextAudio) => updateCurrentSlide({audio: nextAudio})}
                        onAppendQuestions={(newQs) =>
                          updateCurrentSlide({
                            questions: [...(activeSlide.questions || []), ...newQs],
                          })
                        }
                      />
                    </div>
                  )}

                  {/* Reading Passage Preview */}
                  {activeSlide.passage && (
                    <div
                      onClick={() => setInspectorTab('passage')}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2 cursor-pointer hover:border-[#0284C7]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#0F4C81]">
                          {activeSlide.passage.title || 'Reading Passage'}
                        </span>
                        <span className="text-xs text-slate-500">Bấm để sửa ở khung phải</span>
                      </div>
                      {activeSlide.passage.paragraphs.map((p, idx) => (
                        <p key={idx} className="text-sm text-slate-700 leading-relaxed">
                          <RenderFormattedText text={p} />
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Questions Preview */}
                  {activeSlide.questions && activeSlide.questions.length > 0 && (
                    <div
                      onClick={() => setInspectorTab('questions')}
                      className="space-y-2.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">
                          Danh sách câu hỏi ({activeSlide.questions.length}) — bấm để chỉnh sửa bên phải
                        </span>
                      </div>
                      {activeSlide.questions.map((q) => (
                        <div
                          key={q.id}
                          className="rounded-xl border border-slate-200 bg-white p-3.5 hover:border-[#0284C7] space-y-1.5"
                        >
                          <div className="text-sm font-medium text-slate-900">
                            <span className="font-bold text-[#0284C7] mr-1.5">Q{q.number}.</span>
                            <RenderFormattedText text={q.prompt} />
                          </div>
                          {q.options && q.options.length > 0 && (
                            <div className="grid grid-cols-2 gap-1.5 text-sm text-slate-700 pl-3">
                              {q.options.map((o) => (
                                <div key={o.id}>
                                  <span className="font-semibold">{o.label}. </span>
                                  <RenderFormattedText text={o.text} />
                                  {o.ipa && <span className="font-mono-tabular text-xs text-slate-500 ml-1">{o.ipa}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="text-xs text-emerald-700 font-medium pt-1">
                            Đáp án: {q.correctAnswer || '(Chưa nhập)'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Vocab Cards Preview */}
                  {activeSlide.vocabItems && activeSlide.vocabItems.length > 0 && (
                    <div
                      onClick={() => setInspectorTab('vocab')}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 cursor-pointer"
                    >
                      {activeSlide.vocabItems.map((v) => (
                        <div
                          key={v.id}
                          className="rounded-xl border border-slate-200 p-3 hover:border-[#0284C7]"
                        >
                          <div className="font-semibold">{v.word}</div>
                          <div className="font-mono-tabular text-xs text-[#0284C7]">{v.ipa}</div>
                          <div className="text-xs text-slate-600 mt-1">{v.meaningVi}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Speaking / Writing Summary Box */}
                  {activeSlide.speakingTask && (
                    <div
                      onClick={() => setInspectorTab('speaking')}
                      className="rounded-xl border border-slate-200 p-4 bg-slate-50/70 cursor-pointer hover:border-[#0284C7]"
                    >
                      <div className="text-xs font-semibold text-[#0F4C81] mb-1">Nhiệm vụ Speaking (6 tiêu chí Rubric)</div>
                      <p className="text-sm text-slate-800">{activeSlide.speakingTask.prompt}</p>
                    </div>
                  )}
                  {activeSlide.writingTask && (
                    <div
                      onClick={() => setInspectorTab('writing')}
                      className="rounded-xl border border-slate-200 p-4 bg-slate-50/70 cursor-pointer hover:border-[#0284C7]"
                    >
                      <div className="text-xs font-semibold text-[#0F4C81] mb-1">
                        Đề bài Writing ({activeSlide.writingTask.minWords}–{activeSlide.writingTask.maxWords} từ)
                      </div>
                      <p className="text-sm text-slate-800">{activeSlide.writingTask.prompt}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* RIGHT PANE: Context-Sensitive Object Inspector */}
        <aside className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-slate-200 bg-white flex flex-col max-h-[calc(100vh-190px)]">
          {/* Inspector Object Selector Tabs */}
          <div className="p-2 border-b border-slate-200 flex flex-wrap gap-1 bg-slate-50">
            {(
              [
                {id: 'slide', label: 'Slide', icon: Layers},
                {id: 'questions', label: 'Câu hỏi', icon: PenLine},
                {id: 'passage', label: 'Bài đọc', icon: Underline},
                {id: 'audio', label: 'Âm thanh', icon: Volume2},
                {id: 'vocab', label: 'Từ vựng', icon: Plus},
                {id: 'speaking', label: 'Speaking', icon: Mic},
                {id: 'writing', label: 'Writing', icon: PenLine},
                {id: 'media', label: 'Ảnh/Video', icon: ImageIcon},
              ] as Array<{id: InspectorTab; label: string; icon: React.ComponentType<{className?: string}>}>
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setInspectorTab(tab.id)}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    inspectorTab === tab.id
                      ? 'bg-white text-[#0F4C81] shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Context-Sensitive Inspector Body */}
          <div className="flex-1 overflow-y-auto studio-scroll p-4 space-y-4 text-sm">
            {inspectorTab === 'slide' && activeSlide && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Kỹ năng slide</label>
                  <select
                    value={activeSlide.skill}
                    onChange={(e) => updateCurrentSlide({skill: e.target.value as SkillCategory})}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {(Object.keys(SKILL_LABELS) as SkillCategory[]).map((sk) => (
                      <option key={sk} value={sk}>
                        {SKILL_LABELS[sk]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Dạng hoạt động</label>
                  <select
                    value={activeSlide.activityType}
                    onChange={(e) => updateCurrentSlide({activityType: e.target.value as ActivityType})}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map((at) => (
                      <option key={at} value={at}>
                        {ACTIVITY_LABELS[at]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Giao diện trình chiếu mặc định</label>
                  <select
                    value={draft.themeId}
                    onChange={(e) =>
                      commitChange((p) => ({...p, themeId: e.target.value as SlideThemeId}))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="light_classroom">Sáng lớp học</option>
                    <option value="projector_contrast">Máy chiếu tương phản cao</option>
                    <option value="warm_paper">Giấy ấm dịu mắt</option>
                    <option value="dark_theater">Trình chiếu tối</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Hiệu ứng chuyển slide</label>
                  <select
                    value={activeSlide.transition || 'fade'}
                    onChange={(e) =>
                      updateCurrentSlide({transition: e.target.value as Slide['transition']})
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="none">Không hiệu ứng</option>
                    <option value="fade">Mờ dần (Fade)</option>
                    <option value="slide">Trượt ngang (Slide)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Các ý chính (mỗi dòng 1 ý — dùng **chữ** để in đậm)
                  </label>
                  <textarea
                    rows={4}
                    value={(activeSlide.bullets || []).join('\n')}
                    onChange={(e) =>
                      updateCurrentSlide({
                        bullets: e.target.value
                          .split('\n')
                          .map((l) => l.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                    placeholder="Nhập các gạch đầu dòng trình chiếu..."
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Ghi chú giáo viên (Teacher Notes)
                  </label>
                  <textarea
                    rows={3}
                    value={activeSlide.teacherNotes || ''}
                    onChange={(e) => updateCurrentSlide({teacherNotes: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                    placeholder="Gợi ý dẫn dắt, phân bổ thời gian trên lớp..."
                  />
                </div>
              </div>
            )}

            {inspectorTab === 'questions' && activeSlide && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">Chỉnh sửa câu hỏi</span>
                  <button
                    type="button"
                    onClick={() => addQuestionToSlide('mcq')}
                    className="rounded-lg bg-[#0F4C81] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#0B3A63]"
                  >
                    + Thêm câu
                  </button>
                </div>

                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2">
                  Mẹo: Để giữ gạch chân phát âm/lỗi sai, bọc chữ bằng thẻ <code className="font-mono-tabular">&lt;u&gt;...&lt;/u&gt;</code> (ví dụ: <code className="font-mono-tabular">cook&lt;u&gt;ed&lt;/u&gt;</code>).
                </p>

                {(activeSlide.questions || []).map((q, qIdx) => (
                  <div key={q.id} className="rounded-xl border border-slate-200 p-3 space-y-2.5 bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#0F4C81] text-xs">Câu #{q.number}</span>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={q.type}
                          onChange={(e) =>
                            updateQuestion(qIdx, {type: e.target.value as QuestionType})
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                        >
                          <option value="mcq">Trắc nghiệm (MCQ)</option>
                          <option value="pronunciation_underlined">Phát âm gạch chân</option>
                          <option value="true_false">True / False</option>
                          <option value="gap_fill">Điền từ (Gap Fill)</option>
                          <option value="error_correction">Tìm lỗi sai</option>
                          <option value="transformation">Viết lại câu</option>
                          <option value="matching">Nối cặp</option>
                          <option value="ordering">Sắp xếp trình tự</option>
                          <option value="word_order">Sắp xếp từ</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeQuestion(qIdx)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                          title="Xóa câu hỏi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={2}
                      value={q.prompt}
                      onChange={(e) => updateQuestion(qIdx, {prompt: e.target.value})}
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs"
                      placeholder="Nội dung câu hỏi..."
                    />

                    {q.options && q.options.length > 0 && (
                      <div className="space-y-1.5">
                        {q.options.map((opt, oIdx) => (
                          <div key={opt.id} className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs w-5">{opt.label}.</span>
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => {
                                const opts = structuredClone(q.options || []);
                                opts[oIdx].text = e.target.value;
                                updateQuestion(qIdx, {options: opts});
                              }}
                              className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                            />
                            <input
                              type="text"
                              value={opt.ipa || ''}
                              onChange={(e) => {
                                const opts = structuredClone(q.options || []);
                                opts[oIdx].ipa = e.target.value;
                                updateQuestion(qIdx, {options: opts});
                              }}
                              placeholder="/IPA/"
                              className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono-tabular"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-2">
                      <input
                        type="text"
                        value={q.correctAnswer}
                        onChange={(e) => updateQuestion(qIdx, {correctAnswer: e.target.value})}
                        placeholder="Đáp án đúng (VD: A, True, hoặc cụm từ)..."
                        className="w-full rounded border border-emerald-300 bg-white px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={q.explanation || ''}
                        onChange={(e) => updateQuestion(qIdx, {explanation: e.target.value})}
                        placeholder="Lời giải thích ngắn..."
                        className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {inspectorTab === 'passage' && activeSlide && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">Đoạn văn Reading</span>
                  {activeSlide.passage && (
                    <button
                      type="button"
                      onClick={() => updateCurrentSlide({passage: undefined})}
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Gỡ bài đọc
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={activeSlide.passage?.title || ''}
                  onChange={(e) =>
                    updateCurrentSlide({
                      passage: {
                        title: e.target.value,
                        paragraphs: activeSlide.passage?.paragraphs || [''],
                        sourceNote: activeSlide.passage?.sourceNote,
                      },
                    })
                  }
                  placeholder="Tiêu đề bài đọc..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <textarea
                  rows={10}
                  value={(activeSlide.passage?.paragraphs || []).join('\n\n')}
                  onChange={(e) =>
                    updateCurrentSlide({
                      passage: {
                        title: activeSlide.passage?.title || 'Reading Passage',
                        paragraphs: e.target.value
                          .split(/\n{2,}/)
                          .map((p) => p.trim())
                          .filter(Boolean),
                        sourceNote: activeSlide.passage?.sourceNote,
                      },
                    })
                  }
                  placeholder="Dán nguyên văn bài đọc (mỗi đoạn cách nhau 1 dòng trống)..."
                  className="w-full rounded-lg border border-slate-300 p-3 text-sm leading-relaxed"
                />
              </div>
            )}

            {inspectorTab === 'audio' && activeSlide && (
              <div className="space-y-3.5">
                <span className="font-semibold text-slate-900 block">
                  Nguồn âm thanh &amp; Transcript (Listening)
                </span>

                <div className="grid grid-cols-1 gap-1.5">
                  {(
                    [
                      {id: 'builtin', label: '1. Dùng bài nghe có sẵn'},
                      {id: 'uploaded', label: '2. Tải âm thanh của tôi (MP3/WAV)'},
                      {id: 'tts', label: '3. Tạo giọng đọc từ transcript'},
                    ] as const
                  ).map((opt) => {
                    const currentMode =
                      activeSlide.audio?.sourceMode ||
                      (activeSlide.audio?.dataUrl ? 'uploaded' : 'builtin');
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          const hadTs = Boolean(activeSlide.audio?.timestamps?.length);
                          updateCurrentSlide({
                            audio: {
                              ...(activeSlide.audio || {}),
                              sourceMode: opt.id,
                              ...(opt.id === 'builtin'
                                ? {dataUrl: undefined, fileName: undefined, mimeType: undefined, isSynthesized: true}
                                : {}),
                              timestampsNeedReview: hadTs ? true : activeSlide.audio?.timestampsNeedReview,
                            },
                          });
                        }}
                        className={`rounded-lg border px-3 py-2 text-left text-xs font-medium ${
                          currentMode === opt.id
                            ? 'border-[#0284C7] bg-sky-50 text-[#0F4C81] font-semibold'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Mục tiêu kỹ năng nghe
                  </label>
                  <input
                    type="text"
                    value={activeSlide.audio?.skillObjective || ''}
                    onChange={(e) =>
                      updateCurrentSlide({
                        audio: {
                          ...(activeSlide.audio || {}),
                          skillObjective: e.target.value,
                        },
                      })
                    }
                    placeholder="VD: Nghe hiểu ý chính & thông tin chi tiết..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>

                <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 p-3.5 text-xs font-medium text-slate-700 hover:border-[#0284C7] cursor-pointer">
                  <Volume2 className="w-4 h-4 text-[#0284C7]" />
                  {activeSlide.audio?.fileName || 'Tải hoặc thay tệp MP3 / WAV từ máy tính'}
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const hadTs = Boolean(activeSlide.audio?.timestamps?.length);
                      const reader = new FileReader();
                      reader.onload = () => {
                        updateCurrentSlide({
                          audio: {
                            ...(activeSlide.audio || {}),
                            sourceMode: 'uploaded',
                            dataUrl: String(reader.result || ''),
                            fileName: file.name,
                            mimeType: file.type,
                            isSynthesized: false,
                            timestampsNeedReview: hadTs,
                          },
                        });
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="hidden"
                  />
                </label>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Transcript bài nghe (dùng cho giọng đọc tổng hợp hoặc đối chiếu)
                  </label>
                  <textarea
                    rows={8}
                    value={activeSlide.audio?.transcript || ''}
                    onChange={(e) =>
                      updateCurrentSlide({
                        audio: {
                          ...(activeSlide.audio || {}),
                          transcript: e.target.value,
                        },
                      })
                    }
                    placeholder="Nhập hoặc dán transcript Tiếng Anh..."
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                  />
                </div>
              </div>
            )}

            {inspectorTab === 'vocab' && activeSlide && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">Thẻ từ vựng &amp; IPA</span>
                  <button
                    type="button"
                    onClick={addVocabCard}
                    className="rounded-lg bg-[#0F4C81] px-2.5 py-1 text-xs font-medium text-white"
                  >
                    + Thêm từ
                  </button>
                </div>
                {(activeSlide.vocabItems || []).map((v, vIdx) => (
                  <div key={v.id} className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50/50">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={v.word}
                        onChange={(e) => {
                          const list = structuredClone(activeSlide.vocabItems || []);
                          list[vIdx].word = e.target.value;
                          updateCurrentSlide({vocabItems: list});
                        }}
                        placeholder="Từ tiếng Anh"
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold"
                      />
                      <input
                        type="text"
                        value={v.ipa}
                        onChange={(e) => {
                          const list = structuredClone(activeSlide.vocabItems || []);
                          list[vIdx].ipa = e.target.value;
                          updateCurrentSlide({vocabItems: list});
                        }}
                        placeholder="/IPA/"
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono-tabular"
                      />
                    </div>
                    <input
                      type="text"
                      value={v.meaningVi}
                      onChange={(e) => {
                        const list = structuredClone(activeSlide.vocabItems || []);
                        list[vIdx].meaningVi = e.target.value;
                        updateCurrentSlide({vocabItems: list});
                      }}
                      placeholder="Nghĩa tiếng Việt"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                    <input
                      type="text"
                      value={v.example}
                      onChange={(e) => {
                        const list = structuredClone(activeSlide.vocabItems || []);
                        list[vIdx].example = e.target.value;
                        updateCurrentSlide({vocabItems: list});
                      }}
                      placeholder="Câu ví dụ"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                ))}
              </div>
            )}

            {inspectorTab === 'speaking' && activeSlide && (
              <div className="space-y-3">
                <span className="font-semibold text-slate-900 block">Cấu hình hoạt động Speaking</span>
                <textarea
                  rows={4}
                  value={activeSlide.speakingTask?.prompt || ''}
                  onChange={(e) =>
                    updateCurrentSlide({
                      speakingTask: {
                        ...(activeSlide.speakingTask || {rubricCriteria: DEFAULT_SPEAKING_RUBRIC}),
                        prompt: e.target.value,
                      },
                    })
                  }
                  placeholder="Nhập đề bài Speaking / Tình huống giao tiếp..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                />
                <textarea
                  rows={4}
                  value={(activeSlide.speakingTask?.cues || []).join('\n')}
                  onChange={(e) =>
                    updateCurrentSlide({
                      speakingTask: {
                        ...(activeSlide.speakingTask || {
                          prompt: '',
                          rubricCriteria: DEFAULT_SPEAKING_RUBRIC,
                        }),
                        cues: e.target.value.split('\n').filter(Boolean),
                      },
                    })
                  }
                  placeholder="Các câu hỏi gợi ý (mỗi dòng 1 ý)..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                />
              </div>
            )}

            {inspectorTab === 'writing' && activeSlide && (
              <div className="space-y-3">
                <span className="font-semibold text-slate-900 block">Cấu hình hoạt động Writing</span>
                <textarea
                  rows={4}
                  value={activeSlide.writingTask?.prompt || ''}
                  onChange={(e) =>
                    updateCurrentSlide({
                      writingTask: {
                        ...(activeSlide.writingTask || {
                          minWords: 120,
                          maxWords: 160,
                          outlineHints: [],
                          usefulExpressions: [],
                          rubricCriteria: DEFAULT_WRITING_RUBRIC,
                        }),
                        prompt: e.target.value,
                      },
                    })
                  }
                  placeholder="Nhập đề bài Writing..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500">Số từ tối thiểu</label>
                    <input
                      type="number"
                      value={activeSlide.writingTask?.minWords ?? 120}
                      onChange={(e) =>
                        updateCurrentSlide({
                          writingTask: {
                            ...(activeSlide.writingTask || {
                              prompt: '',
                              minWords: 120,
                              maxWords: 160,
                              outlineHints: [],
                              usefulExpressions: [],
                              rubricCriteria: DEFAULT_WRITING_RUBRIC,
                            }),
                            minWords: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Số từ tối đa</label>
                    <input
                      type="number"
                      value={activeSlide.writingTask?.maxWords ?? 160}
                      onChange={(e) =>
                        updateCurrentSlide({
                          writingTask: {
                            ...(activeSlide.writingTask || {
                              prompt: '',
                              minWords: 120,
                              maxWords: 160,
                              outlineHints: [],
                              usefulExpressions: [],
                              rubricCriteria: DEFAULT_WRITING_RUBRIC,
                            }),
                            maxWords: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <textarea
                  rows={4}
                  value={(activeSlide.writingTask?.outlineHints || []).join('\n')}
                  onChange={(e) =>
                    updateCurrentSlide({
                      writingTask: {
                        ...(activeSlide.writingTask || {
                          prompt: '',
                          minWords: 120,
                          maxWords: 160,
                          outlineHints: [],
                          usefulExpressions: [],
                          rubricCriteria: DEFAULT_WRITING_RUBRIC,
                        }),
                        outlineHints: e.target.value.split('\n').filter(Boolean),
                      },
                    })
                  }
                  placeholder="Gợi ý dàn ý (mỗi dòng 1 ý)..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                />
              </div>
            )}

            {inspectorTab === 'media' && activeSlide && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="font-semibold text-slate-900 block">Hình ảnh minh họa</span>
                  <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 p-4 text-xs font-medium text-slate-700 hover:border-[#0284C7] cursor-pointer">
                    <ImageIcon className="w-4 h-4 text-[#0284C7]" />
                    Tải ảnh từ máy tính (JPG, PNG, WebP)
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadSlideImage}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="text"
                    value={activeSlide.imageCaption || ''}
                    onChange={(e) => updateCurrentSlide({imageCaption: e.target.value})}
                    placeholder="Chú thích hình ảnh..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                  {activeSlide.imageUrl && (
                    <button
                      type="button"
                      onClick={() => updateCurrentSlide({imageUrl: undefined, imageCaption: undefined})}
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Xóa hình ảnh khỏi slide
                    </button>
                  )}
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-200">
                  <span className="font-semibold text-slate-900 block">Video cục bộ (MP4 / WebM)</span>
                  <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 p-4 text-xs font-medium text-slate-700 hover:border-[#0284C7] cursor-pointer">
                    <Video className="w-4 h-4 text-[#0284C7]" />
                    Chèn tệp video từ máy tính
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleUploadSlideVideo}
                      className="hidden"
                    />
                  </label>
                  {activeSlide.videoUrl && (
                    <button
                      type="button"
                      onClick={() => updateCurrentSlide({videoUrl: undefined})}
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Gỡ video
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
