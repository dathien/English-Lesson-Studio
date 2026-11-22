import JSZip from 'jszip';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type {
  ActivityType,
  Grade,
  LessonProject,
  ParsedDocumentDraft,
  QuestionItem,
  QuestionType,
  ReadingPassage,
  SkillCategory,
  Slide,
} from '../types/lesson';
import {
  DEFAULT_SPEAKING_RUBRIC,
  DEFAULT_WRITING_RUBRIC,
} from '../types/lesson';
import {ocrImagesWithAI, refineDocumentWithAI} from './aiService';

if (typeof pdfWorkerUrl === 'string') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Không thể đọc tệp ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBase64(dataUrl: string): {mimeType: string; data: string} {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return {mimeType: 'image/jpeg', data: dataUrl};
  }
  return {mimeType: match[1], data: match[2]};
}

/**
 * Extracts DOCX content preserving exact underlined runs (<w:u>) as <u>...</u>,
 * paragraphs, tables, and embedded images via JSZip + XML parsing with Mammoth fallback.
 */
export async function extractDocxWithUnderlines(file: File): Promise<{
  text: string;
  images: Array<{name: string; dataUrl: string}>;
  warnings: string[];
}> {
  const arrayBuffer = await file.arrayBuffer();
  const warnings: string[] = [];
  const images: Array<{name: string; dataUrl: string}> = [];

  try {
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Extract embedded images from word/media/
    const mediaFiles = Object.keys(zip.files).filter((name) =>
      /^word\/media\/.+\.(png|jpe?g|webp|gif)$/i.test(name),
    );
    for (const mediaPath of mediaFiles.slice(0, 8)) {
      const entry = zip.files[mediaPath];
      const base64 = await entry.async('base64');
      const ext = mediaPath.split('.').pop()?.toLowerCase() || 'png';
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
      images.push({
        name: mediaPath.split('/').pop() || 'image',
        dataUrl: `data:${mime};base64,${base64}`,
      });
    }

    const docXmlFile = zip.files['word/document.xml'];
    if (docXmlFile) {
      const xmlStr = await docXmlFile.async('string');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
      const paragraphs = Array.from(xmlDoc.getElementsByTagName('w:p'));

      const lines: string[] = [];
      for (const p of paragraphs) {
        const runs = Array.from(p.getElementsByTagName('w:r'));
        let line = '';
        let inUnderline = false;

        for (const r of runs) {
          const rPr = r.getElementsByTagName('w:rPr')[0];
          let isUnderlined = false;
          if (rPr) {
            const uNode = rPr.getElementsByTagName('w:u')[0];
            if (uNode) {
              const val = uNode.getAttribute('w:val');
              if (!val || val !== 'none') {
                isUnderlined = true;
              }
            }
          }

          let runText = '';
          const childNodes = Array.from(r.childNodes);
          for (const child of childNodes) {
            if (child.nodeName === 'w:t') {
              runText += child.textContent || '';
            } else if (child.nodeName === 'w:tab') {
              runText += '    ';
            } else if (child.nodeName === 'w:br') {
              runText += '\n';
            }
          }

          if (!runText) continue;

          if (isUnderlined && !inUnderline) {
            line += '<u>';
            inUnderline = true;
          } else if (!isUnderlined && inUnderline) {
            line += '</u>';
            inUnderline = false;
          }
          line += runText;
        }

        if (inUnderline) {
          line += '</u>';
        }

        // Clean accidental empty <u></u>
        const cleaned = line.replace(/<u>(\s*)<\/u>/g, '$1').trim();
        if (cleaned) {
          lines.push(cleaned);
        }
      }

      if (lines.length > 0) {
        return {text: lines.join('\n'), images, warnings};
      }
    }
  } catch {
    warnings.push('Không thể đọc XML gốc của DOCX, đã chuyển sang bộ trích xuất Mammoth.js.');
  }

  // Fallback to mammoth.js
  const result = await mammoth.extractRawText({arrayBuffer});
  return {
    text: result.value || '',
    images,
    warnings: [
      ...warnings,
      ...result.messages.slice(0, 3).map((m) => m.message),
    ],
  };
}

/**
 * Extracts text from PDF using PDF.js. If text layer is missing/sparse (scanned PDF),
 * renders pages to JPEG images so real Vision AI OCR can process them.
 */
