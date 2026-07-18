# Language Dataflow Audit

Every rendered string must derive from the current `lang` at render time.
Spoken-only strings (say/useSay/saySequence) are out of scope unless they
also paint on screen.

## Audited surfaces

| File | Pattern checked | Verdict | Fix |
|------|----------------|---------|-----|
| src/i18n.ts | `t(lang, key)` resolves at call time | clean | - |
| src/lang.ts | `loadLang()` only called from App.tsx initializer | clean | - |
| src/sound.ts | `speechLang` module-level for audio clip lookup only | clean (audio, not rendered) | - |
| src/components/GameShell.tsx | `BACK_LEVELS[lang]` render-time lookup, `LangCycleChip` uses `t(lang,...)` | clean | - |
| src/components/WinOverlay.tsx | `t(lang,...)` for all labels | clean | - |
| src/components/Feedback.tsx | `t(lang,...)` for all modal text | clean | - |
| src/components/ScenePicker.tsx | `t(lang,...)` for surprise/filter labels | clean | - |
| src/games/letters/LettersGame.tsx | `useEffect([lang])` rebuilds round; `t(lang,...)` for chrome | clean | - |
| src/games/numbers/NumbersGame.tsx | `useEffect([lang])` rebuilds round; `t(lang,...)` for chrome | clean | - |
| src/games/count/CountGame.tsx | `PROMPTS[lang]` resolved at render time, not stored in state | clean | - |
| src/games/compare/CompareGame.tsx | `promptFor(round)` resolves `MORE_PROMPT[lang]`/`FEWER_PROMPT[lang]` at render time | clean | - |
| src/games/sums/SumsGame.tsx | `numberWord(lang,...)` at render time; equation is numeric | clean | - |
| src/games/sounds/SoundsGame.tsx | Round state embeds pre-translated `displayPrompt`, `caption`; no lang-change effect | **violation** | Added `useEffect([lang])` to rebuild the round |
| src/games/spell/SpellGame.tsx | `gameWordsRef` and round state are language-specific; no lang-change effect | **violation** | Added `useEffect([lang])` to rebuild word list and round |
| src/games/rhymegame/RhymeGame.tsx | `useEffect([gameLang])` rebuilds round; line 119 hardcoded English | **violation** (line 119) | Changed to `t(lang, 'rhyme.comingSoon')` |
| src/games/rules/RulesGame.tsx | Rule labels from `CATEGORY_TEXT.tap` are English (game is English-phonics by design); chrome uses `t(lang,...)` | clean | - |
| src/games/oddone/OddOneGame.tsx | `CATEGORY_TEXT.not` was English-only; rendered on screen at line 102 | **violation** | Localized `.not` to `Record<Lang, string>` in iconCategories.ts |
| src/games/iconCategories.ts | `CATEGORY_TEXT.not` was a plain English string | **violation** | Changed to `Record<Lang, string>` |
| src/games/story/StoryGame.tsx | `nodeText(n, lang)` and `choiceLabel(c, lang)` resolve at render time from manifest `t` field | clean | - |
| src/games/diff/DiffGame.tsx | `t(lang,...)` for all chrome; hardcoded `useSay` is audio-only | clean | - |
| src/games/hidden/HiddenGame.tsx | `t(lang,...)` for all chrome; hardcoded `useSay` is audio-only | clean | - |
| src/games/memory/MemoryGame.tsx | `t(lang,...)` for all chrome; hardcoded `say()` calls are audio-only | clean | - |
| src/games/shadow/ShadowGame.tsx | `t(lang,...)` for all chrome | clean | - |
| src/games/puzzle/PuzzleGame.tsx | `t(lang,...)` for all chrome | clean | - |
| src/games/spotit/SpotItGame.tsx | `t(lang,...)` for all chrome | clean | - |
| src/games/spotit/SpotItDuel.tsx | `t(lang,...)` for all chrome; "Ready... Spot!" is audio-only | clean | - |
| src/games/sticker/StickerGame.tsx | `TRAY_TABS` uses `nameKey: UIKey` resolved via `t(lang,...)` at render; `SizeChips` uses `t(lang,...)` | clean | - |
| src/games/musicbox/MusicBoxGame.tsx | (not audited, out of scope per coordination rules) | - | - |
| src/lockdown.ts | (not audited, out of scope per coordination rules) | - | - |
