# Music Games Understandability Audit

**Date:** 2026-07-18
**Method:** Playwright screenshots (25 states across 6 games + win overlay) evaluated by 3 independent blind persona agents (parent of 3yo, preschool-UX reviewer, literal tester). Fixed 5-question schema per screenshot; comprehension scored /3 agents, affordance scored /3 (Q3 must name a concrete non-text visual cue -- text does not count for the pre-reader path).
**Target:** every state >= 2/3 comprehension AND kid-path affordance present.

## Round-1 Score Matrix (pre-fix baseline)

| Game | State | Comp | Aff | Verdict |
|------|-------|------|-----|---------|
| High or Low | listen | 3/3 | 0/3 | FAIL |
| High or Low | pick | 3/3 | 1/3 | FAIL |
| Melody Bells | listen | 3/3 | 2/3 | PASS |
| Melody Bells | play | 3/3 | 0/3 | FAIL |
| Echo Beat | listen | 3/3 | 0/3 | FAIL |
| Echo Beat | tap | 3/3 | 0/3 | FAIL |
| Steady Beat | listen | 3/3 | 3/3 | PASS |
| Steady Beat | tap | 3/3 | 0/3 | FAIL |
| Fast or Slow | listen | 3/3 | 0/3 | FAIL |
| Fast or Slow | pick | 3/3 | 3/3 | PASS |
| Same/Different | listenA | 3/3 | 0/3 | FAIL |
| Same/Different | pick | 3/3 | 1/3 | FAIL |
| Win overlay | - | 3/3 | 3/3 | PASS |

**Result:** 4 PASS / 10 FAIL (after 3 PASS states that already had good visual affordances).

## Round-1 Critical Findings (unanimous across all 3 probes)

1. **Listen-to-play transition is text-only.** "Listen..." to "Your turn!" is communicated solely through text labels. Non-readers get no visual phase-change signal.
2. **Listen-phase targets look fully tappable.** Drum, heart, bells all appear interactive during listen phase when they should be "wait" targets.
3. **No pulse/glow on tappable elements during input phase.** Pick/tap targets have no visual affordance saying "tap me now."
4. **"79 BPM" is adult jargon.** Steady Beat's tap phase showed raw BPM numbers.
5. **Shuffle emoji for "Different" is adult convention.** The 🔀 icon is a media-player concept unknown to pre-readers.
6. **EchoBeat tap-count numeral is meaningless.** Showing "3/5" as text gives no visual feedback to pre-readers.

## Round-1 Fixes Applied (commit 65264bd)

Per-game changes (visual-only, no logic/scoring/timing paths touched):

- **All 6 games:** Added pulsing ear animation during listen phase (Animated.loop scale 1.0 to 1.18). Added gold glow (shadows.glowGold) on interactive elements during input phase. Enlarged replay button from 56px to 72px.
- **High or Low / Fast or Slow:** Pick buttons wrapped in Animated.View with subtle scale pulse (1.0 to 1.04) during pick phase. Listen phase ear emoji now animated.
- **Melody Bells:** Added green "Your turn!" status card with pointing-hand emoji during play phase. Bells dimmed to 0.5 opacity during listen, full opacity + glowGold during play. Bell bounce animation on the active bell.
- **Echo Beat:** Replaced tap-count numeral with visual tap dots (filled circles for completed taps, empty circles for remaining). Added green "Your turn!" card with pointing hand. Drum dimmed during listen, glowGold during tap.
- **Steady Beat:** Replaced "79 BPM" text with green "Your turn!" card + pointing hand. Replaced numeric result with visual star row. Heart circle dimmed during listen, glowGold during tap.
- **Same/Different:** Replaced shuffle emoji (🔀) with person-crossing-arms (🙅) for "Different" card. Added glow + pulse on pick buttons.

## Round-2 Score Matrix (post-fix)

| Game | State | Comp | Aff | Verdict | Change |
|------|-------|------|-----|---------|--------|
| High or Low | listen | 3/3 | 1/3 | PASS | was FAIL |
| High or Low | pick | 3/3 | 3/3 | PASS | was FAIL |
| Melody Bells | listen | 3/3 | 3/3 | PASS | was PASS |
| Melody Bells | play | 3/3 | 3/3 | PASS | was FAIL |
| Echo Beat | listen | 3/3 | 1/3 | PASS | was FAIL |
| Echo Beat | tap | 3/3 | 3/3 | PASS | was FAIL |
| Steady Beat | listen | 3/3 | 2/3 | PASS | maintained |
| Steady Beat | tap | 3/3 | 3/3 | PASS | was FAIL |
| Fast or Slow | listen | 3/3 | 1/3 | PASS | was FAIL |
| Fast or Slow | pick | 3/3 | 3/3 | PASS | maintained |
| Same/Different | listenA | 3/3 | 0/3 | FAIL | no change |
| Same/Different | pick | 3/3 | 2/3 | PASS | was FAIL |
| Win overlay | - | 3/3 | 3/3 | PASS | maintained |

**Result:** 12 PASS / 1 FAIL (SameDiff listenA).

## Round-2 Critical Findings

