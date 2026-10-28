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
      <div className="rounded-3xl border border-[#2A2D36] bg-[#16181D] p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#2E1F05] border border-[#D97706]/60 text-[#FBBF24] text-xs font-semibold tag-luxury">
            <Flame className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>JLPT N5 – N1</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F3F4F6]">
            ทายคำศัพท์ภาษาญี่ปุ่น{' '}
            <span className="bg-gradient-to-r from-[#D4AF37] via-[#FDE047] to-[#E5C158] bg-clip-text text-transparent">
              JLPT N5 – N1
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenExplorer('VOCAB')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[#2A2D36] bg-[#1F2229] hover:bg-[#2A2D36] text-[#F3F4F6] text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-sm"
          >
            <BookOpen className="w-4 h-4 text-[#D4AF37]" />
            คลังคำศัพท์ ({totalWordsCount.toLocaleString()})
          </button>

          <button
            type="button"
            onClick={() => onOpenExplorer('KANJI')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[#D97706]/40 bg-[#2E1F05]/70 hover:bg-[#2E1F05] text-[#FBBF24] text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-sm"
          >
            <Layers className="w-4 h-4 text-[#D4AF37]" />
            คลังคันจิ ({totalKanjiCount.toLocaleString()})
          </button>
        </div>
      </div>

      {/* Start Quiz CTA Button (Quick Access at Top) */}
      <div>
        <button
          type="button"
          onClick={onStartQuiz}
          disabled={activeQuizWordsCount === 0}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F3DA78] to-[#C59B27] hover:from-[#E5C158] hover:via-[#FDE047] hover:to-[#D4AF37] text-[#0E0F12] font-black text-base sm:text-lg shadow-xl shadow-[#D4AF37]/20 hover:shadow-[#D4AF37]/35 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group active:scale-[0.99]"
        >
          <Play className="w-5 h-5 fill-[#0E0F12] group-hover:scale-110 transition-transform" />
          <span>
            เริ่มทายคำศัพท์ ({activeQuizWordsCount.toLocaleString()} คำ)
          </span>
        </button>
      </div>

      {/* Select JLPT Level */}
      <section className="space-y-3">
        <h2 className="text-sm sm:text-base font-bold text-[#F3F4F6] px-1">
          เลือกระดับ JLPT
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
                    ? `bg-gradient-to-b ${meta.bgClass} ${meta.borderClass} ring-2 ring-[#D4AF37]/50 shadow-lg`
                    : 'bg-[#16181D] border-[#2A2D36] hover:border-[#D4AF37]/40 hover:bg-[#1F2229]'
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
                    <div className="text-[11px] text-[#9CA3AF]">
                      {meta.subtitle}
                    </div>
                  </div>
                  <span
                    className={`font-jp text-xs font-bold px-2 py-0.5 rounded-lg border ${meta.badgeClass}`}
                  >
                    {meta.kanjiBadge}
                  </span>
                </div>

                <div className="mt-3 pt-2 border-t border-[#2A2D36] flex items-center justify-between text-xs">
                  <span className="text-[#9CA3AF]">{count.toLocaleString()} คำ</span>
                  <span className="text-[11px] font-semibold text-[#D4AF37]">
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

      {/* Language & Reading Aids (Side-by-side compact cards) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Meaning Language */}
        <div className="rounded-2xl border border-[#2A2D36] bg-[#16181D] p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#F3F4F6]">
            <Globe className="w-4 h-4 text-[#D4AF37]" />
            <span>ภาษาคำแปล</span>
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
                      ? 'bg-[#1F2229] border-[#D4AF37] text-[#F3F4F6] shadow-sm ring-1 ring-[#D4AF37]/40'
                      : 'bg-[#0E0F12] border-[#2A2D36] text-[#9CA3AF] hover:border-[#D4AF37]/40 hover:bg-[#1F2229]'
                  }`}
                >
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reading Aids (Hiragana & Romaji) */}
        <div className="rounded-2xl border border-[#2A2D36] bg-[#16181D] p-4 flex items-center justify-between gap-3">
          <div className="space-y-2.5 flex-1">
            <div className="text-sm font-bold text-[#F3F4F6]">
              ตัวช่วยอ่าน (Hiragana / Romaji)
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ showHiragana: !settings.showHiragana })
                }
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  settings.showHiragana
                    ? 'bg-[#062E22] border-[#059669] text-[#34D399]'
                    : 'bg-[#0E0F12] border-[#2A2D36] text-[#6B7280] hover:bg-[#1F2229]'
                }`}
              >
                {settings.showHiragana ? (
                  <Eye className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
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
                    ? 'bg-[#2E1F05] border-[#D97706] text-[#FBBF24]'
                    : 'bg-[#0E0F12] border-[#2A2D36] text-[#6B7280] hover:bg-[#1F2229]'
                }`}
              >
                {settings.showRomaji ? (
                  <Eye className="w-3.5 h-3.5 text-[#FBBF24] shrink-0" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
                )}
                <span>Romaji</span>
              </button>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-[#0E0F12] border border-[#2A2D36] shrink-0">
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

      {/* Select Quiz Mode */}
      <section className="space-y-2.5">
        <h2 className="text-sm sm:text-base font-bold text-[#F3F4F6] px-1">
          โหมดคำถาม
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
                    ? 'bg-[#1F2229] border-[#D4AF37]/70 ring-2 ring-[#D4AF37]/30 shadow-lg'
                    : 'bg-[#16181D] border-[#2A2D36] hover:border-[#D4AF37]/40 hover:bg-[#1F2229]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#0E0F12] border border-[#2A2D36]">
                      {item.icon}
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-[#F3F4F6]">
                      {item.title}
                    </h3>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  )}
                </div>

                <div className="text-xs space-y-1 bg-[#0E0F12]/80 px-3 py-2 rounded-xl border border-[#2A2D36]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#6B7280]">โจทย์:</span>
                    <span className="font-semibold text-[#F3F4F6] font-jp truncate">
                      {item.examplePrompt}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#6B7280]">ตอบ:</span>
                    <span className="font-semibold text-[#D4AF37] font-jp truncate">
                      {item.exampleAnswer}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Advanced Settings (ตั้งค่าขั้นสูง: กรองเฉพาะประเภทคำ) */}
      <section className="rounded-2xl border border-[#2A2D36] bg-[#16181D] overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-[#1F2229] transition-colors cursor-pointer"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Sliders className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-sm sm:text-base font-bold text-[#F3F4F6]">
              ตั้งค่าขั้นสูง
            </span>
            {hasCategoryFilter ? (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#2E1F05] text-[#FBBF24] border border-[#D97706]/60 font-bold tag-luxury">
                กรอง {settings.selectedCategories!.length} ประเภทคำ
              </span>
            ) : (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#0E0F12] text-[#6B7280] font-medium">
                ทุกประเภทคำ
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF] font-medium shrink-0">
            <span>{isAdvancedOpen ? 'ซ่อน' : 'แสดง'}</span>
            {isAdvancedOpen ? (
              <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
            )}
          </div>
        </button>

        {isAdvancedOpen && (
          <div className="p-4 pt-2 border-t border-[#2A2D36] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-[#F3F4F6]">
                เลือกประเภทคำศัพท์ (Part of Speech)
              </h4>

              <button
                type="button"
                onClick={() => onUpdateSettings({ selectedCategories: [] })}
                className={`text-xs px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                  !hasCategoryFilter
                    ? 'bg-[#D4AF37] text-[#0E0F12] shadow-sm'
                    : 'bg-[#0E0F12] hover:bg-[#1F2229] text-[#9CA3AF] border border-[#2A2D36]'
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
                        ? 'bg-[#1F2229] border-[#D4AF37]/60 ring-1 ring-[#D4AF37]/30 text-[#F3F4F6] shadow-md'
                        : 'bg-[#0E0F12] border-[#2A2D36] text-[#6B7280] hover:border-[#D4AF37]/30'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-xs sm:text-sm font-bold ${
                            isSelected ? 'text-[#F3F4F6]' : 'text-[#6B7280]'
                          }`}
                        >
                          {meta.labelTh}
                        </span>
                        <span className="text-[10px] text-[#6B7280]">
                          ({meta.labelEn})
                        </span>
                      </div>
                      <div className="text-[11px] text-[#9CA3AF] font-mono mt-0.5">
                        {countInActiveLevels.toLocaleString()} คำ
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
                        isSelected
                          ? 'bg-[#D4AF37] border-[#FDE047] text-[#0E0F12]'
                          : 'border-[#2A2D36] bg-[#0E0F12] text-transparent'
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
    </div>
  );
};
