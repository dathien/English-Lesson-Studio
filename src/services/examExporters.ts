import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
} from 'docx';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import {COGNITIVE_LABELS} from '../types/lesson';
import type {
  AnswerKey,
  Exam,
  ExamDossier,
  ExamRubric,
  ExportFormatOptions,
} from '../types/exam';
import {EXAM_FORMAT_LABELS, EXAM_SKILL_LABELS} from '../types/exam';
import {stripFormattingTags} from '../utils/richText';
import {
  richHtmlToDocxRuns,
  richHtmlToPrintableHtml,
} from './documentExportAdapter';
import {getMatrixSummary, recalculateMatrixRow} from './examEngine';

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function sanitizeFileName(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9\u00C0-\u1EF9\s_-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 64) || 'Ho_So_De_Tieng_Anh'
  );
}

function ptToHalfPt(pt: number): number {
  return Math.round(pt * 2);
}

function buildRichRuns(
  text: string,
  options: {
    font: string;
    sizeHalfPt: number;
    bold?: boolean;
    italics?: boolean;
    color?: string;
  },
): TextRun[] {
  return richHtmlToDocxRuns(text, options);
}

const THIN_BORDER = {
  top: {style: BorderStyle.SINGLE, size: 4, color: '94A3B8'},
  bottom: {style: BorderStyle.SINGLE, size: 4, color: '94A3B8'},
  left: {style: BorderStyle.SINGLE, size: 4, color: '94A3B8'},
  right: {style: BorderStyle.SINGLE, size: 4, color: '94A3B8'},
};

const NO_BORDER = {
  top: {style: BorderStyle.NONE, size: 0, color: 'FFFFFF'},
  bottom: {style: BorderStyle.NONE, size: 0, color: 'FFFFFF'},
  left: {style: BorderStyle.NONE, size: 0, color: 'FFFFFF'},
  right: {style: BorderStyle.NONE, size: 0, color: 'FFFFFF'},
};

function makeCell(
  text: string,
  opts: {
    font: string;
    sizeHalfPt: number;
    bold?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    shade?: string;
    widthPct?: number;
  },
): TableCell {
  return new TableCell({
    borders: THIN_BORDER,
    shading: opts.shade
      ? {type: ShadingType.CLEAR, color: 'auto', fill: opts.shade}
      : undefined,
    width: opts.widthPct ? {size: opts.widthPct, type: WidthType.PERCENTAGE} : undefined,
    margins: {top: 80, bottom: 80, left: 100, right: 100},
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: buildRichRuns(text, {
          font: opts.font,
          sizeHalfPt: opts.sizeHalfPt,
          bold: opts.bold,
        }),
      }),
    ],
  });
}