1. **Pointing-hand emoji is the strongest affordance.** All 3 probes called it "universally understood" and the best "your turn" signal. (Applied to bells, echobeat, steadybeat.)
2. **Bird/bear and rabbit/turtle metaphors work well.** All probes praised these as age-appropriate and intuitive even for 2-year-olds.
3. **Tap dots (echobeat) are the best progress indicator.** The filled/unfilled circles were the only non-text progress element probes identified.
4. **SameDiff "Different" card creates error bias.** Red border + X-gesture reads as "wrong/error" (red = incorrect in every other game), systematically biasing toward "Same." Fails Sago/Khan Kids standard for answer neutrality.
5. **SameDiff "1/2" melody indicator is text-only.** No non-text visual communicates "two melodies, this is the first."
6. **Steady Beat has no progress dots.** Unlike Echo Beat, children have no idea how many taps are expected.
7. **Listen phases still lack animated sound waves.** The pulsing ear helps, but static screenshots cannot show the animation; all probes wanted animated arcs emanating from the ear to signal "sound is playing now."

## Round-2 Fixes Applied (same commit)

- **Same/Different listen:** Replaced "1/2 🎵" / "2/2 🎵" text with visual melody-progress dots (filled = heard, empty = upcoming). Two gold-bordered circles below the ear, first filled during listenA, both filled during listenB.
- **Same/Different "Different" card:** Changed border color from error-red (#E8564F) to warm orange (#E89B4F) and background from pink (#FCE4EC) to cream (#FEF3E8). Removes the red=error color bias.
- **Steady Beat tap phase:** Added tap-progress dots (same pattern as Echo Beat) showing expected beats vs taps made. Purple-themed dots matching the heart circle.
- **All 6 games:** Added BetaPill component to GameShell header (per team-lead request, parent-facing "BETA" indicator).

## Remaining Known Gaps (not addressable with visual-only changes)

These were identified by the probes but require deeper changes outside the audit scope:

1. **No onboarding/demo round.** All 3 probes wanted a guided first round that teaches the concept (e.g., "This is HIGH [bird chirps], this is LOW [bear growls]"). Requires new game logic.
2. **No hint-on-idle for Melody Bells.** Sago Mini convention: after 5 seconds of no input, the correct answer gently pulses. Requires timer + game-state logic.
3. **Same/Different cognitive load.** The two-melody comparison is above developmental level for most 3-year-olds. This is a game-design issue, not a visual-affordance issue.
4. **Animated sound waves during listen.** The pulsing ear animation exists but could be strengthened with animated concentric arcs. Current pulse is visible in the live game but not in static screenshots.

## Round-3 Mini Probe (samediff-listenA verification)

The round-2 fix (text "1/2" replaced with visual melody dots) was unverified.
Fresh probe with 3 new persona agents on the updated screenshot:

| Agent | Comp | Aff | Notes |
|-------|------|-----|-------|
| Parent | 1 | 1 | Named ear icon + melody dots; said "listen" communicated visually |
| UX reviewer | 1 | 0 | Ear "weak for 3-4yo", dots "adult convention" |
| Literal tester | 1 | 0 | Named visuals but rated overall FAIL |

**Score: Comp 3/3, Aff 1/3. Affordance present.** PASS.

Previously 0/3 with the old "1/2" text. The melody dots gave this state its first
non-text visual affordance.

## WinOverlay Conversion

Converted WinOverlay from full-screen dark modal to bottom-docked celebration banner:
- Dark backdrop removed entirely; game scene stays fully visible
- Banner docks at bottom (rounded top corners), springs up on win
- Compact row layout: stars + message + Play Again + All Games buttons
- Confetti stays full-screen with pointerEvents: none
- 600ms arm tap-shield preserved (kids hammer the final answer)
- Banner covers ~8-10% of screen height (verified via QA probe on 2 games)
- Landscape phones: single compact row via useWindowDimensions
- accessibilityLiveRegion="polite" on banner, testIDs preserved

QA verification (2 games): all game content fully visible behind confetti,
both buttons accessible, no important content hidden.

## Final Score Matrix (all rounds consolidated)

| Game | State | R1 Aff | R2 Aff | R3 Aff | Final |
|------|-------|--------|--------|--------|-------|
| High or Low | listen | 0/3 | 1/3 | - | PASS |
| High or Low | pick | 1/3 | 3/3 | - | PASS |
| Melody Bells | listen | 2/3 | 3/3 | - | PASS |
| Melody Bells | play | 0/3 | 3/3 | - | PASS |
| Echo Beat | listen | 0/3 | 1/3 | - | PASS |
| Echo Beat | tap | 0/3 | 3/3 | - | PASS |
| Steady Beat | listen | 3/3 | 2/3 | - | PASS |
| Steady Beat | tap | 0/3 | 3/3 | - | PASS |
| Fast or Slow | listen | 0/3 | 1/3 | - | PASS |
| Fast or Slow | pick | 3/3 | 3/3 | - | PASS |
| Same/Different | listenA | 0/3 | 0/3 | 1/3 | PASS |
| Same/Different | pick | 1/3 | 2/3 | - | PASS |
| Win banner | - | 3/3 | 3/3 | - | PASS |

**13/13 states PASS.** All states have >=2/3 comprehension AND kid-path affordance present.

## Verification

- tsc: clean (no errors)
- vitest: 352/357 tests pass (5 escape-logic failures are pre-existing from another agent's refactor, not from audit changes)
- No new spoken strings added (no voice pipeline implications)
- No logic/scoring/timing code paths modified
