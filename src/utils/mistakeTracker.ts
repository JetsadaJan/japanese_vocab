import type { VocabWord } from '../types';

/**
 * Mistake Tracker with Rating & Spaced Review:
 * - Wrong answer increases rating (e.g. 1 -> 2 -> 3 -> 4...). Higher rating = higher priority.
 * - Correct answer reduces rating to 1 (as if missed only once) and tracks consecutive correct = 1.
 * - 2 consecutive correct answers resets and removes the word from the mistake store.
 * - Persisted in both localStorage and document.cookie.
 */

const LOCAL_STORAGE_KEY = 'jlpt-kotoba-mistakes-v2';
const COOKIE_NAME = 'jlpt_mistakes_v2';
const MAX_RATING = 10;

export interface MistakeRecord {
  rating: number;             // Mistake severity rating (1, 2, 3, 4...). Higher = appears first.
  consecutiveCorrect: number; // Consecutive correct answers in review (resets out when reaches 2).
  wrongCount: number;         // Lifetime times answered wrong.
  lastWrongAt: number;        // Timestamp of last mistake.
}

export type MistakeStore = Record<string, MistakeRecord>;

/**
 * Stable key that survives data updates: expression + reading
 */
export function wordKey(word: Pick<VocabWord, 'expression' | 'reading'>): string {
  return `${word.expression}|${word.reading}`;
}

// ----------------- Cookie Helpers -----------------
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === 'undefined') return;
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {
    // ignore cookie errors
  }
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

/**
 * Convert mistake store to a compact string for cookies (under 3.5KB limit).
 * Format: "exp|reading:rating:streak:wrongCount:timestamp,..."
 */
function serializeCompact(store: MistakeStore): string {
  const entries = Object.entries(store)
    .sort((a, b) => b[1].rating - a[1].rating || b[1].lastWrongAt - a[1].lastWrongAt)
    .slice(0, 60); // Keep top 60 to safely stay within cookie 4KB limits
  return entries
    .map(([key, r]) => `${key}:${r.rating}:${r.consecutiveCorrect}:${r.wrongCount}:${r.lastWrongAt}`)
    .join(';');
}

function deserializeCompact(str: string): MistakeStore {
  const store: MistakeStore = {};
  if (!str) return store;
  const parts = str.split(';');
  for (const part of parts) {
    if (!part) continue;
    const [key, ratingStr, streakStr, countStr, timeStr] = part.split(':');
    const rating = Number(ratingStr);
    if (key && !Number.isNaN(rating) && rating > 0) {
      store[key] = {
        rating: Math.min(MAX_RATING, Math.max(1, rating)),
        consecutiveCorrect: Number(streakStr) || 0,
        wrongCount: Number(countStr) || 1,
        lastWrongAt: Number(timeStr) || Date.now(),
      };
    }
  }
  return store;
}

// ----------------- Public Storage API -----------------

export function loadMistakes(): MistakeStore {
  // 1. Try localStorage first
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const clean: MistakeStore = {};
          for (const [key, rec] of Object.entries(parsed as Record<string, any>)) {
            if (rec && typeof rec === 'object') {
              const rating = typeof rec.rating === 'number' ? rec.rating : (rec.score ? 1 : 1);
              clean[key] = {
                rating: Math.min(MAX_RATING, Math.max(1, rating)),
                consecutiveCorrect: Number(rec.consecutiveCorrect) || 0,
                wrongCount: Number(rec.wrongCount) || 1,
                lastWrongAt: Number(rec.lastWrongAt) || Date.now(),
              };
            }
          }
          if (Object.keys(clean).length > 0) {
            return clean;
          }
        }
      }
    }
  } catch {
    // fallback to cookie
  }

  // 2. Fallback to cookie
  try {
    const cookieData = getCookie(COOKIE_NAME);
    if (cookieData) {
      const fromCookie = deserializeCompact(cookieData);
      if (Object.keys(fromCookie).length > 0) {
        return fromCookie;
      }
    }
  } catch {
    // ignore
  }

  return {};
}

export function saveMistakes(store: MistakeStore): void {
  // 1. Save full JSON to localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
    }
  } catch {
    // ignore storage quota errors
  }

  // 2. Also save compact version to cookie
  try {
    if (Object.keys(store).length === 0) {
      deleteCookie(COOKIE_NAME);
    } else {
      const compact = serializeCompact(store);
      setCookie(COOKIE_NAME, compact, 365);
    }
  } catch {
    // ignore cookie errors
  }
}

export function clearMistakes(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  deleteCookie(COOKIE_NAME);
}

/**
 * Record user's answer:
 * - If WRONG: rating increases (+1), consecutiveCorrect resets to 0.
 * - If CORRECT: rating drops to 1, consecutiveCorrect += 1.
 *   If consecutiveCorrect reaches 2, reset and remove from mistake history!
 */
export function recordAnswer(
  store: MistakeStore,
  word: VocabWord,
  isCorrect: boolean
): MistakeStore {
  const key = wordKey(word);
  const existing = store[key];

  if (!isCorrect) {
    const newRating = existing ? Math.min(MAX_RATING, existing.rating + 1) : 1;
    return {
      ...store,
      [key]: {
        rating: newRating,
        consecutiveCorrect: 0,
        wrongCount: (existing?.wrongCount || 0) + 1,
        lastWrongAt: Date.now(),
      },
    };
  }

  // Correct answer, but word was not in mistake store -> nothing to change
  if (!existing) return store;

  const nextStreak = (existing.consecutiveCorrect || 0) + 1;
  const next = { ...store };

  // If answered correctly 2 times consecutively, reset and remove from mistake store!
  if (nextStreak >= 2) {
    delete next[key];
  } else {
    // Drop rating to 1 (as if missed only once), set streak = 1
    next[key] = {
      ...existing,
      rating: 1,
      consecutiveCorrect: nextStreak,
    };
  }
  return next;
}

export function removeSingleMistake(store: MistakeStore, word: Pick<VocabWord, 'expression' | 'reading'>): MistakeStore {
  const key = wordKey(word);
  if (!store[key]) return store;
  const next = { ...store };
  delete next[key];
  return next;
}

/**
 * Return review ratings for the quiz engine.
 * Maps wordKey to its mistake rating (1, 2, 3, 4+).
 */
export function getReviewScores(store: MistakeStore): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [key, rec] of Object.entries(store)) {
    scores[key] = rec.rating;
  }
  return scores;
}

/**
 * Retrieve the list of mistake words sorted by priority / weight descending
 * (highest rating first, then most recently wrong).
 */
export function getSortedMistakeWords(
  store: MistakeStore,
  wordMap: Record<string, VocabWord>
): { word: VocabWord; rating: number; lastWrongAt: number }[] {
  // Build lookup index by "exp|reading" for O(1) matching against wordMap
  const lookupByExpReading = new Map<string, VocabWord>();
  for (const word of Object.values(wordMap)) {
    const k = wordKey(word);
    if (!lookupByExpReading.has(k)) {
      lookupByExpReading.set(k, word);
    }
  }

  const list: { word: VocabWord; rating: number; lastWrongAt: number }[] = [];

  for (const [key, rec] of Object.entries(store)) {
    const word = lookupByExpReading.get(key);
    if (word) {
      list.push({
        word,
        rating: rec.rating,
        lastWrongAt: rec.lastWrongAt,
      });
    }
  }

  // Sort: highest rating first ("ผิดสี่ครั้ง จะโผล่มาก่อนเสมอ"), then most recently wrong
  list.sort((a, b) => b.rating - a.rating || b.lastWrongAt - a.lastWrongAt);

  return list;
}
