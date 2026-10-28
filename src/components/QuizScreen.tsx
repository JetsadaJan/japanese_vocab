import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Flag,
  Flame,
  Globe,
  HelpCircle,
  Sparkles,
  Volume2,
  XCircle,
} from 'lucide-react';
import {
  AnswerRecord,
  JLPTLevel,
  KanjiDatabase,
  MeaningLanguage,
  QuizQuestion,
  QuizSettings,
  VocabWord,
} from '../types';
import {
  LEVEL_METADATA,
  WORD_CATEGORY_META,
  formatKanjiLinkLabel,
  formatWordMeaning,
  hasWordExtraDetails,
  speakJapanese,
} from '../utils/vocabData';
import {
  ConfusableIndex,
  getConfusableWords,
  getPrimaryGroupIdForWord,
} from '../utils/confusableWords';
import { JapaneseText } from './JapaneseText';
import {
  HoverInspectItem,
  QuizHoverInspector,
} from './QuizHoverInspector';

interface QuizScreenProps {
  settings: QuizSettings;
  currentQuestion: QuizQuestion;
  questionNumber: number;
  history: AnswerRecord[];
  kanjiDb: KanjiDatabase;
  wordMap: Record<string, VocabWord>;
  confusableIndex: ConfusableIndex;
  onToggleHiragana: () => void;
  onToggleRomaji: () => void;
  onChangeLanguage: (lang: MeaningLanguage) => void;
  onSubmitAnswer: (selectedIndex: number, timeSpentMs: number) => void;
  onNextQuestion: () => void;
  onFinishSession: () => void;
  onBackToSetup: () => void;
}

