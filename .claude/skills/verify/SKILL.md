---
name: verify
description: How to build, run, and drive Kids Game Box end-to-end for verification (web surface, Playwright).
---

# Verifying Kids Game Box

Surface: the exported web app (Expo web). Production lives at
https://ivanmkc.github.io/kidsgame/ (gh-pages). Local run:

```bash
npx expo export --platform web          # baseUrl is /kidsgame
mkdir -p /tmp/serve && ln -sfn "$PWD/dist" /tmp/serve/kidsgame
(cd /tmp/serve && python3 -m http.server 8735 &)
# open http://localhost:8735/kidsgame/
```

Drive with Playwright from a repo that has it installed (e.g.
`~/termchart/node_modules/playwright`). Every interactive element has a
`data-testid`:

- difficulty (menu, persisted in localStorage kgb.difficulty.v1): `difficulty-easy|medium|hard`
- menu: `menu-spotit|diff|hidden|memory|puzzle|shadow|oddone|rules`
- games: `spotit-score`, `top-symbol-N`/`bottom-symbol-N` (answer = the testid
  present on both cards); `scene-pick-<id>`, `scene-surprise`; diff hitboxes
  `left-target-i`/`right-target-i` (invisible pressables = ground truth);
  `hidden-target-<id>`, `checklist-<id>`; `memory-card-<key>-<icon>` (pairs by
  icon suffix); `puzzle-tile-<pos>-piece-<piece>` (solved when pos==piece);
  `shadow-answer-<icon>` on the silhouette, `shadow-option-<icon>`;
  `oddone-item-<i>-<icon>[-odd]` (tap the `-odd` one; question banner =
  `oddone-question-<cat>`); Rule Time: `rules-rule-<cat>[-recall]` (recall
  header says "Memory check!" and repeats an EARLIER rule), tiles
  `rules-tile-<i>-<icon>-y|n` (tap all `-y`), `rules-score`, `rules-progress`;
  `win-overlay`, `play-again`, `win-home`, `back-button`, `diff-hint`.
  Win buttons arm ~600ms after the overlay shows — wait ≥750ms before clicking.

Routes live in the URL hash (`#/diff/unicorn`) — deep-link straight into any
screen; browser back/forward are part of the surface. Rounds scale with the
selected difficulty — read totals from the score chip (`N/M`), never hardcode
(Rule Time is always 10 rounds; recall rounds exist on medium/hard only).

Gotchas:
- Wait for fonts + entrance animations (~1s) before screenshots.
- The diff hint button only appears after ~20s without a find (easy players).
- Ready-made flows: `playtest.mjs` (full pass/fail run) and `verify_probes.mjs`
  (edge probes) — job tmp dirs of past sessions, or rewrite from the testids above.
