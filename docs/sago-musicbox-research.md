# Sago Mini Music Box: Research & v2 Design

## 1. What the real app is

Sago Mini Music Box (2014, iOS/Android, $3.99, now delisted Nov 2025) is a
tap-anywhere musical journey for toddlers by Sago Sago. Three familiar nursery
rhymes, each paired with a character, a vehicle, and a continuously scrolling
illustrated world.

### Characters, songs, and scenes

| Character | Song | Vehicle | Scene |
|---|---|---|---|
| Jinja (orange cat) | Twinkle Twinkle Little Star | Hot air balloon | Meadow, mountains, night sky, space |
| Harvey (brown dog) | Row Row Row Your Boat | Boat | Tropical sea paradise |
| Jack (blue rabbit) | Jingle Bells | Sled | Snowy landscape |

### Moment-to-moment interaction model

**Character selection.** The app opens on a minimal screen where the kid taps
one of three characters. Each character is a song. No menus, no text, no
buttons beyond the three characters.

**The journey.** The selected character rides their vehicle through a
horizontally-scrolling illustrated landscape. The vehicle starts at the left
side and the world scrolls past it. Every single tap anywhere on the screen
does three things simultaneously:

1. **Plays the next note** of the song (always in sequence, so the melody is
   always correct regardless of timing).
2. **Advances the vehicle** through the landscape (faster tapping = faster
   travel; slower tapping = slower travel; the kid controls the tempo).
3. **Spawns a visual surprise** at the tap location. Objects that appear depend
   on where in the scene you tap: clouds and stars in the sky, flowers and
   trees on the ground, mountain goats in the mountains, comets and rockets in
   space, fish in the water.

**Pitch/timbre varies by screen position.** Tapping the upper portion of the
screen plays higher-register notes (e.g., keyboard timbre); tapping the lower
portion plays lower-register notes (e.g., guitar). The melody note is the same
either way, but the octave/instrument shifts.

**Multi-finger tapping.** Tapping with multiple fingers at once produces richer
orchestration (more instruments layered). A single finger = a clean solo note.

**Slowing down.** Holding one finger on the screen while tapping with another
slows the scene scroll, allowing the kid to linger in a particular zone. Slow
circles with a finger also slow movement.

**Hidden surprises.** Tapping on specific objects or characters triggers
secondary animations and sounds. Repeated tapping in the same area can reveal
hidden characters (moon moles, mountain goats). "Tons of hidden objects and
hilarious animations tucked away" (developer letter).

**Seamless loop.** Both the music and the landscapes loop seamlessly. There is
no win state, no score, no progress bar, no end screen. The journey just keeps
going as long as the kid taps. The kid can revisit by picking a different
character from the selection screen.

**No UI during play.** Zero buttons, zero HUD, zero text, zero menus during a
journey. The entire screen is the interactive canvas.

### What made it beloved

- **Impossible to fail.** Every tap sounds good, advances the journey, and
  creates something pretty. A 2-year-old slapping the screen produces a valid
  performance.
- **Sophisticated for older kids.** Tempo control, pitch zones, multi-finger
  orchestration, and hidden surprises reward exploration.
- **Beautiful illustrated art.** Warm, textured, painterly scenes — not flat
  emoji or stock clip art.
- **No ads, no IAP, no distractions.**
- **Parent co-play.** Two devices = duet. Parent can sing along because the
  tunes are universally known nursery rhymes.

### Sources

