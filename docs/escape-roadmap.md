# Escape Rooms: Roadmap Proposals

Proposals for making escape rooms better. None of these are committed work —
this is a priority conversation starter.

## More rooms

The current four rooms (toyroom, dragoncave, rocketpad, piratecove) cover easy
and medium difficulty. Next rooms could introduce:

- A **hard** room with 3 items and a longer chain (the tray supports 3).
- Theme variety: underwater, space station, haunted library, jungle treehouse.
- Seasonal rooms (winter/holiday themed) that rotate in.

Each new room is spec-driven (add to `escape_specs.py`), and the existing
pipeline generates scene, hotspots, pops, and state scenes automatically.

## Discovery-delight pass

The escape rooms currently play silently except for spoken lines. Adding
sensory moments at key state changes would make them feel alive:

- **Sound effects at state transitions**: a creaking sound when the chest opens,
  a sizzle when the stove lights, a whoosh for blast-off. Wire into the
  `onSpot` handler alongside the crossfade.
- **Scare-style reveals**: borrow the StoryGame's `StoryScare` pattern for
  surprise moments — e.g. when the dragon gobbles the pancake, a happy smoke
  puff pops out with a boing.
- **Particle bursts**: use `SparkleBurst` more selectively — currently every
  used hotspot sparkles, but matching the particle style to the moment (stars
  for the rocket, bubbles for the pelican) would read better.

## Retry the 9 failed pop sprites

The current pop-sprite generator uses strict coverage + judge gates. Nine
hotspots have no pop sprites because all 3 attempts failed (mostly coverage
outside 0.10–0.95 or chroma key issues). Retrying with:

- Looser coverage bounds (0.05–0.97).
- A fallback to a simpler emoji-on-canvas if generation fails entirely.
- NBP instead of magenta-background generation (ask for transparent directly).

## Item-combination mechanic

Currently items are used one-at-a-time on locks. A kid-simple combination
mechanic would add depth:

- **Two items snap together**: e.g. find a stick and a string, combine them
  into a fishing rod, use the rod on the pond. The tray shows the combined
  item.
- Implementation: add `combines: [itemA, itemB]` to the item spec. When both
  are in the tray, tapping one while the other is selected creates the
  combined item (with a pop animation). The combined item then `gives` to
  locks as normal.
- Keep it to 2-item combinations — 3-year-olds can handle "put these two
  together" but not more.

## Multi-room escapes

Currently each escape is a single scene. A multi-room escape would use a
room graph (doors connect rooms) where items found in one room are used in
another:

- UI: swipe or tap door hotspots to move between rooms. The tray persists
  across rooms.
- State: extend `EscapeState` with a `currentRoom` field and per-room
  `used` tracking. The state-scene chain applies per-room.
- Start simple: two connected rooms (find key in room A, use it in room B).
- The generator would lint the cross-room dependency graph the same way it
  lints single-room chains.

## Per-room difficulty tuning

The `level` field exists but doesn't drive gameplay differences yet. Ideas:

- **Easy**: 2 items, bigger hotspot boxes, shorter hint timer (8s).
- **Medium**: 2–3 items, standard boxes, standard hint timer (12s).
- **Hard**: 3 items, smaller hotspot boxes, longer hint timer (18s), one
  red-herring search spot that looks like it could be useful.
- Difficulty could also affect the number of flavor spots (more in harder
  rooms = more places to tap that don't advance the chain).
