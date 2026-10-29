import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { say, saySequence, sayThen, sfx, stopNarration } from "../../sound";
import { playSequence, stopSequence, primeMusic } from "../../music";
import { useWinLine } from "../winlines";
import {
  makeFastSlowRound,
  roundsToWin,
  getActualSpeed,
  isCorrect,
  FastSlowRound,
  getInstructionalFeedback,
  nextScoreValue,
  fastSlowLayout,
} from "./logic";

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

const LISTEN_DELAY_MS = 1000;

export function FastSlowGame({ onHome, difficulty, lang }: Props) {
  const { epoch, isValid } = useLangEpoch(lang);
  useLayoutEffect(() => {
    primeMusic();
  }, []);
  const { width } = useWindowDimensions();
  const layout = fastSlowLayout(width);
  const total = roundsToWin(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const lockedRef = useRef(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundEpochRef = useRef(0);
  const feedbackSpeechRef = useRef<string[] | null>(null);
  const notePulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notePulse = useRef(new Animated.Value(1)).current;
  const [activeNote, setActiveNote] = useState<number | null>(null);
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

  const stopNotePulse = useCallback(() => {
    if (notePulseTimerRef.current) {
      clearTimeout(notePulseTimerRef.current);
      notePulseTimerRef.current = null;
    }
    setActiveNote(null);
    notePulse.stopAnimation();
    notePulse.setValue(1);
  }, [notePulse]);

  const playRound = useCallback(
    (r: FastSlowRound) => {
      stopSequence();
      stopNotePulse();
      setPhase("listen");
      const epoch = roundEpochRef.current;
      playSequence(
        r.notes,
        r.bpm,
        (index) => {
          if (roundEpochRef.current === epoch) {
            setActiveNote(index);
            notePulse.stopAnimation();
            notePulse.setValue(1.3);
            Animated.spring(notePulse, {
              toValue: 1,
              friction: 4,
              useNativeDriver: true,
            }).start();
            if (notePulseTimerRef.current) {
              clearTimeout(notePulseTimerRef.current);
            }
            const noteBeats = r.notes[index]?.b ?? 1;
            const noteMs = noteBeats * (60000 / r.bpm);
            const pulseMs = Math.min(180, Math.floor(noteMs / 2));
            notePulseTimerRef.current = setTimeout(() => {
              if (roundEpochRef.current === epoch) {
                setActiveNote(null);
                notePulseTimerRef.current = null;
              }
            }, pulseMs);
          }
        },
        () => {
          if (roundEpochRef.current === epoch) {
            stopNotePulse();
            setInstructionalTempo(null);
            lockedRef.current = false;
            setPhase("pick");
          }
        },
      );
    },
    [notePulse, stopNotePulse],
  );

  useEffect(() => {
    if (!won) {
      setPhase("listen");
      listenTimerRef.current = setTimeout(
        () => playRound(round),
        LISTEN_DELAY_MS,
      );
      return () => {
        if (listenTimerRef.current) {
          clearTimeout(listenTimerRef.current);
          listenTimerRef.current = null;
        }
        stopNotePulse();
        stopSequence();
      };
    }
  }, [round, won, playRound, stopNotePulse]);

  useEffect(() => {
    if (epoch === 0 || won) return;
    if (phase === "listen") {
      if (listenTimerRef.current) {
        clearTimeout(listenTimerRef.current);
        listenTimerRef.current = null;
      }
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
        replayTimerRef.current = null;
      }
      stopNotePulse();
      stopSequence();
      stopNarration();
      roundEpochRef.current++;
      listenTimerRef.current = setTimeout(
        () => playRound(round),
        LISTEN_DELAY_MS,
      );
    }
  }, [epoch]); // eslint-disable-line react-hooks/exhaustive-deps

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
    primeMusic();
    if (won || phase !== "pick" || lockedRef.current || !isValid()) return;
    stopNarration();
    if (isCorrect(round, picked)) {
      lockedRef.current = true;
      sfx.good();
      setSparkKey((k) => k + 1);
      const next = nextScoreValue(score);
      setScore(next);
      setWrongPick(null);
      setInstructionalTempo(null);
      const nextHistory = [...history, picked];
      setHistory(nextHistory);
      setPhase("celebrate");
      if (nextHistory.length < total) {
        transitionTimerRef.current = setTimeout(() => {
          lockedRef.current = false;
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
      if (notePulseTimerRef.current) clearTimeout(notePulseTimerRef.current);
      if (listenTimerRef.current) clearTimeout(listenTimerRef.current);
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
      if (replayTimerRef.current) clearTimeout(replayTimerRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      stopSequence();
      stopNarration();
    };
  }, []);

  const replay = () => {
    primeMusic();
    if (!isValid() || phase !== "pick") return;
    stopSequence();
    stopNotePulse();
    if (listenTimerRef.current) clearTimeout(listenTimerRef.current);
    if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
    if (replayTimerRef.current) clearTimeout(replayTimerRef.current);
    setWrongPick(null);
    setInstructionalTempo(null);
    setPhase("listen");
    replayTimerRef.current = setTimeout(
      () => playRound(round),
      LISTEN_DELAY_MS,
    );
  };

  const reset = () => {
    if (listenTimerRef.current) clearTimeout(listenTimerRef.current);
    if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
    if (replayTimerRef.current) clearTimeout(replayTimerRef.current);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    stopSequence();
    stopNarration();
    stopNotePulse();
    roundEpochRef.current++;
    feedbackSpeechRef.current = null;
    lockedRef.current = false;
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setWon(false);
    setWrongPick(null);
    setInstructionalTempo(null);
    setHistory([]);
    setRound(makeFastSlowRound(rngRef.current, difficulty, []));
  };

  const pickGlow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase === "listen") {
      pickGlow.stopAnimation();
      pickGlow.setValue(0);
    } else {
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
      pickGlow.stopAnimation();
    };
  }, [phase]);

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
          <View
            style={[
              styles.listenCard,
              shadows.soft,
              activeNote !== null && styles.listenCardActive,
            ]}
          >
            <Animated.Text
              testID="fastslow-note-pulse"
              aria-selected={activeNote !== null}
              style={[
                styles.listenEmoji,
                { transform: [{ scale: notePulse }] },
              ]}
            >
              🎶
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
          <View
            style={[styles.pickRow, { gap: layout.gap }]}
            testID="fastslow-pick-row"
          >
            <Animated.View style={{ transform: [{ scale: pickScale }] }}>
              <Pressable
                onPress={() => onPick("fast")}
                testID="fastslow-fast"
                accessibilityRole="button"
                accessibilityLabel={t(lang, "music.fast")}
                style={({ pressed }) => [
                  styles.pickBtn,
                  {
                    backgroundColor: "#FFF0E5",
                    borderColor: "#E8874F",
                    paddingHorizontal: layout.pickBtnPaddingHorizontal,
                    minWidth: layout.pickBtnMinWidth,
                  },
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
            <Animated.View style={{ transform: [{ scale: pickScale }] }}>
              <Pressable
                onPress={() => onPick("slow")}
                testID="fastslow-slow"
                accessibilityRole="button"
                accessibilityLabel={t(lang, "music.slow")}
                style={({ pressed }) => [
                  styles.pickBtn,
                  {
                    backgroundColor: "#E3EEFB",
                    borderColor: "#5DA9E8",
                    paddingHorizontal: layout.pickBtnPaddingHorizontal,
                    minWidth: layout.pickBtnMinWidth,
                  },
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
  listenCardActive: {
    borderColor: "#E8874F",
    ...shadows.glowGold,
  },
  listenEmoji: { fontSize: 56 },
  listenText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  instructionalText: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.ink,
  },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  pickBtn: {
    borderRadius: 28,
    borderWidth: 4,
    paddingVertical: 28,
    alignItems: "center",
    gap: 8,
    ...shadows.soft,
  },
  pickEmoji: { fontSize: 56 },
  pickLabel: { fontFamily: fonts.display, fontSize: 22 },
  wrong: { borderColor: colors.red, backgroundColor: "rgba(232,86,79,0.12)" },
  pressed: { transform: [{ scale: 0.94 }] },
  replayBtn: {
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  replayText: {},
});