export async function extractPdfContent(file: File): Promise<{
  text: string;
  isScanned: boolean;
  pageImages: Array<{name: string; dataUrl: string}>;
  pageCount: number;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({data: arrayBuffer});
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  const pageTexts: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let pageStr = '';

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = Array.isArray(item.transform) ? item.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 6) {
        pageStr += '\n';
      } else if (pageStr && !pageStr.endsWith(' ') && !pageStr.endsWith('\n')) {
        pageStr += ' ';
      }
      pageStr += item.str;
      if (y !== null) lastY = y;
    }
    pageTexts.push(pageStr.trim());
  }

  const combinedText = pageTexts.join('\n\n').trim();
  const isScanned = combinedText.replace(/\s+/g, '').length < pageCount * 25;

  const pageImages: Array<{name: string; dataUrl: string}> = [];
  if (isScanned) {
    const maxRender = Math.min(pageCount, 5);
    for (let i = 1; i <= maxRender; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({scale: 1.5});
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({canvasContext: ctx, viewport, canvas}).promise;
        pageImages.push({
          name: `${file.name} - Trang ${i}`,
          dataUrl: canvas.toDataURL('image/jpeg', 0.85),
        });
      }
    }
  }

  return {text: combinedText, isScanned, pageImages, pageCount};
}

/**
 * Rule-based local structural parser for English high-school worksheets/exams.
 * Works 100% offline with zero AI dependency.
 * Preserves intact reading passages, original question numbering, grouped questions,
 * and <u>...</u> underlined segments.
 */