function buildOfficialHeaderTable(
  exam: Exam,
  font: string,
  sizeHalfPt: number,
  subtitleOverride?: string,
): Table {
  const dept = exam.header.departmentName?.trim() || 'SỞ GIÁO DỤC VÀ ĐÀO TẠO ............................';
  const school = exam.header.schoolName?.trim() || 'TRƯỜNG THPT ...........................................';

  return new Table({
    width: {size: 100, type: WidthType.PERCENTAGE},
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: NO_BORDER,
            width: {size: 46, type: WidthType.PERCENTAGE},
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({text: dept.toUpperCase(), font, size: sizeHalfPt - 2})],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({text: school.toUpperCase(), font, size: sizeHalfPt - 2, bold: true})],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: {before: 60},
                children: [
                  new TextRun({
                    text: `MÃ ĐỀ: ${exam.header.examCode || '101'}`,
                    font,
                    size: sizeHalfPt - 2,
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            borders: NO_BORDER,
            width: {size: 54, type: WidthType.PERCENTAGE},
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: (subtitleOverride || exam.header.examTitle).toUpperCase(),
                    font,
                    size: sizeHalfPt,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `NĂM HỌC ${exam.header.academicYear} — MÔN: ${exam.header.subject} (${exam.header.gradeLabel})`,
                    font,
                    size: sizeHalfPt - 2,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `Thời gian làm bài: ${exam.header.durationMinutes} phút (không kể thời gian phát đề)`,
                    font,
                    size: sizeHalfPt - 2,
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/**
 * 1. Matrix Word (.docx) — Landscape by default so wide CV 7991 columns never clip
 */
export async function buildMatrixDocxBlob(
  dossier: ExamDossier,
  options: ExportFormatOptions,
): Promise<Blob> {
  const font = options.fontFamily || 'Times New Roman';
  const bodySize = ptToHalfPt(Math.min(options.fontSizePt || 13, 12));
  const summary = getMatrixSummary(dossier.blueprint);
  const bi = dossier.blueprint.bilingualHeaders;
  const hasHigh = dossier.blueprint.includeHighApplication;

  const headers = [
    bi ? 'STT\n(No.)' : 'STT',
    bi ? 'Kỹ năng / Chủ đề\n(Skill / Topic)' : 'Kỹ năng / Chủ đề',
    bi ? 'Nội dung kiểm tra\n(Test Content)' : 'Nội dung kiểm tra',
    bi ? 'Đơn vị kiến thức\n(Knowledge Unit)' : 'Đơn vị kiến thức',
    bi ? 'Dạng câu hỏi\n(Format)' : 'Dạng câu hỏi',
    bi ? 'NB\n(Rec.)' : 'NB',
    bi ? 'TH\n(Comp.)' : 'TH',
    bi ? 'VD\n(App.)' : 'VD',
    ...(hasHigh ? [bi ? 'VDC\n(High App.)' : 'VDC'] : []),
    bi ? 'Số câu\n(Items)' : 'Số câu',
    bi ? 'Điểm\n(Pts)' : 'Điểm',
    bi ? 'Tỷ lệ\n(%)' : 'Tỷ lệ (%)',
  ];

  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: headers.map((h) =>
        makeCell(h, {
          font,
          sizeHalfPt: bodySize - 2,
          bold: true,
          align: AlignmentType.CENTER,
          shade: 'DBEAFE',
        }),
      ),
    }),
  ];

  for (const rawRow of dossier.blueprint.rows) {
    const r = recalculateMatrixRow(rawRow, hasHigh, dossier.blueprint.totalScoreTarget);
    const cells = [
      String(r.order),
      `${EXAM_SKILL_LABELS[r.skill].vi} (${EXAM_SKILL_LABELS[r.skill].en})\n${r.topic}`,
      r.testContent,
      r.knowledgeUnit,
      EXAM_FORMAT_LABELS[r.questionFormat].vi,
      String(r.recognitionCount),
      String(r.comprehensionCount),
      String(r.applicationCount),
      ...(hasHigh ? [String(r.highApplicationCount)] : []),
      String(r.questionCount),
      r.points.toFixed(2),
      `${r.percentage.toFixed(1)}%`,
    ];

    tableRows.push(
      new TableRow({
        children: cells.map((val, idx) =>
          makeCell(val, {
            font,
            sizeHalfPt: bodySize - 2,
            align: idx === 0 || idx >= 5 ? AlignmentType.CENTER : AlignmentType.LEFT,
          }),
        ),
      }),
    );
  }

  // Summary row
  const sumCells = [
    '',
    'TỔNG CỘNG',
    `${dossier.blueprint.rows.length} nội dung kiểm tra`,
    '',
    '',
    String(summary.recognition),
    String(summary.comprehension),
    String(summary.application),
    ...(hasHigh ? [String(summary.highApplication)] : []),
    String(summary.totalQuestions),
    summary.totalPoints.toFixed(2),
    `${summary.totalPercentage.toFixed(1)}%`,
  ];
  tableRows.push(
    new TableRow({
      children: sumCells.map((val, idx) =>
        makeCell(val, {
          font,
          sizeHalfPt: bodySize - 2,
          bold: true,
          shade: 'EFF6FF',
          align: idx === 0 || idx >= 5 ? AlignmentType.CENTER : AlignmentType.LEFT,
        }),
      ),
    }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: options.matrixLandscape
                ? PageOrientation.LANDSCAPE
                : PageOrientation.PORTRAIT,
            },
            margin: {top: 720, bottom: 720, left: 720, right: 720},
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: {after: 80},
            children: [
              new TextRun({
                text: `MA TRẬN ${dossier.exam.header.examTitle.toUpperCase()}`,
                font,
                size: ptToHalfPt(14),
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: {after: 200},
            children: [
              new TextRun({
                text: `Môn: Tiếng Anh ${dossier.exam.header.gradeLabel} · Bộ sách: ${dossier.scope.textbookName} · Thời gian: ${dossier.scope.durationMinutes} phút · Năm học ${dossier.scope.academicYear}`,
                font,
                size: bodySize,
                italics: true,
              }),
            ],
          }),
          new Table({
            width: {size: 100, type: WidthType.PERCENTAGE},
            rows: tableRows,
          }),
          new Paragraph({
            spacing: {before: 180},
            children: [
              new TextRun({
                text: `Tỷ lệ mức độ nhận thức theo điểm: Nhận biết ${summary.recognitionPct}% (${summary.recognitionPts} đ) · Thông hiểu ${summary.comprehensionPct}% (${summary.comprehensionPts} đ) · Vận dụng ${summary.applicationPct}% (${summary.applicationPts} đ)${hasHigh ? ` · Vận dụng cao ${summary.highApplicationPct}% (${summary.highApplicationPts} đ)` : ''}.`,
                font,
                size: bodySize - 2,
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

/**
 * 2. Specification Word (.docx) — Landscape A4
 */
export async function buildSpecificationDocxBlob(
  dossier: ExamDossier,
  options: ExportFormatOptions,
): Promise<Blob> {
  const font = options.fontFamily || 'Times New Roman';
  const bodySize = ptToHalfPt(Math.min(options.fontSizePt || 13, 12));

  const headers = [
    'STT',
    'Kỹ năng / Chủ đề',
    'Nội dung kiến thức',
    'Yêu cầu cần đạt',
    'Biểu hiện cần đánh giá',
    'Dạng câu hỏi',
    'Mức độ',
    'Số câu',
    'Vị trí câu',
    'Điểm',
  ];

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: headers.map((h) =>
        makeCell(h, {
          font,
          sizeHalfPt: bodySize - 2,
          bold: true,
          align: AlignmentType.CENTER,
          shade: 'DBEAFE',
        }),
      ),
    }),
  ];

  for (const sr of dossier.specification.rows) {
    const vals = [
      String(sr.order),
      `${EXAM_SKILL_LABELS[sr.skill].vi}\n(${sr.topic})`,
      sr.knowledgeContent,
      sr.learningOutcome,
      sr.assessmentDescriptor,
      EXAM_FORMAT_LABELS[sr.questionFormat].vi,
      COGNITIVE_LABELS[sr.cognitiveLevel],
      String(sr.questionCount),
      sr.questionPositions,
      sr.points.toFixed(2),
    ];
    rows.push(
      new TableRow({
        children: vals.map((v, idx) =>
          makeCell(v, {
            font,
            sizeHalfPt: bodySize - 2,
            align: idx === 0 || idx >= 6 ? AlignmentType.CENTER : AlignmentType.LEFT,
          }),
        ),
      }),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: options.specLandscape
                ? PageOrientation.LANDSCAPE
                : PageOrientation.PORTRAIT,
            },
            margin: {top: 720, bottom: 720, left: 720, right: 720},
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: {after: 80},
            children: [
              new TextRun({
                text: `BẢN ĐẶC TẢ ${dossier.exam.header.examTitle.toUpperCase()}`,
                font,
                size: ptToHalfPt(14),
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: {after: 200},
            children: [
              new TextRun({
                text: `Môn: Tiếng Anh ${dossier.exam.header.gradeLabel} · ${dossier.scope.textbookName} · Thời gian: ${dossier.scope.durationMinutes} phút · Năm học ${dossier.scope.academicYear}`,
                font,
                size: bodySize,
                italics: true,
              }),
            ],
          }),
          new Table({
            width: {size: 100, type: WidthType.PERCENTAGE},
            rows,
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

/**
 * 3. Student Exam Word (.docx) — Portrait A4, Times New Roman 13pt, strictly NO teacher answers!
 */
export async function buildStudentExamDocxBlob(
  dossier: ExamDossier,
  options: ExportFormatOptions,
  versionCode?: string,
): Promise<Blob> {
  const font = options.fontFamily || 'Times New Roman';
  const sizeHalfPt = ptToHalfPt(options.fontSizePt || 13);

  const matchedVer = versionCode
    ? dossier.versions.find((v) => v.code === versionCode)
    : undefined;
  const activeExam: Exam = matchedVer
    ? {
        ...dossier.exam,
        header: {...dossier.exam.header, examCode: matchedVer.code},
        groups: matchedVer.groups,
        questions: matchedVer.questions,
      }
    : dossier.exam;

  const children: Array<Paragraph | Table> = [];

  if (options.includeHeaderBox) {
    children.push(buildOfficialHeaderTable(activeExam, font, sizeHalfPt));
    children.push(
      new Paragraph({
        spacing: {before: 140, after: 140},
        children: [
          new TextRun({
            text: 'Họ và tên thí sinh: .........................................................  Số báo danh: .......................  Lớp: ..........',
            font,
            size: sizeHalfPt - 2,
          }),
        ],
      }),
    );
  }

  const sortedGroups = [...activeExam.groups].sort((a, b) => a.order - b.order);

  for (const group of sortedGroups) {
    const groupQs = activeExam.questions
      .filter((q) => q.groupId === group.id)
      .sort((a, b) => a.number - b.number);
    if (groupQs.length === 0) continue;

    children.push(
      new Paragraph({
        spacing: {before: 200, after: 80},
        children: [
          new TextRun({
            text: group.title,
            font,
            size: sizeHalfPt,
            bold: true,
          }),
        ],
      }),
    );

    if (group.instruction) {
      children.push(
        new Paragraph({
          spacing: {after: 100},
          children: buildRichRuns(group.instruction, {
            font,
            sizeHalfPt,
            italics: true,
          }),
        }),
      );
    }

    if (group.stimulusTitle) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: {before: 60, after: 80},
          children: [
            new TextRun({
              text: group.stimulusTitle,
              font,
              size: sizeHalfPt,
              bold: true,
            }),
          ],
        }),
      );
    }

    if (group.stimulusParagraphs && group.stimulusParagraphs.length > 0) {
      for (const p of group.stimulusParagraphs) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: {after: 100},
            children: buildRichRuns(p, {font, sizeHalfPt}),
          }),
        );
      }
    }

    for (const q of groupQs) {
      children.push(
        new Paragraph({
          spacing: {before: 100, after: 40},
          children: [
            new TextRun({
              text: `Question ${q.number}. `,
              font,
              size: sizeHalfPt,
              bold: true,
            }),
            ...buildRichRuns(q.prompt, {font, sizeHalfPt}),
          ],
        }),
      );

      if (q.options && q.options.length > 0) {
        const allShort = q.options.every((o) => stripFormattingTags(o.text).length <= 18);
        if (allShort && q.options.length === 4) {
          const optRuns: TextRun[] = [];
          q.options.forEach((opt, idx) => {
            if (idx > 0) optRuns.push(new TextRun({text: '      ', font, size: sizeHalfPt}));
            optRuns.push(new TextRun({text: `${opt.label}. `, font, size: sizeHalfPt, bold: true}));
            optRuns.push(...buildRichRuns(opt.text, {font, sizeHalfPt}));
          });
          children.push(
            new Paragraph({
              indent: {left: 260},
              spacing: {after: 60},
              children: optRuns,
            }),
          );
        } else {
          for (const opt of q.options) {
            children.push(
              new Paragraph({
                indent: {left: 260},
                spacing: {after: 30},
                children: [
                  new TextRun({text: `${opt.label}. `, font, size: sizeHalfPt, bold: true}),
                  ...buildRichRuns(opt.text, {font, sizeHalfPt}),
                ],
              }),
            );
          }
        }
      } else if (q.format === 'transformation' || q.format === 'short_answer' || q.format === 'gap_fill') {
        children.push(
          new Paragraph({
            indent: {left: 260},
            spacing: {after: 80},
            children: [
              new TextRun({
                text: '→ ...........................................................................................................................',
                font,
                size: sizeHalfPt,
              }),
            ],
          }),
        );
      } else if (q.format === 'essay') {
        for (let line = 0; line < 7; line++) {
          children.push(
            new Paragraph({
              spacing: {after: 80},
              children: [
                new TextRun({
                  text: '......................................................................................................................................',
                  font,
                  size: sizeHalfPt,
                }),
              ],
            }),
          );
        }
      }
    }
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: {before: 240},
      children: [
        new TextRun({
          text: '——— HẾT ———',
          font,
          size: sizeHalfPt,
          bold: true,
        }),
      ],
    }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {top: 900, bottom: 900, left: 1000, right: 900},
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

/**
 * 4. Teacher Answer Key + Marking Guide + Transcript + Rubrics Word (.docx)
 */
export async function buildAnswerKeyDocxBlob(
  dossier: ExamDossier,
  options: ExportFormatOptions,
): Promise<Blob> {
  const font = options.fontFamily || 'Times New Roman';
  const sizeHalfPt = ptToHalfPt(options.fontSizePt || 13);
  const children: Array<Paragraph | Table> = [];

  children.push(
    buildOfficialHeaderTable(
      dossier.exam,
      font,
      sizeHalfPt,
      `ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM — ${dossier.exam.header.examTitle}`,
    ),
  );

  children.push(
    new Paragraph({
      spacing: {before: 180, after: 100},
      children: [
        new TextRun({
          text: 'I. HƯỚNG DẪN CHUNG',
          font,
          size: sizeHalfPt,
          bold: true,
        }),
      ],
    }),
  );
  children.push(
    new Paragraph({
      spacing: {after: 120},
      children: [
        new TextRun({
          text: dossier.markingGuide.generalInstructions,
          font,
          size: sizeHalfPt - 2,
        }),
      ],
    }),
  );

  // Answer table for primary code + any shuffled versions
  const codesToRender: Array<{code: string; key: AnswerKey}> =
    dossier.versions.length > 0
      ? dossier.versions.map((v) => ({code: v.code, key: v.answerKey}))
      : [{code: dossier.answerKey.examCode || '101', key: dossier.answerKey}];

  children.push(
    new Paragraph({
      spacing: {before: 140, after: 100},
      children: [
        new TextRun({
          text: 'II. BẢNG ĐÁP ÁN CHI TIẾT VÀ GIẢI THÍCH',
          font,
          size: sizeHalfPt,
          bold: true,
        }),
      ],
    }),
  );

  const keyTableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: ['Câu', 'Mức độ', 'Đáp án đúng (Mã gốc)', 'Điểm', 'Giải thích / Phương án tương đương'].map((h) =>
        makeCell(h, {
          font,
          sizeHalfPt: sizeHalfPt - 2,
          bold: true,
          align: AlignmentType.CENTER,
          shade: 'DBEAFE',
        }),
      ),
    }),
  ];

  for (const entry of dossier.answerKey.entries) {
    const equiv =
      entry.acceptedAnswers && entry.acceptedAnswers.length > 0
        ? `\nChấp nhận tương đương: ${entry.acceptedAnswers.join(' | ')}`
        : '';
    keyTableRows.push(
      new TableRow({
        children: [
          makeCell(String(entry.questionNumber), {font, sizeHalfPt: sizeHalfPt - 2, align: AlignmentType.CENTER}),
          makeCell(COGNITIVE_LABELS[entry.cognitiveLevel], {font, sizeHalfPt: sizeHalfPt - 2, align: AlignmentType.CENTER}),
          makeCell(entry.correctAnswer, {font, sizeHalfPt: sizeHalfPt - 2, bold: true}),
          makeCell(entry.points.toFixed(2), {font, sizeHalfPt: sizeHalfPt - 2, align: AlignmentType.CENTER}),
          makeCell(`${entry.explanation}${equiv}`, {font, sizeHalfPt: sizeHalfPt - 2}),
        ],
      }),
    );
  }

  children.push(
    new Table({
      width: {size: 100, type: WidthType.PERCENTAGE},
      rows: keyTableRows,
    }),
  );

  // Multi-code summary matrix if multiple codes exist
  if (codesToRender.length > 1) {
    children.push(
      new Paragraph({
        spacing: {before: 200, after: 80},
        children: [
          new TextRun({
            text: 'III. BẢNG ĐÁP ÁN TỔNG HỢP CÁC MÃ ĐỀ TRỘN',
            font,
            size: sizeHalfPt,
            bold: true,
          }),
        ],
      }),
    );
    const maxQ = Math.max(...codesToRender.map((c) => c.key.entries.length));
    const multiRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: ['Câu', ...codesToRender.map((c) => `Mã ${c.code}`)].map((h) =>
          makeCell(h, {font, sizeHalfPt: sizeHalfPt - 2, bold: true, align: AlignmentType.CENTER, shade: 'EFF6FF'}),
        ),
      }),
    ];
    for (let i = 0; i < maxQ; i++) {
      multiRows.push(
        new TableRow({
          children: [
            makeCell(String(i + 1), {font, sizeHalfPt: sizeHalfPt - 2, align: AlignmentType.CENTER}),
            ...codesToRender.map((c) =>
              makeCell(c.key.entries[i]?.correctAnswer || '', {
                font,
                sizeHalfPt: sizeHalfPt - 2,
                align: AlignmentType.CENTER,
                bold: true,
              }),
            ),
          ],
        }),
      );
    }
    children.push(new Table({width: {size: 100, type: WidthType.PERCENTAGE}, rows: multiRows}));
  }

  // Listening transcripts
  if (
    options.includeTranscriptInAnswerKey &&
    dossier.markingGuide.listeningTranscripts.length > 0
  ) {
    children.push(
      new Paragraph({
        spacing: {before: 220, after: 80},
        children: [
          new TextRun({
            text: 'IV. TRANSCRIPT BÀI NGHE (AUDIO SCRIPTS)',
            font,
            size: sizeHalfPt,
            bold: true,
          }),
        ],
      }),
    );
    for (const tr of dossier.markingGuide.listeningTranscripts) {
      children.push(
        new Paragraph({
          spacing: {before: 80, after: 40},
          children: [new TextRun({text: tr.title, font, size: sizeHalfPt - 2, bold: true})],
        }),
      );
      children.push(
        new Paragraph({
          spacing: {after: 100},
          children: [new TextRun({text: tr.transcript, font, size: sizeHalfPt - 2})],
        }),
      );
    }
  }

  // Essay & Speaking Rubrics
  if (options.includeRubricsInAnswerKey) {
    const hasWritingEssay = dossier.exam.questions.some((q) => q.format === 'essay');
    const hasSpeaking = dossier.exam.questions.some((q) => q.format === 'speaking');
    if (hasWritingEssay) {
      children.push(...buildRubricDocxSection(dossier.markingGuide.writingRubric, font, sizeHalfPt - 2));
    }
    if (hasSpeaking) {
      children.push(...buildRubricDocxSection(dossier.markingGuide.speakingRubric, font, sizeHalfPt - 2));
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {page: {margin: {top: 900, bottom: 900, left: 900, right: 900}}},
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}

function buildRubricDocxSection(
  rubric: ExamRubric,
  font: string,
  sizeHalfPt: number,
): Array<Paragraph | Table> {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: ['Tiêu chí đánh giá', 'Tỷ trọng', 'Điểm tối đa', 'Mô tả mức Xuất sắc / Đạt chuẩn'].map((h) =>
        makeCell(h, {font, sizeHalfPt, bold: true, align: AlignmentType.CENTER, shade: 'DBEAFE'}),
      ),
    }),
    ...rubric.criteria.map(
      (c) =>
        new TableRow({
          children: [
            makeCell(c.name, {font, sizeHalfPt, bold: true}),
            makeCell(`${c.weightPercent}%`, {font, sizeHalfPt, align: AlignmentType.CENTER}),
            makeCell(c.maxScore.toFixed(2), {font, sizeHalfPt, align: AlignmentType.CENTER}),
            makeCell(c.levels[0]?.description || '', {font, sizeHalfPt}),
          ],
        }),
    ),
  ];

  return [
    new Paragraph({
      spacing: {before: 200, after: 80},
      children: [
        new TextRun({
          text: `${rubric.title.toUpperCase()} (Tổng: ${rubric.totalScore.toFixed(2)} điểm)`,
          font,
          size: sizeHalfPt + 2,
          bold: true,
        }),
      ],
    }),
    new Table({width: {size: 100, type: WidthType.PERCENTAGE}, rows}),
  ];
}

