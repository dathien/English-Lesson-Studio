import React, {useState} from 'react';
import {Highlighter, Maximize2, Minimize2, RotateCcw} from 'lucide-react';
import type {QuestionItem, ReadingPassage} from '../../types/lesson';
import {RenderFormattedText} from '../../utils/richText';
import {QuestionRenderer, type QuestionAnswerMap} from './QuestionRenderer';

interface ReadingSplitViewProps {
  passage: ReadingPassage;
  questions?: QuestionItem[];
  imageUrl?: string;
  imageCaption?: string;
  answers: QuestionAnswerMap;
  onChangeAnswer: (qId: string, val: string | string[] | Record<string, string>) => void;
  checked: boolean;
  showAnswers: boolean;
  showExplanations: boolean;
  darkSurface?: boolean;
  fontScale?: number;
}

export const ReadingSplitView: React.FC<ReadingSplitViewProps> = ({
  passage,
  questions,
  imageUrl,
  imageCaption,
  answers,
  onChangeAnswer,
  checked,
  showAnswers,
  showExplanations,
  darkSurface = false,
  fontScale = 1,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const [highlightedSentences, setHighlightedSentences] = useState<Record<string, boolean>>({});

  const toggleSentenceHighlight = (key: string) => {
    if (!highlightMode) return;
    setHighlightedSentences((prev) => ({...prev, [key]: !prev[key]}));
  };

  const surface = darkSurface
    ? 'bg-slate-800/80 border-slate-700 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  return (
    <div
      className={`grid gap-4 items-start ${
        expanded || !questions || questions.length === 0
          ? 'grid-cols-1'
          : 'grid-cols-1 lg:grid-cols-12'
      }`}
    >
      {/* Left Pane: Intact Original Passage with independent scrolling & Highlighter */}
      <div
        className={`${
          expanded || !questions || questions.length === 0 ? 'col-span-1' : 'lg:col-span-6'
        } rounded-xl border p-4 flex flex-col max-h-[60vh] ${surface}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200/70 shrink-0">
          <div className="font-semibold text-[#0F4C81] truncate">
            {passage.title || 'Reading Passage'}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setHighlightMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                highlightMode
                  ? 'border-amber-400 bg-amber-100 text-amber-950'
                  : darkSurface
                    ? 'border-slate-600 bg-slate-900 text-slate-200'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
              title="Bật chế độ tô sáng câu dẫn chứng trong bài đọc"
            >
              <Highlighter className="w-3.5 h-3.5" />
              {highlightMode ? 'Đang tô sáng' : 'Tô sáng dẫn chứng'}
            </button>

            {Object.values(highlightedSentences).some(Boolean) && (
              <button
                type="button"
                onClick={() => setHighlightedSentences({})}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800"
                title="Xóa tất cả tô sáng"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            {questions && questions.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                  darkSurface
                    ? 'border-slate-600 bg-slate-900 text-slate-200'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {expanded ? 'Chia 2 cột' : 'Mở rộng bài đọc'}
              </button>
            )}
          </div>
        </div>

        <div
          className="overflow-y-auto studio-scroll pr-2 space-y-3.5 leading-relaxed"
          style={{fontSize: `${Math.round(15.5 * fontScale)}px`}}
        >
          {imageUrl && (
            <figure className="space-y-1">
              <img
                src={imageUrl}
                alt={imageCaption || passage.title || 'Reading illustration'}
                referrerPolicy="no-referrer"
                className="w-full max-h-48 object-cover rounded-lg border border-slate-200"
              />
              {imageCaption && <figcaption className="text-xs text-slate-500">{imageCaption}</figcaption>}
            </figure>
          )}

          {highlightMode && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              Bấm vào bất kỳ câu nào trong bài đọc để tô sáng dẫn chứng cho cả lớp quan sát.
            </p>
          )}

          {passage.paragraphs.map((para, pIdx) => {
            // Split cleanly by sentences for interactive highlighting while keeping original paragraph intact!
            const sentences = para.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [para];
            return (
              <p key={pIdx} className="text-justify">
                {sentences.map((sent, sIdx) => {
                  const key = `${pIdx}-${sIdx}`;
                  const isHl = Boolean(highlightedSentences[key]);
                  return (
                    <span
                      key={key}
                      onClick={() => toggleSentenceHighlight(key)}
                      className={`${highlightMode ? 'cursor-pointer hover:bg-amber-100/70 rounded px-0.5' : ''} ${
                        isHl ? 'bg-amber-200 text-slate-950 rounded px-0.5' : ''
                      }`}
                    >
                      <RenderFormattedText text={sent} />
                    </span>
                  );
                })}
              </p>
            );
          })}

          {passage.sourceNote && (
            <p className="text-xs italic text-slate-500 pt-2 border-t border-slate-200/70">
              {passage.sourceNote}
            </p>
          )}
        </div>
      </div>

      {/* Right Pane: Grouped Questions linked to the Passage */}
      {questions && questions.length > 0 && (
        <div
          className={`${
            expanded ? 'col-span-1' : 'lg:col-span-6'
          } max-h-[60vh] overflow-y-auto studio-scroll pr-1`}
        >
          <QuestionRenderer
            questions={questions}
            answers={answers}
            onChangeAnswer={onChangeAnswer}
            checked={checked}
            showAnswers={showAnswers}
            showExplanations={showExplanations}
            darkSurface={darkSurface}
            fontScale={fontScale}
          />
        </div>
      )}
    </div>
  );
};
