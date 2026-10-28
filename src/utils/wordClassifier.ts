import { WordCategory } from '../types';

const KANJI_CHAR_REGEX = /[\u4E00-\u9FAF\u3400-\u4DBF]/;
const KATAKANA_ONLY_REGEX = /^[\u30A0-\u30FF・ー\s]+$/;
const PURE_HIRAGANA_REGEX = /^[\u3040-\u309F\s]+$/;

/**
 * Japanese nouns ending in い (derived from verb continuative stems)
 * that should NOT be classified as i-adjectives.
 */
const NON_ADJ_NOUNS_ENDING_IN_I = new Set<string>([
  '匂い',
  '勢い',
  '扱い',
  '戦い',
  '争い',
  '疑い',
  '願い',
  '思い',
  '笑い',
  '誓い',
  '祝い',
  '呪い',
  '救い',
  '報い',
  '装い',
  '住まい',
  '雇い',
  '振る舞い',
  '見舞い',
  '手伝い',
  '付き合い',
  '出会い',
  '違い',
  '間違い',
  '向かい',
  '支払い',
  '売り上げ',
]);

const ADJ_ENGLISH_EXACT_REGEX =
  /^(bright|dark|warm|cold|hot|cool|sweet|bitter|spicy|sour|high|low|long|short|wide|narrow|thick|thin|heavy|light|fast|slow|early|late|young|old|new|good|bad|big|small|large|tiny|huge|strong|weak|hard|soft|easy|difficult|dangerous|safe|noisy|quiet|clean|dirty|pretty|beautiful|ugly|happy|sad|lonely|glad|busy|free|full|empty|rich|poor|clever|smart|stupid|kind|polite|rude|strict|gentle|serious|careful|famous|popular|common|rare|strange|weird|funny|interesting|boring|tiring|painful|scary|afraid|ashamed|jealous|proud|vivid|vague|subtle|acute|intense|eternal|infinite|humble|arrogant|brave|cowardly|fierce|calm|pale|dizzy|dull|sharp|rough|smooth|tight|loose|wet|dry|raw|ripe|rotten|fresh|pure|dense|sparse|steep|shallow|deep|broad|vast|immense|minute|slight|grand|shabby|neat|tidy|messy|faint|dim|dazzling|gloomy|cheerful|lively|convenient|inconvenient|necessary|unnecessary|important|various|healthy|energetic|skillful|clumsy|fond of|disliked|complex|simple|accurate|exact|ambiguous|delicate|bold|elaborate|exquisite|splendid|magnificent|miserable|pitiful|cruel|brutal|violent|mild|moderate|tranquil|peaceful|urgent|sudden|abrupt|gradual|steady|constant|frequent|scarce|abundant|plentiful|fertile|barren|sterile|stale|salty|savory|bland|delicious|tasty|awful|terrible|horrible|wonderful|marvelous|excellent|superb|inferior|superior|equal|similar|different|distinct|peculiar|unique|typical|normal|abnormal|odd|curious|mysterious|obscure|obvious|evident|clear|plain|certain|sure|uncertain|doubtful|suspicious|anxious|uneasy|relieved|satisfied|disappointed|grateful|thankful|sorry|regretful|embarrassed|boastful|modest|honest|sincere|faithful|loyal|courageous|timid|lazy|diligent|industrious|patient|impatient|stubborn|obstinate|flexible|severe|stern|lenient|generous|stingy|greedy|selfish|tender|affectionate|indifferent)\b/i;

const ADV_ENGLISH_EXACT_REGEX =
  /^(very|quite|really|almost|finally|gradually|suddenly|always|often|sometimes|usually|never|seldom|rarely|already|still|yet|soon|immediately|at once|right away|by all means|of course|naturally|fortunately|unfortunately|perhaps|maybe|probably|certainly|surely|absolutely|completely|entirely|totally|partly|slightly|a little|somewhat|rather|fairly|extremely|exceedingly|especially|particularly|mainly|chiefly|mostly|generally|normally|originally|initially|eventually|ultimately|after all|in the end|at last|at first|first of all|for example|for instance|in other words|that is to say|therefore|consequently|however|nevertheless|moreover|furthermore|besides|in addition|on the other hand|by the way|meanwhile|in the meantime|as a result)\b/i;

