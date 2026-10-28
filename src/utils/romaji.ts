/**
 * Converts Katakana characters in a string to Hiragana for unified processing,
 * while preserving the Katakana long-vowel mark 'ー'.
 */
function katakanaToHiragana(input: string): string {
  let result = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    // Katakana range U+30A1 (ァ) to U+30F6 (ヶ)
    if (code >= 0x30a1 && code <= 0x30f6) {
      result += String.fromCharCode(code - 0x60);
    } else {
      result += input[i];
    }
  }
  return result;
}

const DIGRAPH_MAP: Record<string, string> = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho', しぇ: 'she',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho', ちぇ: 'che',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  じゃ: 'ja',  じゅ: 'ju',  じょ: 'jo',  じぇ: 'je',
  ぢゃ: 'ja',  ぢゅ: 'ju',  ぢょ: 'jo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  // Loanword / extended combinations
  てぃ: 'ti',  でぃ: 'di',  てゅ: 'tyu', でゅ: 'dyu',
  とぅ: 'tu',  どぅ: 'du',
  ふぁ: 'fa',  ふぃ: 'fi',  ふぇ: 'fe',  ふぉ: 'fo', ふゅ: 'fyu',
  うぃ: 'wi',  うぇ: 'we',  うぉ: 'wo',
  ゔぁ: 'va',  ゔぃ: 'vi',  ゔぇ: 've',  ゔぉ: 'vo', ゔゅ: 'vyu',
  つぁ: 'tsa', つぃ: 'tsi', つぇ: 'tse', つぉ: 'tso',
  くぁ: 'kwa', くぃ: 'kwi', くぇ: 'kwe', くぉ: 'kwo',
  ぐぁ: 'gwa',
};

const MONOGRAPH_MAP: Record<string, string> = {
  あ: 'a',  い: 'i',   う: 'u',   え: 'e',  お: 'o',
  か: 'ka', き: 'ki',  く: 'ku',  け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su',  せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni',  ぬ: 'nu',  ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi',  ふ: 'fu',  へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi',  む: 'mu',  め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu',  よ: 'yo',
  ら: 'ra', り: 'ri',  る: 'ru',  れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'wi',  ゑ: 'we',  を: 'o',  ん: 'n',
  が: 'ga', ぎ: 'gi',  ぐ: 'gu',  げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji',  ず: 'zu',  ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji',  づ: 'zu',  で: 'de', ど: 'do',
  ば: 'ba', び: 'bi',  ぶ: 'bu',  べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi',  ぷ: 'pu',  ぺ: 'pe', ぽ: 'po',
  ゔ: 'vu',
  ぁ: 'a',  ぃ: 'i',   ぅ: 'u',   ぇ: 'e',  ぉ: 'o',
  ゃ: 'ya', ゅ: 'yu',  ょ: 'yo',  ゎ: 'wa',
  '・': ' ', '〜': '~', '～': '~',
};

/**
 * Converts a Japanese reading (Hiragana / Katakana) into Hepburn Romaji.
 */
export function kanaToRomaji(input: string): string {
  if (!input) return '';

  const text = katakanaToHiragana(input.trim());
  let out = '';
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    // Handle small tsu (っ) - doubles the next consonant
    if (ch === 'っ') {
      const nextTwo = text.slice(i + 1, i + 3);
      const nextOne = text[i + 1] || '';
      const nextRomaji = DIGRAPH_MAP[nextTwo] || MONOGRAPH_MAP[nextOne] || '';

      if (nextRomaji) {
        if (nextRomaji.startsWith('ch')) {
          out += 't';
        } else {
          const firstConsonant = nextRomaji[0];
          if (/[bcdfghjklmnpqrstvwxyz]/.test(firstConsonant)) {
            out += firstConsonant;
          }
        }
      }
      i++;
      continue;
    }

    // Handle long vowel mark (ー)
    if (ch === 'ー') {
      const lastChar = out[out.length - 1];
      if (lastChar && /[aeiou]/.test(lastChar)) {
        out += lastChar;
      }
      i++;
      continue;
    }

    // Check 2-character digraph first
    const pair = text.slice(i, i + 2);
    if (pair.length === 2 && DIGRAPH_MAP[pair]) {
      out += DIGRAPH_MAP[pair];
      i += 2;
      continue;
    }

    // Check single kana
    if (MONOGRAPH_MAP[ch] !== undefined) {
      const rom = MONOGRAPH_MAP[ch];
      // Add apostrophe after ん if followed by a vowel or y-row to avoid ambiguity
      if (ch === 'ん') {
        const nextCh = text[i + 1];
        const nextRom = nextCh ? MONOGRAPH_MAP[nextCh] : '';
        if (nextRom && /^[aiueoy]/.test(nextRom)) {
          out += "n'";
        } else {
          out += 'n';
        }
      } else {
        out += rom;
      }
      i++;
      continue;
    }

    // Fallback for non-kana characters (punctuation, spaces, etc.)
    out += ch;
    i++;
  }

  return out;
}
