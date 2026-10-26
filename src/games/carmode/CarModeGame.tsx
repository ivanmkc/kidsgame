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
import { t } from "../../i18n";
import { saySequence, sayThen, sfx, stopNarration } from "../../sound";
import { playNote, primeMusic } from "../../music";
import { fonts, shadows } from "../../theme";
import { ALL_PACKS, PACK_ORDER, PackId, Round } from "./packs";
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

  const stateRef = useRef(state);
  stateRef.current = state;

  const phaseEnterTime = useRef(0);
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boopsTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startRoundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealCapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (startRoundTimerRef.current) {
      clearTimeout(startRoundTimerRef.current);
      startRoundTimerRef.current = null;
    }
    if (replayTimerRef.current) {
      clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    if (revealCapTimerRef.current) {
      clearTimeout(revealCapTimerRef.current);
      revealCapTimerRef.current = null;
    }
    boopsTimersRef.current.forEach(clearTimeout);
    boopsTimersRef.current = [];
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
        stopNarration();
        if (next.phase === "done") {
          setCelebrate((c) => c + 1);
        }
      }

      if (current.phase === "gap" && next.phase === "reveal") {
        if (gapTimerRef.current) {
          clearTimeout(gapTimerRef.current);
          gapTimerRef.current = null;
        }
        if (replayTimerRef.current) {
          clearTimeout(replayTimerRef.current);
          replayTimerRef.current = null;
        }
        boopsTimersRef.current.forEach(clearTimeout);
        boopsTimersRef.current = [];
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
      stopNarration();
    },
    [clearTimers],
  );

  const playBoops = useCallback((n: number) => {
    const PENTATONIC = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];
    for (let i = 0; i < n; i++) {
      const t = setTimeout(
        () => playNote(PENTATONIC[i % PENTATONIC.length]),
        i * 400,
      );
      boopsTimersRef.current.push(t);
    }
  }, []);

  const startRound = useCallback(
    (r: Round) => {
      if (r.pack === "boops" && r.noteCount) {
        playBoops(r.noteCount);
        const boopsDuration = (r.noteCount - 1) * 400 + 800;
        startRoundTimerRef.current = setTimeout(() => {
          if (!isValid()) return;
          if (
            stateRef.current.phase !== "prompt" ||
            currentRound(stateRef.current) !== r
          )
            return;
          sayThen(r.prompt, () => {
            if (!isValid()) return;
            if (
              stateRef.current.phase === "prompt" &&
              currentRound(stateRef.current) === r
            ) {
              applyStateTransition(toGap(stateRef.current));
            }
          });
        }, boopsDuration);
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
    if (state.phase === "prompt" && round) {
      startRound(round);
    }
  }, [state.roundIdx, gameKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (round.sfx === "boing") sfx.boing();
      else if (round.sfx === "good") sfx.good();

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

  const replayPrompt = useCallback(
    (r: Round) => {
      stopNarration();
      if (gapTimerRef.current) {
        clearTimeout(gapTimerRef.current);
        gapTimerRef.current = null;
      }
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
        replayTimerRef.current = null;
      }
      boopsTimersRef.current.forEach(clearTimeout);
      boopsTimersRef.current = [];

      const speakPrompt = () => {
        sayThen(r.prompt, () => {
          if (!isValid()) return;
          if (
            stateRef.current.phase === "gap" &&
            currentRound(stateRef.current) === r
          ) {
            gapTimerRef.current = setTimeout(() => {
              if (!isValid()) return;
              applyStateTransition(toReveal(stateRef.current));
            }, r.gapMs);
          }
        });
      };

      if (r.pack === "boops" && r.noteCount) {
        playBoops(r.noteCount);
        const boopsDuration = (r.noteCount - 1) * 400 + 800;
        replayTimerRef.current = setTimeout(() => {
          replayTimerRef.current = null;
          if (!isValid()) return;
          if (
            stateRef.current.phase !== "gap" ||
            currentRound(stateRef.current) !== r
          ) {
            return;
          }
          speakPrompt();
        }, boopsDuration);
      } else {
        speakPrompt();
      }
    },
    [applyStateTransition, isValid, playBoops],
  );

  const onTap = useCallback(() => {
    if (Date.now() - phaseEnterTime.current < PHASE_DEBOUNCE_MS) {
      return;
    }

    sfx.tap();
    primeMusic();

    const current = stateRef.current;
    if (isComplete(current)) return;

    if (current.phase === "prompt") {
      stopNarration();
      applyStateTransition(toGap(current));
      return;
    }

    if (current.phase === "gap") {
      const r = currentRound(current);
      if (r?.twoTapAnswer) {
        const next = handleTap(current);
        applyStateTransition(next);
        return;
      }
      if (r) {
        replayPrompt(r);
        return;
      }
    }

    const next = handleTap(current);
    applyStateTransition(next);
  }, [applyStateTransition, replayPrompt]);

  const switchPack = useCallback(
    (id: PackId) => {
      clearTimers();
      stopNarration();
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

  const pulseAnim = useRef(new Animated.Value(1)).current;
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
            accessibilityLabel="Tap to continue"
            testID="carmode-tap"
          >
            <Animated.View
              style={[
                styles.bigButton,
                {
                  width: buttonSize,
                  height: buttonSize,
                  borderRadius: buttonSize / 2,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <Text style={styles.phaseEmoji}>
                {state.phase === "prompt"
                  ? "👂"
                  : state.phase === "gap"
                    ? "🤔"
                    : "👆"}
              </Text>
              <Text style={styles.phaseText}>
                {state.phase === "prompt"
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
                  accessibilityLabel={ALL_PACKS[id].name}
                  testID={`carmode-pack-${id}`}
                >
                  <Text style={styles.packBtnText}>{ALL_PACKS[id].name}</Text>
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
