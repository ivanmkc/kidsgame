// Word metadata for the language games: English phonics (letter, spoken
// sound, rhyme family) + toddler-standard translations. Romanization is a
// caption for parents; kids play by ear.
//
// Per-language rhyme keys (jaRhyme/cmnRhyme/yueRhyme) mark FINAL-SOUND
// families for the localised Rhyme Time game — matching the final mora
// (ja) or the last-syllable final (cmn/yue) rather than translating the
// EN rhymes. Only entries that share a family with ≥1 other icon-backed
// entry carry a key; singletons stay bare so the pool builder skips them.
//
// cmnRhyme follows the 十三辙 rhyme categories, not the bare pinyin
// spelling — that is what Mandarin verse and children's rhymes actually
// rhyme by, and spelling alone gets it wrong in both directions:
//   一七 i, ü, er, apical -i  →  狮子 shīzi, 狐狸 húli, 飞机 fēijī,
//                                兔子 tùzi, 猴子 hóuzi, 鱼 yú, 章鱼 zhāngyú
//   姑苏 u                    →  猪 zhū, 礼物 lǐwù   (NOT 鱼 yú — that is ü)
//   乜斜 ie, üe               →  螃蟹 xiè, 蝴蝶 dié  (NOT 汽车 chē — that is 梭波)
//   发花 a, ia, ua            →  青蛙 wā, 考拉 lā, 花 huā, 披萨 sà
//   遥条 ao, iao              →  猫 māo, 熊猫 māo, 香蕉 jiāo
//   灰堆 ei, ui               →  草莓 méi, 向日葵 kuí
//   由求 ou, iu               →  狗 gǒu, 独角兽 shòu | 气球 qiú, 足球 qiú
//   中东 eng, ing, ong, iong  →  瓢虫 chóng, 彩虹 hóng
// 由求 is deliberately split into 'ou' and 'iu' so the game only ever
// pairs exact finals — stricter than the 辙 requires, which is the right
// side to err on when the point is teaching a kid what rhyming sounds
// like. 汽车 chē is the only 梭波 word with an icon, so it goes bare.
import { Lang } from '../../lang';

export interface WordEntry {
  icon: string; // key into SPOTIT_ICONS (or RHYME_ICONS for extras)
  en: string;
  letter: string; // uppercase initial for First Sounds / phonics
  sound: string; // spoken phoneme cue, e.g. "duh" for D
  // Other first-sounds a child could reasonably give this picture — a kid
  // says "bunny" for the rabbit and "puppy" for the dog. A phonics prompt
  // must have exactly ONE plausible answer on the board, so a tile counts
  // as carrying these sounds too (see soundsFor).
  altSounds?: string[];
  // Icons a child would call by the SAME name as this one: "flower" fits
  // the blossom and the sunflower equally, in every language. A name
  // prompt must never show two of them at once. Declared symmetrically.
  nameTwins?: string[];
  rhymeKey?: string; // words sharing a key rhyme (og, ar, at...)
  jaRhyme?: string;  // final-mora family for JA Rhyme Time (ko, na, ru...)
  cmnRhyme?: string; // last-syllable pinyin final for CMN Rhyme Time
  yueRhyme?: string; // last-syllable Jyutping final for YUE Rhyme Time
  ja: string; jaR: string;
  cmn: string; cmnR: string;
  yue: string; yueR: string;
}

