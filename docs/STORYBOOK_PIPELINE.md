# Storybook pipeline — hotspot books with Veo action transitions

The "new story style": choices live **inside the picture** (the kid taps the
red door itself), tapping plays a **Veo clip of the hero doing that action**,
wrong-ish choices lead to comic **oopsie endings**, and every ending is
**bespoke to the path** that reached it. Everything is spoken aloud
(pre-readers), in the selected language where it makes sense.

## One command

```bash
bash tools/gen_storybook.sh <story_id>
```

Stages (each idempotent, resumes by file):
1. **Spec lint** (`tools/gen/story_lint.py`) — structural rules fail fast.
2. **Scenes + hotspots + scares** (`tools/gen_stories.py`) — NBP renders each
   node (reference-conditioned on the start scene or cast lineup; single-hero
   guard), SAM 3.1 locates each choice's `spot` → `choice.hot{x,y,w,h}`
   (all-or-nothing per node; tile-button fallback), scare bboxes likewise.
3. **Veo clips** (`tools/gen_story_videos.py`) — veo-3.0-fast, first frame =
   the node scene, 6s, silent, judged by frame sampling, ~700KB each →
   `public/story-video/<sid>_<nid>_<choiceIdx>.mp4` → `choice.video`.
4. **Voice** — speech-line dump (vitest harness) + `tools/gen_voice.py`
   (Gemini TTS; non-English clips keyed `lang|text` with a transcribe-back
   dialect gate).
5. **Bundle** (`tools/gen_images_ts.mjs`).
6. **Audit renders** (`tools/story_audit_render.py`) → feed the adversarial
   audit fleet before `tools/ship.sh`.

## Authoring a book (tools/gen/story_specs.py)

- Graph: `start` → 2 choices per node → ≥3 decisions deep → ≥3 endings,
  **≥1 bad ending** (`bad: True`, text ends "Oopsie ending!", comic never sad).
- Hotspot nodes: every choice carries `spot` (≤4 words, color + noun — SAM
  misses wordy phrases and thin things: strings, sticks, glass, waterlines).
  The scene prompt must place BOTH affordances "on the LEFT … on the RIGHT …,
  both large, fully visible, clearly separated".
- **Endings are bespoke**: an ending's scene must be honest about where the
  kid arrived from. The lint warns on multi-parent endings — split them
  (e.g. `end_chest_cave` vs `end_chest_wreck`) unless every parent genuinely
  lands in the same place.
- Register the spec in `STORIES` (gen_stories.py) and `HEROES`/`SPECS`
  (gen_story_videos.py).

## Quality gates before shipping

- Adversarial audit fleet on `tools/audit_out/story/<id>/` — hotspot lands on
  the named object, two options visually distinct, no duplicate hero, no text
  artifacts.
- Persona continuity panel (preschooler's-ear / continuity editor /
  consequence critic / art director) — walk every path, flag regens.
- `scripts/repro-narration.mjs` — strict-autoplay narration harness.
- `tools/ship.sh` + hash-gated live acceptance.

## Hard-won gotchas

- veo-3.1 isn't enabled on this project; veo-3.0-fast supports durations
  4/6/8s only and NO last_frame — the app crossfades clip→next scene.
- `genai.Client` is not thread-safe: one per worker thread.
- The judge over-rejects ~4:1 on singles: accept-best after one retry for
  clips; skip the dialect gate on ≤2-char lines.
- React effect order: narration is canceled in `navigate()`/popstate BEFORE
  commit (see `src/nav.ts`) — never re-add a route-keyed stopNarration effect.
- Every runtime-spoken string must be byte-identical to a generated clip key
  (`speechLines()` contract) or it falls back to robo-speech.
