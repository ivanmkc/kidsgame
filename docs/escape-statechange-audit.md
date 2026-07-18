# Escape State-Change Animation Audit

Requirement: tapping a lock/win hotspot should animate the state change
(e.g. a chest opening) and the opened state must persist for the rest of
the session.

## Current behavior

When a lock/win hotspot is tapped, the escape game plays a `PopSprite`
(a transparent sprite that springs out via Animated.spring) plus a
`SparkleBurst`, then marks the hotspot as `used`. The base scene image
never changes — the chest stays visually closed even after unlocking it.

## Mechanism 1: Diff-game patch overlays (TapScene.tsx)

**Status**: Proven in-app, directly portable.

The diff game already composites `overlays: {box: Box, source: number}[]`
over its base scene image via absolutely-positioned `<Image>` elements.
Each overlay is a crop that sits at exact scene coordinates.

For escape state changes, the same pattern applies: a used lock/win
hotspot gets an "after-patch" composited at its box coordinates, showing
the opened/used state. The patch replaces the visual in that region
permanently (the `used` array already tracks which hotspots are consumed).

**App-side work**: minimal — add `overlays` prop to the escape scene
frame, build from `state.used` + manifest `after` fields.

**Persistence**: solved by construction — once a hotspot is in `used[]`,
the patch stays composited for the rest of the session.

**Animation**: RN Animated crossfade (opacity 0→1) + optional spring
scale on the after-patch. The pop sprite already fires during the same
tap, so the crossfade and pop play together.

**Verdict**: guaranteed-shippable baseline. No new external dependencies.

## Mechanism 2: NBP mask-constrained edit (nbp.py edit_local)

**Status**: Proven in pipeline, ideal for generating after-patches.

`edit_local(base, rect, prompt)` edits a padded crop around the rect,
composites only changed pixels back, and guarantees pixel-identity
outside the edit region. The drift gate catches re-renders.

For escape after-patches: pass the hotspot box as the rect and a prompt
describing the opened state ("the toy chest is now wide open, lid raised,
empty inside"). Crop the result at the hotspot box to get a PNG patch
that overlays seamlessly on the base scene.

**Quality gates**: same drift + pro-judge pair used by diff removal.
Check: "Is the edited region a believable open state of the object, with
the background seamlessly continuing around it?"

**Generation cost**: one NBP call per state-changing hotspot (8 across
all 4 rooms). ~30s each with retries.

**Verdict**: best available tool for generating photorealistic after
states that match the existing art. The mask constraint guarantees the
patch blends perfectly.

## Mechanism 3: persistence-of-dreams overlay system

**Status**: Mature but heavyweight; useful concepts, not portable as-is.

The pod repo has:
- `SpriteOverlayDef` with `mode: 'once'` — play animation once, hold
  last frame (exactly the "animate open and stay open" semantic).
- `difference_matting.py` — extract RGBA overlay from before/after frames.
- `veo_animate` + `extract_overlay` — Veo first-frame-conditioned clip
  → difference matte → alpha animation overlay.

This pipeline could produce a short clip of a chest opening, whose last
frame equals the after-patch. However:
- Veo calls are ~60s+ each with content filters that block "door"/"key".
- Difference matting requires frame-by-frame extraction + stabilization.
- WebM alpha playback adds React Native bundle complexity.
- Per-hotspot Veo clips × 4 rooms = significant generation time.

**Verdict**: too heavy for the escape room use case. The crossfade +
after-patch approach delivers 90% of the visual payoff at 10% of the
engineering cost. Document the possibility for a future "deluxe" mode.

## Mechanism 4: Veo first-frame conditioning (gen_story_videos.py)

**Status**: Overkill for per-hotspot use.

Full-scene Veo clips run ~60s and are subject to content-filter blocks
on door/key vocabulary. A per-hotspot crop would need:
1. Crop the hotspot region from the scene.
2. Generate a Veo clip of the crop animating (chest opening).
3. Extract frames → difference matte → alpha overlay or WebM.
4. Play in-app as a one-shot overlay that holds last frame.

**Verdict**: stretch goal only. If NBP after-patches look good, this
adds motion (a lid swinging open) but the development cost is
disproportionate. Worth one experiment on the toyroom chest to document
feasibility, not to ship.

## Recommended approach

**Ship: Mechanism 1 + 2 combined.**

1. **Generate** after-patches with NBP `edit_local` for every
   state-changing hotspot (lock + win spots that visually change).
2. **Manifest**: add `after?: {x, y, w, h, patch: string}` to
   `EscapeHotspot`.
3. **App**: when a hotspot is used and has an `after` field, crossfade
   an overlay image at the hotspot's box coordinates (Animated opacity
   0→1 over 400ms, with a subtle spring scale from 0.95→1.0).
4. **Persistence**: the overlay stays composited as long as the hotspot
   is in `state.used` — which is permanent per session.

This gives the kid an immediate visual payoff ("the chest opened!")
with no new runtime dependencies, no video playback, no WebM, and
generation cost of ~4 minutes total across all rooms.

## After-patch prompts (per hotspot)

### toyroom
- `chest` (lock): "the red wooden toy chest is now wide open with the
  lid raised up, showing an empty interior lined with blue cloth"
- `pen` (win): "the wooden fence pen gate is swung wide open, with the
  golden puppy happily jumping out"

### dragoncave
- `stove` (lock): "the copper stove is now lit and glowing with warm
  orange flames visible through the grate, a golden pancake sizzling
  in a pan on top"
- `dragon` (win): "the teal baby dragon is now happily munching a
  golden pancake with its eyes closed in delight, small puff of smoke"

### rocketpad
- `rocket` (lock): "the silver rocket has an open side panel revealing
  colorful wires and circuits inside"
- `crate` (lock): "the green battery is now glowing brightly with a
  lightning bolt visible, connected to the wooden crate with a cable"
- `button` (win): "the big round blue button is pressed down and
  glowing, with rocket exhaust flames visible in the background"

### piratecove
- `pelican` (lock): "the white pelican is happily holding a blue fish
  in its beak, looking pleased"
- `chest` (win): "the brown treasure chest is now burst wide open,
  overflowing with gold coins, gems, and sparkles"
