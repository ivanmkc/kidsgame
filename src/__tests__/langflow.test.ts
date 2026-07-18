import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LANGS, Lang } from '../lang';
import { t, UIKey } from '../i18n';

// ── (a) Translation table completeness ───────────────────────────────────
// Record<UIKey, string> is compile-enforced, but this test provides a
// runtime sanity check: every key × every lang returns a non-empty string,
// and {placeholder} tokens present in EN also appear in the translation.

// Enumerate all UIKeys by re-exporting them through the type system.
// We can't iterate a string-literal union at runtime, so we import the
// EN table object and extract its keys — the TS compiler guarantees that
// table is Record<UIKey, string>.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EN_TABLE: Record<string, string> = (await import('../i18n') as any).default?.__EN ?? {};

// Fallback: if the internal __EN export isn't available, extract keys
// by calling t() on every conceivable key and checking for a crash-free
// non-empty result. More practically, we hard-code the known keys from
// the UIKey union — this list is verified by TS at compile time via the
// `satisfies UIKey[]` below.
const ALL_KEYS: UIKey[] = [
  'menu.heading', 'menu.word', 'menu.number', 'menu.grownups',
  'chip.sound', 'chip.muted', 'chip.twoPlayers', 'chip.twoPlayersOn',
  'a11y.langCycle', 'a11y.diffCycle', 'a11y.soundOn', 'a11y.soundOff', 'a11y.twoPlayer',
  'grownups.install', 'grownups.share', 'grownups.copied', 'grownups.feedback',
  'install.iosHint', 'install.iosHelp', 'share.copied',
  'filter.all', 'filter.easy', 'filter.medium', 'filter.hard',
  'filter.allLevels', 'filter.easyLevels', 'filter.mediumLevels', 'filter.hardLevels',
  'card.spotit.title', 'card.spotit.blurb',
  'card.diff.title', 'card.diff.blurb',
  'card.hidden.title', 'card.hidden.blurb',
  'card.memory.title', 'card.memory.blurb',
  'card.puzzle.title', 'card.puzzle.blurb',
  'card.shadow.title', 'card.shadow.blurb',
  'card.oddone.title', 'card.oddone.blurb',
  'card.rules.title', 'card.rules.blurb', 'card.rules.banner',
  'card.sticker.title', 'card.sticker.blurb',
  'card.story.title', 'card.story.blurb',
  'card.letters.title', 'card.letters.blurb',
  'card.sounds.title', 'card.sounds.blurb',
  'card.rhyme.title', 'card.rhyme.blurb',
  'card.spell.title', 'card.spell.blurb',
  'card.count.title', 'card.count.blurb',
  'card.numbers.title', 'card.numbers.blurb',
  'card.compare.title', 'card.compare.blurb',
  'card.sums.title', 'card.sums.blurb',
  'card.musicbox.title', 'card.musicbox.blurb',
  'picker.surprise', 'picker.diff', 'picker.hidden', 'picker.story', 'picker.sticker', 'picker.puzzle',
  'shell.letters.title', 'shell.letters.titleKana', 'shell.letters.subTap', 'shell.letters.subSound',
  'shell.numbers.title', 'shell.numbers.titleHan', 'shell.numbers.sub',
  'shell.sounds.titleEn', 'shell.sounds.titleWords', 'shell.sounds.subEn', 'shell.sounds.subWord',
  'shell.rhyme.title', 'shell.rhyme.sub',
  'shell.spell.title', 'shell.spell.sub', 'spell.hearAgain',
  'shell.count.title', 'shell.count.sub',
  'shell.compare.title', 'shell.compare.subMore', 'shell.compare.subFewer',
  'shell.sums.title', 'shell.sums.sub',
  'shell.spotit.title', 'shell.spotit.sub',
  'shell.spotitDuel.title', 'shell.spotitDuel.sub',
  'shell.diff.title', 'shell.diff.subPicker', 'shell.diff.subPlay',
  'shell.hidden.title', 'shell.hidden.subPicker', 'shell.hidden.subPlay',
  'shell.sticker.title', 'shell.sticker.subPicker', 'shell.sticker.subPlay',
  'shell.story.title', 'shell.story.subPicker',
  'shell.memory.title', 'shell.memory.sub',
  'shell.shadow.title', 'shell.shadow.sub', 'shell.shadow.subTricky',
  'shell.oddone.title', 'shell.oddone.sub',
  'shell.rules.title', 'shell.rules.sub',
  'shell.puzzle.title', 'shell.puzzle.subPicker', 'shell.puzzle.subPlay',
  'shell.musicbox.title', 'shell.musicbox.subPicker', 'shell.musicbox.subPlay',
  'overlay.next', 'overlay.nextRound', 'overlay.playAgain', 'overlay.rematch', 'overlay.rematchDuel', 'overlay.allGames',
  'win.diff', 'win.hidden', 'win.hiddenCoop', 'win.memory', 'win.memoryTie', 'win.memoryWinner',
  'win.shadow', 'win.oddone', 'win.rules', 'win.puzzle',
  'win.spotit', 'win.spotitTimed', 'win.spotitDuel', 'win.spotitDuelSub', 'win.spotitDuelSubOne',
  'win.letters', 'win.lettersKana', 'win.numbers',
  'win.sounds', 'win.soundsWords', 'win.rhyme', 'win.spell',
  'win.count', 'win.compare', 'win.sums', 'win.musicbox',
  'musicbox.intro', 'musicbox.introFree', 'musicbox.freeplay',
  'song.twinkle', 'song.mary', 'song.row', 'song.london', 'song.spider', 'song.macdonald',
  'diff.pictureA', 'diff.pictureB', 'diff.hint',
  'shadow.hint', 'shadow.hintTricky',
  'rules.memoryCheck', 'rules.ruleNumber', 'rules.doAgain', 'rules.remind', 'rules.progress',
  'puzzle.peek', 'puzzle.hint',
  'sticker.clear', 'sticker.hint',
  'sticker.tab.dressup', 'sticker.tab.characters', 'sticker.tab.animals', 'sticker.tab.nature', 'sticker.tab.food', 'sticker.tab.things',
  'sticker.size.small', 'sticker.size.medium', 'sticker.size.large',
  'sticker.charactersEmpty',
  'memory.moves', 'rhyme.comingSoon',
  'story.tryAgain', 'story.startOver', 'story.readAgain', 'story.allStories',
  'feedback.chip', 'feedback.title', 'feedback.broken', 'feedback.idea',
  'feedback.placeholder', 'feedback.cancel', 'feedback.send', 'feedback.thanks',
] satisfies UIKey[];

