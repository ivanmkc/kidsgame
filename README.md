# Kids Game Box 🎪

An Expo (React Native + web) app bundling three kids mini-games:

- **Spot It!** 👀 — two cards, tap the one picture that appears on both. The deck is a projective plane of order 5 (31 cards, 6 symbols each), so any two cards share *exactly* one symbol.
- **Find the Difference** 🔍 — two copies of a themed scene (Farm / Ocean / Party / Space) with 4 differences: objects swapped or removed. Tap them in either picture.
- **Hidden Objects** 🕵️ — a busy scene (Toy Box / Jungle / Kitchen) with a 5-item checklist. Each target appears exactly once.

All art is emoji — no asset pipeline. Boards are generated from a seeded PRNG so every play is different but fully reproducible in tests.

## Play

Web build deploys to GitHub Pages: https://ivanmkc.github.io/kidsgame/

## Develop

```bash
npm install
npm run web          # dev server in the browser
npm test             # vitest suite for the game-logic modules
npx expo start       # native (Expo Go on a phone)
```

## Structure

```
App.tsx                     menu + screen switching
src/rng.ts                  seeded PRNG (mulberry32)
src/games/spotit/logic.ts   projective-plane deck + round dealing
src/games/diff/logic.ts     scene generation + difference injection
src/games/hidden/logic.ts   target/filler placement
src/games/*/​*Game.tsx       game screens
src/components/             GameShell (header), WinOverlay
```

## Deploy

```bash
npx expo export --platform web   # writes dist/ (baseUrl /kidsgame for Pages)
# push dist/ to the gh-pages branch
```
