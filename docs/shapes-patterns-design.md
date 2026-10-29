# Shapes and Patterns Design

## 1. Game and Name

**Name: Shapes and Patterns**
A game focusing on identifying geometric shapes and completing visual shape
patterns. The prompt speaks aloud what shape to find or what pattern element
comes next. To support children who cannot read yet, shape options feature
clear visual icons and speak their name when touched. When correct, a
celebration plays and the sequence advances.

## 2. Screen Flow

Reuses the shell, celebration, and sound patterns from existing games.

```text
[Start Screen]
  - Title: "Shapes and Patterns"
  - Big Play Button
  - Captions Toggle (On/Off)

[Round Screen]
  - On Mount: The target shape or pattern instruction is spoken aloud.
  - Top Center: Target shape display or pattern sequence with a missing slot,
    along with a Big Speaker button to replay the audio prompt.
  - Bottom: Selectable shape choices (e.g. circle, square, triangle, star) or
    next pattern element options. Each tile includes an icon and speaks its
    name when touched.

[Feedback / Streak]
  - Selection: Snaps into place or highlights.
  - Correct: Plays celebration sound, shows stars, increments streak, and
    advances to the next round.
  - Incorrect: Replays prompt without penalty.

[End Screen]
  - Shows total streak/stars.
  - Replay Button.
```

## 3. Shape and Pattern Assets

**Reuses geometric shape sprites and color swatches.**

- Shapes: circle, square, triangle, rectangle, star, diamond, oval.
- Patterns: AB patterns (e.g., circle, square, circle, ?), AAB patterns, ABC
  patterns.
- Audio: Spoken names for shapes and instructions in EN, JA, ZH.

## 4. The Ramp

- **Level 1 (Easy)**: Single shape identification (e.g., "Find the circle").
- **Level 2 (Medium)**: Simple AB repeating shape patterns (e.g., circle,
  square, circle, ?).
- **Level 3 (Hard)**: Advanced repeating patterns (AAB, ABC) with multiple
  distractor shapes.
- **Progression**: 3 difficulties, advancing after achieving a streak of
  correct rounds.

## 5. Acceptance Criteria

- 3 difficulties (Identification, AB patterns, Advanced patterns).
- Tap-to-select and drag interaction.
- Translated text and audio for all supported languages (EN/JA/ZH).
- Reuses existing shape assets and UI shell.
- R6 (Unambiguous / Non-reader support): Instructions are spoken before the
  child acts, and choices feature icons and spoken audio when touched so
  non-readers can identify them.

## 6. Curriculum Mapping

- **Strand**: Numeracy (Level 4: Shapes and patterns).
- **Path**: Follows `compare`, leads to `sums`.
