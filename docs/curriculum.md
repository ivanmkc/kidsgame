# Kidsgame Curriculum

This curriculum organizes the games by learning strands and levels for ages 3-7, establishing a foundation for shared content sets and a learning path.

## Strands and Levels (Ages 3-7)

### 1. Early Literacy

- **Level 1 (Age 3-4):** Phonological awareness
- **Level 2 (Age 4-5):** Letter-sound
- **Level 3 (Age 5-6):** Blending
- **Level 4 (Age 6-7):** Sight words

### 2. Numeracy

- **Level 1 (Age 3-4):** Subitizing
- **Level 2 (Age 4-5):** Counting
- **Level 3 (Age 5):** Comparing
- **Level 4 (Age 5-6):** Part-whole number decomposition, set equivalence, shapes and patterns
- **Level 5 (Age 6-7):** Adding within 10

### 3. Music and Rhythm

- **Level 1 (Age 3-4):** Basic exploration
- **Level 2 (Age 5-6):** Intermediate rhythm and pitch
- **Level 3 (Age 6-7):** Advanced beats

### 4. Languages EN/JA/ZH

- **Level 1 (Age 3-7):** Core vocabulary and listening

### 5. Executive Function

- **Level 1 (Age 3-4):** Visual discrimination and attention
- **Level 2 (Age 5-6):** Working memory and cognitive flexibility
- **Level 3 (Age 6-7):** Planning and multi-step logic

## Game Mapping

### Early Literacy

- `listenchoose` - Phonological awareness (Level 1)
- `rhymegame` - Phonological awareness (Level 1)
- `sounds` - Phonological awareness (Level 1)
- `letters` - Letter-sound (Level 2)
- `spell` - Blending (Level 3)
- `bingo` (phonics mode) - Phonological awareness (Level 1)
- `story` - Sight words (Level 4)

### Numeracy

- `numbers` - Subitizing (Level 1)
- `count` - Counting (Level 2)
- `compare` - Comparing (Level 3)
- `sums` - Adding within 10 (Level 5)

### Music and Rhythm

- `bells` - Music and Rhythm (Level 1)
- `musicbox` - Music and Rhythm (Level 1)
- `fastslow` - Music and Rhythm (Level 2)
- `highlow` - Music and Rhythm (Level 2)
- `steadybeat` - Music and Rhythm (Level 2)
- `echobeat` - Music and Rhythm (Level 3)

### Languages EN/JA/ZH

- `carmode` - Languages EN/JA/ZH (Level 1)
- `bingo` (name mode) - Languages EN/JA/ZH (Level 1)

### Executive Function

- `samediff` - Executive Function (Level 1)
- `shadow` - Executive Function (Level 1)
- `diff` - Executive Function (Level 1)
- `hidden` - Executive Function (Level 1)
- `oddone` - Executive Function (Level 1)
- `conceptmatch` - Executive Function (Level 2)
- `memory` - Executive Function (Level 2)
- `puzzle` - Executive Function (Level 2)
- `escape` - Executive Function (Level 3)
- `rules` - Executive Function (Level 3)
- `spotit` - Executive Function (Level 3)

## Map Gaps & New Game Specs

- **Number Balance (Numeracy - Level 4):**
  - **Spec:** A game teaching part-whole number decomposition and set
    equivalence ("equal / same") as necessary foundational concepts before
    formal addition equations. [Detailed Design](part-whole-design.md)
  - **Path:** Follows `compare` (Level 3) and leads to `sums` (Level 5).
  - **Content reuse:** Reuses critter sprites from `CURRICULUM.critters`
    ('frog', 'cat', 'dog', 'star', 'apple') and numerals 1..10 from
    `CURRICULUM.numbers`.
  - **Pre-reader core loop:** A colorful balance scale displays a whole
    quantity on the left pan (e.g. 5 frogs) tilting it down. A spoken voice
    prompt instructs: "Make both sides balance! Add frogs to make 5." The
    right pan already holds a partial part (e.g. 2 frogs). The tray below
    offers 3 candidate critter groups (e.g. 1, 3, 4); tapping any speaks its
    count. Dragging or tapping the matching part (3 frogs) into the right pan
    levels the scale horizontally with joyful audio feedback ("2 and 3 make 5
    — they are equal!").
  - **Difficulty steps:**
    1. Easy: Sums up to 5 with visual 1-to-1 critter counters (e.g.
       whole 3..5, missing part 1..3).
    2. Medium: Sums up to 10 with visual critter counters (e.g. whole 6..10,
       missing part 1..5).
    3. Hard: Sums up to 10 with mixed numerals and critter groups, connecting
       number symbols to decomposed quantities.

- **Shapes and Patterns Game (Numeracy - Level 4):**
  - **Spec:** A game where kids identify geometric shapes and complete visual
    patterns. [Detailed Design](shapes-patterns-design.md)
  - **Path:** Follows `compare` and leads to `sums`.

- **Word Family (Early Literacy - Level 2.5):**
  - **Spec:** Advanced Phonics: Onset-Rime & CVC Blending. [Detailed Design](word-family-design.md)
  - **Path:** Follows `letters` (Level 2: Letter-sound) and leads to `spell` (Level 3: Blending).

- **Sentence Builder (Languages EN/JA/ZH - Level 2):**
  - **Spec:** A game focusing on constructing simple sentences using vocabulary learned. The child drags word tiles into slots to build a descriptive sentence (e.g. "Dog eats apple"). [Detailed Design](sentence-builder-design.md)
  - **Path:** Follows `carmode` and leads to `story`.
