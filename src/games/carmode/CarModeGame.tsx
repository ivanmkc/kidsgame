import React, { useEffect, useRef, useState, useCallback } from "react";
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
import { Confetti } from "../../components/Confetti";
import { Lang, useLangEpoch } from "../../lang";
import { t, UIKey } from "../../i18n";
import { saySequence, sayThen, sfx, stopNarration } from "../../sound";
import { playSequence, primeMusic, SeqNote, stopSequence } from "../../music";
import { fonts, shadows } from "../../theme";
import { PACK_ORDER, PackId, Round } from "./packs";
import {
  CarModeState,
  advance,
  currentRound,
  isComplete,
  startState,
  toGap,
  toReveal,
  handleTap,
  handleTapTimeout,
} from "./logic";

import { Difficulty, DifficultyFilter } from "../../difficulty";

interface Props {
  onHome: () => void;
  lang: Lang;
  difficulty?: Difficulty | DifficultyFilter;
}

const PACK_COLORS: Record<PackId, string> = {
  boops: "#E8A24F",
  rhyme: "#9C6FD6",
  simon: "#2FB8AC",
  silly: "#E8564F",
  whoami: "#5DA9E8",
  animal: "#5FBF6E",
};

const TAP_WINDOW_MS = 600;
const PHASE_DEBOUNCE_MS = 400;
const REVEAL_AUTO_ADVANCE_MS = 3500;
const REVEAL_SPEECH_CAP_MS = 4000;

