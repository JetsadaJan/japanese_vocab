import { VocabWord } from '../types';
import {
  SemanticGroup,
  SemanticGroupMemberNote,
  buildAutoMemberNote,
  doesNoteMatchWord,
} from './semanticGroups';

export type ConfusableType =
  | 'HOMOPHONE'
  | 'DAKUTEN'
  | 'SIMILAR_MORA'
  | 'SIMILAR_MEANING';

export { doesNoteMatchWord };

export interface ConfusableMatch {
  type: ConfusableType;
  labelTh: string;
  labelEn: string;
  word: VocabWord;
  groupId?: string;
}

const DAKUTEN_MAP: Record<string, string> = {
  が: 'か', ぎ: 'き', ぐ: 'く', げ: 'け', ご: 'こ',
  ざ: 'さ', じ: 'し', ず: 'す', ぜ: 'せ', ぞ: 'そ',
  だ: 'た', ぢ: 'ち', づ: 'つ', で: 'て', ど: 'と',
  ば: 'は', び: 'ひ', ぶ: 'ふ', べ: 'へ', ぼ: 'ほ',
  ぱ: 'は', ぴ: 'ひ', ぷ: 'ふ', ぺ: 'へ', ぽ: 'ほ',
  ガ: 'カ', ギ: 'キ', グ: 'ク', ゲ: 'ケ', ゴ: 'コ',
  ザ: 'サ', ジ: 'シ', ズ: 'ス', ゼ: 'セ', ゾ: 'ソ',
  ダ: 'タ', ヂ: 'チ', ヅ: 'ツ', デ: 'テ', ド: 'ト',
  バ: 'ハ', ビ: 'ヒ', ブ: 'フ', ベ: 'ヘ', ボ: 'ホ',
  パ: 'ハ', ピ: 'ヒ', プ: 'フ', ペ: 'ヘ', ポ: 'ホ',
};

export function toUnvoicedBaseReading(reading: string): string {
  let out = '';
  for (const ch of reading) {
    out += DAKUTEN_MAP[ch] || ch;
  }
  return out;
}

const SMALL_KANA = new Set([
  'ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ',
  'ャ', 'ュ', 'ョ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ',
]);

export function splitIntoMoras(reading: string): string[] {
  const moras: string[] = [];
  for (const ch of reading) {
    if (SMALL_KANA.has(ch) && moras.length > 0) {
      moras[moras.length - 1] += ch;
    } else {
      moras.push(ch);
    }
  }
  return moras;
}

export function cleanPrimaryReading(reading: string): string {
  return reading
    .split(';')[0]
    .replace(/[〜～\-\s]/g, '')
    .trim();
}

const TH_STOP_GLOSSES = new Set([
  'ค่ะ',
  'คะ',
  'ครับ',
  'นะ',
  'สิ่ง',
  'เรื่อง',
  'การ',
  'ความ',
  'ที่',
  'อย่าง',
  'มาก',
  'อย่างยิ่ง',
  'เล็กน้อย',
  'ทั้งหมด',
  'ส่วนใหญ่',
  'ทั่วไป',
  'พิเศษ',
  'ธรรมดา',
  'เต็มที่',
  'จริงๆ',
  'เลย',
  'ด้วย',
  'กัน',
  'ขึ้น',
  'ลง',
  'เข้า',
  'ออก',
  'ต่อ',
]);

/**
 * Extracts clean Thai meaning glosses scoped by Part-of-Speech (`category`)
 * so English homographs (e.g. "close", "fall", "character", "order", "change")
 * or conversational endings ("/ค่ะ") never link unrelated words.
 */
function extractMeaningGlosses(word: VocabWord): string[] {
  const glosses: string[] = [];
  if (!word.meaningTh) return glosses;

  const rawTh = word.meaningTh
    .replace(/\([^)]*\)/g, '')
    .replace(/（[^）]*）/g, '');

  for (const part of rawTh.split(/[,;、]/)) {
    const cleaned = part.trim();
    if (
      cleaned.length >= 2 &&
      cleaned !== '-' &&
      !TH_STOP_GLOSSES.has(cleaned)
    ) {
      glosses.push(`${word.category}|th:${cleaned}`);
    }
  }

  return glosses;
}

export interface ConfusableIndex {
  byReading: Map<string, VocabWord[]>;
  byBaseReading: Map<string, VocabWord[]>;
  byFirstMoraWildcard: Map<string, VocabWord[]>;
  byLastMoraWildcard: Map<string, VocabWord[]>;
  byCuratedGroup: Map<string, VocabWord[]>;
  byMeaningGloss: Map<string, VocabWord[]>;
  groupsById: Map<string, SemanticGroup>;
  wordToGroupIds: Map<string, string[]>;
}

