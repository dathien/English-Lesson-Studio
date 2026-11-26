import React, {useMemo, useState} from 'react';
import {
  CheckCircle2,
  Ear,
  Grid,
  HelpCircle,
  RotateCcw,
  Shuffle,
  Volume2,
  XCircle,
} from 'lucide-react';
import {
  SOURCE_PROVENANCE_LABELS,
  type LabVocabularyItem,
} from '../../../types/interactiveLab';
import {playLabSoundEffect, speakLabText} from '../../../services/labAudioService';

interface VisualVocabDrawerProps {
  vocab: LabVocabularyItem[];
  accent: 'en-GB' | 'en-US';
  unitTitleEn: string;
}

type VocabMode = 'cards' | 'listen_pick' | 'match' | 'fill_blank' | 'unscramble';

function scrambleWord(word: string): string {
  const letters = word.replace(/\s+/g, '').split('');
  for (let i = letters.length - 1; i > 0; i--) {
    const j = (i * 7 + 3) % (i + 1);
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  const out = letters.join('');
  return out.toLowerCase() === word.replace(/\s+/g, '').toLowerCase()
    ? letters.reverse().join('')
    : out;
}

export const VisualVocabDrawer: React.FC<VisualVocabDrawerProps> = ({
  vocab,
  accent,
  unitTitleEn,
}) => {
  const [mode, setMode] = useState<VocabMode>('cards');
  const [quizIdx, setQuizIdx] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [checked, setChecked] = useState<null | boolean>(null);
  const [score, setScore] = useState(0);

  // Match mode state
  const [matchSelectedWord, setMatchSelectedWord] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [matchWrong, setMatchWrong] = useState(false);

  const matchSubset = useMemo(() => vocab.slice(0, 6), [vocab]);
  const shuffledMeanings = useMemo(() => {
    const arr = [...matchSubset];
    arr.sort((a, b) => a.meaningVi.localeCompare(b.meaningVi));
    return arr;
  }, [matchSubset]);

  const currentItem = vocab[quizIdx % Math.max(1, vocab.length)];

  const listenChoices = useMemo(() => {
    if (!currentItem) return [];
    const others = vocab.filter((v) => v.id !== currentItem.id).slice(0, 3);
    const list = [currentItem, ...others];
    list.sort((a, b) => a.word.localeCompare(b.word));
    return list;
  }, [currentItem, vocab]);

  const resetMiniGame = (nextMode: VocabMode) => {
    setMode(nextMode);
    setQuizIdx(0);
    setSelectedChoice(null);
    setTextInput('');
    setChecked(null);
    setScore(0);
    setMatchSelectedWord(null);
    setMatchedIds([]);
    setMatchWrong(false);
  };

  const nextQuestion = () => {
    setQuizIdx((prev) => (prev + 1) % Math.max(1, vocab.length));
    setSelectedChoice(null);
    setTextInput('');
    setChecked(null);
  };

  return (
    <div className="space-y-4">
      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-2xl border border-slate-200 p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              {id: 'cards', label: `Bộ thẻ từ (${vocab.length})`, icon: Grid},
              {id: 'listen_pick', label: 'Nghe & Chọn từ', icon: Ear},
              {id: 'match', label: 'Nối từ – Nghĩa', icon: CheckCircle2},
              {id: 'fill_blank', label: 'Điền từ vào câu', icon: HelpCircle},
              {id: 'unscramble', label: 'Ghép chữ cái', icon: Shuffle},
            ] as Array<{id: VocabMode; label: string; icon: React.ComponentType<{className?: string}>}>
          ).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => resetMiniGame(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  mode === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <span className="text-xs font-semibold text-slate-500">
          Chủ đề: <strong className="text-slate-800">{unitTitleEn}</strong>
        </span>
      </div>

      {/* 1. Visual Vocabulary Cards Grid */}
      {mode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {vocab.map((item) => {
            const prov = SOURCE_PROVENANCE_LABELS[item.provenance];
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-400 transition flex flex-col justify-between gap-2.5"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-extrabold text-slate-900">{item.word}</h4>
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {item.partOfSpeech}
                        </span>
                      </div>
                      <div className="font-ipa text-xs text-blue-700 font-semibold mt-0.5">
                        {accent === 'en-US' && item.ipaUs ? item.ipaUs : item.ipaUk}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => speakLabText(item.word, accent)}
                      className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition"
                      title="Nghe phát âm"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm font-bold text-emerald-700 mt-1.5">{item.meaningVi}</p>
                  <p className="text-xs text-slate-600 mt-1 italic">“{item.example}”</p>
                  <p className="text-[11px] text-slate-500 mt-1">{item.contextNote}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${prov.badgeClass}`}>
                    {prov.shortLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => speakLabText(item.example, accent)}
                    className="text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    Nghe câu ví dụ
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Listen and Pick */}
      {mode === 'listen_pick' && currentItem && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Từ {quizIdx + 1}/{vocab.length} · Điểm: {score}
            </span>
            <button
              type="button"
              onClick={() => speakLabText(currentItem.word, accent)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
            >
              <Volume2 className="w-4 h-4" />
              Nghe phát âm từ cần chọn
            </button>
          </div>
          <p className="text-xs text-slate-600">
            Nghĩa gợi ý: <strong>{currentItem.meaningVi}</strong>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {listenChoices.map((ch) => {
              const isPicked = selectedChoice === ch.id;
              const isRight = checked !== null && ch.id === currentItem.id;
              const isWrong = checked !== null && isPicked && ch.id !== currentItem.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  disabled={checked !== null}
                  onClick={() => {
                    setSelectedChoice(ch.id);
                    const ok = ch.id === currentItem.id;
                    setChecked(ok);
                    if (ok) setScore((s) => s + 1);
                    playLabSoundEffect(ok ? 'correct' : 'incorrect');
                  }}
                  className={`p-3 rounded-xl border text-left transition ${
                    isRight
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                      : isWrong
                        ? 'bg-rose-50 border-rose-500 text-rose-900'
                        : 'bg-slate-50 border-slate-200 hover:border-blue-500'
                  }`}
                >
                  <div className="text-sm font-bold">{ch.word}</div>
                  <div className="font-ipa text-xs text-slate-500">{ch.ipaUk}</div>
                </button>
              );
            })}
          </div>
          {checked !== null && (
            <div className="flex items-center justify-between pt-2">
              <span className={`text-xs font-bold ${checked ? 'text-emerald-700' : 'text-rose-700'}`}>
                {checked ? 'Chính xác!' : `Đáp án đúng là: ${currentItem.word} (${currentItem.ipaUk})`}
              </span>
              <button
                type="button"
                onClick={nextQuestion}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Từ tiếp theo →
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Match Word <-> Meaning */}
      {mode === 'match' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              Chọn 1 từ tiếng Anh ở cột trái rồi chọn nghĩa tiếng Việt tương ứng ở cột phải ({matchedIds.length}/{matchSubset.length})
            </span>
            <button
              type="button"
              onClick={() => {
                setMatchedIds([]);
                setMatchSelectedWord(null);
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Làm lại
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              {matchSubset.map((item) => {
                const done = matchedIds.includes(item.id);
                const active = matchSelectedWord === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={done}
                    onClick={() => {
                      setMatchSelectedWord(item.id);
                      setMatchWrong(false);
                      speakLabText(item.word, accent);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-sm font-bold transition ${
                      done
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 line-through'
                        : active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 border-slate-200 hover:border-blue-400'
                    }`}
                  >
                    {item.word} <span className="font-ipa text-xs font-normal opacity-80">{item.ipaUk}</span>
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              {shuffledMeanings.map((item) => {
                const done = matchedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={done || !matchSelectedWord}
                    onClick={() => {
                      if (matchSelectedWord === item.id) {
                        setMatchedIds((prev) => [...prev, item.id]);
                        setMatchSelectedWord(null);
                        setMatchWrong(false);
                        playLabSoundEffect('correct');
                      } else {
                        setMatchWrong(true);
                        playLabSoundEffect('incorrect');
                      }
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition ${
                      done
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-white border-slate-200 hover:border-blue-400 disabled:opacity-60'
                    }`}
                  >
                    {item.meaningVi}
                  </button>
                );
              })}
            </div>
          </div>
          {matchWrong && (
            <div className="text-xs font-semibold text-rose-600 flex items-center gap-1">
              <XCircle className="w-4 h-4" />
              Chưa khớp nghĩa. Hãy thử lại nhé!
            </div>
          )}
        </div>
      )}

      {/* 4. Fill in the Blank & 5. Unscramble */}
      {(mode === 'fill_blank' || mode === 'unscramble') && currentItem && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>
              Câu {quizIdx + 1}/{vocab.length} · Điểm: {score}
            </span>
            <span className="font-ipa text-blue-700">{currentItem.ipaUk}</span>
          </div>

          {mode === 'fill_blank' ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1.5">
              <div className="text-sm font-bold text-slate-900">
                {currentItem.example.replace(new RegExp(currentItem.word, 'gi'), '________')}
              </div>
              <div className="text-xs text-emerald-700 font-semibold">
                Gợi ý nghĩa: {currentItem.meaningVi} ({currentItem.partOfSpeech})
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-4 space-y-2 text-center">
              <div className="text-xs font-bold text-indigo-700">Sắp xếp lại các chữ cái sau thành từ đúng:</div>
              <div className="text-xl font-mono font-extrabold tracking-widest text-indigo-950 uppercase">
                {scrambleWord(currentItem.word)}
              </div>
              <div className="text-xs text-slate-700">Nghĩa: {currentItem.meaningVi}</div>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={textInput}
              disabled={checked !== null}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && checked === null && textInput.trim()) {
                  const ok = textInput.trim().toLowerCase() === currentItem.word.trim().toLowerCase();
                  setChecked(ok);
                  if (ok) setScore((s) => s + 1);
                  playLabSoundEffect(ok ? 'correct' : 'incorrect');
                }
              }}
              placeholder="Gõ từ tiếng Anh chính xác..."
              className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
            />
            {checked === null ? (
              <button
                type="button"
                disabled={!textInput.trim()}
                onClick={() => {
                  const ok = textInput.trim().toLowerCase() === currentItem.word.trim().toLowerCase();
                  setChecked(ok);
                  if (ok) setScore((s) => s + 1);
                  playLabSoundEffect(ok ? 'correct' : 'incorrect');
                  speakLabText(currentItem.word, accent);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                Kiểm tra
              </button>
            ) : (
              <button
                type="button"
                onClick={nextQuestion}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Tiếp theo →
              </button>
            )}
          </div>

          {checked !== null && (
            <div
              className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2 ${
                checked ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'
              }`}
            >
              {checked ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-rose-600" />}
              <span>
                {checked
                  ? `Chính xác! "${currentItem.word}" — ${currentItem.meaningVi}`
                  : `Đáp án đúng: "${currentItem.word}" (${currentItem.ipaUk})`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
