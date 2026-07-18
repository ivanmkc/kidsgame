# Parental Lockdown Mode — Design Document

## Problem

Ivan's kids keep changing the language and playing Story Path. He wants a
lockdown mode in settings, gated by something only an adult can pass, that
hides certain games and certain languages from the menu.

## UX Expert Panel

Three persona-based reviewers critiqued a straw-man design (hold-3s + math
gate, gear icon in "For grown-ups," full-screen settings overlay, cards
disappear from menu, localStorage persistence).

### Panel 1 — Parental-Gate Specialist

- Hold-for-3-seconds alone is insufficient for ages 5-6 (they hold in games
  all the time). Must be combined with a second challenge.
- Math questions (e.g., "What is 23 + 41?") are hard for distracted parents
  doing mental arithmetic one-handed. A reading-comprehension challenge is
  stronger: display "To continue, type the word **bicycle**" with a random
  word from a pool. Pre-readers cannot do this; any literate adult can.
- The "For grown-ups" section is the correct location (matches Sago Mini /
  YouTube Kids / PBS Kids conventions). Hidden gestures are bad — parents
  never discover them.
- The gate screen should auto-dismiss after 30 seconds of inactivity so a
  child who stumbles into it cannot experiment indefinitely.
- No lockout on failure — just generate a new word.
- COPPA is a non-issue (no personal data collected).

### Panel 2 — Preschool-UX Specialist

- Disappearing cards cause grid reflow, which breaks spatial memory.
  Recommended invisible placeholder slots to maintain layout. Counter-
  argument: the grid already reflows across screen sizes, and blank spaces
  look broken. Full removal is simpler and avoids the "why are there blank
  spots?" confusion.
- Greyed-out cards with padlock icons are worse — they invite frustrated
  tapping and tantrums. Full removal is correct.
- Silent language auto-switch mid-gameplay is disorienting. If the active
  language gets hidden, navigate the child back to the menu before switching.
- Keep the globe/language chip visible even when only one language remains
  (disable the cycle action) so the header layout stays stable.
- No child-facing lockdown indicator is correct — a visible "locked" icon
  invites curious tapping.
- Deep-link protection (silent redirect to menu) is correct and sufficient
  for this age range.

### Panel 3 — Settings-IA Reviewer

- Use plain text "Parental Controls" in the "For grown-ups" section, not a
  gear icon (gear screams "settings" and attracts curious kids).
- Drop the master "Enable lockdown" toggle — having any items hidden
  implicitly activates lockdown. Fewer concepts for the parent.
- Group games by the same categories as the menu (Games, Word Games, Number
  Games) with section headers.
- Skip live preview; the parent sees the result on the real menu immediately
  after closing settings.
- Show a subtle "Lockdown active" indicator in the "For grown-ups" section
  so parents know at a glance that restrictions are in effect.

## Synthesized Design

### Entry Point

A plain-text chip labeled "Parental Controls" in the "For grown-ups" section
at the bottom of the menu. Low-contrast, adult vocabulary, boring to kids.
When lockdown is active, a subtle "(active)" suffix appears so parents know
restrictions are in effect.

### Adult Gate (two-phase)

1. **Hold phase**: press and hold the "Parental Controls" chip for 3 seconds.
   A radial progress indicator fills. If released early, nothing happens.
2. **Type-a-word phase**: a modal appears with the instruction "To continue,
   type the word **{word}**" where `{word}` is randomly selected from a pool
   of 10-15 common English words (e.g., bicycle, giraffe, kitchen, purple,
   rocket, seven, window, garden, orange, basket). The parent types the word
   in a text input and taps "Continue."
   - Case-insensitive matching.
   - On failure: new random word, input cleared. No lockout.
   - 30-second inactivity timeout: dismiss back to menu silently.

### Settings Panel

A full-screen overlay (modal, not a route) that appears after passing the
gate. Contents:

- **Games** section: 10 game toggles matching GAME_CARDS order
- **Word Games** section: 4 game toggles matching WORD_CARDS order
- **Number Games** section: 4 game toggles matching NUMBER_CARDS order
- **Languages** section: 4 language toggles (en, ja, cmn, yue)
  - Constraint: at least one language must remain visible. If the parent
    tries to hide the last language, show a brief warning and prevent it.
- **Done** button at the bottom to close.

No master toggle — any hidden item implicitly activates lockdown.

### Behavior When Lockdown Is Active

- **Menu cards**: hidden games fully disappear from the menu (not greyed).
- **Language cycle**: hidden languages are skipped. If only one language
  remains, the globe chip stays visible but the tap handler is disabled
  (no cycle).
- **Active language hidden**: if the currently selected language gets hidden,
  auto-switch to the first allowed language. If the child is in a game,
  navigate to menu first (the language switch happens on the menu).
- **Deep links**: navigating to a hidden game's hash route (e.g., `#/story`)
  silently redirects to `#/menu`.
- **Section headers**: if ALL games in a section are hidden, that section
  header also disappears.

### Persistence

- localStorage key: `kgb.lockdown.v1`
- Value: JSON `{ hiddenGames: string[], hiddenLangs: string[] }`
- If the key is absent or empty arrays, lockdown is inactive.
- Clearing browser data resets lockdown (acceptable — re-setup is fast
  because there is nothing to forget).

### What Is NOT Lockable (v1)

- Sound/mute toggle
- Two-player toggle
- Difficulty filter

These can be added later if needed, but are out of scope for the initial
implementation to keep it focused.

## Architecture

### New Files

- `src/lockdown.ts` — pure-logic module: read/write localStorage, derive
  `visibleGames(allGames)`, `visibleLangs()`, `isGameHidden(id)`,
  `isLangHidden(lang)`, `setHiddenGames(ids)`, `setHiddenLangs(langs)`,
  `effectiveLang(currentLang)` (returns currentLang if allowed, else first
  allowed lang).
- `src/components/AdultGate.tsx` — the two-phase gate overlay (hold + type).
- `src/components/LockdownSettings.tsx` — the settings panel overlay.

### Surgical Edits to Shared Files

- `App.tsx`:
  - Import lockdown module.
  - Add `useLockdown()` state in App component.
  - Filter GAME_CARDS/WORD_CARDS/NUMBER_CARDS through `visibleGames()`.
  - Guard route: if `screen` is a hidden game, fall through to `'menu'`.
  - Add "Parental Controls" chip in Menu's "For grown-ups" section.
  - If active lang is hidden, auto-switch via `effectiveLang()`.
- `src/i18n.ts`: NO CHANGES (settings text is parent-facing, English-only).
- `src/lang.ts`: NO CHANGES.

### Test Plan

- Vitest unit tests for `src/lockdown.ts`:
  - Hiding/showing games filters card lists correctly.
  - Hiding languages filters lang cycle correctly.
  - Cannot hide all languages (at least one remains).
  - `effectiveLang` returns current lang when allowed, first allowed when not.
  - Persistence round-trips through localStorage mock.
- Playwright playtest (stretch):
  - Gate blocks random kid taps.
  - Parent can pass gate and configure.
  - Hidden games disappear from menu.
  - Hidden languages skip in cycle.
  - Settings persist across reload.
  - Deep links to hidden games redirect to menu.
