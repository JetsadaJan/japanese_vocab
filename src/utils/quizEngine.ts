import {
  JLPTLevel,
  LevelWeights,
  QuestionDirection,
  QuizMode,
  QuizQuestion,
  VocabWord,
  WordCategory,
} from '../types';
import { JLPT_LEVELS } from './constants';

export type VocabDatabase = Record<JLPTLevel, VocabWord[]>;

export function pickLevelByWeights(
  weights: LevelWeights,
  db: VocabDatabase,
  fallbackLevel: JLPTLevel
): JLPTLevel {
  const entries = JLPT_LEVELS.map((lvl) => ({
    level: lvl,
    weight: Math.max(0, weights[lvl] || 0),
  })).filter((e) => e.weight > 0 && db[e.level].length > 0);

  if (entries.length === 0) {
    return fallbackLevel;
  }

  const totalWeight = entries.reduce((acc, item) => acc + item.weight, 0);
  let randomVal = Math.random() * totalWeight;

  for (const entry of entries) {
    randomVal -= entry.weight;
    if (randomVal <= 0) {
      return entry.level;
    }
  }

  return entries[entries.length - 1].level;
}

const EN_STOPWORDS = new Set([
  'to',
  'a',
  'an',
  'the',
  'of',
  'in',
  'on',
  'at',
  'for',
  'with',
  'by',
  'from',
  'up',
  'out',
  'into',
  'over',
  'after',
  'under',
  'be',
  'become',
  'make',
  'do',
  'get',
  'take',
  'give',
  'have',
  'go',
  'come',
  'something',
  'someone',
  'somebody',
  'one',
  'ones',
  'person',
  'thing',
  'things',
  'way',
  'place',
  'time',
  'state',
  'act',
  'making',
  'doing',
  'being',
  'getting',
  'having',
  'counter',
  'prefix',
  'suffix',
]);

function extractEnglishMeaningTokens(meaning: string): Set<string> {
  const cleaned = meaning
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z\s,;/-]/g, ' ');

  const tokens = new Set<string>();

  for (const part of cleaned.split(/[,;/]/)) {
    const phrase = part
      .trim()
      .replace(/^(to|a|an|the|be|become)\s+/i, '')
      .trim();
    if (phrase.length >= 2 && !EN_STOPWORDS.has(phrase)) {
      tokens.add(phrase);
    }
  }

  for (const word of cleaned.split(/[\s,;/-]+/)) {
    const w = word.trim();
    if (w.length >= 4 && !EN_STOPWORDS.has(w)) {
      tokens.add(w);
    }
  }

  return tokens;
}

function extractThaiMeaningTokens(meaningTh: string): Set<string> {
  const cleaned = meaningTh
    .replace(/\([^)]*\)/g, '')
    .replace(/（[^）]*）/g, '')
    .trim();

  const tokens = new Set<string>();

  for (const part of cleaned.split(/[,;/、]/)) {
    const raw = part.trim();
    if (!raw) continue;
    tokens.add(raw);

    const stripped = raw
      .replace(
        /^(การ|ความ|อย่าง|ที่|คน|ผู้|คำอุปสรรค|คำปัจจัย|ลักษณนามนับ|ลักษณนามสำหรับ|ลักษณนาม)\s*/,
        ''
      )
      .trim();
    if (stripped.length >= 2) {
      tokens.add(stripped);
    }
  }

  return tokens;
}

export function areWordsTooSimilar(wordA: VocabWord, wordB: VocabWord): boolean {
  if (wordA.id === wordB.id) return true;
  if (wordA.expression === wordB.expression) return true;
  if (wordA.reading === wordB.reading) return true;

  const enA = wordA.meaning.toLowerCase().trim();
  const enB = wordB.meaning.toLowerCase().trim();
  if (enA === enB) return true;

  const thA = wordA.meaningTh.trim();
  const thB = wordB.meaningTh.trim();
  if (thA === thB) return true;

  const thTokensA = extractThaiMeaningTokens(wordA.meaningTh);
  const thTokensB = extractThaiMeaningTokens(wordB.meaningTh);
  for (const tA of thTokensA) {
    if (thTokensB.has(tA)) return true;
    if (tA.length >= 3) {
      for (const tB of thTokensB) {
        if (tB.length >= 3 && (tA.includes(tB) || tB.includes(tA))) {
          return true;
        }
      }
    }
  }

  const enTokensA = extractEnglishMeaningTokens(wordA.meaning);
  const enTokensB = extractEnglishMeaningTokens(wordB.meaning);
  for (const eA of enTokensA) {
    if (enTokensB.has(eA)) return true;
  }

  return false;
}

export function generateQuizQuestion(
  db: VocabDatabase,
  weights: LevelWeights,
  selectedLevel: JLPTLevel,
  quizMode: QuizMode,
  usedWordIds: Set<string>,
  categoryFilter?: WordCategory | 'ALL'
): QuizQuestion {
  const chosenLevel = pickLevelByWeights(weights, db, selectedLevel);
  let levelPool = db[chosenLevel].length > 0 ? db[chosenLevel] : db[selectedLevel];

  // Apply Category / Part of Speech filter if requested
  if (categoryFilter && categoryFilter !== 'ALL') {
    const filtered = levelPool.filter((w) => w.category === categoryFilter);
    if (filtered.length > 0) {
      levelPool = filtered;
    }
  }

  let availableTargets = levelPool.filter((w) => !usedWordIds.has(w.id));
  if (availableTargets.length === 0) {
    availableTargets = levelPool;
  }

  const targetWord = availableTargets[Math.floor(Math.random() * availableTargets.length)];

  const direction: QuestionDirection =
    quizMode === 'MIXED'
      ? Math.random() < 0.5
        ? 'EN_TO_JA'
        : 'JA_TO_EN'
      : quizMode;

  const sameLevelSameCategoryPool = (db[chosenLevel] || db[selectedLevel]).filter(
    (w) => w.category === targetWord.category && w.id !== targetWord.id
  );

  const selectedOptions: VocabWord[] = [targetWord];

  const shuffleArray = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const shuffledSameCat = shuffleArray(sameLevelSameCategoryPool);
  for (const candidate of shuffledSameCat) {
    if (selectedOptions.length >= 4) break;
    const conflict = selectedOptions.some((existing) =>
      areWordsTooSimilar(existing, candidate)
    );
    if (!conflict) {
      selectedOptions.push(candidate);
    }
  }

  if (selectedOptions.length < 4) {
    for (const candidate of shuffledSameCat) {
      if (selectedOptions.length >= 4) break;
      const alreadyPicked = selectedOptions.some(
        (existing) =>
          existing.id === candidate.id ||
          existing.expression === candidate.expression ||
          existing.meaningTh.trim() === candidate.meaningTh.trim() ||
          existing.meaning.toLowerCase().trim() === candidate.meaning.toLowerCase().trim()
      );
      if (!alreadyPicked) {
        selectedOptions.push(candidate);
      }
    }
  }

  if (selectedOptions.length < 4) {
    const shuffledLevel = shuffleArray(levelPool);
    for (const candidate of shuffledLevel) {
      if (selectedOptions.length >= 4) break;
      if (!selectedOptions.some((existing) => areWordsTooSimilar(existing, candidate))) {
        selectedOptions.push(candidate);
      }
    }
  }

  const allOptions = shuffleArray(selectedOptions);
  const correctIndex = allOptions.findIndex((opt) => opt.id === targetWord.id);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    direction,
    targetWord,
    options: allOptions,
    correctIndex,
  };
}
