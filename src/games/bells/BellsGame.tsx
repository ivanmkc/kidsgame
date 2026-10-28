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
import { sfx } from "../../sound";
import { playNote, stopSequence } from "../../music";
import { useWinLine } from "../winlines";
import {
  makeBellsRound,
  roundsToWin,
  BellsRound,
  canTap,
  judgeTap,
  bellsLayout,
  bellLabel,
} from "./logic";

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

export function BellsGame({ onHome, difficulty, lang }: Props) {
  const total = roundsToWin(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const demoTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const glowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [round, setRound] = useState<BellsRound>(() =>
    makeBellsRound(rngRef.current, difficulty),
  );
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<"listen" | "play">("listen");
  const [glowIdx, setGlowIdx] = useState<number | null>(null);
  const [tapped, setTapped] = useState<number[]>([]);
  const tappedRef = useRef<number[]>([]);
  const [wrongFlash, setWrongFlash] = useState(false);
  const flashingRef = useRef(false);
  const [sparkKey, setSparkKey] = useState(0);
  const won = score >= total;
  useWinLine(won, t(lang, "win.bells"));

  const clearDemo = useCallback(() => {
    demoTimers.current.forEach(clearTimeout);
    demoTimers.current = [];
  }, []);

  const playDemo = useCallback(
    (r: BellsRound) => {
      clearDemo();
      if (glowTimer.current) clearTimeout(glowTimer.current);
      setGlowIdx(null);
      stopSequence();
      setPhase("listen");
      let i = 0;
      const step = () => {
        if (i >= r.sequence.length) {
          setGlowIdx(null);
          setPhase("play");
          return;
        }
        const bellIdx = r.sequence[i];
        setGlowIdx(bellIdx);
        playNote(r.bells[bellIdx].midi, 0.8);
        i++;
        demoTimers.current.push(
          setTimeout(() => {
            setGlowIdx(null);
            demoTimers.current.push(setTimeout(step, 200));
          }, 500),
        );
      };
      demoTimers.current.push(setTimeout(step, 500));
    },
    [clearDemo],
  );

  useEffect(() => {
    if (!won) {
      flashingRef.current = false;
      tappedRef.current = [];
      setTapped([]);
      playDemo(round);
    }
    return () => {
      clearDemo();
      if (glowTimer.current) clearTimeout(glowTimer.current);
      stopSequence();
    };
  }, [round, won]); // eslint-disable-line react-hooks/exhaustive-deps

  const onBellTap = (idx: number) => {
    if (!canTap(round, tappedRef.current, phase, won, flashingRef.current))
      return;
    playNote(round.bells[idx].midi, 0.8);
    if (glowTimer.current) clearTimeout(glowTimer.current);
    setGlowIdx(idx);
    glowTimer.current = setTimeout(() => {
      setGlowIdx(null);
      glowTimer.current = null;
    }, 250);
    const prev = tappedRef.current;
    const next = [...prev, idx];
    tappedRef.current = next;
    setTapped(next);
    const result = judgeTap(round, prev, idx);
    if (result === "wrong") {
      flashingRef.current = true;
      sfx.wrong();
      setWrongFlash(true);
      demoTimers.current.push(
        setTimeout(() => {
          flashingRef.current = false;
          setWrongFlash(false);
          tappedRef.current = [];
          setTapped([]);
          playDemo(round);
        }, 800),
      );
    } else if (result === "complete") {
      sfx.good();
      setSparkKey((k) => k + 1);
      const nextScore = score + 1;
      if (nextScore < total) {
        setScore(nextScore);
        demoTimers.current.push(
          setTimeout(() => {
            const nr = makeBellsRound(rngRef.current, difficulty);
            setRound(nr);
          }, 600),
        );
      } else {
        demoTimers.current.push(
          setTimeout(() => {
            setScore(nextScore);
          }, 600),
        );
      }
    }
  };

  const replay = () => {
    if (!canTap(round, tappedRef.current, phase, won, flashingRef.current))
      return;
    tappedRef.current = [];
    setTapped([]);
    playDemo(round);
  };

  const reset = () => {
    clearDemo();
    if (glowTimer.current) clearTimeout(glowTimer.current);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    flashingRef.current = false;
    tappedRef.current = [];
    setTapped([]);
    setWrongFlash(false);
    setSparkKey(0);
    setRound(makeBellsRound(rngRef.current, difficulty));
  };

  const { width, height } = useWindowDimensions();
  const { bellSize, gap, shortH } = bellsLayout(
    width,
    height,
    round.bells.length,
  );

  const earPulse = useRef(new Animated.Value(1)).current;
  const bellBounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (won) return;
    if (phase === "listen") {
      bellBounce.setValue(0);
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
          Animated.timing(bellBounce, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(bellBounce, {
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
      bellBounce.stopAnimation();
    };
  }, [phase, won]); // eslint-disable-line react-hooks/exhaustive-deps

  const bellScale = bellBounce.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  const tapDots = [];
  for (let i = 0; i < round.sequence.length; i++) {
    tapDots.push(
      <View
        key={i}
        testID={`tap-dot-${i}`}
        style={[styles.tapDot, i < tapped.length && styles.tapDotFilled]}
      />,
    );
  }

  return (
    <GameShell
      title={t(lang, "shell.bells.title")}
      subtitle={t(lang, "shell.bells.sub")}
      onBack={onHome}
      lang={lang}
      right={<ScoreChip label={`🔔 ${score}/${total}`} testID="bells-score" />}
    >
      <View style={[styles.board, { gap }]}>
        {!won && (
          <>
            <View
              testID="bells-status-row"
              style={[styles.statusRow, shortH && styles.statusRowShort]}
            >
              <View
                testID="bells-status"
                style={[
                  styles.statusCard,
                  shadows.soft,
                  phase === "play" && styles.yourTurnCard,
                  wrongFlash && styles.wrongCard,
                  shortH && styles.statusCardShort,
                ]}
              >
                {phase === "listen" ? (
                  <Animated.Text
                    style={[
                      styles.statusEmoji,
                      shortH && styles.statusEmojiShort,
                      { transform: [{ scale: earPulse }] },
                    ]}
                  >
                    👂
                  </Animated.Text>
                ) : (
                  <Text
                    style={[
                      styles.statusEmoji,
                      shortH && styles.statusEmojiShort,
                    ]}
                  >
                    👆
                  </Text>
                )}
                <Text
                  style={[styles.statusText, shortH && styles.statusTextShort]}
                >
                  {phase === "listen"
                    ? t(lang, "music.listen")
                    : t(lang, "music.yourTurn")}
                </Text>
              </View>
              {phase === "play" ? (
                <Pressable
                  testID="replay-button"
                  accessibilityRole="button"
                  accessibilityLabel={t(lang, "spell.hearAgain")}
                  onPress={replay}
                  style={({ pressed }) => [
                    styles.replayBtn,
                    shadows.soft,
                    shortH && styles.replayBtnShort,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.replayText,
                      shortH && styles.replayTextShort,
                    ]}
                  >
                    🔊
                  </Text>
                </Pressable>
              ) : (
                <View
                  style={[
                    styles.replayBtn,
                    shortH && styles.replayBtnShort,
                    styles.replayHidden,
                  ]}
                  aria-hidden={true}
                />
              )}
            </View>
            <View
              testID="tap-dot-slot"
              style={[styles.tapDotSlot, shortH && styles.tapDotSlotShort]}
            >
              {phase === "play" && (
                <View
                  testID="tap-dot-row"
                  style={[styles.tapDotRow, shortH && styles.tapDotRowShort]}
                >
                  {tapDots}
                </View>
              )}
            </View>
          </>
        )}
        <View style={styles.bellRow}>
          {round.bells.map((bell, i) => (
            <Animated.View
              key={i}
              style={
                phase === "play"
                  ? { transform: [{ scale: bellScale }] }
                  : undefined
              }
            >
              <Pressable
                onPress={() => onBellTap(i)}
                testID={`bell-${i}`}
                accessibilityRole="button"
                accessibilityLabel={bellLabel(i, lang)}
                style={({ pressed }) => [
                  styles.bell,
                  {
                    width: bellSize,
                    height: bellSize * 1.2,
                    backgroundColor: bell.color,
                    borderColor: glowIdx === i ? colors.paper : bell.color,
                    opacity: phase === "listen" && glowIdx !== i ? 0.5 : 1,
                  },
                  phase === "play" && shadows.glowGold,
                  glowIdx === i && styles.bellGlow,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.bellText, { fontSize: bellSize * 0.4 }]}>
                  🔔
                </Text>
                {sparkKey > 0 && (
                  <SparkleBurst
                    trigger={`${sparkKey}-${i}`}
                    count={4}
                    size={12}
                  />
                )}
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, "win.bells")}
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
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 72,
    gap: 12,
  },
  statusRowShort: {
    minHeight: 48,
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
  statusEmojiShort: { fontSize: 24 },
  statusText: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  statusTextShort: { fontSize: 15 },
  statusCardShort: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  replayBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  replayBtnShort: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  replayHidden: {
    opacity: 0,
  },
  replayText: { fontSize: 36 },
  replayTextShort: { fontSize: 24 },
  bellRow: { flexDirection: "row", gap: 14, alignItems: "flex-end" },
  bell: {
    borderRadius: 20,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  bellGlow: {
    shadowColor: colors.paper,
    shadowOpacity: 0.6,
    shadowRadius: 16,
  },
  bellText: { textAlign: "center" },
  pressed: { transform: [{ scale: 0.92 }] },
  tapDotSlot: {
    height: 28,
    alignItems: "center",
  },
  tapDotSlotShort: {
    height: 16,
  },
  tapDotRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  tapDotRowShort: { marginTop: 0 },
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