export const WORDS: WordEntry[] = [
  { icon: 'dog', en: 'dog', letter: 'D', sound: 'duh', altSounds: ['puh'], /* puppy */ rhymeKey: 'og', cmnRhyme: 'ou', yueRhyme: 'au', ja: 'いぬ', jaR: 'inu', cmn: '狗', cmnR: 'gǒu', yue: '狗', yueR: 'gau' },
  { icon: 'cat', en: 'cat', letter: 'C', sound: 'kuh', rhymeKey: 'at', jaRhyme: 'ko', cmnRhyme: 'ao', yueRhyme: 'aau', ja: 'ねこ', jaR: 'neko', cmn: '猫', cmnR: 'māo', yue: '貓', yueR: 'maau' },
  { icon: 'lion', en: 'lion', letter: 'L', sound: 'lll', jaRhyme: 'n', cmnRhyme: 'i', ja: 'ライオン', jaR: 'raion', cmn: '狮子', cmnR: 'shīzi', yue: '獅子', yueR: 'si-zi' },
  { icon: 'frog', en: 'frog', letter: 'F', sound: 'fff', rhymeKey: 'og', jaRhyme: 'ru', cmnRhyme: 'a', yueRhyme: 'aa', ja: 'かえる', jaR: 'kaeru', cmn: '青蛙', cmnR: 'qīngwā', yue: '青蛙', yueR: 'cing-waa' },
  { icon: 'panda', en: 'panda', letter: 'P', sound: 'puh', cmnRhyme: 'ao', yueRhyme: 'aau', ja: 'パンダ', jaR: 'panda', cmn: '熊猫', cmnR: 'xióngmāo', yue: '熊貓', yueR: 'hung-maau' },
  { icon: 'fox', en: 'fox', letter: 'F', sound: 'fff', rhymeKey: 'ox', cmnRhyme: 'i', yueRhyme: 'ei', ja: 'きつね', jaR: 'kitsune', cmn: '狐狸', cmnR: 'húli', yue: '狐狸', yueR: 'wu-lei' },
  { icon: 'monkey', en: 'monkey', letter: 'M', sound: 'mmm', jaRhyme: 'ru', cmnRhyme: 'i', yueRhyme: 'au', ja: 'さる', jaR: 'saru', cmn: '猴子', cmnR: 'hóuzi', yue: '馬騮', yueR: 'maa-lau' },
  { icon: 'pig', en: 'pig', letter: 'P', sound: 'puh', cmnRhyme: 'u', yueRhyme: 'yu', ja: 'ぶた', jaR: 'buta', cmn: '猪', cmnR: 'zhū', yue: '豬', yueR: 'zyu' },
  { icon: 'rabbit', en: 'rabbit', letter: 'R', sound: 'rrr', altSounds: ['buh'], /* bunny */ cmnRhyme: 'i', yueRhyme: 'ai', ja: 'うさぎ', jaR: 'usagi', cmn: '兔子', cmnR: 'tùzi', yue: '兔仔', yueR: 'tou-zai' },
  { icon: 'koala', en: 'koala', letter: 'K', sound: 'kuh', cmnRhyme: 'a', yueRhyme: 'ung', ja: 'コアラ', jaR: 'koara', cmn: '考拉', cmnR: 'kǎolā', yue: '樹熊', yueR: 'syu-hung' },
  { icon: 'unicorn', en: 'unicorn', letter: 'U', sound: 'yoo', jaRhyme: 'n', cmnRhyme: 'ou', yueRhyme: 'au', ja: 'ユニコーン', jaR: 'yunikoon', cmn: '独角兽', cmnR: 'dújiǎoshòu', yue: '獨角獸', yueR: 'duk-gok-sau' },
  { icon: 'octopus', en: 'octopus', letter: 'O', sound: 'ah', jaRhyme: 'ko', cmnRhyme: 'i', yueRhyme: 'yu', ja: 'たこ', jaR: 'tako', cmn: '章鱼', cmnR: 'zhāngyú', yue: '八爪魚', yueR: 'baat-zaau-jyu' },
  { icon: 'crab', en: 'crab', letter: 'C', sound: 'kuh', cmnRhyme: 'ie', ja: 'かに', jaR: 'kani', cmn: '螃蟹', cmnR: 'pángxiè', yue: '蟹', yueR: 'haai' },
  { icon: 'fish', en: 'fish', letter: 'F', sound: 'fff', jaRhyme: 'na', cmnRhyme: 'i', yueRhyme: 'yu', ja: 'さかな', jaR: 'sakana', cmn: '鱼', cmnR: 'yú', yue: '魚', yueR: 'jyu' },
  { icon: 'butterfly', en: 'butterfly', letter: 'B', sound: 'buh', cmnRhyme: 'ie', ja: 'ちょうちょ', jaR: 'choucho', cmn: '蝴蝶', cmnR: 'húdié', yue: '蝴蝶', yueR: 'wu-dip' },
  { icon: 'ladybug', en: 'ladybug', letter: 'L', sound: 'lll', jaRhyme: 'shi', cmnRhyme: 'ong', yueRhyme: 'ung', ja: 'てんとうむし', jaR: 'tentoumushi', cmn: '瓢虫', cmnR: 'piáochóng', yue: '甲蟲', yueR: 'gaap-cung' },
  { icon: 'blossom', en: 'flower', letter: 'F', sound: 'fff', nameTwins: ['sunflower'], jaRhyme: 'na', cmnRhyme: 'a', yueRhyme: 'aa', ja: 'はな', jaR: 'hana', cmn: '花', cmnR: 'huā', yue: '花', yueR: 'faa' },
  { icon: 'sunflower', en: 'sunflower', letter: 'S', sound: 'sss', altSounds: ['fff'], nameTwins: ['blossom'], /* flower */ cmnRhyme: 'ei', yueRhyme: 'ai', ja: 'ひまわり', jaR: 'himawari', cmn: '向日葵', cmnR: 'xiàngrìkuí', yue: '向日葵', yueR: 'hoeng-jat-kwai' },
  { icon: 'apple', en: 'apple', letter: 'A', sound: 'ah', jaRhyme: 'go', ja: 'りんご', jaR: 'ringo', cmn: '苹果', cmnR: 'píngguǒ', yue: '蘋果', yueR: 'ping-gwo' },
  { icon: 'banana', en: 'banana', letter: 'B', sound: 'buh', jaRhyme: 'na', cmnRhyme: 'ao', ja: 'バナナ', jaR: 'banana', cmn: '香蕉', cmnR: 'xiāngjiāo', yue: '香蕉', yueR: 'hoeng-ziu' },
  { icon: 'strawberry', en: 'strawberry', letter: 'S', sound: 'sss', altSounds: ['buh'], /* berry */ jaRhyme: 'go', cmnRhyme: 'ei', yueRhyme: 'ei', ja: 'いちご', jaR: 'ichigo', cmn: '草莓', cmnR: 'cǎoméi', yue: '士多啤梨', yueR: 'si-do-be-lei' },
  { icon: 'pizza', en: 'pizza', letter: 'P', sound: 'puh', cmnRhyme: 'a', ja: 'ピザ', jaR: 'piza', cmn: '披萨', cmnR: 'pīsà', yue: '薄餅', yueR: 'bok-beng' },
  { icon: 'icecream', en: 'ice cream', letter: 'I', sound: 'eye', ja: 'アイスクリーム', jaR: 'aisukuriimu', cmn: '冰淇淋', cmnR: 'bīngqílín', yue: '雪糕', yueR: 'syut-gou' },
  { icon: 'balloon', en: 'balloon', letter: 'B', sound: 'buh', jaRhyme: 'n', cmnRhyme: 'iu', yueRhyme: 'au', ja: 'ふうせん', jaR: 'fuusen', cmn: '气球', cmnR: 'qìqiú', yue: '氣球', yueR: 'hei-kau' },
  { icon: 'car', en: 'car', letter: 'C', sound: 'kuh', rhymeKey: 'ar', ja: 'くるま', jaR: 'kuruma', cmn: '汽车', cmnR: 'qìchē', yue: '車', yueR: 'ce' },
  { icon: 'plane', en: 'plane', letter: 'P', sound: 'puh', cmnRhyme: 'i', yueRhyme: 'ei', ja: 'ひこうき', jaR: 'hikouki', cmn: '飞机', cmnR: 'fēijī', yue: '飛機', yueR: 'fei-gei' },
  { icon: 'rocket', en: 'rocket', letter: 'R', sound: 'rrr', altSounds: ['sss'], /* spaceship */ jaRhyme: 'to', ja: 'ロケット', jaR: 'roketto', cmn: '火箭', cmnR: 'huǒjiàn', yue: '火箭', yueR: 'fo-zin' },
  { icon: 'soccer', en: 'ball', letter: 'B', sound: 'buh', altSounds: ['sss'], /* soccer ball */ jaRhyme: 'ru', cmnRhyme: 'iu', yueRhyme: 'au', ja: 'ボール', jaR: 'booru', cmn: '足球', cmnR: 'zúqiú', yue: '足球', yueR: 'zuk-kau' },
  { icon: 'rainbow', en: 'rainbow', letter: 'R', sound: 'rrr', cmnRhyme: 'ong', yueRhyme: 'ung', ja: 'にじ', jaR: 'niji', cmn: '彩虹', cmnR: 'cǎihóng', yue: '彩虹', yueR: 'coi-hung' },
  { icon: 'star', en: 'star', letter: 'S', sound: 'sss', rhymeKey: 'ar', jaRhyme: 'shi', ja: 'ほし', jaR: 'hoshi', cmn: '星星', cmnR: 'xīngxing', yue: '星星', yueR: 'sing-sing' },
  { icon: 'gift', en: 'present', letter: 'P', sound: 'puh', altSounds: ['guh'], /* gift */ jaRhyme: 'to', cmnRhyme: 'u', ja: 'プレゼント', jaR: 'purezento', cmn: '礼物', cmnR: 'lǐwù', yue: '禮物', yueR: 'lai-mat' },
];

