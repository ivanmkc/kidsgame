import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
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
import { playDrum } from "../../music";
import { useWinLine } from "../winlines";
import {
  makeSteadyBeatRound,
  roundsToWin,
  scoreTaps,
  passThreshold,
  SteadyBeatRound,
  SteadyBeatPhase,
  canTap,
  steadyBeatLayout,
} from "./logic";

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

export function SteadyBeatGame({ onHome, difficulty, lang }: Props) {
  const { height } = useWindowDimensions();
  const { circleSize, gap } = steadyBeatLayout(height);
  const total = roundsToWin(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState<SteadyBeatRound>(() =>
    makeSteadyBeatRound(rngRef.current, difficulty),
  );
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<SteadyBeatPhase>("listen");
  const [listenBeat, setListenBeat] = useState<number | null>(0);
  const [tapTimesMs, setTapTimesMs] = useState<number[]>([]);
  const tapTimesRef = useRef(tapTimesMs);
  tapTimesRef.current = tapTimesMs;
  const [startMs, setStartMs] = useState(0);
  const [hits, setHits] = useState(0);
  const [sparkKey, setSparkKey] = useState(0);
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenPulse = useRef(new Animated.Value(1)).current;
  const [won, setWon] = useState(false);
  const canTapCircle = canTap(round, tapTimesMs.length, phase, won);
  useWinLine(won, t(lang, "win.steadybeat" as never));
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    };
  }, []);

  const pulseAnim = useRef(new Animated.Value(0)).current;

  const startMetronome = useCallback(
    (r: SteadyBeatRound) => {
      setPhase("listen");
      const beatMs = 60000 / r.bpm;
      const triggerBeatVisual = () => {
        setFlash(true);
        listenPulse.setValue(1.25);
        Animated.spring(listenPulse, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }).start();
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(
          () => setFlash(false),
          Math.min(180, beatMs / 2),
        );
      };

      playDrum(0.5);
      setListenBeat(0);
      triggerBeatVisual();
      let count = 1;
      const interval = setInterval(() => {
        if (count < 4) {
          playDrum(0.5);
          setListenBeat(count);
          count++;
          triggerBeatVisual();
        } else {
          clearInterval(interval);
          if (flashTimer.current) clearTimeout(flashTimer.current);
          setFlash(false);
          setListenBeat(null);
          setPhase("tap");
          say(t(lang, "music.yourTurn" as never));
          const tapBeatMs = 60000 / r.bpm;
          setStartMs(performance.now() + tapBeatMs);
          pulseAnim.setValue(0);
          Animated.loop(
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: tapBeatMs,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
          ).start();
        }
      }, beatMs);
      return () => {
        clearInterval(interval);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        listenPulse.stopAnimation();
        listenPulse.setValue(1);
      };
    },
    [lang, listenPulse, pulseAnim],
  );

  useEffect(() => {
    if (!won) {
      say(t(lang, "shell.steadybeat.sub"));
      tapTimesRef.current = [];
      setTapTimesMs([]);
      setHits(0);
      setFlash(false);
      const cleanup = startMetronome(round);
      return () => {
        cleanup();
        pulseAnim.stopAnimation();
      };
    }
  }, [lang, round, won]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "tap") return;
    const beatMs = 60000 / round.bpm;
    const totalTime = (round.beatsPerRound + 1) * beatMs + 500;
    const timer = setTimeout(() => {
      pulseAnim.stopAnimation();
      const result = scoreTaps(round, tapTimesRef.current, startMs, difficulty);
      setHits(result.hits);
      setPhase("result");
      const threshold = passThreshold(difficulty);
      if (result.hits / result.total >= threshold) {
        sfx.good();
        setSparkKey((k) => k + 1);
        const nextScore = score + 1;
        setScore(nextScore);
        if (nextScore < total) {
          transitionTimerRef.current = setTimeout(
            () => setRound(makeSteadyBeatRound(rngRef.current, difficulty)),
            1200,
          );
        } else {
          transitionTimerRef.current = setTimeout(() => {
            setWon(true);
          }, 1200);
        }
      } else {
        sfx.wrong();
        transitionTimerRef.current = setTimeout(
          () => setRound(makeSteadyBeatRound(rngRef.current, difficulty)),
          1200,
        );
      }
    }, totalTime);
    return () => clearTimeout(timer);
  }, [phase, startMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTap = () => {
    if (!canTap(round, tapTimesRef.current.length, phase, won)) return;
    playDrum();
    const now = performance.now();
    tapTimesRef.current = [...tapTimesRef.current, now];
    if (tapTimesRef.current.length >= round.beatsPerRound) {
      pulseAnim.stopAnimation();
    }
    setTapTimesMs((prev) =>
      prev.length >= round.beatsPerRound ? prev : [...prev, now],
    );
  };

  const reset = () => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(false);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setWon(false);
    tapTimesRef.current = [];
    setTapTimesMs([]);
    setHits(0);
    setListenBeat(0);
    setRound(makeSteadyBeatRound(rngRef.current, difficulty));
  };

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 0.1, 0.5, 1],
    outputRange: [1.15, 1, 0.92, 1.15],
  });

  const earPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (phase === "listen") {
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
    }
    return () => earPulse.stopAnimation();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const resultStars = [];
  if (phase === "result") {
    for (let i = 0; i < round.beatsPerRound; i++) {
      resultStars.push(
        <Text key={i} style={styles.resultStar}>
          {i < hits ? "⭐" : "☆"}
        </Text>,
      );
    }
  }

  return (
    <GameShell
      title={t(lang, "shell.steadybeat.title" as never)}
      subtitle={t(lang, "shell.steadybeat.sub" as never)}
      onBack={onHome}
      lang={lang}
      right={
        <ScoreChip label={`💓 ${score}/${total}`} testID="steadybeat-score" />
      }
    >
      <View testID="steadybeat-board" style={[styles.board, { gap }]}>
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
            <View style={styles.listenDotsRow}>
              {Array.from({ length: 4 }).map((_, i) => (
                <View
                  key={i}
                  testID={
                    listenBeat !== null && i <= listenBeat
                      ? "steadybeat-listen-dot-filled"
                      : "steadybeat-listen-dot-empty"
                  }
                  style={[
                    styles.listenDot,
                    listenBeat !== null &&
                      i <= listenBeat &&
                      styles.listenDotFilled,
                  ]}
                />
              ))}
            </View>
          </View>
        ) : phase === "result" ? (
          <View style={[styles.statusCard, shadows.soft]}>
            <View style={styles.resultRow}>{resultStars}</View>
          </View>
        ) : (
          <View style={[styles.statusCard, shadows.soft, styles.yourTurnCard]}>
            <Text style={styles.statusEmoji}>👆</Text>
            <Text style={styles.statusText}>
              {t(lang, "music.yourTurn" as never)}
            </Text>
          </View>
        )}
        <Pressable
          onPress={onTap}
          testID="steadybeat-circle"
          accessibilityRole="button"
          accessibilityLabel={t(lang, "shell.steadybeat.sub")}
          disabled={!canTapCircle}
          style={({ pressed }) => [
            styles.circle,
            {
              width: circleSize,
              height: circleSize,
              borderRadius: circleSize / 2,
            },
            shadows.lifted,
            phase === "listen" && !flash && styles.circleDimmed,
            phase === "listen" && flash && styles.circleFlash,
            phase === "listen" && flash && shadows.glowGold,
            canTapCircle && shadows.glowGold,
            pressed && styles.circlePressed,
          ]}
        >
          <Animated.View
            testID={flash ? "steadybeat-beat-flash" : undefined}
            style={[
              styles.pulse,
              {
                transform: [
                  {
                    scale:
                      phase === "tap" && canTapCircle
                        ? pulseScale
                        : phase === "listen"
                          ? listenPulse
                          : 1,
                  },
                ],
              },
            ]}
          >
            <Text style={styles.circleEmoji}>💓</Text>
          </Animated.View>
          <SparkleBurst trigger={sparkKey} count={6} size={14} />
        </Pressable>
        {phase === "tap" && (
          <ProgressDots
            beatsPerRound={round.beatsPerRound}
            completedTaps={tapTimesMs.length}
          />
        )}
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, "win.steadybeat" as never)}
        onNext={reset}
        nextLabel={t(lang, "overlay.playAgain")}
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