export function buildConfusableIndex(
  allWords: VocabWord[],
  curatedGroups: SemanticGroup[] = []
): ConfusableIndex {
  const byReading = new Map<string, VocabWord[]>();
  const byBaseReading = new Map<string, VocabWord[]>();
  const byFirstMoraWildcard = new Map<string, VocabWord[]>();
  const byLastMoraWildcard = new Map<string, VocabWord[]>();
  const byCuratedGroup = new Map<string, VocabWord[]>();
  const byMeaningGloss = new Map<string, VocabWord[]>();
  const groupsById = new Map<string, SemanticGroup>();
  const wordToGroupIds = new Map<string, string[]>();

  const pushMap = <T,>(map: Map<string, T[]>, key: string, item: T) => {
    const arr = map.get(key);
    if (arr) {
      arr.push(item);
    } else {
      map.set(key, [item]);
    }
  };

  // Index by exact expression (and kana-only words) to avoid false homophone matches in curated groups
  const byExpression = new Map<string, VocabWord[]>();

  for (const word of allWords) {
    const expr = word.expression.trim();
    const r = cleanPrimaryReading(word.reading || word.expression);
    if (!r) continue;

    pushMap(byExpression, expr, word);

    pushMap(byReading, r, word);
    pushMap(byBaseReading, toUnvoicedBaseReading(r), word);

    const moras = splitIntoMoras(r);
    if (moras.length >= 2) {
      const firstWild = `${moras.length}:*_${moras.slice(1).join('_')}`;
      const lastWild = `${moras.length}:${moras.slice(0, -1).join('_')}_*`;
      pushMap(byFirstMoraWildcard, firstWild, word);
      pushMap(byLastMoraWildcard, lastWild, word);
    }

    for (const gloss of extractMeaningGlosses(word)) {
      pushMap(byMeaningGloss, gloss, word);
    }
  }

  for (const rawGroup of curatedGroups) {
    const groupWordsMap = new Map<string, VocabWord>();

    // 1. Match words by explicit expression in keywords
    for (const token of rawGroup.keywords) {
      const matched = byExpression.get(token) || [];
      for (const w of matched) {
        groupWordsMap.set(w.id, w);
      }
    }

    // 2. Also match any word that matches one of the curated memberNotes (e.g. okurigana or kana-only variant)
    const existingNotes = rawGroup.memberNotes || [];
    for (const note of existingNotes) {
      const directMatched = byExpression.get(note.key) || [];
      for (const w of directMatched) {
        groupWordsMap.set(w.id, w);
      }
    }

    // Check allWords for okurigana / kana-only variants matching memberNotes
    if (existingNotes.length > 0) {
      for (const w of allWords) {
        if (groupWordsMap.has(w.id)) continue;
        if (existingNotes.some((n) => doesNoteMatchWord(n, w))) {
          groupWordsMap.set(w.id, w);
        }
      }
    }

    const matchedWords = Array.from(groupWordsMap.values());
    if (matchedWords.length < 2 && existingNotes.length < 2) continue;

    const combinedNotes: SemanticGroupMemberNote[] = [...existingNotes];

    for (const w of matchedWords) {
      const alreadyCovered = combinedNotes.some((n) => doesNoteMatchWord(n, w));
      if (!alreadyCovered) {
        combinedNotes.push(buildAutoMemberNote(w, matchedWords));
      }
    }

    const enrichedGroup: SemanticGroup = {
      ...rawGroup,
      memberNotes: combinedNotes,
      matchedWords,
    };

    groupsById.set(enrichedGroup.id, enrichedGroup);

    for (const w of matchedWords) {
      const gIds = wordToGroupIds.get(w.id) || [];
      if (!gIds.includes(enrichedGroup.id)) {
        gIds.push(enrichedGroup.id);
        wordToGroupIds.set(w.id, gIds);
      }

      const existingPeers = byCuratedGroup.get(w.id) || [];
      for (const peer of matchedWords) {
        if (peer.id !== w.id && !existingPeers.some((e) => e.id === peer.id)) {
          existingPeers.push(peer);
        }
      }
      byCuratedGroup.set(w.id, existingPeers);
    }
  }

  return {
    byReading,
    byBaseReading,
    byFirstMoraWildcard,
    byLastMoraWildcard,
    byCuratedGroup,
    byMeaningGloss,
    groupsById,
    wordToGroupIds,
  };
}

