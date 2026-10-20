import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SPOTIT_ICONS } from "../../assets/images";
import { GameShell, ScoreChip } from "../../components/GameShell";
import { TimerRing, useElapsed } from "../../components/TimerRing";
import { WinOverlay } from "../../components/WinOverlay";
import { Difficulty, settingsFor } from "../../difficulty";
import { Lang, numberWord, useLangEpoch } from "../../lang";
import { t } from "../../i18n";
import { makeRng } from "../../rng";
import { colors, darken, fonts, shadows } from "../../theme";
import { say, sayThen, sfx } from "../../sound";
import {
  CountRound,
  PROMPTS,
  applyTap,
  countSettings,
  applyPickAnswer,
  makeCountRound,
  STAGE_PADDING,
  stageCritterSize,
} from "./logic";
import { spriteLT } from "../quizround/logic";
import { useWinLine } from "../winlines";

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

/**
 * Count With Me — the kid taps each critter, hears the count word grow, then
 * picks the numeral. Pre-readers play entirely by ear; the numerals on the
 * answer buttons are just glyphs to match the ones they hear.
 */
export function CountGame({ onHome, difficulty, lang }: Props) {
  const { rounds: roundsToWin } = countSettings(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState<CountRound>(() =>
    makeCountRound(rngRef.current, difficulty),
  );
  const [roundNo, setRoundNo] = useState(0);
  const [tapped, setTapped] = useState<boolean[]>(() =>
    Array.from({ length: round.n }, () => false),
  );
  const tappedRef = useRef(tapped);
  tappedRef.current = tapped;
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<"count" | "quiz">("count");
  const [wrongPick, setWrongPick] = useState<number | null>(null);
  const [timerKey, setTimerKey] = useState(0);
  const lockedRef = useRef(false);
  const showTimer = settingsFor(difficulty).timer;
  const won = score >= roundsToWin;
  useWinLine(won, t(lang, "win.count"));
  const elapsed = useElapsed(showTimer && !won, timerKey);

  const { isValid } = useLangEpoch(lang);

  // Lang switch: rebuild the live round so prompt/speech re-skin immediately.
  const langMounted = useRef(false);
  useEffect(() => {
    if (!langMounted.current) {
      langMounted.current = true;
      return;
    }
    lockedRef.current = false;
    const nr = makeCountRound(rngRef.current, difficulty);
    const nextTapped = Array.from({ length: nr.n }, () => false);
    tappedRef.current = nextTapped;
    setRound(nr);
    setRoundNo((r) => r + 1);
    setTapped(nextTapped);
    setPhase("count");
    setWrongPick(null);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyed on the round OBJECT so a repeat number still re-narrates.
  useEffect(() => {
    if (won) return;
    if (phase === "quiz") {
      say(PROMPTS[lang]);
    } else if (phase === "count") {
      say(t(lang, "shell.count.sub"));
    }
  }, [round, phase, won]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardedSayThen = (lines: string[], cb: () => void) => {
    sayThen(lines, () => {
      if (isValid()) cb();
    });
  };

  const guardedTimeout = (fn: () => void, ms: number) => {
    return globalThis.setTimeout(() => {
      if (isValid()) fn();
    }, ms);
  };

  const tapCritter = (i: number) => {
    if (won || phase !== "count") return;
    const next = applyTap(tappedRef.current, i);
    if (next === tappedRef.current) return;
    tappedRef.current = next;
    setTapped((prev) => applyTap(prev, i));
    const n = next.filter(Boolean).length;
    sfx.tap();
    const line = numberWord(lang, n).t;
    if (n >= round.n) {
      // Chain the phase switch on speech completion so the "How many?"
      // prompt (fired by the phase-change useEffect) doesn't cut the last
      // count word mid-syllable.
      guardedSayThen([line], () => setPhase("quiz"));
    } else {
      say(line);
    }
  };

  const pickAnswer = (v: number) => {
    applyPickAnswer(
      v,
      {
        won,
        phase,
        locked: lockedRef.current,
        score,
        round,
        roundsToWin,
        lang,
      },
      {
        sfx,
        say,
        sayThen: guardedSayThen,
        setTimeout: guardedTimeout,
        makeNextRound: () => makeCountRound(rngRef.current, difficulty),
        setScore,
        setRoundNo,
        setLocked: (l: boolean) => {
          lockedRef.current = l;
        },
        setRound,
        setTapped,
        setPhase,
        setWrongPick,
      },
    );
  };

  const reset = () => {
    setTimerKey((k) => k + 1);
    lockedRef.current = false;
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    const nr = makeCountRound(rngRef.current, difficulty);
    setRound(nr);
    setRoundNo((r) => r + 1);
    setTapped(Array.from({ length: nr.n }, () => false));
    setScore(0);
    setPhase("count");
    setWrongPick(null);
  };

  const { width, height } = useWindowDimensions();
  const stageW = Math.min(width - 32, 560);
  const stageH = Math.min(height - 84 - 180, stageW * 0.85);
  const critterSize = stageCritterSize(round.n, stageW, stageH);

  return (
    <GameShell
      title={t(lang, "shell.count.title")}
      subtitle={t(lang, "shell.count.sub")}
      onBack={onHome}
      lang={lang}
      right={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {showTimer ? (
            <TimerRing
              elapsed={elapsed}
              size={44}
              stroke={5}
              showLabel
              testID="count-timer"
            />
          ) : null}
          <ScoreChip
            label={`🔢 ${score}/${roundsToWin}`}
            testID="count-score"
          />
        </View>
      }
    >
      <View style={styles.board}>
        <View
          style={[
            styles.stage,
            shadows.soft,
            { width: stageW, height: stageH },
          ]}
          testID={`count-stage-${round.icon}-${round.n}`}
        >
          {round.positions.map((p, i) => {
            const { left, top } = spriteLT(
              p.x,
              p.y,
              critterSize,
              stageW,
              stageH,
              STAGE_PADDING,
            );
            return (
              <Critter
                key={`${roundNo}-${i}`}
                icon={round.icon}
                tapped={tapped[i]}
                size={critterSize}
                left={left}
                top={top}
                onTap={() => tapCritter(i)}
                testID={`count-critter-${i}${tapped[i] ? "-tapped" : ""}`}
              />
            );
          })}
        </View>
        {phase === "quiz" ? (
          <View style={styles.quiz}>
            <View
              style={[styles.promptCard, shadows.soft]}
              testID="count-prompt"
            >
              <Text style={styles.promptText}>{PROMPTS[lang]}</Text>
            </View>
            <View style={styles.choiceRow}>
              {round.choices.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => pickAnswer(c)}
                  testID={`count-choice-${c}${c === round.answer ? "-answer" : ""}`}
                  accessibilityRole="button"
                  accessibilityLabel={String(c)}
                  style={({ pressed }) => [
                    styles.choice,
                    shadows.soft,
                    wrongPick === c && styles.choiceWrong,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.choiceText}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.hint} testID="count-progress">
            {tapped.filter(Boolean).length} / {round.n}
          </Text>
        )}
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, "win.count")}
        onNext={reset}
        nextLabel={t(lang, "overlay.playAgain")}
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

interface CritterProps {
  icon: string;
  tapped: boolean;
  size: number;
  left: number;
  top: number;
  onTap: () => void;
  testID: string;
}

function Critter({
  icon,
  tapped,
  size,
  left,
  top,
  onTap,
  testID,
}: CritterProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const wasTapped = useRef(false);
  useEffect(() => {
    if (tapped && !wasTapped.current) {
      wasTapped.current = true;
      scale.setValue(1.35);
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4,
      }).start();
    }
  }, [tapped, scale]);
  return (
    <Pressable
      onPress={onTap}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={icon}
      style={{ position: "absolute", left, top, width: size, height: size }}
    >
      <Animated.View
        style={{ width: size, height: size, transform: [{ scale }] }}
      >
        <Image
          source={SPOTIT_ICONS[icon]}
          style={{ width: "100%", height: "100%", opacity: tapped ? 0.55 : 1 }}
          resizeMode="contain"
        />
        {tapped ? (
          <View style={styles.check} pointerEvents="none">
            <Text style={styles.checkText}>✓</Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  board: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 16,
  },
  stage: {
    backgroundColor: colors.paper,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.blush,
    position: "relative",
    overflow: "hidden",
  },
  quiz: { alignItems: "center", gap: 12 },
  promptCard: {
    backgroundColor: colors.gold,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: darken(colors.gold, 0.15),
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  promptText: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    textAlign: "center",
  },
  choiceRow: { flexDirection: "row", gap: 14 },
  choice: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.teal,
    paddingHorizontal: 26,
    paddingVertical: 14,
    minWidth: 74,
    alignItems: "center",
  },
  choiceWrong: {
    borderColor: colors.red,
    backgroundColor: "rgba(232,86,79,0.14)",
  },
  choiceText: { fontFamily: fonts.display, fontSize: 34, color: colors.ink },
  pressed: { transform: [{ scale: 0.94 }] },
  hint: { fontFamily: fonts.bodyReg, color: colors.inkSoft, fontSize: 14 },
  check: {
    position: "absolute",
    right: -4,
    top: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.paper,
  },
  checkText: {
    color: colors.paper,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 15,
  },
});
