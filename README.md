# Kids Game Box 🎪

An Expo (React Native + web) collection of five kids games, with **all art generated
by Nano Banana Pro** (`gemini-3-pro-image-preview` on Vertex AI) and gameplay ground
truth guaranteed by construction.

**Play:** https://ivanmkc.github.io/kidsgame/

## Games

| Game | How it works |
|---|---|
| 👀 **Spot It!** | Two cards, tap the one picture on both. Deck is a projective plane of order 5 — any two cards share exactly one symbol. 31 generated sticker sprites. |
| 🔍 **Find the Difference** | Six themed scenes (Farm, Ocean, Party, Space, 👑 Princess Castle, 🦄 Unicorn Meadow), 4 verified differences each. |
| 🕵️ **Hidden Objects** | Five scenes (Toy Room, Jungle, Kitchen, 👑 Princess Ballroom, 🧚 Fairy Garden), 5 objects hidden in each. |
| 🧠 **Memory Match** | 6 pairs of the sticker icons, classic flip-and-match. |
| 🧩 **Picture Puzzle** | Any scene sliced 3×3, tap two tiles to swap. |

Player profiles (two kids, renamable, avatar choice) personalize the win screens.
Scene pickers let each kid choose her theme.

## How the art pipeline keeps gameplay honest

`tools/generate_assets.py` (Python, Vertex ADC — no API keys):

1. **Icons** — NBP draws stickers on a magenta backdrop; border-median chroma-key →
   trimmed transparent sprites; a vision judge confirms each subject.
2. **Scenes** — NBP generates the base illustration; every difference / hidden object
   is added by **patch-local masked inpainting**: the model only ever sees a padded
   crop around the target rect, the edit is composited back so pixels outside the
   rect are untouched — the rect *is* the tap hitbox, exactly.
3. **Verification** — pixel gates (min/max change, context-ring drift) catch
   non-edits and re-renders; a strict-min two-question vision judge (Gemini Flash)
   confirms each change is visible to a young child and naturally blended. Failed
   objects are swapped from an alternates pool and retried; scenes only ship
   complete.

The manifest (`src/assets/manifest.json`) carries scene metadata + hitboxes and is
validated by the vitest suite (bounds, overlaps, counts, files on disk).

## Develop

```bash
npm install
npm run web                       # dev server
npm test                          # vitest: game logic + manifest invariants
python3 tools/generate_assets.py  # regenerate art (resumable; --only icons,diff,hidden,ui)
python3 tools/compress_assets.py  # scenes PNG→JPEG + manifest rewrite
node tools/gen_images_ts.mjs      # regenerate the static require() map
```

## Deploy

```bash
npx expo export --platform web    # baseUrl /kidsgame → dist/
# push dist/ (+ .nojekyll) to the gh-pages branch
```
