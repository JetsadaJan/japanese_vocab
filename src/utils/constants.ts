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
    badgeClass: 'bg-[#08263A] text-[#38BDF8] border-[#0284C7] tracking-[0.04em]',
  },
  VERB: {
    labelTh: 'คำกริยา',
    labelEn: 'Verb',
    badgeClass: 'bg-[#062C28] text-[#2DD4BF] border-[#0D9488] tracking-[0.04em]',
  },
  ADJECTIVE: {
    labelTh: 'คำคุณศัพท์',
    labelEn: 'Adjective',
    badgeClass: 'bg-[#2E1F05] text-[#FBBF24] border-[#D97706] tracking-[0.04em]',
  },
  LOANWORD: {
    labelTh: 'คำทับศัพท์',
    labelEn: 'Loanword',
    badgeClass: 'bg-[#151736] text-[#818CF8] border-[#4F46E5] tracking-[0.04em]',
  },
  ADVERB_PHRASE: {
    labelTh: 'คำวิเศษณ์/วลี',
    labelEn: 'Adverb / Phrase',
    badgeClass: 'bg-[#251038] text-[#C084FC] border-[#9333EA] tracking-[0.04em]',
  },
  AFFIX: {
    labelTh: 'คำเติม',
    labelEn: 'Affix / Counter',
    badgeClass: 'bg-[#330D17] text-[#FB7185] border-[#E11D48] tracking-[0.04em]',
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
    colorClass: 'text-[#34D399]',
    bgClass: 'from-[#062E22] to-[#16181D]',
    borderClass: 'border-[#059669]/50',
    badgeClass: 'bg-[#062E22] text-[#34D399] border-[#059669] tracking-[0.04em]',
    barColor: 'bg-[#059669]',
    mixSummary: 'N5 100%',
  },
  N4: {
    level: 'N4',
    title: 'JLPT N4',
    subtitle: 'พื้นฐาน',
    kanjiBadge: '初級',
    colorClass: 'text-[#38BDF8]',
    bgClass: 'from-[#08263A] to-[#16181D]',
    borderClass: 'border-[#0284C7]/50',
    badgeClass: 'bg-[#08263A] text-[#38BDF8] border-[#0284C7] tracking-[0.04em]',
    barColor: 'bg-[#0284C7]',
    mixSummary: 'N4 70% • N5 30%',
  },
  N3: {
    level: 'N3',
    title: 'JLPT N3',
    subtitle: 'ระดับกลาง',
    kanjiBadge: '中級',
    colorClass: 'text-[#FBBF24]',
    bgClass: 'from-[#2E1F05] to-[#16181D]',
    borderClass: 'border-[#D97706]/50',
    badgeClass: 'bg-[#2E1F05] text-[#FBBF24] border-[#D97706] tracking-[0.04em]',
    barColor: 'bg-[#D97706]',
    mixSummary: 'N3 60% • N4 25% • N5 15%',
  },
  N2: {
    level: 'N2',
    title: 'JLPT N2',
    subtitle: 'ค่อนข้างสูง',
    kanjiBadge: '上級',
    colorClass: 'text-[#C084FC]',
    bgClass: 'from-[#251038] to-[#16181D]',
    borderClass: 'border-[#9333EA]/50',
    badgeClass: 'bg-[#251038] text-[#C084FC] border-[#9333EA] tracking-[0.04em]',
    barColor: 'bg-[#9333EA]',
    mixSummary: 'N2 50% • N3 30% • N4 20%',
  },
  N1: {
    level: 'N1',
    title: 'JLPT N1',
    subtitle: 'สูงสุด',
    kanjiBadge: '熟達',
    colorClass: 'text-[#FB7185]',
    bgClass: 'from-[#330D17] to-[#16181D]',
    borderClass: 'border-[#E11D48]/50',
    badgeClass: 'bg-[#330D17] text-[#FB7185] border-[#E11D48] tracking-[0.04em]',
    barColor: 'bg-[#E11D48]',
    mixSummary: 'N1 50% • N2 30% • N3 20%',
  },
};
