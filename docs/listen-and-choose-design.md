# Listen and Choose Design

## 1. Game and Name

**Name: Listen and Choose**
A listening game where the child hears a word spoken aloud and picks the matching
word. The word plays when the round starts and again from a big speaker button.
Two to four choices show as text, with a picture beside each for children who
can't read yet. A wrong pick costs nothing, replays the word and, after a second
miss, shows the right one.

## 2. Screen Flow

Reuses the shell, celebration, and sound patterns from existing games.

```text
[Start Screen]
  - Title: "Listen and Choose"
  - Big Play Button
  - Captions Toggle (On/Off)

[Round Screen]
  - Top Center: Big Speaker Button (Tappable to replay the word)
  - Center: 2, 3, or 4 Choices (Grid or List)
    - Each Choice: [Picture] + [Text Label]

[Feedback / Streak]
  - Wrong Pick: Replays the spoken word. No negative buzzer.
  - Second Wrong Pick: Highlights the correct choice.
  - Right Pick: Plays celebration sound, shows stars, increments streak.

[End Screen]
  - Shows total streak/stars.
  - Replay Button.
```

## 3. Word Lists and Assets

Each level contains 20-40 words.

**Level 1 (20 words - Distinct, Easy)**

- Existing under `assets/game/animals` & `assets/game/rhyme`: cat (cat_sit.png),
  dog (dog_sit.png), fox (fox_sit.png), frog (frog_sit.png), lion
  (lion_sit.png), panda (panda_sit.png), rabbit (rabbit_sit.png), bat.png,
  bear.png, bee.png, boat.png, box.png, bun.png, cake.png, clock.png, coat.png,
  goat.png, hat.png, house.png, jar.png.

**Level 2 (20 words - Distinct, Medium)**

- Existing: moon.png, mouse.png, pear.png, rock.png, snail.png, snake.png,
  sock.png, spoon.png, sun.png, tree.png, whale.png.
- Must be generated: cap, cup, pan, pen, pin, pig, wig, dig, big.

**Level 3 (20 words - Minimal Pairs/Sound-Alikes)**

- Pairs to confuse: cat/cap, pan/pen, pin/pig, big/wig, hat/bat, house/mouse,
  boat/coat, rock/sock, clock/block, bear/pear.
- Existing: cat, bat, house, mouse, boat, coat, rock, sock, clock, bear, pear.
- Must be generated: block (plus the generated ones from Level 2).

## 4. The Ramp

- **Level 1**: 2 choices per round. Short, distinct words.
- **Level 2**: 3 choices per round. Medium words.
- **Level 3**: 4 choices per round. Minimal pairs and words that sound alike
  (e.g., cat, cap, cup) to challenge auditory discrimination.
- **Progression**: A child moves to the next level after achieving a streak of
  10 correct answers.

## 5. The Voice

**Options:**

1. **Recorded files**: High quality, works offline, consistent, but hard to
   scale for many languages.
2. **Device speech synthesis**: Scalable, but offline support varies by device
   and voices can be inconsistent or robotic.
3. **Generated once and shipped**: Use TTS to generate `.mp3` files, ship them
   in `public/voice`.

**Recommendation**: **Generated once and shipped**. This ensures 100% offline
play, consistent high-quality voices across all devices, easy multi-language
support, and no runtime API dependency.

## 6. Accessibility and No-Penalty Rules

- **Accessibility**: High contrast text and backgrounds. Large tap targets for
  choices. A captions toggle to display the spoken word as text below the
  speaker button for hearing-impaired or reading-focused play.
- **No-Penalty**: Mistakes are part of learning. A wrong pick does not deduct
  points or play a negative sound. It simply replays the word. After two wrong
  picks, the game gently guides the child by highlighting the correct answer.

## 7. Tests

Tests will follow the PR #142 interaction-test harness style using
`@testing-library/react`.

- Render the `ListenChooseGame` component.
- Verify the Big Speaker button exists.
- Mock the audio playback and ensure it triggers on mount.
- Simulate clicking a wrong choice: assert audio replays.
- Simulate clicking a wrong choice again: assert the correct choice gets a
  visual highlight class.
- Simulate clicking the correct choice: assert the celebration plays and the
  round advances.

## 8. Build Items

1. `listen-and-choose-data`: Create the word lists and level structures in
   `src/games/listenchoose/data.ts`.
2. `listen-and-choose-assets`: Generate the missing images (cap, cup, pan,
   etc.) using the vertex-images script. (Depends on 1).
3. `listen-and-choose-voice`: Generate the audio `.mp3` files and map them in
   the data file. (Depends on 1).
4. `listen-and-choose-logic`: Write the pure game logic (state, round
   generation, streak, level progression). (Depends on 1).
5. `listen-and-choose-ui`: Build the React components (Screen, Big Speaker,
   Choices) and wire them to logic. (Depends on 2, 3, 4).
6. `listen-and-choose-tests`: Write the interaction tests in the PR #142
   style. (Depends on 5).