export function parseStructuredEnglishText(
  rawText: string,
  options: {
    fileName?: string;
    grade: Grade;
    skillHint?: SkillCategory;
  },
): ParsedDocumentDraft {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const warnings: string[] = [];
  const passages: ReadingPassage[] = [];
  const questions: Array<QuestionItem & {passageIndex?: number}> = [];
  let title = options.fileName
    ? options.fileName.replace(/\.(docx|pdf|txt)$/i, '')
    : 'Bài giảng nhập từ tài liệu';
  let instructions = '';
  let transcript = '';

  // Extract explicit answer key block if present at the bottom
  const answerKeyMap = new Map<number, string>();
  const explanationMap = new Map<number, string>();
  const keySectionIdx = lines.findIndex((l) =>
    /^(ANSWER\s*KEY|KEYS?|ĐÁP\s*ÁN|BẢNG\s*ĐÁP\s*ÁN)\s*:?$/i.test(l),
  );

  const contentLines = keySectionIdx >= 0 ? lines.slice(0, keySectionIdx) : lines;
  if (keySectionIdx >= 0) {
    const keyLines = lines.slice(keySectionIdx + 1);
    for (const kl of keyLines) {
      // Match patterns like "1. A", "1-B", "1. C (giải thích...)"
      const multiMatches = Array.from(kl.matchAll(/(?:Question|Câu)?\s*(\d{1,3})\s*[.):\-–]\s*([A-D]|True|False|T|F|[^,;|]+)/gi));
      if (multiMatches.length > 0) {
        for (const m of multiMatches) {
          const num = Number(m[1]);
          const val = m[2].trim();
          answerKeyMap.set(num, val);
        }
      }
    }
  }

  let currentPassageIndex: number | undefined = undefined;
  let collectingPassage = false;
  let currentPassageParagraphs: string[] = [];
  let currentPassageTitle = '';
  let collectingTranscript = false;
  const transcriptLines: string[] = [];
  let currentQuestion: (QuestionItem & {passageIndex?: number}) | null = null;

  const flushPassage = () => {
    if (currentPassageParagraphs.length > 0) {
      passages.push({
        title: currentPassageTitle || `Đoạn đọc ${passages.length + 1}`,
        paragraphs: [...currentPassageParagraphs],
      });
      currentPassageIndex = passages.length - 1;
      currentPassageParagraphs = [];
      currentPassageTitle = '';
    }
    collectingPassage = false;
  };

  const flushQuestion = () => {
    if (!currentQuestion) return;
    if (!currentQuestion.correctAnswer && answerKeyMap.has(currentQuestion.number)) {
      currentQuestion.correctAnswer = answerKeyMap.get(currentQuestion.number) || '';
    }
    if (!currentQuestion.explanation && explanationMap.has(currentQuestion.number)) {
      currentQuestion.explanation = explanationMap.get(currentQuestion.number);
    }

    // Determine exact question type cleanly without forcing everything to MCQ
    const hasUnderlinedOption =
      currentQuestion.options?.some((o) => o.text.includes('<u>')) ||
      currentQuestion.prompt.includes('<u>');

    if (hasUnderlinedOption && currentQuestion.options && currentQuestion.options.length >= 2) {
      currentQuestion.type = 'pronunciation_underlined';
    } else if (currentQuestion.options && currentQuestion.options.length === 2) {
      const optTexts = currentQuestion.options.map((o) => o.text.toLowerCase());
      if (optTexts.includes('true') && optTexts.includes('false')) {
        currentQuestion.type = 'true_false';
      }
    } else if (!currentQuestion.options || currentQuestion.options.length === 0) {
      if (/_{2,}|\(\.\.\.\)|\[\s*\]/.test(currentQuestion.prompt)) {
        currentQuestion.type = 'gap_fill';
      } else if (/\s\/\s/.test(currentQuestion.prompt)) {
        currentQuestion.type = 'word_order';
      } else if (/rewrite|transform|viết lại câu|so that it means/i.test(currentQuestion.prompt + ' ' + instructions)) {
        currentQuestion.type = 'transformation';
      } else if (/true\s*\/\s*false|t\s*\/\s*f/i.test(currentQuestion.prompt + ' ' + instructions)) {
        currentQuestion.type = 'true_false';
        currentQuestion.options = [
          {id: `${currentQuestion.id}-t`, label: 'True', text: 'True'},
          {id: `${currentQuestion.id}-f`, label: 'False', text: 'False'},
        ];
      } else {
        currentQuestion.type = 'short_answer';
      }
    }

    if (!currentQuestion.correctAnswer) {
      currentQuestion.uncertain = true;
    }

    questions.push(currentQuestion);
    currentQuestion = null;
  };

  const inlineOptionRegex = /\b([A-D])\.\s+([\s\S]*?)(?=(?:\s+[A-D]\.\s+)|$)/g;

  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i];

    // First prominent short line as title
    if (i === 0 && line.length < 110 && !/^(Question|Câu|\d+\.)/i.test(line)) {
      title = line.replace(/<\/?u>/g, '');
      continue;
    }

    // Detect Transcript header
    if (/^(TRANSCRIPT|AUDIO\s*SCRIPT|TAPESCRIPT|BÀI\s*NGHE)\s*:?/i.test(line)) {
      flushPassage();
      flushQuestion();
      collectingTranscript = true;
      const rest = line.replace(/^(TRANSCRIPT|AUDIO\s*SCRIPT|TAPESCRIPT|BÀI\s*NGHE)\s*:?\s*/i, '').trim();
      if (rest) transcriptLines.push(rest);
      continue;
    }

    // Detect Instruction lines
    if (
      /^(Read the (following )?passage|Mark the letter|Choose the (best|correct)|Listen and|Complete the|Rewrite the|Find the mistake|Put the words|Part\s+[IVX0-9]+|Exercise\s+\d+|Task\s+\d+|I{1,3}\.|[IVX]+\.)/i.test(
        line,
      )
    ) {
      if (collectingTranscript && /^(Question|Câu|1\.)/i.test(line)) {
        collectingTranscript = false;
      }
      flushPassage();
      flushQuestion();
      instructions = instructions ? `${instructions}\n${line}` : line;
      if (/read the (following )?passage|đọc đoạn văn/i.test(line)) {
        collectingPassage = true;
        collectingTranscript = false;
      }
      continue;
    }

    // Detect Question start: "Question 1:", "Câu 1.", "1.", "1)"
    const qMatch = line.match(/^(?:Question|Câu)?\s*(\d{1,3})\s*[.):]\s*(.*)$/i);
    if (qMatch && Number(qMatch[1]) > 0 && Number(qMatch[1]) <= 200) {
      const nextText = qMatch[2].trim();
      // Avoid misclassifying years like "2024. ..."
      if (Number(qMatch[1]) <= 120) {
        if (collectingPassage) flushPassage();
        if (collectingTranscript) collectingTranscript = false;
        flushQuestion();

        const qNum = Number(qMatch[1]);
        const inlineOpts = Array.from(nextText.matchAll(inlineOptionRegex));
        let promptText = nextText;
        let opts: QuestionItem['options'] = [];

        if (inlineOpts.length >= 2) {
          const firstOptPos = nextText.search(/\bA\.\s+/);
          if (firstOptPos >= 0) {
            promptText = nextText.slice(0, firstOptPos).trim();
          }
          opts = inlineOpts.map((m, oi) => ({
            id: `q-${qNum}-opt-${oi}`,
            label: m[1].toUpperCase(),
            text: m[2].trim(),
          }));
        }

        currentQuestion = {
          id: `doc-q-${qNum}-${Date.now()}-${i}`,
          number: qNum,
          type: opts.length >= 2 ? 'mcq' : 'short_answer',
          prompt: promptText || `Câu hỏi số ${qNum}`,
          options: opts,
          correctAnswer: '',
          passageIndex: currentPassageIndex,
          cognitiveLevel: 'comprehension',
        };
        continue;
      }
    }

    // Detect Answer / Explanation inline under a question
    const ansInline = line.match(/^(?:Answer|Key|Đáp án)\s*:\s*(.+)$/i);
    if (ansInline && currentQuestion) {
      currentQuestion.correctAnswer = ansInline[1].trim();
      continue;
    }
    const expInline = line.match(/^(?:Explanation|Giải thích|Hướng dẫn)\s*:\s*(.+)$/i);
    if (expInline && currentQuestion) {
      currentQuestion.explanation = expInline[1].trim();
      continue;
    }

    // Detect Option lines: "A. ...", "B. ...", or "A. ... B. ... C. ... D. ..."
    if (currentQuestion && /^[A-D][.)]\s+/.test(line)) {
      const multi = Array.from(line.matchAll(/\b([A-D])[.)]\s+([\s\S]*?)(?=(?:\s+[A-D][.)]\s+)|$)/g));
      if (multi.length > 0) {
        currentQuestion.options = currentQuestion.options || [];
        for (const m of multi) {
          currentQuestion.options.push({
            id: `${currentQuestion.id}-opt-${currentQuestion.options.length}`,
            label: m[1].toUpperCase(),
            text: m[2].trim(),
          });
        }
        if (currentQuestion.options.length >= 2) {
          currentQuestion.type = 'mcq';
        }
        continue;
      }
    }

    if (collectingTranscript) {
      transcriptLines.push(line);
      continue;
    }

    // If inside a reading passage OR a long paragraph (> 160 chars) before questions
    if (collectingPassage || (!currentQuestion && line.length >= 160)) {
      collectingPassage = true;
      currentPassageParagraphs.push(line);
      continue;
    }

    // Append continuation text to current question prompt
    if (currentQuestion && (!currentQuestion.options || currentQuestion.options.length === 0)) {
      currentQuestion.prompt = `${currentQuestion.prompt} ${line}`.trim();
    } else if (collectingPassage) {
      currentPassageParagraphs.push(line);
    }
  }

  flushPassage();
  flushQuestion();

  transcript = transcriptLines.join('\n');

  // Auto-detect primary skill if not forced
  let detectedSkill: SkillCategory = options.skillHint || 'reading';
  if (!options.skillHint) {
    if (transcript.length > 40) {
      detectedSkill = 'listening';
    } else if (questions.some((q) => q.type === 'pronunciation_underlined')) {
      detectedSkill = 'pronunciation';
    } else if (passages.length > 0) {
      detectedSkill = 'reading';
    } else if (questions.some((q) => q.type === 'transformation' || q.type === 'word_order')) {
      detectedSkill = 'writing';
    } else {
      detectedSkill = 'grammar';
    }
  }

  if (questions.length === 0 && passages.length === 0) {
    warnings.push(
      'Bộ phân tích cục bộ không tìm thấy cấu trúc câu hỏi chuẩn (ví dụ: "1.", "Question 1:", "A. B. C. D."). Bạn có thể chỉnh sửa trực tiếp ở Bước 3 hoặc dùng AI hỗ trợ nếu đang trực tuyến.',
    );
  }
  const missingKeyCount = questions.filter((q) => !q.correctAnswer).length;
  if (missingKeyCount > 0) {
    warnings.push(
      `Có ${missingKeyCount} câu hỏi chưa tìm thấy đáp án trong tài liệu gốc (được đánh dấu "Cần kiểm tra"). Giáo viên hãy kiểm tra và điền đáp án ở Bước 3.`,
    );
  }

  return {
    sourceFiles: options.fileName ? [options.fileName] : ['Văn bản dán trực tiếp'],
    title,
    grade: options.grade,
    skill: detectedSkill,
    instructions,
    passages,
    transcript,
    questions,
    extractedImages: [],
    warnings,
    usedAI: false,
  };
}

