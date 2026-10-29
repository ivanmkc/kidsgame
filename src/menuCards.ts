import { Lang, LANGS } from './lang';
import { t, UIKey } from './i18n';
import { manifest } from './manifest';
import { colors } from './theme';

// Card catalogue: route (drives testID + navigation) + color + preview key
// + i18n key root. Titles/blurbs resolve at render time via t(lang, ...) so
// the language chip flips the whole menu without a remount. `key` is
// strongly typed so `card.${key}.title` composes to a valid UIKey.
export type CardKey =
  | 'letters'
  | 'sounds'
  | 'rhyme'
  | 'spell'
  | 'listenchoose'
  | 'count'
  | 'numbers'
  | 'compare'
  | 'sums'
  | 'spotit'
  | 'diff'
  | 'hidden'
  | 'memory'
  | 'puzzle'
  | 'shadow'
  | 'oddone'
  | 'rules'
  | 'sticker'
  | 'story'
  | 'bingo'
  | 'musicbox'
  | 'escape'
  | 'carmode'
  | 'highlow'
  | 'bells'
  | 'echobeat'
  | 'steadybeat'
  | 'fastslow'
  | 'samediff'
  | 'cm-numdots'
  | 'cm-numhan'
  | 'cm-shapes'
  | 'cm-animals'
  | 'cm-picword'
  | 'cm-picspeak';

export interface CardDef {
  route: string;
  color: string;
  key: CardKey;
  preview: string;
  beta?: boolean;
}

export const WORD_CARDS: CardDef[] = [
  { route: 'letters', color: '#E85D75', key: 'letters', preview: 'icons0' },
  { route: 'sounds', color: '#5DA9E8', key: 'sounds', preview: 'icons8' },
  { route: 'rhyme', color: '#9C6FD6', key: 'rhyme', preview: 'icons13' },
  { route: 'spell', color: '#4FB06D', key: 'spell', preview: 'icons20' },
  { route: 'listenchoose', color: '#E8874F', key: 'listenchoose', preview: 'icons0' },
  { route: 'cm-picword', color: '#E8874F', key: 'cm-picword', preview: 'icons0' },
  { route: 'cm-picspeak', color: '#4FB06D', key: 'cm-picspeak', preview: 'icons8' },
];

export const NUMBER_CARDS: CardDef[] = [
  { route: 'count', color: '#E8A24F', key: 'count', preview: 'icons0' },
  { route: 'numbers', color: '#3E9BB8', key: 'numbers', preview: 'icons8' },
  { route: 'compare', color: '#D66FA8', key: 'compare', preview: 'icons13' },
  { route: 'sums', color: '#7A6FD6', key: 'sums', preview: 'icons20' },
  { route: 'cm-numdots', color: '#4FB06D', key: 'cm-numdots', preview: 'icons8' },
  { route: 'cm-numhan', color: '#E85D75', key: 'cm-numhan', preview: 'icons8' },
];

// tools/ship.sh holds Little Escapes' rooms back while its clean plates fail
// the escape gates; with no rooms in the deploy, the card and the #/escape
// route go too. Dev builds (full manifest) keep both.
export const ESCAPE_SHIPPED = (manifest.escape?.length ?? 0) > 0;

export const GAME_CARDS: CardDef[] = [
  { route: 'spotit', color: colors.red, key: 'spotit', preview: 'icons0' },
  { route: 'diff', color: colors.teal, key: 'diff', preview: 'diff' },
  { route: 'hidden', color: colors.purple, key: 'hidden', preview: 'hidden' },
  { route: 'memory', color: colors.green, key: 'memory', preview: 'icons8' },
  { route: 'puzzle', color: colors.gold, key: 'puzzle', preview: 'puzzle' },
  { route: 'shadow', color: colors.ink, key: 'shadow', preview: 'icons13' },
  { route: 'oddone', color: '#E8874F', key: 'oddone', preview: 'icons20' },
  { route: 'rules', color: '#3E9BB8', key: 'rules', preview: 'rules' },
  { route: 'sticker', color: '#D66FA8', key: 'sticker', preview: 'icons0' },
  { route: 'story', color: '#7A6FD6', key: 'story', preview: 'story' },
  { route: 'bingo', color: '#D66FA8', key: 'bingo', preview: 'bingo' },
  { route: 'cm-shapes', color: colors.teal, key: 'cm-shapes', preview: 'icons8' },
  { route: 'cm-animals', color: '#E8874F', key: 'cm-animals', preview: 'icons8' },
  // musicbox hidden pending redesign — v1 missed the Sago Mini interaction
  // model (route stays live for dev via #/musicbox deep link).
  // { route: 'musicbox', color: '#E8A24F', key: 'musicbox', preview: 'musicbox' },
  ...(ESCAPE_SHIPPED
    ? [{ route: 'escape', color: '#4FB06D', key: 'escape', preview: 'escape', beta: true } as CardDef]
    : []),
  // carmode hidden pending rework (route stays live via #/carmode; its
  // round engine is being reused by the music training games).
  // { route: 'carmode', color: '#E8A24F', key: 'carmode', preview: 'carmode' },
];

export const MUSIC_CARDS: CardDef[] = [
  { route: 'highlow', color: '#5DA9E8', key: 'highlow', preview: 'music', beta: true },
  { route: 'bells', color: '#FFC24B', key: 'bells', preview: 'music', beta: true },
  { route: 'echobeat', color: '#E8874F', key: 'echobeat', preview: 'music', beta: true },
  { route: 'steadybeat', color: '#9B7EDE', key: 'steadybeat', preview: 'music', beta: true },
  { route: 'fastslow', color: '#2FB8AC', key: 'fastslow', preview: 'music', beta: true },
  { route: 'samediff', color: '#E8564F', key: 'samediff', preview: 'music', beta: true },
];

export const ALL_MENU_CARDS: CardDef[] = [...GAME_CARDS, ...WORD_CARDS, ...NUMBER_CARDS, ...MUSIC_CARDS];

export interface GameEntry {
  id: string;
  label: string;
}

export interface GameSection {
  title: string;
  games: GameEntry[];
}

export function buildGameSections(lang: Lang): GameSection[] {
  return [
    {
      title: t(lang, 'menu.section.games'),
      games: GAME_CARDS.map((c) => ({
        id: c.route,
        label: t(lang, `card.${c.key}.title` as UIKey),
      })),
    },
    {
      title: t(lang, 'menu.section.word'),
      games: WORD_CARDS.map((c) => ({
        id: c.route,
        label: t(lang, `card.${c.key}.title` as UIKey),
      })),
    },
    {
      title: t(lang, 'menu.section.number'),
      games: NUMBER_CARDS.map((c) => ({
        id: c.route,
        label: t(lang, `card.${c.key}.title` as UIKey),
      })),
    },
    {
      title: t(lang, 'menu.section.music'),
      games: MUSIC_CARDS.map((c) => ({
        id: c.route,
        label: t(lang, `card.${c.key}.title` as UIKey),
      })),
    },
  ];
}

export function countHidden(hiddenGames: string[], hiddenLangs: string[]): number {
  const activeRoutes = new Set(ALL_MENU_CARDS.map((c) => c.route));
  const validGamesCount = hiddenGames.filter((id) => activeRoutes.has(id)).length;
  const activeLangs = new Set(LANGS.map((l) => l.id));
  const validLangsCount = hiddenLangs.filter((l) => activeLangs.has(l as Lang)).length;
  return validGamesCount + validLangsCount;
}
