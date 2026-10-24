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
import { say, saySequence, sayThen, sfx, stopNarration } from "../../sound";
import { playSequence, stopSequence } from "../../music";
import { useWinLine } from "../winlines";
import {
  makeFastSlowRound,
  roundsToWin,
  getActualSpeed,
  isCorrect,
  FastSlowRound,
  getInstructionalFeedback,
  nextScoreValue,
} from "./logic";

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

export function FastSlowGame({ onHome, difficulty, lang }: Props) {
  const total = roundsToWin(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const lockedRef = useRef(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundEpochRef = useRef(0);
  const feedbackSpeechRef = useRef<string[] | null>(null);
  const firstTryRef = useRef(true);
  const [history, setHistory] = useState<("fast" | "slow")[]>([]);
  const [round, setRound] = useState<FastSlowRound>(() =>
    makeFastSlowRound(rngRef.current, difficulty, []),
  );
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<"listen" | "pick" | "celebrate">("listen");
  const [wrongPick, setWrongPick] = useState<"fast" | "slow" | null>(null);
  const [instructionalTempo, setInstructionalTempo] = useState<
    "fast" | "slow" | null
  >(null);
  const [sparkKey, setSparkKey] = useState(0);
  const [won, setWon] = useState(false);
  useWinLine(won, t(lang, "win.fastslow" as never));

  const playRound = useCallback((r: FastSlowRound) => {
    stopSequence();
    setPhase("listen");
    const epoch = roundEpochRef.current;
    playSequence(r.notes, r.bpm, undefined, () => {
      if (roundEpochRef.current === epoch) {
        setInstructionalTempo(null);
        lockedRef.current = false;
        setPhase("pick");
      }
    });
  }, []);

  useEffect(() => {
    if (!won) {
      setPhase("listen");
      const timer = setTimeout(() => playRound(round), 400);
      return () => {
        clearTimeout(timer);
        stopSequence();
      };
    }
  }, [round, won, playRound]);

  useEffect(() => {
    if (won) return;
    if (phase === "listen") {
      if (feedbackSpeechRef.current) {
        const feedback = feedbackSpeechRef.current;
        feedbackSpeechRef.current = null;
        const currentEpoch = roundEpochRef.current;
        sayThen(
          feedback,
          () => {
            if (roundEpochRef.current === currentEpoch) {
              playRound(round);
            }
          },
          3000,
        );
      } else {
        say(t(lang, "music.listen"));
      }
    } else if (phase === "pick") {
      saySequence([
        t(lang, "shell.fastslow.sub"),
        t(lang, "music.fast"),
        t(lang, "music.slow"),
      ]);
    }
  }, [phase, won, lang, playRound, round]);

  const onPick = (picked: "fast" | "slow") => {
    if (won || phase !== "pick" || lockedRef.current) return;
    if (isCorrect(round, picked)) {
      lockedRef.current = true;
      sfx.good();
      setSparkKey((k) => k + 1);
      const next = nextScoreValue(score, firstTryRef.current);
      setScore(next);
      setWrongPick(null);
      setInstructionalTempo(null);
      const nextHistory = [...history, picked];
      setHistory(nextHistory);
      setPhase("celebrate");
      if (nextHistory.length < total) {
        transitionTimerRef.current = setTimeout(() => {
          lockedRef.current = false;
          firstTryRef.current = true;
          roundEpochRef.current++;
          setRound(makeFastSlowRound(rngRef.current, difficulty, nextHistory));
        }, 1000);
      } else {
        transitionTimerRef.current = setTimeout(() => {
          setWon(true);
        }, 1000);
      }
    } else {
      sfx.wrong();
      lockedRef.current = true;
      firstTryRef.current = false;
      setWrongPick(picked);
      const currentEpoch = roundEpochRef.current;
      const trueSpeed = getActualSpeed(round);
      wrongTimerRef.current = setTimeout(() => {
        if (roundEpochRef.current !== currentEpoch) return;
        setWrongPick(null);
        setInstructionalTempo(trueSpeed);
        feedbackSpeechRef.current = getInstructionalFeedback(round, lang);
        setPhase("listen");
      }, 500);
    }
  };

  useEffect(() => {
    return () => {
      roundEpochRef.current++;
      feedbackSpeechRef.current = null;
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
      if (replayTimerRef.current) clearTimeout(replayTimerRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      stopSequence();
      stopNarration();
    };
  }, []);

  const replay = () => {
    if (phase === "pick") {
      stopSequence();
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
      if (replayTimerRef.current) clearTimeout(replayTimerRef.current);
      setWrongPick(null);
      setInstructionalTempo(null);
      setPhase("listen");
      replayTimerRef.current = setTimeout(() => playRound(round), 400);
    }
  };

  const reset = () => {
    if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
    if (replayTimerRef.current) clearTimeout(replayTimerRef.current);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    stopSequence();
    stopNarration();
    roundEpochRef.current++;
    feedbackSpeechRef.current = null;
    lockedRef.current = false;
    firstTryRef.current = true;
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setWon(false);
    setWrongPick(null);
    setInstructionalTempo(null);
    setHistory([]);
    setRound(makeFastSlowRound(rngRef.current, difficulty, []));
  };

  const earPulse = useRef(new Animated.Value(1)).current;
  const pickGlow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase === "listen") {
      pickGlow.setValue(0);
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
      Animated.loop(
        Animated.sequence([
          Animated.timing(pickGlow, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pickGlow, {
            toValue: 0,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
    return () => {
      earPulse.stopAnimation();
      pickGlow.stopAnimation();
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickScale = pickGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  return (
    <GameShell
      title={t(lang, "shell.fastslow.title" as never)}
      subtitle={t(lang, "shell.fastslow.sub" as never)}
      onBack={onHome}
      lang={lang}
      right={
        <ScoreChip label={`🎵 ${score}/${total}`} testID="fastslow-score" />
      }
    >
      <View style={styles.board}>
        {phase === "listen" ? (
          <View style={[styles.listenCard, shadows.soft]}>
            <Animated.Text
              style={[styles.listenEmoji, { transform: [{ scale: earPulse }] }]}
            >
              👂
            </Animated.Text>
            {instructionalTempo ? (
              <Text
                testID="fastslow-instructional-tempo"
                style={[
                  styles.instructionalText,
                  {
                    color:
                      instructionalTempo === "fast" ? "#E8874F" : "#5DA9E8",
                  },
                ]}
              >
                {instructionalTempo === "fast" ? "🐰 " : "🐢 "}
                {t(
                  lang,
                  instructionalTempo === "fast" ? "music.fast" : "music.slow",
                )}
              </Text>
            ) : null}
            <Text style={styles.listenText}>
              {t(lang, "music.listen" as never)}
            </Text>
          </View>
        ) : (
          <View style={styles.pickRow}>
            <Animated.View style={{ transform: [{ scale: pickScale }] }}>
              <Pressable
                onPress={() => onPick("fast")}
                testID="fastslow-fast"
                accessibilityRole="button"
                accessibilityLabel={t(lang, "music.fast")}
                style={({ pressed }) => [
                  styles.pickBtn,
                  { backgroundColor: "#FFF0E5", borderColor: "#E8874F" },
                  shadows.glowGold,
                  wrongPick === "fast" && styles.wrong,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.pickEmoji}>🐰</Text>
                <Text style={[styles.pickLabel, { color: "#E8874F" }]}>
                  {t(lang, "music.fast" as never)}
                </Text>
                {phase === "celebrate" &&
                getActualSpeed(round) === "fast" &&
                sparkKey > 0 ? (
                  <SparkleBurst trigger={sparkKey} count={5} size={14} />
                ) : null}
              </Pressable>
            </Animated.View>
            <Pressable
              onPress={replay}
              testID="fastslow-replay"
              accessibilityRole="button"
              accessibilityLabel={t(lang, "music.replay")}
              style={({ pressed }) => [
                styles.replayBtn,
                shadows.soft,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.replayText}>🔊</Text>
            </Pressable>
            <Animated.View style={{ transform: [{ scale: pickScale }] }}>
              <Pressable
                onPress={() => onPick("slow")}
                testID="fastslow-slow"
                accessibilityRole="button"
                accessibilityLabel={t(lang, "music.slow")}
                style={({ pressed }) => [
                  styles.pickBtn,
                  { backgroundColor: "#E3EEFB", borderColor: "#5DA9E8" },
                  shadows.glowGold,
                  wrongPick === "slow" && styles.wrong,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.pickEmoji}>🐢</Text>
                <Text style={[styles.pickLabel, { color: "#5DA9E8" }]}>
                  {t(lang, "music.slow" as never)}
                </Text>
                {phase === "celebrate" &&
                getActualSpeed(round) === "slow" &&
                sparkKey > 0 ? (
                  <SparkleBurst trigger={sparkKey} count={5} size={14} />
                ) : null}
              </Pressable>
            </Animated.View>
          </View>
        )}
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, "win.fastslow" as never)}
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
    paddingHorizontal: 16,
  },
  listenCard: {
    backgroundColor: "#F7EDDA",
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.gold,
    paddingVertical: 32,
    paddingHorizontal: 40,
    alignItems: "center",
    gap: 12,
  },
  listenEmoji: { fontSize: 56 },
  listenText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  instructionalText: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.ink,
  },
  pickRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  pickBtn: {
    borderRadius: 28,
    borderWidth: 4,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: "center",
    gap: 8,
    minWidth: 130,
    ...shadows.soft,
  },
  pickEmoji: { fontSize: 56 },
  pickLabel: { fontFamily: fonts.display, fontSize: 22 },
  wrong: { borderColor: colors.red, backgroundColor: "rgba(232,86,79,0.12)" },
  pressed: { transform: [{ scale: 0.94 }] },
  replayBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  replayText: { fontSize: 36 },
});