/**
 * Main entry point for uploaded files (DOCX, PDF text, PDF scan, multiple images).
 */
export async function processUploadedFiles(
  files: File[],
  grade: Grade,
  skillHint?: SkillCategory,
  useAIRefinement?: boolean,
): Promise<ParsedDocumentDraft> {
  const imageFiles = files.filter((f) => /^image\/(jpeg|png|webp)$/i.test(f.type));
  const docxFiles = files.filter((f) => /\.docx$/i.test(f.name));
  const pdfFiles = files.filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');

  const sourceFiles = files.map((f) => f.name);

  // Case 1: Multiple images (JPG/PNG/WebP)
  if (imageFiles.length > 0 && docxFiles.length === 0 && pdfFiles.length === 0) {
    const dataUrls = await Promise.all(imageFiles.map((f) => fileToDataUrl(f)));
    const extractedImages = imageFiles.map((f, idx) => ({name: f.name, dataUrl: dataUrls[idx]}));
    const payloadImages = dataUrls.map((url, idx) => ({
      ...dataUrlToBase64(url),
      name: imageFiles[idx].name,
    }));

    const aiRes = await ocrImagesWithAI(payloadImages, grade, skillHint);
    if (aiRes.ok && aiRes.data) {
      return mapAIDataToDraft(aiRes.data, {
        sourceFiles,
        grade,
        fallbackSkill: skillHint || 'reading',
        extractedImages,
      });
    }

    return {
      sourceFiles,
      title: imageFiles[0].name.replace(/\.[^.]+$/, ''),
      grade,
      skill: skillHint || 'speaking',
      instructions: '',
      passages: [],
      transcript: '',
      questions: [],
      extractedImages,
      warnings: [
        aiRes.error ||
          'Dịch vụ AI thị giác (OCR) không khả dụng. Hệ thống đã giữ nguyên hình ảnh gốc để bạn chèn trực tiếp vào slide hoặc tự nhập câu hỏi ở Bước 3.',
      ],
      usedAI: false,
    };
  }

  // Case 2: DOCX and/or PDF
  let combinedText = '';
  const allImages: Array<{name: string; dataUrl: string}> = [];
  const allWarnings: string[] = [];
  const scannedPageImages: Array<{name: string; dataUrl: string}> = [];

  for (const df of docxFiles) {
    const res = await extractDocxWithUnderlines(df);
    combinedText += `\n\n${res.text}`;
    allImages.push(...res.images);
    allWarnings.push(...res.warnings);
  }

  for (const pf of pdfFiles) {
    const res = await extractPdfContent(pf);
    if (res.isScanned) {
      allWarnings.push(
        `Tệp "${pf.name}" là PDF dạng scan/ảnh (${res.pageCount} trang, không có lớp văn bản chọn được).`,
      );
      scannedPageImages.push(...res.pageImages);
      allImages.push(...res.pageImages);
    } else {
      combinedText += `\n\n${res.text}`;
    }
  }

  for (const imgFile of imageFiles) {
    const url = await fileToDataUrl(imgFile);
    allImages.push({name: imgFile.name, dataUrl: url});
    scannedPageImages.push({name: imgFile.name, dataUrl: url});
  }

  // If primarily scanned PDF pages, call Vision AI OCR
  if (scannedPageImages.length > 0 && combinedText.trim().length < 60) {
    const aiRes = await ocrImagesWithAI(
      scannedPageImages.map((img) => ({...dataUrlToBase64(img.dataUrl), name: img.name})),
      grade,
      skillHint,
    );
    if (aiRes.ok && aiRes.data) {
      const draft = mapAIDataToDraft(aiRes.data, {
        sourceFiles,
        grade,
        fallbackSkill: skillHint || 'reading',
        extractedImages: allImages,
      });
      draft.warnings = [...allWarnings, ...draft.warnings];
      return draft;
    }
    return {
      sourceFiles,
      title: sourceFiles[0].replace(/\.[^.]+$/, ''),
      grade,
      skill: skillHint || 'reading',
      instructions: '',
      passages: [],
      transcript: '',
      questions: [],
      extractedImages: allImages,
      warnings: [
        ...allWarnings,
        aiRes.error ||
          'Không thể chạy OCR tự động cho PDF scan khi dịch vụ AI không khả dụng. Ảnh các trang đã được trích xuất để bạn đối chiếu và nhập trực tiếp.',
      ],
      usedAI: false,
    };
  }

  // Optional AI structural refinement on extracted text
  if (useAIRefinement && combinedText.trim().length >= 40) {
    const aiRes = await refineDocumentWithAI(combinedText, grade, skillHint);
    if (aiRes.ok && aiRes.data) {
      const draft = mapAIDataToDraft(aiRes.data, {
        sourceFiles,
        grade,
        fallbackSkill: skillHint || 'reading',
        extractedImages: allImages,
      });
      draft.warnings = [...allWarnings, ...draft.warnings];
      return draft;
    }
    if (aiRes.error) {
      allWarnings.push(aiRes.error);
    }
  }

  // Local rule-based parser (always works offline)
  const localDraft = parseStructuredEnglishText(combinedText, {
    fileName: sourceFiles[0],
    grade,
    skillHint,
  });
  localDraft.sourceFiles = sourceFiles;
  localDraft.extractedImages = allImages;
  localDraft.warnings = [...allWarnings, ...localDraft.warnings];
  return localDraft;
}

