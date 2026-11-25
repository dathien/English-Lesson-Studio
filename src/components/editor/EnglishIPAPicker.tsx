import React, {useState} from 'react';
import {X} from 'lucide-react';

interface SymbolEntry {
  symbol: string;
  example?: string;
  label?: string;
}

const MONOPHTHONGS: SymbolEntry[] = [
  {symbol: 'iː', example: 'see'},
  {symbol: 'ɪ', example: 'sit'},
  {symbol: 'e', example: 'ten'},
  {symbol: 'æ', example: 'cat'},
  {symbol: 'ɑː', example: 'father'},
  {symbol: 'ɒ', example: 'hot'},
  {symbol: 'ɔː', example: 'saw'},
  {symbol: 'ʊ', example: 'put'},
  {symbol: 'uː', example: 'too'},
  {symbol: 'ʌ', example: 'cup'},
  {symbol: 'ɜː', example: 'bird'},
  {symbol: 'ə', example: 'about'},
];

const DIPHTHONGS: SymbolEntry[] = [
  {symbol: 'eɪ', example: 'say'},
  {symbol: 'aɪ', example: 'my'},
  {symbol: 'ɔɪ', example: 'boy'},
  {symbol: 'əʊ', example: 'go'},
  {symbol: 'aʊ', example: 'now'},
  {symbol: 'ɪə', example: 'near'},
  {symbol: 'eə', example: 'hair'},
  {symbol: 'ʊə', example: 'pure'},
];

const CONSONANTS: SymbolEntry[] = [
  {symbol: 'p', example: 'pen'},
  {symbol: 'b', example: 'bad'},
  {symbol: 't', example: 'tea'},
  {symbol: 'd', example: 'did'},
  {symbol: 'k', example: 'cat'},
  {symbol: 'ɡ', example: 'got'},
  {symbol: 'f', example: 'fall'},
  {symbol: 'v', example: 'van'},
  {symbol: 'θ', example: 'thin'},
  {symbol: 'ð', example: 'this'},
  {symbol: 's', example: 'so'},
  {symbol: 'z', example: 'zoo'},
  {symbol: 'ʃ', example: 'she'},
  {symbol: 'ʒ', example: 'vision'},
  {symbol: 'h', example: 'hat'},
  {symbol: 'tʃ', example: 'chair'},
  {symbol: 'dʒ', example: 'jam'},
  {symbol: 'm', example: 'man'},
  {symbol: 'n', example: 'no'},
  {symbol: 'ŋ', example: 'sing'},
  {symbol: 'l', example: 'leg'},
  {symbol: 'r', example: 'red'},
  {symbol: 'j', example: 'yes'},
  {symbol: 'w', example: 'wet'},
];

const PHONETIC_MARKS: SymbolEntry[] = [
  {symbol: 'ˈ', label: 'Trọng âm chính'},
  {symbol: 'ˌ', label: 'Trọng âm phụ'},
  {symbol: 'ː', label: 'Dấu độ dài'},
  {symbol: '.', label: 'Ngắt âm tiết'},
  {symbol: '/ /', label: 'Bao phiên âm âm vị'},
  {symbol: '[ ]', label: 'Bao phiên âm ngữ âm'},
];

const US_CONVENTIONS: SymbolEntry[] = [
  {symbol: 'ɝː', example: 'bird (US)'},
  {symbol: 'ɚ', example: 'better (US)'},
  {symbol: 'oʊ', example: 'go (US)'},
  {symbol: 'ɑːr', example: 'car (US)'},
  {symbol: 'ɾ', example: 'water (flap)'},
  {symbol: 't̬', example: 'better (US)'},
];

const SPECIAL_CHARS: SymbolEntry[] = [
  {symbol: '______', label: 'Chỗ trống điền từ'},
  {symbol: '—', label: 'Gạch ngang dài'},
  {symbol: '–', label: 'Gạch ngang ngắn'},
  {symbol: '…', label: 'Dấu ba chấm'},
  {symbol: '“', label: 'Mở ngoặc kép'},
  {symbol: '”', label: 'Đóng ngoặc kép'},
  {symbol: '‘', label: 'Mở ngoặc đơn'},
  {symbol: '’', label: 'Dấu nháy sở hữu'},
  {symbol: '→', label: 'Mũi tên suy ra'},
  {symbol: '↔', label: 'Tương đương'},
  {symbol: '✓', label: 'Đúng / Đạt'},
  {symbol: '✗', label: 'Sai / Loại'},
  {symbol: '×', label: 'Dấu nhân'},
  {symbol: '÷', label: 'Dấu chia'},
  {symbol: '±', label: 'Cộng trừ'},
  {symbol: '°', label: 'Độ'},
  {symbol: '①', label: 'Vị trí 1'},
  {symbol: '②', label: 'Vị trí 2'},
  {symbol: '③', label: 'Vị trí 3'},
  {symbol: '④', label: 'Vị trí 4'},
];