describe('i18n table completeness', () => {
  const langs = LANGS.map((l) => l.id);

  it.each(langs)('every UIKey in %s returns a non-empty string', (lang) => {
    const missing: string[] = [];
    for (const key of ALL_KEYS) {
      const val = t(lang as Lang, key);
      if (!val || val.trim().length === 0) missing.push(key);
    }
    expect(missing, `Missing or empty translations for ${lang}`).toEqual([]);
  });

  it.each(langs)('placeholders in EN also appear in %s', (lang) => {
    if (lang === 'en') return;
    const broken: string[] = [];
    for (const key of ALL_KEYS) {
      const en = t('en', key);
      const loc = t(lang as Lang, key);
      const enPlaceholders = en.match(/\{\w+\}/g) ?? [];
      for (const ph of enPlaceholders) {
        if (!loc.includes(ph)) broken.push(`${key}: missing ${ph}`);
      }
    }
    expect(broken, `Placeholder mismatch in ${lang}`).toEqual([]);
  });
});

// ── (b) Static-analysis regression guard ─────────────────────────────────
// Scan source files for patterns that would freeze translated text:
//   - useState(t(  or useState(() => t(  — text frozen at mount
//   - t('en'  — hardcoded lang
//   - loadLang() outside lang.ts / App.tsx — bypasses prop/context

describe('language dataflow guard', () => {
  const SRC = join(__dirname, '..');
  const GAME_SRC = join(SRC, 'games');

  function allTsFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) {
        out.push(...allTsFiles(p));
      } else if (/\.tsx?$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) {
        out.push(p);
      }
    }
    return out;
  }

  const files = [...allTsFiles(SRC), ...allTsFiles(GAME_SRC).filter((f) => !allTsFiles(SRC).includes(f))];
  // De-duplicate
  const uniqueFiles = [...new Set(files)];

  // Files that are allowed to call loadLang() (the definition and the
  // single consumer in App.tsx).
  const LOAD_LANG_ALLOWED = new Set(['lang.ts', 'App.tsx']);

  it('no useState(t( — translated text frozen at mount', () => {
    const violations: string[] = [];
    for (const file of uniqueFiles) {
      const src = readFileSync(file, 'utf-8');
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comments
        if (/^\s*\/\//.test(line)) continue;
        if (/useState\(\s*t\(/.test(line) || /useState\(\s*\(\)\s*=>\s*t\(/.test(line)) {
          violations.push(`${relative(SRC, file)}:${i + 1}`);
        }
      }
    }
    expect(violations, 'useState(t(...)) freezes translated text at mount').toEqual([]);
  });

  it("no t('en' — hardcoded lang", () => {
    const violations: string[] = [];
    for (const file of uniqueFiles) {
      const src = readFileSync(file, 'utf-8');
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*\/\//.test(line)) continue;
        if (/t\(\s*'en'/.test(line)) {
          violations.push(`${relative(SRC, file)}:${i + 1}`);
        }
      }
    }
    expect(violations, "t('en', ...) hardcodes language — use the lang prop").toEqual([]);
  });

  it('no loadLang() outside lang.ts / App.tsx', () => {
    const violations: string[] = [];
    for (const file of uniqueFiles) {
      const basename = file.split('/').pop() ?? '';
      if (LOAD_LANG_ALLOWED.has(basename)) continue;
      const src = readFileSync(file, 'utf-8');
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*\/\//.test(line)) continue;
        if (/loadLang\(\)/.test(line)) {
          violations.push(`${relative(SRC, file)}:${i + 1}`);
        }
      }
    }
    expect(violations, 'loadLang() bypasses the lang prop — use the prop/context chain').toEqual([]);
  });
});