function mapAIDataToDraft(
  data: NonNullable<Awaited<ReturnType<typeof ocrImagesWithAI>>['data']>,
  ctx: {
    sourceFiles: string[];
    grade: Grade;
    fallbackSkill: SkillCategory;
    extractedImages: Array<{name: string; dataUrl: string}>;
  },
): ParsedDocumentDraft {
  const validSkills: SkillCategory[] = [
    'listening',
    'speaking',
    'reading',
    'writing',
    'vocabulary',
    'grammar',
    'pronunciation',
    'review',
  ];
  const rawSkill = (data.detectedSkill || '').toLowerCase() as SkillCategory;
  const skill = validSkills.includes(rawSkill) ? rawSkill : ctx.fallbackSkill;

  const passages: ReadingPassage[] = (data.passages || [])
    .filter((p) => Array.isArray(p.paragraphs) && p.paragraphs.length > 0)
    .map((p, idx) => ({
      title: p.title || `Đoạn đọc ${idx + 1}`,
      paragraphs: p.paragraphs,
    }));

  const questions: Array<QuestionItem & {passageIndex?: number}> = (data.questions || []).map(
    (q, idx) => ({
      id: `ai-doc-q-${Date.now()}-${idx}`,
      number: q.number || idx + 1,
      type: (q.type as QuestionType) || (q.options && q.options.length >= 2 ? 'mcq' : 'short_answer'),
      prompt: q.prompt || '',
      options: q.options?.map((o, oi) => ({
        id: `opt-${idx}-${oi}`,
        label: o.label || String.fromCharCode(65 + oi),
        text: o.text || '',
      })),
      correctAnswer: q.correctAnswer || '',
      explanation: q.explanation || '',
      passageIndex: typeof q.passageIndex === 'number' ? q.passageIndex : undefined,
      uncertain: Boolean(q.uncertain || !q.correctAnswer),
      cognitiveLevel: 'comprehension',
    }),
  );

  return {
    sourceFiles: ctx.sourceFiles,
    title: data.title || ctx.sourceFiles[0]?.replace(/\.[^.]+$/, '') || 'Bài giảng từ tài liệu',
    grade: ctx.grade,
    skill,
    instructions: data.instructions || '',
    passages,
    transcript: data.transcript || '',
    questions,
    extractedImages: ctx.extractedImages,
    warnings: data.warnings || [],
    usedAI: true,
  };
}

