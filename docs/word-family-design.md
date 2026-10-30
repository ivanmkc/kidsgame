# Word Family Design

## Spec

Advanced Phonics: Onset-Rime & CVC Blending.

## Assets

Directly reuses CVC word vocabulary and icons from `src/curriculum/words.ts` and `CURRICULUM.critters` (cat, bat, hat, dog, pig, fox, sun, bun, box, jar, bed, bus) with existing art from `assets/game/rhyme/` and `assets/game/spotit/`.

## Core Loop

Pre-reader core loop: The child sees a familiar picture prompt (e.g. a cat) with a fixed rime chunk (`_ a t`). A spoken voice prompt asks: "Let's make CAT! What sound starts cat?" Three chunky onset letter tiles (`c`, `b`, `h`) are displayed at the bottom tray. Touching any tile speaks its letter sound (e.g. tapping 'c' speaks "/k/"). The child drags or taps the matching onset consonant tile into the empty slot. When the correct tile is placed, the word blends visually and aurally ("c-at, cat!"), followed by a brief celebratory animation of the critter.

## Curriculum Path

Follows `letters` (Level 2: Letter-sound) and leads to `spell` (Level 3: Blending).
