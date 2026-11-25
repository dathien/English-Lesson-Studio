import React, {useRef, useState} from 'react';
import {
  BookMarked,
  Check,
  FileUp,
  Headphones,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import {COGNITIVE_LABELS, type CognitiveLevel} from '../../types/lesson';
import type {
  BankQuestionRecord,
  Exam,
  ExamDossier,
  ExamQuestionItem,
  QuestionGroup,
} from '../../types/exam';
import {EXAM_SKILL_LABELS, VERIFICATION_STATUS_LABELS} from '../../types/exam';
import {RenderFormattedText as FormattedText} from '../../utils/richText';
import {ListeningWidget} from '../interactive/ListeningWidget';
import {processUploadedFiles} from '../../services/documentParser';
import {generateExamItemsAI} from '../../services/aiService';

interface ExamComposerStepProps {
  dossier: ExamDossier;
  questionBank: BankQuestionRecord[];
  aiAvailable: boolean;
  onUpdateExam: (nextExam: Exam) => void;
  onRegenerateWholeExam: () => void;
  onRegenerateSection: (matrixRowId: string) => void;
  onRegenerateQuestion: (questionId: string) => void;
  onNextStep: () => void;
}

export const ExamComposerStep: React.FC<ExamComposerStepProps> = ({
  dossier,
  questionBank,
  aiAvailable,
  onUpdateExam,
  onRegenerateWholeExam,
  onRegenerateSection,
  onRegenerateQuestion,
  onNextStep,
}) => {
  const {exam, scope, blueprint} = dossier;
  const [editingQId, setEditingQId] = useState<string | null>(null);
  const [bankPickerGroupId, setBankPickerGroupId] = useState<string | null>(null);
  const [bankQuery, setBankQuery] = useState('');
  const [bankSkillFilter, setBankSkillFilter] = useState<string>('all');
  const [busyMsg, setBusyMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const sortedGroups = [...exam.groups].sort((a, b) => a.order - b.order);

  const updateQuestion = (qId: string, patch: Partial<ExamQuestionItem>) => {
    const nextQs = exam.questions.map((q) => (q.id === qId ? {...q, ...patch} : q));
    onUpdateExam({...exam, questions: nextQs});
  };

  const updateGroup = (gId: string, patch: Partial<QuestionGroup>) => {
    const nextGroups = exam.groups.map((g) => (g.id === gId ? {...g, ...patch} : g));
    onUpdateExam({...exam, groups: nextGroups});
  };

  const deleteQuestion = (qId: string) => {
    const remaining = exam.questions
      .filter((q) => q.id !== qId)
      .sort((a, b) => a.number - b.number)
      .map((q, idx) => ({...q, number: idx + 1}));
    onUpdateExam({...exam, questions: remaining});
  };

  const addManualQuestionToGroup = (group: QuestionGroup) => {
    const nextNum = exam.questions.length + 1;
    const isTF = group.skill === 'listening' && group.title.toLowerCase().includes('true');
    const isEssay = group.skill === 'writing' && group.title.toLowerCase().includes('paragraph');
    const fresh: ExamQuestionItem = {
      id: `manual-q-${Date.now()}-${nextNum}`,
      number: nextNum,
      grade: scope.grade,
      textbookId: scope.textbookId,
      unitId: scope.selectedUnitIds[0] || `gs${scope.grade}-u1`,
      topic: `Tiếng Anh lớp ${scope.grade}`,
      skill: group.skill,
      cognitiveLevel: 'comprehension',
      questionType: isEssay ? 'essay' : isTF ? 'true_false' : 'mcq',
      format: isEssay ? 'essay' : isTF ? 'true_false' : 'mcq',
      prompt: 'Nhập nội dung câu hỏi mới tại đây...',
      options: isEssay
        ? undefined
        : isTF
          ? [
              {id: 't', label: 'T', text: 'True'},
              {id: 'f', label: 'F', text: 'False'},
            ]
          : [
              {id: 'a', label: 'A', text: 'Option A'},
              {id: 'b', label: 'B', text: 'Option B'},
              {id: 'c', label: 'C', text: 'Option C'},
              {id: 'd', label: 'D', text: 'Option D'},
            ],
      correctAnswer: isEssay ? 'Chấm theo Rubric.' : isTF ? 'T' : 'A',
      explanation: 'Nhập lời giải thích ngắn gọn bằng tiếng Việt.',
      points: 0.25,
      sourceLabel: 'Giáo viên tự soạn',
      groupId: group.id,
      matrixRowId: group.matrixRowId,
      sectionOrder: group.order,
      verificationStatus: 'teacher_authored',
      tags: [`Lớp ${scope.grade}`, group.skill],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      locked: true,
    };
    onUpdateExam({...exam, questions: [...exam.questions, fresh]});
    setEditingQId(fresh.id);
  };

  const handleInsertFromBank = (record: BankQuestionRecord, targetGroupId: string) => {
    const group = exam.groups.find((g) => g.id === targetGroupId);
    if (!group) return;
    const nextNum = exam.questions.length + 1;
    const inserted: ExamQuestionItem = {
      ...record,
      id: `frombank-${record.id}-${Date.now()}`,
      number: nextNum,
      groupId: group.id,
      matrixRowId: group.matrixRowId,
      sectionOrder: group.order,
      locked: true,
    };
    onUpdateExam({...exam, questions: [...exam.questions, inserted]});
  };

  const handleUploadAudioForGroup = (groupId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const grp = exam.groups.find((g) => g.id === groupId);
      if (!grp) return;
      updateGroup(groupId, {
        audio: {
          sourceMode: 'uploaded',
          transcript: grp.audio?.transcript || '',
          voiceAccent: grp.audio?.voiceAccent || 'en-GB',
          isSynthesized: false,
          dataUrl,
          fileName: file.name,
          mimeType: file.type || 'audio/mpeg',
          showTranscriptInKey: true,
        },
      });
    };
    reader.readAsDataURL(file);
  };

  const handleImportDocumentIntoExam = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    setBusyMsg('Đang trích xuất câu hỏi & bài đọc từ tài liệu tải lên...');
    setErrorMsg(null);
    try {
      const draft = await processUploadedFiles(files, scope.grade, undefined, aiAvailable);

      const importedGroupId = `grp-imported-${Date.now()}`;
      const newGroup: QuestionGroup = {
        id: importedGroupId,
        order: exam.groups.length + 1,
        title: `PHẦN NHẬP TỪ TÀI LIỆU — ${draft.title}`,
        skill:
          draft.skill === 'listening' ||
          draft.skill === 'reading' ||
          draft.skill === 'writing' ||
          draft.skill === 'speaking'
            ? draft.skill
            : 'language',
        groupType: draft.passages.length > 0 ? 'reading_passage' : 'standalone_section',
        instruction: draft.instructions || 'Answer the imported questions below.',
        stimulusTitle: draft.passages[0]?.title,
        stimulusParagraphs: draft.passages[0]?.paragraphs,
        audio: draft.transcript
          ? {
              sourceMode: draft.attachedAudioDataUrl ? 'uploaded' : 'builtin',
              transcript: draft.transcript,
              voiceAccent: 'en-GB',
              isSynthesized: !draft.attachedAudioDataUrl,
              dataUrl: draft.attachedAudioDataUrl,
              fileName: draft.attachedAudioName,
              showTranscriptInKey: true,
            }
          : undefined,
        protectOrder: draft.passages.length > 0 || Boolean(draft.transcript),
      };

      let cursor = exam.questions.length + 1;
      const importedQs: ExamQuestionItem[] = draft.questions.map((dq, idx) => ({
        id: `imp-q-${Date.now()}-${idx}`,
        number: cursor++,
        grade: scope.grade,
        textbookId: scope.textbookId,
        unitId: scope.selectedUnitIds[0] || `gs${scope.grade}-u1`,
        topic: draft.title,
        skill: newGroup.skill,
        cognitiveLevel: dq.cognitiveLevel || 'comprehension',
        questionType: dq.type,
        format:
          dq.type === 'true_false'
            ? 'true_false'
            : dq.type === 'transformation'
              ? 'transformation'
              : dq.type === 'gap_fill'
                ? 'gap_fill'
                : 'mcq',
        prompt: dq.prompt,
        options: dq.options,
        correctAnswer: dq.correctAnswer || (dq.options?.[0]?.label ?? ''),
        acceptedAnswers: dq.acceptedAnswers,
        explanation: dq.explanation || 'Nhập từ tài liệu giáo viên tải lên.',
        points: 0.25,
        sourceLabel: `Tài liệu tải lên: ${files.map((f) => f.name).join(', ')}`,
        groupId: importedGroupId,
        sectionOrder: newGroup.order,
        verificationStatus: 'reference_sourced',
        tags: [`Lớp ${scope.grade}`, 'Nhập tài liệu'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        locked: true,
      }));

      if (importedQs.length === 0) {
        setErrorMsg('Không tìm thấy câu hỏi rõ ràng trong tệp tải lên. Giáo viên có thể dán hoặc thêm câu trực tiếp.');
      } else {
        onUpdateExam({
          ...exam,
          groups: [...exam.groups, newGroup],
          questions: [...exam.questions, ...importedQs],
        });
        setBusyMsg(`Đã nhập thành công ${importedQs.length} câu hỏi từ "${files[0].name}" vào đề!`);
        setTimeout(() => setBusyMsg(null), 4000);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi khi đọc tài liệu.');
      setBusyMsg(null);
    }
    e.target.value = '';
  };

  const handleAIGenerateForGroup = async (group: QuestionGroup) => {
    const row = blueprint.rows.find((r) => r.id === group.matrixRowId);
    setBusyMsg(`Đang nhờ AI biên soạn bản nháp câu hỏi cho "${group.title}"...`);
    setErrorMsg(null);
    const res = await generateExamItemsAI({
      grade: scope.grade,
      topic: row?.topic || `Tiếng Anh lớp ${scope.grade}`,
      skill: group.skill,
      format: row?.questionFormat || 'mcq',
      cognitiveLevel: 'comprehension',
      learningOutcome: row?.learningOutcome || 'Bám sát Chương trình GDPT 2018.',
      count: Math.min(4, Math.max(2, row?.questionCount || 3)),
    });
    setBusyMsg(null);
    if (!res.ok || !res.data?.questions?.length) {
      setErrorMsg(res.error || 'Không tạo được câu hỏi AI lúc này. Bạn vẫn có thể chọn từ Ngân hàng câu hỏi hoàn toàn ngoại tuyến.');
      return;
    }

    let cursor = exam.questions.length + 1;
    const generated: ExamQuestionItem[] = res.data.questions.map((gq, idx) => ({
      id: `ai-exam-q-${Date.now()}-${idx}`,
      number: cursor++,
      grade: scope.grade,
      textbookId: scope.textbookId,
      unitId: scope.selectedUnitIds[0] || `gs${scope.grade}-u1`,
      topic: row?.topic || `Tiếng Anh lớp ${scope.grade}`,
      skill: group.skill,
      cognitiveLevel: 'comprehension',
      questionType: 'mcq',
      format: row?.questionFormat || 'mcq',
      prompt: gq.prompt,
      options: gq.options?.map((o, oi) => ({
        id: `ai-opt-${oi}`,
        label: o.label || String.fromCharCode(65 + oi),
        text: o.text,
      })),
      correctAnswer: gq.correctAnswer,
      acceptedAnswers: gq.acceptedAnswers,
      explanation: gq.explanation,
      points: 0.25,
      sourceLabel: 'AI biên soạn theo đặc tả · Cần giáo viên duyệt',
      groupId: group.id,
      matrixRowId: group.matrixRowId,
      sectionOrder: group.order,
      verificationStatus: 'ai_unverified',
      tags: [`Lớp ${scope.grade}`, 'AI gợi ý'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      locked: false,
    }));

    const nextGroups = exam.groups.map((g) => {
      if (g.id !== group.id) return g;
      if (res.data?.stimulusText && g.skill === 'reading' && !g.stimulusParagraphs?.length) {
        return {
          ...g,
          stimulusTitle: res.data.stimulusTitle || g.stimulusTitle,
          stimulusParagraphs: res.data.stimulusText.split(/\n+/).filter(Boolean),
        };
      }
      return g;
    });

    onUpdateExam({
      ...exam,
      groups: nextGroups,
      questions: [...exam.questions, ...generated],
    });
  };

  const filteredBank = questionBank
    .filter((b) => {
      if (bankSkillFilter !== 'all' && b.skill !== bankSkillFilter) return false;
      if (!bankQuery.trim()) return true;
      const q = bankQuery.toLowerCase();
      return (
        b.prompt.toLowerCase().includes(q) ||
        b.topic.toLowerCase().includes(q) ||
        b.sourceLabel.toLowerCase().includes(q)
      );
    })
    .slice(0, 40);

  const lockedCount = exam.questions.filter((q) => q.locked).length;

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="rounded-[18px] border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-extrabold text-[#0F172A]">
              Bước 4: Soạn thảo &amp; biên tập đề kiểm tra ({exam.questions.length} câu)
            </h2>
            <p className="text-[15px] text-[#475569] mt-0.5">
              Kết hợp linh hoạt 4 cách trong cùng một đề: Chọn từ Ngân hàng câu hỏi, Tự soạn trực tiếp, Nhập từ Word/PDF/Ảnh và Tạo câu bằng AI (tùy chọn). Các câu đã khóa ({lockedCount} câu) luôn được bảo vệ khi sinh lại đề.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-[#0F172A] hover:border-[#2563EB] hover:text-[#2563EB]"
            >
              <FileUp className="w-4 h-4 text-[#2563EB]" />
              Nhập câu từ Word/PDF/Ảnh
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".docx,.pdf,image/*"
              multiple
              className="hidden"
              onChange={handleImportDocumentIntoExam}
            />
            <button
              type="button"
              onClick={onRegenerateWholeExam}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-bold text-[#2563EB] hover:bg-blue-100"
            >
              <RefreshCw className="w-4 h-4" />
              Sinh lại câu chưa khóa
            </button>
            <button
              type="button"
              onClick={onNextStep}
              className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-[#1E40AF]"
            >
              Sang Đáp án &amp; Rubric →
            </button>
          </div>
        </div>

        {busyMsg && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm font-medium text-blue-900">
            {busyMsg}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm font-medium text-amber-900">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Sections & Questions */}
      <div className="space-y-5">
        {sortedGroups.map((group) => {
          const groupQs = exam.questions
            .filter((q) => q.groupId === group.id)
            .sort((a, b) => a.number - b.number);

          return (
            <section
              key={group.id}
              className="rounded-[18px] border border-slate-200 bg-white overflow-hidden shadow-xs"
            >
              {/* Section Header */}
              <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[16px] text-[#0F172A]">{group.title}</span>
                    <span className="text-xs font-semibold text-[#2563EB] bg-blue-50 border border-blue-200 rounded-lg px-2 py-0.5">
                      {groupQs.length} câu
                    </span>
                    {group.protectOrder && (
                      <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5">
                        Nhóm bảo vệ thứ tự khi trộn mã đề
                      </span>
                    )}
                  </div>
                  <p className="text-sm italic text-[#475569] mt-0.5">{group.instruction}</p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setBankPickerGroupId(group.id);
                      setBankSkillFilter(group.skill);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-[#0F172A] hover:border-[#2563EB] hover:text-[#2563EB]"
                  >
                    <BookMarked className="w-3.5 h-3.5 text-[#2563EB]" />
                    Chọn từ Ngân hàng
                  </button>
                  <button
                    type="button"
                    onClick={() => addManualQuestionToGroup(group)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-[#0F172A] hover:border-[#2563EB] hover:text-[#2563EB]"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#2563EB]" />
                    Thêm câu thủ công
                  </button>
                  {group.matrixRowId && (
                    <button
                      type="button"
                      onClick={() => onRegenerateSection(group.matrixRowId!)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Sinh lại phần này
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAIGenerateForGroup(group)}
                    className="inline-flex items-center gap-1 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-900 hover:bg-cyan-100"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI gợi ý câu (tùy chọn)
                  </button>
                </div>
              </div>

              {/* Listening Audio Block (Playable immediately + Upload MP3/WAV + Transcript editor) */}
              {group.skill === 'listening' && (
                <div className="p-5 border-b border-slate-200 bg-blue-50/40 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 font-bold text-[15px] text-[#1E40AF]">
                      <Headphones className="w-5 h-5" />
                      Nguồn âm thanh &amp; Transcript phần Listening (Bắt buộc trước khi xuất đề)
                    </div>
                    <label className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-bold text-[#2563EB] hover:bg-blue-50 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      Tải tệp MP3/WAV riêng
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadAudioForGroup(group.id, f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  {group.audio && (
                    <ListeningWidget
                      grade={scope.grade}
                      lessonTitle={group.title}
                      audioConfig={{
                        sourceMode: group.audio.sourceMode,
                        transcript: group.audio.transcript,
                        voiceAccent: group.audio.voiceAccent,
                        isSynthesized: group.audio.isSynthesized,
                        dataUrl: group.audio.dataUrl,
                        fileName: group.audio.fileName,
                        mimeType: group.audio.mimeType,
                        showTranscriptDefault: true,
                      }}
                      onUpdateAudio={(nextCfg) =>
                        updateGroup(group.id, {
                          audio: {
                            sourceMode: nextCfg.sourceMode || 'builtin',
                            transcript: nextCfg.transcript || '',
                            voiceAccent: nextCfg.voiceAccent || 'en-GB',
                            isSynthesized: nextCfg.isSynthesized ?? nextCfg.sourceMode !== 'uploaded',
                            dataUrl: nextCfg.dataUrl,
                            fileName: nextCfg.fileName,
                            mimeType: nextCfg.mimeType,
                            showTranscriptInKey: group.audio?.showTranscriptInKey ?? true,
                          },
                        })
                      }
                    />
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Chỉnh sửa Transcript bài nghe (giọng tổng hợp &amp; TTS đọc trực tiếp theo nội dung này):
                    </label>
                    <textarea
                      rows={3}
                      value={group.audio?.transcript || ''}
                      onChange={(e) =>
                        updateGroup(group.id, {
                          audio: {
                            sourceMode: group.audio?.sourceMode || 'builtin',
                            transcript: e.target.value,
                            voiceAccent: group.audio?.voiceAccent || 'en-GB',
                            isSynthesized: group.audio?.sourceMode !== 'uploaded',
                            dataUrl: group.audio?.dataUrl,
                            fileName: group.audio?.fileName,
                            showTranscriptInKey: true,
                          },
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-relaxed"
                      placeholder="Nhập transcript bài nghe tiếng Anh..."
                    />
                  </div>
                </div>
              )}

              {/* Reading / Notice / Leaflet Passage Stimulus */}
              {group.stimulusParagraphs && group.stimulusParagraphs.length > 0 && (
                <div className="p-5 border-b border-slate-200 bg-slate-50/70 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={group.stimulusTitle || ''}
                      onChange={(e) => updateGroup(group.id, {stimulusTitle: e.target.value})}
                      className="font-bold text-[15px] text-[#0F172A] bg-transparent border-b border-transparent focus:border-[#2563EB] focus:outline-none w-full"
                      placeholder="Tiêu đề ngữ liệu / bài đọc..."
                    />
                  </div>
                  <textarea
                    rows={Math.min(10, Math.max(4, group.stimulusParagraphs.length * 3))}
                    value={group.stimulusParagraphs.join('\n\n')}
                    onChange={(e) =>
                      updateGroup(group.id, {
                        stimulusParagraphs: e.target.value
                          .split(/\n{2,}/)
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-[15px] leading-relaxed text-[#0F172A]"
                  />
                </div>
              )}

              {/* Questions List */}
              <div className="divide-y divide-slate-200">
                {groupQs.map((q) => {
                  const isEditing = editingQId === q.id;
                  const statusMeta = VERIFICATION_STATUS_LABELS[q.verificationStatus];

                  return (
                    <div key={q.id} className="p-4 sm:p-5 space-y-2.5 hover:bg-slate-50/50">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                          <span className="rounded-lg bg-[#2563EB] text-white px-2.5 py-1 font-mono-tabular">
                            Câu {q.number}
                          </span>
                          <span className="rounded-lg bg-slate-100 text-slate-700 px-2 py-1">
                            {COGNITIVE_LABELS[q.cognitiveLevel]}
                          </span>
                          <span className="rounded-lg bg-blue-50 text-[#1E40AF] px-2 py-1 font-mono-tabular">
                            {q.points.toFixed(2)} đ
                          </span>
                          <span className={`rounded-lg border px-2 py-0.5 ${statusMeta.colorClass}`}>
                            {statusMeta.label}
                          </span>
                          {q.verificationStatus === 'ai_unverified' && (
                            <button
                              type="button"
                              onClick={() => updateQuestion(q.id, {verificationStatus: 'approved'})}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2 py-0.5 hover:bg-emerald-700"
                            >
                              <Check className="w-3 h-3" />
                              Xác nhận duyệt
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateQuestion(q.id, {locked: !q.locked})}
                            title={q.locked ? 'Đã khóa câu này (không bị ghi đè khi sinh lại)' : 'Khóa câu này để giữ nguyên khi sinh lại đề'}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
                              q.locked
                                ? 'border-amber-300 bg-amber-50 text-amber-800'
                                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {q.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            {q.locked ? 'Đã khóa' : 'Khóa câu'}
                          </button>
                          {!q.locked && (
                            <button
                              type="button"
                              onClick={() => onRegenerateQuestion(q.id)}
                              title="Đổi câu khác từ ngân hàng"
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Đổi câu
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingQId(isEditing ? null : q.id)}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#2563EB] hover:bg-blue-100"
                          >
                            {isEditing ? 'Xong' : 'Chỉnh sửa'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteQuestion(q.id)}
                            title="Xóa câu hỏi"
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {!isEditing ? (
                        <div className="space-y-2">
                          <div className="text-[15px] text-[#0F172A] whitespace-pre-line leading-relaxed">
                            <FormattedText text={q.prompt} />
                          </div>
                          {q.options && q.options.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-2">
                              {q.options.map((opt) => {
                                const isAns =
                                  opt.label.toUpperCase() === q.correctAnswer.trim().toUpperCase();
                                return (
                                  <div
                                    key={opt.id}
                                    className={`rounded-lg px-3 py-1.5 text-[15px] border ${
                                      isAns
                                        ? 'border-emerald-300 bg-emerald-50/80 font-semibold text-emerald-950'
                                        : 'border-slate-200 bg-white text-slate-800'
                                    }`}
                                  >
                                    <span className="font-bold mr-1.5">{opt.label}.</span>
                                    <FormattedText text={opt.text} />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div className="text-sm text-[#475569] bg-slate-50 rounded-xl px-3.5 py-2 border border-slate-200/80">
                            <span className="font-bold text-emerald-700">Đáp án: {q.correctAnswer}</span>
                            {q.explanation && <span className="ml-2">— {q.explanation}</span>}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Nội dung câu hỏi (dùng &lt;u&gt;...&lt;/u&gt; cho phần gạch chân ngữ âm):
                            </label>
                            <textarea
                              rows={3}
                              value={q.prompt}
                              onChange={(e) => updateQuestion(q.id, {prompt: e.target.value})}
                              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-[15px]"
                            />
                          </div>

                          {q.options && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {q.options.map((opt, idx) => (
                                <div key={opt.id} className="flex items-center gap-2">
                                  <span className="font-bold text-sm w-6 text-center">{opt.label}.</span>
                                  <input
                                    type="text"
                                    value={opt.text}
                                    onChange={(e) => {
                                      const nextOpts = q.options!.map((o, i) =>
                                        i === idx ? {...o, text: e.target.value} : o,
                                      );
                                      updateQuestion(q.id, {options: nextOpts});
                                    }}
                                    className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">Đáp án đúng</label>
                              <input
                                type="text"
                                value={q.correctAnswer}
                                onChange={(e) => updateQuestion(q.id, {correctAnswer: e.target.value})}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">Mức độ</label>
                              <select
                                value={q.cognitiveLevel}
                                onChange={(e) =>
                                  updateQuestion(q.id, {cognitiveLevel: e.target.value as CognitiveLevel})
                                }
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                              >
                                <option value="recognition">Nhận biết</option>
                                <option value="comprehension">Thông hiểu</option>
                                <option value="application">Vận dụng</option>
                                <option value="high_application">Vận dụng cao</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">Điểm số</label>
                              <input
                                type="number"
                                step={0.25}
                                min={0}
                                max={10}
                                value={q.points}
                                onChange={(e) =>
                                  updateQuestion(q.id, {points: Number(e.target.value) || 0})
                                }
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-bold font-mono-tabular"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Giải thích chi tiết</label>
                            <textarea
                              rows={2}
                              value={q.explanation}
                              onChange={(e) => updateQuestion(q.id, {explanation: e.target.value})}
                              className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Question Bank Picker Drawer/Modal */}
      {bankPickerGroupId && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-extrabold text-[#0F172A]">
                Chọn câu hỏi từ Ngân hàng ({questionBank.length} câu sẵn có)
              </h3>
              <button
                type="button"
                onClick={() => setBankPickerGroupId(null)}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-200 flex flex-wrap gap-3 bg-slate-50">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={bankQuery}
                  onChange={(e) => setBankQuery(e.target.value)}
                  placeholder="Tìm câu hỏi theo nội dung, chủ đề, Unit..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm"
                />
              </div>
              <select
                value={bankSkillFilter}
                onChange={(e) => setBankSkillFilter(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
              >
                <option value="all">Tất cả kỹ năng</option>
                <option value="listening">Listening</option>
                <option value="language">Language</option>
                <option value="reading">Reading</option>
                <option value="writing">Writing</option>
                <option value="speaking">Speaking</option>
              </select>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filteredBank.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-xl border border-slate-200 p-3.5 flex items-start justify-between gap-3 hover:border-blue-300"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-500">
                      Lớp {rec.grade} · {EXAM_SKILL_LABELS[rec.skill].vi} · {COGNITIVE_LABELS[rec.cognitiveLevel]} · {rec.sourceLabel}
                    </div>
                    <div className="text-[15px] text-[#0F172A] line-clamp-2">
                      <FormattedText text={rec.prompt} />
                    </div>
                    <div className="text-xs text-emerald-700 font-semibold">
                      Đáp án: {rec.correctAnswer}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInsertFromBank(rec, bankPickerGroupId)}
                    className="shrink-0 rounded-xl bg-[#2563EB] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#1E40AF]"
                  >
                    + Chèn vào đề
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