interface EnglishIPAPickerProps {
  initialTab?: 'ipa' | 'special';
  onInsert: (text: string) => void;
  onWrapSelection?: (left: string, right: string) => void;
  onClose: () => void;
}

export const EnglishIPAPicker: React.FC<EnglishIPAPickerProps> = ({
  initialTab = 'ipa',
  onInsert,
  onWrapSelection,
  onClose,
}) => {
  const [tab, setTab] = useState<'ipa' | 'special'>(initialTab);
  const [showUS, setShowUS] = useState(false);

  const handleSymbolClick = (entry: SymbolEntry) => {
    if (entry.symbol === '/ /' && onWrapSelection) {
      onWrapSelection('/', '/');
      return;
    }
    if (entry.symbol === '[ ]' && onWrapSelection) {
      onWrapSelection('[', ']');
      return;
    }
    onInsert(entry.symbol);
  };

  return (
    <div
      className="z-40 w-[min(92vw,540px)] rounded-2xl border border-slate-200 bg-white shadow-xl p-3.5 space-y-3 text-left"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setTab('ipa')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
              tab === 'ipa' ? 'bg-white text-[#1E40AF] shadow-xs' : 'text-slate-600'
            }`}
          >
            Bảng ngữ âm IPA
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setTab('special')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
              tab === 'special' ? 'bg-white text-[#1E40AF] shadow-xs' : 'text-slate-600'
            }`}
          >
            Ký tự đặc biệt
          </button>
        </div>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClose}
          title="Đóng bảng ký hiệu"
          className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {tab === 'ipa' ? (
        <div className="space-y-3 max-h-[360px] overflow-y-auto studio-scroll pr-1">
          {/* Monophthongs */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-500">Nguyên âm đơn (Anh-Anh)</div>
            <div className="grid grid-cols-6 gap-1.5">
              {MONOPHTHONGS.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  title={`Chèn /${item.symbol}/ (như "${item.example}")`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSymbolClick(item)}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 hover:border-[#2563EB] hover:bg-blue-50 py-1.5 px-1 text-center transition-colors"
                >
                  <div className="font-ipa text-base font-bold text-[#0F172A] leading-tight">
                    {item.symbol}
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                    {item.example}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Diphthongs */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-500">Nguyên âm đôi</div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {DIPHTHONGS.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  title={`Chèn /${item.symbol}/ (như "${item.example}")`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSymbolClick(item)}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 hover:border-[#2563EB] hover:bg-blue-50 py-1.5 px-1 text-center transition-colors"
                >
                  <div className="font-ipa text-base font-bold text-[#0F172A] leading-tight">
                    {item.symbol}
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                    {item.example}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Consonants */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-500">Phụ âm</div>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
              {CONSONANTS.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  title={`Chèn /${item.symbol}/ (như "${item.example}")`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSymbolClick(item)}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 hover:border-[#2563EB] hover:bg-blue-50 py-1 px-1 text-center transition-colors"
                >
                  <div className="font-ipa text-[15px] font-bold text-[#0F172A] leading-tight">
                    {item.symbol}
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight">{item.example}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Phonetic Marks */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-500">Dấu ngữ âm &amp; Bao phiên âm</div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {PHONETIC_MARKS.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  title={item.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSymbolClick(item)}
                  className="rounded-lg border border-blue-200 bg-blue-50/50 hover:bg-blue-100 py-1.5 px-1 text-center transition-colors"
                >
                  <div className="font-ipa text-base font-bold text-[#1E40AF] leading-tight">
                    {item.symbol}
                  </div>
                  <div className="text-[10px] text-slate-600 leading-tight mt-0.5 truncate">
                    {item.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Optional US English IPA Conventions */}
          <div className="pt-1 border-t border-slate-100 space-y-1.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowUS((v) => !v)}
              className="text-xs font-semibold text-[#2563EB] hover:underline"
            >
              {showUS ? 'Ẩn ký hiệu mở rộng Anh-Mỹ' : '+ Mở rộng quy ước phiên âm Anh-Mỹ'}
            </button>
            {showUS && (
              <div className="grid grid-cols-6 gap-1.5">
                {US_CONVENTIONS.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    title={`Chèn ${item.symbol} (${item.example})`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSymbolClick(item)}
                    className="rounded-lg border border-cyan-200 bg-cyan-50/50 hover:bg-cyan-100 py-1.5 px-1 text-center"
                  >
                    <div className="font-ipa text-base font-bold text-cyan-950">{item.symbol}</div>
                    <div className="text-[9px] text-slate-600 truncate">{item.example}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-[300px] overflow-y-auto studio-scroll">
          {SPECIAL_CHARS.map((item) => (
            <button
              key={item.symbol}
              type="button"
              title={item.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onInsert(item.symbol)}
              className="rounded-lg border border-slate-200 bg-slate-50/70 hover:border-[#2563EB] hover:bg-blue-50 py-2 px-1.5 text-center transition-colors"
            >
              <div className="text-sm font-bold text-[#0F172A] truncate">{item.symbol}</div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">{item.label}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