/**
 * Step 4: Converts a teacher-verified ParsedDocumentDraft into an interactive LessonProject.
 * Automatically picks appropriate slide layouts without forcing every question into MCQ.
 */
export function convertDraftToLesson(draft: ParsedDocumentDraft): LessonProject {
  const now = Date.now();
  const slides: Slide[] = [];

  // Slide 1: Cover Slide
  slides.push({
    id: `slide-cover-${now}`,
    order: 0,
    title: draft.title || 'Bài giảng Tiếng Anh THPT',
    subtitle: `Lớp ${draft.grade} · Nguồn: ${draft.sourceFiles.join(', ')}`,
    skill: draft.skill,
    activityType: 'title_slide',
    instruction: draft.instructions || 'Mục tiêu bài học và hoạt động tương tác trên lớp.',
    bullets: [
      `Khối lớp: THPT Lớp ${draft.grade} (Chương trình GDPT 2018)`,
      `Số câu hỏi trích xuất: ${draft.questions.length} câu`,
      draft.passages.length > 0
        ? `Bao gồm ${draft.passages.length} bài đọc giữ nguyên đoạn văn gốc`
        : draft.transcript
          ? 'Bao gồm nội dung Transcript bài nghe'
          : 'Tối ưu bố cục trình chiếu 16:9',
    ],
    imageUrl: draft.extractedImages[0]?.dataUrl,
    teacherNotes: 'Giới thiệu nhanh mục tiêu tiết học và yêu cầu làm bài trước khi chuyển sang các slide hoạt động.',
  });

  // Group reading passage slides (keeping passage linked to its grouped questions!)
  const usedQuestionIds = new Set<string>();
  draft.passages.forEach((passage, pIdx) => {
    const linkedQuestions = draft.questions.filter((q) => q.passageIndex === pIdx);
    linkedQuestions.forEach((q) => usedQuestionIds.add(q.id));

    const chunkSize = 5;
    if (linkedQuestions.length === 0) {
      slides.push({
        id: `slide-passage-${pIdx}-${now}`,
        order: slides.length,
        title: passage.title || `Reading Passage ${pIdx + 1}`,
        skill: 'reading',
        activityType: 'reading_detailed',
        instruction: draft.instructions || 'Read the passage carefully.',
        passage,
        teacherNotes: 'Cho học sinh đọc lướt nắm ý chính trước khi làm câu hỏi chi tiết.',
      });
    } else {
      for (let start = 0; start < linkedQuestions.length; start += chunkSize) {
        const chunk = linkedQuestions.slice(start, start + chunkSize);
        slides.push({
          id: `slide-reading-${pIdx}-${start}-${now}`,
          order: slides.length,
          title:
            linkedQuestions.length > chunkSize
              ? `${passage.title || 'Reading Comprehension'} (Câu ${chunk[0].number}–${chunk[chunk.length - 1].number})`
              : passage.title || 'Reading Comprehension',
          skill: 'reading',
          activityType: inferActivityType('reading', chunk),
          instruction: draft.instructions || 'Read the passage and answer the questions.',
          passage,
          questions: chunk,
          teacherNotes: 'Giữ nguyên bài đọc bên trái để học sinh đối chiếu dẫn chứng trực tiếp.',
        });
      }
    }
  });

  // Listening transcript slide if present
  const remainingQuestions = draft.questions.filter((q) => !usedQuestionIds.has(q.id));
  if (draft.transcript.trim().length > 0) {
    slides.push({
      id: `slide-listening-${now}`,
      order: slides.length,
      title: 'Listening Comprehension',
      skill: 'listening',
      activityType: inferActivityType('listening', remainingQuestions),
      instruction: draft.instructions || 'Listen carefully and complete the task.',
      audio: {
        transcript: draft.transcript,
        showTranscriptDefault: false,
        timestamps: [],
      },
      questions: remainingQuestions.length > 0 ? remainingQuestions : undefined,
      teacherNotes: 'Giáo viên có thể tải tệp MP3/WAV và đánh dấu mốc thời gian cho từng câu hỏi trong Trình biên tập.',
    });
    remainingQuestions.forEach((q) => usedQuestionIds.add(q.id));
  }

  // Remaining standalone questions grouped by type (never forcing everything into MCQ)
  const ungrouped = draft.questions.filter((q) => !usedQuestionIds.has(q.id));
  if (ungrouped.length > 0) {
    const chunkSize = 4;
    for (let start = 0; start < ungrouped.length; start += chunkSize) {
      const chunk = ungrouped.slice(start, start + chunkSize);
      const slideSkill: SkillCategory = chunk.some((q) => q.type === 'pronunciation_underlined')
        ? 'pronunciation'
        : draft.skill;
      slides.push({
        id: `slide-qgroup-${start}-${now}`,
        order: slides.length,
        title: `Hoạt động luyện tập (Câu ${chunk[0].number}–${chunk[chunk.length - 1].number})`,
        skill: slideSkill,
        activityType: inferActivityType(slideSkill, chunk),
        instruction: draft.instructions || 'Complete the following questions.',
        questions: chunk,
        teacherNotes: 'Nhấn "Show Answer" sau khi học sinh hoàn thành để kiểm soát nhịp độ lớp học.',
      });
    }
  }

  // If user uploaded pictures with no extracted questions (e.g., Picture Description / Writing from Pictures)
  if (draft.questions.length === 0 && draft.passages.length === 0 && draft.extractedImages.length > 0) {
    draft.extractedImages.forEach((img, idx) => {
      if (draft.skill === 'writing') {
        slides.push({
          id: `slide-img-writing-${idx}-${now}`,
          order: slides.length,
          title: `Writing from Picture ${idx + 1}`,
          skill: 'writing',
          activityType: 'writing_picture',
          instruction: 'Observe the picture carefully and write a coherent paragraph (120–150 words).',
          imageUrl: img.dataUrl,
          imageCaption: img.name,
          writingTask: {
            prompt: 'Describe what is happening in the picture and share your thoughts on the topic.',
            minWords: 120,
            maxWords: 160,
            outlineHints: [
              'Topic sentence: Introduce the scene and main subject.',
              'Supporting details: Describe actions, setting, and key elements.',
              'Conclusion: Give a brief personal reflection or message.',
            ],
            usefulExpressions: ['In the foreground/background...', 'It is evident that...', 'Overall, this scene highlights...'],
            rubricCriteria: DEFAULT_WRITING_RUBRIC,
          },
        });
      } else {
        slides.push({
          id: `slide-img-speaking-${idx}-${now}`,
          order: slides.length,
          title: `Picture Description ${idx + 1}`,
          skill: 'speaking',
          activityType: 'speaking_picture',
          instruction: 'Work in pairs. Describe the picture and discuss the guiding questions.',
          imageUrl: img.dataUrl,
          imageCaption: img.name,
          speakingTask: {
            prompt: 'Describe the main activity in the image and explain why it matters to high school students.',
            cues: ['Who are the people in the picture?', 'What are they doing?', 'How do you feel about this activity?'],
            rubricCriteria: DEFAULT_SPEAKING_RUBRIC,
          },
        });
      }
    });
  }

  return {
    id: `lesson-${now}-${Math.random().toString(36).slice(2, 7)}`,
    title: draft.title || 'Bài giảng mới',
    grade: draft.grade,
    skill: draft.skill,
    topic: draft.title || 'Chủ đề nhập từ tài liệu',
    description: `Bài trình chiếu được chuyển đổi từ ${draft.sourceFiles.join(', ')} (${slides.length} slide).`,
    curriculumNote: `Chương trình GDPT 2018 · Tiếng Anh Lớp ${draft.grade}`,
    isSample: false,
    createdAt: now,
    updatedAt: now,
    themeId: 'light_classroom',
    slides,
  };
}

