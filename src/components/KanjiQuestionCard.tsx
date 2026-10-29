import React, { useState } from 'react';
import { Eye, EyeOff, Volume2 } from 'lucide-react';
import { KanjiNode } from '../types';
import { speakJapanese } from '../utils/vocabData';

interface KanjiQuestionCardProps {
  kanji: KanjiNode;
  showKanaReading: boolean;
  showRomajiReading: boolean;
  isAnswered: boolean;
  onToggleKana?: () => void;
  onToggleRomaji?: () => void;
}

export const KanjiQuestionCard: React.FC<KanjiQuestionCardProps> = ({
  kanji,
  showKanaReading,
  showRomajiReading,
  isAnswered,
}) => {
  // Local peek toggles for user interaction during question
  const [localShowKana, setLocalShowKana] = useState(false);
  const [localShowRomaji, setLocalShowRomaji] = useState(false);

  const effectiveShowKana = showKanaReading || isAnswered || localShowKana;
  const effectiveShowRomaji = showRomajiReading || isAnswered || localShowRomaji;

  const onyomiKana = kanji.onyomi && kanji.onyomi.length > 0 ? kanji.onyomi.join(', ') : '—';
  const kunyomiKana = kanji.kunyomi && kanji.kunyomi.length > 0 ? kanji.kunyomi.join(', ') : '—';

  const onyomiRomaji =
    kanji.onyomiRomaji && kanji.onyomiRomaji.length > 0 ? kanji.onyomiRomaji.join(', ') : '—';
  const kunyomiRomaji =
    kanji.kunyomiRomaji && kanji.kunyomiRomaji.length > 0 ? kanji.kunyomiRomaji.join(', ') : '—';

  const handleAudio = () => {
    // Speak first kunyomi or onyomi reading (stripped of periods), or the character itself
    const readingToSpeak =
      (kanji.kunyomi[0] && kanji.kunyomi[0].replace(/[.\-]/g, '')) ||
      (kanji.onyomi[0] && kanji.onyomi[0].replace(/[.\-]/g, '')) ||
      kanji.character;
    speakJapanese(readingToSpeak);
  };

  return (
    <div className="w-full flex flex-col items-center justify-center py-6 px-4">
      {/* Top: Large Centered Kanji Glyph */}
      <div className="relative group mb-6">
        <div className="text-7xl sm:text-8xl md:text-9xl font-bold font-jp text-[#F3F4F6] tracking-wider select-none transition-transform duration-200 group-hover:scale-105 drop-shadow-[0_4px_16px_rgba(212,175,55,0.15)]">
          {kanji.character}
        </div>

        {/* Audio Speaker Button (Floating top-right of kanji) */}
        <button
          type="button"
          onClick={handleAudio}
          title="ฟังเสียงอ่านคันจิ"
          className="absolute -top-1 -right-8 p-2 rounded-xl bg-[#1F2229] border border-[#2A2D36] text-[#9CA3AF] hover:text-[#D4AF37] hover:border-[#D4AF37]/50 transition-all cursor-pointer shadow-sm"
        >
          <Volume2 className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom: Dual-Reading Split 2-Column Layout */}
      <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Left Column: Japanese / Chinese Kana Readings (On'yomi & Kun'yomi) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#16181D]/80 border border-[#2A2D36] flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[#2A2D36]/60">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#D4AF37]">
              <span>🇯🇵 เสียงญี่ปุ่น • 🇨🇳 จีน</span>
            </div>
            {!isAnswered && !showKanaReading && (
              <button
                type="button"
                onClick={() => setLocalShowKana((prev) => !prev)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#1F2229] hover:bg-[#2A2D36] border border-[#2A2D36] text-[11px] text-[#9CA3AF] hover:text-[#F3F4F6] transition-all cursor-pointer"
              >
                {effectiveShowKana ? (
                  <>
                    <EyeOff className="w-3 h-3 text-amber-400" />
                    <span>ซ่อน</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3 text-[#9CA3AF]" />
                    <span>แอบดู</span>
                  </>
                )}
              </button>
            )}
          </div>

          {effectiveShowKana ? (
            <div className="space-y-1.5 font-jp text-left">
              <div className="text-xs text-[#9CA3AF] flex items-baseline gap-2">
                <span className="font-semibold text-[#D1D5DB] w-12 shrink-0">จีน (On):</span>
                <span className="text-sm font-bold text-amber-300 font-jp tracking-wide">
                  {onyomiKana}
                </span>
              </div>
              <div className="text-xs text-[#9CA3AF] flex items-baseline gap-2">
                <span className="font-semibold text-[#D1D5DB] w-12 shrink-0">ญี่ปุ่น (Kun):</span>
                <span className="text-sm font-bold text-sky-300 font-jp tracking-wide">
                  {kunyomiKana}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-2 text-center text-xs text-[#6B7280] italic">
              (คำอ่านถูกซ่อนอยู่ • กดแอบดูได้)
            </div>
          )}
        </div>

        {/* Right Column: Romaji Readings */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#16181D]/80 border border-[#2A2D36] flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[#2A2D36]/60">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
              <span>🔤 คำอ่าน Romaji</span>
            </div>
            {!isAnswered && !showRomajiReading && (
              <button
                type="button"
                onClick={() => setLocalShowRomaji((prev) => !prev)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#1F2229] hover:bg-[#2A2D36] border border-[#2A2D36] text-[11px] text-[#9CA3AF] hover:text-[#F3F4F6] transition-all cursor-pointer"
              >
                {effectiveShowRomaji ? (
                  <>
                    <EyeOff className="w-3 h-3 text-amber-400" />
                    <span>ซ่อน</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3 text-[#9CA3AF]" />
                    <span>แอบดู</span>
                  </>
                )}
              </button>
            )}
          </div>

          {effectiveShowRomaji ? (
            <div className="space-y-1.5 font-sans text-left">
              <div className="text-xs text-[#9CA3AF] flex items-baseline gap-2">
                <span className="font-semibold text-[#D1D5DB] w-12 shrink-0">On'yomi:</span>
                <span className="text-xs font-medium text-amber-200/90 font-mono">
                  {onyomiRomaji}
                </span>
              </div>
              <div className="text-xs text-[#9CA3AF] flex items-baseline gap-2">
                <span className="font-semibold text-[#D1D5DB] w-12 shrink-0">Kun'yomi:</span>
                <span className="text-xs font-medium text-sky-200/90 font-mono">
                  {kunyomiRomaji}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-2 text-center text-xs text-[#6B7280] italic">
              (Romaji ถูกซ่อนอยู่ • กดแอบดูได้)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
