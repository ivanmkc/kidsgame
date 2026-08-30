# Game question clarity audit

Every game in the box asks a pre-reader a question out loud and scores one
tap as the answer. This audit walks all 28 games and asks three things of
each question:

1. **Answerable** — can the kid work out the answer from what they actually
   see and hear this round, or is the "right" answer decided somewhere they
   can't observe?
2. **Unique** — is there exactly one tap that a reasonable four-year-old
   would call correct, or does the board hold a second defensible answer?
3. **Faithful** — do the words (spoken line, shell subtitle, menu blurb)
   describe the thing the code actually scores?

Findings were measured by running each round builder over thousands of
seeds, not by eyeballing. Each fix ships with a test that fails against the
old code.

---

## Fixed

### 1. High or Low was pure chance — the answer never came from the notes

**Severity: critical.** `makeHighLowRound` drew the correct answer from its
own coin flip, independent of the two notes it had just chosen:

```ts
const higher = rng() < 0.5;
const noteA = higher ? base + interval : base;
const noteB = higher ? base : base + interval;
const answer: 'high' | 'low' = rng() < 0.5 ? 'high' : 'low';   // unrelated
```

`HighLowGame` scored the tap against that field, so listening carried no
information at all. Over 400 seeds the stored answer matched the direction
the melody actually moved **212 times — 53%, i.e. chance.** A kid with
perfect pitch lost as often as one who tapped blind, and "Great ears! You
heard every note!" fired after eight coin flips.

The wording was broken in the same place: the shell asked *"Which note
sounds higher?"* while the two buttons say **High 🐦 / Low 🐻**. That
question has no answer on that keypad — you can't answer *which of two
notes* by tapping *high or low*.

**Fix.** The answer is now derived from the notes — `noteB > noteA` means
the second note went high — and the prompt asks the question the buttons
can answer, in all four languages: *"Was the second note higher or lower?"*
`isCorrect`/`correctAnswer` are the single source of truth and the sparkle
burst reads from them too.

### 2. Fast or Slow carried the same landmine

`makeFastSlowRound` also stored a coin-flip `answer` (50/50 against the
tempo it played over 400 seeds). The UI happened to score through
`getActualSpeed(round)` instead, so play was correct — but the field sat in
the public round type inviting exactly the High-or-Low bug, and the
threshold was written out twice as bare `130` alongside `[100, 140]` that
"doesn't matter".

**Fix.** One `FAST_BPM_MIN` constant, `answer` derived from `bpm` at
construction, `isCorrect` delegating to `getActualSpeed`.

### 3. "Find the letter I!" could show two identical tiles

The mixed-case tier renders each distractor in a random case and
*deliberately prefers* the shape-confusable group `['I', 'L', 'J']`. In the
display face (Baloo 2) capital **I** and lowercase **l** are both a bare
vertical bar with no serif and no dot — a pre-reader cannot tell them
apart. So a round would put up `A l G I u j t P`, ask for **I**, and score
only one of the two identical bars.

Measured: **51 of 3000 mixed-tier rounds** (1.7%) — about one in six
ten-round games.

Teaching shape discrimination is the point of that tier, so the confusable
group stays. The fix is narrower: a `GLYPH_TWINS` table, and a distractor
whose random case would land on the target's twin glyph gets its case
flipped back (`I` stays `I` next to a target `l`, `L` stays `L` next to a
target `I`). Distinct letters, distinct shapes, lesson intact.

### 4. Odd One Out asked kids to exclude a present from "toys and vehicles"

`iconCategories.ts` states its own invariant:

> Rule Time's "tap" labels and Odd One Out's "which is not" questions must
> describe the same membership.

The `things` category holds `balloon, car, plane, rocket, soccer, gift` but
was worded *"Which one is NOT a toy or vehicle?"* — and a wrapped present
is neither. **230 of 468** `things` rounds (49%) put the gift on the board
as a scored-wrong tile that answers the question as asked.

The same wording drives Rule Time, where it fails harder: *"Tap the TOYS &
VEHICLES!"* can make the present one of the 2–3 required matches, so a kid
who correctly declines to call a present a vehicle cannot finish the round.

**Fix.** Both wordings now name the whole membership, the way the `nature`
category already does — `Tap the TOYS, VEHICLES & PRESENTS! 🚗` and *"Which
one is NOT a toy, vehicle or present?"* (all four languages).

### 5. Phonics prompts had two right answers on the picture

First Sounds and Bingo's phonics mode pick distractors that carry a
different `sound` from the target. But `sound` is keyed to one canonical
English word per icon, and kids name pictures their own way. A rabbit is a
**b**unny. A soccer ball is a **s**occer ball. A sunflower is a **f**lower —
which is the blossom's canonical name.

Measured before the fix:

| Prompt | Ambiguous |
|---|---|
| First Sounds round (EN, 4 tiles) | 328 / 4000 (8%) |
| Bingo phonics board (3×3) | **1690 / 2000 (85%)** |
| Bingo name board, 4×4 ("Find the flower!" with both flowers) | 499 / 2000 (25%) |
| Bingo name board, 3×3 | 137 / 2000 (7%) |

The bingo phonics number is that high because every cell becomes a call, so
one bad pair anywhere on the board poisons the round it is called in.

**Fix.** Two optional fields on `WordEntry`:

- `altSounds` — other first-sounds a child could reasonably give this
  picture (`rabbit: ['buh']`, `soccer: ['sss']`, `dog: ['puh']`,
  `strawberry: ['buh']`, `rocket: ['sss']`, `sunflower: ['fff']`,
  `gift: ['guh']`).