function inferActivityType(skill: SkillCategory, questions: QuestionItem[]): ActivityType {
  const firstType = questions[0]?.type;
  if (firstType === 'pronunciation_underlined') return 'pron_vowels_consonants';
  if (skill === 'reading') {
    if (firstType === 'true_false') return 'reading_tf';
    if (firstType === 'gap_fill') return 'reading_cloze';
    if (firstType === 'matching') return 'reading_matching_info';
    return 'reading_mcq';
  }
  if (skill === 'listening') {
    if (firstType === 'true_false') return 'listening_tf';
    if (firstType === 'gap_fill') return 'listening_gap';
    if (firstType === 'ordering') return 'listening_ordering';
    if (firstType === 'matching') return 'listening_matching';
    return 'listening_mcq';
  }
  if (skill === 'writing') {
    if (firstType === 'word_order') return 'writing_word_order';
    if (firstType === 'transformation') return 'writing_transformation';
    return 'writing_guided';
  }
  if (skill === 'grammar') {
    if (firstType === 'error_correction') return 'grammar_error';
    if (firstType === 'gap_fill') return 'grammar_gap';
    if (firstType === 'transformation') return 'grammar_transformation';
    return 'grammar_mcq';
  }
  if (skill === 'vocabulary') {
    if (firstType === 'matching') return 'vocab_matching';
    return 'vocab_context';
  }
  return 'review_mixed';
}
