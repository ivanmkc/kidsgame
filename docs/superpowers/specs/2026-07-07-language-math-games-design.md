# Word Games + Number Games suites (8 toddler games)

Ages 3–6, pre-readers: every prompt is SPOKEN (existing TTS pipeline), all
interactions are tap/drag, English-only. Reuses GameShell, difficulty filter,
WinOverlay, ScoreChip, analytics, and the spotit icon set.

## Scope (Ivan-approved 2026-07-07)

Word Games 🔤: Letter Hunt, First Sounds, Rhyme Time, Word Builder.
Number Games 🔢: Count With Me, Number Hunt, More or Less, Little Sums.

## Architecture

- `src/games/quizround/logic.ts` — shared prompt-round engine for the five
  quiz-shaped games: `makeQuizRound(rng, pool, opts) -> { prompt, tiles[],
  answerIdx }` + distractor selection (visual-confusable tiers). Pure, tested.
- `src/games/language/words.ts` — per-icon metadata: `{ icon, word, sound
  ("sss"), soundLabel ("S"), rhymeKey }` for the 31 spotit icons + 12 new
  rhyme icons (`assets/game/rhyme/`, own `RHYME_ICONS` map — spotit pools
  untouched).
- Per game: `src/games/<id>/{logic.ts,<Name>Game.tsx}` + vitest for logic.
  Voice = round-keyed `say()` effects (NEVER text-keyed — repeated prompt
  must re-speak). First-gesture replay already global.

## Games

| id | route | rounds (E/M/H) | interaction |
|---|---|---|---|
| letters | #/letters | 8/10/12 | tap target letter tile; E upper, M +lower, H sound→letter |
| sounds | #/sounds | 8/10/12 | tap picture starting with spoken phoneme; 3/4/4 choices |
| rhyme | #/rhyme | 8/10/10 | tap picture rhyming with spoken word; celebration speaks the pair |
| spell | #/spell | 4/5/6 words | tap letter tiles in order (4/5/6 tile bank); letters speak sounds; solved word pops icon + confetti |
| count | #/count | 5/6/8 | tap each critter (narrator counts aloud, critter bounces), then pick the numeral; N: 1-5/1-8/1-10 |
| numbers | #/numbers | 8/10/12 | tap target numeral; E 0-5, M 0-9, H 0-20 |
| compare | #/compare | 6/8/10 | tap the plate with MORE (H: close counts, sometimes FEWER) |
| sums | #/sums | 5/6/8 | watch +1..+3 critters arrive (animated), pick the total; sums ≤5/≤7/≤10 |

Wrong tap: wobble + sfx.wrong + re-speak prompt. Round win: sfx.good.
Game win: WinOverlay with Next → next game in the same suite.

## Content generation

- 12 rhyme icons via the existing NBP sticker pipeline (magenta key, judge):
  sun, bun, cake, snake, bear, pear, moon, spoon, tree, bee, house, mouse,
  boat, goat → pick the 12 cleanest; rhyme groups incl. frog/dog, star/car.
- Voice (gen_voice templates, ~250 short clips): letter names ("Find the
  letter A!", "A!"), ~20 phoneme prompts ("Which letter says mmm?", "Which
  one starts with sss?"), per-word confirmations ("Snake starts with sss!"),
  rhyme celebrations ("Frog... dog! They rhyme!"), numbers one–twenty,
  counting/compare/sums prompts. saySequence composes multi-part lines.

## Menu

Home menu gets section headers (Play / Word Games 🔤 / Number Games 🔢) so
19 cards stay scannable. New-game cards use a letter/number tile motif (no
art gen needed) or one NBP thumb each if the tile look is weak.

## Testing & ship

- vitest: every logic.ts (round generation, distractor rules, no-duplicate
  answers, sum arithmetic, spell validation).
- Playwright playtest extends the 33-check suite: one drive per new game
  (voice request fired, correct tap scores, win overlay).
- Audit: eyeball pass on the 12 rhyme icons (pipeline judges + my read).
- Ship via tools/ship.sh + hash-gated acceptance, as always.

## Build execution

4 parallel subagents: (1) quizround engine + words.ts + Letter/Number Hunt,
(2) First Sounds + Rhyme Time, (3) Count/Compare/Sums, (4) Word Builder.
Icon + voice generation run by the orchestrator; integration, menu, playtest,
ship by the orchestrator.
