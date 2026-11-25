import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import type {
  ActivityType,
  CognitiveLevel,
  LessonProject,
  QuestionOption,
  SkillCategory,
  Slide,
} from '../types/lesson';
import {COGNITIVE_LABELS, DEFAULT_SPEAKING_RUBRIC, DEFAULT_WRITING_RUBRIC} from '../types/lesson';
import type {
  AnswerKey,
  AnswerKeyEntry,
  BankQuestionRecord,
  CurriculumScope,
  Exam,
  ExamBlueprint,
  ExamDossier,
  ExamHeaderMeta,
  ExamMatrixRow,
  ExamQuestionFormat,
  ExamQuestionItem,
  ExamSkillKey,
  ExamValidationIssue,
  ExamVersion,
  MarkingGuide,
  MatrixTemplateMode,
  QuestionGroup,
  ShuffleOptions,
  Specification,
  SpecificationRow,
} from '../types/exam';
import {EXAM_FORMAT_LABELS, EXAM_SKILL_LABELS} from '../types/exam';
import {
  createDefaultSpeakingRubric,
  createDefaultWritingRubric,
  createGraduation2025MatrixRows,
  createPeriodicCV7991MatrixRows,
  DEFAULT_TEXTBOOKS,
  EXAM_TYPE_PRESETS,
  GLOBAL_SUCCESS_UNITS,
  OFFICIAL_SOURCE_REFERENCES,
} from '../data/examCurriculum';

const ROUND2 = (n: number) => Math.round(n * 100) / 100;

export function recalculateMatrixRow(
  row: ExamMatrixRow,
  includeHighApplication: boolean,
  totalScoreTarget = 10,
): ExamMatrixRow {
  const rec = Math.max(0, Math.floor(Number(row.recognitionCount) || 0));
  const comp = Math.max(0, Math.floor(Number(row.comprehensionCount) || 0));
  const app = Math.max(0, Math.floor(Number(row.applicationCount) || 0));
  const highApp = includeHighApplication
    ? Math.max(0, Math.floor(Number(row.highApplicationCount) || 0))
    : 0;
  const questionCount = rec + comp + app + highApp;
  const points = ROUND2(Math.max(0, Number(row.points) || 0));
  const percentage =
    totalScoreTarget > 0 ? ROUND2((points / totalScoreTarget) * 100) : 0;
  const scoringUnits =
    row.questionFormat === 'essay' || row.questionFormat === 'speaking'
      ? Math.max(1, Number(row.scoringUnits) || 5)
      : Math.max(questionCount, Number(row.scoringUnits) || questionCount);
  return {
    ...row,
    recognitionCount: rec,
    comprehensionCount: comp,
    applicationCount: app,
    highApplicationCount: highApp,
    questionCount,
    scoringUnits,
    points,
    percentage,
  };
}

export function getMatrixSummary(blueprint: ExamBlueprint) {
  let recognition = 0;
  let comprehension = 0;
  let application = 0;
  let highApplication = 0;
  let totalQuestions = 0;
  let totalScoringUnits = 0;
  let totalPoints = 0;
  let totalPercentage = 0;

  let recognitionPts = 0;
  let comprehensionPts = 0;
  let applicationPts = 0;
  let highApplicationPts = 0;

  for (const row of blueprint.rows) {
    const r = recalculateMatrixRow(row, blueprint.includeHighApplication, blueprint.totalScoreTarget);
    recognition += r.recognitionCount;
    comprehension += r.comprehensionCount;
    application += r.applicationCount;
    highApplication += r.highApplicationCount;
    totalQuestions += r.questionCount;
    totalScoringUnits += r.scoringUnits;
    totalPoints += r.points;
    totalPercentage += r.percentage;

    if (r.questionCount > 0) {
      const unitPt = r.points / r.questionCount;
      recognitionPts += unitPt * r.recognitionCount;
      comprehensionPts += unitPt * r.comprehensionCount;
      applicationPts += unitPt * r.applicationCount;
      highApplicationPts += unitPt * r.highApplicationCount;
    }
  }

  return {
    recognition,
    comprehension,
    application,
    highApplication,
    totalQuestions,
    totalScoringUnits,
    totalPoints: ROUND2(totalPoints),
    totalPercentage: ROUND2(totalPercentage),
    recognitionPts: ROUND2(recognitionPts),
    comprehensionPts: ROUND2(comprehensionPts),
    applicationPts: ROUND2(applicationPts),
    highApplicationPts: ROUND2(highApplicationPts),
    recognitionPct: totalPoints > 0 ? ROUND2((recognitionPts / totalPoints) * 100) : 0,
    comprehensionPct: totalPoints > 0 ? ROUND2((comprehensionPts / totalPoints) * 100) : 0,
    applicationPct: totalPoints > 0 ? ROUND2((applicationPts / totalPoints) * 100) : 0,
    highApplicationPct: totalPoints > 0 ? ROUND2((highApplicationPts / totalPoints) * 100) : 0,
  };
}

function buildConcreteAssessmentDescriptor(
  row: ExamMatrixRow,
  level: CognitiveLevel,
  scope: CurriculumScope,
): string {
  const skill = row.skill;
  const content = row.testContent.toLowerCase();
  const levelVerb: Record<CognitiveLevel, string> = {
    recognition: 'Nhận biết',
    comprehension: 'Thông hiểu',
    application: 'Vận dụng',
    high_application: 'Vận dụng nâng cao',
  };

  if (skill === 'listening') {
    if (level === 'recognition') {
      return `Nghe nhận diện được thông tin chi tiết rõ ràng (tên riêng, thời gian, số liệu, sự kiện chính) trong đoạn hội thoại/bài nói thuộc phạm vi ${row.topic}.`;
    }
    if (level === 'comprehension') {
      return `Nghe hiểu ý chính, thái độ người nói và xác định tính đúng/sai hoặc thông tin diễn đạt lại (paraphrase) trong chủ điểm ${row.topic}.`;
    }
    return `Tổng hợp thông tin từ bài nghe để suy luận mục đích giao tiếp hoặc hoàn thiện ghi chú chính xác theo ngữ cảnh lớp ${scope.grade}.`;
  }

  if (skill === 'language') {
    if (content.includes('ngữ âm') || content.includes('phát âm') || content.includes('trọng âm')) {
      return `Phân biệt được cách phát âm phần gạch chân (nguyên âm/phụ âm/đuôi -ed, -s) và vị trí trọng âm của từ hai/ba âm tiết trong phạm vi SGK lớp ${scope.grade}.`;
    }
    if (row.questionFormat === 'ordering') {
      return `${levelVerb[level]} cấu trúc liên kết văn bản để sắp xếp đúng trật tự logic lượt lời hội thoại, lá thư hoặc đoạn văn nghị luận ngắn.`;
    }
    if (level === 'recognition') {
      return `Nhận diện đúng dạng từ loại, từ vựng cốt lõi và cấu trúc ngữ pháp cơ bản thuộc chủ điểm ${row.topic}.`;
    }
    if (level === 'comprehension') {
      return `Hiểu ngữ cảnh câu để lựa chọn collocation, giới từ, cụm động từ hoặc chia thì/cấu trúc câu chính xác.`;
    }
    return `Vận dụng tổng hợp từ vựng học thuật và cấu trúc ngữ pháp phức hợp để xử lý chính xác tình huống giao tiếp trong ngữ cảnh mới.`;
  }

  if (skill === 'reading') {
    if (content.includes('thông báo') || content.includes('tờ rơi') || content.includes('điền')) {
      if (level === 'recognition') {
        return `Nhận diện đúng từ loại, giới từ, lượng từ hoặc hình thức rút gọn cơ bản để hoàn thiện văn bản thông báo/tờ rơi/đọc điền.`;
      }
      if (level === 'comprehension') {
        return `Hiểu mối quan hệ ngữ nghĩa giữa các câu để chọn từ nối, cụm động từ hoặc mệnh đề phù hợp với mạch văn.`;
      }
      return `Phân tích cấu trúc đoạn văn và sắc thái từ vựng để điền chính xác mệnh đề hoàn chỉnh hoặc từ ngữ học thuật phù hợp ngữ cảnh.`;
    }
    if (level === 'recognition') {
      return `Xác định được thông tin hiển ngôn, chi tiết cụ thể hoặc đối tượng quy chiếu trực tiếp trong văn bản đọc hiểu.`;
    }
    if (level === 'comprehension') {
      return `Hiểu nghĩa từ vựng theo ngữ cảnh (đồng nghĩa/trái nghĩa), xác định ý chính đoạn văn hoặc nhận diện câu diễn đạt tương đương (paraphrase).`;
    }
    return `Phân tích mạch lập luận để suy luận (inference), tóm tắt đoạn văn hoặc chọn vị trí chèn câu phù hợp trong văn bản đọc hiểu lớp ${scope.grade}.`;
  }

  if (skill === 'writing') {
    if (row.questionFormat === 'transformation') {
      return `${levelVerb[level]} cấu trúc ngữ pháp trọng tâm lớp ${scope.grade} để viết lại hoặc kết hợp câu giữ nguyên ý nghĩa và đúng chính tả.`;
    }
    return `Tạo lập được đoạn văn/bài viết hoàn chỉnh (120–150 từ) đúng chủ đề ${row.topic}, đảm bảo bố cục rõ ràng, mạch lạc, dùng từ chính xác và ít lỗi ngữ pháp.`;
  }

  return `Trình bày mạch lạc quan điểm cá nhân về chủ đề ${row.topic}, phát âm rõ ràng, ngữ điệu tự nhiên và phản hồi linh hoạt câu hỏi tương tác của giám khảo.`;
}

