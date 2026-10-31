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
import { Lang, useLangEpoch } from "../../lang";
import { t } from "../../i18n";
import { makeRng } from "../../rng";
import { colors, fonts, shadows } from "../../theme";
import { saySequence, sayThen, sfx, stopNarration } from "../../sound";
import { playSequence, stopSequence } from "../../music";
import { useWinLine } from "../winlines";
import {
  makeHighLowRound,
  roundsToWin,
  HighLowRound,
  correctAnswer,
  isCorrect,
  getInstructionalFeedback,
  nextScoreValue,
  highLowLayout,
  melodyDotOffsetY,
} from "./logic";

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

export function HighLowGame({ onHome, difficulty, lang }: Props) {
  const { epoch, isValid } = useLangEpoch(lang);
  const { width } = useWindowDimensions();
  const layout = highLowLayout(width);
  const total = roundsToWin(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const lockedRef = useRef(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongPickRef = useRef<"high" | "low" | null>(null);
  const listenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundEpochRef = useRef(0);
  const feedbackSpeechRef = useRef<string[] | null>(null);
  const [round, setRound] = useState<HighLowRound>(() =>
    makeHighLowRound(rngRef.current, difficulty),
  );
  const [score, setScore] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState<"listen" | "pick" | "celebrate">("listen");
  const [listenNote, setListenNote] = useState<number | null>(null);
  const [wrongPick, setWrongPick] = useState<"high" | "low" | null>(null);
  const clearWrongTimer = () => {
    if (wrongTimerRef.current) {
      clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = null;
    }
    wrongPickRef.current = null;
    setWrongPick(null);
  };
  const [instructionalDirection, setInstructionalDirection] = useState<
    "high" | "low" | null
  >(null);
  const [sparkKey, setSparkKey] = useState(0);
  const [won, setWon] = useState(false);
  const winTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useWinLine(won, t(lang, "win.highlow" as never));

  useEffect(() => {
    return () => {
      roundEpochRef.current++;
      feedbackSpeechRef.current = null;
      if (listenTimerRef.current) {
        clearTimeout(listenTimerRef.current);
        listenTimerRef.current = null;
      }
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
      if (wrongTimerRef.current) {
        clearTimeout(wrongTimerRef.current);
        wrongTimerRef.current = null;
      }
      if (winTimerRef.current) {
        clearTimeout(winTimerRef.current);
        winTimerRef.current = null;
      }
      stopSequence();
      stopNarration();
    };
  }, []);

  const playRound = useCallback((r: HighLowRound) => {
    stopSequence();
    setListenNote(null);
    const epoch = roundEpochRef.current;
    const notes = [
      { m: r.noteA, b: 2 },
      { m: r.noteB, b: 2 },
    ];
    playSequence(
      notes,
      80,
      (index) => {
        if (roundEpochRef.current === epoch) {
          setListenNote(index);
        }
      },
      () => {
        if (roundEpochRef.current === epoch) {
          setInstructionalDirection(null);
          lockedRef.current = false;
          setPhase("pick");
        }
      },
    );
  }, []);

  useEffect(() => {
    if (!won) {
      setPhase("listen");
      setListenNote(null);
      listenTimerRef.current = setTimeout(() => {
        listenTimerRef.current = null;
        playRound(round);
      }, 400);
      return () => {
        if (listenTimerRef.current) {
          clearTimeout(listenTimerRef.current);
          listenTimerRef.current = null;
        }
        stopSequence();
      };
    }
  }, [round, won, playRound]);

  useEffect(() => {
    if (won) return;
    if (phase === "listen" && feedbackSpeechRef.current) {
      const feedback = feedbackSpeechRef.current;
      feedbackSpeechRef.current = null;
      const currentEpoch = roundEpochRef.current;
      sayThen(
        feedback,
        () => {
          if (roundEpochRef.current === currentEpoch && isValid()) {
            playRound(round);
          }
        },
        3000,
      );
    }
  }, [phase, won, playRound, round, isValid]);

  useEffect(() => {
    if (epoch === 0 || won) return;
    if (listenTimerRef.current) {
      clearTimeout(listenTimerRef.current);
      listenTimerRef.current = null;
    }
    stopSequence();
    stopNarration();
    const currentEpoch = ++roundEpochRef.current;
    if (
      wrongPick !== null ||
      wrongTimerRef.current !== null ||
      (phase === "listen" && instructionalDirection !== null)
    ) {
      clearWrongTimer();
      setInstructionalDirection(correctAnswer(round));
      setPhase("listen");
      setListenNote(null);
      const feedback = getInstructionalFeedback(round, lang);
      sayThen(
        feedback,
        () => {
          if (roundEpochRef.current === currentEpoch && isValid()) {
            playRound(round);
          }
        },
        3000,
      );
    } else if (phase === "listen") {
      listenTimerRef.current = setTimeout(() => {
        listenTimerRef.current = null;
        playRound(round);
      }, 400);
    } else if (phase === "pick") {
      say(t(lang, "shell.highlow.sub"));
    }
  }, [epoch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (won || phase !== "pick" || wrongPick !== null) return;
    saySequence([
      t(lang, "shell.highlow.sub"),
      t(lang, "music.high"),
      t(lang, "music.low"),
    ]);
  }, [phase, won, lang, wrongPick]);

  const onPick = (picked: "high" | "low") => {
    if (won || phase !== "pick" || lockedRef.current || !isValid() || wrongPickRef.current === picked) return;
    stopNarration();
    if (isCorrect(round, picked)) {
      lockedRef.current = true;
      clearWrongTimer();
      sfx.good();
      setSparkKey((k) => k + 1);
      const nextScore = nextScoreValue(score);
      setScore(nextScore);
      setInstructionalDirection(null);
      const nextRoundIndex = roundIndex + 1;
      setRoundIndex(nextRoundIndex);
      setPhase("celebrate");
      if (nextRoundIndex < total) {
        if (advanceTimerRef.current) {
          clearTimeout(advanceTimerRef.current);
          advanceTimerRef.current = null;
        }
        advanceTimerRef.current = setTimeout(() => {
          advanceTimerRef.current = null;
          lockedRef.current = false;
          roundEpochRef.current++;
          setRound(makeHighLowRound(rngRef.current, difficulty));
        }, 1000);
      } else {
        if (winTimerRef.current) {
          clearTimeout(winTimerRef.current);
          winTimerRef.current = null;
        }
        winTimerRef.current = setTimeout(() => {
          winTimerRef.current = null;
          lockedRef.current = false;
          setWon(true);
        }, 1000);
      }
    } else {
      sfx.wrong();
      wrongPickRef.current = picked;
      setWrongPick(picked);
      const currentEpoch = roundEpochRef.current;
      const trueDir = correctAnswer(round);
      if (wrongTimerRef.current) {
        clearTimeout(wrongTimerRef.current);
        wrongTimerRef.current = null;
      }
      wrongTimerRef.current = setTimeout(() => {
        wrongTimerRef.current = null;
        if (roundEpochRef.current !== currentEpoch || !isValid()) return;
        lockedRef.current = true;
        wrongPickRef.current = null;
        setWrongPick(null);
        setInstructionalDirection(trueDir);
        feedbackSpeechRef.current = getInstructionalFeedback(round, lang);
        setPhase("listen");
        setListenNote(null);
      }, 500);
    }
  };

  const reset = () => {
    roundEpochRef.current++;
    feedbackSpeechRef.current = null;
    if (listenTimerRef.current) {
      clearTimeout(listenTimerRef.current);
      listenTimerRef.current = null;
    }
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    clearWrongTimer();
    if (winTimerRef.current) {
      clearTimeout(winTimerRef.current);
      winTimerRef.current = null;
    }
    stopSequence();
    stopNarration();
    lockedRef.current = false;
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setRoundIndex(0);
    setWon(false);
    setInstructionalDirection(null);
    setListenNote(null);
    setRound(makeHighLowRound(rngRef.current, difficulty));
  };

  const replay = () => {
    if (phase === "pick" && !lockedRef.current) {
      stopSequence();
      stopNarration();
      if (listenTimerRef.current) {
        clearTimeout(listenTimerRef.current);
        listenTimerRef.current = null;
      }
      clearWrongTimer();
      setInstructionalDirection(null);
      setPhase("listen");
      setListenNote(null);
      playRound(round);
    }
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

  const renderMelodyDots = (allFilled: boolean) => (
    <View style={styles.melodyDotRow}>
      <View
        testID="melody-dot-0"
        style={[
          styles.melodyDot,
          (allFilled || (listenNote !== null && listenNote >= 0)) &&
            styles.melodyDotFilled,
          { transform: [{ translateY: melodyDotOffsetY(round, 0) }] },
        ]}
      />
      <View
        testID="melody-dot-1"
        style={[
          styles.melodyDot,
          (allFilled || (listenNote !== null && listenNote >= 1)) &&
            styles.melodyDotFilled,
          { transform: [{ translateY: melodyDotOffsetY(round, 1) }] },
        ]}
      />
    </View>
  );

  return (
    <GameShell
      title={t(lang, "shell.highlow.title" as never)}
      subtitle={t(lang, "shell.highlow.sub" as never)}
      onBack={onHome}
      lang={lang}
      right={
        <ScoreChip label={`🎵 ${score}/${total}`} testID="highlow-score" />
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
            {instructionalDirection ? (
              <Text
                testID="highlow-instructional-direction"
                style={[
                  styles.instructionalText,
                  {
                    color:
                      instructionalDirection === "high" ? "#5DA9E8" : "#E8874F",
                  },
                ]}
              >
                {instructionalDirection === "high" ? "↗️ " : "↘️ "}
                {t(
                  lang,
                  instructionalDirection === "high"
                    ? "music.high"
                    : "music.low",
                )}
              </Text>
            ) : null}
            {renderMelodyDots(false)}
          </View>
        ) : (
          <View
            style={{ alignItems: "center", gap: layout.gap, width: "100%" }}
          >
            {renderMelodyDots(true)}
            <Pressable
              onPress={replay}
              testID="highlow-replay"
              accessibilityRole="button"
              accessibilityLabel={t(lang, "music.replay")}
              style={({ pressed }) => [
                styles.replayBtn,
                {
                  width: layout.replaySize,
                  height: layout.replaySize,
                  borderRadius: layout.replaySize / 2,
                },
                shadows.soft,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.replayText, { fontSize: layout.replayFontSize }]}
              >
                🔊
              </Text>
            </Pressable>
            <View
              testID="highlow-pick-row"
              style={[styles.pickRow, { gap: layout.gap, width: "100%" }]}
            >
              <Animated.View
                style={{ flex: 1, transform: [{ scale: pickScale }] }}
              >
                <Pressable
                  onPress={() => onPick("high")}
                  testID="highlow-high"
                  accessibilityRole="button"
                  accessibilityLabel={t(lang, "music.high")}
                  style={({ pressed }) => [
                    styles.pickBtn,
                    { width: "100%" },
                    {
                      backgroundColor: "#E3EEFB",
                      borderColor: "#5DA9E8",
                      paddingHorizontal: layout.pickBtnPaddingHorizontal,
                      minWidth: layout.pickBtnMinWidth,
                    },
                    shadows.glowGold,
                    wrongPick === "high" && styles.wrong,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.pickEmoji}>↗️</Text>
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={[
                      styles.pickLabel,
                      { color: "#5DA9E8", fontSize: layout.pickLabelFontSize },
                    ]}
                  >
                    {t(lang, "music.high" as never)}
                  </Text>
                  {phase === "celebrate" &&
                  correctAnswer(round) === "high" &&
                  sparkKey > 0 ? (
                    <SparkleBurst trigger={sparkKey} count={5} size={14} />
                  ) : null}
                </Pressable>
              </Animated.View>
              <Animated.View
                style={{ flex: 1, transform: [{ scale: pickScale }] }}
              >
                <Pressable
                  onPress={() => onPick("low")}
                  testID="highlow-low"
                  accessibilityRole="button"
                  accessibilityLabel={t(lang, "music.low")}
                  style={({ pressed }) => [
                    styles.pickBtn,
                    { width: "100%" },
                    {
                      backgroundColor: "#FFF0E5",
                      borderColor: "#E8874F",
                      paddingHorizontal: layout.pickBtnPaddingHorizontal,
                      minWidth: layout.pickBtnMinWidth,
                    },
                    shadows.glowGold,
                    wrongPick === "low" && styles.wrong,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.pickEmoji}>↘️</Text>
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={[
                      styles.pickLabel,
                      { color: "#E8874F", fontSize: layout.pickLabelFontSize },
                    ]}
                  >
                    {t(lang, "music.low" as never)}
                  </Text>
                  {phase === "celebrate" &&
                  correctAnswer(round) === "low" &&
                  sparkKey > 0 ? (
                    <SparkleBurst trigger={sparkKey} count={5} size={14} />
                  ) : null}
                </Pressable>
              </Animated.View>
            </View>
          </View>
        )}
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, "win.highlow" as never)}
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
  instructionalText: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.ink,
  },
  melodyDotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    height: 60,
  },
  melodyDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: "transparent",
  },
  melodyDotFilled: { backgroundColor: colors.gold },
  pickRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  pickBtn: {
    borderRadius: 28,
    borderWidth: 4,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 8,
    minWidth: 130,
    ...shadows.soft,
  },
  pickEmoji: { fontSize: 56 },
  pickLabel: { fontFamily: fonts.display, fontSize: 22, textAlign: "center" },
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
