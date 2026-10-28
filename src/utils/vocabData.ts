import {
  JLPTLevel,
  KanjiDatabase,
  MeaningLanguage,
  VocabWord,
} from '../types';
import { kanaToRomaji } from './romaji';
import { ConfusableIndex, buildConfusableIndex } from './confusableWords';
import { loadSemanticGroups } from './semanticGroups';
import { JLPT_LEVELS } from './constants';
import { classifyWordCategory, extractKanjiChars } from './wordClassifier';
import { VocabDatabase } from './quizEngine';

// Re-export modularized backend utilities so all frontend components work without changes
export {
  JLPT_LEVELS,
  WORD_CATEGORIES,
  WORD_CATEGORY_META,
  DEFAULT_LEVEL_WEIGHTS,
  STRICT_LEVEL_WEIGHTS,
  LEVEL_METADATA,
} from './constants';
export type { LevelMeta } from './constants';
export { extractKanjiChars, classifyWordCategory } from './wordClassifier';
export {
  pickLevelByWeights,
  areWordsTooSimilar,
  generateQuizQuestion,
} from './quizEngine';
export type { VocabDatabase } from './quizEngine';

/**
 * Checks whether a vocabulary word has expandable extra details (Kanji breakdown, confusable words, or extra notes).
 * If false, the "แสดงเพิ่มเติม" button is rendered grayed-out and disabled.
 */
export function hasWordExtraDetails(
  word: VocabWord,
  confusablesCount = 0
): boolean {
  return (
    word.kanjiChars.length > 0 ||
    confusablesCount > 0 ||
    Boolean(word.extraNote && word.extraNote.trim())
  );
}

/**
 * Formats a Kanji link button label with the Kanji character + arrow + meaning in the selected language.
 * e.g., "足 ➔ เท้า, ขา, เพียงพอ" or "脚 ➔ ขา, ช่วงล่าง, ฐาน"
 */
export function formatKanjiLinkLabel(
  ch: string,
  kanjiDb: KanjiDatabase,
  lang: MeaningLanguage
): string {
  const kNode = kanjiDb[ch];
  if (!kNode) return `${ch} ➔`;

  if (lang === 'TH') {
    return `${ch} ➔ ${kNode.meaningTh || kNode.meaningEn}`;
  }
  if (lang === 'EN') {
    return `${ch} ➔ ${kNode.meaningEn}`;
  }
  if (kNode.meaningTh && kNode.meaningTh !== kNode.meaningEn) {
    return `${ch} ➔ ${kNode.meaningTh} (${kNode.meaningEn})`;
  }
  return `${ch} ➔ ${kNode.meaningEn}`;
}

export function formatWordMeaning(
  word: VocabWord,
  lang: MeaningLanguage
): string {
  if (lang === 'TH') {
    return word.meaningTh || word.meaning;
  }
  if (lang === 'EN') {
    return word.meaning;
  }
  if (word.meaningTh && word.meaningTh !== word.meaning) {
    return `${word.meaningTh} (${word.meaning})`;
  }
  return word.meaning;
}

export function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

export function parseJLPTCsv(csvText: string, level: JLPTLevel): VocabWord[] {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const words: VocabWord[] = [];

  // Skip header row (expression,reading,meaning,tags[,meaning_th,extra_note])
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const cols = parseCSVRow(rawLine);
    if (cols.length < 3) continue;

    const expression = cols[0];
    const reading = cols[1] || expression;
    const meaning = cols[2];
    const tags = cols[3] || '';
    const meaningTh = cols[4] || meaning;
    const extraNote = cols[5] || undefined;

    if (!expression || !meaning) continue;

    words.push({
      id: `${level}-${i}-${expression}`,
      expression,
      reading,
      romaji: kanaToRomaji(reading),
      meaning,
      meaningTh,
      tags,
      level,
      category: classifyWordCategory(expression, reading, meaning, meaningTh),
      kanjiChars: extractKanjiChars(expression),
      extraNote,
    });
  }

  return words;
}

interface RawKanjiEntry {
  on?: string[];
  kun?: string[];
  en?: string;
  th?: string;
  strokes?: number;
  lvl?: JLPTLevel;
}

