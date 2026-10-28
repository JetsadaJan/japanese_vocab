import React, { useEffect } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Lightbulb,
  Link2,
  MessageCircle,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import {
  KanjiDatabase,
  MeaningLanguage,
  VocabWord,
} from '../types';
import {
  LEVEL_METADATA,
  WORD_CATEGORY_META,
  formatKanjiLinkLabel,
  formatWordMeaning,
  speakJapanese,
} from '../utils/vocabData';
import {
  ConfusableIndex,
  doesNoteMatchWord,
  getConfusableWords,
  getPrimaryGroupIdForWord,
  resolveSemanticGroup,
} from '../utils/confusableWords';

export type HoverInspectItem =
  | { type: 'KANJI'; char: string }
  | { type: 'WORD'; wordId: string }
  | { type: 'GROUP'; groupId: string };

interface QuizHoverInspectorProps {
  history: HoverInspectItem[];
  kanjiDb: KanjiDatabase;
  wordMap: Record<string, VocabWord>;
  confusableIndex: ConfusableIndex;
  meaningLanguage: MeaningLanguage;
  showRomaji: boolean;
  onNavigateKanji: (char: string) => void;
  onNavigateWord: (wordId: string) => void;
  onNavigateGroup: (groupId: string) => void;
  onBack: () => void;
  onClose: () => void;
}

