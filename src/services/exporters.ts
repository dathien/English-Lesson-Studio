import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  UnderlineType,
} from 'docx';
import PptxGenJS from 'pptxgenjs';
import type {LessonProject, Slide} from '../types/lesson';
import {SKILL_LABELS} from '../types/lesson';
import {stripFormattingTags} from '../utils/richText';
import {
  richHtmlToDocxRuns,
  richHtmlToPptxTextRuns,
  richHtmlToPrintableHtml,
} from './documentExportAdapter';

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeFileName(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9\u00C0-\u1EF9\s_-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 60) || 'English_Slide_Studio'
  );
}

function buildDocxRuns(text: string, baseOptions?: {size?: number; bold?: boolean; color?: string}): TextRun[] {
  return richHtmlToDocxRuns(text, {
    font: 'Calibri',
    sizeHalfPt: baseOptions?.size ?? 24,
    bold: baseOptions?.bold,
    color: baseOptions?.color ?? '0F172A',
  });
}

/**
 * Exports a LessonProject (or Assessment) to a real .docx Word document,
 * preserving intact reading passages, numbered questions, exact underlined characters,
 * rubrics, and an optional Answer Key section.
 */
export async function exportLessonToWord(
  lesson: LessonProject,
  options: {includeAnswers?: boolean} = {includeAnswers: true},
): Promise<void> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      text: lesson.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: {after: 120},
    }),
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: {after: 280},
      children: [
        new TextRun({
          text: `Tiếng Anh THPT Lớp ${lesson.grade} · ${SKILL_LABELS[lesson.skill]} · ${lesson.topic}`,
          italics: true,
          color: '475569',
          size: 22,
        }),
      ],
    }),
  );

  const answerSummary: Array<{slideTitle: string; num: number; answer: string; explanation?: string}> = [];

  lesson.slides.forEach((slide, idx) => {
    children.push(
      new Paragraph({
        text: `${idx + 1}. ${slide.title}`,
        heading: HeadingLevel.HEADING_2,
        spacing: {before: 240, after: 100},
      }),
    );

    if (slide.instruction) {
      children.push(
        new Paragraph({
          spacing: {after: 120},
          children: [
            new TextRun({text: 'Hướng dẫn: ', bold: true, size: 22, color: '0F4C81'}),
            ...buildDocxRuns(slide.instruction, {size: 22}),
          ],
        }),
      );
    }

    if (slide.bullets && slide.bullets.length > 0) {
      slide.bullets.forEach((b) => {
        children.push(
          new Paragraph({
            bullet: {level: 0},
            spacing: {after: 60},
            children: buildDocxRuns(b, {size: 22}),
          }),
        );
      });
    }

    if (slide.passage) {
      if (slide.passage.title) {
        children.push(
          new Paragraph({
            spacing: {before: 100, after: 80},
            children: [new TextRun({text: slide.passage.title, bold: true, size: 24})],
          }),
        );
      }
      slide.passage.paragraphs.forEach((para) => {
        children.push(
          new Paragraph({
            spacing: {after: 120},
            children: buildDocxRuns(para, {size: 22}),
          }),
        );
      });
    }

    if (slide.audio?.transcript) {
      children.push(
        new Paragraph({
          spacing: {before: 100, after: 60},
          children: [new TextRun({text: 'Audio Transcript:', bold: true, size: 22, color: '0F4C81'})],
        }),
      );
      children.push(
        new Paragraph({
          spacing: {after: 120},
          children: [new TextRun({text: slide.audio.transcript, size: 21, italics: true})],
        }),
      );
    }

    if (slide.vocabItems && slide.vocabItems.length > 0) {
      slide.vocabItems.forEach((v) => {
        children.push(
          new Paragraph({
            spacing: {after: 80},
            children: [
              new TextRun({text: `${v.word} `, bold: true, size: 22}),
              new TextRun({text: `${v.ipa} (${v.partOfSpeech}): `, color: '0284C7', size: 22}),
              new TextRun({text: `${v.meaningVi}. `, size: 22}),
              new TextRun({text: `Ex: ${v.example}`, italics: true, color: '475569', size: 21}),
            ],
          }),
        );
      });
    }

    if (slide.questions && slide.questions.length > 0) {
      slide.questions.forEach((q) => {
        children.push(
          new Paragraph({
            spacing: {before: 100, after: 60},
            children: [
              new TextRun({text: `Question ${q.number}. `, bold: true, size: 22}),
              ...buildDocxRuns(q.prompt, {size: 22}),
            ],
          }),
        );

        if (q.options && q.options.length > 0) {
          q.options.forEach((opt) => {
            children.push(
              new Paragraph({
                indent: {left: 360},
                spacing: {after: 40},
                children: [
                  new TextRun({text: `${opt.label}. `, bold: true, size: 22}),
                  ...buildDocxRuns(opt.text, {size: 22}),
                  ...(opt.ipa ? [new TextRun({text: `  ${opt.ipa}`, color: '64748B', size: 20})] : []),
                ],
              }),
            );
          });
        }

        if (q.matchingPairs && q.matchingPairs.length > 0) {
          q.matchingPairs.forEach((pair, pIdx) => {
            children.push(
              new Paragraph({
                indent: {left: 360},
                spacing: {after: 40},
                children: [
                  new TextRun({text: `${pIdx + 1}. ${pair.left}   ↔   ${pair.right}`, size: 22}),
                ],
              }),
            );
          });
        }

        if (q.correctAnswer) {
          answerSummary.push({
            slideTitle: slide.title,
            num: q.number,
            answer: q.correctAnswer,
            explanation: q.explanation,
          });
        }
      });
    }

    if (slide.speakingTask) {
      children.push(
        new Paragraph({
          spacing: {after: 80},
          children: [
            new TextRun({text: 'Nhiệm vụ Speaking: ', bold: true, size: 22}),
            new TextRun({text: slide.speakingTask.prompt, size: 22}),
          ],
        }),
      );
      if (slide.speakingTask.cues) {
        slide.speakingTask.cues.forEach((cue) => {
          children.push(
            new Paragraph({
              bullet: {level: 0},
              children: [new TextRun({text: cue, size: 21})],
            }),
          );
        });
      }
      children.push(
        new Paragraph({
          spacing: {before: 80, after: 40},
          children: [new TextRun({text: 'Tiêu chí đánh giá Speaking:', bold: true, size: 21, color: '0F4C81'})],
        }),
      );
      slide.speakingTask.rubricCriteria.forEach((r) => {
        children.push(
          new Paragraph({
            bullet: {level: 0},
            children: [
              new TextRun({text: `${r.name} (tối đa ${r.maxScore} điểm): `, bold: true, size: 20}),
              new TextRun({text: r.description, size: 20}),
            ],
          }),
        );
      });
    }

    if (slide.writingTask) {
      children.push(
        new Paragraph({
          spacing: {after: 80},
          children: [
            new TextRun({text: `Đề bài Writing (${slide.writingTask.minWords}–${slide.writingTask.maxWords} từ): `, bold: true, size: 22}),
            new TextRun({text: slide.writingTask.prompt, size: 22}),
          ],
        }),
      );
      slide.writingTask.outlineHints.forEach((hint) => {
        children.push(
          new Paragraph({
            bullet: {level: 0},
            children: [new TextRun({text: hint, size: 21})],
          }),
        );
      });
    }
  });

  if (options.includeAnswers && answerSummary.length > 0) {
    children.push(
      new Paragraph({
        text: 'ĐÁP ÁN VÀ GIẢI THÍCH (ANSWER KEY)',
        heading: HeadingLevel.HEADING_1,
        spacing: {before: 360, after: 120},
      }),
    );

    answerSummary.forEach((item) => {
      children.push(
        new Paragraph({
          spacing: {after: 60},
          children: [
            new TextRun({text: `Câu ${item.num}: `, bold: true, size: 22}),
            new TextRun({text: `${item.answer} `, bold: true, color: '059669', size: 22}),
            ...(item.explanation
              ? [new TextRun({text: `— ${item.explanation}`, size: 21, color: '334155'})]
              : []),
          ],
        }),
      );
    });
  }

  children.push(
    new Paragraph({
      spacing: {before: 320},
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'Copyright © 2025 - Phát triển bởi Thầy Hồ Nguyễn Đa Thiện',
          size: 18,
          color: '64748B',
          italics: true,
        }),
      ],
    }),
  );

  const doc = new Document({
    sections: [{children}],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${sanitizeFileName(lesson.title)}.docx`);
}

async function resolveImageToBase64(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:image/')) return url;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Exports LessonProject to PowerPoint (.pptx) 16:9 widescreen using PptxGenJS,
 * preserving layout, content, images, underlines, answer summary, and speaker notes.
 */
export async function exportLessonToPowerPoint(lesson: LessonProject): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'English Slide Studio – Thầy Hồ Nguyễn Đa Thiện';
  pptx.title = lesson.title;
  pptx.subject = `Tiếng Anh THPT Lớp ${lesson.grade}`;

  for (let i = 0; i < lesson.slides.length; i++) {
    const slideData: Slide = lesson.slides[i];
    const pptSlide = pptx.addSlide();
    pptSlide.background = {color: 'F8FAFC'};

    // Top bar accent strip
    pptSlide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.33,
      h: 0.72,
      fill: {color: '0F4C81'},
    });

    pptSlide.addText(slideData.title, {
      x: 0.5,
      y: 0.12,
      w: 9.8,
      h: 0.5,
      fontSize: 20,
      bold: true,
      color: 'FFFFFF',
      fontFace: 'Calibri',
    });

    pptSlide.addText(`Lớp ${lesson.grade} · Slide ${i + 1}/${lesson.slides.length}`, {
      x: 10.4,
      y: 0.18,
      w: 2.5,
      h: 0.36,
      fontSize: 12,
      color: 'E2E8F0',
      align: 'right',
      fontFace: 'Calibri',
    });

    let currentY = 0.95;

    if (slideData.instruction) {
      pptSlide.addText(stripFormattingTags(slideData.instruction), {
        x: 0.5,
        y: currentY,
        w: 12.3,
        h: 0.45,
        fontSize: 14,
        italic: true,
        color: '0284C7',
        fontFace: 'Calibri',
      });
      currentY += 0.52;
    }

    // Cover / Bullets slide with optional image
    if (slideData.bullets && slideData.bullets.length > 0) {
      const hasImg = Boolean(slideData.imageUrl);
      pptSlide.addText(
        slideData.bullets.map((b) => ({
          text: stripFormattingTags(b),
          options: {bullet: true, breakLine: true, paraSpaceAfter: 10},
        })),
        {
          x: 0.5,
          y: currentY,
          w: hasImg ? 6.8 : 12.2,
          h: 4.8,
          fontSize: 17,
          color: '0F172A',
          fontFace: 'Calibri',
          valign: 'top',
        },
      );
      if (slideData.imageUrl) {
        const base64 = await resolveImageToBase64(slideData.imageUrl);
        if (base64) {
          pptSlide.addImage({data: base64, x: 7.6, y: currentY, w: 5.2, h: 3.4});
        }
      }
    }

    // Reading Split View: Passage on left, Questions on right
    if (slideData.passage) {
      const passageText = [
        slideData.passage.title ? `${slideData.passage.title}\n` : '',
        ...slideData.passage.paragraphs,
      ]
        .filter(Boolean)
        .join('\n\n');

      const hasQuestions = Boolean(slideData.questions && slideData.questions.length > 0);
      pptSlide.addShape(pptx.ShapeType.rect, {
        x: 0.5,
        y: currentY,
        w: hasQuestions ? 6.1 : 12.3,
        h: 5.4,
        fill: {color: 'FFFFFF'},
        line: {color: 'CBD5E1', width: 1},
      });
      pptSlide.addText(stripFormattingTags(passageText).slice(0, 1800), {
        x: 0.65,
        y: currentY + 0.15,
        w: hasQuestions ? 5.8 : 12.0,
        h: 5.1,
        fontSize: 12.5,
        color: '1E293B',
        fontFace: 'Calibri',
        valign: 'top',
      });

      if (hasQuestions && slideData.questions) {
        const qRuns: PptxGenJS.TextProps[] = [];
        slideData.questions.slice(0, 5).forEach((q) => {
          qRuns.push({
            text: `Q${q.number}. ${stripFormattingTags(q.prompt)}\n`,
            options: {bold: true, fontSize: 13, color: '0F172A'},
          });
          if (q.options) {
            q.options.forEach((opt) => {
              qRuns.push({
                text: `   ${opt.label}. ${stripFormattingTags(opt.text)}\n`,
                options: {fontSize: 12, color: '334155'},
              });
            });
          }
        });
        pptSlide.addText(qRuns, {
          x: 6.85,
          y: currentY,
          w: 6.0,
          h: 5.4,
          fontFace: 'Calibri',
          valign: 'top',
        });
      }
    } else if (slideData.questions && slideData.questions.length > 0) {
      // Standalone Questions (preserving underlined runs in PPTX!)
      const qRuns: PptxGenJS.TextProps[] = [];
      slideData.questions.slice(0, 6).forEach((q) => {
        qRuns.push({text: `${q.number}. `, options: {bold: true, fontSize: 15, color: '0F4C81'}});
        richHtmlToPptxTextRuns(q.prompt, {fontSize: 15, color: '0F172A'}).forEach((r) => {
          qRuns.push(r);
        });
        qRuns.push({text: '\n', options: {fontSize: 15}});

        if (q.options && q.options.length > 0) {
          q.options.forEach((opt, oi) => {
            qRuns.push({
              text: `${oi > 0 ? '    ' : '   '}${opt.label}. `,
              options: {bold: true, fontSize: 14, color: '334155'},
            });
            richHtmlToPptxTextRuns(opt.text, {fontSize: 14, color: '1E293B'}).forEach((r) => {
              qRuns.push(r);
            });
          });
          qRuns.push({text: '\n\n', options: {fontSize: 10}});
        }
      });

      pptSlide.addText(qRuns, {
        x: 0.5,
        y: currentY,
        w: 12.3,
        h: 5.5,
        fontFace: 'Calibri',
        valign: 'top',
      });
    }

    // Vocab cards table
    if (slideData.vocabItems && slideData.vocabItems.length > 0) {
      const rows: PptxGenJS.TableRow[] = [
        [
          {text: 'Word', options: {bold: true, fill: {color: '0F4C81'}, color: 'FFFFFF'}},
          {text: 'IPA', options: {bold: true, fill: {color: '0F4C81'}, color: 'FFFFFF'}},
          {text: 'Meaning', options: {bold: true, fill: {color: '0F4C81'}, color: 'FFFFFF'}},
          {text: 'Example', options: {bold: true, fill: {color: '0F4C81'}, color: 'FFFFFF'}},
        ],
        ...slideData.vocabItems.slice(0, 6).map((v) => [
          {text: `${v.word} (${v.partOfSpeech})`, options: {bold: true}},
          {text: v.ipa, options: {color: '0284C7'}},
          {text: v.meaningVi},
          {text: v.example},
        ]),
      ];
      pptSlide.addTable(rows, {
        x: 0.5,
        y: currentY,
        w: 12.3,
        fontSize: 13,
        fontFace: 'Calibri',
        border: {pt: 0.5, color: 'CBD5E1'},
      });
    }

    // Speaking / Writing Task
    if (slideData.speakingTask || slideData.writingTask) {
      const hasImg = Boolean(slideData.imageUrl);
      const taskPrompt = slideData.speakingTask?.prompt || slideData.writingTask?.prompt || '';
      const cues = slideData.speakingTask?.cues || slideData.writingTask?.outlineHints || [];
      pptSlide.addText(
        [
          {text: `${taskPrompt}\n\n`, options: {bold: true, fontSize: 16, color: '0F172A'}},
          ...cues.map((c) => ({
            text: c,
            options: {bullet: true, breakLine: true, fontSize: 14, color: '334155'},
          })),
        ],
        {
          x: 0.5,
          y: currentY,
          w: hasImg ? 6.8 : 12.3,
          h: 5.2,
          fontFace: 'Calibri',
          valign: 'top',
        },
      );
      if (slideData.imageUrl) {
        const base64 = await resolveImageToBase64(slideData.imageUrl);
        if (base64) {
          pptSlide.addImage({data: base64, x: 7.6, y: currentY, w: 5.2, h: 3.5});
        }
      }
    }

    // Add Teacher Notes + Answer Keys in PowerPoint Presenter Notes
    const notesParts: string[] = [];
    if (slideData.teacherNotes) notesParts.push(`Ghi chú giáo viên: ${slideData.teacherNotes}`);
    if (slideData.questions?.some((q) => q.correctAnswer)) {
      notesParts.push(
        'Đáp án: ' +
          slideData.questions
            .filter((q) => q.correctAnswer)
            .map((q) => `Câu ${q.number}: ${q.correctAnswer}`)
            .join(' | '),
      );
    }
    notesParts.push(
      'Lưu ý: Các hoạt động tương tác trực tiếp (kéo thả, ghi âm, chấm tự động) hoạt động đầy đủ khi trình chiếu trên English Slide Studio web.',
    );
    pptSlide.addNotes(notesParts.join('\n\n'));

    // Footer
    pptSlide.addText('Copyright © 2025 - Phát triển bởi Thầy Hồ Nguyễn Đa Thiện', {
      x: 0.5,
      y: 7.05,
      w: 12.3,
      h: 0.3,
      fontSize: 10,
      color: '94A3B8',
      align: 'right',
    });
  }

  const outBlob = (await pptx.write({outputType: 'blob'})) as Blob;
  triggerDownload(outBlob, `${sanitizeFileName(lesson.title)}.pptx`);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHtmlWithUnderlines(text: string): string {
  return richHtmlToPrintableHtml(text);
}

/**
 * Exports/Prints a clean A4 PDF worksheet using a hidden iframe (no window.open popup).
 */
export function printLessonAsPDF(
  lesson: LessonProject,
  options: {includeAnswers?: boolean} = {includeAnswers: true},
): void {
  const answers: Array<{num: number; answer: string; explanation?: string}> = [];

  const bodyHtml = lesson.slides
    .map((slide, idx) => {
      const passageHtml = slide.passage
        ? `<div class="passage">
            ${slide.passage.title ? `<h4>${escapeHtml(slide.passage.title)}</h4>` : ''}
            ${slide.passage.paragraphs.map((p) => `<p>${renderHtmlWithUnderlines(p)}</p>`).join('')}
          </div>`
        : '';

      const vocabHtml = slide.vocabItems?.length
        ? `<table><thead><tr><th>Word</th><th>IPA</th><th>Meaning</th><th>Example</th></tr></thead><tbody>
            ${slide.vocabItems
              .map(
                (v) =>
                  `<tr><td><strong>${escapeHtml(v.word)}</strong> (${escapeHtml(v.partOfSpeech)})</td><td>${escapeHtml(v.ipa)}</td><td>${escapeHtml(v.meaningVi)}</td><td>${escapeHtml(v.example)}</td></tr>`,
              )
              .join('')}
          </tbody></table>`
        : '';

      const questionsHtml = slide.questions?.length
        ? `<div class="questions">
            ${slide.questions
              .map((q) => {
                if (q.correctAnswer) {
                  answers.push({num: q.number, answer: q.correctAnswer, explanation: q.explanation});
                }
                const optsHtml = q.options?.length
                  ? `<div class="options">${q.options
                      .map((o) => `<div><strong>${escapeHtml(o.label)}.</strong> ${renderHtmlWithUnderlines(o.text)}</div>`)
                      .join('')}</div>`
                  : '';
                return `<div class="question">
                  <p><strong>Question ${q.number}.</strong> ${renderHtmlWithUnderlines(q.prompt)}</p>
                  ${optsHtml}
                </div>`;
              })
              .join('')}
          </div>`
        : '';

      const taskHtml = slide.writingTask
        ? `<div class="task-box">
            <p><strong>Writing Prompt (${slide.writingTask.minWords}–${slide.writingTask.maxWords} words):</strong> ${escapeHtml(slide.writingTask.prompt)}</p>
            <ul>${slide.writingTask.outlineHints.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>
          </div>`
        : slide.speakingTask
          ? `<div class="task-box">
              <p><strong>Speaking Prompt:</strong> ${escapeHtml(slide.speakingTask.prompt)}</p>
              ${slide.speakingTask.cues ? `<ul>${slide.speakingTask.cues.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>` : ''}
            </div>`
          : '';

      return `<section class="slide-block">
        <h2>${idx + 1}. ${escapeHtml(slide.title)}</h2>
        ${slide.instruction ? `<p class="instruction">${renderHtmlWithUnderlines(slide.instruction)}</p>` : ''}
        ${slide.bullets?.length ? `<ul>${slide.bullets.map((b) => `<li>${renderHtmlWithUnderlines(b)}</li>`).join('')}</ul>` : ''}
        ${passageHtml}
        ${vocabHtml}
        ${questionsHtml}
        ${taskHtml}
      </section>`;
    })
    .join('');

  const answerHtml =
    options.includeAnswers && answers.length > 0
      ? `<section class="answer-key">
          <h2>ANSWER KEY &amp; EXPLANATIONS</h2>
          ${answers
            .map(
              (a) =>
                `<p><strong>Câu ${a.num}:</strong> <span class="ans">${escapeHtml(a.answer)}</span>${a.explanation ? ` — ${escapeHtml(a.explanation)}` : ''}</p>`,
            )
            .join('')}
        </section>`
      : '';

  const fullHtml = `<!doctype html>
  <html lang="vi">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(lesson.title)}</title>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Charis+SIL:ital,wght@0,400;0,700;1,400&display=swap" />
      <style>
        body { font-family: "Segoe UI", "Charis SIL", Arial, sans-serif; color: #0F172A; line-height: 1.55; margin: 28px; font-size: 13.5px; }
        .ipa-inline { font-family: "Charis SIL", "Doulos SIL", "DejaVu Sans", serif; }
        header { text-align: center; border-bottom: 2px solid #0F4C81; padding-bottom: 12px; margin-bottom: 20px; }
        h1 { font-size: 20px; margin: 0 0 6px; color: #0F4C81; }
        .meta { color: #475569; font-size: 12.5px; }
        h2 { font-size: 15.5px; color: #0F4C81; margin: 20px 0 8px; }
        .instruction { font-style: italic; color: #0369A1; margin: 0 0 10px; }
        .passage { background: #F8FAFC; border: 1px solid #CBD5E1; padding: 12px 14px; border-radius: 6px; margin-bottom: 12px; }
        .question { margin-bottom: 10px; page-break-inside: avoid; }
        .options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 18px; margin-left: 16px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #CBD5E1; padding: 6px 8px; text-align: left; }
        th { background: #F1F5F9; }
        .task-box { border: 1px solid #CBD5E1; padding: 10px 14px; border-radius: 6px; }
        .answer-key { margin-top: 28px; border-top: 2px dashed #94A3B8; padding-top: 14px; page-break-before: always; }
        .ans { color: #059669; font-weight: 700; }
        footer { margin-top: 28px; text-align: center; font-size: 11px; color: #64748B; }
      </style>
    </head>
    <body>
      <header>
        <h1>${escapeHtml(lesson.title)}</h1>
        <div class="meta">Tiếng Anh THPT Lớp ${lesson.grade} · ${escapeHtml(SKILL_LABELS[lesson.skill])} · ${escapeHtml(lesson.topic)}</div>
      </header>
      ${bodyHtml}
      ${answerHtml}
      <footer>Copyright © 2025 - Phát triển bởi Thầy Hồ Nguyễn Đa Thiện</footer>
    </body>
  </html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(fullHtml);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
    }, 300);
  }
}
