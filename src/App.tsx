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
      settings.categoryFilter
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
      settings.categoryFilter
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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-100">
        <Loader2 className="w-10 h-10 text-rose-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold">กำลังโหลดคลังคำศัพท์และคลังคันจิ JLPT N5 – N1...</h2>
        <p className="text-sm text-slate-400 mt-1">
          กำลังเตรียมข้อมูลคำศัพท์กว่า 7,900 คำ และคันจิเชื่อมโยง 1,967 ตัว (ภาษาไทย & อังกฤษ)
        </p>
      </div>
    );
  }

  if (error || !db) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-100">
        <div className="max-w-md rounded-3xl border border-rose-500/40 bg-slate-900 p-6 space-y-4">
          <h2 className="text-lg font-bold text-rose-400">ไม่สามารถโหลดข้อมูลได้</h2>
          <p className="text-sm text-slate-300">{error}</p>
          <button
            type="button"
            onClick={fetchDatabase}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-sm font-bold cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            ลองใหม่อีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-x-hidden">
      {/* Subtle decorative background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl" />
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
