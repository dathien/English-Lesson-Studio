import React, {useState} from 'react';
import {RotateCw, Volume2} from 'lucide-react';
import type {VocabCardItem} from '../../types/lesson';

interface VocabFlashcardsProps {
  items: VocabCardItem[];
  darkSurface?: boolean;
}

function speakWord(word: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(word);
  utter.lang = 'en-GB';
  utter.rate = 0.9;
  window.speechSynthesis.speak(utter);
}

export const VocabFlashcards: React.FC<VocabFlashcardsProps> = ({
  items,
  darkSurface = false,
}) => {
  const [flippedMap, setFlippedMap] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setFlippedMap((prev) => ({...prev, [id]: !prev[id]}));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((item) => {
        const flipped = Boolean(flippedMap[item.id]);
        return (
          <div
            key={item.id}
            onClick={() => toggle(item.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle(item.id);
              }
            }}
            className={`rounded-xl border p-5 cursor-pointer transition-all select-none ${
              darkSurface
                ? 'border-slate-700 bg-slate-800/80 hover:border-sky-400 text-slate-100'
                : 'border-slate-200 bg-white hover:border-[#0284C7] text-slate-900 shadow-xs'
            }`}
          >
            {!flipped ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xl font-bold tracking-tight">{item.word}</div>
                    <div className="flex items-center gap-2 mt-1 text-sm">
                      <span className="font-mono-tabular text-[#0284C7]">{item.ipa}</span>
                      <span aria-hidden="true" className="text-slate-400">·</span>
                      <span className="italic text-slate-500">{item.partOfSpeech}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      speakWord(item.word);
                    }}
                    className="p-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:text-[#0284C7] hover:border-[#0284C7]"
                    title="Nghe phát âm mẫu"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                <p className={`text-sm italic leading-relaxed ${darkSurface ? 'text-slate-300' : 'text-slate-600'}`}>
                  “{item.example}”
                </p>

                <div className="flex items-center gap-1.5 text-xs font-medium text-[#0284C7] pt-1">
                  <RotateCw className="w-3.5 h-3.5" />
                  Bấm để lật xem nghĩa tiếng Việt &amp; Collocations
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-lg text-[#0F4C81]">{item.word}</span>
                  <span className="font-mono-tabular text-xs text-slate-500">{item.ipa}</span>
                </div>
                <p className="font-semibold text-base">{item.meaningVi}</p>
                {item.collocations && item.collocations.length > 0 && (
                  <p className="text-xs leading-relaxed">
                    <span className="font-semibold text-slate-500">Collocations: </span>
                    {item.collocations.join(' · ')}
                  </p>
                )}
                {item.wordFamily && item.wordFamily.length > 0 && (
                  <p className="text-xs leading-relaxed">
                    <span className="font-semibold text-slate-500">Word Family: </span>
                    {item.wordFamily.join(' · ')}
                  </p>
                )}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1">
                  <RotateCw className="w-3.5 h-3.5" />
                  Bấm để quay lại mặt trước
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