/**
 * Loads all 3 external data layers from `public/data/`:
 * 1. Vocabulary CSVs (`/data/n5.csv` .. `/data/n1.csv`)
 * 2. Kanji Node Dictionary (`/data/kanji.json`)
 * 3. Curated Semantic Nuance Groups (`/data/semantic-groups.json`)
 * Then links every Kanji node and Semantic Group node with the vocabulary graph.
 */
export async function loadAllVocabData(): Promise<{
  db: VocabDatabase;
  kanjiDb: KanjiDatabase;
  wordMap: Record<string, VocabWord>;
  confusableIndex: ConfusableIndex;
  source: 'local' | 'github';
}> {
  const db: VocabDatabase = {
    N5: [],
    N4: [],
    N3: [],
    N2: [],
    N1: [],
  };

  let usedGithubFallback = false;

  const [, rawKanjiMap, curatedSemanticGroups] = await Promise.all([
    Promise.all(
      JLPT_LEVELS.map(async (level) => {
        const lower = level.toLowerCase();
        const localUrl = `/data/${lower}.csv`;
        const githubUrl = `https://raw.githubusercontent.com/elzup/jlpt-word-list/master/src/${lower}.csv`;

        try {
          const res = await fetch(localUrl);
          if (res.ok) {
            const text = await res.text();
            const parsed = parseJLPTCsv(text, level);
            if (parsed.length > 0) {
              db[level] = parsed;
              return;
            }
          }
        } catch {
          // Fallback to GitHub below
        }

        usedGithubFallback = true;
        const ghRes = await fetch(githubUrl);
        if (!ghRes.ok) {
          throw new Error(`ไม่สามารถโหลดข้อมูลคำศัพท์ระดับ ${level} ได้`);
        }
        const ghText = await ghRes.text();
        db[level] = parseJLPTCsv(ghText, level);
      })
    ),
    fetch('/data/kanji.json')
      .then(
        (res): Promise<Record<string, RawKanjiEntry>> =>
          res.ok ? res.json() : Promise.resolve({})
      )
      .catch((): Record<string, RawKanjiEntry> => ({})),
    loadSemanticGroups(),
  ]);

  const kanjiDb: KanjiDatabase = {};
  const wordMap: Record<string, VocabWord> = {};

  // Build Kanji nodes and bidirectional links with VocabWord nodes
  for (const level of JLPT_LEVELS) {
    for (const word of db[level]) {
      wordMap[word.id] = word;

      for (const ch of word.kanjiChars) {
        if (!kanjiDb[ch]) {
          const raw: RawKanjiEntry = rawKanjiMap[ch] || {};
          const onyomi: string[] = raw.on || [];
          const kunyomi: string[] = raw.kun || [];
          kanjiDb[ch] = {
            character: ch,
            onyomi,
            kunyomi,
            onyomiRomaji: onyomi.map((r) =>
              kanaToRomaji(r.replace(/[.\-]/g, ''))
            ),
            kunyomiRomaji: kunyomi.map((r) =>
              kanaToRomaji(r.replace(/[.\-]/g, ''))
            ),
            meaningEn: raw.en || '',
            meaningTh: raw.th || raw.en || '',
            strokes: raw.strokes || 0,
            level: raw.lvl || level,
            relatedWordIds: [],
          };
        }
        if (!kanjiDb[ch].relatedWordIds.includes(word.id)) {
          kanjiDb[ch].relatedWordIds.push(word.id);
        }
      }
    }
  }

  const allWordsFlat = JLPT_LEVELS.flatMap((lvl) => db[lvl]);
  const confusableIndex = buildConfusableIndex(allWordsFlat, curatedSemanticGroups);

  return {
    db,
    kanjiDb,
    wordMap,
    confusableIndex,
    source: usedGithubFallback ? 'github' : 'local',
  };
}

export function speakJapanese(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.92;
    const voices = window.speechSynthesis.getVoices();
    const jaVoice = voices.find((v) => v.lang.includes('ja') || v.lang.includes('JP'));
    if (jaVoice) {
      utterance.voice = jaVoice;
    }
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore speech synthesis errors on unsupported browsers
  }
}
