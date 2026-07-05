# Scary Story Pack: jump-scare mechanic + two new stories

Approved direction (Ivan): kid-triggered jump scares (option A), "actually
kinda scary" tone for the haunted-house story, plus a monster-cast story
that is funny-yet-scary. Same-device; no reading required; everything
spoken aloud.

## Tone ladder

| Story | Tone | Scare intensity |
|---|---|---|
| Luna / Pip (shipped) | gentle | none |
| Scare School (new) | funny-yet-scary | comic pops, instant relief |
| The Whispering House (new) | genuinely spooky | hard pops, delayed relief (~2s beat before the reveal) |

## Jump-scare mechanic (shared)

**Data** — `StoryNode.scare?: { x, y, w, h, pop, sting, reveal }`
- `x/y/w/h`: dare-region bbox in the 1280x720 scene (the rattling door, the
  wobbling desk). Located by SAM at generation time.
- `pop`: transparent sprite (magenta-render + chroma key, judge-gated) that
  springs out of the region.
- `sting`: sfx id — `boing` (Scare School) or `thunder` (Whispering House),
  CC0 Kenney packs, added to public/sfx.
- `reveal`: the spoken line. Whispering House inserts a ~2s pause between
  pop and reveal; Scare School reveals immediately.

**Runtime (StoryGame)** — a soft pulsing shimmer marks the dare region
(pre-reader discoverability; the narration hints at it). Tap → sprite
springs from the region center (existing spring animation), sting plays,
then `say(reveal)`. Re-tappable; replay skips nothing. Choices remain
visible throughout. No timed/auto scares anywhere (option A).

**Generation (gen_stories)** — scene prompts include the hiding spot; after
render, SAM segments the spot ("closet door") for the bbox; pop sprite via
the fix_thumbs magenta redraw pipeline with the story's reference image
attached (so the popping character matches the cast). Fallback: if SAM
can't locate the spot after retries, the node ships WITHOUT a scare rather
than with a misplaced one.

## Story 3: The Whispering House (kinda scary)

Hero: Milo, a small black kitten with a tiny yellow lantern. Premise: fetch
grandma's key from the old house on the hill during a thunderstorm.

Art: per-story style override — moody nighttime palette (deep blues and
purples, long shadows, lightning through windows, lantern glow), still
soft-shaped picture-book. `STYLE_OVERRIDES[story_id]` in gen_stories.

Structure: 13 nodes, 3 decisions/read, 6 endings; every non-ending node has
one dare-spot with tense buildup lines. Endings resolve warm (the ghost is
grandma's music box; the whisperers are owls) EXCEPT one gently unresolved:
Milo leaves with the key and something in the window waves goodbye.

## Story 4: Scare School (funny-yet-scary, wide monster cast)

Hero: Mo — small round mint-green monster, one big eye, tiny horns, the
shyest student at Scare School. Cast (each visually distinct, named in
every prompt they appear in): Principal Growlbert (huge purple furball,
secretly gentle), Fangsley (all teeth, lisps), Blobbina (pink jiggly blob),
Sir Stretch (spaghetti arms), the Twins (two heads, always arguing).

**Cast consistency**: generate `scareschool_cast.png` — a lineup group
portrait — FIRST; every node is reference-conditioned on the lineup (not on
the start scene). Extends gen_stories: optional `ref` field per story
naming the anchor image and a prompt for it.

Structure: 13 nodes, 3 decisions/read, 6 endings. Dare-spots are practice
scares by cast members (Fangsley behind the lunch counter, Blobbina in the
locker). Endings: Mo wins "Scariest Sound" with a tiny adorable boo that
makes everyone faint from laughter; Mo befriends the Shadow under the gym;
etc. Scares pop hard but reveal instantly with a giggle.

## Sounds

Two new CC0 files: `sfx/boing.mp3` (Kenney impact pack) and
`sfx/thunder.mp3` (Kenney digital audio/impact). Same static-file pattern
as the existing five.

## Testing

- Unit: story graph integrity extended — scare bboxes in-bounds, pop files
  exist, every `next` resolves, all endings reachable.
- Playwright: enter a scare node, tap the dare region → pop sprite appears
  + re-tap replays; Whispering House reveal is delayed (assert the two-step
  text/say sequence); a node whose scare was dropped by the SAM fallback
  renders without the shimmer.
- Visual: my own eyeball pass over each story's scenes + pops (the audit
  standard), plus the cast-lineup consistency check across Scare School
  nodes.

## Out of scope

Auto/timed scares; scare settings toggle (revisit only if the younger one
finds Whispering House too much — then a "gentle mode" flag hides story 3).
