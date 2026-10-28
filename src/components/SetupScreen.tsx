import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Flame,
  Globe,
  Languages,
  Layers,
  Play,
  Shuffle,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  JLPTLevel,
  KanjiDatabase,
  LevelWeights,
  MeaningLanguage,
  QuizMode,
  QuizSettings,
  WordCategory,
} from '../types';
import {
  DEFAULT_LEVEL_WEIGHTS,
  JLPT_LEVELS,
  LEVEL_METADATA,
  VocabDatabase,
  WORD_CATEGORIES,
  WORD_CATEGORY_META,
} from '../utils/vocabData';
import { LevelDistributionPanel } from './LevelDistributionPanel';
import { JapaneseText } from './JapaneseText';

interface SetupScreenProps {
  settings: QuizSettings;
  db: VocabDatabase;
  kanjiDb: KanjiDatabase;
  dataSource: 'local' | 'github';
  onUpdateSettings: (partial: Partial<QuizSettings>) => void;
  onStartQuiz: () => void;
  onOpenExplorer: (tab?: 'VOCAB' | 'KANJI') => void;
}

const LANGUAGE_OPTIONS: {
  value: MeaningLanguage;
  label: string;
}[] = [
  { value: 'TH', label: '🇹🇭 ไทย' },
  { value: 'EN', label: '🇬🇧 English' },
  { value: 'BOTH', label: '🇹🇭+🇬🇧 ไทย + EN' },
];

