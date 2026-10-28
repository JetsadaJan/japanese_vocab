import { VocabWord } from '../types';
import { WORD_CATEGORY_META } from './constants';

export interface SemanticGroupMemberNote {
  key: string;
  readingLabel?: string;
  meaningDiff: string;
  feelingNuance: string;
  usageContext: string;
  exampleJa?: string;
  exampleTh?: string;
}

export interface SemanticGroup {
  id: string;
  titleTh: string;
  titleEn: string;
  summaryTh: string;
  coreDifferenceTh: string;
  quickTipTh: string;
  keywords: string[];
  memberNotes: SemanticGroupMemberNote[];
  matchedWords?: VocabWord[];
}

export async function loadSemanticGroups(): Promise<SemanticGroup[]> {
  try {
    const res = await fetch('/data/semantic-groups.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data as SemanticGroup[];
      }
    }
  } catch {
    // Fallback to empty array if offline
  }
  return [];
}

function splitGlosses(text: string): string[] {
  return text
    .split(/[,;、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Checks whether a curated `SemanticGroupMemberNote` corresponds to a `VocabWord`.
 * Prevents false homophone matches while handling kana-written entries and okurigana variants.
 */
export function doesNoteMatchWord(
  note: SemanticGroupMemberNote,
  word: VocabWord
): boolean {
  const expr = word.expression.trim();
  const key = note.key.trim();
  const readings = word.reading
    .split(';')
    .map((r) =>
      r
        .replace(/\([^)]*\)/g, '')
        .replace(/（[^）]*）/g, '')
        .replace(/[〜～\-\s]/g, '')
        .trim()
    )
    .filter(Boolean);

  if (expr === key) {
    if (note.readingLabel) {
      const kanaInLabel = note.readingLabel.replace(/\([^)]*\)/g, '');
      if (/[\u3040-\u309F\u30A0-\u30FF]/.test(kanaInLabel)) {
        return readings.some((r) => kanaInLabel.includes(r));
      }
    }
    return true;
  }

  // Check if readingLabel explicitly mentions the expression (e.g., "きれい / 綺麗 (kirei)")
  if (note.readingLabel) {
    const labelTokens = note.readingLabel
      .replace(/\([^)]*\)/g, '')
      .split(/[\/・,、]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (labelTokens.includes(expr)) {
      return true;
    }
    // If the CSV word is written purely in kana (no kanji), match against the note's kana reading
    if (
      word.kanjiChars.length === 0 &&
      readings.some((r) => labelTokens.includes(r))
    ) {
      return true;
    }
  }

  // Handle okurigana variants (same kanji characters + same reading, e.g., 終わる vs 終る, 落とす vs 落す)
  const keyKanji = Array.from(key).filter((ch) =>
    /[\u4E00-\u9FAF\u3400-\u4DBF]/.test(ch)
  );
  if (
    word.kanjiChars.length > 0 &&
    keyKanji.length === word.kanjiChars.length &&
    keyKanji.every((k, idx) => k === word.kanjiChars[idx])
  ) {
    if (
      !note.readingLabel ||
      readings.some((r) => note.readingLabel!.includes(r))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Generates an analytical comparison note for a word within a dynamic (non-curated) synonym group,
 * contrasting its shared vs. unique meanings, script origin (Wago / Kango / Gairaigo), and usage.
 */
export function buildAutoMemberNote(
  word: VocabWord,
  peerWords: VocabWord[] = []
): SemanticGroupMemberNote {
  const catMeta = WORD_CATEGORY_META[word.category];
  const hasKanji = word.kanjiChars.length > 0;
  const isKatakanaOnly = /^[\u30A0-\u30FFー]+$/.test(word.expression);
  const isHiraganaOnly = /^[\u3040-\u309F〜～]+$/.test(word.expression);

  const myThGlosses = splitGlosses(word.meaningTh || '');
  const peerThGlossSet = new Set<string>();
  for (const peer of peerWords) {
    if (peer.id === word.id) continue;
    for (const g of splitGlosses(peer.meaningTh || '')) {
      peerThGlossSet.add(g);
    }
  }

  const sharedTh = myThGlosses.filter((g) => peerThGlossSet.has(g));
  const uniqueTh = myThGlosses.filter((g) => !peerThGlossSet.has(g));

  let meaningDiff = `${word.meaningTh || word.meaning}`;
  if (peerWords.length > 1) {
    if (uniqueTh.length > 0 && sharedTh.length > 0) {
      meaningDiff = `มีความหมายร่วมคือ “${sharedTh.join(', ')}” แต่คำนี้มีนัยสำคัญเฉพาะตัวคือ “${uniqueTh.join(', ')}” (ความหมายอังกฤษ: ${word.meaning})`;
    } else {
      meaningDiff = `${word.meaningTh || word.meaning} — ในภาษาอังกฤษสื่อถึง “${word.meaning}”`;
    }
  }

  let feelingNuance = '';
  const kanjiInfo =
    word.kanjiChars.length > 0
      ? ` (ประกอบด้วยคันจิ: ${word.kanjiChars.join('・')})`
      : '';

  if (isKatakanaOnly) {
    feelingNuance = `คำทับศัพท์ภาษาต่างประเทศ (Gairaigo ระดับ ${word.level}) ให้ความรู้สึกสมัยใหม่ เป็นกันเอง หรือใช้ในบริบทสากล/เทรนด์ยุคใหม่มากกว่าคำดั้งเดิม`;
  } else if (isHiraganaOnly) {
    feelingNuance = `คำญี่ปุ่นแท้ที่มักเขียนด้วยฮิรางานะ (Wago ระดับ ${word.level}) ให้ความรู้สึกนุ่มนวล เป็นธรรมชาติ และใช้บ่อยในบทสนทนาชีวิตประจำวัน`;
  } else if (
    hasKanji &&
    word.kanjiChars.length >= 2 &&
    word.expression.length === word.kanjiChars.length
  ) {
    feelingNuance =
      word.level === 'N1' || word.level === 'N2'
        ? `คำประสมคันจิเสียงจีน (Kango ระดับ ${word.level})${kanjiInfo} ให้ความรู้สึกเป็นทางการ กระชับ และเป็นภาษาเขียน มักพบในข่าว บทความ เอกสารราชการ หรือธุรกิจ`
        : `คำประสมคันจิ (Kango ระดับ ${word.level})${kanjiInfo} สุภาพและเป็นทางการปานกลาง ใช้ได้ทั้งการพูดคุยเรื่องงานและภาษาเขียนทั่วไป`;
  } else {
    feelingNuance =
      word.level === 'N5' || word.level === 'N4'
        ? `คำศัพท์พื้นฐานสำคัญ (Wago ระดับ ${word.level})${kanjiInfo} ที่คนญี่ปุ่นใช้สื่อสารในชีวิตประจำวันเป็นหลัก มีความเป็นธรรมชาติสูง`
        : `คำศัพท์ระดับ ${word.level}${kanjiInfo} ที่ช่วยสื่อความหมายและอารมณ์ได้ละเอียดเฉพาะเจาะจงยิ่งขึ้นกว่าคำพื้นฐาน`;
  }

  let usageContext = `ชนิดคำ: ${catMeta.labelTh} (${catMeta.labelEn})`;
  if (word.category === 'VERB') {
    usageContext +=
      ' — ใช้เป็นกริยาหลักของประโยค ควรสังเกตคำช่วยข้างหน้า (を สำหรับสกรรมกริยาที่มีผู้กระทำ / が หรือ に สำหรับอกรรมกริยาที่บอกสภาพ)';
  } else if (word.category === 'ADJECTIVE') {
    const isIAdj = word.expression.endsWith('い');
    usageContext += isIAdj
      ? ' — คำคุณศัพท์ い (วางหน้าคำนามได้ทันที หรือผันรูป ～くない / ～かった)'
      : ' — คำคุณศัพท์ な (วางขยายหน้าคำนามโดยเติม な หรือใช้เป็นภาคแสดงคู่กับ だ/です)';
  } else if (word.category === 'ADVERB_PHRASE') {
    usageContext +=
      ' — ใช้เป็นคำวิเศษณ์หรือวลีวางหน้ากริยา/คุณศัพท์เพื่อขยายระดับ ความถี่ หรือท่าทีของผู้พูด';
  } else if (word.category === 'NOUN') {
    usageContext +=
      ' — ใช้เป็นคำนามหลักคู่กับคำช่วย が / を / に / の (และคำประสมคันจิหลายคำสามารถเติม ～する เพื่อใช้เป็นกริยาได้)';
  }

  return {
    key: word.expression,
    readingLabel: `${word.reading} [${word.romaji}]`,
    meaningDiff,
    feelingNuance,
    usageContext,
  };
}
