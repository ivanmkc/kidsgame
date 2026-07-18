# Car Games brainstorm — audio-only, no looking at the screen

Ages 3-6, riding in a car seat. Design constraints:

- **Eyes free.** The phone sits in a pocket or mount; the game must work
  with zero glances. Screen shows at most one giant "anything" button.
- **Input without aiming.** A kid can blind-tap ANYWHERE, clap-along, or
  answer OUT LOUD (no validation needed — celebrate whatever they say).
  Tap-count is the only reliable blind choice mechanic: 1 tap = yes /
  first option, 2 taps = no / second option.
- **Everything we need already exists**: say()/saySequence (8k pre-rendered
  TTS clips in 4 langs), sfx, and the new Web Audio synth (music.ts).
  Speech *recognition* is deliberately avoided — flaky for kid voices;
  call-and-response with a reveal beat is more reliable AND funnier.
- Rounds self-pace on a tap; a parent never has to touch the phone.

## The strongest candidates (build order)

1. **Animal Sound Safari** — App plays an animal sound (new sfx pack),
   leaves a 3-beat gap for the kid to shout the answer, then reveals:
   "It was... the ELEPHANT! Did you get it?" Tap anywhere for the next
   one. Difficulty = obscurity (cow → peacock). Zero reading, zero aiming,
   works for 2-year-olds. *New assets: ~20 animal sfx (CC0 packs exist).*

2. **Finish the Rhyme** — "The cat wore a big red...?" (gap) "...HAT!"
   Rhyme pairs already exist in the rhyme game's word pool; the TTS
   pipeline renders the setup + punchline as clips. Pre-literacy gold.

3. **Count the Boops** — App plays N synth notes (music.ts!), kid shouts
   the number, reveal + cheer. Numbers 1-5 easy, up to 10 hard. Reuses
   the music-box patch for pleasant boops.

4. **Story Path: Ears Edition** — The existing 58 storybooks, narrated
   as-is, with choices remapped to tap-counts: "Tap ONCE to sneak through
   the vent, tap TWICE to climb the rope!" All narration clips already
   exist — this is a new *renderer* over the same manifest, not new
   content. The single biggest content-for-free win.

5. **Audio I-Spy (window bingo)** — "Ding! Can you find... a RED car out
   the window? Tap when you spot it!" The kid looks OUT THE WINDOW, not
   at the screen — the one game class where "no screen" is literal.
   Needs a small prompt list only (colors/vehicles/things: truck, dog,
   traffic light, bridge).

6. **Who Am I? (hero riddles)** — Riddles about our own cast: "I am a
   little black kitten... I carry a glowing lantern... WHO AM I?" (gap)
   "MILO!" Kids who play the app love recognizing the family. Extends to
   animals/objects for kids who don't.

## More rounds for the same shell

7. **Simon Says, Seat Edition** — "Simon says wiggle your toes!" Physical
   mini-moves safe in a car seat (blink, roar, pat your head). No input
   at all; taps just advance. Occasional trick round ("Touch your nose!"
   — no Simon!) for the 5-6yo giggle tier.
8. **Echo Melody** — App plays a 3-note music-box phrase, kid hums it
   back into the air, app plays it again slower "together". Turn-taking
   music play, no judging.
9. **Silly or True?** — "Cows can FLY! Tap once for TRUE, tap twice for
   SILLY!" Reveal with a boing. Preschool logic + belly laughs.
10. **Freeze Groove** — Synth music plays, stops at random: "FREEZE!"
    then "GROOVE!" Seat-dancing; pure output, zero input.
11. **The Sound Kitchen** — "What's cooking? Ssssssizzle..." guess
    everyday sounds (kettle, popcorn, vacuum, rain). Same shell as
    Safari with a household sfx pack.
12. **Old MacDonald Machine** — App sings the verse skeleton, pauses at
    the animal slot; whatever the kid shouts, the next verse plays a
    RANDOM animal with its real sound — comedy from the mismatch, and
    the kid "conducted" it. Uses music.ts for the melody.
13. **Word Starters** — "Tell me something that starts with mmmmm!"
    (gap) "Mmmm, marvelous! I thought of MOON!" No validation — the app
    always offers its own answer so every kid answer 'wins'.
14. **Whisper Telephone** — App whispers a silly phrase ("banana
    pajamas"), kid relays it to the grown-up, everyone repeats it louder
    each time. Social, zero input.
15. **Calm Balloon** — Not a game: "Breathe in and fill your balloon...
    2, 3, 4... now sloooowly let it out." A parent-facing meltdown tool
    on a long drive; the quiet sibling of the pack.

## Implementation sketch (one shell, many packs)

- One new route `carmode`: giant friendly full-screen surface, huge
  colors, everything narrated; explicitly designed to be used unseen.
  Round engine = `{prompt clips} → gap (timer) → {reveal clips} → tap to
  continue`, with tap-count branching where a game needs choices.
- Rounds are DATA (like escape/story specs): `{id, pack, promptClips,
  gapMs, revealClips, sfx?}` — new games are new packs, zero new code.
- Voice contract: all lines ride gen_voice.py as usual; 4 languages free.
- New asset need is small: 2 CC0 sfx packs (animals, household). Story
  Path Ears Edition and Count the Boops need zero new assets.
- Later, optional: Web Speech recognition behind a flag for yes/no only
  (never required — the gap-and-reveal loop must stay the baseline).
