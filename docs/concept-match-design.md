# Concept-Match Memory Game Design

## Overview

A concept-match memory game where pairs are two different representations of the
same concept (e.g., uppercase 'A' and lowercase 'a', or '3' and three apples)
rather than identical pictures. Every card speaks its concept when turned.

## Pair Types (Decks)

1. **Numerals & Quantities**: A numeral (e.g., 3) and a representation of that
   many objects (e.g., three apples or three fingers).
2. **Letters**: An uppercase letter and its corresponding lowercase letter.
3. **Picture & Written Word**: A picture of an object/animal and its written
   word.
4. **Picture & Spoken Word**: A picture and a card that plays the spoken word
   when turned (for children who can't read).
5. **Animal & Sound**: An animal picture and the sound it makes.
6. **Shape & Everyday Object**: A geometric shape and an everyday object that
   has that shape.
7. **Cross-Script Numerals**: An Arabic numeral and the same number in Han or
   kana scripts.
8. **Colour & Word**: A colour swatch and the written word for that colour.

## Asset Reuse & New Assets

- **Reuse**: The existing memory game's flip-and-match mechanics, words, and
  voice assets (`src/games/memory`, `src/words.ts`, `public/voice`).
- **Reuse**: Existing assets for letters, numbers, colours, and basic
  shapes/animals.
- **New Assets Required**: We will need to generate or add specific matching
  assets such as objects representing quantities (e.g., three apples), Han/kana
  script numerals, specific everyday objects matching shapes, and potentially a
  generic "sound" icon for the spoken word or animal sound cards.

## Architecture: Mode vs. New Feature

Following the architecture lever, this will be built as a **new feature
directory** (`src/games/conceptmatch`). The shared card UI and flip-and-match
logic will be hoisted outside `src/games` to a shared component (e.g.,
`src/components/MemoryBoard.tsx`) to avoid copying mechanics from the existing
memory game while keeping the new logic isolated. Rules for deck building, pair
matching, and difficulty ramp will live in a pure `logic.ts` module with
accompanying tests.

## Difficulty Ramp

The difficulty ramps along three axes:

1. **Grid Size**: Starts at 2x2, then progresses to 3x4, and finally 4x4.
2. **Distractors**: Introducing pairs that look or sound alike within the same
   deck to increase challenge.
3. **Mixed Decks**: Later levels put several different pair types on a single
   board (e.g., mixing letter pairs with numeral pairs).

## Screen Flow

1. **Menu Selection**: The child picks a deck (pair type) from the main game
   menu.
2. **Game Board**: The grid is displayed face-down.
3. **Turn Interaction**:
   - The child taps a card. The card flips, reveals its content, and speaks its
     concept.
   - The child taps a second card. It flips and speaks its concept.
   - If a match (same concept), a celebration plays and the pair stays face-up
     or disappears.
   - If not a match, both cards turn back face-down after a brief beat (no
     cost/penalty).
4. **Completion & Streaks**: Once all pairs are matched, the standard kidsgame
   celebration plays, streaks are updated, and the game progresses to the next
   difficulty (e.g., larger grid or harder deck).