export const QuizScreen: React.FC<QuizScreenProps> = ({
  settings,
  currentQuestion,
  questionNumber,
  history,
  kanjiDb,
  wordMap,
  confusableIndex,
  onToggleHiragana,
  onToggleRomaji,
  onChangeLanguage,
  onSubmitAnswer,
  onNextQuestion,
  onFinishSession,
  onBackToSetup,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [peekReadingThisQuestion, setPeekReadingThisQuestion] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());

  // Track which option cards have their "แสดงเพิ่มเติม" drawer expanded after answering
  const [expandedOptionIds, setExpandedOptionIds] = useState<Set<string>>(new Set());

  // Hover inspector stack (translucent blurred overlay keeping the quiz visible behind)
  const [hoverHistory, setHoverHistory] = useState<HoverInspectItem[]>([]);

  const isAnswered = selectedIdx !== null;
  const isCorrect = isAnswered && selectedIdx === currentQuestion.correctIndex;
  const effectiveShowHiragana =
    settings.showHiragana || peekReadingThisQuestion || isAnswered;
  const effectiveShowRomaji =
    settings.showRomaji || peekReadingThisQuestion || isAnswered;

  // Reset per-question state when question changes
  useEffect(() => {
    setSelectedIdx(null);
    setPeekReadingThisQuestion(false);
    setExpandedOptionIds(new Set());
    setHoverHistory([]);
    setQuestionStartTime(Date.now());
  }, [currentQuestion.id]);

  const handleSelectOption = (index: number) => {
    if (isAnswered) return;
    const elapsed = Math.max(200, Date.now() - questionStartTime);
    setSelectedIdx(index);
    onSubmitAnswer(index, elapsed);
  };

  const toggleExpandOption = (wordId: string) => {
    setExpandedOptionIds((prev) => {
      const next = new Set(prev);
      if (next.has(wordId)) {
        next.delete(wordId);
      } else {
        next.add(wordId);
      }
      return next;
    });
  };

  const openHoverKanji = (char: string) => {
    if (!kanjiDb[char]) return;
    setHoverHistory((prev) => [...prev, { type: 'KANJI', char }]);
  };

  const openHoverWord = (wordId: string) => {
    if (!wordMap[wordId]) return;
    setHoverHistory((prev) => [...prev, { type: 'WORD', wordId }]);
  };

  const openHoverGroup = (groupId: string) => {
    setHoverHistory((prev) => [...prev, { type: 'GROUP', groupId }]);
  };

  const cycleLanguage = () => {
    const order: MeaningLanguage[] = ['TH', 'EN', 'BOTH'];
    const nextIdx = (order.indexOf(settings.meaningLanguage) + 1) % order.length;
    onChangeLanguage(order[nextIdx]);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (hoverHistory.length > 0) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setHoverHistory([]);
        }
        return;
      }

      if (!isAnswered) {
        if (['1', '2', '3', '4'].includes(e.key)) {
          e.preventDefault();
          const idx = Number(e.key) - 1;
          if (idx >= 0 && idx < currentQuestion.options.length) {
            handleSelectOption(idx);
          }
        }
      } else {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onNextQuestion();
        }
      }

      if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        onToggleHiragana();
      }

      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        onToggleRomaji();
      }

      if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        cycleLanguage();
      }

      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        speakJapanese(
          currentQuestion.targetWord.reading || currentQuestion.targetWord.expression
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Compute live session stats
  const correctCount = history.filter((h) => h.isCorrect).length;
  const accuracy =
    history.length > 0 ? Math.round((correctCount / history.length) * 100) : 0;

  let currentStreak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].isCorrect) currentStreak++;
    else break;
  }

  // Count how many questions of each JLPT level have appeared so far
  const levelAppearanceCounts: Record<JLPTLevel, number> = {
    N1: 0,
    N2: 0,
    N3: 0,
    N4: 0,
    N5: 0,
  };
  history.forEach((h) => {
    levelAppearanceCounts[h.question.targetWord.level]++;
  });
  if (!isAnswered) {
    levelAppearanceCounts[currentQuestion.targetWord.level]++;
  }
  const totalSeenSoFar = history.length + (isAnswered ? 0 : 1);

  const wordLevelMeta = LEVEL_METADATA[currentQuestion.targetWord.level];
  const wordCategoryMeta = WORD_CATEGORY_META[currentQuestion.targetWord.category];
  const isLastQuestion =
    settings.sessionLength > 0 && questionNumber >= settings.sessionLength;

  const langDisplayLabel =
    settings.meaningLanguage === 'TH'
      ? 'ไทย'
      : settings.meaningLanguage === 'EN'
      ? 'EN'
      : 'ไทย+EN';

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 sm:py-8 space-y-4">
      {/* Top Control & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={history.length > 0 ? onFinishSession : onBackToSetup}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {history.length > 0 ? 'สรุปผล' : 'ตั้งค่า'}
          </button>

          <span className="text-xs font-bold text-white px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">
            {settings.selectedLevel}
          </span>
        </div>

        {/* Center Stats: Streak & Score */}
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>{currentStreak}</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold">
            <span>
              {correctCount}/{history.length} ({accuracy}%)
            </span>
          </div>
        </div>

        {/* Right: Live Language Switcher + Hiragana & Romaji Toggles */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Language Segmented Control */}
          <div
            className="inline-flex items-center rounded-xl bg-slate-950 p-0.5 border border-slate-800"
            title="สลับภาษา (ปุ่มลัด L)"
          >
            <Globe className="w-3.5 h-3.5 text-sky-400 ml-2 mr-1 hidden sm:block" />
            {(['TH', 'EN', 'BOTH'] as MeaningLanguage[]).map((lang) => {
              const active = settings.meaningLanguage === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onChangeLanguage(lang)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                    active
                      ? 'bg-sky-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lang === 'TH' ? '🇹🇭 ไทย' : lang === 'EN' ? '🇬🇧 EN' : 'ไทย+EN'}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onToggleHiragana}
            title="Hiragana (H)"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              settings.showHiragana
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {settings.showHiragana ? (
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>Hiragana</span>
          </button>

          <button
            type="button"
            onClick={onToggleRomaji}
            title="Romaji (R)"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              settings.showRomaji
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {settings.showRomaji ? (
              <Eye className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>Romaji</span>
          </button>
        </div>
      </div>

      {/* Question Header Info */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span className="font-semibold text-slate-200">
          ข้อที่ {questionNumber}
        </span>
        <span>
          {currentQuestion.direction === 'EN_TO_JA'
            ? `${langDisplayLabel} ➔ ญี่ปุ่น`
            : `ญี่ปุ่น ➔ ${langDisplayLabel}`}
        </span>
      </div>

      {/* Main Question Card */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 p-6 sm:p-8 shadow-2xl text-center">
        {/* Card Top Metadata Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="inline-flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-extrabold px-3 py-1 rounded-full border ${wordLevelMeta.badgeClass}`}
            >
              {currentQuestion.targetWord.level}
            </span>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${wordCategoryMeta.badgeClass}`}
            >
              {wordCategoryMeta.labelTh}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {(!settings.showHiragana || !settings.showRomaji) && !isAnswered && (
              <button
                type="button"
                onClick={() => setPeekReadingThisQuestion(true)}
                disabled={peekReadingThisQuestion}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-xs text-amber-300 font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                {peekReadingThisQuestion ? 'แสดงคำอ่านแล้ว' : 'ดูคำอ่าน'}
              </button>
            )}

            {(currentQuestion.direction === 'JA_TO_EN' || isAnswered) && (
              <button
                type="button"
                onClick={() =>
                  speakJapanese(
                    currentQuestion.targetWord.reading ||
                      currentQuestion.targetWord.expression
                  )
                }
                title="ฟังเสียง (S)"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>ฟังเสียง</span>
              </button>
            )}
          </div>
        </div>

        {/* Prompt Content */}
        {currentQuestion.direction === 'EN_TO_JA' ? (
          <div className="py-3 sm:py-5 space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ความหมาย ({langDisplayLabel})</span>
            </div>
            {settings.meaningLanguage === 'BOTH' ? (
              <div className="space-y-1.5 max-w-2xl mx-auto">
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-snug break-words">
                  “{currentQuestion.targetWord.meaningTh || currentQuestion.targetWord.meaning}”
                </h2>
                <div className="text-base sm:text-xl font-semibold text-sky-300 break-words">
                  ({currentQuestion.targetWord.meaning})
                </div>
              </div>
            ) : (
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-snug max-w-2xl mx-auto break-words">
                “{formatWordMeaning(currentQuestion.targetWord, settings.meaningLanguage)}”
              </h2>
            )}
          </div>
        ) : (
          <div className="py-3 sm:py-5 space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>คำศัพท์ญี่ปุ่น</span>
            </div>
            <div className="py-1">
              <JapaneseText
                expression={currentQuestion.targetWord.expression}
                reading={currentQuestion.targetWord.reading}
                romaji={currentQuestion.targetWord.romaji}
                showHiragana={effectiveShowHiragana}
                showRomaji={effectiveShowRomaji}
                size="xl"
              />
            </div>
          </div>
        )}
      </div>

      {/* 4 Multiple Choice Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {currentQuestion.options.map((opt, idx) => {
          const isThisOptionSelected = selectedIdx === idx;
          const isThisOptionCorrect = idx === currentQuestion.correctIndex;

          const optConfusables = isAnswered
            ? getConfusableWords(opt, confusableIndex)
            : [];
          const soundConfusables = optConfusables.filter(
            (c) => c.type !== 'SIMILAR_MEANING'
          );
          const meaningSimilars = optConfusables.filter(
            (c) => c.type === 'SIMILAR_MEANING'
          );
          const optGroupId = isAnswered
            ? getPrimaryGroupIdForWord(opt, confusableIndex, meaningSimilars.length)
            : null;
          const canExpand = hasWordExtraDetails(opt, optConfusables.length);
          const isOptExpanded = expandedOptionIds.has(opt.id);

          let cardStyle =
            'bg-slate-900/80 border-slate-800 hover:border-rose-500/50 hover:bg-slate-900 text-slate-100';
          let badgeStyle = 'bg-slate-800 text-slate-300 border-slate-700';

          if (isAnswered) {
            if (isThisOptionCorrect) {
              cardStyle =
                'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/40 text-emerald-100';
              badgeStyle = 'bg-emerald-500 text-slate-950 border-emerald-400';
            } else if (isThisOptionSelected && !isThisOptionCorrect) {
              cardStyle =
                'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/40 text-rose-100';
              badgeStyle = 'bg-rose-500 text-white border-rose-400';
            } else {
              cardStyle =
                'bg-slate-900/55 border-slate-800/80 text-slate-300';
            }
          }

          return (
            <div
              key={opt.id}
              onClick={() => !isAnswered && handleSelectOption(idx)}
              role={isAnswered ? undefined : 'button'}
              tabIndex={isAnswered ? undefined : 0}
              onKeyDown={(e) => {
                if (!isAnswered && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleSelectOption(idx);
                }
              }}
              className={`group relative text-left rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between gap-3 ${cardStyle} ${
                isAnswered ? 'cursor-default' : 'cursor-pointer active:scale-[0.99]'
              }`}
            >
              {/* Top Section of Option Card */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <span
                    className={`w-7 h-7 rounded-xl border text-xs font-extrabold inline-flex items-center justify-center shrink-0 mt-0.5 transition-colors ${badgeStyle}`}
                  >
                    {idx + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    {currentQuestion.direction === 'EN_TO_JA' ? (
                      <div className="space-y-1">
                        <JapaneseText
                          expression={opt.expression}
                          reading={opt.reading}
                          romaji={opt.romaji}
                          showHiragana={effectiveShowHiragana}
                          showRomaji={effectiveShowRomaji}
                          size="md"
                          className="items-start"
                        />
                        {isAnswered && (
                          <div className="text-xs text-slate-300/90 pt-1.5 border-t border-slate-800/70 mt-1.5 space-y-0.5">
                            <div>
                              🇹🇭{' '}
                              <span className="font-semibold text-white">
                                {opt.meaningTh}
                              </span>
                            </div>
                            <div className="text-slate-400">
                              🇬🇧 <span>{opt.meaning}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 pt-1">
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${LEVEL_METADATA[opt.level].badgeClass}`}>
                                {opt.level}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${WORD_CATEGORY_META[opt.category].badgeClass}`}>
                                {WORD_CATEGORY_META[opt.category].labelTh}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {settings.meaningLanguage === 'BOTH' ? (
                          <div className="space-y-1">
                            <div className="text-base sm:text-lg font-bold leading-snug break-words text-white">
                              {opt.meaningTh || opt.meaning}
                            </div>
                            <div className="text-xs sm:text-sm font-medium text-sky-300/90 break-words">
                              {opt.meaning}
                            </div>
                          </div>
                        ) : (
                          <div className="text-base sm:text-lg font-bold leading-snug break-words">
                            {formatWordMeaning(opt, settings.meaningLanguage)}
                          </div>
                        )}
                        {isAnswered && (
                          <div className="text-xs text-slate-300/90 pt-1.5 border-t border-slate-800/70 mt-1.5 space-y-0.5">
                            <div className="font-jp">
                              คำศัพท์:{' '}
                              <span className="font-bold text-rose-300">
                                {opt.expression}
                              </span>
                              {opt.reading !== opt.expression && (
                                <span className="text-slate-300"> ({opt.reading})</span>
                              )}
                              {opt.romaji && (
                                <span className="text-amber-300 font-mono ml-1">
                                  [{opt.romaji}]
                                </span>
                              )}
                            </div>
                            {settings.meaningLanguage === 'TH' && (
                              <div className="text-slate-400">🇬🇧 {opt.meaning}</div>
                            )}
                            {settings.meaningLanguage === 'EN' && (
                              <div className="text-slate-300">🇹🇭 {opt.meaningTh}</div>
                            )}
                            <div className="flex flex-wrap items-center gap-1 pt-1">
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${LEVEL_METADATA[opt.level].badgeClass}`}>
                                {opt.level}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${WORD_CATEGORY_META[opt.category].badgeClass}`}>
                                {WORD_CATEGORY_META[opt.category].labelTh}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right status icon + audio button */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isAnswered && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        speakJapanese(opt.reading || opt.expression);
                      }}
                      title="ฟังเสียงอ่านคำนี้"
                      className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}

                  {isAnswered && isThisOptionCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  )}
                  {isAnswered && isThisOptionSelected && !isThisOptionCorrect && (
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                </div>
              </div>

              {/* After Answering: Bottom-Right "แสดงเพิ่มเติม" Button on every option card (clean, no links until clicked) */}
              {isAnswered && (
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-end gap-2">
                  {/* Bottom-Right Expand Button */}
                  <button
                    type="button"
                    disabled={!canExpand}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canExpand) toggleExpandOption(opt.id);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all shrink-0 ${
                      !canExpand
                        ? 'bg-slate-900/50 border-slate-800/70 text-slate-600 cursor-not-allowed select-none'
                        : isOptExpanded
                        ? 'bg-rose-500 text-white border-rose-400 shadow-sm cursor-pointer'
                        : 'bg-slate-800/90 hover:bg-slate-700 text-rose-300 border-slate-700 cursor-pointer'
                    }`}
                  >
                    <span>{isOptExpanded ? 'ซ่อนเพิ่มเติม' : 'แสดงเพิ่มเติม'}</span>
                    {canExpand &&
                      (isOptExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ))}
                  </button>
                </div>
              )}

              {/* Expanded Drawer inside Option Card: 1) Red Confusable Words FIRST, 2) Similar Meaning Words, 3) Kanji Links */}
              {isAnswered && isOptExpanded && canExpand && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="pt-2.5 border-t border-slate-700/80 space-y-2.5 bg-slate-950/85 -mx-1 p-3 rounded-xl"
                >
                  {/* 1. Red Confusable / Homophone Section FIRST */}
                  {soundConfusables.length > 0 && (
                    <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-2.5 space-y-1.5">
                      <div className="text-xs font-extrabold text-rose-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>พ้องเสียง / เสียงคล้าย</span>
                      </div>

                      <div className="space-y-1.5">
                        {soundConfusables.map((c) => (
                          <button
                            key={c.word.id}
                            type="button"
                            onClick={() => openHoverWord(c.word.id)}
                            className="w-full text-left rounded-lg border border-rose-500/30 hover:border-rose-400 bg-slate-950/85 hover:bg-slate-900 px-2.5 py-2 flex items-center justify-between gap-2 transition-all cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-rose-500/25 text-rose-300 border border-rose-500/40">
                                  {c.labelTh}
                                </span>
                                <span className="text-sm font-extrabold text-rose-200 font-jp">
                                  {c.word.expression}
                                </span>
                                <span className="text-xs text-rose-300/90 font-jp">
                                  ({c.word.reading})
                                </span>
                                {effectiveShowRomaji && c.word.romaji && (
                                  <span className="text-[11px] text-amber-300 font-mono">
                                    [{c.word.romaji}]
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-semibold text-white mt-0.5 break-words">
                                {formatWordMeaning(c.word, settings.meaningLanguage)}
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-rose-400 shrink-0">
                              ดู ➔
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. Similar Meaning Words ("ความหมายใกล้เคียง" e.g. ageru/morau/kureru, inochi/jinsei) */}
                  {(meaningSimilars.length > 0 || optGroupId) && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-2.5 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                          <span>ความหมายใกล้เคียง</span>
                        </div>

                        {optGroupId && (
                          <button
                            type="button"
                            onClick={() => openHoverGroup(optGroupId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-extrabold shadow-xs transition-all cursor-pointer"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>Group เปรียบเทียบ ➔</span>
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {meaningSimilars.map((c) => (
                          <button
                            key={c.word.id}
                            type="button"
                            onClick={() => openHoverWord(c.word.id)}
                            className="w-full text-left rounded-lg border border-amber-500/30 hover:border-amber-400 bg-slate-950/85 hover:bg-slate-900 px-2.5 py-2 flex items-center justify-between gap-2 transition-all cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  {c.labelTh}
                                </span>
                                <span className="text-sm font-extrabold text-white font-jp">
                                  {c.word.expression}
                                </span>
                                <span className="text-xs text-amber-200/90 font-jp">
                                  ({c.word.reading})
                                </span>
                                {effectiveShowRomaji && c.word.romaji && (
                                  <span className="text-[11px] text-amber-300 font-mono">
                                    [{c.word.romaji}]
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-semibold text-white mt-0.5 break-words">
                                {formatWordMeaning(c.word, settings.meaningLanguage)}
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-amber-300 shrink-0">
                              ดู ➔
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. Kanji Links formatted as "{Kanji} ➔ {Meaning in selected language}" */}
                  {opt.kanjiChars.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-400">
                        คันจิ:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {opt.kanjiChars.map((ch) => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => openHoverKanji(ch)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 text-xs font-bold text-amber-300 hover:text-rose-200 transition-all cursor-pointer text-left"
                          >
                            {formatKanjiLinkLabel(ch, kanjiDb, settings.meaningLanguage)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Answer Feedback & Next Button */}
      {isAnswered && (
        <div
          className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
            isCorrect
              ? 'bg-emerald-950/40 border-emerald-500/40'
              : 'bg-rose-950/40 border-rose-500/40'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3">
            {isCorrect ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
            )}

            <div className="space-y-1">
              <div className="text-sm sm:text-base font-extrabold text-white">
                {isCorrect ? 'ถูกต้อง! 🎉' : 'เฉลยคำที่ถูก:'}
              </div>
              <div className="text-xs sm:text-sm text-slate-200 font-jp">
                <span className="font-bold text-rose-300">
                  {currentQuestion.targetWord.expression}
                </span>
                {currentQuestion.targetWord.reading !==
                  currentQuestion.targetWord.expression && (
                  <span className="text-emerald-300 font-semibold">
                    {' '}
                    【{currentQuestion.targetWord.reading}】
                  </span>
                )}
                {currentQuestion.targetWord.romaji && (
                  <span className="text-amber-300 font-mono font-semibold ml-1">
                    [{currentQuestion.targetWord.romaji}]
                  </span>
                )}{' '}
                —{' '}
                <span className="font-sans font-semibold text-white">
                  {currentQuestion.targetWord.meaningTh}
                </span>{' '}
                <span className="font-sans text-slate-400">
                  ({currentQuestion.targetWord.meaning})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {settings.sessionLength === 0 && (
              <button
                type="button"
                onClick={onFinishSession}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Flag className="w-4 h-4" />
                จบ / ดูสรุป
              </button>
            )}

            <button
              type="button"
              onClick={onNextQuestion}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-rose-500/20 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isLastQuestion ? 'ดูสรุป' : 'ข้อต่อไป (Enter)'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Live Level Mix Tracker Footer */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>ระดับคำที่ออก ({totalSeenSoFar} ข้อ):</span>
        <div className="flex flex-wrap items-center gap-2">
          {(['N1', 'N2', 'N3', 'N4', 'N5'] as JLPTLevel[]).map((lvl) => {
            const count = levelAppearanceCounts[lvl];
            const configuredWeight = settings.customWeights[lvl] || 0;
            if (count === 0 && configuredWeight === 0) return null;
            const meta = LEVEL_METADATA[lvl];
            const actualPct =
              totalSeenSoFar > 0 ? Math.round((count / totalSeenSoFar) * 100) : 0;
            return (
              <span
                key={lvl}
                className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${meta.badgeClass}`}
              >
                {lvl}: {count} ข้อ ({actualPct}%)
              </span>
            );
          })}
        </div>
      </div>

      {/* Translucent Hover Inspector Overlay (shows quiz blurred behind, Close button always top-right) */}
      <QuizHoverInspector
        history={hoverHistory}
        kanjiDb={kanjiDb}
        wordMap={wordMap}
        confusableIndex={confusableIndex}
        meaningLanguage={settings.meaningLanguage}
        showRomaji={effectiveShowRomaji}
        onNavigateKanji={openHoverKanji}
        onNavigateWord={openHoverWord}
        onNavigateGroup={openHoverGroup}
        onBack={() => setHoverHistory((prev) => prev.slice(0, -1))}
        onClose={() => setHoverHistory([])}
      />
    </div>
  );
};