/**
 * 5. OMR Multiple-Choice Answer Sheet Word (.docx)
 */
export async function buildOmrSheetDocxBlob(
  dossier: ExamDossier,
  options: ExportFormatOptions,
): Promise<Blob> {
  const font = options.fontFamily || 'Times New Roman';
  const sizeHalfPt = ptToHalfPt(12);
  const objectiveQs = dossier.exam.questions.filter(
    (q) => q.format === 'mcq' || q.format === 'ordering' || q.format === 'true_false',
  );
  const count = Math.max(objectiveQs.length, 20);
  const perCol = Math.ceil(count / 2);

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: ['Câu', 'A', 'B', 'C', 'D', 'Câu', 'A', 'B', 'C', 'D'].map((h) =>
        makeCell(h, {font, sizeHalfPt, bold: true, align: AlignmentType.CENTER, shade: 'E2E8F0'}),
      ),
    }),
  ];

  for (let i = 0; i < perCol; i++) {
    const leftNum = i + 1;
    const rightNum = i + 1 + perCol;
    rows.push(
      new TableRow({
        children: [
          makeCell(String(leftNum), {font, sizeHalfPt, bold: true, align: AlignmentType.CENTER}),
          makeCell('○', {font, sizeHalfPt, align: AlignmentType.CENTER}),
          makeCell('○', {font, sizeHalfPt, align: AlignmentType.CENTER}),
          makeCell('○', {font, sizeHalfPt, align: AlignmentType.CENTER}),
          makeCell('○', {font, sizeHalfPt, align: AlignmentType.CENTER}),
          makeCell(rightNum <= count ? String(rightNum) : '', {font, sizeHalfPt, bold: true, align: AlignmentType.CENTER}),
          makeCell(rightNum <= count ? '○' : '', {font, sizeHalfPt, align: AlignmentType.CENTER}),
          makeCell(rightNum <= count ? '○' : '', {font, sizeHalfPt, align: AlignmentType.CENTER}),
          makeCell(rightNum <= count ? '○' : '', {font, sizeHalfPt, align: AlignmentType.CENTER}),
          makeCell(rightNum <= count ? '○' : '', {font, sizeHalfPt, align: AlignmentType.CENTER}),
        ],
      }),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {page: {margin: {top: 800, bottom: 800, left: 900, right: 900}}},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: {after: 80},
            children: [
              new TextRun({
                text: 'PHIẾU TRẢ LỜI TRẮC NGHIỆM',
                font,
                size: ptToHalfPt(15),
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: {after: 160},
            children: [
              new TextRun({
                text: `${dossier.exam.header.examTitle} · Môn Tiếng Anh ${dossier.exam.header.gradeLabel} · Năm học ${dossier.scope.academicYear}`,
                font,
                size: sizeHalfPt,
                italics: true,
              }),
            ],
          }),
          new Paragraph({
            spacing: {after: 140},
            children: [
              new TextRun({
                text: 'Họ và tên: ..................................................  Lớp: .........  SBD: ................  Mã đề: ............',
                font,
                size: sizeHalfPt,
              }),
            ],
          }),
          new Table({width: {size: 100, type: WidthType.PERCENTAGE}, rows}),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

/**
 * 6. Real Multi-Sheet Excel (.xlsx) Workbook (Matrix, Spec, Multi-Code Answer Keys, Statistics)
 */
export function buildExamExcelBlob(dossier: ExamDossier): Blob {
  const wb = XLSX.utils.book_new();
  const summary = getMatrixSummary(dossier.blueprint);
  const hasHigh = dossier.blueprint.includeHighApplication;

  // Sheet 1: Ma tran
  const matrixAoA: Array<Array<string | number>> = [
    [`MA TRẬN ${dossier.exam.header.examTitle.toUpperCase()}`],
    [`Môn: Tiếng Anh ${dossier.exam.header.gradeLabel} | Bộ sách: ${dossier.scope.textbookName} | Thời gian: ${dossier.scope.durationMinutes} phút`],
    [],
    [
      'STT',
      'Kỹ năng',
      'Chủ đề',
      'Nội dung kiểm tra',
      'Đơn vị kiến thức',
      'Dạng câu hỏi',
      'Nhận biết',
      'Thông hiểu',
      'Vận dụng',
      ...(hasHigh ? ['Vận dụng cao'] : []),
      'Số câu',
      'Số đơn vị chấm',
      'Điểm số',
      'Tỷ lệ %',
    ],
  ];

  for (const rawRow of dossier.blueprint.rows) {
    const r = recalculateMatrixRow(rawRow, hasHigh, dossier.blueprint.totalScoreTarget);
    matrixAoA.push([
      r.order,
      EXAM_SKILL_LABELS[r.skill].vi,
      r.topic,
      r.testContent,
      r.knowledgeUnit,
      EXAM_FORMAT_LABELS[r.questionFormat].vi,
      r.recognitionCount,
      r.comprehensionCount,
      r.applicationCount,
      ...(hasHigh ? [r.highApplicationCount] : []),
      r.questionCount,
      r.scoringUnits,
      r.points,
      r.percentage,
    ]);
  }
  matrixAoA.push([
    '',
    'TỔNG CỘNG',
    '',
    '',
    '',
    '',
    summary.recognition,
    summary.comprehension,
    summary.application,
    ...(hasHigh ? [summary.highApplication] : []),
    summary.totalQuestions,
    summary.totalScoringUnits,
    summary.totalPoints,
    summary.totalPercentage,
  ]);
  const wsMatrix = XLSX.utils.aoa_to_sheet(matrixAoA);
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'Ma tran');

  // Sheet 2: Ban dac ta
  const specAoA: Array<Array<string | number>> = [
    [`BẢN ĐẶC TẢ ${dossier.exam.header.examTitle.toUpperCase()}`],
    [],
    [
      'STT',
      'Kỹ năng',
      'Chủ đề',
      'Nội dung kiến thức',
      'Yêu cầu cần đạt',
      'Biểu hiện cần đánh giá',
      'Dạng câu hỏi',
      'Mức độ',
      'Số câu',
      'Vị trí câu',
      'Điểm',
    ],
    ...dossier.specification.rows.map((sr) => [
      sr.order,
      EXAM_SKILL_LABELS[sr.skill].vi,
      sr.topic,
      sr.knowledgeContent,
      sr.learningOutcome,
      sr.assessmentDescriptor,
      EXAM_FORMAT_LABELS[sr.questionFormat].vi,
      COGNITIVE_LABELS[sr.cognitiveLevel],
      sr.questionCount,
      sr.questionPositions,
      sr.points,
    ]),
  ];
  const wsSpec = XLSX.utils.aoa_to_sheet(specAoA);
  XLSX.utils.book_append_sheet(wb, wsSpec, 'Ban dac ta');

  // Sheet 3: Dap an cac ma de
  const codes: Array<{code: string; key: AnswerKey}> =
    dossier.versions.length > 0
      ? dossier.versions.map((v) => ({code: v.code, key: v.answerKey}))
      : [{code: dossier.answerKey.examCode || '101', key: dossier.answerKey}];

  const ansAoA: Array<Array<string | number>> = [
    ['Câu', 'Kỹ năng', 'Mức độ', 'Điểm', ...codes.map((c) => `Mã ${c.code}`)],
  ];
  const maxQ = Math.max(...codes.map((c) => c.key.entries.length), 0);
  for (let i = 0; i < maxQ; i++) {
    const baseEntry = dossier.answerKey.entries[i];
    ansAoA.push([
      i + 1,
      baseEntry ? EXAM_SKILL_LABELS[baseEntry.skill].vi : '',
      baseEntry ? COGNITIVE_LABELS[baseEntry.cognitiveLevel] : '',
      baseEntry ? baseEntry.points : '',
      ...codes.map((c) => c.key.entries[i]?.correctAnswer || ''),
    ]);
  }
  const wsAns = XLSX.utils.aoa_to_sheet(ansAoA);
  XLSX.utils.book_append_sheet(wb, wsAns, 'Dap an cac ma de');

  // Sheet 4: Thong ke muc do
  const statsAoA: Array<Array<string | number>> = [
    ['THỐNG KÊ MỨC ĐỘ NHẬN THỨC'],
    ['Mức độ', 'Số câu', 'Điểm số', 'Tỷ lệ %'],
    ['Nhận biết', summary.recognition, summary.recognitionPts, summary.recognitionPct],
    ['Thông hiểu', summary.comprehension, summary.comprehensionPts, summary.comprehensionPct],
    ['Vận dụng', summary.application, summary.applicationPts, summary.applicationPct],
    ...(hasHigh
      ? [['Vận dụng cao', summary.highApplication, summary.highApplicationPts, summary.highApplicationPct]]
      : []),
    ['TỔNG', summary.totalQuestions, summary.totalPoints, summary.totalPercentage],
  ];
  const wsStats = XLSX.utils.aoa_to_sheet(statsAoA);
  XLSX.utils.book_append_sheet(wb, wsStats, 'Thong ke');

  const out = XLSX.write(wb, {bookType: 'xlsx', type: 'array'});
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * 7. Complete 1-Click ZIP Dossier Bundle (Matrix, Spec, Student Exam(s), Answer Key, Excel, OMR, Audio)
 */
export async function buildFullExamZipBlob(
  dossier: ExamDossier,
  options: ExportFormatOptions,
): Promise<Blob> {
  const zip = new JSZip();
  const baseName = sanitizeFileName(dossier.title);

  const [matrixBlob, specBlob, answerBlob, omrBlob] = await Promise.all([
    buildMatrixDocxBlob(dossier, options),
    buildSpecificationDocxBlob(dossier, options),
    buildAnswerKeyDocxBlob(dossier, options),
    buildOmrSheetDocxBlob(dossier, options),
  ]);
  const excelBlob = buildExamExcelBlob(dossier);

  zip.file(`01_Ma_tran_${baseName}.docx`, matrixBlob);
  zip.file(`02_Ban_dac_ta_${baseName}.docx`, specBlob);

  // Export student exams for all shuffled versions (or default base exam)
  if (dossier.versions.length > 0) {
    for (const ver of dossier.versions) {
      const studentBlob = await buildStudentExamDocxBlob(dossier, options, ver.code);
      zip.file(`03_De_Hoc_sinh_Ma_${ver.code}_${baseName}.docx`, studentBlob);
    }
  } else {
    const studentBlob = await buildStudentExamDocxBlob(dossier, options);
    zip.file(
      `03_De_Hoc_sinh_Ma_${dossier.exam.header.examCode || '101'}_${baseName}.docx`,
      studentBlob,
    );
  }

  zip.file(`04_Dap_an_va_Huong_dan_cham_${baseName}.docx`, answerBlob);
  zip.file(`05_Ma_tran_Dap_an_Thong_ke_${baseName}.xlsx`, excelBlob);
  if (options.includeOmrSheet) {
    zip.file(`06_Phieu_tra_loi_trac_nghiem_${baseName}.docx`, omrBlob);
  }

  // Include any uploaded Listening audio files inside /Audio folder
  const audioGroups = dossier.exam.groups.filter((g) => g.skill === 'listening' && g.audio);
  for (let i = 0; i < audioGroups.length; i++) {
    const g = audioGroups[i];
    if (g.audio?.dataUrl && g.audio.dataUrl.startsWith('data:')) {
      const base64Part = g.audio.dataUrl.split(',')[1];
      if (base64Part) {
        const ext = g.audio.fileName?.split('.').pop() || 'mp3';
        zip.file(`Audio/Listening_Part_${i + 1}.${ext}`, base64Part, {base64: true});
      }
    }
    if (g.audio?.transcript) {
      zip.file(`Audio/Listening_Part_${i + 1}_Transcript.txt`, g.audio.transcript);
    }
  }

  return zip.generateAsync({type: 'blob'});
}

// Convenient UI Download Triggers
export async function downloadMatrixDocx(dossier: ExamDossier, options: ExportFormatOptions) {
  const blob = await buildMatrixDocxBlob(dossier, options);
  triggerDownload(blob, `Ma_tran_${sanitizeFileName(dossier.title)}.docx`);
}

export async function downloadSpecificationDocx(dossier: ExamDossier, options: ExportFormatOptions) {
  const blob = await buildSpecificationDocxBlob(dossier, options);
  triggerDownload(blob, `Ban_dac_ta_${sanitizeFileName(dossier.title)}.docx`);
}

export async function downloadStudentExamDocx(
  dossier: ExamDossier,
  options: ExportFormatOptions,
  versionCode?: string,
) {
  const blob = await buildStudentExamDocxBlob(dossier, options, versionCode);
  const code = versionCode || dossier.exam.header.examCode || '101';
  triggerDownload(blob, `De_Thi_Ma_${code}_${sanitizeFileName(dossier.title)}.docx`);
}

export async function downloadAnswerKeyDocx(dossier: ExamDossier, options: ExportFormatOptions) {
  const blob = await buildAnswerKeyDocxBlob(dossier, options);
  triggerDownload(blob, `Dap_an_HDC_${sanitizeFileName(dossier.title)}.docx`);
}

export async function downloadOmrSheetDocx(dossier: ExamDossier, options: ExportFormatOptions) {
  const blob = await buildOmrSheetDocxBlob(dossier, options);
  triggerDownload(blob, `Phieu_Tra_Loi_TN_${sanitizeFileName(dossier.title)}.docx`);
}

export function downloadExamExcel(dossier: ExamDossier) {
  const blob = buildExamExcelBlob(dossier);
  triggerDownload(blob, `Ho_So_Ma_Tran_Dap_An_${sanitizeFileName(dossier.title)}.xlsx`);
}

export async function downloadFullExamZip(dossier: ExamDossier, options: ExportFormatOptions) {
  const blob = await buildFullExamZipBlob(dossier, options);
  triggerDownload(blob, `Tron_Bo_Ho_So_De_${sanitizeFileName(dossier.title)}.zip`);
}

/**
 * Print / Save-as-PDF via clean A4 print stylesheet (no window.open needed — prints inside iframe/dialog safely!)
 */
export function printExamHtmlInIframe(htmlContent: string, landscape = false) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(`<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>In hồ sơ đề kiểm tra — English Lesson Studio</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Charis+SIL:ital,wght@0,400;0,700;1,400&display=swap" />
<style>
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 16mm; }
  body { font-family: "Times New Roman", "Charis SIL", Times, serif; font-size: 13pt; line-height: 1.45; color: #0f172a; margin: 0; }
  .ipa-inline { font-family: "Charis SIL", "Doulos SIL", "DejaVu Sans", serif; }
  h1, h2, h3 { margin: 0 0 8px 0; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 16px 0; font-size: 11.5pt; }
  th, td { border: 1px solid #64748b; padding: 6px 8px; vertical-align: top; }
  th { background: #eff6ff; font-weight: 700; text-align: center; }
  .header-grid { display: flex; justify-content: space-between; margin-bottom: 14px; border-bottom: 1.5px solid #0f172a; padding-bottom: 10px; }
  .header-col { width: 48%; text-align: center; }
  .passage { border: 1px solid #cbd5e1; padding: 10px 14px; margin: 8px 0 12px 0; background: #f8fafc; text-align: justify; }
  .q-block { margin-bottom: 10px; page-break-inside: avoid; }
  .opts { margin-left: 18px; margin-top: 4px; }
  .center { text-align: center; }
  u { text-decoration: underline; text-underline-offset: 2px; }
  mark { padding: 0 2px; border-radius: 2px; }
</style>
</head>
<body>${htmlContent}</body>
</html>`);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    }, 1500);
  }, 250);
}