- [Sago Mini — Music Box Letter to Parents](https://sagomini.com/article/music-box-letter-to-parents/)
- [BridgingApps — Sago Mini Music Box Review](https://bridgingapps.org/bridgingapps-reviewed-app-sago-mini-music-box/)
- [Appysmarts — Sago Mini Music Box Review](https://www.appysmarts.com/application/sago-mini-music-box,id_80358.php)
- [YouTube — Sago Mini Music Box App Demo for Kids](https://www.youtube.com/watch?v=-JueKPpMQXc)
- [YouTube — Sago Mini Music Box Brief Gameplay](https://www.youtube.com/watch?v=wFDujI59FN0)
- [Google Play Store Listing (archived)](https://www.playstoresales.com/app/sago-mini-music-box/)


## 2. What we got wrong (v1 gaps)

Our v1 (`src/games/musicbox/`) is a static stage with floating emoji note
glyphs. Here is what the real Sago Mini Music Box does that our v1 does not:

| Sago mechanic | Our v1 | Gap |
|---|---|---|
| Horizontally-scrolling illustrated world | Static pastel rectangle | **Critical.** The whole point is the journey. |
| Character in a vehicle moving through the landscape | Three emoji buddies bouncing at the bottom of a static stage | **Critical.** No vehicle, no movement, no journey. |
| Visual objects spawning at tap point (flowers, clouds, trees, stars, fish) | Floating music-note emoji glyphs that fade out | **Critical.** Should be scene-appropriate objects, not abstract glyphs. |
| Scene-appropriate art (meadow/sea/snow) per song | One generic pastel sky for all songs | **Critical.** Each song needs its own world. |
| Pitch/timbre varies by vertical tap position | Uniform note regardless of tap position | **Significant.** Adds depth for older kids. |
| Multi-finger = richer orchestration | Not handled | **Moderate.** Can layer harmonics. |
| Hold to slow scene | Not implemented | **Moderate.** |
| Hidden surprises (secondary animations on objects) | None | **Moderate.** Replay value. |
| Seamless loop, no end state | Star progress bar + WinOverlay when song ends | **Critical.** Sago has no win/loss/progress. |
| Minimal character-selection (three big characters, no text) | Card grid with emoji + text labels, includes freeplay + 6 extra songs | **Significant.** Over-engineered for toddlers. |
| Three classic nursery rhymes (Twinkle/Row/Jingle Bells) | Six nursery rhymes + freeplay | Scope mismatch — not wrong, but dilutes focus. |
| Beautiful painterly illustrated art | Emoji-only visuals | **Critical.** Art quality is the soul of the app. |


## 3. v2 Design: faithful rebuild within our stack

### 3.1 Stack constraints

- Expo React Native Web (no 3D engine)
- `src/music.ts` Web Audio synth for note playback
- NBP image generation for scene art (painted backgrounds + objects)
- Chroma-key sprites for characters
- RN `Animated` for all animation
- No native modules, must run as a web PWA

### 3.2 Core architecture

```
CharacterPicker  ──tap──>  JourneyScene
                            ├─ ScrollingWorld (horizontal parallax layers)
                            │   ├─ BackgroundLayer (sky/sea/snow — slowest)
                            │   ├─ MidgroundLayer (mountains/waves/trees)
                            │   └─ ForegroundLayer (grass/water surface/snow)
                            ├─ Vehicle (character in vehicle, fixed horizontal position)
                            ├─ SpawnedObjects (tap-spawned decorations)
                            └─ (no HUD, no progress bar, no buttons)
```

### 3.3 Mechanic-to-implementation map

#### Character selection

**Sago:** Three large characters, no text, tap to start.
**v2:** Full-screen view with three large NBP-generated character portraits
(Jinja/Harvey/Jack or our own equivalents). No text labels, no card borders.
Tap a character, transition directly into the journey. No freeplay mode (it
contradicts the Sago model). If we want freeplay, it can be a separate game
entry, not in this picker.

#### Horizontal scrolling world

**Sago:** The landscape scrolls continuously left as the kid taps. Vehicle
stays roughly center-left. The world is pre-rendered and wraps seamlessly.
**v2:** Use an RN `Animated.View` with `translateX` driven by cumulative tap
count. Three parallax layers at different scroll rates (background 0.3x,
midground 0.6x, foreground 1.0x). Each layer is an NBP-generated wide
panoramic strip (aspect ~6:1 or wider) that tiles seamlessly. On reaching the
end of the strip, wrap `translateX` back to zero (seamless loop requires the
strip to start and end identically — design the NBP prompt to produce
tileable art).

**Asset list per scene:**
- 1 background strip (sky gradient / ocean horizon / snowy sky) — ~3000x600 px
- 1 midground strip (mountains / waves / snow drifts) — ~3000x600 px
- 1 foreground strip (meadow / water surface / snowy ground) — ~3000x600 px

Total: 9 panoramic strips (3 songs x 3 layers).

#### Vehicle and character

**Sago:** Character rides in a vehicle (balloon/boat/sled) at a fixed screen
position while the world scrolls behind.
**v2:** NBP-generated character-in-vehicle sprite, chroma-keyed. Positioned at
~25% from left, vertically centered (balloon floats, boat sits on water line,
sled sits on snow line). Gentle bobbing animation (Animated spring) on each
tap. The vehicle does NOT move horizontally — the world moves.

**Asset list:** 3 character-in-vehicle sprites (chroma-keyed PNG, ~300x300 px).

#### Tap spawns scene objects

**Sago:** Tap location determines which type of object appears. Sky taps =
clouds, stars, comets. Ground taps = flowers, trees, animals.
**v2:** Divide the screen into vertical zones (top third = sky zone, middle =
mid zone, bottom = ground zone). Maintain a pool of NBP-generated object
sprites per scene. On tap, pick an object from the pool matching the zone,
place it at tap coordinates, animate it in (scale from 0 + fade in over
200ms), then gently drift upward and fade out over 3s. Cap at ~15 visible
objects (recycle oldest).

**Asset list per scene (8-10 small sprites each):**

| Scene | Sky zone | Mid zone | Ground zone |
|---|---|---|---|
| Twinkle (balloon) | star, comet, rocket, moon | cloud, bird, rainbow | flower, tree, mountain goat, mushroom |
| Row (boat) | cloud, sun, seagull | wave, dolphin, rainbow | fish, coral, starfish, shell |
| Jingle Bells (sled) | snowflake, star, aurora | pine tree, cabin, owl | snowman, rabbit, gift box, holly |

Estimated: ~30 small object sprites total.

#### Pitch/timbre by vertical position

**Sago:** Upper screen = higher octave/keyboard timbre. Lower screen = lower
octave/guitar timbre.
**v2:** `music.ts` already supports MIDI note numbers. On tap, offset the
melody note by the vertical tap position:
- Top third: +12 (one octave up), use a brighter waveform (triangle or sine)
- Middle third: +0 (as written), default waveform
- Bottom third: -12 (one octave down), use a warmer waveform (sine with lower
  harmonics or a short attack)

The melody note sequence stays the same; only the register/timbre shifts. This
is straightforward with the existing `playNote` API by passing an octave
offset and optional waveform parameter.

#### Multi-finger orchestration

**Sago:** Multiple simultaneous touches produce richer sound.
**v2:** On `onTouchStart`, count `e.nativeEvent.touches.length`. For each
extra finger beyond the first, layer an additional harmony note (e.g., +4
semitones for a major third, +7 for a fifth). This enriches the sound without
changing the melody.

#### Hold to slow

**Sago:** Holding a finger slows the scroll.
**v2:** Track `onPressIn` / `onPressOut`. While a finger is held (no new taps),
apply a 0.3x multiplier to the scroll velocity. Release returns to normal.
This is a velocity damper on the `Animated.decay` or spring that drives
`translateX`.

#### Hidden surprises

**Sago:** Tapping on spawned objects triggers secondary animations.
**v2:** Give each spawned object a `Pressable` wrapper. On tap:
- Object does a bounce + spin animation
- Plays a bonus sound effect (giggle, pop, sparkle)
- Optionally transforms into a different sprite (flower blooms, snowman waves)

Start with 2-3 surprise behaviors per scene and expand.

#### No end state / seamless loop

**Sago:** No win, no progress, no score. Music and world loop forever.
**v2:** Remove `isComplete`, `progress`, `WinOverlay`, and the star bar. The
note index wraps around (`idx % song.notes.length`) on every tap, which the
existing logic already does for the melody. The world scroll wraps when
`translateX` exceeds the strip width. The kid plays until they want to switch
characters, using a single minimal back arrow (or swipe) in the corner.

### 3.4 Songs

Keep three songs to match Sago's scope:
- **Twinkle Twinkle Little Star** (already in songs.ts)
- **Row Row Row Your Boat** (already in songs.ts)
- **Jingle Bells** (needs to be added — simple, well-known, public domain)

The other four songs (Mary, London Bridge, Spider, Old MacDonald) can stay in
`songs.ts` for potential future use but should not appear in the Music Box
character picker.

### 3.5 Full asset list summary

| Category | Count | Format | Size target |
|---|---|---|---|
| Character portraits (picker) | 3 | chroma PNG | 400x400 |
| Character-in-vehicle sprites | 3 | chroma PNG | 300x300 |
| Background panoramic strips | 3 | PNG | 3000x600 |
| Midground panoramic strips | 3 | PNG | 3000x600 |
| Foreground panoramic strips | 3 | PNG | 3000x600 |
| Tap-spawned object sprites | ~30 | chroma PNG | 80x80 |

**Total: ~45 assets**, all generated via NBP image gen with consistent art
style prompts (warm, painterly, rounded, Sago-Mini-esque).

### 3.6 Phasing

**Phase 1 — Core journey (MVP).** Implement one song (Twinkle) end-to-end:
scrolling parallax world, vehicle, tap-to-advance-and-spawn, seamless loop, no
HUD. Validate the feel.

**Phase 2 — All three songs.** Generate assets for Row and Jingle Bells,
implement character picker, wire up scene switching.

**Phase 3 — Polish.** Pitch zones, multi-finger orchestration, hold-to-slow,
hidden surprises on spawned objects. These are all additive — the core loop
works without them.

### 3.7 Code changes required

- **New:** `src/games/musicbox/JourneyScene.tsx` — the scrolling play surface,
  replacing the static `Pressable` stage.
- **New:** `src/games/musicbox/ScrollingWorld.tsx` — parallax layer manager.
- **New:** `src/games/musicbox/SpawnedObject.tsx` — individual spawned
  decoration with zone-based sprite selection.
- **Modify:** `src/games/musicbox/MusicBoxGame.tsx` — replace the card picker
  with a character-tap picker; replace the stage `Pressable` with
  `JourneyScene`; remove `WinOverlay`, star bar, and `FloatingNote`.
- **Modify:** `src/games/musicbox/logic.ts` — remove `isComplete`, `progress`;
  add octave-offset calculation from tap Y; always wrap `idx`.
- **Modify:** `src/games/musicbox/songs.ts` — add Jingle Bells.
- **Modify:** `src/music.ts` — add optional octave offset and waveform
  parameter to `playNote`; add `playChord` for multi-finger.