function ProgressDots({
  beatsPerRound,
  completedTaps,
}: {
  beatsPerRound: number;
  completedTaps: number;
}) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: beatsPerRound }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i < completedTaps && styles.dotFilled]}
          testID={
            i < completedTaps
              ? "steadybeat-tap-dot-filled"
              : "steadybeat-tap-dot-empty"
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
  statusEmoji: { fontSize: 30 },
  statusText: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    textAlign: "center",
  },
  resultRow: { flexDirection: "row", gap: 4 },
  resultStar: { fontSize: 22 },
  circle: {
    backgroundColor: "#9B7EDE",
    borderWidth: 6,
    borderColor: "#7A5BBF",
    alignItems: "center",
    justifyContent: "center",
  },
  circlePressed: { transform: [{ scale: 0.92 }] },
  circleDimmed: { opacity: 0.45 },
  circleFlash: {
    borderColor: colors.gold,
    backgroundColor: "#B89FED",
  },
  pulse: { alignItems: "center", justifyContent: "center" },
  circleEmoji: { fontSize: 56 },
  dotsRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: "#7A5BBF",
    backgroundColor: "transparent",
  },
  dotFilled: {
    backgroundColor: "#9B7EDE",
  },
  listenDotsRow: { flexDirection: "row", gap: 8, marginLeft: 4 },
  listenDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: colors.gold,
    backgroundColor: "transparent",
  },
  listenDotFilled: {
    backgroundColor: colors.gold,
  },
});
