import { JLPTLevel, LevelWeights, WordCategory } from '../types';

export const JLPT_LEVELS: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

export const WORD_CATEGORIES: WordCategory[] = [
  'NOUN',
  'VERB',
  'ADJECTIVE',
  'LOANWORD',
  'ADVERB_PHRASE',
  'AFFIX',
];

export const WORD_CATEGORY_META: Record<
  WordCategory,
  { labelTh: string; labelEn: string; badgeClass: string }
> = {
  NOUN: {
    labelTh: 'คำนาม',
    labelEn: 'Noun',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  },
  VERB: {
    labelTh: 'คำกริยา',
    labelEn: 'Verb',
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  },
  ADJECTIVE: {
    labelTh: 'คำคุณศัพท์',
    labelEn: 'Adjective',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  LOANWORD: {
    labelTh: 'คำทับศัพท์',
    labelEn: 'Loanword',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  },
  ADVERB_PHRASE: {
    labelTh: 'คำวิเศษณ์/วลี',
    labelEn: 'Adverb / Phrase',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  AFFIX: {
    labelTh: 'คำเติม',
    labelEn: 'Affix / Counter',
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  },
};

export const DEFAULT_LEVEL_WEIGHTS: Record<JLPTLevel, LevelWeights> = {
  N5: { N1: 0, N2: 0, N3: 0, N4: 0, N5: 100 },
  N4: { N1: 0, N2: 0, N3: 0, N4: 70, N5: 30 },
  N3: { N1: 0, N2: 0, N3: 60, N4: 25, N5: 15 },
  N2: { N1: 0, N2: 50, N3: 30, N4: 20, N5: 0 },
  N1: { N1: 50, N2: 30, N3: 20, N4: 0, N5: 0 },
};

export const STRICT_LEVEL_WEIGHTS: Record<JLPTLevel, LevelWeights> = {
  N5: { N1: 0, N2: 0, N3: 0, N4: 0, N5: 100 },
  N4: { N1: 0, N2: 0, N3: 0, N4: 100, N5: 0 },
  N3: { N1: 0, N2: 0, N3: 100, N4: 0, N5: 0 },
  N2: { N1: 0, N2: 100, N3: 0, N4: 0, N5: 0 },
  N1: { N1: 100, N2: 0, N3: 0, N4: 0, N5: 0 },
};

export interface LevelMeta {
  level: JLPTLevel;
  title: string;
  subtitle: string;
  kanjiBadge: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  badgeClass: string;
  barColor: string;
  mixSummary: string;
}

export const LEVEL_METADATA: Record<JLPTLevel, LevelMeta> = {
  N5: {
    level: 'N5',
    title: 'JLPT N5',
    subtitle: 'เริ่มต้น',
    kanjiBadge: '入門',
    colorClass: 'text-emerald-400',
    bgClass: 'from-emerald-500/20 to-teal-500/5',
    borderClass: 'border-emerald-500/40',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    barColor: 'bg-emerald-500',
    mixSummary: 'N5 100%',
  },
  N4: {
    level: 'N4',
    title: 'JLPT N4',
    subtitle: 'พื้นฐาน',
    kanjiBadge: '初級',
    colorClass: 'text-sky-400',
    bgClass: 'from-sky-500/20 to-blue-500/5',
    borderClass: 'border-sky-500/40',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    barColor: 'bg-sky-500',
    mixSummary: 'N4 70% • N5 30%',
  },
  N3: {
    level: 'N3',
    title: 'JLPT N3',
    subtitle: 'ระดับกลาง',
    kanjiBadge: '中級',
    colorClass: 'text-amber-400',
    bgClass: 'from-amber-500/20 to-orange-500/5',
    borderClass: 'border-amber-500/40',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    barColor: 'bg-amber-500',
    mixSummary: 'N3 60% • N4 25% • N5 15%',
  },
  N2: {
    level: 'N2',
    title: 'JLPT N2',
    subtitle: 'ค่อนข้างสูง',
    kanjiBadge: '上級',
    colorClass: 'text-purple-400',
    bgClass: 'from-purple-500/20 to-fuchsia-500/5',
    borderClass: 'border-purple-500/40',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    barColor: 'bg-purple-500',
    mixSummary: 'N2 50% • N3 30% • N4 20%',
  },
  N1: {
    level: 'N1',
    title: 'JLPT N1',
    subtitle: 'สูงสุด',
    kanjiBadge: '熟達',
    colorClass: 'text-rose-400',
    bgClass: 'from-rose-500/20 to-pink-500/5',
    borderClass: 'border-rose-500/40',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    barColor: 'bg-rose-500',
    mixSummary: 'N1 50% • N2 30% • N3 20%',
  },
};