function escapeHtmlPreservingUnderline(text: string): string {
  return richHtmlToPrintableHtml(text);
}

export function printStudentExamPdf(dossier: ExamDossier, versionCode?: string) {
  const matchedVer = versionCode
    ? dossier.versions.find((v) => v.code === versionCode)
    : undefined;
  const activeExam: Exam = matchedVer
    ? {
        ...dossier.exam,
        header: {...dossier.exam.header, examCode: matchedVer.code},
        groups: matchedVer.groups,
        questions: matchedVer.questions,
      }
    : dossier.exam;

  const dept = activeExam.header.departmentName?.trim() || 'SỞ GD&ĐT ...............................';
  const school = activeExam.header.schoolName?.trim() || 'TRƯỜNG THPT ................................';

  const groupsHtml = [...activeExam.groups]
    .sort((a, b) => a.order - b.order)
    .map((group) => {
      const qs = activeExam.questions
        .filter((q) => q.groupId === group.id)
        .sort((a, b) => a.number - b.number);
      if (qs.length === 0) return '';
      const stim =
        group.stimulusParagraphs && group.stimulusParagraphs.length > 0
          ? `<div class="passage">${group.stimulusTitle ? `<div class="center"><strong>${escapeHtmlPreservingUnderline(group.stimulusTitle)}</strong></div>` : ''}${group.stimulusParagraphs
              .map((p) => `<p>${escapeHtmlPreservingUnderline(p)}</p>`)
              .join('')}</div>`
          : '';
      const qHtml = qs
        .map((q) => {
          const opts =
            q.options && q.options.length > 0
              ? `<div class="opts">${q.options
                  .map(
                    (o) =>
                      `<div><strong>${o.label}.</strong> ${escapeHtmlPreservingUnderline(o.text)}</div>`,
                  )
                  .join('')}</div>`
              : '';
          return `<div class="q-block"><strong>Question ${q.number}.</strong> ${escapeHtmlPreservingUnderline(q.prompt)}${opts}</div>`;
        })
        .join('');
      return `<h3>${escapeHtmlPreservingUnderline(group.title)}</h3><p><em>${escapeHtmlPreservingUnderline(group.instruction)}</em></p>${stim}${qHtml}`;
    })
    .join('');

  const html = `
    <div class="header-grid">
      <div class="header-col">
        <div>${escapeHtmlPreservingUnderline(dept.toUpperCase())}</div>
        <div><strong>${escapeHtmlPreservingUnderline(school.toUpperCase())}</strong></div>
        <div style="margin-top:6px;"><strong>MÃ ĐỀ: ${escapeHtmlPreservingUnderline(activeExam.header.examCode || '101')}</strong></div>
      </div>
      <div class="header-col">
        <div><strong>${escapeHtmlPreservingUnderline(activeExam.header.examTitle.toUpperCase())}</strong></div>
        <div><strong>NĂM HỌC ${escapeHtmlPreservingUnderline(activeExam.header.academicYear)} — MÔN: TIẾNG ANH (${escapeHtmlPreservingUnderline(activeExam.header.gradeLabel)})</strong></div>
        <div><em>Thời gian làm bài: ${activeExam.header.durationMinutes} phút</em></div>
      </div>
    </div>
    <p>Họ và tên thí sinh: ......................................................... SBD: ....................... Lớp: ..........</p>
    ${groupsHtml}
    <p class="center" style="margin-top:24px;"><strong>——— HẾT ———</strong></p>
  `;
  printExamHtmlInIframe(html, false);
}

