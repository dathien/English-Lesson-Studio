import JSZip from 'jszip';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type {
  ActivityType,
  EducationLevel,
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
  EDUCATION_LEVEL_SHORT,
  getEducationLevelFromGrade,
} from '../types/lesson';
import {ocrImagesWithAI, refineDocumentWithAI} from './aiService';

if (typeof pdfWorkerUrl === 'string') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export interface GradeDetectionResult {
  detectedGrade: Grade | null;
  detectedLevel: EducationLevel | null;
  confidence: 'high' | 'medium' | 'none';
  evidence: string;
  needsConfirmation: boolean;
}

function toValidGrade(num: number): Grade | null {
  if (Number.isInteger(num) && num >= 1 && num <= 12) {
    return num as Grade;
  }
  return null;
}

/**
 * Intelligently detects grade (1–12) and education level (Primary / Secondary / High School)
 * from explicit textual or filename evidence. Never fabricates or asserts a grade when
 * evidence is insufficient — sets detectedGrade = null and needsConfirmation = true instead.
 */
export function detectGradeAndLevelFromText(
  rawText: string,
  fileName?: string,
): GradeDetectionResult {
  const headerSample = `${fileName || ''}\n${rawText.slice(0, 2600)}`;
  const cleaned = headerSample.replace(/<\/?u>/gi, '');

  // 1. High-confidence explicit grade patterns (Vietnamese & English textbooks / headers)
  const explicitPatterns: Array<{regex: RegExp; label: string}> = [
    {regex: /\b(?:Tiếng\s*Anh|English)\s*(?:lớp\s*)?(1[0-2]|[1-9])\b/i, label: 'Tiêu đề môn Tiếng Anh'},
    {regex: /\b(?:Grade|Lớp|Khối)\s*(1[0-2]|[1-9])(?![0-9])\b/i, label: 'Nhãn khối lớp'},
    {regex: /\bGlobal\s+Success\s*(1[0-2]|[3-9])\b/i, label: 'Bộ sách Global Success'},
    {regex: /\bi-?Learn\s+Smart\s+Start\s*([1-5])\b/i, label: 'Bộ sách i-Learn Smart Start'},
    {regex: /\bi-?Learn\s+Smart\s+World\s*([6-9])\b/i, label: 'Bộ sách i-Learn Smart World'},
    {regex: /\bFamily\s+and\s+Friends\s*(?:National\s+Edition\s*)?([1-5])\b/i, label: 'Bộ sách Family and Friends'},
    {regex: /\bFriends\s+Plus\s*([6-9])\b/i, label: 'Bộ sách Friends Plus'},
    {regex: /\bFriends\s+Global\s*(1[0-2])\b/i, label: 'Bộ sách Friends Global'},
    {regex: /\bBright\s*(1[0-2])\b/i, label: 'Bộ sách Bright'},
    {regex: /\bRight\s+On!?\s*([6-9])\b/i, label: 'Bộ sách Right On'},
    {regex: /\bWonderful\s+World\s*([1-5])\b/i, label: 'Bộ sách Wonderful World'},
    {regex: /\b(?:TA|G|Lop|Grade)[_\-\s]?(1[0-2]|[1-9])(?![0-9])\b/i, label: 'Tên tệp / mã lớp'},
  ];

  for (const {regex, label} of explicitPatterns) {
    const match = cleaned.match(regex);
    if (match) {
      const g = toValidGrade(Number(match[1]));
      if (g) {
        const level = getEducationLevelFromGrade(g);
        return {
          detectedGrade: g,
          detectedLevel: level,
          confidence: 'high',
          evidence: `Phát hiện "${match[0].trim()}" (${label} · ${EDUCATION_LEVEL_SHORT[level]} Lớp ${g}).`,
          needsConfirmation: false,
        };
      }
    }
  }

  // 2. Medium-confidence level-only cues (cannot assert exact grade number -> ask teacher to confirm)
  const primaryCue = cleaned.match(
    /\b(Tiểu\s*học|Primary\s+School|Look,\s*listen\s*and\s*repeat|Point\s+and\s+say|Let's\s+chant|Listen\s+and\s+tick|Listen\s+and\s+number|Color\s+the\s+picture|i-?Learn\s+Smart\s+Start|Family\s+and\s+Friends)\b/i,
  );
  if (primaryCue) {
    return {
      detectedGrade: null,
      detectedLevel: 'primary',
      confidence: 'medium',
      evidence: `Có dấu hiệu cấp Tiểu học ("${primaryCue[0].trim()}"), nhưng chưa đủ căn cứ xác định chính xác lớp 1–5. Vui lòng chọn khối lớp.`,
      needsConfirmation: true,
    };
  }

  const secondaryCue = cleaned.match(
    /\b(THCS|Trung\s*học\s*cơ\s*sở|Secondary\s+School|Junior\s+High|ôn\s*thi\s*vào\s*(?:lớp\s*)?10|i-?Learn\s+Smart\s+World|Friends\s+Plus)\b/i,
  );
  if (secondaryCue) {
    return {
      detectedGrade: null,
      detectedLevel: 'secondary',
      confidence: 'medium',
      evidence: `Có dấu hiệu cấp THCS ("${secondaryCue[0].trim()}"), nhưng chưa đủ căn cứ xác định chính xác lớp 6–9. Vui lòng chọn khối lớp.`,
      needsConfirmation: true,
    };
  }

  const highSchoolCue = cleaned.match(
    /\b(THPT|Trung\s*học\s*phổ\s*thông|High\s+School|Tốt\s*nghiệp\s*THPT|Đề\s*minh\s*họa|Friends\s+Global)\b/i,
  );
  if (highSchoolCue) {
    return {
      detectedGrade: null,
      detectedLevel: 'high_school',
      confidence: 'medium',
      evidence: `Có dấu hiệu cấp THPT ("${highSchoolCue[0].trim()}"), nhưng chưa đủ căn cứ xác định chính xác lớp 10–12. Vui lòng chọn khối lớp.`,
      needsConfirmation: true,
    };
  }

  // 3. No clear evidence -> never guess or assert a grade
  return {
    detectedGrade: null,
    detectedLevel: null,
    confidence: 'none',
    evidence: 'Chưa đủ căn cứ trong tài liệu để tự xác định khối lớp. Giáo viên vui lòng chọn cấp học và khối lớp phù hợp.',
    needsConfirmation: true,
  };
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

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Fallback XML paragraph/underline extractor when DOMParser is unavailable (e.g., Node verification).
 */
function extractLinesFromDocxXmlRegex(xmlStr: string): string[] {
  const lines: string[] = [];
  const pMatches = xmlStr.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) || [];
  for (const pXml of pMatches) {
    const rMatches = pXml.match(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g) || [];
    let line = '';
    let inUnderline = false;

    for (const rXml of rMatches) {
      const hasUnderline = /<w:u\b(?![^>]*w:val="none")/i.test(rXml);
      let runText = '';
      const tokenMatches = rXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/g);
      for (const tok of tokenMatches) {
        if (tok[1] !== undefined) {
          runText += decodeXmlEntities(tok[1]);
        } else if (tok[0].startsWith('<w:tab')) {
          runText += '    ';
        } else if (tok[0].startsWith('<w:br')) {
          runText += '\n';
        }
      }
      if (!runText) continue;

      if (hasUnderline && !inUnderline) {
        line += '<u>';
        inUnderline = true;
      } else if (!hasUnderline && inUnderline) {
        line += '</u>';
        inUnderline = false;
      }
      line += runText;
    }

    if (inUnderline) line += '</u>';
    const cleaned = line.replace(/<u>(\s*)<\/u>/g, '$1').trim();
    if (cleaned) lines.push(cleaned);
  }
  return lines;
}

