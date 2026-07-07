import { Platform } from 'react-native';

// Language mode for the Word/Number game suites: English, Japanese,
// Mandarin, Cantonese. Vocabulary and counting localize; English-phonics
// games (rhyme, spelling, letter sounds) stay English in every mode.
export type Lang = 'en' | 'ja' | 'cmn' | 'yue';

export const LANGS: { id: Lang; label: string; emoji: string }[] = [
  { id: 'en', label: 'English', emoji: '🌎' },
  { id: 'ja', label: '日本語', emoji: '🌸' },
  { id: 'cmn', label: '普通话', emoji: '🐼' },
  { id: 'yue', label: '廣東話', emoji: '🥟' },
];

const KEY = 'kgb.lang.v1';

export function loadLang(): Lang {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const v = window.localStorage?.getItem(KEY);
    if (v === 'en' || v === 'ja' || v === 'cmn' || v === 'yue') return v;
  }
  return 'en';
}

export function saveLang(l: Lang): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try { window.localStorage.setItem(KEY, l); } catch { /* ok */ }
  }
}

export function nextLang(l: Lang): Lang {
  const order = LANGS.map((x) => x.id);
  return order[(order.indexOf(l) + 1) % order.length];
}

// Counting words 1..20 per language (spoken text + romanization caption).
const NUM: Record<Lang, { t: string; r: string }[]> = {
  en: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'
    .split(' ').map((t) => ({ t, r: '' })),
  ja: [
    { t: 'いち', r: 'ichi' }, { t: 'に', r: 'ni' }, { t: 'さん', r: 'san' }, { t: 'よん', r: 'yon' },
    { t: 'ご', r: 'go' }, { t: 'ろく', r: 'roku' }, { t: 'なな', r: 'nana' }, { t: 'はち', r: 'hachi' },
    { t: 'きゅう', r: 'kyuu' }, { t: 'じゅう', r: 'juu' }, { t: 'じゅういち', r: 'juu-ichi' },
    { t: 'じゅうに', r: 'juu-ni' }, { t: 'じゅうさん', r: 'juu-san' }, { t: 'じゅうよん', r: 'juu-yon' },
    { t: 'じゅうご', r: 'juu-go' }, { t: 'じゅうろく', r: 'juu-roku' }, { t: 'じゅうなな', r: 'juu-nana' },
    { t: 'じゅうはち', r: 'juu-hachi' }, { t: 'じゅうきゅう', r: 'juu-kyuu' }, { t: 'にじゅう', r: 'ni-juu' },
  ],
  cmn: [
    { t: '一', r: 'yī' }, { t: '二', r: 'èr' }, { t: '三', r: 'sān' }, { t: '四', r: 'sì' },
    { t: '五', r: 'wǔ' }, { t: '六', r: 'liù' }, { t: '七', r: 'qī' }, { t: '八', r: 'bā' },
    { t: '九', r: 'jiǔ' }, { t: '十', r: 'shí' }, { t: '十一', r: 'shí-yī' }, { t: '十二', r: 'shí-èr' },
    { t: '十三', r: 'shí-sān' }, { t: '十四', r: 'shí-sì' }, { t: '十五', r: 'shí-wǔ' },
    { t: '十六', r: 'shí-liù' }, { t: '十七', r: 'shí-qī' }, { t: '十八', r: 'shí-bā' },
    { t: '十九', r: 'shí-jiǔ' }, { t: '二十', r: 'èr-shí' },
  ],
  yue: [
    { t: '一', r: 'jat' }, { t: '二', r: 'ji' }, { t: '三', r: 'saam' }, { t: '四', r: 'sei' },
    { t: '五', r: 'ng' }, { t: '六', r: 'luk' }, { t: '七', r: 'cat' }, { t: '八', r: 'baat' },
    { t: '九', r: 'gau' }, { t: '十', r: 'sap' }, { t: '十一', r: 'sap-jat' }, { t: '十二', r: 'sap-ji' },
    { t: '十三', r: 'sap-saam' }, { t: '十四', r: 'sap-sei' }, { t: '十五', r: 'sap-ng' },
    { t: '十六', r: 'sap-luk' }, { t: '十七', r: 'sap-cat' }, { t: '十八', r: 'sap-baat' },
    { t: '十九', r: 'sap-gau' }, { t: '二十', r: 'ji-sap' },
  ],
};

export function numberWord(lang: Lang, n: number): { t: string; r: string } {
  return NUM[lang][n - 1] ?? { t: String(n), r: '' };
}

// Hanzi/kanji numeral tiles for the JA/zh hard tiers.
export const HAN_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
