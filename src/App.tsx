import React, { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import {
  AnswerRecord,
  KanjiDatabase,
  MeaningLanguage,
  QuizQuestion,
  QuizSettings,
  VocabWord,
} from './types';
import {
  DEFAULT_LEVEL_WEIGHTS,
  VocabDatabase,
  generateQuizQuestion,
  loadAllVocabData,
} from './utils/vocabData';
import { ConfusableIndex } from './utils/confusableWords';
import { SetupScreen } from './components/SetupScreen';
import { QuizScreen } from './components/QuizScreen';
import { SummaryScreen } from './components/SummaryScreen';
import { WordExplorerModal } from './components/WordExplorerModal';

type ScreenState = 'SETUP' | 'QUIZ' | 'SUMMARY';

const STORAGE_KEY = 'jlpt_vocab_master_settings_v2';

const DEFAULT_SETTINGS: QuizSettings = {
  selectedLevel: 'N3',
  quizMode: 'MIXED',
  meaningLanguage: 'TH',
  showHiragana: true,
  showRomaji: false,
  sessionLength: 0,
  useSmartMix: true,
  customWeights: { ...DEFAULT_LEVEL_WEIGHTS.N3 },
  distractorSameLevelPrefer: true,
};

export function App() {
  const [db, setDb] = useState<VocabDatabase | null>(null);
  const [kanjiDb, setKanjiDb] = useState<KanjiDatabase>({});
  const [wordMap, setWordMap] = useState<Record<string, VocabWord>>({});
  const [confusableIndex, setConfusableIndex] =
    useState<ConfusableIndex | null>(null);
  const [dataSource, setDataSource] = useState<'local' | 'github'>('local');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<QuizSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_SETTINGS, ...parsed, sessionLength: 0 };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_SETTINGS;
  });

  const [screen, setScreen] = useState<ScreenState>('SETUP');
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [history, setHistory] = useState<AnswerRecord[]>([]);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [explorerInitialTab, setExplorerInitialTab] = useState<'VOCAB' | 'KANJI'>('VOCAB');
  const [explorerInitialKanji, setExplorerInitialKanji] = useState<string | null>(null);

  const usedWordIdsRef = useRef<Set<string>>(new Set());

  const fetchDatabase = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadAllVocabData();
      setDb(result.db);
      setKanjiDb(result.kanjiDb);
      setWordMap(result.wordMap);
      setConfusableIndex(result.confusableIndex);
      setDataSource(result.source);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'เกิดข้อผิดพลาดในการโหลดข้อมูลคำศัพท์ JLPT'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabase();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
  }, [settings]);

  const handleUpdateSettings = (partial: Partial<QuizSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const handleChangeLanguage = (meaningLanguage: MeaningLanguage) => {
    handleUpdateSettings({ meaningLanguage });
  };

  const handleOpenExplorer = (tab: 'VOCAB' | 'KANJI' = 'VOCAB') => {
    setExplorerInitialTab(tab);
    setExplorerInitialKanji(null);
    setIsExplorerOpen(true);
  };

  const handleOpenKanjiNode = (kanjiChar: string) => {
    setExplorerInitialTab('KANJI');
    setExplorerInitialKanji(kanjiChar);
    setIsExplorerOpen(true);
  };

  const handleStartQuiz = () => {
    if (!db) return;
    usedWordIdsRef.current = new Set();
    setHistory([]);
    setQuestionNumber(1);

    const firstQ = generateQuizQuestion(
      db,
      settings.customWeights,
      settings.selectedLevel,
      settings.quizMode,
      usedWordIdsRef.current,
      settings.categoryFilter,
      settings.selectedCategories,
      confusableIndex
    );
    usedWordIdsRef.current.add(firstQ.targetWord.id);
    setCurrentQuestion(firstQ);
    setScreen('QUIZ');
  };

  const handleSubmitAnswer = (selectedOptionIndex: number, timeSpentMs: number) => {
    if (!currentQuestion) return;
    const isCorrect = selectedOptionIndex === currentQuestion.correctIndex;
    const record: AnswerRecord = {
      question: currentQuestion,
      selectedOptionIndex,
      isCorrect,
      timeSpentMs,
    };
    setHistory((prev) => [...prev, record]);
  };

  const handleNextQuestion = () => {
    if (!db) return;

    if (settings.sessionLength > 0 && questionNumber >= settings.sessionLength) {
      setScreen('SUMMARY');
      return;
    }

    const nextQ = generateQuizQuestion(
      db,
      settings.customWeights,
      settings.selectedLevel,
      settings.quizMode,
      usedWordIdsRef.current,
      settings.categoryFilter,
      settings.selectedCategories,
      confusableIndex
    );
    usedWordIdsRef.current.add(nextQ.targetWord.id);
    setCurrentQuestion(nextQ);
    setQuestionNumber((prev) => prev + 1);
  };

  const handleFinishSession = () => {
    setScreen('SUMMARY');
  };

  const handleBackToSetup = () => {
    setScreen('SETUP');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#0E0F12] text-[#F3F4F6]">
        <div className="max-w-md w-full p-8 rounded-3xl border border-[#2A2D36] bg-[#16181D] shadow-2xl shadow-black/80 flex flex-col items-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#0E0F12] border border-[#2A2D36] flex items-center justify-center shadow-inner">
            <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg sm:text-xl font-bold text-[#F3F4F6]">
              กำลังโหลดคลังคำศัพท์และคลังคันจิ...
            </h2>
            <p className="text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
              กำลังเตรียมข้อมูลคำศัพท์ JLPT N5 – N1 และคันจิเชื่อมโยง (ภาษาไทย & English)
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !db) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#0E0F12] text-[#F3F4F6]">
        <div className="max-w-md rounded-3xl border border-[#F43F5E]/40 bg-[#16181D] p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#FB7185]">ไม่สามารถโหลดข้อมูลได้</h2>
          <p className="text-sm text-[#9CA3AF]">{error}</p>
          <button
            type="button"
            onClick={fetchDatabase}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#F3DA78] text-[#0E0F12] text-sm font-bold cursor-pointer transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            ลองใหม่อีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0E0F12] text-[#F3F4F6] relative overflow-x-hidden selection:bg-[#D4AF37]/30 selection:text-[#FDE047]">
      {/* Subtle decorative Kuro-urushi background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-[#D4AF37]/5 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 rounded-full bg-[#D4AF37]/4 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 rounded-full bg-[#D4AF37]/3 blur-3xl" />
      </div>

      {screen === 'SETUP' && (
        <SetupScreen
          settings={settings}
          db={db}
          kanjiDb={kanjiDb}
          dataSource={dataSource}
          onUpdateSettings={handleUpdateSettings}
          onStartQuiz={handleStartQuiz}
          onOpenExplorer={handleOpenExplorer}
        />
      )}

      {screen === 'QUIZ' && currentQuestion && confusableIndex && (
        <QuizScreen
          settings={settings}
          currentQuestion={currentQuestion}
          questionNumber={questionNumber}
          history={history}
          kanjiDb={kanjiDb}
          wordMap={wordMap}
          confusableIndex={confusableIndex}
          onToggleHiragana={() =>
            handleUpdateSettings({ showHiragana: !settings.showHiragana })
          }
          onToggleRomaji={() =>
            handleUpdateSettings({ showRomaji: !settings.showRomaji })
          }
          onChangeLanguage={handleChangeLanguage}
          onSubmitAnswer={handleSubmitAnswer}
          onNextQuestion={handleNextQuestion}
          onFinishSession={handleFinishSession}
          onBackToSetup={handleBackToSetup}
        />
      )}

      {screen === 'SUMMARY' && (
        <SummaryScreen
          settings={settings}
          history={history}
          kanjiDb={kanjiDb}
          onChangeLanguage={handleChangeLanguage}
          onPlayAgain={handleStartQuiz}
          onBackToSetup={handleBackToSetup}
          onOpenKanji={handleOpenKanjiNode}
        />
      )}

      {/* Data source attribution (required by the EDRDG licence and CC BY-SA 4.0) */}
      <footer className="w-full max-w-4xl mx-auto px-6 pt-4 pb-8 text-center text-[11px] leading-relaxed text-[#6B7280]">
        <p>
          This site uses the{' '}
          <a href="https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project" target="_blank" rel="noreferrer" className="underline hover:text-[#D4AF37]">JMdict</a>{' '}
          and{' '}
          <a href="https://www.edrdg.org/wiki/index.php/KANJIDIC_Project" target="_blank" rel="noreferrer" className="underline hover:text-[#D4AF37]">KANJIDIC</a>{' '}
          dictionary files. These files are the property of the{' '}
          <a href="https://www.edrdg.org/" target="_blank" rel="noreferrer" className="underline hover:text-[#D4AF37]">Electronic Dictionary Research and Development Group</a>, and are used in conformance with the Group's{' '}
          <a href="https://www.edrdg.org/edrdg/licence.html" target="_blank" rel="noreferrer" className="underline hover:text-[#D4AF37]">licence</a>.
        </p>
        <p className="mt-1">
          Frequency data from{' '}
          <a href="https://jiten.moe/frequency-dictionaries" target="_blank" rel="noreferrer" className="underline hover:text-[#D4AF37]">Jiten</a>
          . JLPT word lists from{' '}
          <a href="https://github.com/elzup/jlpt-word-list" target="_blank" rel="noreferrer" className="underline hover:text-[#D4AF37]">elzup/jlpt-word-list</a>
          {' '}(based on{' '}
          <a href="http://www.tanos.co.uk/jlpt/" target="_blank" rel="noreferrer" className="underline hover:text-[#D4AF37]">tanos.co.uk</a>
          ). Vocabulary data licensed under{' '}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer" className="underline hover:text-[#D4AF37]">CC BY-SA 4.0</a>
          .{' '}
          <a href="https://github.com/JetsadaJan/japanese_vocab/blob/main/THIRD_PARTY_NOTICES.md" target="_blank" rel="noreferrer" className="underline hover:text-[#D4AF37]">Full credits</a>
        </p>
      </footer>

      <WordExplorerModal
        isOpen={isExplorerOpen}
        onClose={() => setIsExplorerOpen(false)}
        db={db}
        kanjiDb={kanjiDb}
        wordMap={wordMap}
        confusableIndex={confusableIndex}
        initialLevel={settings.selectedLevel}
        initialTab={explorerInitialTab}
        initialKanji={explorerInitialKanji}
        meaningLanguage={settings.meaningLanguage}
        onChangeLanguage={handleChangeLanguage}
      />
    </div>
  );
}

export default App;
