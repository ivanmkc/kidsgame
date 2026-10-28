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
import { Lang, numberWord } from "../../lang";
import { t } from "../../i18n";
import { makeRng } from "../../rng";
import { colors, darken, fonts, shadows } from "../../theme";
import { say, sayThen, sfx } from "../../sound";
import {
  CountRound,
  PROMPTS,
  applyTap,
  countSettings,
  critterLabel,
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
  const [tapped, setTapped] = useState<number[]>(() =>
    Array.from({ length: round.n }, () => 0),
  );
  const tappedRef = useRef(tapped);
  tappedRef.current = tapped;
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<"count" | "quiz">("count");
  const [wrongPick, setWrongPick] = useState<number | null>(null);
  const wrongTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [timerKey, setTimerKey] = useState(0);
  const showTimer = settingsFor(difficulty).timer;
  const [won, setWon] = useState(false);
  useWinLine(won, t(lang, "win.count"));
  const elapsed = useElapsed(showTimer && !won, timerKey);

  // Keyed on the round OBJECT so a repeat number still re-narrates.
  useEffect(() => {
    setWrongPick(null);
    if (!won) {
      if (phase === "quiz") {
        say(PROMPTS[lang]);
      } else if (phase === "count") {
        say(t(lang, "shell.count.sub"));
      }
    }
    return () => {
      wrongTimeoutsRef.current.forEach(clearTimeout);
      wrongTimeoutsRef.current = [];
    };
  }, [round, phase, lang, won]);

  const tapCritter = (i: number) => {
    if (won || phase !== "count") return;
    const next = applyTap(tappedRef.current, i);
    if (next === tappedRef.current) return;
    tappedRef.current = next;
    setTapped((prev) => applyTap(prev, i));
    const n = next.filter((x) => x > 0).length;
    sfx.tap();
    const line = numberWord(lang, n).t;
    if (n >= round.n) {
      // Chain the phase switch on speech completion so the "How many?"
      // prompt (fired by the phase-change useEffect) doesn't cut the last
      // count word mid-syllable.
      sayThen([line], () => setPhase("quiz"));
    } else {
      say(line);
    }
  };

  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  lockedRef.current = locked;

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
        sayThen,
        setTimeout: (fn, ms) => {
          const id = globalThis.setTimeout(fn, ms);
          wrongTimeoutsRef.current.push(id);
          return id;
        },
        clearTimeouts: () => {
          wrongTimeoutsRef.current.forEach(clearTimeout);
          wrongTimeoutsRef.current = [];
        },
        makeNextRound: () => makeCountRound(rngRef.current, difficulty),
        setScore,
        setRoundNo,
        setLocked: (l: boolean) => {
          lockedRef.current = l;
          setLocked(l);
        },
        setRound,
        setTapped,
        setPhase,
        setWrongPick,
        setWon,
      },
    );
  };

  const reset = () => {
    setTimerKey((k) => k + 1);
    lockedRef.current = false;
    setLocked(false);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    const nr = makeCountRound(rngRef.current, difficulty);
    setRound(nr);
    setRoundNo((r) => r + 1);
    setTapped(Array.from({ length: nr.n }, () => 0));
    setScore(0);
    setWon(false);
    setPhase("count");
    setWrongPick(null);
  };

  const { width, height } = useWindowDimensions();
  const stageW = Math.min(width - 32, 560);
  const stageH = Math.min(height - 84 - 180, stageW * 0.85);
  const critterSize = stageCritterSize(round.n, stageW, stageH);
  const promptText = t(lang, "shell.count.sub");

  return (
    <GameShell
      title={t(lang, "shell.count.title")}
      subtitle={promptText}
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
                lang={lang}
                order={tapped[i]}
                size={critterSize}
                left={left}
                top={top}
                onTap={() => tapCritter(i)}
                testID={`count-critter-${i}${tapped[i] > 0 ? "-tapped" : ""}`}
                badgeTestID={`count-badge-${i}`}
              />
            );
          })}
        </View>
        {phase === "quiz" ? (
          <View style={styles.quiz}>
            <Pressable
              disabled={won}
              onPress={() => {
                if (won || lockedRef.current) return;
                say(PROMPTS[lang]);
              }}
              accessibilityRole="button"
              accessibilityLabel={promptText}
              style={({ pressed }) => [
                styles.promptCard,
                shadows.soft,
                pressed && styles.pressed,
              ]}
              testID="count-prompt"
            >
              <Text style={styles.promptText}>{promptText}</Text>
              <Text style={styles.hearHint}>{t(lang, "spell.hearAgain")}</Text>
            </Pressable>
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
                    locked && c === round.answer && styles.choiceCorrect,
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
            {tapped.filter((x) => x > 0).length} / {round.n}
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
  lang: Lang;
  order: number;
  size: number;
  left: number;
  top: number;
  onTap: () => void;
  testID: string;
  badgeTestID?: string;
}

function Critter({
  icon,
  lang,
  order,
  size,
  left,
  top,
  onTap,
  testID,
  badgeTestID,
}: CritterProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const wasTapped = useRef(false);
  const isTapped = order > 0;
  useEffect(() => {
    if (isTapped && !wasTapped.current) {
      wasTapped.current = true;
      scale.setValue(1.35);
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4,
      }).start();
    }
  }, [isTapped, scale]);
  return (
    <Pressable
      onPress={onTap}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={critterLabel(icon, lang)}
      style={{ position: "absolute", left, top, width: size, height: size }}
    >
      <Animated.View
        style={{ width: size, height: size, transform: [{ scale }] }}
      >
        <Image
          source={SPOTIT_ICONS[icon]}
          style={{
            width: "100%",
            height: "100%",
            opacity: isTapped ? 0.55 : 1,
          }}
          resizeMode="contain"
        />
        {isTapped ? (
          <View style={styles.badge} pointerEvents="none" testID={badgeTestID}>
            <Text style={styles.badgeText}>{order}</Text>
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
    alignItems: "center",
    gap: 2,
  },
  promptText: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    textAlign: "center",
  },
  hearHint: {
    fontFamily: fonts.bodyReg,
    fontSize: 12,
    color: colors.inkSoft,
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
  choiceCorrect: {
    borderColor: colors.green,
    backgroundColor: "rgba(95,191,110,0.14)",
  },
  choiceText: { fontFamily: fonts.display, fontSize: 34, color: colors.ink },
  pressed: { transform: [{ scale: 0.94 }] },
  hint: { fontFamily: fonts.bodyReg, color: colors.inkSoft, fontSize: 14 },
  badge: {
    position: "absolute",
    right: -4,
    top: -4,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 4,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.paper,
  },
  badgeText: {
    color: colors.paper,
    fontFamily: fonts.display,
    fontSize: 14,
    lineHeight: 16,
  },
});
