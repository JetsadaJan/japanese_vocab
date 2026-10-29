import {
  JLPTLevel,
  LevelWeights,
  QuestionDirection,
  QuizMode,
  QuizQuestion,
  VocabWord,
  WordCategory,
} from '../types';
import { JLPT_LEVELS, WORD_CATEGORIES } from './constants';
import { ConfusableIndex, getConfusableWords } from './confusableWords';
import { wordKey } from './mistakeTracker';

export type VocabDatabase = Record<JLPTLevel, VocabWord[]>;

/**
 * Review options for re-asking words the learner previously got wrong.
 * - scores: review weight per word key (see mistakeTracker.wordKey)
 * - recentKeys: keys asked in the last few questions (cooldown, avoids back-to-back repeats)
 */
export interface ReviewOptions {
  scores: Record<string, number>;
  recentKeys: Set<string>;
}

/** Chance that a question is drawn from the review pool when eligible words exist (~40%). */
export const REVIEW_CHANCE = 0.4;

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
  categoryFilter?: WordCategory | 'ALL',
  selectedCategories?: WordCategory[],
  confusableIndex?: ConfusableIndex | null,
  review?: ReviewOptions | null,
  forcedTargetWord?: VocabWord | null
): QuizQuestion {
  // Apply Category / Part of Speech filter if requested
  const activeCategories =
    selectedCategories &&
    selectedCategories.length > 0 &&
    selectedCategories.length < WORD_CATEGORIES.length
      ? selectedCategories
      : categoryFilter && categoryFilter !== 'ALL'
      ? [categoryFilter]
      : null;

  // Review pass: if forcedTargetWord is provided, use it directly (e.g. MISTAKES_ONLY mode).
  // In normal mode:
  // "ผิดครั้งแรก % ที่จะออกมา เริ่มที่ 25% ผิดติดๆกัน 4 รอบ 100% (random ถ้ามีหลายตัวที่ผิดเท่ากัน priority คำที่ผิดมากๆก่อน)"
  let reviewTarget: VocabWord | null = forcedTargetWord || null;
  if (!reviewTarget && review && Object.keys(review.scores).length > 0) {
    const enabledLevels = JLPT_LEVELS.filter((lvl) => (weights[lvl] || 0) > 0);
    const levelsToSearch = enabledLevels.length > 0 ? enabledLevels : [selectedLevel];
    const candidates: { word: VocabWord; rating: number }[] = [];
    for (const lvl of levelsToSearch) {
      for (const w of db[lvl] || []) {
        const key = wordKey(w);
        const rating = review.scores[key];
        if (!rating || review.recentKeys.has(key)) continue;
        if (activeCategories && !activeCategories.includes(w.category)) continue;
        candidates.push({ word: w, rating });
      }
    }
    if (candidates.length > 0) {
      // Sort candidates by rating descending (highest rating first)
      candidates.sort((a, b) => b.rating - a.rating);
      const maxRating = candidates[0].rating;

      // Review chance: missed 1st time = 25%, 2 times = 50%, 3 times = 75%, 4+ consecutive times = 100%
      const reviewChance = Math.min(1.0, maxRating * 0.25);
      if (Math.random() < reviewChance) {
        // Random selection among candidates tied for the maximum rating tier
        const topTier = candidates.filter((c) => c.rating === maxRating);
        reviewTarget = topTier[Math.floor(Math.random() * topTier.length)].word;
      }
    }
  }

  const chosenLevel = reviewTarget
    ? reviewTarget.level
    : pickLevelByWeights(weights, db, selectedLevel);
  let levelPool = db[chosenLevel].length > 0 ? db[chosenLevel] : db[selectedLevel];

  if (activeCategories && activeCategories.length > 0) {
    const filtered = levelPool.filter((w) => activeCategories.includes(w.category));
    if (filtered.length > 0) {
      levelPool = filtered;
    }
  }

  let availableTargets = levelPool.filter((w) => !usedWordIds.has(w.id));
  if (availableTargets.length === 0) {
    availableTargets = levelPool;
  }

  const targetWord =
    reviewTarget || availableTargets[Math.floor(Math.random() * availableTargets.length)];

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

  const isDistinctOption = (existing: VocabWord, candidate: VocabWord): boolean => {
    if (existing.id === candidate.id) return false;
    if (existing.expression.trim() === candidate.expression.trim()) return false;
    const thA = existing.meaningTh.trim();
    const thB = candidate.meaningTh.trim();
    if (thA && thB && thA === thB) return false;
    const enA = existing.meaning.toLowerCase().trim();
    const enB = candidate.meaning.toLowerCase().trim();
    if (enA && enB && enA === enB) return false;
    return true;
  };

  // Weighted probability for sound-confusable distractors (0 to 1 choice):
  // - 75% chance: 0 confusable distractors (all 3 distractors are random)
  // - 25% chance: 1 sound-confusable distractor (1 sound-confusable + 2 random)
  // Note: Similar-meaning words are excluded so choices cannot be trivially eliminated,
  // and any confusable distractor must match the target word's category and allowed JLPT level(s).
  if (confusableIndex) {
    const targetConfusableCount = Math.random() < 0.75 ? 0 : 1;

    if (targetConfusableCount > 0) {
      const totalWeight = Object.values(weights).reduce((acc, v) => acc + v, 0);
      const isLevelAllowed = (level: JLPTLevel): boolean => {
        if (totalWeight > 0) {
          return (weights[level] || 0) > 0;
        }
        return level === targetWord.level || level === selectedLevel;
      };

      const soundConfusables = getConfusableWords(targetWord, confusableIndex, 50, 0).filter(
        (m) =>
          m.type !== 'SIMILAR_MEANING' &&
          m.word.category === targetWord.category &&
          (!activeCategories || activeCategories.includes(m.word.category)) &&
          isLevelAllowed(m.word.level)
      );

      // Prioritize exact same level as targetWord first, then other active weighted levels
      const sameLevelMatches = shuffleArray(
        soundConfusables.filter((m) => m.word.level === targetWord.level).map((m) => m.word)
      );
      const otherAllowedLevelMatches = shuffleArray(
        soundConfusables.filter((m) => m.word.level !== targetWord.level).map((m) => m.word)
      );

      const confusableCandidates = [...sameLevelMatches, ...otherAllowedLevelMatches];

      for (const candidate of confusableCandidates) {
        if (selectedOptions.length >= 1 + targetConfusableCount) break;
        const isValid = selectedOptions.every(
          (existing) =>
            isDistinctOption(existing, candidate) && !areWordsTooSimilar(existing, candidate)
        );
        if (isValid) {
          selectedOptions.push(candidate);
        }
      }
    }
  }

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
      if (selectedOptions.every((existing) => isDistinctOption(existing, candidate))) {
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
    isReview: Boolean(reviewTarget),
  };
}
