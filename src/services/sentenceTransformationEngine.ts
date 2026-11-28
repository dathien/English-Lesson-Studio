import type {
  QuestionItem,
  SentenceTransformationMeta,
  TransformationErrorDiagnostic,
  TransformationEvaluationResult,
  TransformationGradingRules,
  TransformationSubtype,
} from '../types/lesson';

export const DEFAULT_TRANSFORMATION_GRADING_RULES: Required<TransformationGradingRules> = {
  caseSensitive: false,
  allowContractions: true,
  strictPunctuation: false,
  allowBritishAmericanSpelling: true,
  acceptRemainingOnly: true,
};

const CONTRACTION_EXPANSIONS: Array<[RegExp, string]> = [
  [/\bcan't\b/gi, 'cannot'],
  [/\bcannot\b/gi, 'cannot'],
  [/\bwon't\b/gi, 'will not'],
  [/\bshan't\b/gi, 'shall not'],
  [/\bain't\b/gi, 'is not'],
  [/\bdon't\b/gi, 'do not'],
  [/\bdoesn't\b/gi, 'does not'],
  [/\bdidn't\b/gi, 'did not'],
  [/\bisn't\b/gi, 'is not'],
  [/\baren't\b/gi, 'are not'],
  [/\bwasn't\b/gi, 'was not'],
  [/\bweren't\b/gi, 'were not'],
  [/\bhaven't\b/gi, 'have not'],
  [/\bhasn't\b/gi, 'has not'],
  [/\bhadn't\b/gi, 'had not'],
  [/\bwouldn't\b/gi, 'would not'],
  [/\bcouldn't\b/gi, 'could not'],
  [/\bshouldn't\b/gi, 'should not'],
  [/\bmustn't\b/gi, 'must not'],
  [/\bneedn't\b/gi, 'need not'],
  [/\bmightn't\b/gi, 'might not'],
  [/\bi'm\b/gi, 'i am'],
  [/\byou're\b/gi, 'you are'],
  [/\bwe're\b/gi, 'we are'],
  [/\bthey're\b/gi, 'they are'],
  [/\bi've\b/gi, 'i have'],
  [/\byou've\b/gi, 'you have'],
  [/\bwe've\b/gi, 'we have'],
  [/\bthey've\b/gi, 'they have'],
  [/\bi'll\b/gi, 'i will'],
  [/\byou'll\b/gi, 'you will'],
  [/\bhe'll\b/gi, 'he will'],
  [/\bshe'll\b/gi, 'she will'],
  [/\bit'll\b/gi, 'it will'],
  [/\bwe'll\b/gi, 'we will'],
  [/\bthey'll\b/gi, 'they will'],
  [/\bit's\b/gi, 'it is'],
  [/\bthat's\b/gi, 'that is'],
  [/\bthere's\b/gi, 'there is'],
  [/\bhe's\b/gi, 'he is'],
  [/\bshe's\b/gi, 'she is'],
  [/\bwho's\b/gi, 'who is'],
  [/\bwhat's\b/gi, 'what is'],
  [/\blet's\b/gi, 'let us'],
  [/\bhere's\b/gi, 'here is'],
];

const UK_US_SPELLING_MAP: Record<string, string> = {
  organise: 'organize',
  organised: 'organized',
  organising: 'organizing',
  organisation: 'organization',
  realise: 'realize',
  realised: 'realized',
  recognise: 'recognize',
  recognised: 'recognized',
  practise: 'practice',
  practised: 'practiced',
  practising: 'practicing',
  colour: 'color',
  colours: 'colors',
  favourite: 'favorite',
  neighbour: 'neighbor',
  neighbours: 'neighbors',
  neighbourhood: 'neighborhood',
  behaviour: 'behavior',
  centre: 'center',
  theatre: 'theater',
  programme: 'program',
  programmes: 'programs',
  travelled: 'traveled',
  travelling: 'traveling',
  cancelled: 'canceled',
  cancelling: 'canceling',
  defence: 'defense',
  offence: 'offense',
  licence: 'license',
  analyse: 'analyze',
  analysed: 'analyzed',
  apologise: 'apologize',
  apologised: 'apologized',
  criticise: 'criticize',
  emphasise: 'emphasize',
  globalisation: 'globalization',
  modernise: 'modernize',
  prioritise: 'prioritize',
  specialise: 'specialize',
  utilised: 'utilized',
  utilise: 'utilize',
};

const PREPOSITIONS = new Set([
  'in', 'on', 'at', 'by', 'for', 'of', 'to', 'from', 'with', 'without',
  'about', 'into', 'onto', 'over', 'under', 'through', 'between', 'among',
  'during', 'since', 'until', 'till', 'before', 'after', 'against', 'despite',
  'as', 'than', 'off', 'up', 'down', 'out',
]);

const AUXILIARIES = new Set([
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'ought',
]);

const NEGATION_TOKENS = new Set([
  'not', 'never', 'no', 'nobody', 'nothing', 'nowhere', 'neither', 'nor',
  'hardly', 'scarcely', 'rarely', 'seldom', 'without', 'unless',
]);

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'so', 'that', 'which', 'who', 'whom',
  'whose', 'this', 'these', 'those', 'it', 'its', 'there', 'here',
]);

const TEACHER_ACCEPTED_STORAGE_KEY = 'els_teacher_accepted_transformations_v1';
const inMemoryTeacherAccepted = new Map<string, string[]>();

function loadTeacherAcceptedMap(): Record<string, string[]> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(TEACHER_ACCEPTED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, string[]>;
        }
      }
    }
  } catch {
    // Ignore storage read errors in restricted environments
  }
  const obj: Record<string, string[]> = {};
  inMemoryTeacherAccepted.forEach((v, k) => {
    obj[k] = v;
  });
  return obj;
}

export function getTeacherAcceptedAnswers(questionId: string): string[] {
  if (!questionId) return [];
  const map = loadTeacherAcceptedMap();
  return Array.isArray(map[questionId]) ? map[questionId] : [];
}

export function saveTeacherAcceptedAnswer(questionId: string, answer: string): string[] {
  const cleaned = cleanSurfaceWhitespace(answer);
  if (!questionId || !cleaned) return getTeacherAcceptedAnswers(questionId);
  const map = loadTeacherAcceptedMap();
  const current = Array.isArray(map[questionId]) ? [...map[questionId]] : [];
  const exists = current.some(
    (item) => normalizeForComparison(item) === normalizeForComparison(cleaned),
  );
  if (!exists) {
    current.push(cleaned);
    map[questionId] = current;
    inMemoryTeacherAccepted.set(questionId, current);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(TEACHER_ACCEPTED_STORAGE_KEY, JSON.stringify(map));
      }
    } catch {
      // Ignore storage write errors
    }
  }
  return current;
}

export function stripHtmlTags(input: string): string {
  return (input || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function normalizeApostrophesAndQuotes(text: string): string {
  return (text || '')
    .replace(/[\u2018\u2019\u201B\u0060\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...');
}

export function cleanSurfaceWhitespace(text: string): string {
  return normalizeApostrophesAndQuotes(stripHtmlTags(text))
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();
}

export function expandContractions(text: string): string {
  let out = normalizeApostrophesAndQuotes(text);
  // Special handling for "'d" -> "would" vs "had" before past participle
  out = out.replace(/\b(i|you|he|she|it|we|they)'d\s+(rather|better|like|love|prefer)\b/gi, '$1 would $2');
  out = out.replace(/\b(i|you|he|she|it|we|they)'d\b/gi, '$1 had');
  // Special handling for "'s" before past participle or "been" -> "has"
  out = out.replace(
    /\b(he|she|it|that|there|who)'s\s+(been|gone|done|made|taken|seen|worked|lived|studied|finished|already|never|ever|just)\b/gi,
    '$1 has $2',
  );
  for (const [pattern, replacement] of CONTRACTION_EXPANSIONS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function normalizeBritishAmerican(text: string): string {
  return text.replace(/\b[a-zA-Z]+\b/g, (word) => {
    const lower = word.toLowerCase();
    const mapped = UK_US_SPELLING_MAP[lower];
    return mapped ?? word;
  });
}

export function normalizeForComparison(
  text: string,
  rules: TransformationGradingRules = DEFAULT_TRANSFORMATION_GRADING_RULES,
): string {
  const merged = {...DEFAULT_TRANSFORMATION_GRADING_RULES, ...rules};
  let out = cleanSurfaceWhitespace(text);
  if (merged.allowContractions) {
    out = expandContractions(out);
  }
  if (!merged.caseSensitive) {
    out = out.toLowerCase();
  }
  if (merged.allowBritishAmericanSpelling) {
    out = normalizeBritishAmerican(out);
  }
  if (!merged.strictPunctuation) {
    out = out
      .replace(/[.,!?;:"()[\]]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return out;
}

export function tokenizeWords(text: string): string[] {
  const cleaned = normalizeForComparison(text, {
    caseSensitive: false,
    allowContractions: true,
    strictPunctuation: false,
    allowBritishAmericanSpelling: true,
  });
  return cleaned ? cleaned.split(/\s+/).filter(Boolean) : [];
}

export function countSurfaceWords(text: string): number {
  const cleaned = cleanSurfaceWhitespace(text)
    .replace(/[.,!?;:"()[\]]+/g, ' ')
    .trim();
  return cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[][] = Array.from({length: a.length + 1}, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

/**
 * Infer structured SentenceTransformationMeta from legacy transformation questions
 * that only stored a combined `prompt` string (e.g. `Original. (KEYWORD) -> Given start ...`).
 */
export function inferTransformationMeta(
  question: Pick<QuestionItem, 'prompt' | 'correctAnswer' | 'acceptedAnswers' | 'transformation' | 'explanation'>,
): SentenceTransformationMeta {
  if (question.transformation && question.transformation.originalSentence) {
    return question.transformation;
  }

  const rawPrompt = stripHtmlTags(question.prompt || '').trim();
  const lines = rawPrompt
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  let originalSentence = rawPrompt;
  let givenStart = '';
  let givenEnd = '';
  let gapTemplate = '';
  let keyword = '';
  let keepKeywordUnchanged = false;
  let instruction = '';
  let wordLimit: {min?: number; max?: number} | undefined;

  // Check for word limit phrase anywhere in prompt
  const betweenMatch = rawPrompt.match(/between\s+(\d+|two|three|four|five|six|seven)\s+and\s+(\d+|two|three|four|five|six|seven)\s+words/i);
  const maxMatch = rawPrompt.match(/(?:no more than|maximum of|at most|tối đa)\s+(\d+|two|three|four|five|six|seven)\s+(?:words|từ)/i);
  const wordNumMap: Record<string, number> = {
    two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  };
  const parseWordNum = (v: string) => wordNumMap[v.toLowerCase()] ?? Number.parseInt(v, 10);
  if (betweenMatch) {
    const min = parseWordNum(betweenMatch[1]);
    const max = parseWordNum(betweenMatch[2]);
    if (!Number.isNaN(min) && !Number.isNaN(max)) wordLimit = {min, max};
  } else if (maxMatch) {
    const max = parseWordNum(maxMatch[1]);
    if (!Number.isNaN(max)) wordLimit = {max};
  }

  if (/do not change the word|không (?:được )?(?:thay đổi|biến đổi) từ/i.test(rawPrompt)) {
    keepKeywordUnchanged = true;
  }

  // Extract arrow starter: `Original sentence. -> Given start ...` or multiline
  const arrowMatch = rawPrompt.match(/([\s\S]+?)\s*(?:→|=>|->)\s*([\s\S]+)/);
  if (arrowMatch) {
    originalSentence = arrowMatch[1].trim();
    const afterArrow = arrowMatch[2].trim();
    if (/_{2,}|\.{3,}/.test(afterArrow)) {
      const parts = afterArrow.split(/(?:_{2,}|\.{3,})/);
      if (parts.length > 2) {
        gapTemplate = afterArrow.replace(/\.{3,}|_{2,}/g, '___').trim();
      } else {
        givenStart = parts[0].trim();
        givenEnd = (parts[1] || '').replace(/^\s*[.,!?]?$/, '').trim();
        if (givenEnd === '.') givenEnd = '';
      }
    } else {
      givenStart = afterArrow.replace(/[.…]+$/, '').trim();
    }
  } else if (lines.length >= 2) {
    // Check if first line is an instruction
    if (/^(?:rewrite|complete|finish|combine|use|viết lại|hoàn thành)/i.test(lines[0]) && lines.length >= 3) {
      instruction = lines[0];
      originalSentence = lines[1];
      const second = lines.slice(2).join(' ');
      if (/_{2,}|\.{3,}/.test(second)) {
        const parts = second.split(/(?:_{2,}|\.{3,})/);
        if (parts.length > 2) {
          gapTemplate = second.replace(/\.{3,}|_{2,}/g, '___').trim();
        } else {
          givenStart = parts[0].replace(/^(?:→|->|=>)\s*/, '').trim();
          givenEnd = (parts[1] || '').trim();
        }
      }
    } else if (/_{2,}|\.{3,}/.test(lines[1])) {
      originalSentence = lines[0];
      const second = lines[1];
      const parts = second.split(/(?:_{2,}|\.{3,})/);
      if (parts.length > 2) {
        gapTemplate = second.replace(/\.{3,}|_{2,}/g, '___').trim();
      } else {
        givenStart = parts[0].replace(/^(?:→|->|=>)\s*/, '').trim();
        givenEnd = (parts[1] || '').trim();
      }
    }
  }

  // Extract keyword in parentheses or square brackets: `(DESPITE)`, `[TOO]`, `(Use: although)`, `(Passive)`
  const kwBracketMatch = originalSentence.match(/\s*[\(\[]([A-Z][A-Z\s/'-]{1,28})[\)\]]\s*\.?$/);
  const kwHintMatch = originalSentence.match(/\s*\((?:Use|Using|With|Dùng|Từ khóa)[:\s]+([^)]+)\)\s*\.?$/i);
  if (kwBracketMatch) {
    const candidate = kwBracketMatch[1].trim();
    if (!/^(?:PASSIVE|REPORTED|CONDITIONAL|RELATIVE|CLEFT|GERUND)$/i.test(candidate)) {
      keyword = candidate;
      keepKeywordUnchanged = true;
      originalSentence = originalSentence.replace(kwBracketMatch[0], '').trim();
    }
  } else if (kwHintMatch) {
    keyword = kwHintMatch[1].trim();
    originalSentence = originalSentence.replace(kwHintMatch[0], '').trim();
  } else {
    // Also detect `(Use 'despite')` or `(in spite of)`
    const parenDirective = originalSentence.match(/\s*\(([^()]{2,36})\)\s*$/);
    if (parenDirective) {
      const inner = parenDirective[1].trim();
      if (/^(?:Use|Rewrite|Combine|Begin|Start|Passive|Reported|Cleft|Relative|Conditional|Change)/i.test(inner)) {
        instruction = instruction || inner;
        originalSentence = originalSentence.replace(parenDirective[0], '').trim();
      } else if (/^[a-zA-Z\s/'-]+$/.test(inner) && inner.split(/\s+/).length <= 4) {
        keyword = inner;
        originalSentence = originalSentence.replace(parenDirective[0], '').trim();
      }
    }
  }

  // Remove inline instruction prefix from originalSentence if present
  const prefixInstr = originalSentence.match(
    /^(Rewrite(?:\s+the\s+sentence|\s+using[^:]*)?|Combine\s+the\s+sentences|Complete\s+the\s+second\s+sentence|Change\s+into\s+passive|Turn\s+into\s+reported\s+speech|Viết\s+lại\s+câu[^:]*)\s*:\s*/i,
  );
  if (prefixInstr) {
    instruction = instruction || prefixInstr[1].trim();
    originalSentence = originalSentence.slice(prefixInstr[0].length).trim();
  }

  let subtype: TransformationSubtype = 'full_rewrite';
  if (gapTemplate) {
    subtype = 'gap_completion';
  } else if (keyword && keepKeywordUnchanged) {
    subtype = 'keyword_unchanged';
  } else if (keyword) {
    subtype = 'keyword';
  } else if (givenStart || givenEnd) {
    subtype = 'given_start';
  }

  return {
    subtype,
    originalSentence: originalSentence || rawPrompt,
    instruction: instruction || undefined,
    givenStart: givenStart || undefined,
    givenEnd: givenEnd || undefined,
    gapTemplate: gapTemplate || undefined,
    keyword: keyword || undefined,
    keepKeywordUnchanged,
    wordLimit,
    hints: question.transformation?.hints || [],
    gradingRules: question.transformation?.gradingRules || DEFAULT_TRANSFORMATION_GRADING_RULES,
  };
}

export function getGapTemplateSegments(gapTemplate: string): string[] {
  return gapTemplate.split(/_{2,}/);
}

/**
 * Reconstructs the complete sentence from student input, supporting:
 * - Multi-gap inputs joined by `|||`
 * - Partial input when `givenStart` / `givenEnd` is provided (auto-prepends/appends if student typed only the missing part)
 * - Full sentence input even when `givenStart` is provided
 */
export function reconstructStudentSentence(
  rawInput: string,
  meta: SentenceTransformationMeta,
  rules: TransformationGradingRules = DEFAULT_TRANSFORMATION_GRADING_RULES,
): {reconstructed: string; typedSegment: string; gapParts?: string[]} {
  const merged = {...DEFAULT_TRANSFORMATION_GRADING_RULES, ...rules};

  // Multi-gap completion (`gapTemplate` like `She is ___ young ___ drive a car.`)
  if (meta.subtype === 'gap_completion' && meta.gapTemplate && /_{2,}/.test(meta.gapTemplate)) {
    const segments = getGapTemplateSegments(meta.gapTemplate);
    const gapCount = Math.max(1, segments.length - 1);
    const parts = rawInput.includes('|||')
      ? rawInput.split('|||').map((p) => cleanSurfaceWhitespace(p))
      : [cleanSurfaceWhitespace(rawInput)];

    if (gapCount === 1 && parts.length === 1) {
      const typed = parts[0];
      const before = segments[0].trim();
      const after = (segments[1] || '').trim();
      const normTyped = normalizeForComparison(typed, {...merged, strictPunctuation: false});
      const normBefore = normalizeForComparison(before, {...merged, strictPunctuation: false});
      // If user typed full sentence already
      if (before && normBefore && normTyped.startsWith(normBefore)) {
        return {reconstructed: typed, typedSegment: typed, gapParts: parts};
      }
      const combined = [before, typed, after].filter(Boolean).join(' ');
      return {reconstructed: cleanSurfaceWhitespace(combined), typedSegment: typed, gapParts: parts};
    }

    let built = '';
    for (let i = 0; i < segments.length; i++) {
      built += segments[i];
      if (i < gapCount) {
        built += ` ${parts[i] || ''} `;
      }
    }
    return {
      reconstructed: cleanSurfaceWhitespace(built),
      typedSegment: parts.filter(Boolean).join(' '),
      gapParts: parts,
    };
  }

  const trimmed = cleanSurfaceWhitespace(rawInput);
  if (!trimmed) {
    return {reconstructed: '', typedSegment: ''};
  }

  const givenStart = cleanSurfaceWhitespace(meta.givenStart || '');
  const givenEnd = cleanSurfaceWhitespace(meta.givenEnd || '');

  if (!givenStart && !givenEnd) {
    return {reconstructed: trimmed, typedSegment: trimmed};
  }

  const normTrimmed = normalizeForComparison(trimmed, {...merged, strictPunctuation: false});
  const normStart = normalizeForComparison(givenStart, {...merged, strictPunctuation: false});
  const normEnd = normalizeForComparison(givenEnd, {...merged, strictPunctuation: false});

  let sentence = trimmed;
  let typedSegment = trimmed;

  const startsWithGiven = Boolean(normStart && normTrimmed.startsWith(normStart));
  const endsWithGiven = Boolean(normEnd && normTrimmed.endsWith(normEnd));

  if (merged.acceptRemainingOnly) {
    if (givenStart && !startsWithGiven) {
      sentence = `${givenStart} ${sentence}`;
    } else if (givenStart && startsWithGiven) {
      // Extract segment after givenStart for word-limit check if needed
      const startWordCount = countSurfaceWords(givenStart);
      const allWords = trimmed.split(/\s+/);
      typedSegment = allWords.slice(startWordCount).join(' ');
    }

    if (givenEnd && !endsWithGiven) {
      const endsWithPunct = /^[.,!?;:]/.test(givenEnd);
      sentence = endsWithPunct ? `${sentence}${givenEnd}` : `${sentence} ${givenEnd}`;
    } else if (givenEnd && endsWithGiven) {
      const endWordCount = countSurfaceWords(givenEnd);
      const segWords = typedSegment.split(/\s+/);
      if (segWords.length > endWordCount) {
        typedSegment = segWords.slice(0, segWords.length - endWordCount).join(' ');
      }
    }
  }

  return {
    reconstructed: cleanSurfaceWhitespace(sentence),
    typedSegment: cleanSurfaceWhitespace(typedSegment),
  };
}

function checkMinorFormatIssues(
  rawInput: string,
  reconstructed: string,
  matchedTarget: string,
  meta: SentenceTransformationMeta,
  rules: Required<TransformationGradingRules>,
): string[] {
  const issues: string[] = [];
  const rawTrimmed = stripHtmlTags(rawInput).trim();
  const isFullSentenceTyped =
    !meta.givenStart && meta.subtype !== 'gap_completion' && reconstructed.length > 0;

  if (/\s{2,}/.test(rawTrimmed)) {
    issues.push('Có khoảng trắng thừa giữa các từ.');
  }

  if (isFullSentenceTyped && /^[a-z]/.test(reconstructed)) {
    issues.push('Chữ cái đầu câu nên viết hoa.');
  }

  // Check ending punctuation when typing full sentence or ending part (when no givenEnd)
  if (!meta.givenEnd && meta.subtype !== 'gap_completion') {
    const targetTrimmed = cleanSurfaceWhitespace(matchedTarget);
    const targetEndPunct = targetTrimmed.match(/[.!?]$/)?.[0];
    const userEndPunct = reconstructed.match(/[.!?]$/)?.[0];
    if (targetEndPunct && !userEndPunct) {
      issues.push(`Thiếu dấu kết câu ("${targetEndPunct}") ở cuối câu.`);
    } else if (targetEndPunct && userEndPunct && targetEndPunct !== userEndPunct) {
      issues.push(`Dấu kết câu nên là "${targetEndPunct}" thay vì "${userEndPunct}".`);
    }
  }

  // Case difference check when caseSensitive is false
  if (!rules.caseSensitive && isFullSentenceTyped) {
    const firstExpected = cleanSurfaceWhitespace(matchedTarget)[0];
    const firstActual = reconstructed[0];
    if (
      firstExpected &&
      firstActual &&
      firstExpected === firstExpected.toUpperCase() &&
      firstActual !== firstActual.toUpperCase() &&
      !issues.some((m) => m.includes('viết hoa'))
    ) {
      issues.push('Nên viết hoa chữ cái đầu câu.');
    }
  }

  return issues;
}

function checkKeywordConstraint(
  reconstructed: string,
  meta: SentenceTransformationMeta,
): TransformationErrorDiagnostic | null {
  if (!meta.keyword) return null;
  const kw = cleanSurfaceWhitespace(meta.keyword);
  if (!kw) return null;

  const escaped = kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exactRegex = new RegExp(`\\b${escaped}\\b`, 'i');
  const normSentence = normalizeApostrophesAndQuotes(reconstructed).toLowerCase();

  if (exactRegex.test(normSentence)) {
    return null;
  }

  // Check if user changed the word form of the keyword (e.g. "DESPITE" vs missing, or "INTEREST" -> "interested")
  const root = kw.toLowerCase().replace(/(?:ing|ed|es|s|ly)$/, '');
  const modifiedRegex = root.length >= 3 ? new RegExp(`\\b${root}[a-z]*\\b`, 'i') : null;

  if (meta.keepKeywordUnchanged && modifiedRegex && modifiedRegex.test(normSentence)) {
    return {
      category: 'missing_or_changed_keyword',
      labelVi: 'Biến đổi từ khóa bắt buộc',
      detailVi: `Từ khóa "${kw}" phải được giữ nguyên dạng, không được chia hoặc biến đổi dạng từ.`,
    };
  }

  if (!meta.keepKeywordUnchanged && modifiedRegex && modifiedRegex.test(normSentence)) {
    // Allowed to inflect keyword when keepKeywordUnchanged is false
    return null;
  }

  return {
    category: 'missing_or_changed_keyword',
    labelVi: 'Thiếu từ khóa bắt buộc',
    detailVi: `Câu viết lại chưa sử dụng từ khóa yêu cầu "${kw}".`,
  };
}

function checkWordLimitConstraint(
  typedSegment: string,
  reconstructed: string,
  meta: SentenceTransformationMeta,
): {diagnostic: TransformationErrorDiagnostic | null; count: number} {
  const targetText =
    meta.givenStart || meta.givenEnd || meta.subtype === 'gap_completion'
      ? typedSegment
      : reconstructed;
  const count = countSurfaceWords(targetText);
  if (!meta.wordLimit) return {diagnostic: null, count};

  const {min, max} = meta.wordLimit;
  if (typeof max === 'number' && count > max) {
    return {
      count,
      diagnostic: {
        category: 'word_limit_exceeded',
        labelVi: 'Vượt giới hạn số từ',
        detailVi: `Bạn đã viết ${count} từ, vượt quá giới hạn tối đa ${max} từ.`,
      },
    };
  }
  if (typeof min === 'number' && count < min) {
    return {
      count,
      diagnostic: {
        category: 'word_limit_exceeded',
        labelVi: 'Chưa đủ số từ tối thiểu',
        detailVi: `Bạn mới viết ${count} từ, yêu cầu tối thiểu ${min} từ.`,
      },
    };
  }
  return {diagnostic: null, count};
}

function detectNegationPolarityShift(userTokens: string[], targetTokens: string[]): boolean {
  const userNeg = userTokens.filter((t) => NEGATION_TOKENS.has(t)).length;
  const targetNeg = targetTokens.filter((t) => NEGATION_TOKENS.has(t)).length;
  // Opposite polarity (one negated, one affirmative)
  return (userNeg % 2) !== (targetNeg % 2);
}

function analyzeRuleBasedDiagnostics(
  reconstructed: string,
  bestTarget: string,
  meta: SentenceTransformationMeta,
): TransformationErrorDiagnostic[] {
  const diagnostics: TransformationErrorDiagnostic[] = [];
  const userTokens = tokenizeWords(reconstructed);
  const targetTokens = tokenizeWords(bestTarget);
  const userSet = new Set(userTokens);
  const targetSet = new Set(targetTokens);

  const missingTokens = targetTokens.filter((t) => !userSet.has(t));
  const extraTokens = userTokens.filter((t) => !targetSet.has(t));

  // 1. Meaning / Polarity shift check
  if (detectNegationPolarityShift(userTokens, targetTokens)) {
    diagnostics.push({
      category: 'meaning_changed',
      labelVi: 'Sai nghĩa / Đảo ngược phủ định',
      detailVi: 'Câu viết lại làm thay đổi nghĩa khẳng định/phủ định so với câu gốc.',
    });
  }

  // 2. Passive voice structure check
  const targetLower = bestTarget.toLowerCase();
  const userLower = reconstructed.toLowerCase();
  const targetIsPassive =
    /\b(?:is|are|was|were|be|been|being)\s+(?:not\s+)?[a-z]+(?:ed|en|t|wn|ne|id|ht)\b/.test(targetLower) &&
    (/passive|bị động/i.test(meta.grammarTopic || '') || /\bby\b/.test(targetLower) || /\bbeen\b/.test(targetLower));

  if (targetIsPassive) {
    const userHasBeAux = /\b(?:is|are|was|were|be|been|being)\b/.test(userLower);
    if (!userHasBeAux) {
      diagnostics.push({
        category: 'wrong_passive',
        labelVi: 'Sai cấu trúc bị động',
        detailVi: 'Thiếu động từ "be" (is/are/was/were/be/been) kết hợp phân từ hai (V3/ed) trong câu bị động.',
      });
    }
  }

  // 3. Missing auxiliary verb
  const missingAux = missingTokens.filter((t) => AUXILIARIES.has(t));
  const extraAux = extraTokens.filter((t) => AUXILIARIES.has(t));
  if (missingAux.length > 0 && extraAux.length === 0) {
    diagnostics.push({
      category: 'missing_auxiliary',
      labelVi: 'Thiếu trợ động từ',
      detailVi: `Câu thiếu trợ động từ cần thiết (ví dụ: "${missingAux.slice(0, 2).join(', ')}").`,
    });
  }

  // 4. Wrong tense (conflicting auxiliaries or tense markers)
  if (missingAux.length > 0 && extraAux.length > 0) {
    diagnostics.push({
      category: 'wrong_tense',
      labelVi: 'Sai thì động từ',
      detailVi: `Trợ động từ/thì chưa khớp (bạn dùng "${extraAux[0]}", cần kiểm tra lại thì của câu viết lại).`,
    });
  }

  // 5. Wrong verb form (same stem, different ending: V-ing vs to-V vs V3/ed vs V0)
  let foundVerbFormError = false;
  for (const extra of extraTokens) {
    if (extra.length < 4) continue;
    const stemE = extra.replace(/(?:ing|ed|es|s)$/, '');
    if (stemE.length < 3) continue;
    for (const miss of missingTokens) {
      const stemM = miss.replace(/(?:ing|ed|es|s)$/, '');
      if (stemE === stemM && extra !== miss) {
        foundVerbFormError = true;
        diagnostics.push({
          category: 'wrong_verb_form',
          labelVi: 'Sai dạng động từ',
          detailVi: `Kiểm tra lại dạng từ "${extra}" (V-ing / to-V / V3-ed / V nguyên mẫu).`,
        });
        break;
      }
    }
    if (foundVerbFormError) break;
  }

  // Check to-infinitive vs V-ing mismatch
  if (!foundVerbFormError) {
    const targetHasToV = /\bto\s+[a-z]{3,}\b/.test(targetLower);
    const userHasVing = /\b[a-z]{3,}ing\b/.test(userLower);
    const targetHasVing = /\b[a-z]{3,}ing\b/.test(targetLower);
    const userHasToV = /\bto\s+[a-z]{3,}\b/.test(userLower);
    if ((targetHasToV && !userHasToV && userHasVing) || (targetHasVing && !userHasVing && userHasToV)) {
      diagnostics.push({
        category: 'wrong_verb_form',
        labelVi: 'Sai dạng động từ (to-V / V-ing)',
        detailVi: 'Kiểm tra lại cấu trúc yêu cầu dùng V-ing hay to-infinitive (to V).',
      });
    }
  }

  // 6. Wrong preposition
  const missingPreps = missingTokens.filter((t) => PREPOSITIONS.has(t));
  const extraPreps = extraTokens.filter((t) => PREPOSITIONS.has(t));
  if (missingPreps.length > 0 && (extraPreps.length > 0 || missingPreps.some((p) => ['of', 'in', 'on', 'at', 'for', 'since', 'by', 'from', 'with'].includes(p)))) {
    diagnostics.push({
      category: 'wrong_preposition',
      labelVi: 'Sai hoặc thiếu giới từ',
      detailVi:
        extraPreps.length > 0
          ? `Giới từ "${extraPreps[0]}" chưa phù hợp với cấu trúc yêu cầu.`
          : `Kiểm tra lại giới từ đi kèm cấu trúc (ví dụ: "${missingPreps[0]}").`,
    });
  }

  // 7. Word order error (same multiset of words, wrong order)
  const sortedUser = [...userTokens].sort().join(' ');
  const sortedTarget = [...targetTokens].sort().join(' ');
  if (userTokens.length >= 4 && sortedUser === sortedTarget && userTokens.join(' ') !== targetTokens.join(' ')) {
    diagnostics.push({
      category: 'wrong_word_order',
      labelVi: 'Sai trật tự từ',
      detailVi: 'Các từ đã đủ nhưng trật tự sắp xếp trong câu chưa đúng ngữ pháp tiếng Anh.',
    });
  }

  // 8. Spelling error (1-2 edit distance on content word)
  const typoPairs: Array<[string, string]> = [];
  for (const extra of extraTokens) {
    if (extra.length < 4 || PREPOSITIONS.has(extra) || AUXILIARIES.has(extra)) continue;
    for (const miss of missingTokens) {
      if (miss.length < 4 || PREPOSITIONS.has(miss) || AUXILIARIES.has(miss)) continue;
      const dist = levenshtein(extra, miss);
      // Avoid flagging verb-form differences as typos
      const sameStem = extra.replace(/(?:ing|ed|es|s)$/, '') === miss.replace(/(?:ing|ed|es|s)$/, '');
      if (dist >= 1 && dist <= 2 && !sameStem) {
        typoPairs.push([extra, miss]);
        break;
      }
    }
  }
  if (typoPairs.length > 0) {
    diagnostics.push({
      category: 'spelling_error',
      labelVi: 'Lỗi chính tả',
      detailVi: `Kiểm tra lại chính tả từ "${typoPairs[0][0]}" (gần với "${typoPairs[0][1]}").`,
    });
  }

  // 9. Missing clause component (significantly shorter than model)
  if (userTokens.length < Math.max(3, Math.floor(targetTokens.length * 0.65))) {
    diagnostics.push({
      category: 'missing_clause_component',
      labelVi: 'Thiếu thành phần câu',
      detailVi: 'Câu viết lại còn thiếu mệnh đề hoặc thông tin quan trọng so với câu gốc.',
    });
  }

  // 10. General structure mismatch fallback
  if (diagnostics.length === 0) {
    diagnostics.push({
      category: 'structure_mismatch',
      labelVi: 'Chưa khớp cấu trúc yêu cầu',
      detailVi: meta.structurePattern
        ? `Đối chiếu lại mẫu cấu trúc: ${meta.structurePattern}.`
        : 'Câu chưa khớp với cấu trúc viết lại câu mong đợi; hãy kiểm tra lại chủ ngữ, thì và cụm từ nối.',
    });
  }

  // Deduplicate by category
  const seen = new Set<string>();
  return diagnostics.filter((d) => {
    if (seen.has(d.category)) return false;
    seen.add(d.category);
    return true;
  });
}

function isPlausibleTeacherReviewCandidate(
  reconstructed: string,
  targetCandidates: string[],
  meta: SentenceTransformationMeta,
  diagnostics: TransformationErrorDiagnostic[],
): boolean {
  // NEVER route to needs_teacher_review if there is a clear hard violation
  const hardErrors = new Set([
    'missing_or_changed_keyword',
    'word_limit_exceeded',
    'meaning_changed',
    'wrong_passive',
    'wrong_tense',
    'wrong_verb_form',
    'missing_auxiliary',
    'missing_clause_component',
    'spelling_error',
    'wrong_word_order',
  ]);
  if (diagnostics.some((d) => hardErrors.has(d.category))) {
    return false;
  }

  const userTokens = tokenizeWords(reconstructed);
  if (userTokens.length < 4) return false;

  // Must not be virtually identical to the original sentence without rewriting
  const origTokens = tokenizeWords(meta.originalSentence);
  if (
    origTokens.length > 0 &&
    userTokens.join(' ') === origTokens.join(' ')
  ) {
    return false;
  }

  // Must retain core content words and reasonable length compared to best model answer
  const bestTarget = targetCandidates[0] || '';
  const targetTokens = tokenizeWords(bestTarget);
  if (targetTokens.length === 0) return false;

  const lengthRatio = userTokens.length / targetTokens.length;
  if (lengthRatio < 0.72 || lengthRatio > 1.38) return false;

  const targetContent = targetTokens.filter(
    (t) => t.length >= 3 && !STOPWORDS.has(t) && !AUXILIARIES.has(t) && !PREPOSITIONS.has(t),
  );
  if (targetContent.length === 0) return false;

  const userSet = new Set(userTokens);
  const overlapCount = targetContent.filter((t) => userSet.has(t)).length;
  const contentOverlap = overlapCount / targetContent.length;

  // Also check that if givenStart was provided, sentence starts with it
  if (meta.givenStart) {
    const normStart = normalizeForComparison(meta.givenStart, {strictPunctuation: false});
    const normUser = normalizeForComparison(reconstructed, {strictPunctuation: false});
    if (normStart && !normUser.startsWith(normStart)) return false;
  }

  // Plausible alternative phrasing: shares >= 60% of content words, no polarity/tense/keyword/passive violation
  return contentOverlap >= 0.6;
}

/**
 * Shared single-source-of-truth Sentence Transformation evaluator.
 * Used in Lesson Practice, Slide Presenter, Assessment Center, Exam Preview, and Interactive Lab.
 */
export function evaluateSentenceTransformation(
  question: Pick<
    QuestionItem,
    'id' | 'prompt' | 'correctAnswer' | 'acceptedAnswers' | 'transformation' | 'explanation'
  >,
  rawUserInput: string,
  extraAcceptedAnswers: string[] = [],
): TransformationEvaluationResult {
  const meta = inferTransformationMeta(question);
  const rules: Required<TransformationGradingRules> = {
    ...DEFAULT_TRANSFORMATION_GRADING_RULES,
    ...(meta.gradingRules || {}),
  };

  const {reconstructed, typedSegment} = reconstructStudentSentence(rawUserInput, meta, rules);

  if (!reconstructed.trim()) {
    return {
      status: 'incorrect',
      statusLabelVi: 'Chưa trả lời',
      isPass: false,
      scoreRatio: 0,
      reconstructedSentence: '',
      minorFormatNotes: [],
      diagnostics: [
        {
          category: 'missing_clause_component',
          labelVi: 'Chưa nhập câu trả lời',
          detailVi: 'Hãy viết câu hoàn chỉnh hoặc điền phần còn thiếu trước khi kiểm tra.',
        },
      ],
      wordCountUsed: 0,
      canTeacherApprove: false,
      summaryVi: 'Bạn chưa nhập nội dung câu viết lại.',
    };
  }

  // Gather all accepted answers: primary + question.acceptedAnswers + teacher-approved + extra
  const teacherApproved = question.id ? getTeacherAcceptedAnswers(question.id) : [];
  const rawTargets = [
    question.correctAnswer,
    ...(question.acceptedAnswers || []),
    ...teacherApproved,
    ...extraAcceptedAnswers,
  ]
    .map((s) => cleanSurfaceWhitespace(s || ''))
    .filter(Boolean);

  // Deduplicate targets while preserving order
  const targets: string[] = [];
  const seenTargets = new Set<string>();
  for (const t of rawTargets) {
    const key = t.toLowerCase();
    if (!seenTargets.has(key)) {
      seenTargets.add(key);
      targets.push(t);
    }
  }

  // Also allow matching against the remaining segment of targets when givenStart/givenEnd exist
  const normalizedUserFull = normalizeForComparison(reconstructed, rules);
  const normalizedUserLoose = normalizeForComparison(reconstructed, {
    ...rules,
    caseSensitive: false,
    strictPunctuation: false,
    allowContractions: true,
    allowBritishAmericanSpelling: true,
  });

  // Check hard constraints FIRST (keyword & word limit)
  const keywordError = checkKeywordConstraint(reconstructed, meta);
  const {diagnostic: wordLimitError, count: wordCountUsed} = checkWordLimitConstraint(
    typedSegment,
    reconstructed,
    meta,
  );

  // 1. Check strict match against any accepted target (only if keyword & word limit satisfied)
  if (!keywordError && !wordLimitError) {
    for (const target of targets) {
      // Build full version of target if target was authored as remaining-part-only
      const fullTarget = reconstructStudentSentence(target, meta, rules).reconstructed || target;
      const normTargetStrict = normalizeForComparison(fullTarget, rules);
      const normTargetRaw = normalizeForComparison(target, rules);

      if (normalizedUserFull === normTargetStrict || normalizedUserFull === normTargetRaw) {
        const formatNotes = checkMinorFormatIssues(rawUserInput, reconstructed, fullTarget, meta, rules);
        if (formatNotes.length > 0 && rules.strictPunctuation) {
          return {
            status: 'minor_format_error',
            statusLabelVi: 'Đúng nhưng có lỗi trình bày nhỏ',
            isPass: true,
            scoreRatio: 0.9,
            reconstructedSentence: reconstructed,
            matchedAnswer: fullTarget,
            minorFormatNotes: formatNotes,
            diagnostics: formatNotes.map((note) => ({
              category: 'minor_format',
              labelVi: 'Lỗi trình bày nhỏ',
              detailVi: note,
            })),
            wordCountUsed,
            canTeacherApprove: false,
            summaryVi: 'Nội dung và ngữ pháp chính xác, chỉ cần chú ý trình bày (viết hoa/dấu câu).',
          };
        }

        // Check if capitalization/punctuation slip exists even in default mode
        if (formatNotes.length > 0) {
          return {
            status: 'minor_format_error',
            statusLabelVi: 'Đúng nhưng có lỗi trình bày nhỏ',
            isPass: true,
            scoreRatio: 1,
            reconstructedSentence: reconstructed,
            matchedAnswer: fullTarget,
            minorFormatNotes: formatNotes,
            diagnostics: formatNotes.map((note) => ({
              category: 'minor_format',
              labelVi: 'Lỗi trình bày nhỏ',
              detailVi: note,
            })),
            wordCountUsed,
            canTeacherApprove: false,
            summaryVi: 'Chính xác về nghĩa và cấu trúc ngữ pháp! Lưu ý thêm lỗi trình bày nhỏ bên dưới.',
          };
        }

        return {
          status: 'correct',
          statusLabelVi: 'Chính xác',
          isPass: true,
          scoreRatio: 1,
          reconstructedSentence: reconstructed,
          matchedAnswer: fullTarget,
          minorFormatNotes: [],
          diagnostics: [],
          wordCountUsed,
          canTeacherApprove: false,
          summaryVi: 'Chính xác! Câu viết lại giữ đúng nghĩa và chuẩn cấu trúc ngữ pháp.',
        };
      }
    }

    // 2. Check loose match (e.g. caseSensitive was true or strictPunctuation was true, so only formatting differed)
    for (const target of targets) {
      const fullTarget = reconstructStudentSentence(target, meta, rules).reconstructed || target;
      const normTargetLoose = normalizeForComparison(fullTarget, {
        ...rules,
        caseSensitive: false,
        strictPunctuation: false,
        allowContractions: true,
        allowBritishAmericanSpelling: true,
      });
      if (normalizedUserLoose === normTargetLoose) {
        const formatNotes = checkMinorFormatIssues(rawUserInput, reconstructed, fullTarget, meta, rules);
        if (formatNotes.length === 0) {
          formatNotes.push('Khác biệt nhỏ về chữ hoa/chữ thường, dấu câu hoặc dạng viết tắt.');
        }
        return {
          status: 'minor_format_error',
          statusLabelVi: 'Đúng nhưng có lỗi trình bày nhỏ',
          isPass: true,
          scoreRatio: 0.9,
          reconstructedSentence: reconstructed,
          matchedAnswer: fullTarget,
          minorFormatNotes: formatNotes,
          diagnostics: formatNotes.map((note) => ({
            category: 'minor_format',
            labelVi: 'Lỗi trình bày nhỏ',
            detailVi: note,
          })),
          wordCountUsed,
          canTeacherApprove: false,
          summaryVi: 'Câu viết lại đúng về ngữ pháp nhưng có lỗi trình bày nhỏ (chữ hoa/dấu câu).',
        };
      }
    }
  }

  // 3. Not an exact match -> pick closest target for diagnostic error analysis
  const userTokenSet = new Set(tokenizeWords(reconstructed));
  let bestTarget = targets[0] || '';
  let bestOverlap = -1;
  for (const t of targets) {
    const fullT = reconstructStudentSentence(t, meta, rules).reconstructed || t;
    const tTokens = tokenizeWords(fullT);
    const overlap = tTokens.filter((w) => userTokenSet.has(w)).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestTarget = fullT;
    }
  }

  const diagnostics: TransformationErrorDiagnostic[] = [];
  if (keywordError) diagnostics.push(keywordError);
  if (wordLimitError) diagnostics.push(wordLimitError);
  diagnostics.push(...analyzeRuleBasedDiagnostics(reconstructed, bestTarget, meta));

  // Deduplicate diagnostics
  const uniqueDiagnostics: TransformationErrorDiagnostic[] = [];
  const seenCat = new Set<string>();
  for (const d of diagnostics) {
    if (!seenCat.has(d.category)) {
      seenCat.add(d.category);
      uniqueDiagnostics.push(d);
    }
  }

  // 4. Determine whether this is a plausible paraphrase needing teacher review
  if (
    !keywordError &&
    !wordLimitError &&
    isPlausibleTeacherReviewCandidate(reconstructed, targets, meta, uniqueDiagnostics)
  ) {
    return {
      status: 'needs_teacher_review',
      statusLabelVi: 'Cần giáo viên xem xét',
      isPass: false,
      scoreRatio: 0,
      reconstructedSentence: reconstructed,
      minorFormatNotes: [],
      diagnostics: [
        {
          category: 'structure_mismatch',
          labelVi: 'Cách diễn đạt chưa có trong danh sách đáp án mẫu',
          detailVi:
            'Câu của học sinh giữ được nhiều từ khóa nội dung và không vi phạm điều kiện từ khóa/số từ, nhưng khác đáp án chuẩn. Giáo viên có thể kiểm tra và xác nhận bổ sung làm đáp án chấp nhận.',
        },
      ],
      wordCountUsed,
      canTeacherApprove: true,
      summaryVi:
        'Câu trả lời khác đáp án chuẩn nhưng có thể là một cách diễn đạt hợp lệ — cần giáo viên xem xét.',
    };
  }

  return {
    status: 'incorrect',
    statusLabelVi: 'Chưa chính xác',
    isPass: false,
    scoreRatio: 0,
    reconstructedSentence: reconstructed,
    minorFormatNotes: [],
    diagnostics: uniqueDiagnostics,
    wordCountUsed,
    canTeacherApprove: !keywordError && !wordLimitError && reconstructed.length > 6,
    summaryVi: uniqueDiagnostics[0]?.detailVi || 'Câu viết lại chưa khớp cấu trúc hoặc nghĩa yêu cầu.',
  };
}

/**
 * Builds a clean human-readable prompt string from SentenceTransformationMeta
 * so legacy viewers, search indexes, and exports always stay in sync.
 */
export function buildTransformationPromptText(meta: SentenceTransformationMeta): string {
  const parts: string[] = [];
  if (meta.originalSentence) {
    parts.push(meta.originalSentence.trim());
  }
  if (meta.keyword) {
    parts.push(`(${meta.keyword.trim()})`);
  }
  if (meta.subtype === 'gap_completion' && meta.gapTemplate) {
    parts.push(`→ ${meta.gapTemplate.trim()}`);
  } else if (meta.givenStart || meta.givenEnd) {
    const start = meta.givenStart ? `${meta.givenStart.trim()} ` : '';
    const end = meta.givenEnd ? ` ${meta.givenEnd.trim()}` : '.';
    parts.push(`→ ${start}__________${end}`);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
