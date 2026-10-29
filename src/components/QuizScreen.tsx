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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#2A2D36] bg-[#16181D]/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={history.length > 0 ? onFinishSession : onBackToSetup}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1F2229] hover:bg-[#2A2D36] border border-[#2A2D36] text-[#F3F4F6] text-xs font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {history.length > 0 ? 'สรุปผล' : 'ตั้งค่า'}
          </button>

          <span className="text-xs font-bold text-[#FBBF24] px-2.5 py-1 rounded-lg bg-[#2E1F05] border border-[#D97706]/50 tag-luxury">
            {settings.selectedLevel}
          </span>
        </div>

        {/* Center Stats: Streak & Score */}
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#2E1F05] border border-[#D97706]/50 text-[#FBBF24] font-bold tag-luxury">
            <Flame className="w-4 h-4 text-[#D4AF37]" />
            <span>{currentStreak}</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#062E22] border border-[#059669]/50 text-[#34D399] font-bold tag-luxury">
            <span>
              {correctCount}/{history.length} ({accuracy}%)
            </span>
          </div>
        </div>

        {/* Right: Live Language Switcher + Hiragana & Romaji Toggles */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Language Segmented Control */}
          <div
            className="inline-flex items-center rounded-xl bg-[#0E0F12] p-0.5 border border-[#2A2D36]"
            title="สลับภาษา (ปุ่มลัด L)"
          >
            <Globe className="w-3.5 h-3.5 text-[#D4AF37] ml-2 mr-1 hidden sm:block" />
            {(['TH', 'EN', 'BOTH'] as MeaningLanguage[]).map((lang) => {
              const active = settings.meaningLanguage === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onChangeLanguage(lang)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                    active
                      ? 'bg-[#D4AF37] text-[#0E0F12] shadow-xs'
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
            onClick={onToggleHiragana}
            title="Hiragana (H)"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              settings.showHiragana
                ? 'bg-[#062E22] border-[#059669] text-[#34D399]'
                : 'bg-[#0E0F12] border-[#2A2D36] text-[#6B7280] hover:bg-[#1F2229]'
            }`}
          >
            {settings.showHiragana ? (
              <Eye className="w-3.5 h-3.5 text-[#34D399]" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-[#6B7280]" />
            )}
            <span>Hiragana</span>
          </button>

          <button
            type="button"
            onClick={onToggleRomaji}
            title="Romaji (R)"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              settings.showRomaji
                ? 'bg-[#2E1F05] border-[#D97706] text-[#FBBF24]'
                : 'bg-[#0E0F12] border-[#2A2D36] text-[#6B7280] hover:bg-[#1F2229]'
            }`}
          >
            {settings.showRomaji ? (
              <Eye className="w-3.5 h-3.5 text-[#FBBF24]" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-[#6B7280]" />
            )}
            <span>Romaji</span>
          </button>
        </div>
      </div>

      {/* Question Header Info & Progress Bar */}
      <div className="space-y-1.5 px-1">
        <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#F3F4F6]">
              ข้อที่ {questionNumber}
              {currentQuestion.totalQuestions
                ? ` / ${currentQuestion.totalQuestions}`
                : settings.sessionLength > 0
                ? ` / ${settings.sessionLength}`
                : ''}
            </span>
            {currentQuestion.targetMode === 'MISTAKES_ONLY' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-500/50 bg-rose-950/40 text-rose-300">
                เฉพาะคำที่ตอบผิด
              </span>
            )}
          </div>
          <span>
            {currentQuestion.direction === 'EN_TO_JA'
              ? `${langDisplayLabel} ➔ ญี่ปุ่น`
              : `ญี่ปุ่น ➔ ${langDisplayLabel}`}
          </span>
        </div>
        {(Boolean(currentQuestion.totalQuestions) || settings.sessionLength > 0) && (
          <div className="w-full bg-[#1F2229] h-1.5 rounded-full overflow-hidden border border-[#2A2D36]/40">
            <div
              className={`h-full transition-all duration-300 ${
                currentQuestion.targetMode === 'MISTAKES_ONLY'
                  ? 'bg-gradient-to-r from-rose-500 to-rose-400'
                  : 'bg-gradient-to-r from-[#D4AF37] to-[#F3DA78]'
              }`}
              style={{
                width: `${Math.min(
                  100,
                  (questionNumber / (currentQuestion.totalQuestions || settings.sessionLength)) * 100
                )}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Main Question Card */}
      <div className="relative overflow-hidden rounded-3xl border border-[#2A2D36] bg-[#16181D] p-6 sm:p-8 shadow-2xl text-center">
        {/* Card Top Metadata Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="inline-flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${wordLevelMeta.badgeClass}`}
            >
              {currentQuestion.targetWord.level}
            </span>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${wordCategoryMeta.badgeClass}`}
            >
              {wordCategoryMeta.labelTh}
            </span>
            {currentQuestion.targetMode === 'MISTAKES_ONLY' ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border border-rose-500/50 bg-rose-950/40 text-rose-300">
                คำที่ตอบผิด
              </span>
            ) : currentQuestion.isReview ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border border-[#B91C1C]/50 bg-[#2A1215] text-[#FCA5A5]">
                ทบทวน
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {(!settings.showHiragana || !settings.showRomaji) && !isAnswered && (
              <button
                type="button"
                onClick={() => setPeekReadingThisQuestion(true)}
                disabled={peekReadingThisQuestion}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#1F2229] hover:bg-[#2A2D36] border border-[#2A2D36] text-xs text-[#D4AF37] font-medium transition-all cursor-pointer disabled:opacity-50"
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
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#1F2229] hover:bg-[#2A2D36] border border-[#2A2D36] text-[#D4AF37] text-xs font-medium transition-colors cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>ฟังเสียง</span>
              </button>
            )}
          </div>
        </div>

        {/* Prompt Content */}
        {currentQuestion.direction === 'EN_TO_JA' ? (
          <div className="py-4 sm:py-6 space-y-2">
            {settings.meaningLanguage === 'BOTH' ? (
              <div className="space-y-1.5 max-w-2xl mx-auto">
                <h2 className="text-2xl sm:text-4xl font-medium text-[#F3F4F6] leading-snug break-words">
                  “{currentQuestion.targetWord.meaningTh || currentQuestion.targetWord.meaning}”
                </h2>
                <div className="text-base sm:text-xl font-medium text-[#FBBF24] break-words">
                  ({currentQuestion.targetWord.meaning})
                </div>
              </div>
            ) : (
              <h2 className="text-2xl sm:text-4xl font-medium text-[#F3F4F6] leading-snug max-w-2xl mx-auto break-words">
                “{formatWordMeaning(currentQuestion.targetWord, settings.meaningLanguage)}”
              </h2>
            )}
          </div>
        ) : (
          <div className="py-4 sm:py-6">
            <JapaneseText
              expression={currentQuestion.targetWord.expression}
              reading={currentQuestion.targetWord.reading}
              romaji={currentQuestion.targetWord.romaji}
              showHiragana={effectiveShowHiragana}
              showRomaji={effectiveShowRomaji}
              size="xl"
            />
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
            'bg-[#16181D] border-[#2A2D36] hover:border-[#D4AF37]/50 hover:bg-[#1F2229] text-[#F3F4F6]';
          let badgeStyle = 'bg-[#0E0F12] text-[#9CA3AF] border-[#2A2D36]';

          if (isAnswered) {
            if (isThisOptionCorrect) {
              cardStyle =
                'bg-[#062E22] border-[#10B981] ring-2 ring-[#10B981]/40 text-[#34D399]';
              badgeStyle = 'bg-[#10B981] text-[#0E0F12] border-[#059669]';
            } else if (isThisOptionSelected && !isThisOptionCorrect) {
              cardStyle =
                'bg-[#330D17] border-[#F43F5E] ring-2 ring-[#F43F5E]/40 text-[#FB7185]';
              badgeStyle = 'bg-[#F43F5E] text-[#0E0F12] border-[#E11D48]';
            } else {
              cardStyle =
                'bg-[#16181D]/50 border-[#2A2D36]/60 text-[#6B7280]';
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
                          <div className="text-xs text-[#9CA3AF] pt-1.5 border-t border-[#2A2D36] mt-1.5 space-y-0.5">
                            <div>
                              <span className="font-semibold text-[#F3F4F6]">
                                {opt.meaningTh}
                              </span>
                            </div>
                            <div className="text-[#FBBF24]">
                              <span>{opt.meaning}</span>
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
                            <div className="text-base sm:text-lg font-medium leading-snug break-words text-[#F3F4F6]">
                              {opt.meaningTh || opt.meaning}
                            </div>
                            <div className="text-xs sm:text-sm font-normal text-[#FBBF24] break-words">
                              {opt.meaning}
                            </div>
                          </div>
                        ) : (
                          <div className="text-base sm:text-lg font-medium leading-snug break-words text-[#F3F4F6]">
                            {formatWordMeaning(opt, settings.meaningLanguage)}
                          </div>
                        )}
                        {isAnswered && (
                          <div className="text-xs text-[#9CA3AF] pt-1.5 border-t border-[#2A2D36] mt-1.5 space-y-0.5">
                            <div className="font-jp">
                              คำศัพท์:{' '}
                              <span className="font-bold text-[#F3F4F6]">
                                {opt.expression}
                              </span>
                              {opt.reading !== opt.expression && (
                                <span className="text-[#FB6542]"> ({opt.reading})</span>
                              )}
                              {opt.romaji && (
                                <span className="text-[#FBBF24] font-mono ml-1">
                                  [{opt.romaji}]
                                </span>
                              )}
                            </div>
                            {settings.meaningLanguage === 'TH' && (
                              <div className="text-[#FBBF24]">{opt.meaning}</div>
                            )}
                            {settings.meaningLanguage === 'EN' && (
                              <div className="text-[#9CA3AF]">{opt.meaningTh}</div>
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
                      className="p-1.5 rounded-lg bg-[#1F2229] hover:bg-[#2A2D36] text-[#9CA3AF] hover:text-[#D4AF37] transition-colors cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}

                  {isAnswered && isThisOptionCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0" />
                  )}
                  {isAnswered && isThisOptionSelected && !isThisOptionCorrect && (
                    <XCircle className="w-5 h-5 text-[#F43F5E] shrink-0" />
                  )}
                </div>
              </div>

              {/* After Answering: Bottom-Right "แสดงเพิ่มเติม" Button on every option card (clean, no links until clicked) */}
              {isAnswered && (
                <div className="pt-2 border-t border-[#2A2D36] flex items-center justify-end gap-2">
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
                        ? 'bg-[#16181D]/50 border-[#2A2D36]/60 text-[#6B7280] cursor-not-allowed select-none'
                        : isOptExpanded
                        ? 'bg-[#D4AF37] text-[#0E0F12] border-[#D4AF37] shadow-sm cursor-pointer'
                        : 'bg-[#1F2229] hover:bg-[#2A2D36] text-[#F3F4F6] border-[#2A2D36] cursor-pointer'
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
                  className="pt-2.5 border-t border-[#2A2D36] space-y-2.5 bg-[#0E0F12] -mx-1 p-3 rounded-xl"
                >
                  {/* 1. Red Confusable / Homophone Section FIRST */}
                  {soundConfusables.length > 0 && (
                    <div className="rounded-xl border border-[#F43F5E]/40 bg-[#330D17]/40 p-2.5 space-y-1.5">
                      <div className="text-xs font-bold text-[#FB7185] flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#FB7185] shrink-0" />
                        <span>พ้องเสียง / เสียงคล้าย</span>
                      </div>

                      <div className="space-y-1.5">
                        {soundConfusables.map((c) => (
                          <button
                            key={c.word.id}
                            type="button"
                            onClick={() => openHoverWord(c.word.id)}
                            className="w-full text-left rounded-lg border border-[#F43F5E]/30 hover:border-[#F43F5E] bg-[#16181D] hover:bg-[#1F2229] px-2.5 py-2 flex items-center justify-between gap-2 transition-all cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#330D17] text-[#FB7185] border border-[#F43F5E]/40">
                                  {c.labelTh}
                                </span>
                                <span className="text-sm font-medium text-[#F3F4F6] font-jp">
                                  {c.word.expression}
                                </span>
                                <span className="text-xs text-[#FB6542] font-jp font-medium">
                                  ({c.word.reading})
                                </span>
                                {effectiveShowRomaji && c.word.romaji && (
                                  <span className="text-[11px] text-[#FBBF24] font-mono">
                                    [{c.word.romaji}]
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-normal text-[#9CA3AF] mt-0.5 break-words">
                                {formatWordMeaning(c.word, settings.meaningLanguage)}
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-[#FB7185] shrink-0">
                              ดู ➔
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. Similar Meaning Words ("ความหมายใกล้เคียง" e.g. ageru/morau/kureru, inochi/jinsei) */}
                  {(meaningSimilars.length > 0 || optGroupId) && (
                    <div className="rounded-xl border border-[#D4AF37]/40 bg-[#2E1F05]/40 p-2.5 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-bold text-[#FBBF24] flex items-center gap-1.5">
                          <span>ความหมายใกล้เคียง</span>
                        </div>

                        {optGroupId && (
                          <button
                            type="button"
                            onClick={() => openHoverGroup(optGroupId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#D4AF37] hover:bg-[#F3DA78] text-[#0E0F12] text-[11px] font-bold shadow-xs transition-all cursor-pointer"
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
                            className="w-full text-left rounded-lg border border-[#D4AF37]/30 hover:border-[#D4AF37] bg-[#16181D] hover:bg-[#1F2229] px-2.5 py-2 flex items-center justify-between gap-2 transition-all cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#2E1F05] text-[#FBBF24] border border-[#D97706]/40">
                                  {c.labelTh}
                                </span>
                                <span className="text-sm font-medium text-[#F3F4F6] font-jp">
                                  {c.word.expression}
                                </span>
                                <span className="text-xs text-[#FB6542] font-jp font-medium">
                                  ({c.word.reading})
                                </span>
                                {effectiveShowRomaji && c.word.romaji && (
                                  <span className="text-[11px] text-[#FBBF24] font-mono">
                                    [{c.word.romaji}]
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-normal text-[#9CA3AF] mt-0.5 break-words">
                                {formatWordMeaning(c.word, settings.meaningLanguage)}
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-[#D4AF37] shrink-0">
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
                      <div className="text-[11px] font-bold text-[#9CA3AF]">
                        คันจิ:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {opt.kanjiChars.map((ch) => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => openHoverKanji(ch)}
                            className="px-2.5 py-1.5 rounded-xl bg-[#16181D] hover:bg-[#1F2229] border border-[#2A2D36] hover:border-[#D4AF37]/50 text-xs font-medium text-[#F3F4F6] hover:text-[#D4AF37] transition-all cursor-pointer text-left"
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
              ? 'bg-[#062E22] border-[#10B981]/50'
              : 'bg-[#330D17] border-[#F43F5E]/50'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3">
            {isCorrect ? (
              <CheckCircle2 className="w-6 h-6 text-[#10B981] shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <XCircle className="w-6 h-6 text-[#F43F5E] shrink-0 mt-0.5 sm:mt-0" />
            )}

            <div className="space-y-1">
              <div className="text-sm sm:text-base font-bold text-[#F3F4F6]">
                {isCorrect ? 'ถูกต้อง!' : 'เฉลยคำที่ถูก:'}
              </div>
              <div className="text-xs sm:text-sm text-[#F3F4F6] font-jp">
                <span className="font-bold text-[#F3F4F6]">
                  {currentQuestion.targetWord.expression}
                </span>
                {currentQuestion.targetWord.reading !==
                  currentQuestion.targetWord.expression && (
                  <span className="text-[#FB6542] font-medium">
                    {' '}
                    【{currentQuestion.targetWord.reading}】
                  </span>
                )}
                {currentQuestion.targetWord.romaji && (
                  <span className="text-[#FBBF24] font-mono font-semibold ml-1">
                    [{currentQuestion.targetWord.romaji}]
                  </span>
                )}{' '}
                —{' '}
                <span className="font-sans font-medium text-[#F3F4F6]">
                  {currentQuestion.targetWord.meaningTh}
                </span>{' '}
                <span className="font-sans text-[#FBBF24]">
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
                className="px-4 py-2.5 rounded-xl bg-[#1F2229] hover:bg-[#2A2D36] border border-[#2A2D36] text-[#F3F4F6] text-xs sm:text-sm font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Flag className="w-4 h-4" />
                จบ / ดูสรุป
              </button>
            )}

            <button
              type="button"
              onClick={onNextQuestion}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F3DA78] to-[#C59B27] hover:brightness-110 text-slate-950 font-bold text-sm shadow-lg shadow-[#D4AF37]/15 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isLastQuestion ? 'ดูสรุป' : 'ข้อต่อไป (Enter)'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Live Level Mix Tracker Footer */}
      <div className="rounded-2xl border border-[#2A2D36] bg-[#16181D] px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#9CA3AF]">
        <span>ระดับคำที่ออก ({totalSeenSoFar} ข้อ):</span>
        <div className="flex flex-wrap items-center gap-2">
          {(['N5', 'N4', 'N3', 'N2', 'N1'] as JLPTLevel[]).map((lvl) => {
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
