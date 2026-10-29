export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export type QuizMode = 'EN_TO_JA' | 'JA_TO_EN' | 'MIXED';

export type QuestionDirection = 'EN_TO_JA' | 'JA_TO_EN';

export type MeaningLanguage = 'TH' | 'EN' | 'BOTH';

export type WordCategory =
  | 'NOUN'
  | 'VERB'
  | 'ADJECTIVE'
  | 'LOANWORD'
  | 'ADVERB_PHRASE'
  | 'AFFIX';

export type SessionLength = 10 | 20 | 30 | 50 | 0; // 0 = Endless mode

export interface VocabWord {
  id: string;
  expression: string;
  reading: string;
  romaji: string;
  meaning: string;
  meaningTh: string;
  tags: string;
  level: JLPTLevel;
  category: WordCategory;
  kanjiChars: string[];
  extraNote?: string;
}

export interface KanjiNode {
  character: string;
  onyomi: string[];
  kunyomi: string[];
  onyomiRomaji: string[];
  kunyomiRomaji: string[];
  meaningEn: string;
  meaningTh: string;
  strokes: number;
  level: JLPTLevel;
  relatedWordIds: string[];
  extraNote?: string;
}

export type KanjiDatabase = Record<string, KanjiNode>;

export type LevelWeights = Record<JLPTLevel, number>;

export type QuizTargetMode = 'ALL' | 'MISTAKES_ONLY';

export type QuizQuestionType = 'VOCAB' | 'KANJI';

export type ActiveGameMode =
  | 'VOCAB_ALL'
  | 'VOCAB_MISTAKES'
  | 'KANJI_ALL'
  | 'KANJI_MISTAKES';

export interface QuizSettings {
  selectedLevel: JLPTLevel;
  quizMode: QuizMode;
  quizTargetMode?: QuizTargetMode;
  activeGameMode?: ActiveGameMode;
  meaningLanguage: MeaningLanguage;
  showHiragana: boolean;
  showRomaji: boolean;
  sessionLength: SessionLength;
  useSmartMix: boolean;
  customWeights: LevelWeights;
  distractorSameLevelPrefer: boolean;
  categoryFilter?: WordCategory | 'ALL';
  selectedCategories?: WordCategory[];
}

export interface QuizQuestion {
  id: string;
  type?: QuizQuestionType;
  direction: QuestionDirection;
  targetWord: VocabWord;
  targetKanji?: KanjiNode;
  options: VocabWord[];
  kanjiOptions?: KanjiNode[];
  correctIndex: number;
  /** True when this question re-asks a word or kanji the learner previously answered wrong. */
  isReview?: boolean;
  /** Quiz target mode (e.g. MISTAKES_ONLY) */
  targetMode?: QuizTargetMode;
  /** Total questions in the session (for bounded sessions like mistakes only). */
  totalQuestions?: number;
}

export interface AnswerRecord {
  question: QuizQuestion;
  selectedOptionIndex: number;
  isCorrect: boolean;
  timeSpentMs: number;
}
