# Sentence Builder Design

## 1. Game and Name

**Name: Sentence Builder**
A game focusing on constructing simple sentences using vocabulary learned. The target sentence is spoken aloud at the start of the round to tell the child what to build. The child drags word tiles into slots to build the descriptive sentence for a visual scene. To support children who cannot read yet, each word tile features a picture icon alongside its text and speaks its word when touched. When correct, the full sentence is spoken again.

## 2. Screen Flow

Reuses the shell, celebration, and sound patterns from existing games.

```text
[Start Screen]
  - Title: "Sentence Builder"
  - Big Play Button
  - Captions Toggle (On/Off)

[Round Screen]
  - On Mount: The target sentence is spoken aloud.
  - Top Center: A visual scene (e.g., dog eating apple) and a Big Speaker button to replay the target sentence.
  - Middle: Slots for the sentence (2, 3, or 4 slots depending on difficulty).
  - Bottom: Word tiles to drag into the slots. Each tile includes an icon and speaks its word when touched.

[Feedback / Streak]
  - Word Placed: Snaps into slot.
  - Correct Sentence: The sentence is spoken, plays celebration sound, shows stars, increments streak.

[End Screen]
  - Shows total streak/stars.
  - Replay Button.
```

## 3. Vocabulary and Assets

**Reuses critter sprites and existing vocabulary sets.**

- Critters: dog, cat, lion, frog, pig, etc.
- Objects: apple, box, hat, etc.
- Verbs/Adjectives: eats, jumps, sits, brown, big, small.

## 4. The Ramp

- **Level 1 (Easy)**: 2-word sentences (e.g., "Dog eats").
- **Level 2 (Medium)**: 3-word sentences (e.g., "Dog eats apple").
- **Level 3 (Hard)**: Adjectives included (e.g., "Brown dog eats apple").
- **Progression**: 3 difficulties, advancing after achieving a streak of correct sentences.

## 5. Acceptance Criteria

- 3 difficulties.
- Drag-and-drop interaction.
- Translated text and audio for all supported languages (EN/JA/ZH).
- Reuses existing critter sprites and vocabulary sets.
- R6 (Unambiguous / Non-reader support): The target sentence is spoken before the child acts, and word tiles feature icons and spoken audio when touched so non-readers can identify them.

## 6. Curriculum Mapping

- **Strand**: Languages EN/JA/ZH (Level 2).
- **Path**: Follows `carmode`, leads to `story`.
