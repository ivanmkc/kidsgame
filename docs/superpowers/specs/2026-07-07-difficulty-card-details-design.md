# Difficulty card details — design

2026-07-07

## Problem

The menu's Easy/Medium/Hard chips change real gameplay knobs (rounds, pairs,
puzzle grid, hints, timer, distractors) but none of it is visible, so the
difficulties look interchangeable. Request: show what each difficulty means,
in the game cards, updating dynamically when the chip changes.

## Design

Each game card on the menu renders a small **detail pill** under its blurb
describing what the currently selected difficulty means for that game.
The text is derived from the same settings objects the games consume
(`DIFFICULTIES`, `shadowSettings`, `oddSettings`) — never hand-written
per-difficulty copy, so it cannot drift from actual gameplay.

- `difficulty.ts` gains `cardDetail(route, filter): string | null`.
- The shadow and odd-one knob functions move from their game files into
  `difficulty.ts` (games import them back), keeping every difficulty knob in
  one module. Behavior unchanged.
- `App.tsx` GameCard renders the pill when `cardDetail` returns text;
  Sticker Party and Story Path return null (free play, no difficulty).
- The pill pulses (spring scale) when its text changes so the update is
  noticeable when a chip is tapped.
- Filter `all` shows Medium's numbers — that is what round games actually
  play (`difficultyOf('all') === 'medium'`).

## Per-game detail text

| route  | derived from                         | e.g. easy → hard |
|--------|--------------------------------------|------------------|
| spotit | spotitRounds, timer                  | "10 rounds" → "14 rounds · ⏱️" |
| diff   | diffDraw, diffHint                   | "3 differences · 💡 hints" → "4 differences" |
| hidden | hiddenDraw                           | "5 hidden things" → "6 hidden things" |
| memory | memoryPairs                          | "4 pairs" → "8 pairs" |
| puzzle | puzzleCols×puzzleRows                | "3×2 pieces" → "4×3 pieces" |
| shadow | shadowSettings choices/transform     | "3 shadows" → "5 shadows · spinning" |
| oddone | oddSettings n                        | "4 tiles" → "9 tiles" |
| rules  | rulesTiles, rulesRecallFrom          | "6 tiles" → "9 tiles · memory check" |
| sticker, story | —                            | null |

## Alternatives considered

- Single summary banner under the chips: less clutter but too vague to
  answer "what's different per game".
- ⓘ popover per chip: hidden by default; kids/parents won't discover it.

## Testing

Pure-function vitest coverage: `cardDetail` output for each route at each
difficulty derives from `DIFFICULTIES` values (assert on the numbers, not
frozen strings); null for sticker/story; `all` equals `medium`.