export function printMatrixOrSpecPdf(dossier: ExamDossier, type: 'matrix' | 'spec') {
  if (type === 'matrix') {
    const summary = getMatrixSummary(dossier.blueprint);
    const hasHigh = dossier.blueprint.includeHighApplication;
    const rowsHtml = dossier.blueprint.rows
      .map((raw) => {
        const r = recalculateMatrixRow(raw, hasHigh, dossier.blueprint.totalScoreTarget);
        return `<tr>
          <td class="center">${r.order}</td>
          <td><strong>${EXAM_SKILL_LABELS[r.skill].vi}</strong><br/>${escapeHtmlPreservingUnderline(r.topic)}</td>
          <td>${escapeHtmlPreservingUnderline(r.testContent)}</td>
          <td>${escapeHtmlPreservingUnderline(r.knowledgeUnit)}</td>
          <td>${EXAM_FORMAT_LABELS[r.questionFormat].vi}</td>
          <td class="center">${r.recognitionCount}</td>
          <td class="center">${r.comprehensionCount}</td>
          <td class="center">${r.applicationCount}</td>
          ${hasHigh ? `<td class="center">${r.highApplicationCount}</td>` : ''}
          <td class="center"><strong>${r.questionCount}</strong></td>
          <td class="center"><strong>${r.points.toFixed(2)}</strong></td>
          <td class="center">${r.percentage.toFixed(1)}%</td>
        </tr>`;
      })
      .join('');
    const html = `
      <h2 class="center">MA TRẬN ${escapeHtmlPreservingUnderline(dossier.exam.header.examTitle.toUpperCase())}</h2>
      <p class="center"><em>Tiếng Anh ${dossier.exam.header.gradeLabel} · ${escapeHtmlPreservingUnderline(dossier.scope.textbookName)} · ${dossier.scope.durationMinutes} phút</em></p>
      <table>
        <thead><tr><th>STT</th><th>Kỹ năng / Chủ đề</th><th>Nội dung kiểm tra</th><th>Đơn vị kiến thức</th><th>Dạng câu hỏi</th><th>NB</th><th>TH</th><th>VD</th>${hasHigh ? '<th>VDC</th>' : ''}<th>Số câu</th><th>Điểm</th><th>Tỷ lệ %</th></tr></thead>
        <tbody>
          ${rowsHtml}
          <tr>
            <td colspan="5"><strong>TỔNG CỘNG</strong></td>
            <td class="center"><strong>${summary.recognition}</strong></td>
            <td class="center"><strong>${summary.comprehension}</strong></td>
            <td class="center"><strong>${summary.application}</strong></td>
            ${hasHigh ? `<td class="center"><strong>${summary.highApplication}</strong></td>` : ''}
            <td class="center"><strong>${summary.totalQuestions}</strong></td>
            <td class="center"><strong>${summary.totalPoints.toFixed(2)}</strong></td>
            <td class="center"><strong>${summary.totalPercentage.toFixed(1)}%</strong></td>
          </tr>
        </tbody>
      </table>`;
    printExamHtmlInIframe(html, true);
  } else {
    const rowsHtml = dossier.specification.rows
      .map(
        (sr) => `<tr>
          <td class="center">${sr.order}</td>
          <td><strong>${EXAM_SKILL_LABELS[sr.skill].vi}</strong></td>
          <td>${escapeHtmlPreservingUnderline(sr.knowledgeContent)}</td>
          <td>${escapeHtmlPreservingUnderline(sr.learningOutcome)}</td>
          <td>${escapeHtmlPreservingUnderline(sr.assessmentDescriptor)}</td>
          <td class="center">${EXAM_FORMAT_LABELS[sr.questionFormat].vi}</td>
          <td class="center">${COGNITIVE_LABELS[sr.cognitiveLevel]}</td>
          <td class="center">${sr.questionCount}</td>
          <td class="center">${sr.questionPositions}</td>
          <td class="center">${sr.points.toFixed(2)}</td>
        </tr>`,
      )
      .join('');
    const html = `
      <h2 class="center">BẢN ĐẶC TẢ ${escapeHtmlPreservingUnderline(dossier.exam.header.examTitle.toUpperCase())}</h2>
      <p class="center"><em>Tiếng Anh ${dossier.exam.header.gradeLabel} · ${escapeHtmlPreservingUnderline(dossier.scope.textbookName)} · ${dossier.scope.durationMinutes} phút</em></p>
      <table>
        <thead><tr><th>STT</th><th>Kỹ năng</th><th>Nội dung kiến thức</th><th>Yêu cầu cần đạt</th><th>Biểu hiện cần đánh giá</th><th>Dạng câu hỏi</th><th>Mức độ</th><th>Số câu</th><th>Vị trí câu</th><th>Điểm</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;
    printExamHtmlInIframe(html, true);
  }
}
