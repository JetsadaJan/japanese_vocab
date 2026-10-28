import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Search,
  Volume2,
  BookOpen,
  ExternalLink,
  Globe,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Shuffle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Sparkles,
  Link2,
  Layers,
  AlertTriangle,
  Lightbulb,
  MessageCircle,
} from 'lucide-react';
import {
  JLPTLevel,
  KanjiDatabase,
  KanjiNode,
  MeaningLanguage,
  VocabWord,
  WordCategory,
} from '../types';
import {
  JLPT_LEVELS,
  LEVEL_METADATA,
  VocabDatabase,
  WORD_CATEGORIES,
  WORD_CATEGORY_META,
  formatKanjiLinkLabel,
  formatWordMeaning,
  hasWordExtraDetails,
  speakJapanese,
} from '../utils/vocabData';
import {
  ConfusableIndex,
  doesNoteMatchWord,
  getConfusableWords,
  getPrimaryGroupIdForWord,
  resolveSemanticGroup,
} from '../utils/confusableWords';

interface WordExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: VocabDatabase;
  kanjiDb: KanjiDatabase;
  wordMap: Record<string, VocabWord>;
  confusableIndex: ConfusableIndex | null;
  initialLevel?: JLPTLevel;
  initialTab?: 'VOCAB' | 'KANJI';
  initialKanji?: string | null;
  meaningLanguage: MeaningLanguage;
  onChangeLanguage: (lang: MeaningLanguage) => void;
}

type ExplorerTab = 'VOCAB' | 'KANJI';

type GraphHistoryItem =
  | { type: 'KANJI'; char: string }
  | { type: 'WORD'; wordId: string }
  | { type: 'GROUP'; groupId: string };

const ITEMS_PER_PAGE = 100;