export function syncSpecificationFromBlueprint(
  blueprint: ExamBlueprint,
  scope: CurriculumScope,
  existingSpec?: Specification,
): Specification {
  const existingByKey = new Map<string, SpecificationRow>();
  if (existingSpec) {
    for (const r of existingSpec.rows) {
      existingByKey.set(`${r.matrixRowId}::${r.cognitiveLevel}`, r);
    }
  }

  const specRows: SpecificationRow[] = [];
  let cursor = 1;
  let order = 1;

  for (const rawRow of blueprint.rows) {
    const row = recalculateMatrixRow(rawRow, blueprint.includeHighApplication, blueprint.totalScoreTarget);
    const levels: Array<{level: CognitiveLevel; count: number}> = (
      [
        {level: 'recognition' as CognitiveLevel, count: row.recognitionCount},
        {level: 'comprehension' as CognitiveLevel, count: row.comprehensionCount},
        {level: 'application' as CognitiveLevel, count: row.applicationCount},
        ...(blueprint.includeHighApplication
          ? [{level: 'high_application' as CognitiveLevel, count: row.highApplicationCount}]
          : []),
      ] as Array<{level: CognitiveLevel; count: number}>
    ).filter((l) => l.count > 0);

    const ptPerQuestion = row.questionCount > 0 ? row.points / row.questionCount : 0;

    for (const item of levels) {
      const start = cursor;
      const end = cursor + item.count - 1;
      cursor = end + 1;

      const prev = existingByKey.get(`${row.id}::${item.level}`);
      const posLabel = start === end ? `Câu ${start}` : `Câu ${start}–${end}`;

      specRows.push({
        id: prev?.id || `spec-${row.id}-${item.level}`,
        matrixRowId: row.id,
        order: order++,
        skill: row.skill,
        topic: row.topic,
        knowledgeContent: `${row.testContent} — ${row.knowledgeUnit}`,
        learningOutcome:
          prev?.learningOutcome && prev.learningOutcome.trim().length > 10
            ? prev.learningOutcome
            : row.learningOutcome ||
              `Đạt yêu cầu cần đạt mức ${COGNITIVE_LABELS[item.level]} cho nội dung ${row.testContent}.`,
        assessmentDescriptor:
          prev?.assessmentDescriptor && prev.assessmentDescriptor.trim().length > 15
            ? prev.assessmentDescriptor
            : buildConcreteAssessmentDescriptor(row, item.level, scope),
        questionFormat: row.questionFormat,
        cognitiveLevel: item.level,
        questionCount: item.count,
        questionPositions: posLabel,
        points: ROUND2(ptPerQuestion * item.count),
      });
    }
  }

  return {
    id: existingSpec?.id || `spec-${Date.now()}`,
    rows: specRows,
    updatedAt: Date.now(),
  };
}

/**
 * 2-way sync: when a teacher updates counts/points/format in Specification,
 * reflect structural changes cleanly back into the Matrix rows.
 */
export function syncBlueprintFromSpecification(
  spec: Specification,
  blueprint: ExamBlueprint,
): ExamBlueprint {
  const byMatrixId = new Map<string, SpecificationRow[]>();
  for (const sr of spec.rows) {
    const list = byMatrixId.get(sr.matrixRowId) || [];
    list.push(sr);
    byMatrixId.set(sr.matrixRowId, list);
  }

  const updatedRows = blueprint.rows.map((row) => {
    const linked = byMatrixId.get(row.id);
    if (!linked || linked.length === 0) return row;

    let rec = 0;
    let comp = 0;
    let app = 0;
    let highApp = 0;
    let pts = 0;

    for (const sr of linked) {
      if (sr.cognitiveLevel === 'recognition') rec += sr.questionCount;
      else if (sr.cognitiveLevel === 'comprehension') comp += sr.questionCount;
      else if (sr.cognitiveLevel === 'application') app += sr.questionCount;
      else highApp += sr.questionCount;
      pts += sr.points;
    }

    return recalculateMatrixRow(
      {
        ...row,
        recognitionCount: rec,
        comprehensionCount: comp,
        applicationCount: app,
        highApplicationCount: highApp,
        points: ROUND2(pts),
        learningOutcome: linked[0]?.learningOutcome || row.learningOutcome,
      },
      blueprint.includeHighApplication,
      blueprint.totalScoreTarget,
    );
  });

  return {
    ...blueprint,
    rows: updatedRows,
  };
}

export function generateBlueprintFromScope(
  scope: CurriculumScope,
  templateMode?: MatrixTemplateMode,
): ExamBlueprint {
  const preset = EXAM_TYPE_PRESETS.find((p) => p.id === scope.examType);
  const mode: MatrixTemplateMode =
    templateMode ||
    (preset?.isGraduationType ? 'graduation_2025' : preset?.defaultTemplate || 'cv_7991');

  const unitTitles = GLOBAL_SUCCESS_UNITS[scope.grade]
    .filter((u) => scope.selectedUnitIds.includes(u.id))
    .map((u) => `Unit ${u.number}: ${u.title}`);
  const topicSummary =
    unitTitles.length > 0
      ? unitTitles.slice(0, 3).join(', ') + (unitTitles.length > 3 ? ` (+${unitTitles.length - 3} Unit)` : '')
      : scope.selectedTopics.length > 0
        ? scope.selectedTopics.slice(0, 3).join(', ')
        : `Chương trình Tiếng Anh lớp ${scope.grade}`;

  let rows: ExamMatrixRow[];
  if (mode === 'graduation_2025' || preset?.isGraduationType) {
    rows = createGraduation2025MatrixRows(topicSummary);
  } else {
    const includeSpeaking = scope.skills.includes('speaking');
    rows = createPeriodicCV7991MatrixRows(scope.skills, topicSummary, includeSpeaking);
  }

  return {
    id: `bp-${Date.now()}`,
    templateMode: mode,
    includeHighApplication: false,
    bilingualHeaders: false,
    totalScoreTarget: 10,
    rows: rows.map((r) => recalculateMatrixRow(r, false, 10)),
    notes:
      mode === 'graduation_2025'
        ? scope.graduationMode === '2027_reference'
          ? 'Cấu trúc tham khảo theo định dạng 2025–2026 (chờ hướng dẫn chính thức năm 2027).'
          : 'Bám sát định dạng đề thi tốt nghiệp THPT môn Tiếng Anh áp dụng từ năm 2025 (40 câu TNKQ, 50 phút).'
        : 'Bám sát Công văn 7991/BGDĐT-GDTrH ngày 17/12/2024 và Thông tư 22/2021/TT-BGDĐT.',
  };
}

export function syncAnswerKeyAndMarkingGuide(
  exam: Exam,
  existingGuide?: MarkingGuide,
): {answerKey: AnswerKey; markingGuide: MarkingGuide} {
  const groupMap = new Map(exam.groups.map((g) => [g.id, g]));
  const sortedQuestions = [...exam.questions].sort((a, b) => a.number - b.number);

  const entries: AnswerKeyEntry[] = sortedQuestions.map((q) => ({
    questionNumber: q.number,
    questionId: q.id,
    skill: q.skill,
    cognitiveLevel: q.cognitiveLevel,
    questionFormat: q.format,
    correctAnswer: q.correctAnswer,
    acceptedAnswers: q.acceptedAnswers,
    points: q.points,
    explanation: q.explanation,
    sectionTitle: (q.groupId && groupMap.get(q.groupId)?.title) || EXAM_SKILL_LABELS[q.skill].vi,
  }));

  const totalPoints = ROUND2(entries.reduce((sum, e) => sum + e.points, 0));

  const listeningTranscripts = exam.groups
    .filter((g) => g.skill === 'listening' && g.audio?.transcript?.trim())
    .map((g) => ({
      groupId: g.id,
      title: g.title,
      transcript: g.audio!.transcript,
    }));

  const essayQuestions = sortedQuestions.filter(
    (q) => q.format === 'essay' || q.format === 'speaking',
  );
  const essaySampleGuides = essayQuestions.map((q) => {
    const prev = existingGuide?.essaySampleGuides.find((g) => g.questionNumber === q.number);
    return {
      questionNumber: q.number,
      prompt: q.prompt,
      outlinePoints: prev?.outlinePoints?.length
        ? prev.outlinePoints
        : q.speakingCues?.length
          ? q.speakingCues
          : [
              'Mở bài / Câu chủ đề nêu rõ trọng tâm vấn đề.',
              'Triển khai 2–3 luận điểm kèm ví dụ cụ thể.',
              'Kết luận ngắn gọn, nhấn mạnh thông điệp chính.',
            ],
      sampleResponse: prev?.sampleResponse || q.sampleAnswer || q.correctAnswer || '',
      maxScore: q.points,
    };
  });

  const writingTotal = ROUND2(
    sortedQuestions
      .filter((q) => q.format === 'essay')
      .reduce((s, q) => s + q.points, 0) || 1.5,
  );
  const speakingTotal = ROUND2(
    sortedQuestions
      .filter((q) => q.format === 'speaking')
      .reduce((s, q) => s + q.points, 0) || 2.0,
  );

  const answerKey: AnswerKey = {
    examCode: exam.header.examCode || '101',
    generatedAt: Date.now(),
    entries,
    totalPoints,
  };

  const markingGuide: MarkingGuide = {
    generalInstructions:
      existingGuide?.generalInstructions ||
      'Chấm điểm theo thang điểm 10, làm tròn đến 0,25 hoặc theo quy chế của tổ chuyên môn. Đối với câu tự luận/viết lại câu, chấp nhận mọi phương án diễn đạt tương đương đúng ngữ pháp và nghĩa. Phần Viết đoạn văn và Nói chấm trực tiếp theo Rubric giáo viên (không tự chấm điểm máy móc).',
    listeningTranscripts,
    essaySampleGuides,
    writingRubric: existingGuide?.writingRubric || createDefaultWritingRubric(writingTotal),
    speakingRubric: existingGuide?.speakingRubric || createDefaultSpeakingRubric(speakingTotal),
  };

  return {answerKey, markingGuide};
}

