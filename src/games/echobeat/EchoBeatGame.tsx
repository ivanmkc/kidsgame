import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { GameShell, ScoreChip } from "../../components/GameShell";
import { WinOverlay } from "../../components/WinOverlay";
import { SparkleBurst } from "../../components/Sparkles";
import { Difficulty } from "../../difficulty";
import { Lang } from "../../lang";
import { t } from "../../i18n";
import { makeRng } from "../../rng";
import { colors, fonts, shadows } from "../../theme";
import { sayThen, sfx, stopNarration } from "../../sound";
import { playDrum, playDrumSequence, stopSequence } from "../../music";
import { useWinLine } from "../winlines";
import {
  makeEchoBeatRound,
  roundsToWin,
  checkEcho,
  EchoBeatRound,
  EchoBeatPhase,
  echoBeatLayout,
  canTap,
  evaluationDelayMs,
} from "./logic";

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

export function EchoBeatGame({ onHome, difficulty, lang }: Props) {
  const { width, height } = useWindowDimensions();
  const { drumSize, drumEmojiSize, gap, shortH } = echoBeatLayout(
    width,
    height,
  );
  const total = roundsToWin(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState<EchoBeatRound>(() =>
    makeEchoBeatRound(rngRef.current, difficulty),
  );
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<EchoBeatPhase>("listen");
  const [flash, setFlash] = useState<number | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const [result, setResult] = useState<"good" | "bad" | null>(null);
  const [sparkKey, setSparkKey] = useState(0);
  const tapTimesRef = useRef<number[]>([]);
  const tapCountRef = useRef(0);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const speechEpoch = useRef(0);
  const won = score >= total;
  useWinLine(won, t(lang, "win.echobeat" as never));

  const tempoPulseAnim = useRef(new Animated.Value(0)).current;
  const tempoPulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const stopTempoPulse = useCallback(() => {
    if (tempoPulseLoop.current) {
      tempoPulseLoop.current.stop();
      tempoPulseLoop.current = null;
    }
    tempoPulseAnim.setValue(0);
  }, [tempoPulseAnim]);

  const startTempoPulse = useCallback(
    (bpm: number) => {
      stopTempoPulse();
      const beatMs = 60000 / bpm;
      tempoPulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(tempoPulseAnim, {
            toValue: 1,
            duration: beatMs * 0.5,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(tempoPulseAnim, {
            toValue: 0,
            duration: beatMs * 0.5,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      tempoPulseLoop.current.start();
    },
    [stopTempoPulse, tempoPulseAnim],
  );

  const playDemo = useCallback(
    (r: EchoBeatRound) => {
      stopSequence();
      stopTempoPulse();
      if (flashTimer.current) clearTimeout(flashTimer.current);
      setFlash(null);
      setPhase("listen");
      startTempoPulse(r.bpm ?? 120);
      playDrumSequence(
        r.gaps,
        (i) => {
          setFlash(i);
          pulseAnim.setValue(1.25);
          Animated.spring(pulseAnim, {
            toValue: 1,
            friction: 4,
            useNativeDriver: true,
          }).start();
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setFlash(null), 180);
        },
        () => {
          setFlash(null);
          setPhase("tap");
        },
      );
    },
    [pulseAnim, startTempoPulse, stopTempoPulse],
  );

  useEffect(() => {
    return () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    };
  }, []);

  useEffect(() => {
    if (won || result === "good") return;
    const epoch = ++speechEpoch.current;
    if (flashTimer.current) clearTimeout(flashTimer.current);
    if (resultTimer.current) clearTimeout(resultTimer.current);
    stopNarration();
    stopSequence();
    stopTempoPulse();
    setFlash(null);
    tapTimesRef.current = [];
    tapCountRef.current = 0;
    setTapCount(0);
    setResult(null);
    setPhase("listen");

    if (score === 0) {
      sayThen([t(lang, "shell.echobeat.sub")], () => {
        if (speechEpoch.current === epoch) {
          playDemo(round);
        }
      });
    } else {
      playDemo(round);
    }

    return () => {
      speechEpoch.current++;
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (resultTimer.current) clearTimeout(resultTimer.current);
      stopNarration();
      stopSequence();
      stopTempoPulse();
    };
  }, [lang, round, won]); // eslint-disable-line react-hooks/exhaustive-deps

  const evaluate = useCallback(
    (times: number[]) => {
      const res = checkEcho(round, times, difficulty);
      if (res.countCorrect && res.timingCorrect) {
        stopTempoPulse();
        sfx.good();
        setSparkKey((k) => k + 1);
        setResult("good");
        const nextScore = score + 1;
        setScore(nextScore);
        if (nextScore < total) {
          transitionTimer.current = setTimeout(() => {
            transitionTimer.current = null;
            setResult(null);
            setRound(makeEchoBeatRound(rngRef.current, difficulty));
          }, 800);
        }
      } else {
        stopTempoPulse();
        sfx.wrong();
        setResult("bad");
        resultTimer.current = setTimeout(() => {
          tapTimesRef.current = [];
          tapCountRef.current = 0;
          setTapCount(0);
          setResult(null);
          playDemo(round);
        }, 1000);
      }
    },
    [difficulty, playDemo, round, score, stopTempoPulse, total],
  );

  const onTap = () => {
    if (!canTap(round, tapCountRef.current, phase, won, result)) return;
    playDrum();
    const now = performance.now();
    tapTimesRef.current.push(now);
    tapCountRef.current += 1;
    const nextTimes = [...tapTimesRef.current];
    const nextCount = tapCountRef.current;
    setTapCount(nextCount);

    if (resultTimer.current) clearTimeout(resultTimer.current);

    const delay = evaluationDelayMs(round, nextCount);
    if (delay === 0) {
      evaluate(nextTimes);
    } else {
      resultTimer.current = setTimeout(() => {
        evaluate(tapTimesRef.current);
      }, delay);
    }
  };

  const reset = () => {
    speechEpoch.current++;
    if (flashTimer.current) clearTimeout(flashTimer.current);
    if (resultTimer.current) clearTimeout(resultTimer.current);
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    stopNarration();
    stopSequence();
    stopTempoPulse();
    setFlash(null);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    tapTimesRef.current = [];
    tapCountRef.current = 0;
    setTapCount(0);
    setResult(null);
    setPhase("listen");
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

  const tempoPulseScale = tempoPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.25],
  });

  const canTapDrum = canTap(round, tapCount, phase, won, result);
  const tapDots = [];
  const expectedHits = round.gaps.length + 1;
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
      <View testID="echobeat-board" style={[styles.board, { gap }]}>
        {phase === "listen" ? (
          <View
            style={[
              styles.statusCard,
              shadows.soft,
              shortH && styles.statusCardShort,
            ]}
          >
            <Animated.Text
              style={[
                styles.statusEmoji,
                shortH && styles.statusEmojiShort,
                { transform: [{ scale: earPulse }] },
              ]}
            >
              👂
            </Animated.Text>
            <Text style={[styles.statusText, shortH && styles.statusTextShort]}>
              {t(lang, "music.listen" as never)}
            </Text>
            <Animated.View
              testID="echobeat-tempo-pulse"
              style={[
                styles.tempoPulseDot,
                { transform: [{ scale: tempoPulseScale }] },
              ]}
            />
          </View>
        ) : (
          <View
            style={[
              styles.statusCard,
              shadows.soft,
              styles.yourTurnCard,
              result === "bad" && styles.wrongCard,
              shortH && styles.statusCardShort,
            ]}
          >
            <Text
              style={[styles.statusEmoji, shortH && styles.statusEmojiShort]}
            >
              {result === "good" ? "🎉" : result === "bad" ? "🔄" : "👆"}
            </Text>
            <Text style={[styles.statusText, shortH && styles.statusTextShort]}>
              {result === "good"
                ? "🎉"
                : result === "bad"
                  ? "🔄"
                  : t(lang, "music.yourTurn" as never)}
            </Text>
            <Animated.View
              testID="echobeat-tempo-pulse"
              style={[
                styles.tempoPulseDot,
                styles.tempoPulseDotTap,
                { transform: [{ scale: tempoPulseScale }] },
              ]}
            />
          </View>
        )}
        <Animated.View
          style={
            phase === "tap" && canTapDrum
              ? {
                  transform: [
                    { scale: Animated.multiply(drumScale, tempoPulseScale) },
                  ],
                }
              : undefined
          }
        >
          <Pressable
            onPress={onTap}
            testID="echobeat-drum"
            accessibilityRole="button"
            accessibilityLabel={t(lang, "shell.echobeat.sub")}
            disabled={!canTapDrum}
            style={({ pressed }) => [
              styles.drum,
              { width: drumSize, height: drumSize, borderRadius: drumSize / 2 },
              shadows.lifted,
              phase === "listen" && flash === null && styles.drumDimmed,
              flash !== null && styles.drumFlash,
              flash !== null && shadows.glowGold,
              canTapDrum && shadows.glowGold,
              pressed && styles.drumPressed,
            ]}
          >
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Text style={[styles.drumEmoji, { fontSize: drumEmojiSize }]}>
                🥁
              </Text>
            </Animated.View>
            <SparkleBurst trigger={sparkKey} count={6} size={14} />
          </Pressable>
        </Animated.View>
        <View
          testID="echobeat-tap-dots"
          style={[
            styles.tapDotRow,
            shortH && styles.tapDotRowShort,
            phase === "listen" && styles.tapDotRowHidden,
          ]}
          aria-hidden={phase === "listen" ? true : undefined}
        >
          {tapDots}
        </View>
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
  statusCardShort: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  yourTurnCard: { borderColor: colors.green, backgroundColor: "#E8F5E9" },
  wrongCard: {
    borderColor: colors.red,
    backgroundColor: "rgba(232,86,79,0.12)",
  },
  statusEmoji: { fontSize: 30 },
  statusEmojiShort: { fontSize: 24 },
  statusText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
    textAlign: "center",
  },
  statusTextShort: { fontSize: 15 },
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
  tapDotRowShort: { marginTop: 0 },
  tapDotRowHidden: { opacity: 0 },
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
  tempoPulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gold,
    marginLeft: 4,
  },
  tempoPulseDotTap: {
    backgroundColor: colors.green,
  },
});