- `nameTwins` — icons a child would call by the *same* name, declared
  symmetrically (`blossom ↔ sunflower`).

First Sounds now rejects any distractor carrying the prompt's sound under
any of its names, or that is a name-twin of the target (which is what the
non-EN word prompts ask for — "はな" must not show two flowers). Bingo
enforces it board-wide: phonics boards claim every sound an icon can
answer to, name boards never seat two twins. Boards still fill completely —
clean icons are seated first, since an icon claiming two sounds would
otherwise starve a nine-cell board.

### 6. Odd One Out's question had no voice clips in any language

`tools/gen_voice.py` scrapes the category wording with `not: '([^']+)'`.
That regex stopped matching when `not` became a per-language `Record`, so
none of the sixteen category questions were ever sent to the TTS pipeline —
only the generic fallback `"Which one does not belong?"` has a clip. Every
Odd One Out question has been running on browser speech synthesis, which on
iOS standalone has no Japanese or Cantonese voice to fall back to.

**Fix.** `category_lines()` parses the per-language record and feeds `en`
into the English pass and `ja`/`cmn`/`yue` into the language-tagged pass.

> **Follow-up required:** `python3 tools/gen_voice.py` needs a run with
> Vertex credentials to actually render the sixteen category questions plus
> the two reworded Rule Time / Odd One Out `things` lines. Until then those
> lines keep using the existing browser-speech fallback — no worse than
> today, but not yet fixed in the shipped `src/assets/voice.ts`.

---

## Noted, not fixed

- **Rhyme Time, Mandarin `i` family.** Groups 狮子 *shīzi*, 猴子 *hóuzi*,
  兔子 *tùzi* (neutral-tone 子, apical vowel) with 飞机 *fēijī* and 狐狸
  *húli* (palatal *i*). Those do not rhyme to a native ear. Fixing it means
  re-cutting the `cmnRhyme` finals — a linguistic data call, not a code
  bug, and worth a native speaker rather than my judgement.
- **More or Less, hard tier.** `minGap: 1` over counts up to 10 asks a
  four-year-old to eyeball 9 scattered critters against 10. The question is
  unambiguous and the answer is well defined — it is a difficulty choice,
  so I left it alone, but it is the one tier where a correct listener still
  loses a lot.
- **Shadow Match silhouettes.** Whether two icons cast indistinguishable
  shadows once rotated up to 70° and mirrored can't be settled from the
  data — it needs eyes on the sprites. The round builder's guarantees
  (answer present, options unique, same-category distractors only when the
  tier asks for them) all hold.
- **`CATEGORY_CONFLICTS` is applied by Rule Time but not Odd One Out.** It
  is a filler rule ("don't offer an animal as a non-match against
  flowers"), and Odd One Out's questions enumerate their categories, so no
  round it can build is ambiguous today. Left as-is rather than widening a
  rule that isn't currently buying anything.

---

## Everything else

Checked and clean — the question is answerable from the round, has one
answer, and matches its wording:

| Game | Question | Why it holds |
|---|---|---|
| Spot It! / Duel | "Tap the picture on BOTH cards" | Projective plane of order 5: any two cards share exactly one symbol, tested |
| Find the Difference | "{n} sneaky changes" | Hitboxes are the inpainting rects; manifest invariants tested |
| Hidden Objects | "Can you find all of these?" | Same; targets are shown in the tray |
| Memory Match | "Find all {n} pairs" | Each icon appears exactly twice, tested |
| Picture Puzzle | "Tap two pieces to swap" | No question — a solved-state check |
| Shadow Match | "Whose shadow is this?" | Answer always among options, options unique |
| Rule Time | "Tap all the ANIMALS!" | `isMatch` ⇔ category membership, tested (wording fixed above) |
| Letter Hunt (upper/sound/kana) | "Find the letter B!" / "Which letter says kuh?" | Sound tier dedups (letter, sound) so C/K can't both answer "kuh" |
| Number Hunt | "Find the number 7!" | Distinct tiles, one target |
| First Words (non-EN) | spoken word → picture | Name-twin guard added above |
| Rhyme Time | "Which one rhymes with FROG?" | Exactly one same-family tile; distractors drawn from other families |
| Word Builder | "Can you spell dog?" | Decoys never overlap the word's own characters |
| Count With Me | "How many?" | Tap-to-count phase, then three unique choices |
| More or Less | "Tap the side with MORE" | Counts differ by ≥ minGap; correct side derived |
| Little Sums | "How many now?" | Choices unique, contain the sum |
| Music Box | "Tap anywhere to play the next note" | No question |
| Car Mode | scripted prompt → reveal | Answers authored per round |
| Little Escapes | "Search the picture" | Every room proved solvable by the greedy oracle |
| Melody Bells / Echo Beat / Steady Beat | imitation | Scored against the sequence played |
| Same or Different | "Do the two melodies match?" | `answer` derived from the phrases, both branches tested |
| Story Path / Sticker Party | open choice | No right answer by design |

---

## Guard tests added

| Test | Catches |
|---|---|
| `musicgames`: *the answer is what the ears heard, never a coin flip* | High or Low regression |
| `musicgames`: *the answer field always agrees with the tempo played* | Fast or Slow regression |
| `quizsuite`: *no tile is drawn as the target's look-alike glyph* | I/l collision |
| `quizsuite`: *no distractor can answer the prompt under a name the kid might use* | First Sounds / First Words ambiguity |
| `bingo`: *no call has two plausible answers, under any child name* | Phonics board ambiguity |
| `bingo`: *never shows two icons a kid calls by the same word* | Name board twins |
| `newgames`: *every category has a spoken question in all four langs* | A new category reaching the generic fallback |