export function getConfusableWords(
  target: VocabWord,
  index: ConfusableIndex,
  maxSoundResults = 5,
  maxMeaningResults = 5
): ConfusableMatch[] {
  const r = cleanPrimaryReading(target.reading || target.expression);
  if (!r) return [];

  const results: ConfusableMatch[] = [];
  const seenWordIds = new Set<string>([target.id]);
  const seenExpressions = new Set<string>([target.expression]);

  // 1. Exact Homophones (คำพ้องเสียง)
  const exactList = index.byReading.get(r) || [];
  for (const cand of exactList) {
    if (seenWordIds.has(cand.id) || seenExpressions.has(cand.expression)) continue;
    seenWordIds.add(cand.id);
    seenExpressions.add(cand.expression);
    results.push({
      type: 'HOMOPHONE',
      labelTh: 'พ้องเสียง',
      labelEn: 'Homophone',
      word: cand,
    });
    if (results.length >= maxSoundResults) break;
  }

  // 2. Dakuten / Handakuten Voiced-Unvoiced pairs (e.g., akeru vs ageru)
  if (results.length < maxSoundResults && r.length >= 2) {
    const base = toUnvoicedBaseReading(r);
    const dakutenList = index.byBaseReading.get(base) || [];
    for (const cand of dakutenList) {
      if (seenWordIds.has(cand.id) || seenExpressions.has(cand.expression)) continue;
      const candR = cleanPrimaryReading(cand.reading || cand.expression);
      if (candR === r) continue;

      seenWordIds.add(cand.id);
      seenExpressions.add(cand.expression);
      results.push({
        type: 'DAKUTEN',
        labelTh: 'เสียงขุ่น/ใสคล้ายกัน',
        labelEn: 'Voiced/Unvoiced',
        word: cand,
      });
      if (results.length >= maxSoundResults) break;
    }
  }

  // 3. Similar Mora (differing only in the first or last mora)
  const moras = splitIntoMoras(r);
  if (results.length < maxSoundResults && moras.length >= 2) {
    const firstWild = `${moras.length}:*_${moras.slice(1).join('_')}`;
    const lastWild = `${moras.length}:${moras.slice(0, -1).join('_')}_*`;

    let candidates = [
      ...(index.byFirstMoraWildcard.get(firstWild) || []),
      ...(index.byLastMoraWildcard.get(lastWild) || []),
    ];

    // For 2-mora words, require same category & same level to avoid noisy 1-mora coincidences
    if (moras.length === 2) {
      candidates = candidates.filter(
        (c) => c.category === target.category && c.level === target.level
      );
    }

    candidates.sort((a, b) => {
      const aScore =
        (a.level === target.level ? 2 : 0) +
        (a.category === target.category ? 2 : 0);
      const bScore =
        (b.level === target.level ? 2 : 0) +
        (b.category === target.category ? 2 : 0);
      return bScore - aScore;
    });

    for (const cand of candidates) {
      if (seenWordIds.has(cand.id) || seenExpressions.has(cand.expression)) continue;
      const candR = cleanPrimaryReading(cand.reading || cand.expression);
      if (candR === r) continue;

      seenWordIds.add(cand.id);
      seenExpressions.add(cand.expression);
      results.push({
        type: 'SIMILAR_MORA',
        labelTh: 'เสียงคล้าย',
        labelEn: 'Similar Sound',
        word: cand,
      });
      if (results.length >= maxSoundResults) break;
    }
  }

  // 4. Similar Meaning (ความหมายใกล้เคียง: Curated groups + same-POS Thai meaning glosses)
  const meaningCandMap = new Map<
    string,
    { word: VocabWord; score: number; groupId?: string }
  >();
  const primaryCuratedGroupId = index.wordToGroupIds.get(target.id)?.[0];

  const curatedList = index.byCuratedGroup.get(target.id) || [];
  for (const cand of curatedList) {
    if (seenWordIds.has(cand.id) || seenExpressions.has(cand.expression)) continue;
    meaningCandMap.set(cand.id, {
      word: cand,
      score: 100 + (cand.level === target.level ? 10 : 0),
      groupId: primaryCuratedGroupId,
    });
  }

  const glosses = extractMeaningGlosses(target);
  for (const gloss of glosses) {
    const list = index.byMeaningGloss.get(gloss) || [];
    for (const cand of list) {
      if (seenWordIds.has(cand.id) || seenExpressions.has(cand.expression)) continue;
      const existing = meaningCandMap.get(cand.id);
      const bonus = 30 + (cand.level === target.level ? 5 : 0);
      if (existing) {
        existing.score += bonus;
      } else {
        meaningCandMap.set(cand.id, {
          word: cand,
          score: bonus,
          groupId: primaryCuratedGroupId || `auto:${target.id}`,
        });
      }
    }
  }

  const meaningCandidates = Array.from(meaningCandMap.values()).sort(
    (a, b) => b.score - a.score
  );

  let addedMeaning = 0;
  for (const item of meaningCandidates) {
    if (addedMeaning >= maxMeaningResults) break;
    if (
      seenWordIds.has(item.word.id) ||
      seenExpressions.has(item.word.expression)
    ) {
      continue;
    }
    seenWordIds.add(item.word.id);
    seenExpressions.add(item.word.expression);
    addedMeaning++;
    results.push({
      type: 'SIMILAR_MEANING',
      labelTh: 'ความหมายใกล้เคียง',
      labelEn: 'Similar Meaning',
      word: item.word,
      groupId: item.groupId,
    });
  }

  return results;
}

