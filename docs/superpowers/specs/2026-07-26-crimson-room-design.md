# Crimson Escape — design

A web-playable homage and spiritual successor to Toshimitsu Takagi's
**Crimson Room** (2004), the Flash game that founded the escape-the-room
genre. New game in the Kids Game Box, route `crimson`, aimed at the older
end of the audience (and grown-ups feeling nostalgic).

> Built autonomously per kidsgame norms (no review gates; Ivan steers by
> interrupting). Assumptions: (1) "Crimson escape room" = Crimson Room 2004;
> (2) kidsgame is the right home since it is Ivan's deployed web-game
> surface; (3) art is hand-authored SVG rather than generated PNGs so the
> game ships self-contained with no asset pipeline.

## What the original was, and what we keep

Crimson Room: you wake in a bare red room; four wall views; you hunt items
(key under the pillow, rings, battery, cassette, power cord), combine them,
power a player whose clip — famously a dancing man — reveals a hidden safe;
a code opens it; the key inside opens the door.

Kept beats: red room, four rotating wall views, pillow key, dark
under-bed, item combination, a projected dancing figure that points to the
hidden safe, 4-digit code, final door key. Modernized: USB stick instead of
cassette, in-game code clue instead of the infamous real-world URL, a hint
button, tap-select-tap interactions (mobile friendly, matches Little
Escapes), no pixel hunting — every hotspot is generous and accessible.

## Puzzle graph (golden path)

1. Pillow → **brass key**
2. Dresser bottom drawer → **flashlight (dead)**
3. Curtains → open (room brightens) → windowsill → **battery**
4. Combine battery + flashlight → **flashlight (lit)**
5. Lit flashlight on the dark under-bed → **power cord**
6. Brass key on locked top drawer → **USB stick** + **crumpled note**
   ("The code is the year this room was born.")
7. Power cord on projector, then USB stick on projector, then tap
   projector → clip: a silhouette dances, then points at the painting
8. Painting (now loose) slides aside → **wall safe**
9. Curtains-open light reveals a wall calendar frozen on **2004** — the
   homage year; note + calendar = code
10. Keypad 2-0-0-4 → safe opens → **door key**
11. Door key on door → escape, confetti

Every view and every item is used; gates: no cord without light, no light
without battery, no battery without opening curtains, no safe without the
clip, no code without note+calendar. Dead ends: none (nothing consumable
on a wrong target).

## Architecture

`src/games/crimson/`

- `logic.ts` — pure state machine, no React. `CrimsonState` (view, flags
  set, inventory, selected item), `applyTap(state, hotspotId)`,
  `selectItem`, `enterCode`, plus `nextHint(state)` returning the
  golden-path next step (drives the ? button AND the tests).
  Actions return `{ state, msg?, sfx? }`.
- `text.ts` — per-game 4-language table (en/ja/cmn/yue) for captions,
  item names, hints — per i18n.ts contract, game-internal lines stay out
  of the app-chrome table.
- `scenes.tsx` — four hand-authored SVG wall scenes (web-only; the app
  ships web) parameterized by flags (curtains open, drawers, painting,
  safe, projector beam). Crimson palette, dark wood, warm lamp light.
- `CrimsonGame.tsx` — GameShell wrapper; 4:3 stage; SVG scene as art;
  transparent absolutely-positioned Pressable hotspots (testID +
  accessibilityLabel on each, per repo convention); left/right arrows;
  inventory tray (tap = select; selecting shows the item's caption, which
  doubles as "examine"); keypad modal; projector-clip overlay (staged
  poses on a timer, ~4s); WinOverlay + Confetti on escape.

App integration (the standard 3 touch points + i18n): route `crimson` in
`KNOWN`, render branch `<CrimsonGame onHome lang />`, CardDef in
GAME_CARDS (`color '#A72636'`, `beta: true`), CardKey union member,
`previewFor('crimson')` mini-scene, and `card.crimson.*` /
`shell.crimson.*` / `win.crimson` keys in all four language tables.

Sound: existing `sfx` (tap/flip/good/wrong/win) only. No `say()` — no
pre-rendered voice clips exist for these lines and captions carry the game.

## Testing

- `logic.test.ts` (vitest, alongside the other game logic tests):
  golden-path solver — apply the full action list, assert win — proving
  the room is completable (same ethos as `verify_escape_chain.py`);
  gate tests (dark under-bed refuses without lit flashlight, drawer
  without key, painting before clip, wrong code); combine in either
  order; `nextHint` defined at every golden-path state.
- Type-level: extending `UIKey` forces all 4 language tables to compile.
- Smoke: boot `expo` web in the worktree, play the golden path in a
  browser, screenshot.

## Out of scope (YAGNI)

Multiple rooms/picker, save-game persistence, narration voice clips,
difficulty scaling, native targets, generated raster art.
