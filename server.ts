import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GoogleGenAI, ThinkingLevel, Type} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(apiVersion?: string) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? {apiVersion} : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function classifyGeminiError(err: unknown): {status: number; message: string} {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID') || raw.includes('403')) {
    return {
      status: 403,
      message: 'Dịch vụ AI chưa được cấp quyền hoặc khóa API chưa hợp lệ. Vui lòng kiểm tra trong Settings > Secrets hoặc tiếp tục sử dụng chế độ ngoại tuyến.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'Dịch vụ AI tạm thời vượt giới hạn yêu cầu. Vui lòng thử lại sau ít phút hoặc tiếp tục chỉnh sửa thủ công.',
    };
  }
  return {
    status: 502,
    message: `Không thể kết nối dịch vụ AI: ${raw.slice(0, 180)}`,
  };
}

async function createServer() {
  const app = express();
  app.use(express.json({limit: '25mb'}));

  // Health & AI availability check (never exposes API key)
  app.get('/api/ai/status', (_req, res) => {
    const client = getGeminiClient();
    res.json({
      configured: Boolean(client),
      model: MODEL_NAME,
    });
  });

  // OCR & Vision structural analysis for scanned PDFs and photos
  app.post('/api/ai/ocr-images', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        ok: false,
        unavailable: true,
        error: 'Dịch vụ AI thị giác hiện chưa được kích hoạt trên máy chủ. Không thể OCR tự động từ ảnh hoặc PDF scan. Bạn vẫn có thể nhập hoặc dán nội dung trực tiếp.',
      });
      return;
    }

    try {
      const {images, grade, skillHint} = req.body as {
        images?: Array<{mimeType: string; data: string; name?: string}>;
        grade?: number;
        skillHint?: string;
      };

      if (!Array.isArray(images) || images.length === 0) {
        res.status(400).json({ok: false, error: 'Vui lòng gửi ít nhất một hình ảnh hợp lệ.'});
        return;
      }

      const imageParts = images.slice(0, 8).map((img) => ({
        inlineData: {
          mimeType: img.mimeType || 'image/jpeg',
          data: img.data,
        },
      }));

      const levelText =
        typeof grade === 'number'
          ? grade <= 5
            ? `Tiểu học (Lớp ${grade})`
            : grade <= 9
              ? `THCS (Lớp ${grade})`
              : `THPT (Lớp ${grade})`
          : 'Lớp 1–12 (tự nhận diện nếu có căn cứ rõ)';

      const prompt = `Bạn là chuyên gia số hóa đề và tài liệu Tiếng Anh phổ thông Việt Nam (Lớp 1–12: Tiểu học, THCS, THPT theo Chương trình GDPT 2018; gợi ý ban đầu: ${levelText}).
Hãy trích xuất CHÍNH XÁC nội dung từ các hình ảnh tài liệu đính kèm thành JSON có cấu trúc.

QUY TẮC BẮT BUỘC:
1. KHÔNG tự ý sửa đổi, viết lại hay cắt bỏ nội dung tài liệu gốc. Giữ nguyên văn đoạn đọc hiểu và số thứ tự câu hỏi gốc.
2. Với bài phát âm hoặc ngữ âm có chữ cái/nhóm chữ cái được gạch chân trong ảnh, BẮT BUỘC bọc đúng phần gạch chân bằng thẻ <u>...</u> (ví dụ: cook<u>ed</u>, play<u>ed</u>). Không được tự ý đổi vị trí gạch chân.
3. Giữ liên kết câu hỏi chùm với bài đọc hoặc đoạn transcript đi kèm.
4. KHÔNG tự bịa thêm câu hỏi và KHÔNG tự tạo transcript nếu tài liệu ảnh không có transcript (trả transcript = "").
5. Nhận diện khối lớp trung thực:
   - Nếu trong tài liệu có căn cứ rõ ràng về lớp (ví dụ "Tiếng Anh 4", "Grade 7", "Global Success 10", "Lớp 8"...), đặt detectedGrade = số lớp (1..12), detectedLevel = "primary" | "secondary" | "high_school", và nêu rõ bằng chứng trong gradeEvidence.
   - Nếu KHÔNG đủ căn cứ xác định lớp, BẮT BUỘC đặt detectedGrade = 0 (không đoán mò), detectedLevel = "unknown" (hoặc cấp học nếu có bằng chứng rõ ràng về cấp), và ghi rõ lý do trong gradeEvidence.
6. Nếu chữ mờ hoặc chưa có đáp án trong tài liệu, đặt uncertain = true cho câu hỏi đó. Gợi ý kỹ năng ưu tiên: ${skillHint || 'tự nhận diện'}.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [...imageParts, {text: prompt}],
        },
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            required: ['title', 'detectedGrade', 'detectedLevel', 'gradeEvidence', 'detectedSkill', 'questions'],
            properties: {
              title: {type: Type.STRING},
              instructions: {type: Type.STRING},
              detectedGrade: {type: Type.INTEGER},
              detectedLevel: {type: Type.STRING},
              gradeEvidence: {type: Type.STRING},
              detectedSkill: {type: Type.STRING},
              detectedActivityType: {type: Type.STRING},
              passages: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: {type: Type.STRING},
                    paragraphs: {type: Type.ARRAY, items: {type: Type.STRING}},
                  },
                },
              },
              transcript: {type: Type.STRING},
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    number: {type: Type.INTEGER},
                    type: {type: Type.STRING},
                    prompt: {type: Type.STRING},
                    options: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          label: {type: Type.STRING},
                          text: {type: Type.STRING},
                        },
                      },
                    },
                    correctAnswer: {type: Type.STRING},
                    explanation: {type: Type.STRING},
                    passageIndex: {type: Type.INTEGER},
                    uncertain: {type: Type.BOOLEAN},
                  },
                },
              },
              warnings: {type: Type.ARRAY, items: {type: Type.STRING}},
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ok: true, data: parsed});
    } catch (err) {
      const info = classifyGeminiError(err);
      res.status(info.status).json({ok: false, error: info.message});
    }
  });

  // Optional AI structural refinement for extracted raw text (DOCX/PDF/Pasted)
  app.post('/api/ai/analyze-document', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        ok: false,
        unavailable: true,
        error: 'Dịch vụ AI chưa khả dụng. Hệ thống đã sử dụng bộ phân tích cấu trúc cục bộ.',
      });
      return;
    }

    try {
      const {rawText, grade, skillHint} = req.body as {
        rawText?: string;
        grade?: number;
        skillHint?: string;
      };

      if (!rawText || rawText.trim().length < 20) {
        res.status(400).json({ok: false, error: 'Nội dung văn bản quá ngắn để phân tích.'});
        return;
      }

      const levelText =
        typeof grade === 'number'
          ? grade <= 5
            ? `Tiểu học (Lớp ${grade})`
            : grade <= 9
              ? `THCS (Lớp ${grade})`
              : `THPT (Lớp ${grade})`
          : 'Lớp 1–12 (tự nhận diện nếu có căn cứ rõ)';

      const prompt = `Phân tích tài liệu Tiếng Anh phổ thông Việt Nam (${levelText}, kỹ năng gợi ý: ${skillHint || 'tự động'}) thành cấu trúc bài giảng JSON.
QUY TẮC BẮT BUỘC:
- KHÔNG tự ý thay đổi hay viết lại nội dung văn bản gốc.
- Giữ nguyên thẻ <u>...</u> nếu có trong văn bản gốc (đặc biệt với bài phát âm).
- Giữ nguyên đoạn văn đọc hiểu và số thứ tự câu hỏi.
- KHÔNG tự tạo transcript nếu tài liệu gốc không có transcript (trả transcript = "").
- Nhận diện khối lớp trung thực: chỉ trả detectedGrade (1..12) khi văn bản có căn cứ rõ ràng (nêu trong gradeEvidence). Nếu không đủ căn cứ xác định lớp, đặt detectedGrade = 0 và detectedLevel = "unknown".
- Phân loại đúng dạng câu hỏi: mcq, true_false, gap_fill, matching, ordering, word_order, error_correction, transformation, short_answer, pronunciation_underlined.
- Không biến câu tự luận, nối cặp, sắp xếp hoặc điền từ thành trắc nghiệm.
- Đánh dấu uncertain = true nếu đáp án chưa có trong tài liệu gốc.

VĂN BẢN GỐC:
${rawText.slice(0, 18000)}`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            required: ['title', 'detectedGrade', 'detectedLevel', 'gradeEvidence', 'detectedSkill', 'questions'],
            properties: {
              title: {type: Type.STRING},
              instructions: {type: Type.STRING},
              detectedGrade: {type: Type.INTEGER},
              detectedLevel: {type: Type.STRING},
              gradeEvidence: {type: Type.STRING},
              detectedSkill: {type: Type.STRING},
              detectedActivityType: {type: Type.STRING},
              passages: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: {type: Type.STRING},
                    paragraphs: {type: Type.ARRAY, items: {type: Type.STRING}},
                  },
                },
              },
              transcript: {type: Type.STRING},
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    number: {type: Type.INTEGER},
                    type: {type: Type.STRING},
                    prompt: {type: Type.STRING},
                    options: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          label: {type: Type.STRING},
                          text: {type: Type.STRING},
                        },
                      },
                    },
                    correctAnswer: {type: Type.STRING},
                    explanation: {type: Type.STRING},
                    passageIndex: {type: Type.INTEGER},
                    uncertain: {type: Type.BOOLEAN},
                  },
                },
              },
              warnings: {type: Type.ARRAY, items: {type: Type.STRING}},
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ok: true, data: parsed});
    } catch (err) {
      const info = classifyGeminiError(err);
      res.status(info.status).json({ok: false, error: info.message});
    }
  });

  // Generate Listening questions from a teacher-provided transcript
  app.post('/api/ai/generate-listening-questions', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        ok: false,
        unavailable: true,
        error: 'Dịch vụ AI hiện không khả dụng (ngoại tuyến hoặc chưa cấu hình). Giáo viên có thể tự thêm câu hỏi trực tiếp trong trình biên tập.',
      });
      return;
    }

    try {
      const {transcript, grade, questionType, count} = req.body as {
        transcript?: string;
        grade?: number;
        questionType?: string;
        count?: number;
      };

      if (!transcript || transcript.trim().length < 30) {
        res.status(400).json({ok: false, error: 'Transcript cần tối thiểu 30 ký tự để tạo câu hỏi.'});
        return;
      }

      const safeCount = Math.min(Math.max(Number(count || 4), 1), 10);
      const prompt = `Dựa HOÀN TOÀN vào đoạn transcript Tiếng Anh sau (Lớp ${grade || 10}), hãy tạo ${safeCount} câu hỏi Listening dạng "${questionType || 'mcq'}".
Mỗi câu hỏi phải có đáp án chính xác và lời giải thích ngắn bằng tiếng Việt trích dẫn chứng cứ từ transcript.

TRANSCRIPT:
${transcript.slice(0, 10000)}`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    number: {type: Type.INTEGER},
                    type: {type: Type.STRING},
                    prompt: {type: Type.STRING},
                    options: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          label: {type: Type.STRING},
                          text: {type: Type.STRING},
                        },
                      },
                    },
                    correctAnswer: {type: Type.STRING},
                    explanation: {type: Type.STRING},
                  },
                },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{"questions":[]}').trim());
      res.json({ok: true, questions: parsed.questions || []});
    } catch (err) {
      const info = classifyGeminiError(err);
      res.status(info.status).json({ok: false, error: info.message});
    }
  });

  // Writing feedback: grammar, vocabulary, structure suggestions (NEVER writes full essay for student)
  app.post('/api/ai/writing-feedback', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        ok: false,
        unavailable: true,
        error: 'Dịch vụ AI nhận xét bài viết hiện không khả dụng. Giáo viên có thể nhập nhận xét và chấm theo bảng tiêu chí bên dưới.',
      });
      return;
    }

    try {
      const {promptText, studentText, grade} = req.body as {
        promptText?: string;
        studentText?: string;
        grade?: number;
      };

      if (!studentText || studentText.trim().split(/\s+/).length < 10) {
        res.status(400).json({ok: false, error: 'Bài viết cần tối thiểu 10 từ để nhận xét.'});
        return;
      }

      const gradeNum = Number(grade || 10);
      const levelName = gradeNum <= 5 ? 'Tiểu học' : gradeNum <= 9 ? 'THCS' : 'THPT';
      const systemInstruction = `Bạn là trợ lý chấm bài viết Tiếng Anh ${levelName} lớp ${gradeNum} theo Chương trình GDPT 2018.
NGUYÊN TẮC BẮT BUỘC:
- KHÔNG BAO GIỜ viết lại toàn bộ bài văn thay cho học sinh.
- Chỉ chỉ ra điểm mạnh, lỗi ngữ pháp cụ thể, gợi ý nâng cấp từ vựng phù hợp lứa tuổi lớp ${gradeNum}, nhận xét bố cục/mạch lạc và 2-3 hướng cải thiện để học sinh tự sửa.
- Phản hồi rõ ràng bằng tiếng Việt kết hợp ví dụ sửa từng cụm/câu ngắn bằng tiếng Anh.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `ĐỀ BÀI:\n${promptText || 'Writing Task'}\n\nBÀI LÀM CỦA HỌC SINH:\n${studentText.slice(0, 8000)}`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {type: Type.STRING},
              strengths: {type: Type.ARRAY, items: {type: Type.STRING}},
              grammarIssues: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    original: {type: Type.STRING},
                    suggestion: {type: Type.STRING},
                    reason: {type: Type.STRING},
                  },
                },
              },
              vocabularySuggestions: {type: Type.ARRAY, items: {type: Type.STRING}},
              structureAdvice: {type: Type.ARRAY, items: {type: Type.STRING}},
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ok: true, feedback: parsed});
    } catch (err) {
      const info = classifyGeminiError(err);
      res.status(info.status).json({ok: false, error: info.message});
    }
  });

  // Real Text-to-Speech generation returning audio/wav using gemini-3.8-flash-lite-tts
  app.post('/api/ai/tts', async (req, res) => {
    const ai = getGeminiClient('v1beta');
    if (!ai) {
      res.status(503).json({
        ok: false,
        unavailable: true,
        error: 'Dịch vụ tạo tệp giọng đọc AI hiện không khả dụng. Hệ thống sẽ sử dụng giọng đọc tổng hợp sẵn có của trình duyệt (Web Speech API).',
      });
      return;
    }

    try {
      const {text, accent} = req.body as {
        text?: string;
        accent?: 'en-GB' | 'en-US';
      };

      if (!text || text.trim().length < 5) {
        res.status(400).json({ok: false, error: 'Nội dung transcript cần tối thiểu 5 ký tự để tạo giọng đọc.'});
        return;
      }

      const isBritish = accent !== 'en-US';
      const voiceName = isBritish ? 'Kore' : 'Puck';
      const accentInstruction = isBritish
        ? 'Read the following English classroom listening passage clearly with a natural British English accent at a steady, easy-to-follow pace:'
        : 'Read the following English classroom listening passage clearly with a natural American English accent at a steady, easy-to-follow pace:';

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${accentInstruction}\n\n${text.trim().slice(0, 4000)}`,
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {voiceName},
            },
          },
        },
      });

      const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const base64Audio = inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({
          ok: false,
          error: 'Máy chủ TTS không trả về dữ liệu âm thanh. Bạn vẫn có thể phát trực tiếp bằng giọng đọc tổng hợp trình duyệt.',
        });
        return;
      }

      const mimeType = inlineData?.mimeType || 'audio/wav';
      res.json({
        ok: true,
        mimeType,
        dataUrl: `data:${mimeType};base64,${base64Audio}`,
        accent: isBritish ? 'en-GB' : 'en-US',
      });
    } catch (err) {
      const info = classifyGeminiError(err);
      res.status(info.status).json({ok: false, error: info.message});
    }
  });

  // Optional AI exam item generation strictly aligned to a Matrix & Specification row
  app.post('/api/ai/generate-exam-items', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        ok: false,
        unavailable: true,
        error: 'Dịch vụ AI chưa được kích hoạt. Giáo viên vẫn có thể lấy câu hỏi từ Ngân hàng câu hỏi hoặc soạn thủ công hoàn toàn ngoại tuyến.',
      });
      return;
    }

    try {
      const {grade, topic, skill, format, cognitiveLevel, learningOutcome, count} = req.body as {
        grade?: number;
        topic?: string;
        skill?: string;
        format?: string;
        cognitiveLevel?: string;
        learningOutcome?: string;
        count?: number;
      };

      const safeCount = Math.min(Math.max(Number(count || 3), 1), 8);
      const prompt = `Bạn là chuyên gia biên soạn đề kiểm tra Tiếng Anh THPT Việt Nam (Lớp ${grade || 10}, Chương trình GDPT 2018 & Công văn 7991/BGDĐT-GDTrH).
Hãy biên soạn ${safeCount} câu hỏi MỚI hoàn toàn bám sát đặc tả sau:
- Chủ đề / Phạm vi: ${topic || 'Tiếng Anh THPT'}
- Kỹ năng: ${skill || 'language'}
- Dạng câu hỏi: ${format || 'mcq'}
- Mức độ nhận thức: ${cognitiveLevel || 'comprehension'}
- Yêu cầu cần đạt: ${learningOutcome || 'Đánh giá đúng năng lực ngôn ngữ lớp học.'}

QUY TẮC BẮT BUỘC:
1. Mỗi câu trắc nghiệm (mcq) phải có đúng 4 phương án A, B, C, D rõ ràng, KHÔNG trùng lặp, chỉ có DUY NHẤT 1 đáp án đúng, KHÔNG dùng phương án phụ thuộc kiểu "Both A and B" hay "All of the above".
2. Nếu là câu ngữ âm/phát âm, đánh dấu phần gạch chân bằng <u>...</u>.
3. Cung cấp đáp án chính xác và giải thích ngắn gọn bằng tiếng Việt.
4. Nếu là bài đọc hoặc bài nghe, có thể kèm thêm một đoạn văn/transcript ngắn liên quan.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              stimulusTitle: {type: Type.STRING},
              stimulusText: {type: Type.STRING},
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    prompt: {type: Type.STRING},
                    options: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          label: {type: Type.STRING},
                          text: {type: Type.STRING},
                        },
                      },
                    },
                    correctAnswer: {type: Type.STRING},
                    acceptedAnswers: {type: Type.ARRAY, items: {type: Type.STRING}},
                    explanation: {type: Type.STRING},
                  },
                },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{"questions":[]}').trim());
      res.json({ok: true, data: parsed});
    } catch (err) {
      const info = classifyGeminiError(err);
      res.status(info.status).json({ok: false, error: info.message});
    }
  });

  const httpServer = http.createServer(app);
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: {server: httpServer},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('/{*splat}', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`English Slide Studio server running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