export const SetupScreen: React.FC<SetupScreenProps> = ({
  settings,
  db,
  kanjiDb,
  onUpdateSettings,
  onStartQuiz,
  onOpenExplorer,
}) => {
  const totalWordsCount = JLPT_LEVELS.reduce(
    (sum, lvl) => sum + (db[lvl]?.length || 0),
    0
  );
  const totalKanjiCount = Object.keys(kanjiDb).length;

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const activeLevels = useMemo(() => {
    const list = JLPT_LEVELS.filter(
      (lvl) => (settings.customWeights[lvl] || 0) > 0
    );
    return list.length > 0 ? list : [settings.selectedLevel];
  }, [settings.customWeights, settings.selectedLevel]);

  const hasCategoryFilter = Boolean(
    settings.selectedCategories &&
      settings.selectedCategories.length > 0 &&
      settings.selectedCategories.length < WORD_CATEGORIES.length
  );

  const activeQuizWordsCount = useMemo(() => {
    return activeLevels.reduce((sum, lvl) => {
      const words = db[lvl] || [];
      if (!hasCategoryFilter) return sum + words.length;
      return (
        sum +
        words.filter((w) =>
          settings.selectedCategories!.includes(w.category)
        ).length
      );
    }, 0);
  }, [db, activeLevels, hasCategoryFilter, settings.selectedCategories]);

  const handleToggleCategory = (cat: WordCategory) => {
    const current = settings.selectedCategories || [];
    const isFiltered =
      current.length > 0 && current.length < WORD_CATEGORIES.length;

    if (!isFiltered) {
      // Currently all categories are active; clicking one selects ONLY this one!
      onUpdateSettings({ selectedCategories: [cat] });
    } else {
      if (current.includes(cat)) {
        const next = current.filter((c) => c !== cat);
        onUpdateSettings({ selectedCategories: next.length > 0 ? next : [] });
      } else {
        const next = [...current, cat];
        onUpdateSettings({
          selectedCategories:
            next.length === WORD_CATEGORIES.length ? [] : next,
        });
      }
    }
  };

  const handleSelectLevel = (level: JLPTLevel) => {
    onUpdateSettings({
      selectedLevel: level,
      customWeights: { ...DEFAULT_LEVEL_WEIGHTS[level] },
      useSmartMix: true,
    });
  };

  const handleChangeWeights = (weights: LevelWeights, isSmartMix: boolean) => {
    onUpdateSettings({
      customWeights: weights,
      useSmartMix: isSmartMix,
    });
  };

  const formatSampleJP = (kanji: string, hira: string, rom: string) => {
    const parts = [kanji];
    if (settings.showHiragana) parts.push(`(${hira})`);
    if (settings.showRomaji) parts.push(`[${rom}]`);
    return parts.join(' ');
  };

  const langName =
    settings.meaningLanguage === 'TH'
      ? 'ไทย'
      : settings.meaningLanguage === 'EN'
      ? 'EN'
      : 'ไทย+EN';

  const sampleMeaningMeet =
    settings.meaningLanguage === 'TH'
      ? 'พบ, เจอ'
      : settings.meaningLanguage === 'EN'
      ? 'to meet, to see'
      : 'พบ, เจอ (to meet)';

  const sampleMeaningPromise =
    settings.meaningLanguage === 'TH'
      ? 'สัญญา, การนัดหมาย'
      : settings.meaningLanguage === 'EN'
      ? 'promise, arrangement'
      : 'สัญญา (promise)';

  const modeOptions: {
    mode: QuizMode;
    title: string;
    icon: React.ReactNode;
    examplePrompt: string;
    exampleAnswer: string;
  }[] = [
    {
      mode: 'EN_TO_JA',
      title: `ความหมาย (${langName}) ➔ ญี่ปุ่น`,
      icon: <Languages className="w-4 h-4 text-rose-400" />,
      examplePrompt: sampleMeaningMeet,
      exampleAnswer: formatSampleJP('会う', 'あう', 'au'),
    },
    {
      mode: 'JA_TO_EN',
      title: `ญี่ปุ่น ➔ ความหมาย (${langName})`,
      icon: <Sparkles className="w-4 h-4 text-sky-400" />,
      examplePrompt: formatSampleJP('約束', 'やくそく', 'yakusoku'),
      exampleAnswer: sampleMeaningPromise,
    },
    {
      mode: 'MIXED',
      title: 'โหมดผสม',
      icon: <Shuffle className="w-4 h-4 text-amber-400" />,
      examplePrompt: 'สุ่มสลับทั้ง 2 รูปแบบ',
      exampleAnswer: `${langName} ⇄ ญี่ปุ่น`,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-5">
      {/* Compact Hero Header */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/40 p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>JLPT N5 – N1</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            ทายคำศัพท์ภาษาญี่ปุ่น{' '}
            <span className="bg-gradient-to-r from-rose-400 via-amber-300 to-sky-400 bg-clip-text text-transparent">
              JLPT N5 – N1
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenExplorer('VOCAB')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-700 bg-slate-800/90 hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-bold transition-all cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-rose-400" />
            คลังคำศัพท์ ({totalWordsCount.toLocaleString()})
          </button>

          <button
            type="button"
            onClick={() => onOpenExplorer('KANJI')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-xs sm:text-sm font-bold transition-all cursor-pointer"
          >
            <Layers className="w-4 h-4 text-amber-400" />
            คลังคันจิ ({totalKanjiCount.toLocaleString()})
          </button>
        </div>
      </div>

      {/* 1. Select JLPT Level */}
      <section className="space-y-3">
        <h2 className="text-sm sm:text-base font-bold text-white px-1">
          1. เลือกระดับ JLPT
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {JLPT_LEVELS.map((lvl) => {
            const meta = LEVEL_METADATA[lvl];
            const isSelected = settings.selectedLevel === lvl;
            const count = db[lvl]?.length || 0;

            return (
              <button
                key={lvl}
                type="button"
                onClick={() => handleSelectLevel(lvl)}
                className={`text-left rounded-2xl p-3.5 border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? `bg-gradient-to-b ${meta.bgClass} ${meta.borderClass} ring-2 ring-rose-500/50 shadow-lg`
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className={`text-2xl font-extrabold tracking-tight ${
                        isSelected ? 'text-white' : meta.colorClass
                      }`}
                    >
                      {lvl}
                    </span>
                    <div className="text-[11px] text-slate-400">
                      {meta.subtitle}
                    </div>
                  </div>
                  <span
                    className={`font-jp text-xs font-bold px-2 py-0.5 rounded-lg border ${meta.badgeClass}`}
                  >
                    {meta.kanjiBadge}
                  </span>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">{count.toLocaleString()} คำ</span>
                  <span className="text-[11px] font-semibold text-rose-300/90">
                    {meta.mixSummary.split('•')[0]}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <LevelDistributionPanel
          selectedLevel={settings.selectedLevel}
          weights={settings.customWeights}
          useSmartMix={settings.useSmartMix}
          onChangeWeights={handleChangeWeights}
        />
      </section>

      {/* 2. Language & Reading Aids (Side-by-side compact cards) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Meaning Language */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Globe className="w-4 h-4 text-sky-400" />
            <span>2. ภาษาคำแปล</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = settings.meaningLanguage === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdateSettings({ meaningLanguage: opt.value })}
                  className={`rounded-xl py-2.5 px-3 text-xs sm:text-sm font-extrabold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    active
                      ? 'bg-sky-500/20 border-sky-500 text-white shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reading Aids (Hiragana & Romaji) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex items-center justify-between gap-3">
          <div className="space-y-2.5 flex-1">
            <div className="text-sm font-bold text-white">
              3. ตัวช่วยอ่าน (Hiragana / Romaji)
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ showHiragana: !settings.showHiragana })
                }
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  settings.showHiragana
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {settings.showHiragana ? (
                  <Eye className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span>Hiragana</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ showRomaji: !settings.showRomaji })
                }
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  settings.showRomaji
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {settings.showRomaji ? (
                  <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span>Romaji</span>
              </button>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
            <JapaneseText
              expression="図書館"
              reading="としょかん"
              romaji="toshokan"
              showHiragana={settings.showHiragana}
              showRomaji={settings.showRomaji}
              size="sm"
            />
          </div>
        </div>
      </section>

      {/* 4. Select Quiz Mode */}
      <section className="space-y-2.5">
        <h2 className="text-sm sm:text-base font-bold text-white px-1">
          4. โหมดคำถาม
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {modeOptions.map((item) => {
            const isSelected = settings.quizMode === item.mode;
            return (
              <button
                key={item.mode}
                type="button"
                onClick={() => onUpdateSettings({ quizMode: item.mode })}
                className={`text-left rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-gradient-to-br from-rose-500/15 via-slate-900 to-slate-900 border-rose-500/60 ring-2 ring-rose-500/40 shadow-lg'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700">
                      {item.icon}
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      {item.title}
                    </h3>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                </div>

                <div className="text-xs space-y-1 bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">โจทย์:</span>
                    <span className="font-semibold text-slate-200 font-jp truncate">
                      {item.examplePrompt}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">ตอบ:</span>
                    <span className="font-semibold text-rose-300 font-jp truncate">
                      {item.exampleAnswer}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 5. Advanced Settings (ตั้งค่าขั้นสูง: กรองเฉพาะประเภทคำ) */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-800/40 transition-colors cursor-pointer"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Sliders className="w-4 h-4 text-rose-400" />
            <span className="text-sm sm:text-base font-bold text-white">
              ตั้งค่าขั้นสูง
            </span>
            {hasCategoryFilter ? (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                กรอง {settings.selectedCategories!.length} ประเภทคำ
              </span>
            ) : (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                ทุกประเภทคำ
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium shrink-0">
            <span>{isAdvancedOpen ? 'ซ่อน' : 'แสดง'}</span>
            {isAdvancedOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </button>

        {isAdvancedOpen && (
          <div className="p-4 pt-2 border-t border-slate-800/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-200">
                  เลือกประเภทคำศัพท์ (Part of Speech)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  จิ้มเลือกประเภทคำที่ต้องการให้ออกในแบบฝึกหัด (เลือกได้มากกว่า 1 ประเภท):
                </p>
              </div>

              <button
                type="button"
                onClick={() => onUpdateSettings({ selectedCategories: [] })}
                className={`text-xs px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                  !hasCategoryFilter
                    ? 'bg-rose-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                เลือกทุกประเภท
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {WORD_CATEGORIES.map((cat) => {
                const meta = WORD_CATEGORY_META[cat];
                const isSelected =
                  !hasCategoryFilter ||
                  (settings.selectedCategories &&
                    settings.selectedCategories.includes(cat));

                const countInActiveLevels = activeLevels.reduce(
                  (sum, lvl) =>
                    sum +
                    (db[lvl] || []).filter((w) => w.category === cat).length,
                  0
                );

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleToggleCategory(cat)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-slate-800/90 border-rose-500/60 ring-1 ring-rose-500/40 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-500 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-xs sm:text-sm font-bold ${
                            isSelected ? 'text-white' : 'text-slate-400'
                          }`}
                        >
                          {meta.labelTh}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          ({meta.labelEn})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {countInActiveLevels.toLocaleString()} คำ
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
                        isSelected
                          ? 'bg-rose-500 border-rose-400 text-slate-950'
                          : 'border-slate-700 bg-slate-900 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Start CTA Button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onStartQuiz}
          disabled={activeQuizWordsCount === 0}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 hover:from-rose-400 hover:via-pink-400 hover:to-amber-400 text-slate-950 font-extrabold text-base sm:text-lg shadow-xl shadow-rose-500/20 hover:shadow-rose-500/35 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-5 h-5 fill-slate-950" />
          <span>
            เริ่มทายคำศัพท์ ({activeQuizWordsCount.toLocaleString()} คำ)
          </span>
        </button>
      </div>
    </div>
  );
};
