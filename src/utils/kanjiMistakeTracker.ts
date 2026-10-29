import type { KanjiDatabase, KanjiNode } from '../types';

/**
 * Kanji Mistake Tracker with Rating & Spaced Review:
 * - Wrong answer increases rating (1 -> 2 -> 3 -> 4...). Higher rating = higher priority.
 * - Correct answer reduces rating to 1 and tracks consecutive correct = 1.
 * - 2 consecutive correct answers resets and removes the kanji from the mistake store.
 * - Key is the kanji character string itself (e.g. '会', '食').
 * - Persisted in both localStorage and document.cookie.
 */

const LOCAL_STORAGE_KEY = 'jlpt-kotoba-kanji-mistakes-v1';
const COOKIE_NAME = 'jlpt_kanji_mistakes_v1';
const MAX_RATING = 10;

export interface KanjiMistakeRecord {
  rating: number;             // Mistake severity rating (1, 2, 3, 4...). Higher = appears first.
  consecutiveCorrect: number; // Consecutive correct answers in review (resets out when reaches 2).
  wrongCount: number;         // Lifetime times answered wrong.
  lastWrongAt: number;        // Timestamp of last mistake.
}

export type KanjiMistakeStore = Record<string, KanjiMistakeRecord>;

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
 * Format: "char:rating:streak:wrongCount:timestamp,..."
 */
function serializeCompact(store: KanjiMistakeStore): string {
  const entries = Object.entries(store)
    .sort((a, b) => b[1].rating - a[1].rating || b[1].lastWrongAt - a[1].lastWrongAt)
    .slice(0, 70);
  return entries
    .map(([char, r]) => `${char}:${r.rating}:${r.consecutiveCorrect}:${r.wrongCount}:${r.lastWrongAt}`)
    .join(';');
}

function deserializeCompact(str: string): KanjiMistakeStore {
  const store: KanjiMistakeStore = {};
  if (!str) return store;
  const parts = str.split(';');
  for (const part of parts) {
    if (!part) continue;
    const [char, ratingStr, streakStr, countStr, timeStr] = part.split(':');
    const rating = Number(ratingStr);
    if (char && !Number.isNaN(rating) && rating > 0) {
      store[char] = {
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

export function loadKanjiMistakes(): KanjiMistakeStore {
  // 1. Try localStorage first
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const clean: KanjiMistakeStore = {};
          for (const [char, rec] of Object.entries(parsed as Record<string, any>)) {
            if (rec && typeof rec === 'object') {
              const rating = typeof rec.rating === 'number' ? rec.rating : 1;
              clean[char] = {
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

export function saveKanjiMistakes(store: KanjiMistakeStore): void {
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

export function clearKanjiMistakes(): void {
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
 * Record user's answer for a Kanji:
 * - If WRONG: rating increases (+1), consecutiveCorrect resets to 0.
 * - If CORRECT: rating drops to 1, consecutiveCorrect += 1.
 *   If consecutiveCorrect reaches 2, reset and remove from mistake store!
 */
export function recordKanjiAnswer(
  store: KanjiMistakeStore,
  kanjiChar: string,
  isCorrect: boolean
): KanjiMistakeStore {
  const existing = store[kanjiChar];

  if (!isCorrect) {
    const newRating = existing ? Math.min(MAX_RATING, existing.rating + 1) : 1;
    return {
      ...store,
      [kanjiChar]: {
        rating: newRating,
        consecutiveCorrect: 0,
        wrongCount: (existing?.wrongCount || 0) + 1,
        lastWrongAt: Date.now(),
      },
    };
  }

  // Correct answer, but kanji was not in mistake store -> nothing to change
  if (!existing) return store;

  const nextStreak = (existing.consecutiveCorrect || 0) + 1;
  const next = { ...store };

  // If answered correctly 2 times consecutively, reset and remove from mistake store!
  if (nextStreak >= 2) {
    delete next[kanjiChar];
  } else {
    // Drop rating to 1, set streak = 1
    next[kanjiChar] = {
      ...existing,
      rating: 1,
      consecutiveCorrect: nextStreak,
    };
  }
  return next;
}

export function removeSingleKanjiMistake(
  store: KanjiMistakeStore,
  kanjiChar: string
): KanjiMistakeStore {
  if (!store[kanjiChar]) return store;
  const next = { ...store };
  delete next[kanjiChar];
  return next;
}

/**
 * Return review ratings for the kanji quiz engine.
 * Maps kanjiChar to its mistake rating (1..10).
 */
export function getKanjiReviewScores(store: KanjiMistakeStore): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [char, rec] of Object.entries(store)) {
    scores[char] = rec.rating;
  }
  return scores;
}

/**
 * Retrieve the list of mistake kanji sorted by priority / weight descending
 * (highest rating first, then most recently wrong).
 */
export function getSortedMistakeKanji(
  store: KanjiMistakeStore,
  kanjiDb: KanjiDatabase
): { kanji: KanjiNode; rating: number; lastWrongAt: number }[] {
  const list: { kanji: KanjiNode; rating: number; lastWrongAt: number }[] = [];

  for (const [char, rec] of Object.entries(store)) {
    const kanji = kanjiDb[char];
    if (kanji) {
      list.push({
        kanji,
        rating: rec.rating,
        lastWrongAt: rec.lastWrongAt,
      });
    }
  }

  // Sort: highest rating first ("ผิดหลายครั้ง จะโผล่มาก่อนเสมอ"), then most recently wrong
  list.sort((a, b) => b.rating - a.rating || b.lastWrongAt - a.lastWrongAt);

  return list;
}