export const QuizHoverInspector: React.FC<QuizHoverInspectorProps> = ({
  history,
  kanjiDb,
  wordMap,
  confusableIndex,
  meaningLanguage,
  showRomaji,
  onNavigateKanji,
  onNavigateWord,
  onNavigateGroup,
  onBack,
  onClose,
}) => {
  const isOpen = history.length > 0;

  // Completely lock background page scrolling (mouse wheel / touch) while Hover Inspector is open
  useEffect(() => {
    if (!isOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const current = history[history.length - 1];

  const headerTitle = (() => {
    if (current.type === 'KANJI') {
      return `คันจิ 「${current.char}」`;
    }
    if (current.type === 'WORD') {
      return `คำศัพท์ 「${wordMap[current.wordId]?.expression || ''}」`;
    }
    const grp = resolveSemanticGroup(current.groupId, confusableIndex, wordMap);
    return grp ? `Group: ${grp.titleTh}` : 'Group เปรียบเทียบ';
  })();

  return (
    <div
      onClick={onClose}
      onWheel={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0E0F12]/80 backdrop-blur-sm overscroll-contain animate-fadeIn"
    >
      {/* Floating Hover Card — keeps quiz visible through translucent backdrop */}
      <div
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[84vh] flex flex-col rounded-3xl border border-[#2A2D36] bg-[#16181D] shadow-2xl shadow-black/80 overflow-hidden overscroll-contain"
      >
        {/* Top Header Bar — Close button ALWAYS pinned at Top-Right */}
        <div className="sticky top-0 z-20 flex items-center justify-between gap-2 px-5 py-3.5 border-b border-[#2A2D36] bg-[#16181D]/95 backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0">
            {history.length > 1 && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#1F2229] hover:bg-[#2A2D36] text-[#F3F4F6] text-xs font-medium transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                ย้อนกลับ
              </button>
            )}
            <span className="text-xs font-bold text-[#F3F4F6] truncate">
              {headerTitle}
            </span>
          </div>

          {/* Always Top-Right Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1F2229] hover:bg-[#2A2D36] text-[#F3F4F6] hover:text-[#D4AF37] border border-[#2A2D36] text-xs font-bold transition-all cursor-pointer shrink-0"
          >
            <span>ปิด</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Hover Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
          {current.type === 'KANJI' && kanjiDb[current.char] ? (
            (() => {
              const kNode = kanjiDb[current.char];
              const kMeta = LEVEL_METADATA[kNode.level];
              const relatedWords = kNode.relatedWordIds
                .map((id) => wordMap[id])
                .filter(Boolean);

              return (
                <>
                  {/* Kanji Header */}
                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#2A2D36] bg-[#0E0F12] p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-2xl bg-[#16181D] border border-[#2A2D36] flex items-center justify-center text-5xl font-medium text-[#F3F4F6] font-jp shrink-0">
                        {kNode.character}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${kMeta.badgeClass}`}
                          >
                            คันจิ {kNode.level}
                          </span>
                          {kNode.strokes > 0 && (
                            <span className="text-[11px] text-[#9CA3AF] bg-[#1F2229] px-2 py-0.5 rounded-full border border-[#2A2D36]">
                              {kNode.strokes} ขีด
                            </span>
                          )}
                        </div>

                        <div className="space-y-0.5">
                          <div className="text-sm sm:text-base font-bold text-[#F3F4F6]">
                            {kNode.meaningTh || kNode.meaningEn}
                          </div>
                          <div className="text-xs sm:text-sm text-[#FBBF24] font-medium">
                            {kNode.meaningEn}
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => speakJapanese(kNode.character)}
                      className="p-2.5 rounded-xl bg-[#1F2229] hover:bg-[#2A2D36] border border-[#2A2D36] text-[#D4AF37] transition-colors cursor-pointer shrink-0"
                      title="ฟังเสียงอ่าน"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* On'yomi & Kun'yomi */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="rounded-xl border border-[#2A2D36] bg-[#0E0F12] p-3 space-y-1">
                      <div className="text-[11px] font-bold text-[#FBBF24]">
                        เสียงอน (On'yomi)
                      </div>
                      {kNode.onyomi.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {kNode.onyomi.map((r, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => speakJapanese(r.replace(/[.\-]/g, ''))}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#2E1F05] hover:bg-[#3D2907] border border-[#D97706]/40 text-xs font-medium text-[#FBBF24] cursor-pointer"
                            >
                              <span className="font-jp">{r}</span>
                              {showRomaji && kNode.onyomiRomaji[i] && (
                                <span className="text-[11px] font-mono text-[#FBBF24]/80">
                                  [{kNode.onyomiRomaji[i]}]
                                </span>
                              )}
                              <Volume2 className="w-3 h-3 opacity-70" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-[#6B7280]">-</div>
                      )}
                    </div>

                    <div className="rounded-xl border border-[#2A2D36] bg-[#0E0F12] p-3 space-y-1">
                      <div className="text-[11px] font-bold text-[#34D399]">
                        เสียงคุน (Kun'yomi)
                      </div>
                      {kNode.kunyomi.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {kNode.kunyomi.map((r, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => speakJapanese(r.replace(/[.\-]/g, ''))}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#062E22] hover:bg-[#0A3D2E] border border-[#059669]/40 text-xs font-medium text-[#34D399] cursor-pointer"
                            >
                              <span className="font-jp">{r}</span>
                              {showRomaji && kNode.kunyomiRomaji[i] && (
                                <span className="text-[11px] font-mono text-[#34D399]/80">
                                  [{kNode.kunyomiRomaji[i]}]
                                </span>
                              )}
                              <Volume2 className="w-3 h-3 opacity-70" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-[#6B7280]">-</div>
                      )}
                    </div>
                  </div>

                  {/* Related Words using this Kanji */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[#9CA3AF] flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                      คำศัพท์ที่ใช้คันจิ 「{kNode.character}」 ({relatedWords.length} คำ)
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {relatedWords.slice(0, 30).map((w) => {
                        const wMeta = LEVEL_METADATA[w.level];
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => onNavigateWord(w.id)}
                            className="text-left rounded-xl border border-[#2A2D36] hover:border-[#D4AF37]/50 bg-[#0E0F12] hover:bg-[#1F2229] p-2.5 transition-all cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-base font-medium text-[#F3F4F6] font-jp">
                                {w.expression}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${wMeta.badgeClass}`}
                              >
                                {w.level}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#FB6542] font-jp font-medium">
                              {w.reading}
                              {showRomaji && w.romaji ? (
                                <span className="text-[#FBBF24] font-mono ml-1">[{w.romaji}]</span>
                              ) : null}
                            </div>
                            <div className="text-xs text-[#9CA3AF] mt-0.5 truncate">
                              {formatWordMeaning(w, meaningLanguage)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()
          ) : current.type === 'WORD' && wordMap[current.wordId] ? (
            (() => {
              const word = wordMap[current.wordId];
              const wMeta = LEVEL_METADATA[word.level];
              const catMeta = WORD_CATEGORY_META[word.category];
              const allMatches = getConfusableWords(word, confusableIndex);
              const soundConfusables = allMatches.filter(
                (m) => m.type !== 'SIMILAR_MEANING'
              );
              const meaningSimilars = allMatches.filter(
                (m) => m.type === 'SIMILAR_MEANING'
              );
              const groupId = getPrimaryGroupIdForWord(
                word,
                confusableIndex,
                meaningSimilars.length
              );

              return (
                <>
                  {/* Word Summary Card */}
                  <div className="rounded-2xl border border-[#2A2D36] bg-[#0E0F12] p-4 flex items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${wMeta.badgeClass}`}
                        >
                          {word.level}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${catMeta.badgeClass}`}
                        >
                          {catMeta.labelTh}
                        </span>
                        <span className="text-xs text-[#FB6542] font-jp font-medium">
                          【{word.reading}】
                        </span>
                        <span className="text-xs text-[#FBBF24] font-mono font-semibold">
                          [{word.romaji}]
                        </span>
                      </div>

                      <div className="text-3xl font-medium text-[#F3F4F6] font-jp">
                        {word.expression}
                      </div>

                      <div className="space-y-0.5 pt-1">
                        <div className="text-sm font-bold text-[#F3F4F6]">
                          {word.meaningTh || word.meaning}
                        </div>
                        <div className="text-xs text-[#FBBF24]">
                          {word.meaning}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => speakJapanese(word.reading || word.expression)}
                      className="p-2.5 rounded-xl bg-[#1F2229] hover:bg-[#2A2D36] border border-[#2A2D36] text-[#D4AF37] transition-colors cursor-pointer shrink-0"
                      title="ฟังเสียงอ่าน"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 1. Red Confusable / Homophone Warning Section First */}
                  {soundConfusables.length > 0 && (
                    <div className="rounded-2xl border border-[#F43F5E]/40 bg-[#330D17]/40 p-3.5 space-y-2">
                      <div className="text-xs font-bold text-[#FB7185] flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-[#FB7185] shrink-0" />
                        <span>
                          พ้องเสียง / เสียงคล้าย ({soundConfusables.length})
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {soundConfusables.map((c) => (
                          <button
                            key={c.word.id}
                            type="button"
                            onClick={() => onNavigateWord(c.word.id)}
                            className="w-full text-left rounded-xl border border-[#F43F5E]/30 hover:border-[#F43F5E] bg-[#16181D] hover:bg-[#1F2229] p-2.5 flex items-center justify-between gap-2 transition-all cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#330D17] text-[#FB7185] border border-[#F43F5E]/40">
                                  {c.labelTh}
                                </span>
                                <span className="text-sm font-medium text-[#F3F4F6] font-jp">
                                  {c.word.expression}
                                </span>
                                <span className="text-xs text-[#FB6542] font-jp font-medium">
                                  ({c.word.reading})
                                </span>
                                {showRomaji && c.word.romaji && (
                                  <span className="text-[11px] text-[#FBBF24] font-mono">
                                    [{c.word.romaji}]
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-normal text-[#9CA3AF] mt-1">
                                {formatWordMeaning(c.word, meaningLanguage)}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-[#FB7185] shrink-0">
                              ดู ➔
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. Similar Meaning Words & Group Comparison Link */}
                  {(meaningSimilars.length > 0 || groupId) && (
                    <div className="rounded-2xl border border-[#D4AF37]/40 bg-[#2E1F05]/40 p-3.5 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-bold text-[#FBBF24] flex items-center gap-1.5">
                          <Link2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
                          <span>ความหมายใกล้เคียง ({meaningSimilars.length})</span>
                        </div>

                        {groupId && (
                          <button
                            type="button"
                            onClick={() => onNavigateGroup(groupId)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D4AF37] hover:bg-[#F3DA78] text-[#0E0F12] text-xs font-bold shadow-sm transition-all cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Group เปรียบเทียบ ➔</span>
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {meaningSimilars.map((c) => (
                          <button
                            key={c.word.id}
                            type="button"
                            onClick={() => onNavigateWord(c.word.id)}
                            className="w-full text-left rounded-xl border border-[#D4AF37]/30 hover:border-[#D4AF37] bg-[#16181D] hover:bg-[#1F2229] p-2.5 flex items-center justify-between gap-2 transition-all cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#2E1F05] text-[#FBBF24] border border-[#D97706]/40">
                                  {c.labelTh}
                                </span>
                                <span className="text-sm font-medium text-[#F3F4F6] font-jp">
                                  {c.word.expression}
                                </span>
                                <span className="text-xs text-[#FB6542] font-jp font-medium">
                                  ({c.word.reading})
                                </span>
                                {showRomaji && c.word.romaji && (
                                  <span className="text-[11px] text-[#FBBF24] font-mono">
                                    [{c.word.romaji}]
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-normal text-[#9CA3AF] mt-1">
                                {formatWordMeaning(c.word, meaningLanguage)}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-[#D4AF37] shrink-0">
                              ดู ➔
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. Kanji Links formatted as "{Kanji} ➔ {Meaning}" */}
                  {word.kanjiChars.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-[#9CA3AF]">
                        คันจิ:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {word.kanjiChars.map((ch) => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => onNavigateKanji(ch)}
                            className="px-3 py-1.5 rounded-xl bg-[#1F2229] hover:bg-[#2A2D36] border border-[#2A2D36] hover:border-[#D4AF37]/50 text-xs font-medium text-[#F3F4F6] hover:text-[#D4AF37] transition-all cursor-pointer text-left"
                          >
                            {formatKanjiLinkLabel(ch, kanjiDb, meaningLanguage)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()
          ) : current.type === 'GROUP' ? (
            (() => {
              const group = resolveSemanticGroup(
                current.groupId,
                confusableIndex,
                wordMap
              );
              if (!group) return null;

              const matchedWords = group.matchedWords || [];

              return (
                <div className="space-y-4">
                  {/* Group Hero Header */}
                  <div className="rounded-2xl border border-[#D4AF37]/40 bg-[#16181D] p-4 space-y-2.5">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2E1F05] border border-[#D97706]/40 text-[#D4AF37] text-[11px] font-bold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Group เปรียบเทียบ</span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-[#F3F4F6]">
                      {group.titleTh}
                    </h3>
                    <p className="text-xs text-[#9CA3AF] leading-relaxed">
                      {group.summaryTh}
                    </p>

                    <div className="rounded-xl bg-[#0E0F12] border border-[#2A2D36] p-3 space-y-1.5">
                      <div className="text-xs font-bold text-[#D4AF37]">
                        จุดต่างหลัก:
                      </div>
                      <div className="text-xs text-[#F3F4F6] leading-relaxed">
                        {group.coreDifferenceTh}
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#062E22] border border-[#059669]/40 p-3 space-y-1">
                      <div className="text-xs font-bold text-[#34D399] flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5" />
                        <span>เคล็ดลับเลือกใช้:</span>
                      </div>
                      <div className="text-xs text-[#34D399]/90 leading-relaxed">
                        {group.quickTipTh}
                      </div>
                    </div>
                  </div>

                  {/* Word-by-Word Nuance Breakdown (Meaning, Feeling, Usage, Example) */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-[#F3F4F6] flex items-center gap-1.5">
                      <MessageCircle className="w-4 h-4 text-[#D4AF37]" />
                      <span>เปรียบเทียบแต่ละคำ:</span>
                    </div>

                    <div className="space-y-2.5">
                      {group.memberNotes.map((note, idx) => {
                        const linkedWord = matchedWords.find((w) =>
                          doesNoteMatchWord(note, w)
                        );

                        return (
                          <div
                            key={`${note.key}-${idx}`}
                            className="rounded-2xl border border-[#2A2D36] bg-[#0E0F12] p-3.5 space-y-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2A2D36] pb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-lg font-medium text-[#F3F4F6] font-jp">
                                  {note.key}
                                </span>
                                {note.readingLabel && (
                                  <span className="text-xs text-[#FB6542] font-jp font-medium">
                                    {note.readingLabel}
                                  </span>
                                )}
                                {linkedWord && (
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                      LEVEL_METADATA[linkedWord.level].badgeClass
                                    }`}
                                  >
                                    {linkedWord.level}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    speakJapanese(
                                      linkedWord?.reading || note.key
                                    )
                                  }
                                  className="p-1.5 rounded-lg bg-[#1F2229] hover:bg-[#2A2D36] text-[#9CA3AF] hover:text-[#D4AF37] transition-colors cursor-pointer"
                                  title="ฟังเสียงอ่าน"
                                >
                                  <Volume2 className="w-3.5 h-3.5" />
                                </button>
                                {linkedWord && (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateWord(linkedWord.id)}
                                    className="px-2.5 py-1 rounded-lg bg-[#2E1F05] hover:bg-[#3D2907] border border-[#D97706]/40 text-[#FBBF24] text-[11px] font-bold transition-colors cursor-pointer"
                                  >
                                    ดู ➔
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1.5 text-xs">
                              <div>
                                <span className="font-bold text-[#D4AF37]">
                                  • ความหมาย:{' '}
                                </span>
                                <span className="text-[#F3F4F6] font-medium">
                                  {note.meaningDiff}
                                </span>
                              </div>
                              <div>
                                <span className="font-bold text-[#FBBF24]">
                                  • Feeling:{' '}
                                </span>
                                <span className="text-[#9CA3AF]">
                                  {note.feelingNuance}
                                </span>
                              </div>
                              <div>
                                <span className="font-bold text-[#9CA3AF]">
                                  • การใช้:{' '}
                                </span>
                                <span className="text-[#9CA3AF]">
                                  {note.usageContext}
                                </span>
                              </div>

                              {note.exampleJa && (
                                <div className="mt-1.5 pt-1.5 border-t border-[#2A2D36] bg-[#16181D] rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
                                  <div>
                                    <div className="font-jp font-medium text-[#34D399]">
                                      ตัวอย่าง: {note.exampleJa}
                                    </div>
                                    {note.exampleTh && (
                                      <div className="text-[11px] text-[#9CA3AF]">
                                        ({note.exampleTh})
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      speakJapanese(note.exampleJa!)
                                    }
                                    className="p-1.5 rounded-lg bg-[#1F2229] hover:bg-[#2A2D36] text-[#34D399] cursor-pointer shrink-0"
                                    title="ฟังประโยคตัวอย่าง"
                                  >
                                    <Volume2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Direct Links to All Words in this Group */}
                  {matchedWords.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-[#2A2D36]">
                      <div className="text-xs font-bold text-[#9CA3AF]">
                        คำศัพท์ในคลังที่อยู่ในกลุ่มนี้ ({matchedWords.length} คำ):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {matchedWords.map((mw) => (
                          <button
                            key={mw.id}
                            type="button"
                            onClick={() => onNavigateWord(mw.id)}
                            className="text-left rounded-xl border border-[#2A2D36] hover:border-[#D4AF37]/50 bg-[#0E0F12] hover:bg-[#1F2229] p-2.5 flex items-center justify-between gap-2 transition-all cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-[#F3F4F6] font-jp">
                                  {mw.expression}
                                </span>
                                <span className="text-xs text-[#FB6542] font-jp font-medium">
                                  ({mw.reading})
                                </span>
                              </div>
                              <div className="text-[11px] text-[#9CA3AF] truncate">
                                {formatWordMeaning(mw, meaningLanguage)}
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-[#D4AF37] shrink-0">
                              ดูคำนี้ ➔
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          ) : null}
        </div>
      </div>
    </div>
  );
};