export function CarModeGame({ onHome, lang, difficulty }: Props) {
  const activeDifficulty =
    difficulty && difficulty !== "all" ? difficulty : undefined;
  const { isValid } = useLangEpoch(lang);
  const [packId, setPackId] = useState<PackId>("boops");
  const [state, setState] = useState<CarModeState>(() =>
    activeDifficulty
      ? startState("boops", Math.floor(Math.random() * 1e9), activeDifficulty)
      : startState("boops", Math.floor(Math.random() * 1e9)),
  );
  const [celebrate, setCelebrate] = useState(0);
  const [gameKey, setGameKey] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  const [boopFlash, setBoopFlash] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  const phaseEnterTime = useRef(0);
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealCapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const round = currentRound(state);

  const clearTimers = useCallback(() => {
    if (gapTimerRef.current) {
      clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    }
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    if (revealCapTimerRef.current) {
      clearTimeout(revealCapTimerRef.current);
      revealCapTimerRef.current = null;
    }
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    setBoopFlash(false);
    stopNarration();
    stopSequence();
  }, []);

  const applyStateTransition = useCallback(
    (next: CarModeState) => {
      const current = stateRef.current;

      if (current.phase !== next.phase) {
        phaseEnterTime.current = Date.now();
      }

      if (
        current.phase === "reveal" &&
        (next.phase === "prompt" || next.phase === "done")
      ) {
        clearTimers();
        if (next.phase === "done") {
          setCelebrate((c) => c + 1);
        }
      }

      if (current.phase === "prompt" && next.phase === "gap") {
        clearTimers();
      }

      if (current.phase === "gap" && next.phase === "reveal") {
        if (gapTimerRef.current) {
          clearTimeout(gapTimerRef.current);
          gapTimerRef.current = null;
        }
        if (flashTimerRef.current) {
          clearTimeout(flashTimerRef.current);
          flashTimerRef.current = null;
        }
        setBoopFlash(false);
        stopSequence();
      }

      if (current.pendingTaps === 0 && next.pendingTaps === 1) {
        if (tapTimerRef.current) {
          clearTimeout(tapTimerRef.current);
          tapTimerRef.current = null;
        }
        tapTimerRef.current = setTimeout(() => {
          tapTimerRef.current = null;
          if (!isValid()) return;
          const timeoutNext = handleTapTimeout(stateRef.current);
          applyStateTransition(timeoutNext);
        }, TAP_WINDOW_MS);
      } else if (current.pendingTaps > 0 && next.pendingTaps === 0) {
        if (tapTimerRef.current) {
          clearTimeout(tapTimerRef.current);
          tapTimerRef.current = null;
        }
      }

      stateRef.current = next;
      setState(next);
    },
    [clearTimers, isValid],
  );

  useEffect(
    () => () => {
      clearTimers();
    },
    [clearTimers],
  );

  const triggerVisualBoop = useCallback(() => {
    setBoopFlash(true);
    pulseAnim.setValue(1.15);
    Animated.spring(pulseAnim, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
    }
    flashTimerRef.current = setTimeout(() => {
      setBoopFlash(false);
    }, 200);
  }, [pulseAnim]);

  const playBoops = useCallback(
    (n: number, onDone?: () => void) => {
      stopSequence();
      const PENTATONIC = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];
      const notes: SeqNote[] = Array.from({ length: n }, (_, i) => ({
        m: PENTATONIC[i % PENTATONIC.length],
        b: 1,
      }));
      playSequence(
        notes,
        150,
        () => {
          if (!isValid()) return;
          triggerVisualBoop();
        },
        () => {
          if (!isValid()) return;
          setBoopFlash(false);
          onDone?.();
        },
      );
    },
    [isValid, triggerVisualBoop],
  );

  const startRound = useCallback(
    (r: Round) => {
      if (r.pack === "boops" && r.noteCount) {
        sayThen(r.prompt, () => {
          if (!isValid()) return;
          if (
            stateRef.current.phase !== "prompt" ||
            currentRound(stateRef.current) !== r
          ) {
            return;
          }
          playBoops(r.noteCount!, () => {
            if (!isValid()) return;
            if (
              stateRef.current.phase === "prompt" &&
              currentRound(stateRef.current) === r
            ) {
              applyStateTransition(toGap(stateRef.current));
            }
          });
        });
      } else {
        sayThen(r.prompt, () => {
          if (!isValid()) return;
          if (
            stateRef.current.phase === "prompt" &&
            currentRound(stateRef.current) === r
          ) {
            applyStateTransition(toGap(stateRef.current));
          }
        });
      }
    },
    [playBoops, applyStateTransition, isValid],
  );

  useEffect(() => {
    if (state.phase === "prompt" && round && hasStarted) {
      startRound(round);
    }
  }, [state.roundIdx, gameKey, hasStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.phase === "gap" && round) {
      gapTimerRef.current = setTimeout(() => {
        if (!isValid()) return;
        if (tapTimerRef.current) {
          clearTimeout(tapTimerRef.current);
          tapTimerRef.current = null;
        }
        applyStateTransition(toReveal(stateRef.current));
      }, round.gapMs);
    }
    return () => {
      if (gapTimerRef.current) {
        clearTimeout(gapTimerRef.current);
        gapTimerRef.current = null;
      }
    };
  }, [state.phase, state.roundIdx, gameKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.phase === "reveal" && round) {
      if (round.answer !== undefined && state.playerAnswer !== undefined) {
        if (state.playerAnswer === round.answer) sfx.good();
        else sfx.boing();
      } else if (round.sfx === "boing") {
        sfx.boing();
      } else if (round.sfx === "good") {
        sfx.good();
      }

      let scheduled = false;
      const scheduleAdvance = () => {
        if (scheduled) return;
        scheduled = true;
        if (revealCapTimerRef.current) {
          clearTimeout(revealCapTimerRef.current);
          revealCapTimerRef.current = null;
        }
        revealTimerRef.current = setTimeout(() => {
          revealTimerRef.current = null;
          if (!isValid()) return;
          if (
            stateRef.current.phase === "reveal" &&
            currentRound(stateRef.current) === round
          ) {
            applyStateTransition(advance(stateRef.current));
          }
        }, REVEAL_AUTO_ADVANCE_MS);
      };

      saySequence(round.reveal, scheduleAdvance);
      revealCapTimerRef.current = setTimeout(
        scheduleAdvance,
        REVEAL_SPEECH_CAP_MS,
      );
    }
    return () => {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      if (revealCapTimerRef.current) {
        clearTimeout(revealCapTimerRef.current);
        revealCapTimerRef.current = null;
      }
    };
  }, [state.phase, state.roundIdx, gameKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTap = useCallback(() => {
    if (Date.now() - phaseEnterTime.current < PHASE_DEBOUNCE_MS) {
      return;
    }

    sfx.tap();
    primeMusic();

    if (!hasStarted) {
      setHasStarted(true);
      phaseEnterTime.current = Date.now();
      return;
    }

    const current = stateRef.current;
    if (isComplete(current)) return;

    if (current.phase === "prompt") {
      if (currentRound(current)?.pack === "boops") {
        return;
      }
      stopNarration();
      applyStateTransition(toGap(current));
      return;
    }

    const next = handleTap(current);
    applyStateTransition(next);
  }, [applyStateTransition, hasStarted]);

  const switchPack = useCallback(
    (id: PackId) => {
      clearTimers();
      setPackId(id);
      setCelebrate(0);
      const next = activeDifficulty
        ? startState(id, Math.floor(Math.random() * 1e9), activeDifficulty)
        : startState(id, Math.floor(Math.random() * 1e9));
      stateRef.current = next;
      setState(next);
      setGameKey((k) => k + 1);
    },
    [clearTimers, activeDifficulty],
  );

  const langMountedRef = useRef(false);
  useEffect(() => {
    if (!langMountedRef.current) {
      langMountedRef.current = true;
      return;
    }
    clearTimers();
    if (stateRef.current.phase !== "done") {
      const next: CarModeState = {
        ...stateRef.current,
        phase: "prompt",
        pendingTaps: 0,
      };
      stateRef.current = next;
      setState(next);
      setGameKey((k) => k + 1);
    }
  }, [lang, clearTimers]);

  const done = isComplete(state);
  const bgColor = PACK_COLORS[packId];
  const { width, height } = useWindowDimensions();
  const buttonSize = Math.min(width, height) * 0.5;

  useEffect(() => {
    if (state.phase === "gap" || state.phase === "reveal") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.06,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
  }, [state.phase, pulseAnim]);

  const roundNum = state.roundIdx + 1;
  const totalRounds = state.rounds.length;

  const isReveal = state.phase === "reveal";
  const hasAnswer = round && round.answer !== undefined;
  const isRight = isReveal && hasAnswer && state.playerAnswer === round?.answer;
  const isWrong =
    isReveal &&
    hasAnswer &&
    state.playerAnswer !== undefined &&
    state.playerAnswer !== round?.answer;

  return (
    <GameShell
      title={t(lang, "shell.carmode.title")}
      subtitle={t(lang, "shell.carmode.sub")}
      onBack={onHome}
      lang={lang}
      right={
        <ScoreChip
          label={`${roundNum}/${totalRounds}`}
          testID="carmode-score"
        />
      }
    >
      <View
        style={[styles.surface, { backgroundColor: bgColor }]}
        testID="carmode-surface"
      >
        {!done && (
          <Pressable
            onPress={onTap}
            style={styles.tapArea}
            accessibilityRole="button"
            testID="carmode-tap"
          >
            <Animated.View
              testID={boopFlash ? "carmode-boop-flash" : undefined}
              style={[
                styles.bigButton,
                {
                  width: buttonSize,
                  height: buttonSize,
                  borderRadius: buttonSize / 2,
                  transform: [{ scale: pulseAnim }],
                },
                boopFlash && styles.bigButtonFlash,
                isRight && styles.bigButtonRight,
                isWrong && styles.bigButtonWrong,
              ]}
            >
              <Text
                style={styles.phaseEmoji}
                testID={
                  isRight
                    ? "carmode-emoji-right"
                    : isWrong
                      ? "carmode-emoji-wrong"
                      : undefined
                }
              >
                {!hasStarted
                  ? "▶️"
                  : boopFlash
                    ? "🎵"
                    : state.phase === "prompt"
                      ? "👂"
                      : state.phase === "gap"
                        ? "🤔"
                        : isRight
                          ? "⭐️"
                          : isWrong
                            ? "🔄"
                            : "👆"}
              </Text>
              <Text style={styles.phaseText}>
                {!hasStarted
                  ? t(lang, "carmode.tap")
                  : state.phase === "prompt"
                    ? t(lang, "music.listen")
                    : state.phase === "gap"
                      ? t(lang, "music.yourTurn")
                      : t(lang, "carmode.tap")}
              </Text>
            </Animated.View>
          </Pressable>
        )}

        {done && (
          <View style={styles.doneWrap}>
            <Text style={styles.doneText}>{t(lang, "carmode.done")}</Text>
            <View style={styles.packRow}>
              {PACK_ORDER.map((id) => (
                <Pressable
                  key={id}
                  onPress={() => switchPack(id)}
                  style={({ pressed }) => [
                    styles.packBtn,
                    { backgroundColor: PACK_COLORS[id] },
                    id === packId && styles.packBtnActive,
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: id === packId }}
                  accessibilityLabel={t(lang, `carmode.pack.${id}` as UIKey)}
                  testID={`carmode-pack-${id}`}
                >
                  <Text style={styles.packBtnText}>
                    {t(lang, `carmode.pack.${id}` as UIKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>
      {celebrate ? <Confetti count={24} /> : null}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tapArea: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  bigButton: {
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.lifted,
  },
  bigButtonFlash: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderColor: "#fff",
    borderWidth: 4,
    ...shadows.lifted,
  },
  bigButtonRight: {
    backgroundColor: "rgba(100,255,100,0.6)",
    borderColor: "#fff",
    borderWidth: 4,
  },
  bigButtonWrong: {
    backgroundColor: "rgba(255,100,100,0.6)",
    borderColor: "#fff",
    borderWidth: 4,
  },
  phaseEmoji: {
    fontSize: 64,
  },
  phaseText: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: "#fff",
    marginTop: 8,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  doneWrap: {
    alignItems: "center",
    gap: 24,
    paddingHorizontal: 24,
  },
  doneText: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  packRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    maxWidth: 500,
  },
  packBtn: {
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 22,
    minWidth: 130,
    alignItems: "center",
    ...shadows.soft,
  },
  packBtnActive: {
    borderWidth: 3,
    borderColor: "#fff",
  },
  packBtnText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: "#fff",
  },
});
