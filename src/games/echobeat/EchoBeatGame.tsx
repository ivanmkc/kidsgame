import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GameShell, ScoreChip } from "../../components/GameShell";
import { WinOverlay } from "../../components/WinOverlay";
import { SparkleBurst } from "../../components/Sparkles";
import { Difficulty } from "../../difficulty";
import { Lang } from "../../lang";
import { t } from "../../i18n";
import { makeRng } from "../../rng";
import { colors, fonts, shadows } from "../../theme";
import { say, sfx } from "../../sound";
import {
  playDrum,
  playDrumSequence,
  playSequence,
  stopSequence,
} from "../../music";
import { useWinLine } from "../winlines";
import {
  makeEchoBeatRound,
  roundsToWin,
  checkEcho,
  EchoBeatRound,
  tolerancePct,
} from "./logic";

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

export function EchoBeatGame({ onHome, difficulty, lang }: Props) {
  const total = roundsToWin(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState<EchoBeatRound>(() =>
    makeEchoBeatRound(rngRef.current, difficulty),
  );
  const roundRef = useRef(round);
  roundRef.current = round;
  const [score, setScore] = useState(0);
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const [phase, setPhase] = useState<"listen" | "tap" | "result">("listen");
  const [flash, setFlash] = useState<number | null>(null);
  const [activePulseBeat, setActivePulseBeat] = useState<number | null>(null);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const tapTimesRef = useRef(tapTimes);
  tapTimesRef.current = tapTimes;
  const [tapCount, setTapCount] = useState(0);
  const [result, setResult] = useState<"good" | "bad" | null>(null);
  const [sparkKey, setSparkKey] = useState(0);

  const gridStartRef = useRef(0);
  const playDemoRef = useRef<(r: EchoBeatRound) => void>(() => {});
  const countInCancelRef = useRef<(() => void) | null>(null);
  const drumCancelRef = useRef<(() => void) | null>(null);
  const pulseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const deadlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const judgedRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const won = score >= total;
  useWinLine(won, t(lang, "win.echobeat" as never));

  const stopAllTimers = useCallback(() => {
    stopSequence();
    if (countInCancelRef.current) {
      countInCancelRef.current();
      countInCancelRef.current = null;
    }
    if (drumCancelRef.current) {
      drumCancelRef.current();
      drumCancelRef.current = null;
    }
    if (pulseIntervalRef.current) {
      clearInterval(pulseIntervalRef.current);
      pulseIntervalRef.current = null;
    }
    if (pulseClearTimer.current) {
      clearTimeout(pulseClearTimer.current);
      pulseClearTimer.current = null;
    }
    if (flashTimer.current) {
      clearTimeout(flashTimer.current);
      flashTimer.current = null;
    }
    if (deadlineTimer.current) {
      clearTimeout(deadlineTimer.current);
      deadlineTimer.current = null;
    }
    if (resultTimer.current) {
      clearTimeout(resultTimer.current);
      resultTimer.current = null;
    }
    demoTimers.current.forEach(clearTimeout);
    demoTimers.current = [];
  }, []);

  const finishRound = useCallback(
    (currentTaps: number[]) => {
      if (judgedRef.current) return;
      judgedRef.current = true;
      stopAllTimers();
      setActivePulseBeat(null);
      setPhase("result");

      const curRound = roundRef.current;
      const curScore = scoreRef.current;
      const res = checkEcho(
        curRound,
        currentTaps,
        difficulty,
        gridStartRef.current,
      );
      if (res.countCorrect && res.timingCorrect) {
        sfx.good();
        setSparkKey((k) => k + 1);
        setResult("good");
        const nextScore = curScore + 1;
        setScore(nextScore);
        if (nextScore < total) {
          resultTimer.current = setTimeout(() => {
            setRound(makeEchoBeatRound(rngRef.current, difficulty));
          }, 800);
        }
      } else {
        sfx.wrong();
        setResult("bad");
        resultTimer.current = setTimeout(() => {
          setTapTimes([]);
          tapTimesRef.current = [];
          setTapCount(0);
          setResult(null);
          playDemoRef.current(curRound);
        }, 1000);
      }
    },
    [difficulty, stopAllTimers, total],
  );

  const playDemo = useCallback(
    (r: EchoBeatRound) => {
      stopAllTimers();
      judgedRef.current = false;
      setFlash(null);
      setActivePulseBeat(null);
      setPhase("listen");

      const bpm = r.bpm;
      const beatMs = 60000 / bpm;
      const pulseHoldMs = Math.min(180, beatMs * 0.4);
      const flashHoldMs = Math.min(160, beatMs * 0.3);

      const now = performance.now();
      const audioDelayMs = 50; // Web Audio 0.05s lookahead in playSequence/playDrumSequence
      const tapStartMs = now + audioDelayMs + (4 + r.totalBeats) * beatMs;
      gridStartRef.current = tapStartMs;

      // 1. Four distinct high chime clicks for count-in (midi 72 = C5)
      const countInNotes = [
        { m: 72, b: 1 },
        { m: 72, b: 1 },
        { m: 72, b: 1 },
        { m: 72, b: 1 },
      ];
      countInCancelRef.current = playSequence(countInNotes, bpm);

      // 2. Drum pattern onsets 4 beats later, scheduled with playDrumSequence
      // Waiting 4 * beatMs lets playDrumSequence's internal 0.05s lookahead
      // perfectly align the first drum hit with audioDelayMs + 4 * beatMs
      demoTimers.current.push(
        setTimeout(() => {
          drumCancelRef.current = playDrumSequence(r.gaps, (idx) => {
            setFlash(idx);
            pulseAnim.setValue(1.25);
            Animated.spring(pulseAnim, {
              toValue: 1,
              friction: 4,
              useNativeDriver: true,
            }).start();
            if (flashTimer.current) clearTimeout(flashTimer.current);
            flashTimer.current = setTimeout(() => setFlash(null), flashHoldMs);
          });
        }, 4 * beatMs),
      );

      // 3. Unlock tap phase slightly early (at tapStartMs - tolMs) so anticipatory
      // taps within the valid timing tolerance window are captured
      const tolMs = tolerancePct(difficulty) * beatMs;
      const unlockDelayMs = audioDelayMs + (4 + r.totalBeats) * beatMs - tolMs;
      demoTimers.current.push(
        setTimeout(() => {
          setPhase("tap");
          say(t(lang, "music.yourTurn"));
        }, unlockDelayMs),
      );

      // 4. Grid-derived judging deadline: end of echo bar + tolMs
      const deadlineDelayMs =
        audioDelayMs + (4 + r.totalBeats + r.totalBeats) * beatMs + tolMs;
      deadlineTimer.current = setTimeout(() => {
        finishRound(tapTimesRef.current);
      }, deadlineDelayMs);

      // 5. Single continuous musical pulse across both listen and tap phases:
      // Started at audioDelayMs to align perfectly with Web Audio playback
      demoTimers.current.push(
        setTimeout(() => {
          let beatIndex = 0;
          setActivePulseBeat(0);
          pulseClearTimer.current = setTimeout(
            () => setActivePulseBeat(null),
            pulseHoldMs,
          );

          pulseIntervalRef.current = setInterval(() => {
            beatIndex++;
            const currentBeatInBar = beatIndex % 4;
            setActivePulseBeat(currentBeatInBar);
            if (pulseClearTimer.current) clearTimeout(pulseClearTimer.current);
            pulseClearTimer.current = setTimeout(
              () => setActivePulseBeat(null),
              pulseHoldMs,
            );
          }, beatMs);
        }, audioDelayMs),
      );
    },
    [difficulty, finishRound, lang, pulseAnim, stopAllTimers],
  );

  playDemoRef.current = playDemo;

  useEffect(() => {
    if (!won) {
      setTapTimes([]);
      tapTimesRef.current = [];
      setTapCount(0);
      setResult(null);
      playDemo(round);
    }
    return () => {
      stopAllTimers();
    };
  }, [round, won]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTap = () => {
    if (won || phase !== "tap" || judgedRef.current) return;
    playDrum();
    const now = performance.now();
    const nextTaps = [...tapTimesRef.current, now];
    tapTimesRef.current = nextTaps;
    setTapTimes(nextTaps);
    const nextCount = tapCount + 1;
    setTapCount(nextCount);

    if (nextTaps.length >= round.hitCount) {
      finishRound(nextTaps);
    }
  };

  const reset = () => {
    stopAllTimers();
    setActivePulseBeat(null);
    setFlash(null);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setTapTimes([]);
    tapTimesRef.current = [];
    setTapCount(0);
    setResult(null);
    setRound(makeEchoBeatRound(rngRef.current, difficulty));
  };

  useEffect(() => {
    if (phase === "tap" && tapCount > 0) {
      pulseAnim.setValue(1.25);
      Animated.spring(pulseAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }).start();
    }
  }, [tapCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const earPulse = useRef(new Animated.Value(1)).current;
  const drumGlow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase === "listen") {
      drumGlow.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(earPulse, {
            toValue: 1.18,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(earPulse, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      earPulse.stopAnimation();
      earPulse.setValue(1);
      if (phase === "tap") {
        Animated.loop(
          Animated.sequence([
            Animated.timing(drumGlow, {
              toValue: 1,
              duration: 800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(drumGlow, {
              toValue: 0,
              duration: 800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ).start();
      }
    }
    return () => {
      earPulse.stopAnimation();
      drumGlow.stopAnimation();
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const drumScale = drumGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  const tapDots = [];
  const expectedHits = round.hitCount;
  for (let i = 0; i < expectedHits; i++) {
    tapDots.push(
      <View
        key={i}
        style={[styles.tapDot, i < tapCount && styles.tapDotFilled]}
      />,
    );
  }

  return (
    <GameShell
      title={t(lang, "shell.echobeat.title" as never)}
      subtitle={t(lang, "shell.echobeat.sub" as never)}
      onBack={onHome}
      lang={lang}
      right={
        <ScoreChip label={`🥁 ${score}/${total}`} testID="echobeat-score" />
      }
    >
      <View style={styles.board}>
        {phase === "listen" ? (
          <View style={[styles.statusCard, shadows.soft]}>
            <Animated.Text
              style={[styles.statusEmoji, { transform: [{ scale: earPulse }] }]}
            >
              👂
            </Animated.Text>
            <Text style={styles.statusText}>
              {t(lang, "music.listen" as never)}
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.statusCard,
              shadows.soft,
              styles.yourTurnCard,
              result === "bad" && styles.wrongCard,
            ]}
          >
            <Text style={styles.statusEmoji}>
              {result === "good" ? "🎉" : result === "bad" ? "🔄" : "👆"}
            </Text>
            <Text style={styles.statusText}>
              {result === "good"
                ? "🎉"
                : result === "bad"
                  ? "🔄"
                  : t(lang, "music.yourTurn")}
            </Text>
          </View>
        )}
        <View style={styles.beatDotRow}>
          {[0, 1, 2, 3].map((b) => (
            <View
              key={b}
              testID={`beat-dot-${b}`}
              accessibilityState={{ selected: activePulseBeat === b }}
              aria-selected={activePulseBeat === b}
              style={[
                styles.beatDot,
                activePulseBeat === b && styles.beatDotActive,
              ]}
            />
          ))}
        </View>
        <Animated.View
          style={
            phase === "tap" ? { transform: [{ scale: drumScale }] } : undefined
          }
        >
          <Pressable
            onPress={onTap}
            testID="echobeat-drum"
            disabled={phase !== "tap"}
            style={({ pressed }) => [
              styles.drum,
              shadows.lifted,
              phase === "listen" && flash === null && styles.drumDimmed,
              flash !== null && styles.drumFlash,
              flash !== null && shadows.glowGold,
              phase === "tap" && shadows.glowGold,
              pressed && styles.drumPressed,
            ]}
          >
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Text style={styles.drumEmoji}>🥁</Text>
            </Animated.View>
            <SparkleBurst trigger={sparkKey} count={6} size={14} />
          </Pressable>
        </Animated.View>
        {phase === "tap" && <View style={styles.tapDotRow}>{tapDots}</View>}
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, "win.echobeat" as never)}
        onNext={reset}
        nextLabel={t(lang, "overlay.playAgain")}
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  board: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    paddingHorizontal: 16,
  },
  statusCard: {
    backgroundColor: "#F7EDDA",
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.gold,
    paddingVertical: 10,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  yourTurnCard: { borderColor: colors.green, backgroundColor: "#E8F5E9" },
  wrongCard: {
    borderColor: colors.red,
    backgroundColor: "rgba(232,86,79,0.12)",
  },
  statusEmoji: { fontSize: 30 },
  statusText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
    textAlign: "center",
  },
  beatDotRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  beatDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: "rgba(232, 135, 79, 0.15)",
  },
  beatDotActive: {
    backgroundColor: colors.gold,
    borderColor: "#C5693A",
    transform: [{ scale: 1.25 }],
  },
  drum: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#E8874F",
    borderWidth: 6,
    borderColor: "#C5693A",
    alignItems: "center",
    justifyContent: "center",
  },
  drumPressed: { transform: [{ scale: 0.92 }] },
  drumDimmed: { opacity: 0.45 },
  drumFlash: {
    borderColor: colors.gold,
    backgroundColor: "#FFA25B",
  },
  drumEmoji: { fontSize: 64 },
  tapDotRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  tapDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#C5693A",
    backgroundColor: "transparent",
  },
  tapDotFilled: {
    backgroundColor: "#E8874F",
  },
});