/**
 * Independent Answer Audit (Section XI):
 * Detects missing keys, duplicate options, ambiguous answers, or key-option mismatches.
 */
export function auditExamAnswers(exam: Exam, answerKey: AnswerKey): ExamValidationIssue[] {
  const issues: ExamValidationIssue[] = [];
  const keyMap = new Map(answerKey.entries.map((e) => [e.questionId, e]));

  for (const q of exam.questions) {
    const keyEntry = keyMap.get(q.id);
    const isConstructed = q.format === 'essay' || q.format === 'speaking';

    // 1. Missing answer key
    if (!isConstructed && (!q.correctAnswer || !q.correctAnswer.trim())) {
      issues.push({
        id: `audit-missing-key-${q.id}`,
        severity: 'error',
        code: 'MISSING_ANSWER_KEY',
        section: 'answers',
        questionNumber: q.number,
        message: `Câu ${q.number} chưa có đáp án đúng.`,
      });
    }

    // 2. Sync mismatch between Exam question and AnswerKey table
    if (keyEntry && keyEntry.correctAnswer !== q.correctAnswer) {
      issues.push({
        id: `audit-desync-${q.id}`,
        severity: 'error',
        code: 'ANSWER_KEY_DESYNC',
        section: 'answers',
        questionNumber: q.number,
        message: `Câu ${q.number}: đáp án trong đề ("${q.correctAnswer}") không khớp bảng đáp án ("${keyEntry.correctAnswer}").`,
      });
    }

    // 3. Objective MCQ / Ordering / True-False option checks
    if (q.options && q.options.length > 0) {
      const normalizedTexts = q.options.map((o) =>
        o.text.replace(/<[^>]+>/g, '').trim().toLowerCase(),
      );
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const txt of normalizedTexts) {
        if (!txt) {
          issues.push({
            id: `audit-empty-opt-${q.id}`,
            severity: 'error',
            code: 'EMPTY_OPTION',
            section: 'answers',
            questionNumber: q.number,
            message: `Câu ${q.number} có phương án lựa chọn bị bỏ trống.`,
          });
        } else if (seen.has(txt)) {
          duplicates.push(txt);
        } else {
          seen.add(txt);
        }
      }

      if (duplicates.length > 0) {
        issues.push({
          id: `audit-dup-opt-${q.id}`,
          severity: 'error',
          code: 'DUPLICATE_OPTIONS',
          section: 'answers',
          questionNumber: q.number,
          message: `Câu ${q.number} có phương án bị trùng lặp nội dung ("${duplicates[0]}").`,
        });
      }

      const validLabels = new Set(q.options.map((o) => o.label.trim().toUpperCase()));
      const ans = q.correctAnswer.trim().toUpperCase();
      if (ans && !validLabels.has(ans) && q.format !== 'true_false') {
        issues.push({
          id: `audit-key-mismatch-${q.id}`,
          severity: 'error',
          code: 'KEY_OPTION_MISMATCH',
          section: 'answers',
          questionNumber: q.number,
          message: `Câu ${q.number}: đáp án "${q.correctAnswer}" không khớp với bất kỳ nhãn phương án nào (${[...validLabels].join(', ')}).`,
        });
      }

      // Ambiguous multi-key check (e.g., "A/B" or "A, B")
      if (/[\/,]/.test(ans) && (q.format === 'mcq' || q.format === 'ordering')) {
        issues.push({
          id: `audit-ambiguous-${q.id}`,
          severity: 'error',
          code: 'AMBIGUOUS_MULTIPLE_ANSWERS',
          section: 'answers',
          questionNumber: q.number,
          message: `Câu ${q.number} trắc nghiệm có dấu hiệu nhiều hơn 1 đáp án ("${q.correctAnswer}"). Cần chỉnh về duy nhất 1 đáp án đúng.`,
        });
      }
    }

    if (q.verificationStatus === 'ai_unverified') {
      issues.push({
        id: `audit-ai-unverified-${q.id}`,
        severity: 'warning',
        code: 'AI_UNVERIFIED_ITEM',
        section: 'exam',
        questionNumber: q.number,
        message: `Câu ${q.number} được tạo bằng AI và chưa được giáo viên xác nhận duyệt.`,
      });
    }
  }

  return issues;
}

/**
 * Full Dossier Validation (Sections VI, VII, VIII, X, XI, XVI):
 * Enforces strict quality rules before marking an exam "Sẵn sàng xuất đề".
 */
export function validateExamDossier(dossier: ExamDossier): ExamValidationIssue[] {
  const issues: ExamValidationIssue[] = [];
  const summary = getMatrixSummary(dossier.blueprint);
  const preset = EXAM_TYPE_PRESETS.find((p) => p.id === dossier.scope.examType);

  // 1. Matrix total points == 10
  if (Math.abs(summary.totalPoints - dossier.blueprint.totalScoreTarget) > 0.01) {
    issues.push({
      id: 'val-matrix-score',
      severity: 'error',
      code: 'MATRIX_TOTAL_SCORE',
      section: 'matrix',
      message: `Tổng điểm ma trận hiện là ${summary.totalPoints.toFixed(2)} điểm (yêu cầu chính xác ${dossier.blueprint.totalScoreTarget.toFixed(2)} điểm).`,
    });
  }

  // 2. Matrix total % == 100%
  if (Math.abs(summary.totalPercentage - 100) > 0.2) {
    issues.push({
      id: 'val-matrix-pct',
      severity: 'error',
      code: 'MATRIX_TOTAL_PERCENTAGE',
      section: 'matrix',
      message: `Tổng tỷ lệ phần trăm ma trận hiện là ${summary.totalPercentage.toFixed(1)}% (yêu cầu đúng 100%).`,
    });
  }

  // 3. Matrix row sanity & learning outcome check
  for (const row of dossier.blueprint.rows) {
    const r = recalculateMatrixRow(
      row,
      dossier.blueprint.includeHighApplication,
      dossier.blueprint.totalScoreTarget,
    );
    if (r.questionCount <= 0) {
      issues.push({
        id: `val-row-empty-${r.id}`,
        severity: 'warning',
        code: 'MATRIX_ROW_ZERO_QUESTIONS',
        section: 'matrix',
        message: `Dòng ma trận #${r.order} ("${r.testContent}") có 0 câu hỏi.`,
      });
    }
    if (r.questionCount > 0 && r.points <= 0) {
      issues.push({
        id: `val-row-zero-pts-${r.id}`,
        severity: 'error',
        code: 'UNREASONABLE_POINTS',
        section: 'matrix',
        message: `Dòng ma trận #${r.order} ("${r.testContent}") có ${r.questionCount} câu nhưng phân bổ 0 điểm.`,
      });
    }
    if (!r.learningOutcome || r.learningOutcome.trim().length < 8) {
      issues.push({
        id: `val-row-lo-${r.id}`,
        severity: 'warning',
        code: 'MISSING_LEARNING_OUTCOME',
        section: 'matrix',
        message: `Dòng ma trận #${r.order} ("${r.testContent}") chưa có Yêu cầu cần đạt cụ thể.`,
      });
    }
  }

  // 4. Specification synchronization check
  const specQuestionTotal = dossier.specification.rows.reduce((s, r) => s + r.questionCount, 0);
  const specPointTotal = ROUND2(dossier.specification.rows.reduce((s, r) => s + r.points, 0));
  if (specQuestionTotal !== summary.totalQuestions) {
    issues.push({
      id: 'val-spec-qcount',
      severity: 'error',
      code: 'SPEC_MATRIX_COUNT_MISMATCH',
      section: 'specification',
      message: `Số câu ở Bản đặc tả (${specQuestionTotal} câu) không khớp Ma trận (${summary.totalQuestions} câu). Hãy bấm "Đồng bộ từ Ma trận".`,
    });
  }
  if (Math.abs(specPointTotal - summary.totalPoints) > 0.05) {
    issues.push({
      id: 'val-spec-points',
      severity: 'error',
      code: 'SPEC_MATRIX_POINTS_MISMATCH',
      section: 'specification',
      message: `Tổng điểm Bản đặc tả (${specPointTotal}) chưa khớp Ma trận (${summary.totalPoints}).`,
    });
  }

  // 5. Exam questions vs Matrix check
  const examQuestionCount = dossier.exam.questions.length;
  const examPointTotal = ROUND2(dossier.exam.questions.reduce((s, q) => s + q.points, 0));
  if (examQuestionCount !== summary.totalQuestions) {
    issues.push({
      id: 'val-exam-qcount',
      severity: 'error',
      code: 'EXAM_MATRIX_COUNT_MISMATCH',
      section: 'exam',
      message: `Số câu trong đề hiện có ${examQuestionCount} câu, chưa khớp Ma trận (${summary.totalQuestions} câu).`,
    });
  }
  if (Math.abs(examPointTotal - dossier.blueprint.totalScoreTarget) > 0.05) {
    issues.push({
      id: 'val-exam-points',
      severity: 'error',
      code: 'EXAM_POINTS_MISMATCH',
      section: 'exam',
      message: `Tổng điểm các câu trong đề là ${examPointTotal.toFixed(2)} điểm (cần đúng ${dossier.blueprint.totalScoreTarget.toFixed(2)} điểm).`,
    });
  }

  // 6. THPT Graduation 2025–2026 strict structure validation (Section X)
  if (preset?.isGraduationType || dossier.blueprint.templateMode === 'graduation_2025') {
    if (examQuestionCount !== 40) {
      issues.push({
        id: 'val-grad-40',
        severity: 'error',
        code: 'GRADUATION_40_REQUIRED',
        section: 'exam',
        message: `Đề theo cấu trúc Tốt nghiệp THPT 2025–2026 phải có đúng 40 câu trắc nghiệm (hiện có ${examQuestionCount} câu).`,
      });
    }
    const forbidden = dossier.exam.questions.filter(
      (q) =>
        q.skill === 'listening' ||
        q.skill === 'speaking' ||
        q.format === 'essay' ||
        q.format === 'transformation',
    );
    if (forbidden.length > 0) {
      issues.push({
        id: 'val-grad-no-lsw',
        severity: 'error',
        code: 'GRADUATION_FORBIDDEN_SKILL',
        section: 'exam',
        message: `Đề tốt nghiệp THPT 2025–2026 không bao gồm Listening, Speaking hay Writing tự luận (phát hiện ${forbidden.length} câu không hợp lệ).`,
      });
    }
  }

  // 7. Listening strict guardrail (Section VI.1):
  // NEVER mark a Listening exam ready_to_export without usable audio source + transcript!
  const listeningGroups = dossier.exam.groups.filter((g) => g.skill === 'listening');
  const hasListeningQuestions = dossier.exam.questions.some((q) => q.skill === 'listening');
  if (hasListeningQuestions && listeningGroups.length === 0) {
    issues.push({
      id: 'val-listening-no-group',
      severity: 'error',
      code: 'LISTENING_MISSING_AUDIO',
      section: 'listening',
      message:
        'Đề có câu hỏi Listening nhưng chưa có phần Audio/Transcript đi kèm. Không thể chuyển sang trạng thái "Sẵn sàng xuất đề".',
    });
  }
  for (const lg of listeningGroups) {
    const audio = lg.audio;
    const hasUploadedAudio = audio?.sourceMode === 'uploaded' && Boolean(audio.dataUrl);
    const hasSynthOrTtsAudio =
      (audio?.sourceMode === 'builtin' || audio?.sourceMode === 'tts') &&
      Boolean(audio.transcript && audio.transcript.trim().length >= 25);
    if (!audio || (!hasUploadedAudio && !hasSynthOrTtsAudio)) {
      issues.push({
        id: `val-listening-audio-${lg.id}`,
        severity: 'error',
        code: 'LISTENING_NO_USABLE_AUDIO',
        section: 'listening',
        message: `Phần nghe "${lg.title}" chưa có tệp âm thanh hoặc transcript hợp lệ để phát nghe. Bắt buộc bổ sung trước khi xuất đề.`,
      });
    }
  }

  // 8. Scope check: warn if selected units do not match questions' units (when units selected)
  if (dossier.scope.selectedUnitIds.length > 0 && !preset?.isGraduationType) {
    const allowed = new Set(dossier.scope.selectedUnitIds);
    const outOfScope = dossier.exam.questions.filter(
      (q) => q.unitId && q.unitId.startsWith(`gs${dossier.scope.grade}-u`) && !allowed.has(q.unitId),
    );
    if (outOfScope.length > 0) {
      issues.push({
        id: 'val-out-of-scope',
        severity: 'warning',
        code: 'OUT_OF_SCOPE_CONTENT',
        section: 'exam',
        message: `Có ${outOfScope.length} câu hỏi nằm ngoài danh sách Unit đã chọn trong phạm vi kiến thức.`,
      });
    }
  }

  // 9. Independent Answer Audit
  issues.push(...auditExamAnswers(dossier.exam, dossier.answerKey));

  return issues;
}