/**
 * Extracts DOCX content preserving exact underlined runs (<w:u>) as <u>...</u>,
 * paragraphs, tables, and up to 20 embedded images via JSZip + XML parsing with Mammoth fallback.
 */
export async function extractDocxWithUnderlines(file: File | {name: string; arrayBuffer: () => Promise<ArrayBuffer>}): Promise<{
  text: string;
  images: Array<{name: string; dataUrl: string}>;
  warnings: string[];
}> {
  const arrayBuffer = await file.arrayBuffer();
  const warnings: string[] = [];
  const images: Array<{name: string; dataUrl: string}> = [];

  try {
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Extract embedded images from word/media/ (up to 20 images for rich multi-page primary/secondary worksheets)
    const mediaFiles = Object.keys(zip.files)
      .filter((name) => /^word\/media\/.+\.(png|jpe?g|webp|gif)$/i.test(name))
      .sort();
    for (const mediaPath of mediaFiles.slice(0, 20)) {
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

      if (typeof DOMParser !== 'undefined') {
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

          const cleaned = line.replace(/<u>(\s*)<\/u>/g, '$1').trim();
          if (cleaned) {
            lines.push(cleaned);
          }
        }

        if (lines.length > 0) {
          return {text: lines.join('\n'), images, warnings};
        }
      } else {
        const lines = extractLinesFromDocxXmlRegex(xmlStr);
        if (lines.length > 0) {
          return {text: lines.join('\n'), images, warnings};
        }
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
 * Extracts text from multi-page PDF using PDF.js. If text layer is missing/sparse (scanned PDF),
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
  if (isScanned && typeof document !== 'undefined') {
    const maxRender = Math.min(pageCount, 8);
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
 * Rule-based local structural parser for English worksheets/exams across Grades 1–12
 * (Primary, Secondary, High School). Works 100% offline with zero AI dependency.
 * Preserves original wording, intact reading passages, original question numbering,
 * grouped questions, matching/ordering items, and <u>...</u> underlined segments.
 */
export function parseStructuredEnglishText(
  rawText: string,
  options: {
    fileName?: string;
    grade: Grade;
    gradeManuallyLocked?: boolean;
    skillHint?: SkillCategory;
    pageCount?: number;
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

  // Smart Grade & Education Level Detection (honest, never guesses without evidence)
  const gradeDetection = detectGradeAndLevelFromText(rawText, options.fileName);
  const resolvedGrade: Grade = options.gradeManuallyLocked
    ? options.grade
    : gradeDetection.detectedGrade ?? options.grade;
  const resolvedLevel: EducationLevel = options.gradeManuallyLocked
    ? getEducationLevelFromGrade(options.grade)
    : gradeDetection.detectedLevel ?? getEducationLevelFromGrade(resolvedGrade);
  const gradeNeedsConfirmation =
    !options.gradeManuallyLocked &&
    (gradeDetection.needsConfirmation ||
      (gradeDetection.detectedGrade !== null && gradeDetection.detectedGrade !== options.grade));

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
      const multiMatches = Array.from(
        kl.matchAll(/(?:Question|Câu)?\s*(\d{1,3})\s*[.):\-–]\s*([A-D]|True|False|T|F|[^,;|]+)/gi),
      );
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
  let currentSectionInstruction = '';
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

    const contextInstr = `${currentQuestion.prompt} ${currentSectionInstruction} ${instructions}`;
    const hasUnderlinedOption =
      currentQuestion.options?.some((o) => o.text.includes('<u>')) ||
      currentQuestion.prompt.includes('<u>');

    if (hasUnderlinedOption && currentQuestion.options && currentQuestion.options.length >= 2) {
      currentQuestion.type = 'pronunciation_underlined';
    } else if (currentQuestion.matchingPairs && currentQuestion.matchingPairs.length >= 2) {
      currentQuestion.type = 'matching';
    } else if (currentQuestion.options && currentQuestion.options.length === 2) {
      const optTexts = currentQuestion.options.map((o) => o.text.toLowerCase());
      if (
        (optTexts.includes('true') && optTexts.includes('false')) ||
        (optTexts.includes('yes') && optTexts.includes('no'))
      ) {
        currentQuestion.type = 'true_false';
      }
    } else if (!currentQuestion.options || currentQuestion.options.length === 0) {
      if (/\s\/\s/.test(currentQuestion.prompt)) {
        currentQuestion.type = 'word_order';
        const parts = currentQuestion.prompt
          .split(/\s*\/\s*/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length >= 3) {
          if (currentQuestion.correctAnswer) {
            // Preserve the exact answer order as orderItems when answer key exists
            const ansTokens = currentQuestion.correctAnswer.trim().split(/\s+/);
            currentQuestion.orderItems = ansTokens.length >= 3 ? ansTokens : parts;
          } else {
            currentQuestion.orderItems = parts;
          }
        }
      } else if (/_{2,}|\(\.\.\.\)|\[\s*\]/.test(currentQuestion.prompt)) {
        currentQuestion.type = 'gap_fill';
      } else if (/rewrite|transform|viết lại câu|so that it means/i.test(contextInstr)) {
        currentQuestion.type = 'transformation';
      } else if (/true\s*\/\s*false|t\s*\/\s*f|yes\s*\/\s*no/i.test(contextInstr)) {
        currentQuestion.type = 'true_false';
        currentQuestion.options = [
          {id: `${currentQuestion.id}-t`, label: 'True', text: 'True'},
          {id: `${currentQuestion.id}-f`, label: 'False', text: 'False'},
        ];
      } else {
        currentQuestion.type = 'short_answer';
      }
    }

    if (!currentQuestion.correctAnswer && currentQuestion.type !== 'matching') {
      currentQuestion.uncertain = true;
    }

    questions.push(currentQuestion);
    currentQuestion = null;
  };

  const inlineOptionRegex = /\b([A-D])\.\s+([\s\S]*?)(?=(?:\s+[A-D]\.\s+)|$)/g;

  // Collect matching pairs block if a matching section lists "1. word — meaning" lines
  let pendingMatchingPairs: Array<{id: string; left: string; right: string}> = [];
  const flushMatchingPairs = () => {
    if (pendingMatchingPairs.length >= 2) {
      const nextNum = questions.length > 0 ? Math.max(...questions.map((q) => q.number)) + 1 : 1;
      questions.push({
        id: `doc-match-${Date.now()}-${questions.length}`,
        number: nextNum,
        type: 'matching',
        prompt: currentSectionInstruction || 'Match the items in Column A with Column B.',
        matchingPairs: [...pendingMatchingPairs],
        correctAnswer: pendingMatchingPairs.map((p) => `${p.left} → ${p.right}`).join('; '),
        passageIndex: currentPassageIndex,
        cognitiveLevel: 'recognition',
      });
    }
    pendingMatchingPairs = [];
  };

  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i];

    // First prominent short line as title
    if (i === 0 && line.length < 130 && !/^(Question|Câu|\d+\.)/i.test(line)) {
      title = line.replace(/<\/?u>/g, '');
      continue;
    }

    // Detect Transcript header (ONLY real transcripts in source doc — never fabricated)
    if (/^(TRANSCRIPT|AUDIO\s*SCRIPT|TAPESCRIPT|BÀI\s*NGHE|SCRIPT)\s*:?/i.test(line)) {
      flushPassage();
      flushMatchingPairs();
      flushQuestion();
      collectingTranscript = true;
      const rest = line.replace(/^(TRANSCRIPT|AUDIO\s*SCRIPT|TAPESCRIPT|BÀI\s*NGHE|SCRIPT)\s*:?\s*/i, '').trim();
      if (rest) transcriptLines.push(rest);
      continue;
    }

    // Detect Instruction / Part / Activity lines across Grades 1–12
    if (
      /^(Read the (following )?passage|Read and (circle|tick|match|answer|write|complete)|Look,\s*read|Look\s+and\s+(choose|match|circle|tick|write|number)|Mark the letter|Choose the (best|correct|odd)|Circle the|Listen and|Complete the|Fill in|Rewrite the|Find the mistake|Put the words|Reorder|Unscramble|Match the|Part\s+[IVX0-9]+|Exercise\s+\d+|Task\s+\d+|Activity\s+\d+|Section\s+[A-Z0-9]+|I{1,3}\.|[IVX]+\.)/i.test(
        line,
      )
    ) {
      if (collectingTranscript && /^(Question|Câu|1\.)/i.test(line)) {
        collectingTranscript = false;
      }
      flushPassage();
      flushMatchingPairs();
      flushQuestion();
      currentSectionInstruction = line;
      instructions = instructions ? `${instructions}\n${line}` : line;
      if (/read the (following )?passage|read the text|đọc đoạn văn/i.test(line)) {
        collectingPassage = true;
        collectingTranscript = false;
      } else if (/read and (answer|circle|tick|complete|write)/i.test(line)) {
        collectingPassage = true;
        collectingTranscript = false;
      }
      continue;
    }

    // Detect Matching pair lines inside a Matching section: "1. apple — quả táo" or "1. cat = con mèo"
    if (/match|nối|ghép/i.test(currentSectionInstruction)) {
      const pairMatch = line.match(/^(?:\d{1,2}[.)]\s*)?(.+?)\s*(?:—|–|->|=|\s-\s)\s*(.+)$/);
      if (pairMatch && pairMatch[1].trim().length > 0 && pairMatch[2].trim().length > 0) {
        pendingMatchingPairs.push({
          id: `pair-${Date.now()}-${pendingMatchingPairs.length}`,
          left: pairMatch[1].trim(),
          right: pairMatch[2].trim(),
        });
        continue;
      }
    }

    // Detect Question start: "Question 1:", "Câu 1.", "1.", "1)"
    const qMatch = line.match(/^(?:Question|Câu)?\s*(\d{1,3})\s*[.):]\s*(.*)$/i);
    if (qMatch && Number(qMatch[1]) > 0 && Number(qMatch[1]) <= 120) {
      const nextText = qMatch[2].trim();
      if (collectingPassage) flushPassage();
      if (collectingTranscript) collectingTranscript = false;
      flushMatchingPairs();
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
        cognitiveLevel: resolvedLevel === 'primary' ? 'recognition' : 'comprehension',
      };
      continue;
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

    // Passage paragraph (keep intact — lower threshold 110 chars for shorter Primary/Secondary passages)
    const minPassageLen = resolvedLevel === 'primary' ? 95 : 150;
    if (collectingPassage || (!currentQuestion && line.length >= minPassageLen)) {
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
  flushMatchingPairs();
  flushQuestion();

  transcript = transcriptLines.join('\n');

  // Auto-detect primary skill & activity with transparent evidence
  let detectedSkill: SkillCategory = options.skillHint || 'reading';
  let detectedSkillEvidence = '';
  if (!options.skillHint) {
    if (transcript.length > 30 || /\b(listen\s+and|listening|nghe\s+và)\b/i.test(`${title} ${instructions}`)) {
      detectedSkill = 'listening';
      detectedSkillEvidence =
        transcript.length > 30
          ? 'Phát hiện đoạn Transcript bài nghe trong tài liệu.'
          : 'Phát hiện yêu cầu nghe hiểu ("Listen and...") trong tài liệu.';
    } else if (questions.some((q) => q.type === 'pronunciation_underlined')) {
      detectedSkill = 'pronunciation';
      detectedSkillEvidence = 'Phát hiện câu hỏi phát âm có phần gạch chân <u>...</u>.';
    } else if (passages.length > 0) {
      detectedSkill = 'reading';
      detectedSkillEvidence = `Phát hiện ${passages.length} đoạn văn đọc hiểu đi kèm câu hỏi.`;
    } else if (questions.some((q) => q.type === 'matching')) {
      detectedSkill = 'vocabulary';
      detectedSkillEvidence = 'Phát hiện hoạt động ghép từ / nối cặp từ vựng.';
    } else if (questions.some((q) => q.type === 'transformation' || q.type === 'word_order')) {
      detectedSkill = 'writing';
      detectedSkillEvidence = 'Phát hiện dạng bài sắp xếp từ / viết lại câu.';
    } else if (/\b(speak|role-?play|talk\s+about|interview|point\s+and\s+say)\b/i.test(`${title} ${instructions}`)) {
      detectedSkill = 'speaking';
      detectedSkillEvidence = 'Phát hiện yêu cầu luyện nói / giao tiếp trong tài liệu.';
    } else {
      detectedSkill = 'grammar';
      detectedSkillEvidence = 'Nhận diện bài luyện tập ngữ pháp / câu hỏi tổng hợp.';
    }
  } else {
    detectedSkillEvidence = 'Theo kỹ năng giáo viên đã chọn trước.';
  }

  const detectedActivityType = inferActivityType(detectedSkill, questions);

  if (gradeNeedsConfirmation) {
    warnings.push(gradeDetection.evidence);
  }
  if (detectedSkill === 'listening' && !transcript.trim()) {
    warnings.push(
      'Tài liệu là bài Listening nhưng không chứa transcript sẵn. Hệ thống không tự tạo transcript — giáo viên có thể tùy chọn tải tệp âm thanh MP3/WAV hoặc nhập transcript để tạo giọng đọc.',
    );
  }
  if (questions.length === 0 && passages.length === 0) {
    warnings.push(
      'Bộ phân tích cục bộ không tìm thấy cấu trúc câu hỏi chuẩn (ví dụ: "1.", "Question 1:", "A. B. C. D."). Bạn có thể chỉnh sửa trực tiếp ở Bước 3 hoặc dùng AI hỗ trợ nếu đang trực tuyến.',
    );
  }
  const missingKeyCount = questions.filter((q) => !q.correctAnswer && q.type !== 'matching').length;
  if (missingKeyCount > 0) {
    warnings.push(
      `Có ${missingKeyCount} câu hỏi chưa tìm thấy đáp án trong tài liệu gốc (được đánh dấu "Cần kiểm tra"). Giáo viên hãy kiểm tra và điền đáp án ở Bước 3.`,
    );
  }

  return {
    sourceFiles: options.fileName ? [options.fileName] : ['Văn bản dán trực tiếp'],
    title,
    grade: resolvedGrade,
    educationLevel: resolvedLevel,
    detectedGrade: gradeDetection.detectedGrade,
    detectedLevel: gradeDetection.detectedLevel,
    gradeConfidence: gradeDetection.confidence,
    gradeEvidence: gradeDetection.evidence,
    gradeNeedsConfirmation,
    skill: detectedSkill,
    detectedActivityType,
    detectedSkillEvidence,
    instructions,
    passages,
    transcript,
    questions,
    extractedImages: [],
    pageCount: options.pageCount,
    warnings,
    usedAI: false,
  };
}

/**
 * Main entry point for uploaded files (DOCX, PDF text, PDF scan, multiple images) across Grades 1–12.
 */
export async function processUploadedFiles(
  files: File[],
  grade: Grade,
  skillHint?: SkillCategory,
  useAIRefinement?: boolean,
  options?: {gradeManuallyLocked?: boolean},
): Promise<ParsedDocumentDraft> {
  const imageFiles = files.filter((f) => /^image\/(jpeg|png|webp)$/i.test(f.type));
  const docxFiles = files.filter((f) => /\.docx$/i.test(f.name));
  const pdfFiles = files.filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
  const audioFiles = files.filter(
    (f) => /^audio\//i.test(f.type) || /\.(mp3|wav|ogg|m4a)$/i.test(f.name),
  );

  const sourceFiles = files.map((f) => f.name);
  let attachedAudioDataUrl: string | undefined;
  let attachedAudioName: string | undefined;
  let attachedAudioMimeType: string | undefined;

  if (audioFiles.length > 0) {
    attachedAudioDataUrl = await fileToDataUrl(audioFiles[0]);
    attachedAudioName = audioFiles[0].name;
    attachedAudioMimeType = audioFiles[0].type || 'audio/mpeg';
  }

  // Case 1: Multiple images (JPG/PNG/WebP)
  if (imageFiles.length > 0 && docxFiles.length === 0 && pdfFiles.length === 0) {
    const dataUrls = await Promise.all(imageFiles.map((f) => fileToDataUrl(f)));
    const extractedImages = imageFiles.map((f, idx) => ({name: f.name, dataUrl: dataUrls[idx]}));
    const payloadImages = dataUrls.map((url, idx) => ({
      ...dataUrlToBase64(url),
      name: imageFiles[idx].name,
    }));

    const filenameDetection = detectGradeAndLevelFromText('', imageFiles[0].name);
    const aiRes = await ocrImagesWithAI(
      payloadImages,
      options?.gradeManuallyLocked ? grade : null,
      skillHint,
    );
    if (aiRes.ok && aiRes.data) {
      const draft = mapAIDataToDraft(aiRes.data, {
        sourceFiles,
        fallbackGrade: grade,
        gradeManuallyLocked: Boolean(options?.gradeManuallyLocked),
        fallbackSkill: skillHint || (attachedAudioDataUrl ? 'listening' : 'reading'),
        extractedImages,
        pageCount: imageFiles.length,
        filenameFallbackDetection: filenameDetection,
      });
      draft.attachedAudioDataUrl = attachedAudioDataUrl;
      draft.attachedAudioName = attachedAudioName;
      draft.attachedAudioMimeType = attachedAudioMimeType;
      return draft;
    }

    const resolvedGrade = options?.gradeManuallyLocked
      ? grade
      : filenameDetection.detectedGrade ?? grade;
    const resolvedLevel = options?.gradeManuallyLocked
      ? getEducationLevelFromGrade(grade)
      : filenameDetection.detectedLevel ?? getEducationLevelFromGrade(resolvedGrade);

    return {
      sourceFiles,
      title: imageFiles[0].name.replace(/\.[^.]+$/, ''),
      grade: resolvedGrade,
      educationLevel: resolvedLevel,
      detectedGrade: filenameDetection.detectedGrade,
      detectedLevel: filenameDetection.detectedLevel,
      gradeConfidence: filenameDetection.confidence,
      gradeEvidence: filenameDetection.evidence,
      gradeNeedsConfirmation: !options?.gradeManuallyLocked && filenameDetection.needsConfirmation,
      skill: skillHint || (attachedAudioDataUrl ? 'listening' : 'speaking'),
      detectedActivityType: attachedAudioDataUrl ? 'listening_mcq' : 'speaking_picture',
      detectedSkillEvidence: 'Giữ nguyên hình ảnh gốc đã tải lên.',
      instructions: '',
      passages: [],
      transcript: '',
      attachedAudioDataUrl,
      attachedAudioName,
      attachedAudioMimeType,
      questions: [],
      extractedImages,
      pageCount: imageFiles.length,
      warnings: [
        aiRes.error ||
          'Dịch vụ AI thị giác (OCR) không khả dụng. Hệ thống đã giữ nguyên hình ảnh gốc để bạn chèn trực tiếp vào slide hoặc tự nhập câu hỏi ở Bước 3.',
      ],
      usedAI: false,
    };
  }

  // Case 2: DOCX and/or PDF (possibly multi-page & image-rich, optionally with companion audio)
  let combinedText = '';
  const allImages: Array<{name: string; dataUrl: string}> = [];
  const allWarnings: string[] = [];
  const scannedPageImages: Array<{name: string; dataUrl: string}> = [];
  let totalPageCount = 0;

  for (const df of docxFiles) {
    const res = await extractDocxWithUnderlines(df);
    combinedText += `\n\n${res.text}`;
    allImages.push(...res.images);
    allWarnings.push(...res.warnings);
    totalPageCount += Math.max(1, Math.ceil(res.text.length / 2200));
  }

  for (const pf of pdfFiles) {
    const res = await extractPdfContent(pf);
    totalPageCount += res.pageCount;
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

  const filenameDetection = detectGradeAndLevelFromText(combinedText, sourceFiles[0]);

  // If primarily scanned PDF pages, call Vision AI OCR
  if (scannedPageImages.length > 0 && combinedText.trim().length < 60) {
    const aiRes = await ocrImagesWithAI(
      scannedPageImages.map((img) => ({...dataUrlToBase64(img.dataUrl), name: img.name})),
      options?.gradeManuallyLocked ? grade : null,
      skillHint,
    );
    if (aiRes.ok && aiRes.data) {
      const draft = mapAIDataToDraft(aiRes.data, {
        sourceFiles,
        fallbackGrade: grade,
        gradeManuallyLocked: Boolean(options?.gradeManuallyLocked),
        fallbackSkill: skillHint || (attachedAudioDataUrl ? 'listening' : 'reading'),
        extractedImages: allImages,
        pageCount: totalPageCount || scannedPageImages.length,
        filenameFallbackDetection: filenameDetection,
      });
      draft.attachedAudioDataUrl = attachedAudioDataUrl;
      draft.attachedAudioName = attachedAudioName;
      draft.attachedAudioMimeType = attachedAudioMimeType;
      draft.warnings = [...allWarnings, ...draft.warnings];
      return draft;
    }
    const resolvedGrade = options?.gradeManuallyLocked
      ? grade
      : filenameDetection.detectedGrade ?? grade;
    return {
      sourceFiles,
      title: sourceFiles[0].replace(/\.[^.]+$/, ''),
      grade: resolvedGrade,
      educationLevel: getEducationLevelFromGrade(resolvedGrade),
      detectedGrade: filenameDetection.detectedGrade,
      detectedLevel: filenameDetection.detectedLevel,
      gradeConfidence: filenameDetection.confidence,
      gradeEvidence: filenameDetection.evidence,
      gradeNeedsConfirmation: !options?.gradeManuallyLocked && filenameDetection.needsConfirmation,
      skill: skillHint || (attachedAudioDataUrl ? 'listening' : 'reading'),
      instructions: '',
      passages: [],
      transcript: '',
      attachedAudioDataUrl,
      attachedAudioName,
      attachedAudioMimeType,
      questions: [],
      extractedImages: allImages,
      pageCount: totalPageCount || scannedPageImages.length,
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
    const aiRes = await refineDocumentWithAI(
      combinedText,
      options?.gradeManuallyLocked ? grade : null,
      skillHint,
    );
    if (aiRes.ok && aiRes.data) {
      const draft = mapAIDataToDraft(aiRes.data, {
        sourceFiles,
        fallbackGrade: grade,
        gradeManuallyLocked: Boolean(options?.gradeManuallyLocked),
        fallbackSkill: skillHint || (attachedAudioDataUrl ? 'listening' : 'reading'),
        extractedImages: allImages,
        pageCount: totalPageCount || 1,
        filenameFallbackDetection: filenameDetection,
      });
      draft.attachedAudioDataUrl = attachedAudioDataUrl;
      draft.attachedAudioName = attachedAudioName;
      draft.attachedAudioMimeType = attachedAudioMimeType;
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
    gradeManuallyLocked: options?.gradeManuallyLocked,
    skillHint: skillHint || (attachedAudioDataUrl ? 'listening' : undefined),
    pageCount: totalPageCount || 1,
  });
  localDraft.sourceFiles = sourceFiles;
  localDraft.extractedImages = allImages;
  localDraft.attachedAudioDataUrl = attachedAudioDataUrl;
  localDraft.attachedAudioName = attachedAudioName;
  localDraft.attachedAudioMimeType = attachedAudioMimeType;
  localDraft.warnings = [...allWarnings, ...localDraft.warnings];
  return localDraft;
}

function mapAIDataToDraft(
  data: NonNullable<Awaited<ReturnType<typeof ocrImagesWithAI>>['data']>,
  ctx: {
    sourceFiles: string[];
    fallbackGrade: Grade;
    gradeManuallyLocked: boolean;
    fallbackSkill: SkillCategory;
    extractedImages: Array<{name: string; dataUrl: string}>;
    pageCount?: number;
    filenameFallbackDetection: GradeDetectionResult;
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

  const aiGrade = typeof data.detectedGrade === 'number' ? toValidGrade(data.detectedGrade) : null;
  const aiLevelRaw = (data.detectedLevel || '').toLowerCase();
  const aiLevel: EducationLevel | null =
    aiLevelRaw === 'primary' || aiLevelRaw === 'secondary' || aiLevelRaw === 'high_school'
      ? aiLevelRaw
      : aiGrade
        ? getEducationLevelFromGrade(aiGrade)
        : null;

  const detectedGrade = aiGrade ?? ctx.filenameFallbackDetection.detectedGrade;
  const detectedLevel = aiLevel ?? ctx.filenameFallbackDetection.detectedLevel;
  const gradeConfidence: 'high' | 'medium' | 'none' = detectedGrade
    ? 'high'
    : detectedLevel
      ? 'medium'
      : 'none';
  const gradeEvidence =
    data.gradeEvidence?.trim() ||
    ctx.filenameFallbackDetection.evidence;

  const resolvedGrade: Grade = ctx.gradeManuallyLocked
    ? ctx.fallbackGrade
    : detectedGrade ?? ctx.fallbackGrade;
  const resolvedLevel: EducationLevel = ctx.gradeManuallyLocked
    ? getEducationLevelFromGrade(ctx.fallbackGrade)
    : detectedLevel ?? getEducationLevelFromGrade(resolvedGrade);
  const gradeNeedsConfirmation =
    !ctx.gradeManuallyLocked &&
    (detectedGrade === null || detectedGrade !== ctx.fallbackGrade);

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
      cognitiveLevel: resolvedLevel === 'primary' ? 'recognition' : 'comprehension',
    }),
  );

  const warnings = [...(data.warnings || [])];
  if (gradeNeedsConfirmation && gradeEvidence) {
    warnings.unshift(gradeEvidence);
  }

  return {
    sourceFiles: ctx.sourceFiles,
    title: data.title || ctx.sourceFiles[0]?.replace(/\.[^.]+$/, '') || 'Bài giảng từ tài liệu',
    grade: resolvedGrade,
    educationLevel: resolvedLevel,
    detectedGrade,
    detectedLevel,
    gradeConfidence,
    gradeEvidence,
    gradeNeedsConfirmation,
    skill,
    detectedActivityType:
      (data.detectedActivityType as ActivityType | undefined) || inferActivityType(skill, questions),
    detectedSkillEvidence: 'Nhận diện tự động từ cấu trúc và nội dung tài liệu.',
    instructions: data.instructions || '',
    passages,
    transcript: data.transcript || '',
    questions,
    extractedImages: ctx.extractedImages,
    pageCount: ctx.pageCount,
    warnings,
    usedAI: true,
  };
}

/**
 * Step 4: Converts a teacher-verified ParsedDocumentDraft into an interactive LessonProject.
 * Adapts slide pacing, visual image placement, and layout defaults by EducationLevel
 * (Tiểu học 1–5, THCS 6–9, THPT 10–12) without ever altering original question wording or
 * fabricating transcripts.
 */
export function convertDraftToLesson(draft: ParsedDocumentDraft): LessonProject {
  const now = Date.now();
  const level: EducationLevel = draft.educationLevel || getEducationLevelFromGrade(draft.grade);
  const levelShort = EDUCATION_LEVEL_SHORT[level];
  const slides: Slide[] = [];

  // Track images so extracted visuals are placed cleanly on slides (especially rich Primary/Secondary worksheets)
  let nextImageIdx = 0;
  const takeNextImage = () => {
    if (nextImageIdx < draft.extractedImages.length) {
      return draft.extractedImages[nextImageIdx++];
    }
    return undefined;
  };

  const coverImage = takeNextImage();

  // Slide 1: Cover Slide
  slides.push({
    id: `slide-cover-${now}`,
    order: 0,
    title: draft.title || `Bài giảng Tiếng Anh ${levelShort} Lớp ${draft.grade}`,
    subtitle: `${levelShort} · Lớp ${draft.grade} · Nguồn: ${draft.sourceFiles.join(', ')}`,
    skill: draft.skill,
    activityType: 'title_slide',
    instruction: draft.instructions || 'Mục tiêu bài học và hoạt động tương tác trên lớp.',
    bullets: [
      `Cấp học & Khối lớp: ${levelShort} Lớp ${draft.grade} (Chương trình GDPT 2018)`,
      `Số câu hỏi trích xuất: ${draft.questions.length} câu${draft.pageCount && draft.pageCount > 1 ? ` · ${draft.pageCount} trang tài liệu` : ''}`,
      draft.passages.length > 0
        ? `Bao gồm ${draft.passages.length} bài đọc giữ nguyên đoạn văn gốc`
        : draft.attachedAudioDataUrl
          ? `Đính kèm âm thanh trực tiếp (${draft.attachedAudioName || 'Audio'})`
          : draft.transcript
            ? 'Bao gồm nội dung Transcript bài nghe có sẵn từ tài liệu'
            : draft.extractedImages.length > 0
              ? `Bao gồm ${draft.extractedImages.length} hình ảnh trực quan trích xuất từ tài liệu`
              : 'Tối ưu bố cục trình chiếu tương tác',
    ],
    imageUrl: coverImage?.dataUrl,
    imageCaption: coverImage?.name,
    teacherNotes: 'Giới thiệu nhanh mục tiêu tiết học và yêu cầu làm bài trước khi chuyển sang các slide hoạt động.',
  });

  // Adaptive chunk size per education level
  const readingChunkSize = level === 'primary' ? 2 : level === 'secondary' ? 4 : 5;
  const standaloneChunkSize = level === 'primary' ? 2 : level === 'secondary' ? 3 : 4;

  // Group reading passage slides (keeping passage linked to its grouped questions!)
  const usedQuestionIds = new Set<string>();
  draft.passages.forEach((passage, pIdx) => {
    const linkedQuestions = draft.questions.filter((q) => q.passageIndex === pIdx);
    linkedQuestions.forEach((q) => usedQuestionIds.add(q.id));
    const passageImg = takeNextImage();

    if (linkedQuestions.length === 0) {
      slides.push({
        id: `slide-passage-${pIdx}-${now}`,
        order: slides.length,
        title: passage.title || `Reading Passage ${pIdx + 1}`,
        skill: 'reading',
        activityType: 'reading_detailed',
        instruction: draft.instructions || 'Read the passage carefully.',
        passage,
        imageUrl: passageImg?.dataUrl,
        imageCaption: passageImg?.name,
        teacherNotes: 'Cho học sinh đọc lướt nắm ý chính trước khi làm câu hỏi chi tiết.',
      });
    } else {
      for (let start = 0; start < linkedQuestions.length; start += readingChunkSize) {
        const chunk = linkedQuestions.slice(start, start + readingChunkSize);
        slides.push({
          id: `slide-reading-${pIdx}-${start}-${now}`,
          order: slides.length,
          title:
            linkedQuestions.length > readingChunkSize
              ? `${passage.title || 'Reading Comprehension'} (Câu ${chunk[0].number}–${chunk[chunk.length - 1].number})`
              : passage.title || 'Reading Comprehension',
          skill: 'reading',
          activityType: inferActivityType('reading', chunk),
          instruction: draft.instructions || 'Read the passage and answer the questions.',
          passage,
          imageUrl: start === 0 ? passageImg?.dataUrl : undefined,
          imageCaption: start === 0 ? passageImg?.name : undefined,
          questions: chunk,
          teacherNotes: 'Giữ nguyên bài đọc bên trái để học sinh đối chiếu dẫn chứng trực tiếp.',
        });
      }
    }
  });

  // Listening slide: ONLY attach real audio or real transcript (NEVER fabricate transcript!)
  const remainingQuestions = draft.questions.filter((q) => !usedQuestionIds.has(q.id));
  const hasListeningAudioOrTranscript =
    Boolean(draft.attachedAudioDataUrl) || draft.transcript.trim().length > 0;
  const isListeningWithoutTranscript =
    draft.skill === 'listening' && !hasListeningAudioOrTranscript;

  if (hasListeningAudioOrTranscript || isListeningWithoutTranscript) {
    const listenImg = takeNextImage();
    const audioConfig = draft.attachedAudioDataUrl
      ? {
          sourceMode: 'uploaded' as const,
          dataUrl: draft.attachedAudioDataUrl,
          fileName: draft.attachedAudioName || 'listening-audio',
          mimeType: draft.attachedAudioMimeType || 'audio/mpeg',
          transcript: draft.transcript,
          showTranscriptDefault: false,
          isSynthesized: false,
          timestamps: [],
        }
      : draft.transcript.trim().length > 0
        ? {
            sourceMode: 'tts' as const,
            transcript: draft.transcript,
            showTranscriptDefault: false,
            voiceAccent: 'en-GB' as const,
            isSynthesized: true,
            timestamps: [],
          }
        : {
            sourceMode: 'uploaded' as const,
            transcript: '',
            showTranscriptDefault: false,
            timestamps: [],
          };

    slides.push({
      id: `slide-listening-${now}`,
      order: slides.length,
      title: 'Listening Comprehension',
      skill: 'listening',
      activityType: inferActivityType('listening', remainingQuestions),
      instruction: draft.instructions || 'Listen carefully and complete the task.',
      audio: audioConfig,
      imageUrl: listenImg?.dataUrl,
      imageCaption: listenImg?.name,
      questions: remainingQuestions.length > 0 ? remainingQuestions : undefined,
      teacherNotes: draft.attachedAudioDataUrl
        ? 'Bài nghe đã đính kèm âm thanh trực tiếp — nhấn Play để phát ngay.'
        : draft.transcript.trim().length > 0
          ? 'Có thể nhấn Play để nghe giọng đọc tổng hợp từ transcript hoặc tải tệp MP3/WAV riêng.'
          : 'Tài liệu gốc chưa có file âm thanh hay transcript. Giáo viên có thể tải MP3/WAV hoặc nhập transcript trong Trình biên tập (không bắt buộc tải tệp để trình chiếu câu hỏi).',
    });
    remainingQuestions.forEach((q) => usedQuestionIds.add(q.id));
  }

  // Remaining standalone questions grouped by education-level pacing
  const ungrouped = draft.questions.filter((q) => !usedQuestionIds.has(q.id));
  if (ungrouped.length > 0) {
    for (let start = 0; start < ungrouped.length; start += standaloneChunkSize) {
      const chunk = ungrouped.slice(start, start + standaloneChunkSize);
      const slideSkill: SkillCategory = chunk.some((q) => q.type === 'pronunciation_underlined')
        ? 'pronunciation'
        : chunk.some((q) => q.type === 'matching')
          ? 'vocabulary'
          : draft.skill;
      const slideImg = takeNextImage();
      slides.push({
        id: `slide-qgroup-${start}-${now}`,
        order: slides.length,
        title: `Hoạt động luyện tập (Câu ${chunk[0].number}–${chunk[chunk.length - 1].number})`,
        skill: slideSkill,
        activityType: inferActivityType(slideSkill, chunk),
        instruction: draft.instructions || 'Complete the following questions.',
        imageUrl: slideImg?.dataUrl,
        imageCaption: slideImg?.name,
        questions: chunk,
        teacherNotes: 'Nhấn "Đáp án" sau khi học sinh hoàn thành để kiểm soát nhịp độ lớp học.',
      });
    }
  }

  // Remaining extracted images (e.g. multi-page illustrated Primary/Secondary docs or picture tasks)
  const leftoverImages = draft.extractedImages.slice(nextImageIdx);
  if (draft.questions.length === 0 && draft.passages.length === 0 && draft.extractedImages.length > 0) {
    draft.extractedImages.forEach((img, idx) => {
      if (draft.skill === 'writing') {
        const minWords = level === 'primary' ? 25 : level === 'secondary' ? 70 : 120;
        const maxWords = level === 'primary' ? 50 : level === 'secondary' ? 100 : 160;
        slides.push({
          id: `slide-img-writing-${idx}-${now}`,
          order: slides.length,
          title: `Writing from Picture ${idx + 1}`,
          skill: 'writing',
          activityType: 'writing_picture',
          instruction: `Observe the picture carefully and write (${minWords}–${maxWords} words).`,
          imageUrl: img.dataUrl,
          imageCaption: img.name,
          writingTask: {
            prompt:
              level === 'primary'
                ? 'Look at the picture and write 3–5 simple sentences about what you see.'
                : 'Describe what is happening in the picture and share your thoughts on the topic.',
            minWords,
            maxWords,
            outlineHints:
              level === 'primary'
                ? [
                    'Who or what is in the picture?',
                    'What are they doing?',
                    'What colour / where are they?',
                  ]
                : [
                    'Topic sentence: Introduce the scene and main subject.',
                    'Supporting details: Describe actions, setting, and key elements.',
                    'Conclusion: Give a brief personal reflection or message.',
                  ],
            usefulExpressions:
              level === 'primary'
                ? ['I can see...', 'There is / There are...', 'They are...']
                : ['In the foreground/background...', 'It is evident that...', 'Overall, this scene highlights...'],
            rubricCriteria: DEFAULT_WRITING_RUBRIC,
          },
        });
      } else {
        slides.push({
          id: `slide-img-speaking-${idx}-${now}`,
          order: slides.length,
          title: level === 'primary' ? `Look and Say · Picture ${idx + 1}` : `Picture Description ${idx + 1}`,
          skill: 'speaking',
          activityType: 'speaking_picture',
          instruction:
            level === 'primary'
              ? 'Look at the picture, point and say what you see!'
              : 'Work in pairs. Describe the picture and discuss the guiding questions.',
          imageUrl: img.dataUrl,
          imageCaption: img.name,
          speakingTask: {
            prompt:
              level === 'primary'
                ? 'Point to the picture and answer the teacher’s questions in English.'
                : 'Describe the main activity in the image and share your ideas.',
            cues: ['Who / What is in the picture?', 'What are they doing?', 'Do you like this activity? Why?'],
            rubricCriteria: DEFAULT_SPEAKING_RUBRIC,
          },
        });
      }
    });
  } else if (leftoverImages.length > 0) {
    // Keep extra visual pages accessible on a dedicated Visual Gallery / Discussion slide
    leftoverImages.slice(0, 6).forEach((img, idx) => {
      slides.push({
        id: `slide-visual-${idx}-${now}`,
        order: slides.length,
        title: `Hình ảnh minh họa từ tài liệu (${idx + 1})`,
        skill: draft.skill,
        activityType: level === 'primary' ? 'speaking_picture' : 'theory_slide',
        instruction:
          level === 'primary'
            ? 'Quan sát tranh, nghe cô đọc và cùng nói theo!'
            : 'Quan sát hình ảnh minh họa trích xuất từ tài liệu gốc.',
        imageUrl: img.dataUrl,
        imageCaption: img.name,
        bullets: [
          `Hình ảnh trích xuất từ ${draft.sourceFiles.join(', ')}`,
          level === 'primary'
            ? 'Giáo viên có thể cho học sinh chỉ tranh, đọc to từ vựng hoặc ghép câu.'
            : 'Sử dụng hình ảnh để dẫn dắt thảo luận hoặc kiểm tra lại nội dung bài học.',
        ],
      });
    });
  }

  return {
    id: `lesson-${now}-${Math.random().toString(36).slice(2, 7)}`,
    title: draft.title || 'Bài giảng mới',
    grade: draft.grade,
    educationLevel: level,
    skill: draft.skill,
    activityFocus: draft.detectedActivityType,
    topic: draft.title || 'Chủ đề nhập từ tài liệu',
    description: `Bài trình chiếu ${levelShort} Lớp ${draft.grade} được chuyển đổi từ ${draft.sourceFiles.join(', ')} (${slides.length} slide).`,
    curriculumNote: `Chương trình GDPT 2018 · Tiếng Anh ${levelShort} Lớp ${draft.grade}`,
    isSample: false,
    createdAt: now,
    updatedAt: now,
    themeId: level === 'primary' ? 'ocean_blue' : 'light_classroom',
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
