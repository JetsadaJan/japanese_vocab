import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Flame,
  Globe,
  RotateCcw,
  Settings,
  Volume2,
  XCircle,
} from 'lucide-react';
import {
  AnswerRecord,
  JLPTLevel,
  KanjiDatabase,
  MeaningLanguage,
  QuizSettings,
} from '../types';
import {
  LEVEL_METADATA,
  WORD_CATEGORY_META,
  formatKanjiLinkLabel,
  formatWordMeaning,
  speakJapanese,
} from '../utils/vocabData';

interface SummaryScreenProps {
  settings: QuizSettings;
  history: AnswerRecord[];
  kanjiDb: KanjiDatabase;
  onChangeLanguage: (lang: MeaningLanguage) => void;
  onPlayAgain: () => void;
  onBackToSetup: () => void;
  onOpenKanji?: (kanjiChar: string) => void;
}

export const SummaryScreen: React.FC<SummaryScreenProps> = ({
  settings,
  history,
  kanjiDb,
  onChangeLanguage,
  onPlayAgain,
  onBackToSetup,
  onOpenKanji,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'WRONG' | 'CORRECT'>('ALL');

  const total = history.length;
  const correctCount = history.filter((h) => h.isCorrect).length;
  const wrongCount = total - correctCount;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  let bestStreak = 0;
  let currentStreak = 0;
  history.forEach((h) => {
    if (h.isCorrect) {
      currentStreak++;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  });

  const avgTimeSec =
    total > 0
      ? (
          history.reduce((sum, h) => sum + h.timeSpentMs, 0) /
          total /
          1000
        ).toFixed(1)
      : '0.0';

  // Breakdown by JLPT Level
  const levelStats: Record<
    JLPTLevel,
    { total: number; correct: number }
  > = {
    N1: { total: 0, correct: 0 },
    N2: { total: 0, correct: 0 },
    N3: { total: 0, correct: 0 },
    N4: { total: 0, correct: 0 },
    N5: { total: 0, correct: 0 },
  };

  history.forEach((h) => {
    const lvl = h.question.targetWord.level;
    levelStats[lvl].total++;
    if (h.isCorrect) levelStats[lvl].correct++;
  });

  const filteredHistory = history.filter((h) => {
    if (filter === 'WRONG') return !h.isCorrect;
    if (filter === 'CORRECT') return h.isCorrect;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* Main Score Hero */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/40 p-6 sm:p-8 shadow-2xl text-center space-y-5">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 mx-auto">
          <Award className="w-9 h-9" />
        </div>

        <div className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-wider text-rose-400">
            สรุปผลการทดสอบระดับ {settings.selectedLevel}
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white">
            {accuracy}% ความแม่นยำ
          </h1>
          <p className="text-sm text-slate-300">
            ตอบถูก {correctCount} ข้อ จากทั้งหมด {total} ข้อ
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-3.5">
            <div className="text-xs text-slate-400">ตอบถูก</div>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 mt-0.5">
              {correctCount} / {total}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-3.5">
            <div className="text-xs text-slate-400">ตอบผิด</div>
            <div className="text-xl sm:text-2xl font-extrabold text-rose-400 mt-0.5">
              {wrongCount} ข้อ
            </div>
          </div>

          <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-3.5">
            <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Streak สูงสุด
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-amber-300 mt-0.5">
              {bestStreak} ข้อติด
            </div>
          </div>

          <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-3.5">
            <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              เวลาเฉลี่ย/ข้อ
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-sky-300 mt-0.5">
              {avgTimeSec} วินาที
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onPlayAgain}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-rose-500/20 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            เล่นอีกรอบด้วยตั้งค่าเดิม
          </button>

          <button
            type="button"
            onClick={onBackToSetup}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-sm border border-slate-700 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            เปลี่ยนระดับ / ตั้งค่าใหม่
          </button>
        </div>
      </div>

      {/* Breakdown by Level */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
        <h2 className="text-sm sm:text-base font-bold text-white">
          สถิติแยกตามระดับคำศัพท์ที่สุ่มออกมาในรอบนี้
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {(['N5', 'N4', 'N3', 'N2', 'N1'] as JLPTLevel[]).map((lvl) => {
            const st = levelStats[lvl];
            const meta = LEVEL_METADATA[lvl];
            const sharePct = total > 0 ? Math.round((st.total / total) * 100) : 0;
            const lvlAcc =
              st.total > 0 ? Math.round((st.correct / st.total) * 100) : 0;

            return (
              <div
                key={lvl}
                className={`rounded-xl p-3 border ${
                  st.total > 0
                    ? meta.badgeClass
                    : 'bg-slate-950/40 border-slate-800/60 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold">{lvl}</span>
                  <span className="text-xs font-semibold">{sharePct}% ของโจทย์</span>
                </div>
                <div className="text-xs mt-1.5">
                  {st.total > 0 ? (
                    <>
                      ถูก{' '}
                      <span className="font-bold">
                        {st.correct}/{st.total}
                      </span>{' '}
                      ข้อ ({lvlAcc}%)
                    </>
                  ) : (
                    'ไม่มีในรอบนี้'
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Question Review List */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-white">
            เฉลยและทบทวนคำศัพท์ในรอบนี้ ({filteredHistory.length} คำ)
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            {/* Language Switcher */}
            <div className="inline-flex items-center rounded-xl bg-slate-950 p-0.5 border border-slate-800">
              <Globe className="w-3.5 h-3.5 text-sky-400 ml-2 mr-1" />
              {(['TH', 'EN', 'BOTH'] as MeaningLanguage[]).map((lang) => {
                const active = settings.meaningLanguage === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => onChangeLanguage(lang)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                      active
                        ? 'bg-sky-500 text-slate-950'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lang === 'TH' ? '🇹🇭 ไทย' : lang === 'EN' ? '🇬🇧 EN' : 'ไทย+EN'}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  filter === 'ALL'
                    ? 'bg-rose-500 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                ทั้งหมด ({total})
              </button>
              <button
                type="button"
                onClick={() => setFilter('WRONG')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  filter === 'WRONG'
                    ? 'bg-rose-500 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                ตอบผิด ({wrongCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('CORRECT')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  filter === 'CORRECT'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                ตอบถูก ({correctCount})
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {filteredHistory.map((item, idx) => {
            const word = item.question.targetWord;
            const userChoice = item.question.options[item.selectedOptionIndex];
            const meta = LEVEL_METADATA[word.level];

            return (
              <div
                key={`${item.question.id}-${idx}`}
                className={`rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  item.isCorrect
                    ? 'bg-slate-950/60 border-slate-800'
                    : 'bg-rose-950/20 border-rose-500/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  {item.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-1" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-1" />
                  )}

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${meta.badgeClass}`}
                      >
                        {word.level}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${WORD_CATEGORY_META[word.category].badgeClass}`}
                      >
                        {WORD_CATEGORY_META[word.category].labelTh}
                      </span>
                      <span className="text-lg sm:text-xl font-extrabold text-white font-jp">
                        {word.expression}
                      </span>
                      {word.reading !== word.expression && (
                        <span className="text-sm text-rose-300 font-jp font-semibold">
                          【{word.reading}】
                        </span>
                      )}
                      {word.romaji && (
                        <span className="text-xs sm:text-sm text-amber-300 font-mono font-semibold">
                          [{word.romaji}]
                        </span>
                      )}
                    </div>

                    {settings.meaningLanguage === 'BOTH' ? (
                      <div className="text-xs sm:text-sm space-y-0.5 pt-0.5">
                        <div className="text-white font-semibold">
                          🇹🇭 {word.meaningTh || word.meaning}
                        </div>
                        <div className="text-sky-300/90">
                          🇬🇧 {word.meaning}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs sm:text-sm text-slate-200">
                        ความหมาย:{' '}
                        <span className="font-semibold text-white">
                          {formatWordMeaning(word, settings.meaningLanguage)}
                        </span>
                      </div>
                    )}

                    {!item.isCorrect && userChoice && (
                      <div className="text-xs text-rose-300/90">
                        คำตอบที่คุณเลือก:{' '}
                        <span className="font-semibold font-jp">
                          {item.question.direction === 'EN_TO_JA'
                            ? `${userChoice.expression} (${formatWordMeaning(
                                userChoice,
                                settings.meaningLanguage
                              )})`
                            : `${formatWordMeaning(
                                userChoice,
                                settings.meaningLanguage
                              )} (${userChoice.expression})`}
                        </span>
                      </div>
                    )}

                    {word.kanjiChars.length > 0 && onOpenKanji && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[11px] text-slate-500">เชื่อมโยงคันจิ:</span>
                        {word.kanjiChars.map((ch) => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => onOpenKanji(ch)}
                            className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 text-[11px] font-jp font-bold text-amber-200 hover:text-rose-200 transition-colors cursor-pointer"
                          >
                            {formatKanjiLinkLabel(ch, kanjiDb, settings.meaningLanguage)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => speakJapanese(word.reading || word.expression)}
                  className="self-end sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer shrink-0"
                >
                  <Volume2 className="w-4 h-4 text-rose-400" />
                  ฟังเสียง
                </button>
              </div>
            );
          })}

          {filteredHistory.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-400">
              ไม่มีรายการในหมวดหมู่นี้
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