export function resolveSemanticGroup(
  groupId: string,
  index: ConfusableIndex,
  wordMap: Record<string, VocabWord>
): SemanticGroup | null {
  const curated = index.groupsById.get(groupId);
  if (curated) {
    return curated;
  }

  if (groupId.startsWith('auto:')) {
    const wordId = groupId.slice(5);
    const target = wordMap[wordId];
    if (!target) return null;

    // First check if target or any of its peers belong to a curated group
    const targetCuratedId = index.wordToGroupIds.get(target.id)?.[0];
    if (targetCuratedId && index.groupsById.has(targetCuratedId)) {
      return index.groupsById.get(targetCuratedId)!;
    }

    const allConfusables = getConfusableWords(target, index, 4, 6);
    const meaningPeers = allConfusables
      .filter((c) => c.type === 'SIMILAR_MEANING')
      .map((c) => c.word);

    for (const peer of meaningPeers) {
      const peerCuratedId = index.wordToGroupIds.get(peer.id)?.[0];
      if (peerCuratedId && index.groupsById.has(peerCuratedId)) {
        return index.groupsById.get(peerCuratedId)!;
      }
    }

    const allGroupWords = [target, ...meaningPeers];
    const exprList = allGroupWords
      .map((w) => w.expression)
      .slice(0, 5)
      .join('・');
    const primaryMeaning = (target.meaningTh || target.meaning)
      .split(/[,;]/)[0]
      .trim();

    const perWordSummary = allGroupWords
      .map(
        (w) =>
          `${w.expression} (${w.reading}) = ${w.meaningTh || w.meaning} [${w.level}]`
      )
      .join(' | ');

    return {
      id: groupId,
      titleTh: `เปรียบเทียบคำความหมายใกล้เคียง: “${primaryMeaning}” (${exprList})`,
      titleEn: `Similar Meaning: ${target.meaning.split(/[,;]/)[0]}`,
      summaryTh: `กลุ่มคำศัพท์ที่มีแกนความหมายร่วมกันเกี่ยวกับ “${primaryMeaning}” แต่มีขอบเขตความหมาย ระดับความเป็นทางการ (Wago / Kango / Gairaigo) และบริบทการใช้งานที่แตกต่างกัน`,
      coreDifferenceTh: perWordSummary,
      quickTipTh:
        'สังเกต 3 จุดหลัก: 1) ตัวคันจิประกอบที่บอกนัยเฉพาะตัว 2) คำญี่ปุ่นแท้ (ฮิรางานะ/N5–N4) ใช้ในบทสนทนาทั่วไป ส่วนคำประสมคันจิ 2 ตัว (N3–N1) ใช้ในภาษาเขียนหรือทางการ 3) ดูความหมายรองที่ต่างกันของแต่ละคำด้านล่าง',
      keywords: allGroupWords.map((w) => w.expression),
      memberNotes: allGroupWords.map((w) =>
        buildAutoMemberNote(w, allGroupWords)
      ),
      matchedWords: allGroupWords,
    };
  }

  return null;
}

export function getPrimaryGroupIdForWord(
  word: VocabWord,
  index: ConfusableIndex,
  similarMeaningCount: number
): string | null {
  const curatedIds = index.wordToGroupIds.get(word.id);
  if (curatedIds && curatedIds.length > 0) {
    return curatedIds[0];
  }
  if (similarMeaningCount > 0) {
    return `auto:${word.id}`;
  }
  return null;
}