export function canMarkReadyToExport(dossier: ExamDossier): {
  allowed: boolean;
  blockingErrors: ExamValidationIssue[];
} {
  const issues = validateExamDossier(dossier);
  const blockingErrors = issues.filter((i) => i.severity === 'error');
  return {
    allowed: blockingErrors.length === 0,
    blockingErrors,
  };
}

/**
 * Detects dependent MCQ options that MUST NOT be shuffled (e.g. "Both A and B", "All of the above")
 */
const DEPENDENT_OPTION_REGEX =
  /\b(both\s+[a-d]\s+and\s+[a-d]|all\s+of\s+the\s+above|none\s+of\s+the\s+above|neither\s+[a-d]\s+nor\s+[a-d]|a\s+and\s+b|b\s+and\s+c|a,\s*b,?\s*and\s*c|tất cả các đáp án trên|cả a và b)\b/i;

export function hasDependentOptionText(options?: QuestionOption[]): boolean {
  if (!options || options.length === 0) return false;
  return options.some((opt) => DEPENDENT_OPTION_REGEX.test(opt.text));
}

function seededRandom(seedStr: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRng<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Smart Exam Shuffler (Section XIII):
 * - NEVER shuffles dependent questions inside Reading, Listening, Cloze, or Ordering blocks.
 * - NEVER breaks dependent options ("Both A and B", "All of the above").
 * - Re-maps AnswerKey 100% accurately for every generated code.
 * - Verifies equivalence across all generated codes.
 */
export function shuffleExamVersions(
  dossier: ExamDossier,
  codes: string[],
  options: ShuffleOptions,
): ExamVersion[] {
  const cleanCodes = codes.map((c) => c.trim()).filter(Boolean);
  const targetCodes = cleanCodes.length > 0 ? cleanCodes : ['101', '102', '103', '104'];

  const baseGroups = [...dossier.exam.groups].sort((a, b) => a.order - b.order);
  const baseQuestions = [...dossier.exam.questions].sort((a, b) => a.number - b.number);

  const versions: ExamVersion[] = targetCodes.map((code, codeIndex) => {
    const rng = seededRandom(`${dossier.id}::${code}::${codeIndex}`);

    // Partition groups: keep listening first and essay/speaking last; only shuffle compatible standalone groups if requested
    let orderedGroups = baseGroups.map((g) => ({...g}));
    if (options.shuffleCompatibleGroups && codeIndex > 0) {
      const listening = orderedGroups.filter((g) => g.skill === 'listening');
      const writingSpeaking = orderedGroups.filter(
        (g) => g.skill === 'writing' || g.skill === 'speaking',
      );
      const middle = orderedGroups.filter(
        (g) => g.skill !== 'listening' && g.skill !== 'writing' && g.skill !== 'speaking',
      );
      // Only shuffle standalone groups or independent reading groups (keep notice/leaflet/cloze/reading in valid exam flow)
      const shuffledMiddle = shuffleWithRng(middle, rng);
      orderedGroups = [...listening, ...shuffledMiddle, ...writingSpeaking].map((g, idx) => ({
        ...g,
        order: idx + 1,
      }));
    }

    const newQuestions: ExamQuestionItem[] = [];
    let qNumber = 1;

    for (const group of orderedGroups) {
      const groupQuestions = baseQuestions
        .filter((q) => q.groupId === group.id)
        .sort((a, b) => a.number - b.number);

      // CRITICAL PROTECTION:
      // Never shuffle questions inside protected groups (Reading passages, Listening scripts, Notice/Leaflet Cloze, Text Completion, Sequential Ordering)
      const canShuffleInsideGroup =
        options.shuffleStandaloneQuestions &&
        codeIndex > 0 &&
        !group.protectOrder &&
        group.groupType === 'standalone_section' &&
        group.skill !== 'writing' &&
        group.skill !== 'speaking';

      const arrangedGroupQs = canShuffleInsideGroup
        ? shuffleWithRng(groupQuestions, rng)
        : groupQuestions;

      for (const origQ of arrangedGroupQs) {
        let clonedQ: ExamQuestionItem = {
          ...origQ,
          options: origQ.options ? origQ.options.map((o) => ({...o})) : undefined,
          number: qNumber++,
        };

        // Option shuffling (ONLY for MCQ with >= 3 options, NOT True/False, NOT protected, NOT dependent options)
        const shouldShuffleOpts =
          options.shuffleOptions &&
          codeIndex > 0 &&
          clonedQ.format === 'mcq' &&
          clonedQ.options &&
          clonedQ.options.length >= 3 &&
          !clonedQ.protectOptionShuffle &&
          !hasDependentOptionText(clonedQ.options);

        if (shouldShuffleOpts && clonedQ.options) {
          const originalLabels = clonedQ.options.map((o) => o.label);
          const correctIdx = clonedQ.options.findIndex(
            (o) => o.label.toUpperCase() === clonedQ.correctAnswer.trim().toUpperCase(),
          );
          const tagged = clonedQ.options.map((o, idx) => ({
            option: o,
            isCorrect: idx === correctIdx,
          }));
          const shuffled = shuffleWithRng(tagged, rng);
          let newCorrectLabel = clonedQ.correctAnswer;
          const remappedOptions: QuestionOption[] = shuffled.map((entry, idx) => {
            const label = originalLabels[idx] || String.fromCharCode(65 + idx);
            if (entry.isCorrect) newCorrectLabel = label;
            return {
              ...entry.option,
              label,
            };
          });
          clonedQ = {
            ...clonedQ,
            options: remappedOptions,
            correctAnswer: newCorrectLabel,
          };
        }

        newQuestions.push(clonedQ);
      }
    }

    // Also include any ungrouped questions at the end safely
    const assignedIds = new Set(newQuestions.map((q) => q.id));
    const orphanQs = baseQuestions.filter((q) => !assignedIds.has(q.id));
    for (const oq of orphanQs) {
      newQuestions.push({...oq, number: qNumber++});
    }

    const tempExam: Exam = {
      ...dossier.exam,
      header: {...dossier.exam.header, examCode: code},
      groups: orderedGroups,
      questions: newQuestions,
    };
    const {answerKey} = syncAnswerKeyAndMarkingGuide(tempExam, dossier.markingGuide);

    return {
      code,
      generatedAt: Date.now(),
      groups: orderedGroups,
      questions: newQuestions,
      answerKey,
      equivalenceChecked: true,
      equivalenceReport: [],
    };
  });

  return verifyVersionEquivalence(dossier, versions);
}

export function verifyVersionEquivalence(
  dossier: ExamDossier,
  versions: ExamVersion[],
): ExamVersion[] {
  const baseTotalPts = ROUND2(dossier.exam.questions.reduce((s, q) => s + q.points, 0));
  const baseCount = dossier.exam.questions.length;
  const baseLevelCounts = countByCognitiveLevel(dossier.exam.questions);
  const baseIdSet = new Set(dossier.exam.questions.map((q) => q.id));

  return versions.map((ver) => {
    const report: string[] = [];
    let ok = true;

    if (ver.questions.length !== baseCount) {
      ok = false;
      report.push(`Lệch số câu hỏi: mã đề ${ver.code} có ${ver.questions.length} câu (đề gốc ${baseCount} câu).`);
    } else {
      report.push(`Đủ ${ver.questions.length} câu hỏi khớp 100% tập câu gốc.`);
    }

    const verPts = ROUND2(ver.questions.reduce((s, q) => s + q.points, 0));
    if (Math.abs(verPts - baseTotalPts) > 0.01) {
      ok = false;
      report.push(`Lệch tổng điểm: ${verPts} so với đề gốc ${baseTotalPts}.`);
    } else {
      report.push(`Tổng điểm chuẩn xác: ${verPts.toFixed(2)} điểm.`);
    }

    const verLevels = countByCognitiveLevel(ver.questions);
    const sameLevels =
      verLevels.recognition === baseLevelCounts.recognition &&
      verLevels.comprehension === baseLevelCounts.comprehension &&
      verLevels.application === baseLevelCounts.application &&
      verLevels.high_application === baseLevelCounts.high_application;
    if (!sameLevels) {
      ok = false;
      report.push('Phân bố mức độ nhận thức bị thay đổi so với đề gốc.');
    } else {
      report.push(
        `Phân bố mức độ tương đương: NB ${verLevels.recognition} · TH ${verLevels.comprehension} · VD ${verLevels.application}${verLevels.high_application ? ` · VDC ${verLevels.high_application}` : ''}.`,
      );
    }

    const missingId = ver.questions.some((q) => !baseIdSet.has(q.id));
    if (missingId) {
      ok = false;
      report.push('Phát hiện câu hỏi lạ không thuộc đề gốc.');
    }

    // Verify every protected group maintained contiguous intact order
    for (const grp of ver.groups) {
      if (grp.protectOrder) {
        const gQs = ver.questions.filter((q) => q.groupId === grp.id);
        const origGQs = dossier.exam.questions
          .filter((q) => q.groupId === grp.id)
          .sort((a, b) => a.number - b.number);
        const sameSeq =
          gQs.length === origGQs.length &&
          gQs.every((q, idx) => q.id === origGQs[idx].id);
        if (!sameSeq) {
          ok = false;
          report.push(`Cảnh báo: Thứ tự câu trong nhóm bảo vệ "${grp.title}" bị đảo.`);
        }
      }
    }

    // Verify independent answer audit passes for this version
    const auditIssues = auditExamAnswers(
      {...dossier.exam, groups: ver.groups, questions: ver.questions},
      ver.answerKey,
    ).filter((i) => i.severity === 'error');
    if (auditIssues.length > 0) {
      ok = false;
      report.push(`Phát hiện ${auditIssues.length} lỗi đáp án trong mã đề ${ver.code}.`);
    } else {
      report.push('Đáp án khớp 100% sau khi đảo phương án; nhóm bài đọc/nghe/điền từ được giữ nguyên vẹn.');
    }

    return {
      ...ver,
      equivalenceChecked: ok,
      equivalenceReport: report,
    };
  });
}

function countByCognitiveLevel(questions: ExamQuestionItem[]) {
  const counts = {recognition: 0, comprehension: 0, application: 0, high_application: 0};
  for (const q of questions) {
    counts[q.cognitiveLevel] = (counts[q.cognitiveLevel] || 0) + 1;
  }
  return counts;
}

/**
 * Generates or regenerates Exam questions from Blueprint + Question Bank,
 * strictly preserving any questions with `locked === true`!
 */
export function generateExamFromBlueprint(
  dossier: ExamDossier,
  bank: BankQuestionRecord[],
  options: {
    regenerateMatrixRowId?: string;
    regenerateQuestionId?: string;
  } = {},
): ExamDossier {
  const {blueprint, scope} = dossier;
  const spec = syncSpecificationFromBlueprint(blueprint, scope, dossier.specification);
  const existingQuestions = [...dossier.exam.questions];
  const existingGroups = [...dossier.exam.groups];
  const usedBankIds = new Set<string>(
    existingQuestions.filter((q) => q.locked).map((q) => q.id),
  );

  // Single-question regeneration (strictly skip if locked)
  if (options.regenerateQuestionId) {
    const targetIdx = existingQuestions.findIndex((q) => q.id === options.regenerateQuestionId);
    if (targetIdx >= 0 && !existingQuestions[targetIdx].locked) {
      const target = existingQuestions[targetIdx];
      const replacement = pickBankQuestion(
        bank,
        {
          grade: scope.grade,
          skill: target.skill,
          format: target.format,
          level: target.cognitiveLevel,
          unitIds: scope.selectedUnitIds,
          excludeIds: new Set([...existingQuestions.map((q) => q.id)]),
        },
        target.number,
        target.points,
        target.matrixRowId,
        target.specRowId,
        target.groupId,
      );
      existingQuestions[targetIdx] = {
        ...replacement,
        number: target.number,
        groupId: target.groupId,
        sectionOrder: target.sectionOrder,
      };
    }
    const updatedExam: Exam = {...dossier.exam, questions: existingQuestions};
    const {answerKey, markingGuide} = syncAnswerKeyAndMarkingGuide(updatedExam, dossier.markingGuide);
    return {
      ...dossier,
      updatedAt: Date.now(),
      specification: spec,
      exam: updatedExam,
      answerKey,
      markingGuide,
    };
  }

  // Full or section-level regeneration while preserving locked items
  const newGroups: QuestionGroup[] = [];
  const newQuestions: ExamQuestionItem[] = [];
  let qCounter = 1;

  blueprint.rows.forEach((rawRow, rowIdx) => {
    const row = recalculateMatrixRow(rawRow, blueprint.includeHighApplication, blueprint.totalScoreTarget);
    const shouldRegenThisRow =
      !options.regenerateMatrixRowId || options.regenerateMatrixRowId === row.id;

    const existingRowGroup = existingGroups.find((g) => g.matrixRowId === row.id);
    const existingRowQuestions = existingQuestions
      .filter((q) => q.matrixRowId === row.id)
      .sort((a, b) => a.number - b.number);

    // Keep untouched sections intact
    if (!shouldRegenThisRow && existingRowGroup && existingRowQuestions.length > 0) {
      newGroups.push({...existingRowGroup, order: rowIdx + 1});
      for (const q of existingRowQuestions) {
        newQuestions.push({...q, number: qCounter++, sectionOrder: rowIdx + 1});
      }
      return;
    }

    const ptPerQuestion = row.questionCount > 0 ? ROUND2(row.points / row.questionCount) : 0;
    const isProtectedGroup =
      row.skill === 'listening' ||
      row.skill === 'reading' ||
      row.questionFormat === 'ordering';

    const groupId = existingRowGroup?.id || `grp-${row.id}`;
    const groupType = inferGroupType(row);

    // Try to find a cohesive stimulus group in bank for listening / reading rows
    const candidateBankForRow = bank.filter(
      (b) =>
        b.skill === row.skill &&
        (b.grade === scope.grade || bank.filter((x) => x.grade === scope.grade && x.skill === row.skill).length < row.questionCount),
    );
    const groupMatch = isProtectedGroup
      ? findBestBankGroup(candidateBankForRow, row, scope.grade, usedBankIds)
      : null;

    const audioAsset =
      row.skill === 'listening'
        ? existingRowGroup?.audio || {
            sourceMode: 'builtin' as const,
            transcript:
              groupMatch?.transcript ||
              `Good morning everyone. Today we are discussing ${row.topic} for Grade ${scope.grade} students. Paying attention to daily habits, teamwork, and practical solutions helps every learner succeed in school and in the community.`,
            voiceAccent: 'en-GB' as const,
            isSynthesized: true,
            showTranscriptInKey: true,
          }
        : undefined;

    const group: QuestionGroup = {
      id: groupId,
      order: rowIdx + 1,
      title: `PHẦN ${rowIdx + 1}. ${EXAM_SKILL_LABELS[row.skill].vi.toUpperCase()} — ${row.testContent}`,
      skill: row.skill,
      groupType,
      instruction: existingRowGroup?.instruction || buildDefaultGroupInstruction(row),
      stimulusTitle:
        groupMatch?.stimulusTitle || existingRowGroup?.stimulusTitle || (row.skill === 'reading' ? row.testContent : undefined),
      stimulusParagraphs:
        groupMatch?.stimulusParagraphs ||
        existingRowGroup?.stimulusParagraphs ||
        (row.skill === 'reading'
          ? [
              `Read the following passage about ${row.topic} carefully and choose the best answer to each question. Modern high school learners benefit greatly from combining practical knowledge, critical reading, and active collaboration.`,
            ]
          : undefined),
      audio: audioAsset,
      protectOrder: isProtectedGroup,
      matrixRowId: row.id,
    };
    newGroups.push(group);

    // Build required cognitive level slots
    const levelSlots: CognitiveLevel[] = [
      ...Array(row.recognitionCount).fill('recognition'),
      ...Array(row.comprehensionCount).fill('comprehension'),
      ...Array(row.applicationCount).fill('application'),
      ...(blueprint.includeHighApplication
        ? Array(row.highApplicationCount).fill('high_application')
        : []),
    ];

    // Preserve locked questions inside this row first
    const lockedInRow = existingRowQuestions.filter((q) => q.locked);
    const matchedGroupItems = groupMatch?.items || [];

    levelSlots.forEach((level, slotIdx) => {
      const lockedCandidate = lockedInRow[slotIdx];
      if (lockedCandidate) {
        newQuestions.push({
          ...lockedCandidate,
          number: qCounter++,
          groupId,
          matrixRowId: row.id,
          sectionOrder: rowIdx + 1,
          points: ptPerQuestion,
        });
        return;
      }

      const specRow = spec.rows.find(
        (sr) => sr.matrixRowId === row.id && sr.cognitiveLevel === level,
      );

      // Prefer matched cohesive group item if available
      const fromGroup = matchedGroupItems[slotIdx];
      if (fromGroup && !usedBankIds.has(fromGroup.id)) {
        usedBankIds.add(fromGroup.id);
        newQuestions.push({
          ...fromGroup,
          id: `${fromGroup.id}-${Date.now()}-${slotIdx}`,
          number: qCounter++,
          groupId,
          matrixRowId: row.id,
          specRowId: specRow?.id,
          sectionOrder: rowIdx + 1,
          cognitiveLevel: level,
          points: ptPerQuestion,
          locked: false,
        });
        return;
      }

      const picked = pickBankQuestion(
        bank,
        {
          grade: scope.grade,
          skill: row.skill,
          format: row.questionFormat,
          level,
          unitIds: scope.selectedUnitIds,
          excludeIds: usedBankIds,
        },
        qCounter,
        ptPerQuestion,
        row.id,
        specRow?.id,
        groupId,
      );
      usedBankIds.add(picked.id);
      newQuestions.push({
        ...picked,
        number: qCounter++,
        sectionOrder: rowIdx + 1,
      });
    });
  });

  // Adjust last question points slightly if rounding caused a 0.01 drift from 10.00
  const currentPts = ROUND2(newQuestions.reduce((s, q) => s + q.points, 0));
  const targetPts = ROUND2(getMatrixSummary(blueprint).totalPoints);
  if (newQuestions.length > 0 && Math.abs(currentPts - targetPts) > 0.001 && Math.abs(currentPts - targetPts) <= 0.1) {
    const last = newQuestions[newQuestions.length - 1];
    last.points = ROUND2(last.points + (targetPts - currentPts));
  }

  const updatedHeader: ExamHeaderMeta = {
    ...dossier.exam.header,
    durationMinutes: scope.durationMinutes,
    gradeLabel: `Lớp ${scope.grade}`,
    academicYear: scope.academicYear,
    questionCountLabel: `${newQuestions.length} câu`,
    scaleLabel: `${blueprint.totalScoreTarget} điểm`,
  };

  const updatedExam: Exam = {
    ...dossier.exam,
    header: updatedHeader,
    groups: newGroups,
    questions: newQuestions,
  };
  const {answerKey, markingGuide} = syncAnswerKeyAndMarkingGuide(updatedExam, dossier.markingGuide);

  return {
    ...dossier,
    updatedAt: Date.now(),
    specification: spec,
    exam: updatedExam,
    answerKey,
    markingGuide,
    versions: [],
  };
}

function inferGroupType(row: ExamMatrixRow): QuestionGroup['groupType'] {
  const c = row.testContent.toLowerCase();
  if (row.skill === 'listening') return 'listening_script';
  if (c.includes('thông báo') || c.includes('notice') || c.includes('quảng cáo')) return 'notice_cloze';
  if (c.includes('tờ rơi') || c.includes('leaflet')) return 'leaflet_cloze';
  if (c.includes('hoàn thành văn bản') || c.includes('text completion')) return 'cloze_completion';
  if (row.questionFormat === 'ordering' || c.includes('sắp xếp')) return 'arrangement_block';
  if (row.skill === 'reading') return 'reading_passage';
  return 'standalone_section';
}

function buildDefaultGroupInstruction(row: ExamMatrixRow): string {
  if (row.skill === 'listening') {
    return row.questionFormat === 'true_false'
      ? 'Listen to the recording twice and decide whether the following statements are True (T) or False (F).'
      : 'Listen to the recording twice and mark the letter A, B, C, or D to indicate the correct answer to each question.';
  }
  if (row.skill === 'reading') {
    return 'Read the following passage and mark the letter A, B, C, or D to indicate the correct answer to each of the questions.';
  }
  if (row.questionFormat === 'ordering') {
    return 'Mark the letter A, B, C, or D to indicate the best arrangement of utterances or sentences to make a meaningful exchange or text.';
  }
  if (row.questionFormat === 'transformation') {
    return 'Rewrite or combine the following sentences so that the meaning stays the same.';
  }
  if (row.questionFormat === 'essay') {
    return 'Write a well-structured paragraph/essay (120–150 words) on the topic below.';
  }
  if (row.questionFormat === 'speaking') {
    return 'Prepare for 2 minutes and present your response to the topic below, then answer follow-up questions.';
  }
  return 'Mark the letter A, B, C, or D to indicate the correct answer to each of the following questions.';
}

function findBestBankGroup(
  candidates: BankQuestionRecord[],
  row: ExamMatrixRow,
  grade: number,
  usedIds: Set<string>,
): {
  stimulusTitle?: string;
  stimulusParagraphs?: string[];
  transcript?: string;
  items: BankQuestionRecord[];
} | null {
  const byGroup = new Map<string, BankQuestionRecord[]>();
  for (const item of candidates) {
    if (!item.groupId || usedIds.has(item.id)) continue;
    const arr = byGroup.get(item.groupId) || [];
    arr.push(item);
    byGroup.set(item.groupId, arr);
  }

  let best: BankQuestionRecord[] | null = null;
  let bestScore = -1;
  for (const [, list] of byGroup) {
    const hasStimulus = Boolean(list[0].stimulusParagraphs?.length || list[0].audioTranscript);
    if (!hasStimulus) continue;
    const gradeBonus = list[0].grade === grade ? 10 : 0;
    const formatBonus = list[0].format === row.questionFormat ? 5 : 0;
    const sizeBonus = Math.min(list.length, row.questionCount) * 2;
    const score = gradeBonus + formatBonus + sizeBonus;
    if (score > bestScore) {
      bestScore = score;
      best = list;
    }
  }

  if (!best || best.length === 0) return null;
  return {
    stimulusTitle: best[0].stimulusTitle,
    stimulusParagraphs: best[0].stimulusParagraphs,
    transcript: best[0].audioTranscript,
    items: best,
  };
}

function pickBankQuestion(
  bank: BankQuestionRecord[],
  criteria: {
    grade: 10 | 11 | 12;
    skill: ExamSkillKey;
    format: ExamQuestionFormat;
    level: CognitiveLevel;
    unitIds: string[];
    excludeIds: Set<string>;
  },
  qNum: number,
  points: number,
  matrixRowId?: string,
  specRowId?: string,
  groupId?: string,
): ExamQuestionItem {
  const available = bank.filter((b) => !criteria.excludeIds.has(b.id));
  const unitSet = new Set(criteria.unitIds);

  // Ranked matching from strictest to broadest
  const match =
    available.find(
      (b) =>
        b.grade === criteria.grade &&
        b.skill === criteria.skill &&
        b.format === criteria.format &&
        b.cognitiveLevel === criteria.level &&
        (unitSet.size === 0 || unitSet.has(b.unitId)),
    ) ||
    available.find(
      (b) =>
        b.grade === criteria.grade &&
        b.skill === criteria.skill &&
        b.format === criteria.format,
    ) ||
    available.find(
      (b) => b.skill === criteria.skill && b.format === criteria.format,
    ) ||
    available.find((b) => b.skill === criteria.skill);

  if (match) {
    return {
      ...match,
      id: `${match.id}-${Date.now()}-${qNum}`,
      number: qNum,
      points,
      cognitiveLevel: criteria.level,
      matrixRowId,
      specRowId,
      groupId,
      sectionOrder: 1,
      locked: false,
    };
  }

  // Fallback structured teacher-editable question (never empty/broken)
  const isEssay = criteria.format === 'essay';
  const isSpeaking = criteria.format === 'speaking';
  const isTF = criteria.format === 'true_false';
  const isTrans = criteria.format === 'transformation';

  return {
    id: `gen-q-${Date.now()}-${qNum}`,
    number: qNum,
    grade: criteria.grade,
    textbookId: 'global-success',
    unitId: criteria.unitIds[0] || `gs${criteria.grade}-u1`,
    topic: `Tiếng Anh lớp ${criteria.grade}`,
    skill: criteria.skill,
    cognitiveLevel: criteria.level,
    questionType: isEssay
      ? 'essay'
      : isSpeaking
        ? 'speaking'
        : isTF
          ? 'true_false'
          : isTrans
            ? 'transformation'
            : 'mcq',
    format: criteria.format,
    prompt: isEssay
      ? `Write a paragraph (120–150 words) discussing practical ways Grade ${criteria.grade} students can contribute to a positive community.`
      : isSpeaking
        ? `Present your opinion on a key theme from Grade ${criteria.grade} English (2 minutes) and respond to two follow-up questions.`
        : isTrans
          ? `Students should practise English every day to improve fluency. (Rewrite using passive voice)`
          : isTF
            ? `The speaker emphasizes that consistent daily habits lead to better learning outcomes.`
            : `Choose the best option to complete the sentence for Grade ${criteria.grade} English.`,
    options:
      isEssay || isSpeaking || isTrans
        ? undefined
        : isTF
          ? [
              {id: 't', label: 'T', text: 'True'},
              {id: 'f', label: 'F', text: 'False'},
            ]
          : [
              {id: 'a', label: 'A', text: 'sustainable'},
              {id: 'b', label: 'B', text: 'sustainably'},
              {id: 'c', label: 'C', text: 'sustainability'},
              {id: 'd', label: 'D', text: 'sustain'},
            ],
    correctAnswer: isEssay
      ? 'Chấm theo Rubric Writing 5 tiêu chí.'
      : isSpeaking
        ? 'Chấm theo Rubric Speaking 5 tiêu chí.'
        : isTrans
          ? 'English should be practised every day by students to improve fluency.'
          : isTF
            ? 'T'
            : 'A',
    explanation: 'Câu hỏi mẫu tự biên soạn — giáo viên có thể chỉnh sửa trực tiếp trong trình soạn đề.',
    points,
    sourceLabel: 'Tự biên soạn trong hệ thống',
    groupId,
    matrixRowId,
    specRowId,
    sectionOrder: 1,
    verificationStatus: 'teacher_authored',
    tags: [`Lớp ${criteria.grade}`, criteria.skill],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    locked: false,
  };
}

/**
 * Create a brand-new blank synchronized ExamDossier from initial teacher config
 */
export function createNewExamDossier(
  scope: CurriculumScope,
  bank: BankQuestionRecord[],
  schoolName = '',
): ExamDossier {
  const preset = EXAM_TYPE_PRESETS.find((p) => p.id === scope.examType);
  const blueprint = generateBlueprintFromScope(scope);
  const spec = syncSpecificationFromBlueprint(blueprint, scope);
  const semesterLabel =
    scope.semester === 'hk1'
      ? 'Học kỳ I'
      : scope.semester === 'hk2'
        ? 'Học kỳ II'
        : 'Cả năm';
  const title = `${preset?.name || 'Đề kiểm tra Tiếng Anh'} — Lớp ${scope.grade} (${scope.academicYear})`;

  const baseDossier: ExamDossier = {
    id: `exam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'draft',
    isSample: false,
    sourceAttribution: preset?.isGraduationType
      ? scope.graduationMode === '2027_reference'
        ? 'Tự biên soạn · Cấu trúc tham khảo theo định dạng 2025–2026 (chờ hướng dẫn chính thức năm 2027)'
        : 'Tự biên soạn bám sát cấu trúc đề thi tốt nghiệp THPT từ năm 2025'
      : 'Tự biên soạn bám sát Chương trình GDPT 2018 & Công văn 7991/BGDĐT-GDTrH',
    scope,
    blueprint,
    specification: spec,
    exam: {
      id: `exam-body-${Date.now()}`,
      header: {
        departmentName: '',
        schoolName,
        examTitle: (preset?.name || 'ĐỀ KIỂM TRA TIẾNG ANH').toUpperCase(),
        subject: 'TIẾNG ANH',
        gradeLabel: `Lớp ${scope.grade}`,
        academicYear: scope.academicYear,
        semesterLabel,
        durationMinutes: scope.durationMinutes,
        examCode: '101',
        questionCountLabel: `${getMatrixSummary(blueprint).totalQuestions} câu`,
        scaleLabel: '10 điểm',
        studentInstructions:
          'Thí sinh làm bài cẩn thận, không sử dụng tài liệu. Giám thị không giải thích gì thêm.',
      },
      groups: [],
      questions: [],
    },
    answerKey: {
      examCode: '101',
      generatedAt: Date.now(),
      entries: [],
      totalPoints: 0,
    },
    markingGuide: {
      generalInstructions:
        'Chấm điểm theo thang điểm 10. Chấp nhận các phương án diễn đạt đúng ngữ pháp và tương đương nghĩa ở phần viết câu.',
      listeningTranscripts: [],
      essaySampleGuides: [],
      writingRubric: createDefaultWritingRubric(1.5),
      speakingRubric: createDefaultSpeakingRubric(2.0),
    },
    versions: [],
    sourceReferences: [...OFFICIAL_SOURCE_REFERENCES],
  };

  return generateExamFromBlueprint(baseDossier, bank);
}

/**
 * Convert ANY ExamDossier directly into an interactive LessonProject (Section XV)
 * Zero re-typing — playable in SlidePresenter with Listening audio, Reading split view,
 * revealable explanations, Writing/Speaking widgets!
 */
export function convertExamToLessonProject(
  dossier: ExamDossier,
  mode: 'by_group' | 'per_question' = 'by_group',
): LessonProject {
  const now = Date.now();
  const slides: Slide[] = [];
  const summary = getMatrixSummary(dossier.blueprint);

  // Slide 1: Cover Slide
  slides.push({
    id: `exam-slide-cover-${now}`,
    order: 0,
    title: dossier.exam.header.examTitle || dossier.title,
    subtitle: `${dossier.exam.header.gradeLabel} · Thời gian ${dossier.exam.header.durationMinutes} phút · Mã đề ${dossier.exam.header.examCode} · ${dossier.exam.questions.length} câu (${summary.totalPoints} điểm)`,
    skill: 'review',
    activityType: 'title_slide',
    instruction: dossier.exam.header.studentInstructions,
    bullets: [
      `Phạm vi: ${dossier.scope.textbookName} · ${dossier.scope.academicYear}`,
      `Cấu trúc mức độ: Nhận biết ${summary.recognition} · Thông hiểu ${summary.comprehension} · Vận dụng ${summary.application}`,
      `Chế độ trình chiếu: ${mode === 'per_question' ? 'Từng câu hỏi (Chữa đề chi tiết)' : 'Theo từng nhóm câu hỏi / bài đọc / bài nghe'}`,
    ],
  });

  const sortedGroups = [...dossier.exam.groups].sort((a, b) => a.order - b.order);

  const mapSkill = (sk: ExamSkillKey): SkillCategory => {
    if (sk === 'language') return 'grammar';
    return sk;
  };

  const mapActivity = (q: ExamQuestionItem): ActivityType => {
    if (q.skill === 'listening') {
      return q.format === 'true_false' ? 'listening_tf' : 'listening_mcq';
    }
    if (q.skill === 'reading') return 'reading_mcq';
    if (q.skill === 'writing') {
      return q.format === 'transformation' ? 'writing_transformation' : 'writing_paragraph';
    }
    if (q.skill === 'speaking') return 'speaking_presentation';
    return 'grammar_mcq';
  };

  for (const group of sortedGroups) {
    const groupQs = dossier.exam.questions
      .filter((q) => q.groupId === group.id)
      .sort((a, b) => a.number - b.number);
    if (groupQs.length === 0) continue;

    // Separate Writing Essay / Speaking tasks to get their dedicated interactive widgets
    const essayOrSpeaking = groupQs.filter(
      (q) => q.format === 'essay' || q.format === 'speaking',
    );
    const standardQs = groupQs.filter(
      (q) => q.format !== 'essay' && q.format !== 'speaking',
    );

    if (standardQs.length > 0) {
      if (mode === 'per_question') {
        for (const q of standardQs) {
          slides.push({
            id: `exam-slide-q-${q.id}-${now}`,
            order: slides.length,
            title: `Câu ${q.number} — ${group.title}`,
            subtitle: `${COGNITIVE_LABELS[q.cognitiveLevel]} · ${q.points} điểm`,
            skill: mapSkill(q.skill),
            activityType: mapActivity(q),
            instruction: group.instruction,
            passage:
              group.stimulusParagraphs && group.stimulusParagraphs.length > 0
                ? {
                    title: group.stimulusTitle || group.title,
                    paragraphs: group.stimulusParagraphs,
                  }
                : undefined,
            audio: group.audio
              ? {
                  sourceMode: group.audio.sourceMode,
                  transcript: group.audio.transcript,
                  voiceAccent: group.audio.voiceAccent,
                  isSynthesized: group.audio.isSynthesized,
                  dataUrl: group.audio.dataUrl,
                  fileName: group.audio.fileName,
                  mimeType: group.audio.mimeType,
                  showTranscriptDefault: false,
                }
              : undefined,
            questions: [
              {
                id: q.id,
                number: q.number,
                type:
                  q.questionType === 'essay' || q.questionType === 'speaking'
                    ? 'short_answer'
                    : q.questionType,
                prompt: q.prompt,
                options: q.options,
                correctAnswer: q.correctAnswer,
                acceptedAnswers: q.acceptedAnswers,
                explanation: q.explanation,
                cognitiveLevel: q.cognitiveLevel,
              },
            ],
            teacherNotes: `Đáp án: ${q.correctAnswer}. ${q.explanation}`,
          });
        }
      } else {
        // Chunk standard questions in groups of 4-6 per slide (keeping passage/audio attached)
        const chunkSize = group.skill === 'reading' || group.skill === 'listening' ? 5 : 4;
        for (let i = 0; i < standardQs.length; i += chunkSize) {
          const chunk = standardQs.slice(i, i + chunkSize);
          const partSuffix =
            standardQs.length > chunkSize
              ? ` (Câu ${chunk[0].number}–${chunk[chunk.length - 1].number})`
              : '';
          slides.push({
            id: `exam-slide-grp-${group.id}-${i}-${now}`,
            order: slides.length,
            title: `${group.title}${partSuffix}`,
            subtitle: `${EXAM_SKILL_LABELS[group.skill].en} · ${chunk.length} câu hỏi`,
            skill: mapSkill(group.skill),
            activityType: mapActivity(chunk[0]),
            instruction: group.instruction,
            passage:
              group.stimulusParagraphs && group.stimulusParagraphs.length > 0
                ? {
                    title: group.stimulusTitle || group.title,
                    paragraphs: group.stimulusParagraphs,
                  }
                : undefined,
            audio: group.audio
              ? {
                  sourceMode: group.audio.sourceMode,
                  transcript: group.audio.transcript,
                  voiceAccent: group.audio.voiceAccent,
                  isSynthesized: group.audio.isSynthesized,
                  dataUrl: group.audio.dataUrl,
                  fileName: group.audio.fileName,
                  mimeType: group.audio.mimeType,
                  showTranscriptDefault: false,
                }
              : undefined,
            questions: chunk.map((q) => ({
              id: q.id,
              number: q.number,
              type:
                q.questionType === 'essay' || q.questionType === 'speaking'
                  ? 'short_answer'
                  : q.questionType,
              prompt: q.prompt,
              options: q.options,
              correctAnswer: q.correctAnswer,
              acceptedAnswers: q.acceptedAnswers,
              explanation: q.explanation,
              cognitiveLevel: q.cognitiveLevel,
            })),
            teacherNotes: chunk
              .map((q) => `Câu ${q.number}: ${q.correctAnswer}`)
              .join(' | '),
          });
        }
      }
    }

    for (const eq of essayOrSpeaking) {
      if (eq.format === 'essay') {
        slides.push({
          id: `exam-slide-writing-${eq.id}-${now}`,
          order: slides.length,
          title: `Câu ${eq.number} — ${group.title}`,
          subtitle: `Writing Task · ${eq.points} điểm`,
          skill: 'writing',
          activityType: 'writing_paragraph',
          instruction: group.instruction,
          writingTask: {
            prompt: eq.prompt,
            minWords: eq.wordLimit?.min || 120,
            maxWords: eq.wordLimit?.max || 150,
            outlineHints: [
              'Topic sentence introducing the main idea clearly',
              'Supporting point 1 with concrete explanation/example',
              'Supporting point 2 with linking words (Furthermore, Moreover)',
              'Concluding sentence summarizing your viewpoint',
            ],
            usefulExpressions: [
              'In my opinion,',
              'First and foremost,',
              'Furthermore,',
              'In conclusion,',
            ],
            rubricCriteria: DEFAULT_WRITING_RUBRIC,
          },
          teacherNotes: eq.sampleAnswer || eq.explanation,
        });
      } else {
        slides.push({
          id: `exam-slide-speaking-${eq.id}-${now}`,
          order: slides.length,
          title: `Câu ${eq.number} — ${group.title}`,
          subtitle: `Speaking Task · ${eq.points} điểm`,
          skill: 'speaking',
          activityType: 'speaking_presentation',
          instruction: group.instruction,
          speakingTask: {
            prompt: eq.prompt,
            cues: eq.speakingCues || [
              'State your viewpoint clearly',
              'Give two supporting reasons and examples',
              'Answer follow-up questions confidently',
            ],
            rubricCriteria: DEFAULT_SPEAKING_RUBRIC,
          },
          teacherNotes: eq.explanation,
        });
      }
    }
  }

  return {
    id: `lesson-from-exam-${dossier.id}-${now}`,
    title: `[Trình chiếu đề] ${dossier.title}`,
    grade: dossier.scope.grade,
    educationLevel: 'high_school',
    skill: 'review',
    topic: dossier.exam.header.examTitle,
    description: `Chuyển trực tiếp từ bộ đề "${dossier.title}" (${dossier.exam.questions.length} câu, ${dossier.scope.durationMinutes} phút).`,
    curriculumNote: `${dossier.scope.textbookName} · Lớp ${dossier.scope.grade} · ${dossier.scope.academicYear}`,
    isSample: false,
    createdAt: now,
    updatedAt: now,
    themeId: 'light_classroom',
    slides,
  };
}

/**
 * Parse teacher-uploaded Excel (.xlsx/.xls/.csv) or Word (.docx) custom matrix template
 */
export async function parseCustomMatrixFile(file: File): Promise<{
  rows: ExamMatrixRow[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const lower = file.name.toLowerCase();
  const rawTableRows: string[][] = [];

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
    const buf = await file.arrayBuffer();
    const workbook = XLSX.read(buf, {type: 'array'});
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const sheetRows = XLSX.utils.sheet_to_json<Array<string | number>>(firstSheet, {
      header: 1,
      defval: '',
    });
    for (const r of sheetRows) {
      rawTableRows.push(r.map((cell) => String(cell ?? '').trim()));
    }
  } else if (lower.endsWith('.docx')) {
    const buf = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({arrayBuffer: buf});
    const parser = new DOMParser();
    const doc = parser.parseFromString(result.value, 'text/html');
    const trs = Array.from(doc.querySelectorAll('table tr'));
    for (const tr of trs) {
      const cells = Array.from(tr.querySelectorAll('td, th')).map((c) =>
        (c.textContent || '').trim(),
      );
      if (cells.length >= 3) rawTableRows.push(cells);
    }
  } else {
    throw new Error('Chỉ hỗ trợ nhập mẫu ma trận định dạng .xlsx, .xls, .csv hoặc .docx.');
  }

  const parsedRows: ExamMatrixRow[] = [];
  let order = 1;

  for (const cells of rawTableRows) {
    const joined = cells.join(' ').toLowerCase();
    // Skip header or total summary rows
    if (
      joined.includes('tổng cộng') ||
      joined.includes('tổng số') ||
      joined.includes('nhận biết') ||
      joined.includes('kỹ năng') ||
      joined.includes('nội dung kiểm tra') ||
      cells.filter(Boolean).length < 3
    ) {
      continue;
    }

    const nums = cells
      .map((c) => Number(c.replace(',', '.').replace('%', '')))
      .filter((n) => !Number.isNaN(n) && n >= 0);

    const textCells = cells.filter((c) => c.length > 1 && Number.isNaN(Number(c.replace(',', '.'))));
    if (textCells.length === 0) continue;

    const skillText = textCells[0].toLowerCase();
    const skill: ExamSkillKey = skillText.includes('nghe') || skillText.includes('listen')
      ? 'listening'
      : skillText.includes('đọc') || skillText.includes('read')
        ? 'reading'
        : skillText.includes('viết') || skillText.includes('writ')
          ? 'writing'
          : skillText.includes('nói') || skillText.includes('speak')
            ? 'speaking'
            : 'language';

    const content = textCells[1] || textCells[0];
    const knowledge = textCells[2] || 'Theo mẫu ma trận trường tải lên';
    const format: ExamQuestionFormat =
      skill === 'writing'
        ? content.toLowerCase().includes('viết lại')
          ? 'transformation'
          : 'essay'
        : skill === 'speaking'
          ? 'speaking'
          : 'mcq';

    // Heuristic extract NB, TH, VD, Points from trailing numeric columns
    const rec = nums.length >= 3 ? Math.min(20, Math.round(nums[0])) : 2;
    const comp = nums.length >= 3 ? Math.min(20, Math.round(nums[1])) : 2;
    const app = nums.length >= 3 ? Math.min(20, Math.round(nums[2])) : 1;
    const qTotal = Math.max(1, rec + comp + app);
    const ptsCandidate = nums.find((n, idx) => idx >= 3 && n > 0 && n <= 10);
    const points = ptsCandidate ?? ROUND2(qTotal * 0.25);

    parsedRows.push(
      recalculateMatrixRow(
        {
          id: `uploaded-row-${Date.now()}-${order}`,
          order: order++,
          skill,
          topic: textCells[0],
          testContent: content,
          knowledgeUnit: knowledge,
          questionFormat: format,
          recognitionCount: rec,
          comprehensionCount: comp,
          applicationCount: app,
          highApplicationCount: 0,
          questionCount: qTotal,
          scoringUnits: qTotal,
          points,
          percentage: ROUND2((points / 10) * 100),
          learningOutcome: `Đáp ứng yêu cầu cần đạt nội dung "${content}" theo mẫu ma trận của trường.`,
        },
        false,
        10,
      ),
    );
  }

  if (parsedRows.length === 0) {
    warnings.push(
      'Không nhận diện được bảng ma trận hợp lệ trong tệp tải lên. Giáo viên có thể dùng mẫu có sẵn và chỉnh sửa trực tiếp từng dòng.',
    );
  } else {
    warnings.push(
      `Đã nhập ${parsedRows.length} dòng từ mẫu "${file.name}". Vui lòng kiểm tra lại số câu và tổng điểm 10,0 trước khi sinh đề.`,
    );
  }

  return {rows: parsedRows, warnings};
}

export function getTextbookUnitsForScope(textbookId: string, grade: 10 | 11 | 12) {
  const book = DEFAULT_TEXTBOOKS.find((b) => b.id === textbookId);
  return book?.unitsByGrade[grade] || [];
}

export function getFormatLabel(format: ExamQuestionFormat, bilingual = false): string {
  const f = EXAM_FORMAT_LABELS[format];
  return bilingual ? `${f.vi} (${f.en})` : f.vi;
}
