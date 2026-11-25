import type {Grade, QuestionItem, WritingAIFeedback} from '../types/lesson';

export interface AIStatus {
  configured: boolean;
  online: boolean;
  model?: string;
}

export async function checkAIStatus(): Promise<AIStatus> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {configured: false, online: false};
  }
  try {
    const res = await fetch('/api/ai/status');
    if (!res.ok) return {configured: false, online: true};
    const data = await res.json();
    return {configured: Boolean(data.configured), online: true, model: data.model};
  } catch {
    return {configured: false, online: false};
  }
}

export interface AIDocumentResponse {
  ok: boolean;
  unavailable?: boolean;
  error?: string;
  data?: {
    title?: string;
    instructions?: string;
    detectedGrade?: number;
    detectedLevel?: string;
    gradeEvidence?: string;
    detectedSkill?: string;
    detectedActivityType?: string;
    passages?: Array<{title?: string; paragraphs: string[]}>;
    transcript?: string;
    questions?: Array<{
      number?: number;
      type?: string;
      prompt?: string;
      options?: Array<{label: string; text: string}>;
      correctAnswer?: string;
      explanation?: string;
      passageIndex?: number;
      uncertain?: boolean;
    }>;
    warnings?: string[];
  };
}

export async function ocrImagesWithAI(
  images: Array<{mimeType: string; data: string; name?: string}>,
  grade?: Grade | null,
  skillHint?: string,
): Promise<AIDocumentResponse> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      ok: false,
      unavailable: true,
      error: 'Thiết bị đang ngoại tuyến (Offline). Chức năng nhận diện ảnh/PDF scan cần kết nối Internet. Bạn có thể dán văn bản hoặc soạn thủ công.',
    };
  }
  try {
    const res = await fetch('/api/ai/ocr-images', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({images, grade: grade ?? undefined, skillHint}),
    });
    const data = await res.json();
    return data;
  } catch {
    return {
      ok: false,
      unavailable: true,
      error: 'Không thể kết nối đến máy chủ phân tích AI. Vui lòng kiểm tra kết nối mạng.',
    };
  }
}

export async function refineDocumentWithAI(
  rawText: string,
  grade?: Grade | null,
  skillHint?: string,
): Promise<AIDocumentResponse> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      ok: false,
      unavailable: true,
      error: 'Đang ở chế độ ngoại tuyến. Hệ thống sử dụng bộ phân tích cấu trúc cục bộ.',
    };
  }
  try {
    const res = await fetch('/api/ai/analyze-document', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({rawText, grade: grade ?? undefined, skillHint}),
    });
    return await res.json();
  } catch {
    return {
      ok: false,
      unavailable: true,
      error: 'Không thể kết nối dịch vụ AI. Bộ phân tích cục bộ vẫn hoạt động bình thường.',
    };
  }
}

export async function generateListeningQuestionsAI(params: {
  transcript: string;
  grade: Grade;
  questionType: string;
  count: number;
}): Promise<{ok: boolean; unavailable?: boolean; error?: string; questions?: QuestionItem[]}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      ok: false,
      unavailable: true,
      error: 'Thiết bị đang ngoại tuyến. Chức năng tạo câu hỏi tự động từ transcript cần kết nối mạng.',
    };
  }
  try {
    const res = await fetch('/api/ai/generate-listening-questions', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!data.ok) return data;

    const mapped: QuestionItem[] = (data.questions || []).map(
      (q: Record<string, unknown>, idx: number) => ({
        id: `ai-q-${Date.now()}-${idx}`,
        number: Number(q.number || idx + 1),
        type: (q.type as QuestionItem['type']) || 'mcq',
        prompt: String(q.prompt || ''),
        options: Array.isArray(q.options)
          ? (q.options as Array<{label: string; text: string}>).map((opt, oi) => ({
              id: `opt-${idx}-${oi}`,
              label: opt.label || String.fromCharCode(65 + oi),
              text: opt.text || '',
            }))
          : undefined,
        correctAnswer: String(q.correctAnswer || ''),
        explanation: String(q.explanation || ''),
        cognitiveLevel: 'comprehension',
      }),
    );

    return {ok: true, questions: mapped};
  } catch {
    return {
      ok: false,
      unavailable: true,
      error: 'Không thể kết nối dịch vụ AI để tạo câu hỏi.',
    };
  }
}

export async function requestWritingFeedbackAI(params: {
  promptText: string;
  studentText: string;
  grade: Grade;
}): Promise<{ok: boolean; unavailable?: boolean; error?: string; feedback?: WritingAIFeedback}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      ok: false,
      unavailable: true,
      error: 'Thiết bị đang ngoại tuyến. Tính năng nhận xét bài viết bằng AI chỉ khả dụng khi có mạng. Giáo viên vẫn có thể chấm theo bảng tiêu chí ngoại tuyến.',
    };
  }
  try {
    const res = await fetch('/api/ai/writing-feedback', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch {
    return {
      ok: false,
      unavailable: true,
      error: 'Không thể kết nối máy chủ nhận xét AI.',
    };
  }
}

export async function generateSpeechTTS(params: {
  text: string;
  accent: 'en-GB' | 'en-US';
}): Promise<{ok: boolean; unavailable?: boolean; error?: string; dataUrl?: string; mimeType?: string}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      ok: false,
      unavailable: true,
      error: 'Thiết bị đang ngoại tuyến. Không thể tạo tệp WAV trực tuyến; hệ thống sẽ dùng giọng đọc tổng hợp sẵn có trên trình duyệt.',
    };
  }
  try {
    const res = await fetch('/api/ai/tts', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch {
    return {
      ok: false,
      unavailable: true,
      error: 'Không thể kết nối máy chủ tạo giọng đọc. Bạn có thể nghe trực tiếp bằng giọng đọc tổng hợp trình duyệt.',
    };
  }
}

export async function generateExamItemsAI(params: {
  grade: 10 | 11 | 12;
  topic: string;
  skill: string;
  format: string;
  cognitiveLevel: string;
  learningOutcome: string;
  count: number;
}): Promise<{
  ok: boolean;
  unavailable?: boolean;
  error?: string;
  data?: {
    stimulusTitle?: string;
    stimulusText?: string;
    questions?: Array<{
      prompt: string;
      options?: Array<{label: string; text: string}>;
      correctAnswer: string;
      acceptedAnswers?: string[];
      explanation: string;
    }>;
  };
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      ok: false,
      unavailable: true,
      error: 'Thiết bị đang ngoại tuyến. Bạn vẫn có thể lấy câu hỏi từ Ngân hàng câu hỏi hoặc soạn thủ công.',
    };
  }
  try {
    const res = await fetch('/api/ai/generate-exam-items', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch {
    return {
      ok: false,
      unavailable: true,
      error: 'Không thể kết nối dịch vụ AI. Hệ thống vẫn hoạt động đầy đủ ở chế độ ngoại tuyến.',
    };
  }
}


