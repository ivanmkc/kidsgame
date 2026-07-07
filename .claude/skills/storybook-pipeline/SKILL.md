---
name: storybook-pipeline
description: Use when creating or extending a Story Path book in kidsgame — hotspot in-scene choices, Veo action-clip transitions, bespoke endings, oopsie endings, multi-language narration. Covers spec authoring rules, the one-command generator, quality gates, and every pipeline gotcha.
---

# Storybook pipeline (hotspot books)

The story style Ivan approved: choices live INSIDE the picture (kid taps the
red door itself), the tap plays a Veo clip of the hero DOING that action,
choices have real consequences (≥1 comic "oopsie ending"), and every ending's
scene is honest about the path that reached it.

## Commands

```bash
python3 tools/gen/story_lint.py           # spec lint (run first, always)
bash tools/gen_storybook.sh <story_id>    # full pipeline: scenes→hotspots→clips→voice→bundle→audit renders
python3 tools/story_audit_render.py <id>  # audit composites only
node scripts/repro-narration.mjs          # strict-autoplay narration harness (must stay green)
bash tools/ship.sh                        # gated deploy (after audits pass)
```

## Authoring a spec (tools/gen/story_specs.py)

1. Data only — nodes: `scene` (image prompt), `text` (read aloud, short and
   punchy for a 4-year-old), `choices: [{label, next, spot}]`, optional
   `scare {spot,pop,reveal,sting,delay}`, endings may set `bad: True`.
2. Structure (raised 2026-07-07, Ivan: books were "too short... less dumb"):
   2 choices per fork, ≥4 decisions on EVERY path (14-20 nodes), ≥4 endings,
   ≥1 bad ending. Narrative bar: the hero has a WANT and an obstacle;
   mid-story consequences carry forward (early item/kindness pays off
   later); callbacks/motifs; one clever twist per book; endings resolve the
   want differently per path; prose has wit for the parent reading aloud —
   no filler beats (text ends "Oopsie ending!", comic not sad —
   muddy mane, flung back to the start — never scary or punishing).
3. Hotspots: `spot` ≤4 words, color+noun ("round red door"). SAM misses
   wordy phrases and THIN/AMBIENT things (strings, sticks, glass, waterlines,
   bone shapes near a toy wall). The scene prompt MUST compose both
   affordances: "on the LEFT a …, on the RIGHT a …, both large, fully
   visible, clearly separated".
4. BESPOKE ENDINGS: the lint warns when an ending has multiple parents.
   Split it (end_chest_cave / end_chest_wreck) unless every parent genuinely
   arrives at the same place. "X marks the spot on the wrong beach" is the
   failure mode; Ivan called it out — don't reuse ending scenes lazily.
5. Register: `STORIES` in tools/gen_stories.py, `HEROES`+`SPECS` in
   tools/gen_story_videos.py. Reuse hero descriptors (LUNA, PIP, MILO, MO).

## Quality gates (all required before ship)

- **Audit fleet** on tools/audit_out/story/<id>/ — one adversarial agent per
  book: hotspot box lands on the named object (not the hero's face!), two
  options visually distinct to a 3-year-old, exactly ONE hero per frame,
  no text artifacts, boxes non-overlapping.
- **Persona continuity panel** — several reviewer lenses per book:
  preschooler's-ear (makes sense HEARD only), continuity editor
  (location/time/props carry frame-to-frame; arrival matches the tapped
  action), consequence critic (branches genuinely diverge; endings pay off
  the specific path; bad endings land as safe fun), art director (hero
  identity, style drift). Flag scene regens vs text edits; text edits are
  cheap — prefer them when they honestly bridge.
- **Narration harness** scripts/repro-narration.mjs must stay green
  (strict autoplay; asserts audio actually reaches 0.5s).

## Gotchas (each cost real debugging time)

- veo-3.1 NOT enabled on adk-coding-agents; veo-3.0-fast: durations 4/6/8s
  ONLY, no last_frame (app crossfades clip→next scene), ~45-90s per clip.
- genai.Client is NOT thread-safe — one per worker thread (threading.local).
- Judges over-reject ~4:1: clips accept-best after 1 retry; TTS dialect gate
  skipped for ≤2-char lines (single syllables can't be dialect-ID'd).
- Voice: every runtime string must be BYTE-IDENTICAL to a clip key. Games
  export speechLines(); dump via `KGB_DUMP=1 npx vitest run
  src/games/__tests__/speechdump.test.ts` (tsx can't parse RN Flow). Non-EN
  clips keyed `lang|text` (cmn/yue share written forms).
- Narration lifecycle: stopNarration() runs synchronously in navigate()/
  popstate (src/nav.ts) BEFORE React commits. NEVER add a route-keyed
  stopNarration effect in App — child effects run first and the fade kills
  the new screen's first prompt (~140ms heard). Singleton <audio> is primed
  in the first gesture (silent WAV) for iOS.
- Scene regens: condition on a KNOWN-GOOD node as ref to lock hero identity
  (luna_start was regenerated against luna_a to fix flank-mark drift); the
  generator carries a single-hero guard — keep it.
- Chroma: never plain-resize RGBA (premultiplied resize in gen/chroma.py);
  RGB under alpha=0 must stay zeroed or alpha-naive viewers resurrect the
  backdrop.
- After changing generator save semantics, RESTART any running loop —
  in-flight rounds run old code and clobber the manifest.