// Extra rhyme-pair icons (assets/game/rhyme/, RHYME_ICONS map) — generated
// by the icon pipeline; EN-only (used by Rhyme Time and Word Builder).
// New families requested for the EN-pool expansion (hat/bat, sock/rock/
// clock, box, whale/snail, jar, coat/boat/goat) are declared here so the
// data ships ahead of the icons; pool builders filter to icons on disk.
export const RHYME_WORDS: { icon: string; en: string; letter: string; sound: string; rhymeKey: string }[] = [
  { icon: 'sun', en: 'sun', letter: 'S', sound: 'sss', rhymeKey: 'un' },
  { icon: 'bun', en: 'bun', letter: 'B', sound: 'buh', rhymeKey: 'un' },
  { icon: 'cake', en: 'cake', letter: 'C', sound: 'kuh', rhymeKey: 'ake' },
  { icon: 'snake', en: 'snake', letter: 'S', sound: 'sss', rhymeKey: 'ake' },
  { icon: 'bear', en: 'bear', letter: 'B', sound: 'buh', rhymeKey: 'ear' },
  { icon: 'pear', en: 'pear', letter: 'P', sound: 'puh', rhymeKey: 'ear' },
  { icon: 'moon', en: 'moon', letter: 'M', sound: 'mmm', rhymeKey: 'oon' },
  { icon: 'spoon', en: 'spoon', letter: 'S', sound: 'sss', rhymeKey: 'oon' },
  { icon: 'tree', en: 'tree', letter: 'T', sound: 'tuh', rhymeKey: 'ee' },
  { icon: 'bee', en: 'bee', letter: 'B', sound: 'buh', rhymeKey: 'ee' },
  { icon: 'house', en: 'house', letter: 'H', sound: 'huh', rhymeKey: 'ouse' },
  { icon: 'mouse', en: 'mouse', letter: 'M', sound: 'mmm', rhymeKey: 'ouse' },
  // 'at' — pairs with cat in WORDS
  { icon: 'hat', en: 'hat', letter: 'H', sound: 'huh', rhymeKey: 'at' },
  { icon: 'bat', en: 'bat', letter: 'B', sound: 'buh', rhymeKey: 'at' },
  // 'ock' — new family
  { icon: 'sock', en: 'sock', letter: 'S', sound: 'sss', rhymeKey: 'ock' },
  { icon: 'rock', en: 'rock', letter: 'R', sound: 'rrr', rhymeKey: 'ock' },
  { icon: 'clock', en: 'clock', letter: 'C', sound: 'kuh', rhymeKey: 'ock' },
  // 'ox' — pairs with fox in WORDS
  { icon: 'box', en: 'box', letter: 'B', sound: 'buh', rhymeKey: 'ox' },
  // 'ale' — new family
  { icon: 'whale', en: 'whale', letter: 'W', sound: 'wuh', rhymeKey: 'ale' },
  { icon: 'snail', en: 'snail', letter: 'S', sound: 'sss', rhymeKey: 'ale' },
  // 'ar' — joins car/star in WORDS
  { icon: 'jar', en: 'jar', letter: 'J', sound: 'juh', rhymeKey: 'ar' },
  // 'oat' — new family
  { icon: 'coat', en: 'coat', letter: 'C', sound: 'kuh', rhymeKey: 'oat' },
  { icon: 'boat', en: 'boat', letter: 'B', sound: 'buh', rhymeKey: 'oat' },
  { icon: 'goat', en: 'goat', letter: 'G', sound: 'guh', rhymeKey: 'oat' },
];

export function wordFor(e: WordEntry, lang: Lang): { text: string; roman: string } {
  if (lang === 'ja') return { text: e.ja, roman: e.jaR };
  if (lang === 'cmn') return { text: e.cmn, roman: e.cmnR };
  if (lang === 'yue') return { text: e.yue, roman: e.yueR };
  return { text: e.en, roman: '' };
}

/** Every first-sound this picture could plausibly be called by — the
 *  canonical phonics sound plus any child-name alternates. A phonics
 *  prompt for sound S must find exactly one tile whose set contains S. */
export function soundsFor(e: WordEntry): string[] {
  return e.altSounds?.length ? [e.sound, ...e.altSounds] : [e.sound];
}

/** Icons a kid would answer with under the same spoken name as `icon`
 *  ("flower" → blossom AND sunflower). Two of these must never share a
 *  board or a tile row. */
export function nameTwinsOf(icon: string): string[] {
  return WORDS.find((w) => w.icon === icon)?.nameTwins ?? [];
}