export const WordExplorerModal: React.FC<WordExplorerModalProps> = ({
  isOpen,
  onClose,
  db,
  kanjiDb,
  wordMap,
  confusableIndex,
  initialLevel = 'N5',
  initialTab = 'VOCAB',
  initialKanji = null,
  meaningLanguage,
  onChangeLanguage,
}) => {
  const [activeTab, setActiveTab] = useState<ExplorerTab>(initialTab);
  const [activeLevel, setActiveLevel] = useState<JLPTLevel | 'ALL'>('ALL');
  const [activeCategory, setActiveCategory] = useState<WordCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showReading, setShowReading] = useState(true);
  const [showRomaji, setShowRomaji] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [shuffleSeed, setShuffleSeed] = useState<number>(0);

  // Track which vocabulary cards and kanji cards have their "แสดงเพิ่มเติม" panel expanded
  const [expandedWordIds, setExpandedWordIds] = useState<Set<string>>(new Set());
  const [expandedKanjiChars, setExpandedKanjiChars] = useState<Set<string>>(new Set());

  // Graph navigation history stack for free jumping between Words <-> Kanji
  const [graphHistory, setGraphHistory] = useState<GraphHistoryItem[]>([]);

  const listContainerRef = useRef<HTMLDivElement | null>(null);

  // Lock background page scroll while WordExplorerModal is open
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

  useEffect(() => {
    if (isOpen) {
      if (initialKanji && kanjiDb[initialKanji]) {
        setGraphHistory([{ type: 'KANJI', char: initialKanji }]);
      } else {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialKanji, initialTab, kanjiDb]);

  // Reset to page 1 when filters, tab, search, or shuffle change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, activeLevel, activeCategory, searchQuery, shuffleSeed]);

  // Scroll list back to top when page, shuffle, or graph view changes
  useEffect(() => {
    if (listContainerRef.current) {
      listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage, shuffleSeed, activeTab, graphHistory]);

  const toggleExpandWord = (wordId: string) => {
    setExpandedWordIds((prev) => {
      const next = new Set(prev);
      if (next.has(wordId)) {
        next.delete(wordId);
      } else {
        next.add(wordId);
      }
      return next;
    });
  };

  const toggleExpandKanji = (char: string) => {
    setExpandedKanjiChars((prev) => {
      const next = new Set(prev);
      if (next.has(char)) {
        next.delete(char);
      } else {
        next.add(char);
      }
      return next;
    });
  };

  const navigateToKanji = (char: string) => {
    if (!kanjiDb[char]) return;
    setGraphHistory((prev) => [...prev, { type: 'KANJI', char }]);
  };

  const navigateToWord = (wordId: string) => {
    if (!wordMap[wordId]) return;
    setGraphHistory((prev) => [...prev, { type: 'WORD', wordId }]);
  };

  const navigateToGroup = (groupId: string) => {
    setGraphHistory((prev) => [...prev, { type: 'GROUP', groupId }]);
  };

  const navigateBack = () => {
    setGraphHistory((prev) => prev.slice(0, -1));
  };

  const clearGraphHistory = () => {
    setGraphHistory([]);
  };

  // All Kanji list sorted by JLPT N5 -> N1
  const allKanjiList = useMemo(() => {
    return Object.values(kanjiDb);
  }, [kanjiDb]);

  // Filtered Vocab list
  const baseFilteredWords = useMemo(() => {
    let pool =
      activeLevel === 'ALL'
        ? JLPT_LEVELS.flatMap((lvl) => db[lvl])
        : db[activeLevel] || [];

    if (activeCategory !== 'ALL') {
      pool = pool.filter((w) => w.category === activeCategory);
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return pool;

    return pool.filter(
      (w) =>
        w.expression.toLowerCase().includes(q) ||
        w.reading.toLowerCase().includes(q) ||
        w.romaji.toLowerCase().includes(q) ||
        w.meaning.toLowerCase().includes(q) ||
        w.meaningTh.toLowerCase().includes(q)
    );
  }, [activeLevel, activeCategory, db, searchQuery]);

  const allMatchingWords = useMemo(() => {
    if (shuffleSeed === 0) return baseFilteredWords;
    const copy: VocabWord[] = [...baseFilteredWords];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, [baseFilteredWords, shuffleSeed]);

  // Filtered Kanji list
  const baseFilteredKanji = useMemo(() => {
    let pool =
      activeLevel === 'ALL'
        ? allKanjiList
        : allKanjiList.filter((k) => k.level === activeLevel);

    const q = searchQuery.trim().toLowerCase();
    if (!q) return pool;

    return pool.filter(
      (k) =>
        k.character.includes(q) ||
        k.meaningTh.toLowerCase().includes(q) ||
        k.meaningEn.toLowerCase().includes(q) ||
        k.onyomi.some((r) => r.includes(q)) ||
        k.kunyomi.some((r) => r.includes(q)) ||
        k.onyomiRomaji.some((r) => r.toLowerCase().includes(q)) ||
        k.kunyomiRomaji.some((r) => r.toLowerCase().includes(q))
    );
  }, [activeLevel, allKanjiList, searchQuery]);

  const allMatchingKanji = useMemo(() => {
    if (shuffleSeed === 0) return baseFilteredKanji;
    const copy: KanjiNode[] = [...baseFilteredKanji];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, [baseFilteredKanji, shuffleSeed]);

  const totalMatching =
    activeTab === 'VOCAB' ? allMatchingWords.length : allMatchingKanji.length;
  const totalPages = Math.max(1, Math.ceil(totalMatching / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedWords = useMemo(() => {
    const startIdx = (safePage - 1) * ITEMS_PER_PAGE;
    return allMatchingWords.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [allMatchingWords, safePage]);

  const paginatedKanji = useMemo(() => {
    const startIdx = (safePage - 1) * ITEMS_PER_PAGE;
    return allMatchingKanji.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [allMatchingKanji, safePage]);

  const startItemNumber =
    totalMatching === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1;
  const endItemNumber = Math.min(safePage * ITEMS_PER_PAGE, totalMatching);

  const [pageInputStr, setPageInputStr] = useState<string>(String(safePage));

  useEffect(() => {
    setPageInputStr(String(safePage));
  }, [safePage]);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits
    const rawDigits = e.target.value.replace(/\D/g, '');
    if (rawDigits === '') {
      setPageInputStr('');
      return;
    }
    const num = parseInt(rawDigits, 10);
    // Disallow numbers greater than totalPages
    if (num > totalPages) {
      setPageInputStr(String(totalPages));
    } else {
      setPageInputStr(String(num));
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleJumpToPage();
      return;
    }
    const allowedKeys = [
      'Backspace',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
      'Tab',
      'Home',
      'End',
    ];
    if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
      return;
    }
    // Block any non-digit character
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleJumpToPage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let target = parseInt(pageInputStr, 10);
    if (isNaN(target) || target < 1) {
      target = 1;
    } else if (target > totalPages) {
      target = totalPages;
    }
    setCurrentPage(target);
    setPageInputStr(String(target));
    if (listContainerRef.current) {
      listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePageInputBlur = () => {
    if (pageInputStr === '' || parseInt(pageInputStr, 10) < 1) {
      setPageInputStr(String(safePage));
    }
  };

  const shuffleButtonLabel = useMemo(() => {
    const lvlLabel = activeLevel === 'ALL' ? '' : ` ${activeLevel}`;
    const countLabel = Math.min(ITEMS_PER_PAGE, totalMatching);
    if (activeTab === 'KANJI') {
      return `สุ่มคันจิ${lvlLabel} ${countLabel} ตัว`;
    }
    const catLabel =
      activeCategory === 'ALL'
        ? 'คำทุกชนิด'
        : WORD_CATEGORY_META[activeCategory].labelTh;
    return `สุ่ม${catLabel}${lvlLabel} ${countLabel} คำ`;
  }, [activeCategory, activeLevel, activeTab, totalMatching]);

  // Render a single Vocab Card (used in both main Vocab list and inside Kanji related words)
  // Links to Kanji / Homophones / Similar-Meaning words are ONLY shown after clicking "แสดงเพิ่มเติม"
  const renderVocabCard = (word: VocabWord, wordNumber?: number) => {
    const meta = LEVEL_METADATA[word.level];
    const catMeta = WORD_CATEGORY_META[word.category];
    const confusables = confusableIndex
      ? getConfusableWords(word, confusableIndex)
      : [];
    const soundConfusables = confusables.filter(
      (c) => c.type !== 'SIMILAR_MEANING'
    );
    const meaningSimilars = confusables.filter(
      (c) => c.type === 'SIMILAR_MEANING'
    );
    const groupId = confusableIndex
      ? getPrimaryGroupIdForWord(word, confusableIndex, meaningSimilars.length)
      : null;
    const canExpand = hasWordExtraDetails(word, confusables.length);
    const isExpanded = expandedWordIds.has(word.id);

    return (
      <div
        key={`${word.id}-${shuffleSeed}`}
        className={`flex flex-col justify-between rounded-2xl border transition-all p-3.5 ${
          isExpanded
            ? 'border-[#D4AF37]/50 bg-[#16181D] shadow-lg'
            : 'border-[#2A2D36] bg-[#16181D] hover:border-[#D4AF37]/40 hover:bg-[#1F2229]/60'
        }`}
      >
        {/* Top Content of Vocab Card (Clean, no links until "แสดงเพิ่มเติม" is clicked) */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {wordNumber !== undefined && (
                <span className="text-[11px] font-mono font-medium text-[#6B7280]">
                  #{wordNumber}
                </span>
              )}
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${meta.badgeClass}`}
              >
                {word.level}
              </span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${catMeta.badgeClass}`}
              >
                {catMeta.labelTh}
              </span>
              {showReading && word.reading !== word.expression && (
                <span className="text-xs text-[#FB6542] font-jp font-medium">
                  {word.reading}
                </span>
              )}
              {showRomaji && word.romaji && (
                <span className="text-xs text-[#FBBF24] font-mono font-semibold">
                  [{word.romaji}]
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => speakJapanese(word.reading || word.expression)}
              title="ฟังเสียงอ่านภาษาญี่ปุ่น"
              className="p-2 rounded-xl bg-[#1F2229] text-[#9CA3AF] hover:text-[#D4AF37] hover:bg-[#2A2D36] border border-[#2A2D36] transition-colors cursor-pointer shrink-0"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <span className="text-xl font-medium text-[#F3F4F6] font-jp">
              {word.expression}
            </span>
          </div>

          {/* Meaning Display: Separated into 2 distinct lines when in BOTH (ไทย+EN) mode */}
          {meaningLanguage === 'BOTH' ? (
            <div className="mt-2 pt-2 border-t border-[#2A2D36] space-y-1">
              <div className="text-xs sm:text-sm text-[#F3F4F6] font-medium break-words flex items-start gap-1.5">
                <span className="text-[11px] px-1.5 py-0.2 rounded bg-[#1F2229] text-[#D4AF37] border border-[#2A2D36] font-bold shrink-0 mt-0.5">
                  TH
                </span>
                <span>{word.meaningTh || word.meaning}</span>
              </div>
              <div className="text-xs sm:text-sm text-[#FBBF24] break-words flex items-start gap-1.5">
                <span className="text-[11px] px-1.5 py-0.2 rounded bg-[#1F2229] text-[#FBBF24] border border-[#2A2D36] font-bold shrink-0 mt-0.5">
                  EN
                </span>
                <span>{word.meaning}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs sm:text-sm text-[#F3F4F6] mt-1.5 break-words font-medium">
              {meaningLanguage === 'TH'
                ? word.meaningTh || word.meaning
                : word.meaning}
            </div>
          )}
        </div>

        {/* Bottom Row: Clean Bottom-Right "แสดงเพิ่มเติม" Button ONLY */}
        <div className="mt-3 pt-2.5 border-t border-[#2A2D36] flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={!canExpand}
            onClick={() => canExpand && toggleExpandWord(word.id)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all shrink-0 ${
              !canExpand
                ? 'bg-[#16181D]/50 border-[#2A2D36]/60 text-[#6B7280] cursor-not-allowed select-none'
                : isExpanded
                ? 'bg-[#D4AF37] text-[#0E0F12] border-[#D4AF37] shadow-sm cursor-pointer'
                : 'bg-[#1F2229] hover:bg-[#2A2D36] text-[#F3F4F6] border-[#2A2D36] cursor-pointer'
            }`}
          >
            <span>{isExpanded ? 'ซ่อนรายละเอียด' : 'แสดงเพิ่มเติม'}</span>
            {canExpand &&
              (isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              ))}
          </button>
        </div>

        {/* Expanded Extra Details Drawer (1. Homophones/Confusables in RED FIRST -> 2. Similar Meaning -> 3. Kanji Links) */}
        {isExpanded && canExpand && (
          <div className="mt-3 pt-3 border-t border-[#2A2D36] space-y-3 bg-[#0E0F12] -mx-1.5 p-3 rounded-xl">
            {/* 1. Red Warning Section for Homophones / Confusable Words (shown FIRST) */}
            {soundConfusables.length > 0 && (
              <div className="rounded-xl border border-[#F43F5E]/40 bg-[#330D17]/40 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#FB7185]">
                  <AlertTriangle className="w-4 h-4 text-[#FB7185] shrink-0" />
                  <span>
                    พ้องเสียง / เสียงคล้าย ({soundConfusables.length})
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {soundConfusables.map((c) => (
                    <button
                      key={c.word.id}
                      type="button"
                      onClick={() => navigateToWord(c.word.id)}
                      className="w-full text-left rounded-lg border border-[#F43F5E]/30 bg-[#16181D] hover:bg-[#1F2229] hover:border-[#F43F5E] px-2.5 py-2 transition-all cursor-pointer flex items-center justify-between gap-2 group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#330D17] text-[#FB7185] border border-[#F43F5E]/40">
                            {c.labelTh}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1F2229] text-[#9CA3AF] border border-[#2A2D36]">
                            {c.word.level}
                          </span>
                          <span className="text-sm font-medium text-[#F3F4F6] font-jp">
                            {c.word.expression}
                          </span>
                          <span className="text-xs text-[#FB6542] font-jp font-medium">
                            【{c.word.reading}】
                          </span>
                          {showRomaji && c.word.romaji && (
                            <span className="text-[11px] text-[#FBBF24] font-mono">
                              [{c.word.romaji}]
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-normal text-[#9CA3AF] mt-1 truncate">
                          {formatWordMeaning(c.word, meaningLanguage)}
                        </div>
                      </div>

                      <span className="text-[11px] font-bold text-[#FB7185] group-hover:translate-x-0.5 transition-transform shrink-0">
                        ดู ➔
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Similar Meaning Words Section ("ความหมายใกล้เคียง" e.g. ageru/morau/kureru, inochi/jinsei) */}
            {meaningSimilars.length > 0 && (
              <div className="rounded-xl border border-[#D4AF37]/40 bg-[#2E1F05]/40 p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#FBBF24]">
                    <Link2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    <span>ความหมายใกล้เคียง ({meaningSimilars.length})</span>
                  </div>

                  {groupId && (
                    <button
                      type="button"
                      onClick={() => navigateToGroup(groupId)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#D4AF37] hover:bg-[#F3DA78] text-[#0E0F12] text-[11px] font-bold shadow-sm transition-all cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Group เปรียบเทียบ ➔</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {meaningSimilars.map((c) => (
                    <button
                      key={c.word.id}
                      type="button"
                      onClick={() => navigateToWord(c.word.id)}
                      className="w-full text-left rounded-lg border border-[#D4AF37]/30 bg-[#16181D] hover:bg-[#1F2229] hover:border-[#D4AF37] px-2.5 py-2 transition-all cursor-pointer flex items-center justify-between gap-2 group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#2E1F05] text-[#FBBF24] border border-[#D97706]/40">
                            {c.labelTh}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1F2229] text-[#9CA3AF] border border-[#2A2D36]">
                            {c.word.level}
                          </span>
                          <span className="text-sm font-medium text-[#F3F4F6] font-jp">
                            {c.word.expression}
                          </span>
                          <span className="text-xs text-[#FB6542] font-jp font-medium">
                            【{c.word.reading}】
                          </span>
                          {showRomaji && c.word.romaji && (
                            <span className="text-[11px] text-[#FBBF24] font-mono">
                              [{c.word.romaji}]
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-normal text-[#9CA3AF] mt-1 truncate">
                          ความหมาย:{' '}
                          <span className="text-[#F3F4F6]">
                            {formatWordMeaning(c.word, meaningLanguage)}
                          </span>
                        </div>
                      </div>

                      <span className="text-[11px] font-bold text-[#D4AF37] group-hover:translate-x-0.5 transition-transform shrink-0">
                        ดู ➔
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Kanji Breakdown Section */}
            {word.kanjiChars.length > 0 && (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#D4AF37] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    คันจิในคำนี้ ({word.kanjiChars.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => navigateToWord(word.id)}
                    className="text-[11px] text-[#D4AF37] hover:underline font-semibold cursor-pointer"
                  >
                    ดูเต็มจอ ➔
                  </button>
                </div>

                {/* Quick Kanji Link Pills in format ( 脚 ➔ ความหมาย ) */}
                <div className="flex flex-wrap gap-1.5">
                  {word.kanjiChars.map((ch) => (
                    <button
                      key={`pill-${ch}`}
                      type="button"
                      onClick={() => navigateToKanji(ch)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#16181D] hover:bg-[#1F2229] border border-[#2A2D36] hover:border-[#D4AF37]/50 text-xs font-jp font-medium text-[#F3F4F6] hover:text-[#D4AF37] transition-all cursor-pointer"
                    >
                      <span>{formatKanjiLinkLabel(ch, kanjiDb, meaningLanguage)}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {word.kanjiChars.map((ch) => {
                    const kNode = kanjiDb[ch];
                    if (!kNode) return null;
                    const kLvlMeta = LEVEL_METADATA[kNode.level];

                    return (
                      <div
                        key={ch}
                        className="rounded-xl border border-[#2A2D36] bg-[#16181D] p-2.5 flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => navigateToKanji(ch)}
                            title={`คลิกเพื่อดูคำศัพท์ทั้งหมดที่ใช้คันจิ ${ch}`}
                            className="w-12 h-12 rounded-xl bg-[#0E0F12] border border-[#2A2D36] hover:border-[#D4AF37] flex flex-col items-center justify-center shrink-0 transition-all cursor-pointer group"
                          >
                            <span className="text-2xl font-medium text-[#F3F4F6] group-hover:text-[#D4AF37] font-jp leading-none">
                              {ch}
                            </span>
                          </button>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${kLvlMeta.badgeClass}`}
                              >
                                คันจิ {kNode.level}
                              </span>
                              {kNode.strokes > 0 && (
                                <span className="text-[10px] text-[#9CA3AF]">
                                  {kNode.strokes} ขีด
                                </span>
                              )}
                            </div>

                            <div className="text-xs space-y-0.5">
                              <div className="text-[#F3F4F6] font-medium">
                                {kNode.meaningTh || kNode.meaningEn}
                              </div>
                              <div className="text-[#FBBF24]">
                                {kNode.meaningEn}
                              </div>
                            </div>

                            {/* On'yomi & Kun'yomi Readings */}
                            <div className="text-[11px] text-[#9CA3AF] space-y-0.5 pt-0.5">
                              {kNode.onyomi.length > 0 && (
                                <div>
                                  <span className="text-[#FBBF24] font-medium">
                                    เสียงอน (On):{' '}
                                  </span>
                                  <span className="font-jp">{kNode.onyomi.join('・')}</span>
                                  {showRomaji && kNode.onyomiRomaji.length > 0 && (
                                    <span className="text-[#6B7280] font-mono ml-1">
                                      [{kNode.onyomiRomaji.join(', ')}]
                                    </span>
                                  )}
                                </div>
                              )}
                              {kNode.kunyomi.length > 0 && (
                                <div>
                                  <span className="text-[#34D399] font-medium">
                                    เสียงคุน (Kun):{' '}
                                  </span>
                                  <span className="font-jp">{kNode.kunyomi.join('・')}</span>
                                  {showRomaji && kNode.kunyomiRomaji.length > 0 && (
                                    <span className="text-[#6B7280] font-mono ml-1">
                                      [{kNode.kunyomiRomaji.join(', ')}]
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => navigateToKanji(ch)}
                          className="shrink-0 px-2.5 py-1.5 rounded-xl bg-[#1F2229] hover:bg-[#2A2D36] border border-[#2A2D36] text-[#D4AF37] text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          ดูคำที่ใช้ {ch} ({kNode.relatedWordIds.length}) ➔
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {word.extraNote && (
              <div className="rounded-xl border border-[#2A2D36] bg-[#16181D] p-2.5 text-xs text-[#9CA3AF]">
                <span className="font-bold text-[#D4AF37]">คำอธิบายเพิ่มเติม: </span>
                {word.extraNote}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  const currentGraphItem =
    graphHistory.length > 0 ? graphHistory[graphHistory.length - 1] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#0E0F12]/80 backdrop-blur-md overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl border border-[#2A2D36] bg-[#16181D] shadow-2xl overflow-hidden overscroll-contain">
        {/* Top Modal Header with Vocab <-> Kanji Tab Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#2A2D36] bg-[#16181D]/95">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#2E1F05] border border-[#D97706]/40 text-[#D4AF37]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-[#F3F4F6]">
                  คลังคำศัพท์ ⇄ คันจิ (N5–N1)
                </h2>
              </div>
              <a
                href="https://github.com/elzup/jlpt-word-list"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#9CA3AF] hover:text-[#D4AF37] transition-colors"
              >
                เชื่อมโยงคำศัพท์ {Object.keys(wordMap).length.toLocaleString()} คำ กับคันจิ {allKanjiList.length.toLocaleString()} ตัว
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Primary Tab Switcher: คลังคำศัพท์ vs คลังคันจิ */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-2xl bg-[#0E0F12] p-1 border border-[#2A2D36]">
              <button
                type="button"
                onClick={() => {
                  clearGraphHistory();
                  setActiveTab('VOCAB');
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'VOCAB' && !currentGraphItem
                    ? 'bg-[#D4AF37] text-[#0E0F12] shadow-sm'
                    : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>คลังคำศัพท์ ({Object.keys(wordMap).length.toLocaleString()})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  clearGraphHistory();
                  setActiveTab('KANJI');
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'KANJI' && !currentGraphItem
                    ? 'bg-[#D4AF37] text-[#0E0F12] shadow-sm'
                    : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>คลังคันจิ ({allKanjiList.length.toLocaleString()})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-[#1F2229] text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#2A2D36] border border-[#2A2D36] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* If user is inspecting a Kanji Node or Word Node in the Graph, show Breadcrumb Navigation Bar */}
        {currentGraphItem && (
          <div className="px-5 py-2.5 bg-[#0E0F12] border-b border-[#2A2D36] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <button
                type="button"
                onClick={navigateBack}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1F2229] hover:bg-[#2A2D36] text-[#F3F4F6] border border-[#2A2D36] font-medium cursor-pointer mr-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                ย้อนกลับ
              </button>

              <button
                type="button"
                onClick={clearGraphHistory}
                className="text-[#9CA3AF] hover:text-[#F3F4F6] underline cursor-pointer"
              >
                {activeTab === 'VOCAB' ? 'คลังคำศัพท์' : 'คลังคันจิ'}
              </button>

              {graphHistory.map((item, idx) => {
                const isLast = idx === graphHistory.length - 1;
                const label =
                  item.type === 'KANJI'
                    ? `คันจิ 「${item.char}」`
                    : item.type === 'WORD'
                    ? `คำศัพท์ 「${wordMap[item.wordId]?.expression || ''}」`
                    : `Group 「${
                        (confusableIndex &&
                          resolveSemanticGroup(item.groupId, confusableIndex, wordMap)
                            ?.titleTh) ||
                        'เปรียบเทียบคำใกล้เคียง'
                      }」`;
                return (
                  <React.Fragment key={idx}>
                    <span className="text-[#6B7280]">/</span>
                    <button
                      type="button"
                      onClick={() =>
                        setGraphHistory((prev) => prev.slice(0, idx + 1))
                      }
                      className={`px-2 py-0.5 rounded-md font-jp font-medium cursor-pointer ${
                        isLast
                          ? 'bg-[#2E1F05] text-[#D4AF37] border border-[#D97706]/40'
                          : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                      }`}
                    >
                      {label}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            <button
              type="button"
              onClick={clearGraphHistory}
              className="text-xs text-[#9CA3AF] hover:text-[#D4AF37] font-medium cursor-pointer"
            >
              ปิดหน้าเชื่อมโยง ✕
            </button>
          </div>
        )}

        {/* GRAPH NODE VIEW 1: Detailed Kanji Node View */}
        {currentGraphItem?.type === 'KANJI' && kanjiDb[currentGraphItem.char] ? (
          <div
            ref={listContainerRef}
            className="flex-1 overflow-y-auto p-5 space-y-6"
          >
            {(() => {
              const kNode = kanjiDb[currentGraphItem.char];
              const kMeta = LEVEL_METADATA[kNode.level];
              const relatedWords = kNode.relatedWordIds
                .map((id) => wordMap[id])
                .filter(Boolean);

              return (
                <>
                  {/* Kanji Node Hero Card */}
                  <div className="rounded-3xl border border-[#2A2D36] bg-[#16181D] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-start sm:items-center gap-5">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#0E0F12] border border-[#2A2D36] shadow-xl flex flex-col items-center justify-center shrink-0">
                        <span className="text-5xl sm:text-6xl font-medium text-[#F3F4F6] font-jp">
                          {kNode.character}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded-full border ${kMeta.badgeClass}`}
                          >
                            คันจิระดับ {kNode.level}
                          </span>
                          {kNode.strokes > 0 && (
                            <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#1F2229] text-[#9CA3AF] border border-[#2A2D36]">
                              จำนวนขีด: {kNode.strokes} ขีด
                            </span>
                          )}
                          <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#1F2229] text-[#D4AF37] border border-[#2A2D36]">
                            พบในคำศัพท์ {relatedWords.length} คำ
                          </span>
                        </div>

                        <div className="space-y-1 pt-1">
                          <div className="text-lg sm:text-xl font-medium text-[#F3F4F6] flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-[#1F2229] text-[#D4AF37] border border-[#2A2D36] font-bold">
                              TH
                            </span>
                            <span>{kNode.meaningTh || kNode.meaningEn}</span>
                          </div>
                          <div className="text-sm sm:text-base font-normal text-[#FBBF24] flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-[#1F2229] text-[#FBBF24] border border-[#2A2D36] font-bold">
                              EN
                            </span>
                            <span>{kNode.meaningEn}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => speakJapanese(kNode.character)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#1F2229] hover:bg-[#2A2D36] border border-[#2A2D36] text-[#D4AF37] text-xs sm:text-sm font-bold transition-colors cursor-pointer shrink-0"
                    >
                      <Volume2 className="w-4 h-4" />
                      ฟังเสียงอ่านคันจิ
                    </button>
                  </div>

                  {/* Readings Breakdown (On'yomi & Kun'yomi) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-[#2A2D36] bg-[#0E0F12] p-4 space-y-2">
                      <div className="text-xs font-bold text-[#FBBF24] uppercase tracking-wider">
                        เสียงอน (On'yomi — คำอ่านเสียงจีน มักใช้ในคำประสม)
                      </div>
                      {kNode.onyomi.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {kNode.onyomi.map((r, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => speakJapanese(r.replace(/[.\-]/g, ''))}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2E1F05] hover:bg-[#3D2907] border border-[#D97706]/40 text-sm font-medium text-[#FBBF24] cursor-pointer"
                            >
                              <span className="font-jp">{r}</span>
                              {kNode.onyomiRomaji[i] && (
                                <span className="text-xs font-mono text-[#FBBF24]/80">
                                  [{kNode.onyomiRomaji[i]}]
                                </span>
                              )}
                              <Volume2 className="w-3 h-3 opacity-70" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-[#6B7280]">ไม่มีเสียงอ่าน On'yomi ที่ใช้ทั่วไป</div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-[#2A2D36] bg-[#0E0F12] p-4 space-y-2">
                      <div className="text-xs font-bold text-[#34D399] uppercase tracking-wider">
                        เสียงคุน (Kun'yomi — คำอ่านเสียงญี่ปุ่นแท้)
                      </div>
                      {kNode.kunyomi.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {kNode.kunyomi.map((r, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => speakJapanese(r.replace(/[.\-]/g, ''))}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#062E22] hover:bg-[#0A3D2E] border border-[#059669]/40 text-sm font-medium text-[#34D399] cursor-pointer"
                            >
                              <span className="font-jp">{r}</span>
                              {kNode.kunyomiRomaji[i] && (
                                <span className="text-xs font-mono text-[#34D399]/80">
                                  [{kNode.kunyomiRomaji[i]}]
                                </span>
                              )}
                              <Volume2 className="w-3 h-3 opacity-70" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-[#6B7280]">ไม่มีเสียงอ่าน Kun'yomi ที่ใช้ทั่วไป</div>
                      )}
                    </div>
                  </div>

                  {/* All Related Vocabulary Words using this Kanji */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-[#F3F4F6] flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-[#D4AF37]" />
                        คำศัพท์ในคลังที่ใช้คันจิ 「{kNode.character}」 ({relatedWords.length} คำ)
                      </h3>
                      <span className="text-xs text-[#9CA3AF]">
                        คลิกที่ตัวคันจิอื่นในคำศัพท์เพื่อลิงก์ต่อไปได้เรื่อยๆ
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {relatedWords.map((word, idx) =>
                        renderVocabCard(word, idx + 1)
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        ) : currentGraphItem?.type === 'WORD' && wordMap[currentGraphItem.wordId] ? (
          /* GRAPH NODE VIEW 2: Detailed Word Node View */
          <div
            ref={listContainerRef}
            className="flex-1 overflow-y-auto p-5 space-y-6"
          >
            {(() => {
              const word = wordMap[currentGraphItem.wordId];
              const wMeta = LEVEL_METADATA[word.level];
              const cMeta = WORD_CATEGORY_META[word.category];
              const confusables = confusableIndex
                ? getConfusableWords(word, confusableIndex)
                : [];
              const soundConfusables = confusables.filter(
                (c) => c.type !== 'SIMILAR_MEANING'
              );
              const meaningSimilars = confusables.filter(
                (c) => c.type === 'SIMILAR_MEANING'
              );
              const groupId = confusableIndex
                ? getPrimaryGroupIdForWord(word, confusableIndex, meaningSimilars.length)
                : null;

              return (
                <>
                  <div className="rounded-3xl border border-[#2A2D36] bg-[#16181D] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full border ${wMeta.badgeClass}`}
                        >
                          {word.level}
                        </span>
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full border ${cMeta.badgeClass}`}
                        >
                          {cMeta.labelTh}
                        </span>
                        {word.reading !== word.expression && (
                          <span className="text-sm text-[#FB6542] font-jp font-medium">
                            【{word.reading}】
                          </span>
                        )}
                        <span className="text-sm text-[#FBBF24] font-mono font-semibold">
                          [{word.romaji}]
                        </span>
                      </div>

                      <div className="pt-1">
                        <span className="text-4xl sm:text-5xl font-medium text-[#F3F4F6] font-jp">
                          {word.expression}
                        </span>
                      </div>

                      <div className="space-y-1 pt-2">
                        <div className="text-base sm:text-lg font-bold text-[#F3F4F6]">
                          {word.meaningTh || word.meaning}
                        </div>
                        <div className="text-sm sm:text-base text-[#FBBF24]">
                          {word.meaning}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => speakJapanese(word.reading || word.expression)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#1F2229] hover:bg-[#2A2D36] border border-[#2A2D36] text-[#D4AF37] text-xs sm:text-sm font-bold transition-colors cursor-pointer shrink-0"
                    >
                      <Volume2 className="w-4 h-4" />
                      ฟังเสียงอ่านคำศัพท์
                    </button>
                  </div>

                  {/* 1. Red Warning Section for Homophones / Confusable Words (shown FIRST) */}
                  {soundConfusables.length > 0 && (
                    <div className="rounded-2xl border border-[#F43F5E]/40 bg-[#330D17]/40 p-5 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#FB7185]">
                        <AlertTriangle className="w-5 h-5 text-[#FB7185] shrink-0" />
                        <span>
                          พ้องเสียง / เสียงคล้าย ({soundConfusables.length})
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {soundConfusables.map((c) => (
                          <button
                            key={c.word.id}
                            type="button"
                            onClick={() => navigateToWord(c.word.id)}
                            className="w-full text-left rounded-xl border border-[#F43F5E]/30 bg-[#16181D] hover:bg-[#1F2229] hover:border-[#F43F5E] p-3 transition-all cursor-pointer flex items-center justify-between gap-2 group"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#330D17] text-[#FB7185] border border-[#F43F5E]/40">
                                  {c.labelTh}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1F2229] text-[#9CA3AF] border border-[#2A2D36]">
                                  {c.word.level}
                                </span>
                                <span className="text-base font-medium text-[#F3F4F6] font-jp">
                                  {c.word.expression}
                                </span>
                                <span className="text-xs text-[#FB6542] font-jp font-medium">
                                  【{c.word.reading}】
                                </span>
                                <span className="text-[11px] text-[#FBBF24] font-mono">
                                  [{c.word.romaji}]
                                </span>
                              </div>
                              <div className="text-xs font-normal text-[#9CA3AF] mt-1 truncate">
                                {formatWordMeaning(c.word, meaningLanguage)}
                              </div>
                            </div>

                            <span className="text-xs font-bold text-[#FB7185] group-hover:translate-x-0.5 transition-transform shrink-0">
                              ดู ➔
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. Similar Meaning Words Section ("ความหมายใกล้เคียง" e.g. ageru/morau/kureru, inochi/jinsei) */}
                  {meaningSimilars.length > 0 && (
                    <div className="rounded-2xl border border-[#D4AF37]/40 bg-[#2E1F05]/40 p-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-bold text-[#FBBF24]">
                          <Link2 className="w-5 h-5 text-[#D4AF37] shrink-0" />
                          <span>ความหมายใกล้เคียง ({meaningSimilars.length})</span>
                        </div>

                        {groupId && (
                          <button
                            type="button"
                            onClick={() => navigateToGroup(groupId)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D4AF37] hover:bg-[#F3DA78] text-[#0E0F12] text-xs font-bold shadow-sm transition-all cursor-pointer"
                          >
                            <Layers className="w-4 h-4" />
                            <span>Group เปรียบเทียบ ➔</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {meaningSimilars.map((c) => (
                          <button
                            key={c.word.id}
                            type="button"
                            onClick={() => navigateToWord(c.word.id)}
                            className="w-full text-left rounded-xl border border-[#D4AF37]/30 bg-[#16181D] hover:bg-[#1F2229] hover:border-[#D4AF37] p-3 transition-all cursor-pointer flex items-center justify-between gap-2 group"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#2E1F05] text-[#FBBF24] border border-[#D97706]/40">
                                  {c.labelTh}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1F2229] text-[#9CA3AF] border border-[#2A2D36]">
                                  {c.word.level}
                                </span>
                                <span className="text-base font-medium text-[#F3F4F6] font-jp">
                                  {c.word.expression}
                                </span>
                                <span className="text-xs text-[#FB6542] font-jp font-medium">
                                  【{c.word.reading}】
                                </span>
                                <span className="text-[11px] text-[#FBBF24] font-mono">
                                  [{c.word.romaji}]
                                </span>
                              </div>
                              <div className="text-xs text-[#9CA3AF] mt-1 truncate">
                                ความหมาย:{' '}
                                <span className="text-[#F3F4F6]">
                                  {formatWordMeaning(c.word, meaningLanguage)}
                                </span>
                              </div>
                            </div>

                            <span className="text-xs font-bold text-[#D4AF37] group-hover:translate-x-0.5 transition-transform shrink-0">
                              ดูคำนี้ ➔
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. Kanji Nodes inside this Word */}
                  {word.kanjiChars.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-base font-bold text-[#F3F4F6]">
                        คันจิที่ประกอบในคำว่า 「{word.expression}」 ({word.kanjiChars.length} ตัว)
                      </h3>

                      <div className="flex flex-wrap gap-2">
                        {word.kanjiChars.map((ch) => (
                          <button
                            key={`pill-node-${ch}`}
                            type="button"
                            onClick={() => navigateToKanji(ch)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#16181D] hover:bg-[#1F2229] border border-[#2A2D36] hover:border-[#D4AF37]/50 text-xs font-jp font-medium text-[#F3F4F6] hover:text-[#D4AF37] transition-all cursor-pointer"
                          >
                            <span>{formatKanjiLinkLabel(ch, kanjiDb, meaningLanguage)}</span>
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {word.kanjiChars.map((ch) => {
                          const kNode = kanjiDb[ch];
                          if (!kNode) return null;
                          return (
                            <div
                              key={ch}
                              onClick={() => navigateToKanji(ch)}
                              className="rounded-2xl border border-[#2A2D36] hover:border-[#D4AF37]/50 bg-[#16181D] p-4 flex items-start justify-between gap-4 cursor-pointer transition-all"
                            >
                              <div className="flex items-start gap-3.5">
                                <div className="w-14 h-14 rounded-2xl bg-[#0E0F12] border border-[#2A2D36] flex items-center justify-center text-3xl font-medium text-[#F3F4F6] font-jp shrink-0">
                                  {ch}
                                </div>
                                <div className="space-y-1">
                                  <div className="text-sm font-bold text-[#F3F4F6]">
                                    {kNode.meaningTh || kNode.meaningEn}
                                  </div>
                                  <div className="text-xs text-[#FBBF24]">
                                    {kNode.meaningEn}
                                  </div>
                                  {kNode.onyomi.length > 0 && (
                                    <div className="text-xs text-[#9CA3AF]">
                                      <span className="text-[#FBBF24] font-medium">On: </span>
                                      {kNode.onyomi.join('・')}
                                    </div>
                                  )}
                                  {kNode.kunyomi.length > 0 && (
                                    <div className="text-xs text-[#9CA3AF]">
                                      <span className="text-[#34D399] font-medium">Kun: </span>
                                      {kNode.kunyomi.join('・')}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs font-bold text-[#D4AF37] shrink-0">
                                ดู {kNode.relatedWordIds.length} คำ ➔
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : currentGraphItem?.type === 'GROUP' ? (
          /* GRAPH NODE VIEW 3: Semantic Group Nuance Comparison View */
          <div
            ref={listContainerRef}
            className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-5"
          >
            {(() => {
              const group = confusableIndex
                ? resolveSemanticGroup(
                    currentGraphItem.groupId,
                    confusableIndex,
                    wordMap
                  )
                : null;

              if (!group) {
                return (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    ไม่พบข้อมูลกลุ่มคำที่มีความหมายใกล้เคียงนี้
                  </div>
                );
              }

              const memberWords = group.matchedWords || [];

              return (
                <>
                  {/* Group Hero Header */}
                  <div className="rounded-3xl border border-[#D4AF37]/40 bg-[#16181D] p-6 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-[#2E1F05] text-[#D4AF37] border border-[#D97706]/40">
                        <Layers className="w-3.5 h-3.5" />
                        Group เปรียบเทียบคำที่มีความหมายใกล้เคียง ({group.memberNotes.length} คำ)
                      </span>
                      <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#1F2229] text-[#9CA3AF] border border-[#2A2D36]">
                        เปรียบเทียบ ความหมาย • Feeling • การใช้งาน
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-[#F3F4F6]">
                        {group.titleTh}
                      </h3>
                      <p className="text-sm text-[#9CA3AF] mt-1 font-normal">
                        {group.summaryTh}
                      </p>
                    </div>

                    {/* Core Difference Explanation Box */}
                    <div className="rounded-2xl border border-[#2A2D36] bg-[#0E0F12] p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
                        <span>สรุปจุดต่างหลัก (Core Difference)</span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#F3F4F6] leading-relaxed">
                        {group.coreDifferenceTh}
                      </p>
                    </div>

                    {/* Quick Tip Box */}
                    <div className="rounded-2xl border border-[#059669]/40 bg-[#062E22] p-4 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#34D399]">
                        <Lightbulb className="w-4 h-4 text-[#34D399] shrink-0" />
                        <span>เคล็ดลับจำง่าย & วิธีเลือกใช้ไม่ให้พลาด</span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#34D399]/90 leading-relaxed">
                        {group.quickTipTh}
                      </p>
                    </div>
                  </div>

                  {/* Detailed Comparison Cards for Each Word in the Group */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm sm:text-base font-bold text-[#F3F4F6] flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[#D4AF37]" />
                        <span>
                          เจาะลึกความต่างของแต่ละคำ (ความหมาย • Feeling • การใช้งาน)
                        </span>
                      </h4>
                      <span className="text-xs text-[#9CA3AF]">
                        คลิก "ดูคำศัพท์นี้ ➔" เพื่อดูคันจิและคำพ้องเสียงของคำนั้น
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3.5">
                      {group.memberNotes.map((note, idx) => {
                        const linkedWord = memberWords.find((w) =>
                          doesNoteMatchWord(note, w)
                        );
                        const mwMeta = linkedWord
                          ? LEVEL_METADATA[linkedWord.level]
                          : null;
                        const mwCatMeta = linkedWord
                          ? WORD_CATEGORY_META[linkedWord.category]
                          : null;

                        return (
                          <div
                            key={`${note.key}-${idx}`}
                            className="rounded-2xl border border-[#2A2D36] hover:border-[#D4AF37]/40 bg-[#0E0F12] p-4 sm:p-5 space-y-3.5 transition-all"
                          >
                            {/* Word Header */}
                            <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#2A2D36]">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-mono font-medium text-[#6B7280]">
                                    #{idx + 1}
                                  </span>
                                  {mwMeta && linkedWord && (
                                    <span
                                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${mwMeta.badgeClass}`}
                                    >
                                      {linkedWord.level}
                                    </span>
                                  )}
                                  {mwCatMeta && (
                                    <span
                                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${mwCatMeta.badgeClass}`}
                                    >
                                      {mwCatMeta.labelTh}
                                    </span>
                                  )}
                                  <span className="text-xl sm:text-2xl font-medium text-[#F3F4F6] font-jp">
                                    {note.key}
                                  </span>
                                  {note.readingLabel && (
                                    <span className="text-sm text-[#FB6542] font-jp font-medium">
                                      {note.readingLabel}
                                    </span>
                                  )}
                                </div>

                                {linkedWord && (
                                  <div className="text-xs sm:text-sm text-[#9CA3AF]">
                                    <span className="font-medium text-[#F3F4F6]">
                                      {linkedWord.meaningTh || linkedWord.meaning}
                                    </span>{' '}
                                    <span className="text-[#6B7280]">|</span>{' '}
                                    <span className="text-[#FBBF24]">
                                      {linkedWord.meaning}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    speakJapanese(linkedWord?.reading || note.key)
                                  }
                                  title="ฟังเสียงอ่าน"
                                  className="p-2 rounded-xl bg-[#1F2229] hover:bg-[#2A2D36] text-[#9CA3AF] hover:text-[#D4AF37] border border-[#2A2D36] transition-colors cursor-pointer"
                                >
                                  <Volume2 className="w-4 h-4" />
                                </button>
                                {linkedWord && (
                                  <button
                                    type="button"
                                    onClick={() => navigateToWord(linkedWord.id)}
                                    className="px-3 py-1.5 rounded-xl bg-[#2E1F05] hover:bg-[#3D2907] border border-[#D97706]/40 text-[#FBBF24] text-xs font-bold transition-colors cursor-pointer"
                                  >
                                    ดูคำศัพท์นี้ ➔
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Nuance Breakdown: Meaning Diff, Feeling, Usage, Example */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                              <div className="rounded-xl border border-[#2A2D36] bg-[#16181D] p-3 space-y-1">
                                <div className="font-bold text-[#D4AF37] flex items-center gap-1">
                                  <span>ความหมาย</span>
                                </div>
                                <p className="text-[#F3F4F6] leading-relaxed">
                                  {note.meaningDiff}
                                </p>
                              </div>

                              <div className="rounded-xl border border-[#2A2D36] bg-[#16181D] p-3 space-y-1">
                                <div className="font-bold text-[#FBBF24] flex items-center gap-1">
                                  <span>Feeling</span>
                                </div>
                                <p className="text-[#9CA3AF] leading-relaxed">
                                  {note.feelingNuance}
                                </p>
                              </div>

                              <div className="rounded-xl border border-[#2A2D36] bg-[#16181D] p-3 space-y-1">
                                <div className="font-bold text-[#9CA3AF] flex items-center gap-1">
                                  <span>การใช้</span>
                                </div>
                                <p className="text-[#9CA3AF] leading-relaxed">
                                  {note.usageContext}
                                </p>
                              </div>
                            </div>

                            {note.exampleJa && (
                              <div className="rounded-xl border border-[#2A2D36] bg-[#16181D] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-start gap-2 min-w-0 flex-1">
                                  <MessageCircle className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                                  <div className="space-y-0.5">
                                    <div className="font-medium text-[#34D399] font-jp">
                                      ตัวอย่าง: {note.exampleJa}
                                    </div>
                                    {note.exampleTh && (
                                      <div className="text-[#9CA3AF]">
                                        คำแปล: {note.exampleTh}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => speakJapanese(note.exampleJa!)}
                                  className="px-2.5 py-1 rounded-lg bg-[#1F2229] hover:bg-[#2A2D36] text-[#34D399] text-[11px] font-medium border border-[#2A2D36] cursor-pointer shrink-0"
                                >
                                  <Volume2 className="w-3.5 h-3.5 inline mr-1" />
                                  ฟังประโยค
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Direct Links to All Words in the Vocabulary DB in this Group */}
                  {memberWords.length > 0 && (
                    <div className="space-y-2.5 pt-2 border-t border-[#2A2D36]">
                      <h4 className="text-xs sm:text-sm font-bold text-[#F3F4F6]">
                        คำศัพท์ในคลังที่อยู่ในกลุ่มนี้ ({memberWords.length} คำ):
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {memberWords.map((mw) => {
                          const mwMeta = LEVEL_METADATA[mw.level];
                          return (
                            <button
                              key={mw.id}
                              type="button"
                              onClick={() => navigateToWord(mw.id)}
                              className="text-left rounded-xl border border-[#2A2D36] hover:border-[#D4AF37]/50 bg-[#0E0F12] hover:bg-[#1F2229] p-3 flex items-center justify-between gap-2 transition-all cursor-pointer"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${mwMeta.badgeClass}`}
                                  >
                                    {mw.level}
                                  </span>
                                  <span className="text-sm font-medium text-[#F3F4F6] font-jp">
                                    {mw.expression}
                                  </span>
                                  <span className="text-xs text-[#FB6542] font-jp font-medium">
                                    【{mw.reading}】
                                  </span>
                                </div>
                                <div className="text-xs text-[#9CA3AF] mt-0.5 truncate">
                                  {formatWordMeaning(mw, meaningLanguage)}
                                </div>
                              </div>
                              <span className="text-xs font-bold text-[#D4AF37] shrink-0">
                                ดูคำนี้ ➔
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          /* STANDARD LIST VIEW (VOCAB TAB or KANJI TAB) */
          <>
            {/* Filters */}
            <div className="p-4 border-b border-[#2A2D36] space-y-2.5 bg-[#0E0F12]/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveLevel('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      activeLevel === 'ALL'
                        ? 'bg-[#D4AF37] text-[#0E0F12] border-[#D4AF37]'
                        : 'bg-[#1F2229] text-[#9CA3AF] hover:text-[#F3F4F6] border-[#2A2D36]'
                    }`}
                  >
                    ทั้งหมด (
                    {activeTab === 'VOCAB'
                      ? Object.keys(wordMap).length.toLocaleString()
                      : allKanjiList.length.toLocaleString()}
                    )
                  </button>
                  {JLPT_LEVELS.map((lvl) => {
                    const count =
                      activeTab === 'VOCAB'
                        ? db[lvl].length
                        : allKanjiList.filter((k) => k.level === lvl).length;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setActiveLevel(lvl)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          activeLevel === lvl
                            ? 'bg-[#D4AF37] text-[#0E0F12] border-[#D4AF37]'
                            : 'bg-[#1F2229] text-[#9CA3AF] hover:text-[#F3F4F6] border-[#2A2D36]'
                        }`}
                      >
                        {lvl} ({count.toLocaleString()})
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Language Switcher */}
                  <div className="inline-flex items-center rounded-xl bg-[#0E0F12] p-0.5 border border-[#2A2D36]">
                    <Globe className="w-3.5 h-3.5 text-[#D4AF37] ml-2 mr-1" />
                    {(['TH', 'EN', 'BOTH'] as MeaningLanguage[]).map((lang) => {
                      const active = meaningLanguage === lang;
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => onChangeLanguage(lang)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            active
                              ? 'bg-[#D4AF37] text-[#0E0F12]'
                              : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                          }`}
                        >
                          {lang === 'TH' ? 'ไทย' : lang === 'EN' ? 'EN' : 'ไทย+EN'}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowReading((prev) => !prev)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      showReading
                        ? 'bg-[#062E22] border-[#059669]/40 text-[#34D399]'
                        : 'bg-[#1F2229] border-[#2A2D36] text-[#6B7280]'
                    }`}
                  >
                    {showReading ? 'Hiragana: เปิด' : 'Hiragana: ปิด'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRomaji((prev) => !prev)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      showRomaji
                        ? 'bg-[#2E1F05] border-[#D97706]/40 text-[#FBBF24]'
                        : 'bg-[#1F2229] border-[#2A2D36] text-[#6B7280]'
                    }`}
                  >
                    {showRomaji ? 'Romaji: เปิด' : 'Romaji: ปิด'}
                  </button>
                </div>
              </div>

              {/* Part of Speech Filter Row (for VOCAB) + Random 100 Shuffle Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                {activeTab === 'VOCAB' ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-[#9CA3AF] mr-1">ชนิดคำ:</span>
                    <button
                      type="button"
                      onClick={() => setActiveCategory('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                        activeCategory === 'ALL'
                          ? 'bg-[#D4AF37] text-[#0E0F12] border-[#D4AF37]'
                          : 'bg-[#1F2229] text-[#9CA3AF] hover:text-[#F3F4F6] border-[#2A2D36]'
                      }`}
                    >
                      ทุกชนิดคำ
                    </button>
                    {WORD_CATEGORIES.map((cat) => {
                      const catMeta = WORD_CATEGORY_META[cat];
                      const active = activeCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setActiveCategory(cat)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                            active
                              ? catMeta.badgeClass + ' ring-1 ring-[#D4AF37]'
                              : 'bg-[#16181D] border-[#2A2D36] text-[#9CA3AF] hover:text-[#F3F4F6]'
                          }`}
                        >
                          {catMeta.labelTh}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-[#9CA3AF]">
                    กดปุ่ม "แสดงเพิ่มเติม" ที่มุมขวาล่างของการ์ดคันจิเพื่อดูและกดลิงก์ไปยังคำศัพท์ที่ใช้คันจิตัวนั้น
                  </div>
                )}

                {/* Random 100 Shuffle & Reset Order Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShuffleSeed((prev) => prev + 1)}
                    disabled={totalMatching <= 1}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F3DA78] to-[#C59B27] hover:brightness-110 text-slate-950 text-xs font-bold shadow-md shadow-[#D4AF37]/15 transition-all cursor-pointer disabled:opacity-40"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>{shuffleButtonLabel}</span>
                  </button>

                  {shuffleSeed > 0 && (
                    <button
                      type="button"
                      onClick={() => setShuffleSeed(0)}
                      title="เรียงตามลำดับปกติ"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#1F2229] hover:bg-[#2A2D36] text-[#F3F4F6] text-xs font-medium border border-[#2A2D36] transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>เรียงตามเดิม</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === 'VOCAB'
                      ? 'ค้นหาคำศัพท์ (ภาษาไทย, คันจิ, ฮิรางานะ, โรมันจิ, หรือภาษาอังกฤษ)...'
                      : 'ค้นหาคันจิ (ตัวคันจิ เช่น 人 字 引, ความหมายไทย/อังกฤษ, หรือคำอ่าน)...'
                  }
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#16181D] border border-[#2A2D36] text-sm text-[#F3F4F6] placeholder:text-[#6B7280] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            {/* Main Paginated Grid (Vocab Cards OR Kanji Cards) */}
            <div
              ref={listContainerRef}
              className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5"
            >
              {activeTab === 'VOCAB'
                ? paginatedWords.map((word, idx) =>
                    renderVocabCard(word, startItemNumber + idx)
                  )
                : paginatedKanji.map((kNode, idx) => {
                    const meta = LEVEL_METADATA[kNode.level];
                    const itemNumber = startItemNumber + idx;
                    const relatedWords = kNode.relatedWordIds
                      .map((id) => wordMap[id])
                      .filter(Boolean);
                    const canExpandKanji = relatedWords.length > 0;
                    const isKanjiExpanded = expandedKanjiChars.has(
                      kNode.character
                    );

                    return (
                      <div
                        key={`${kNode.character}-${shuffleSeed}`}
                        className={`rounded-2xl border p-3.5 flex flex-col justify-between gap-3 transition-all ${
                          isKanjiExpanded
                            ? 'border-[#D4AF37]/50 bg-[#16181D] shadow-lg'
                            : 'border-[#2A2D36] bg-[#16181D] hover:border-[#D4AF37]/40 hover:bg-[#1F2229]/60'
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="w-16 h-16 rounded-2xl bg-[#0E0F12] border border-[#2A2D36] flex flex-col items-center justify-center shrink-0">
                            <span className="text-3xl font-medium text-[#F3F4F6] font-jp">
                              {kNode.character}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-mono font-medium text-[#6B7280]">
                                  #{itemNumber}
                                </span>
                                <span
                                  className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${meta.badgeClass}`}
                                >
                                  {kNode.level}
                                </span>
                                {kNode.strokes > 0 && (
                                  <span className="text-[11px] text-[#9CA3AF]">
                                    {kNode.strokes} ขีด
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => speakJapanese(kNode.character)}
                                title="ฟังเสียงอ่านคันจิ"
                                className="p-1.5 rounded-xl bg-[#1F2229] text-[#9CA3AF] hover:text-[#D4AF37] hover:bg-[#2A2D36] border border-[#2A2D36] transition-colors cursor-pointer shrink-0"
                              >
                                <Volume2 className="w-4 h-4" />
                              </button>
                            </div>

                            {meaningLanguage === 'BOTH' ? (
                              <div className="space-y-0.5 pt-0.5">
                                <div className="text-xs sm:text-sm font-medium text-[#F3F4F6]">
                                  {kNode.meaningTh || kNode.meaningEn}
                                </div>
                                <div className="text-xs text-[#FBBF24]">
                                  {kNode.meaningEn}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs sm:text-sm font-medium text-[#F3F4F6] pt-0.5">
                                {meaningLanguage === 'TH'
                                  ? kNode.meaningTh || kNode.meaningEn
                                  : kNode.meaningEn}
                              </div>
                            )}

                            {/* On / Kun Readings */}
                            <div className="text-[11px] text-[#9CA3AF] space-y-0.5 pt-0.5">
                              {kNode.onyomi.length > 0 && (
                                <div className="truncate">
                                  <span className="text-[#FBBF24] font-medium">On: </span>
                                  <span className="font-jp">{kNode.onyomi.join('・')}</span>
                                  {showRomaji && kNode.onyomiRomaji.length > 0 && (
                                    <span className="text-[#6B7280] font-mono ml-1">
                                      [{kNode.onyomiRomaji.join(', ')}]
                                    </span>
                                  )}
                                </div>
                              )}
                              {kNode.kunyomi.length > 0 && (
                                <div className="truncate">
                                  <span className="text-[#34D399] font-medium">Kun: </span>
                                  <span className="font-jp">{kNode.kunyomi.join('・')}</span>
                                  {showRomaji && kNode.kunyomiRomaji.length > 0 && (
                                    <span className="text-[#6B7280] font-mono ml-1">
                                      [{kNode.kunyomiRomaji.join(', ')}]
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Bottom Row: Clean Bottom-Right "แสดงเพิ่มเติม" Button ONLY */}
                        <div className="pt-2 border-t border-[#2A2D36] flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={!canExpandKanji}
                            onClick={() =>
                              canExpandKanji && toggleExpandKanji(kNode.character)
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all shrink-0 ${
                              !canExpandKanji
                                ? 'bg-[#16181D]/50 border-[#2A2D36]/60 text-[#6B7280] cursor-not-allowed select-none'
                                : isKanjiExpanded
                                ? 'bg-[#D4AF37] text-[#0E0F12] border-[#D4AF37] shadow-sm cursor-pointer'
                                : 'bg-[#1F2229] hover:bg-[#2A2D36] text-[#F3F4F6] border-[#2A2D36] cursor-pointer'
                            }`}
                          >
                            <span>
                              {isKanjiExpanded ? 'ซ่อนรายละเอียด' : 'แสดงเพิ่มเติม'}
                            </span>
                            {canExpandKanji &&
                              (isKanjiExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ))}
                          </button>
                        </div>

                        {/* Expanded Drawer for Kanji Card: Links to Vocabulary Words using this Kanji */}
                        {isKanjiExpanded && canExpandKanji && (
                          <div className="pt-3 border-t border-[#2A2D36] space-y-2.5 bg-[#0E0F12] -mx-1.5 p-3 rounded-xl">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-bold text-[#D4AF37] flex items-center gap-1.5">
                                <Link2 className="w-3.5 h-3.5" />
                                คำศัพท์ที่ใช้คันจิ 「{kNode.character}」 ({relatedWords.length} คำ)
                              </span>
                              <button
                                type="button"
                                onClick={() => navigateToKanji(kNode.character)}
                                className="text-[11px] text-[#D4AF37] hover:underline font-medium cursor-pointer"
                              >
                                เปิดหน้าคันจิ 「{kNode.character}」 เต็มจอ ➔
                              </button>
                            </div>

                            <div className="grid grid-cols-1 gap-1.5 max-h-60 overflow-y-auto pr-1">
                              {relatedWords.map((sw) => {
                                const swMeta = LEVEL_METADATA[sw.level];
                                return (
                                  <button
                                    key={sw.id}
                                    type="button"
                                    onClick={() => navigateToWord(sw.id)}
                                    className="w-full text-left rounded-lg border border-[#2A2D36] hover:border-[#D4AF37]/50 bg-[#16181D] hover:bg-[#1F2229] px-2.5 py-2 flex items-center justify-between gap-2 transition-all cursor-pointer group"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span
                                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${swMeta.badgeClass}`}
                                        >
                                          {sw.level}
                                        </span>
                                        <span className="text-sm font-medium text-[#F3F4F6] font-jp">
                                          {sw.expression}
                                        </span>
                                        <span className="text-xs text-[#FB6542] font-jp font-medium">
                                          【{sw.reading}】
                                        </span>
                                        {showRomaji && sw.romaji && (
                                          <span className="text-[11px] text-[#FBBF24] font-mono">
                                            [{sw.romaji}]
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-[#9CA3AF] mt-0.5 truncate">
                                        {formatWordMeaning(sw, meaningLanguage)}
                                      </div>
                                    </div>
                                    <span className="text-[11px] font-bold text-[#D4AF37] shrink-0">
                                      ดูคำนี้ ➔
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

              {totalMatching === 0 && (
                <div className="col-span-full py-12 text-center text-[#6B7280] text-sm">
                  ไม่พบรายการที่ตรงกับตัวกรองหรือคำค้นหา "{searchQuery}"
                </div>
              )}
            </div>

            {/* Pagination Footer */}
            <div className="px-4 sm:px-5 py-3 border-t border-[#2A2D36] bg-[#16181D]/95 flex flex-wrap items-center justify-between gap-3 text-xs text-[#9CA3AF]">
              <div className="flex items-center gap-2">
                <span>
                  แสดงรายการที่{' '}
                  <strong className="text-[#F3F4F6]">
                    {startItemNumber.toLocaleString()}–{endItemNumber.toLocaleString()}
                  </strong>{' '}
                  จากทั้งหมด{' '}
                  <strong className="text-[#D4AF37]">
                    {totalMatching.toLocaleString()}
                  </strong>{' '}
                  รายการ (หน้าละ {ITEMS_PER_PAGE})
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage(1)}
                  title="หน้าแรก"
                  className="p-1.5 rounded-lg bg-[#1F2229] hover:bg-[#2A2D36] border border-[#2A2D36] disabled:opacity-40 disabled:pointer-events-none text-[#F3F4F6] cursor-pointer"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1F2229] hover:bg-[#2A2D36] border border-[#2A2D36] disabled:opacity-40 disabled:pointer-events-none text-[#F3F4F6] font-medium cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>ก่อนหน้า</span>
                </button>

                {/* Direct Page Input [1] / 81 + Go Button */}
                <form
                  onSubmit={handleJumpToPage}
                  className="inline-flex items-center gap-1.5 bg-[#0E0F12] border border-[#2A2D36] rounded-xl px-2.5 py-1 shadow-inner"
                >
                  <span className="text-xs text-[#9CA3AF] font-medium">หน้า</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pageInputStr}
                    onChange={handlePageInputChange}
                    onKeyDown={handlePageInputKeyDown}
                    onBlur={handlePageInputBlur}
                    className="w-11 sm:w-12 text-center py-0.5 px-1 rounded-lg bg-[#16181D] border border-[#2A2D36] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] text-[#D4AF37] font-bold font-mono text-xs sm:text-sm outline-none transition-all"
                    aria-label="หมายเลขหน้าที่ต้องการไป"
                  />
                  <span className="text-xs text-[#9CA3AF] font-mono font-medium select-none">
                    / {totalPages}
                  </span>
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#F3DA78] hover:brightness-110 active:scale-95 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-sm shadow-[#D4AF37]/20"
                    title="ไปยังหน้าที่ระบุ"
                  >
                    ไป
                  </button>
                </form>

                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1F2229] hover:bg-[#2A2D36] border border-[#2A2D36] disabled:opacity-40 disabled:pointer-events-none text-[#F3F4F6] font-medium cursor-pointer"
                >
                  <span>ถัดไป</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  title="หน้าสุดท้าย"
                  className="p-1.5 rounded-lg bg-[#1F2229] hover:bg-[#2A2D36] border border-[#2A2D36] disabled:opacity-40 disabled:pointer-events-none text-[#F3F4F6] cursor-pointer"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