const CONCRETE_HIRAGANA_NOUN_TH_REGEX =
  /^(ตรง|ที่|ทาง|สิ่ง|อัน|คน|ท่าน|คุณ|ฉัน|ผม|เรา|ใคร|อะไร|ไหน|เมื่อไหร่|ทำไม|อย่างไร|ร่ม|รองเท้า|เก้าอี้|โต๊ะ|ปลา|ไข่|เด็ก|ผู้ใหญ่|ผู้ชาย|ผู้หญิง|หมา|แมว|นก|น้ำ|ชา|ขนม|โซบะ|อุด้ง|ราเม็ง|สตรอว์เบอร์รี|แอปเปิล|ส้ม)/;

/**
 * Extracts unique Kanji characters (in order of appearance) from a Japanese expression.
 */
export function extractKanjiChars(expression: string): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const ch of expression) {
    if (KANJI_CHAR_REGEX.test(ch) && !seen.has(ch)) {
      seen.add(ch);
      list.push(ch);
    }
  }
  return list;
}

/**
 * Classifies a Japanese vocabulary entry into one of the 6 core word categories:
 * - NOUN (คำนาม)
 * - VERB (คำกริยา)
 * - ADJECTIVE (คำคุณศัพท์)
 * - LOANWORD (คำทับศัพท์)
 * - ADVERB_PHRASE (คำวิเศษณ์/วลี)
 * - AFFIX (คำเติม)
 */
export function classifyWordCategory(
  expression: string,
  reading: string,
  meaning: string,
  meaningTh: string
): WordCategory {
  const e = expression.split(';')[0].trim();
  const r = (reading || e).split(';')[0].trim();
  const m = meaning.toLowerCase().trim();
  const th = meaningTh.trim();

  // 1. AFFIX (คำเติม / ลักษณนาม / อุปสรรค / ปัจจัย)
  if (
    /^[〜～\-]/.test(e) ||
    /[〜～\-]$/.test(e) ||
    /^[〜～\-]/.test(r) ||
    /[〜～\-]$/.test(r) ||
    m.startsWith('counter for') ||
    m.includes('prefix') ||
    m.includes('suffix') ||
    th.startsWith('ลักษณนาม') ||
    th.startsWith('คำอุปสรรค') ||
    th.startsWith('คำปัจจัย') ||
    th.startsWith('คำต่อท้าย') ||
    th.startsWith('คำนำหน้า')
  ) {
    return 'AFFIX';
  }

  // 2. LOANWORD (คำทับศัพท์ / คาตาคานะ)
  if (KATAKANA_ONLY_REGEX.test(e)) {
    return 'LOANWORD';
  }

  // 3. VERB (คำกริยา)
  const firstGlossEn = m.split(/[;,]/)[0].trim();
  if (
    /^to\s+[a-z]/.test(firstGlossEn) ||
    m.includes('(v.') ||
    e.endsWith('する')
  ) {
    return 'VERB';
  }

  // 4. ADJECTIVE (คำคุณศัพท์ い / な)
  const isIAdjEnding =
    e.endsWith('い') &&
    r.endsWith('い') &&
    e.length >= 2 &&
    !NON_ADJ_NOUNS_ENDING_IN_I.has(e) &&
    !th.startsWith('การ') &&
    !th.startsWith('ความ');

  const isNaAdjEnding =
    e.endsWith('的') ||
    e.endsWith('な') ||
    e.endsWith('やか') ||
    e.endsWith('らか');

  const adjEnglishExact = ADJ_ENGLISH_EXACT_REGEX.test(firstGlossEn);

  if (
    isIAdjEnding ||
    isNaAdjEnding ||
    (adjEnglishExact && !th.startsWith('การ') && !th.startsWith('ความ'))
  ) {
    return 'ADJECTIVE';
  }

  // 5. ADVERB_PHRASE (คำวิเศษณ์/วลี/คำเชื่อม/คำอุทาน)
  const isPureHiragana = PURE_HIRAGANA_REGEX.test(e);
  const isAdvMeaning =
    m.includes('!') ||
    ADV_ENGLISH_EXACT_REGEX.test(firstGlossEn) ||
    /^[a-z]+ly$/.test(firstGlossEn) ||
    th.startsWith('อย่าง') ||
    th.startsWith('ค่อยๆ') ||
    th.startsWith('ในที่สุด') ||
    th.startsWith('แน่นอน') ||
    th.startsWith('บางที') ||
    th.startsWith('อาจจะ');

  const isConcreteHiraganaNoun =
    isPureHiragana &&
    CONCRETE_HIRAGANA_NOUN_TH_REGEX.test(th) &&
    !m.includes('!');

  if (isAdvMeaning || (isPureHiragana && !isConcreteHiraganaNoun)) {
    return 'ADVERB_PHRASE';
  }

  // 6. NOUN (คำนาม)
  return 'NOUN';
}
