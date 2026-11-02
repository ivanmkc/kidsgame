import React, { useEffect, useRef, useState } from "react";
import {
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
import { Lang, useLangEpoch } from "../../lang";
import { t } from "../../i18n";
import { makeRng } from "../../rng";
import { colors, darken, fonts, shadows } from "../../theme";
import { say, sayThen, sfx } from "../../sound";
import { useWinLine } from "../winlines";
import {
  CompareRound,
  Side,
  compareSettings,
  makeCompareRound,
  plateAccessibilityLabel,
  plateCritterPos,
  plateCritterSize,
  roundComparisonPhrase,
} from "./logic";

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

/**
 * More or Less — two plates of critters, kid taps the one with MORE (or
 * FEWER on hard). On correct, count badges reveal on both plates and
 * comparative feedback is spoken aloud.
 */
export function CompareGame({ onHome, difficulty, lang }: Props) {
  const { isValid } = useLangEpoch(lang);
  const { rounds: roundsToWin } = compareSettings(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState<CompareRound>(() =>
    makeCompareRound(rngRef.current, difficulty),
  );
  const [score, setScore] = useState(0);
  const [wrongSide, setWrongSide] = useState<"left" | "right" | null>(null);
  const wrongSideRef = useRef<"left" | "right" | null>(null);
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const [timerKey, setTimerKey] = useState(0);
  const showTimer = settingsFor(difficulty).timer;
  const [won, setWon] = useState(false);
  useWinLine(won, t(lang, "win.compare"));
  const elapsed = useElapsed(showTimer && !won, timerKey);
  const isMountedRef = useRef(true);
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cancelWrongTimers = () => {
    wrongTimerRef.current.forEach(clearTimeout);
    wrongTimerRef.current = [];
  };

  const clearWrongState = () => {
    cancelWrongTimers();
    wrongSideRef.current = null;
    setWrongSide(null);
  };

  useEffect(
    () => () => {
      isMountedRef.current = false;
      cancelWrongTimers();
    },
    [],
  );

  const promptFor = (r: CompareRound) =>
    r.ask === "more"
      ? t(lang, "compare.prompt.more")
      : t(lang, "compare.prompt.fewer");

  // Lang switch: clear timers and unlock state, preserving the round.
  const langMounted = useRef(false);
  useEffect(() => {
    if (!langMounted.current) {
      langMounted.current = true;
      return;
    }
    clearWrongState();
    lockedRef.current = false;
    setLocked(false);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyed on the round OBJECT — repeats still re-speak; lang switch re-speaks prompt.
  useEffect(() => {
    if (!won) say(promptFor(round));
  }, [round, lang, won]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickSide = (side: "left" | "right") => {
    if (won || locked || lockedRef.current || wrongSideRef.current === side) return;
    if (side === round.correctSide) {
      clearWrongState();
      lockedRef.current = true;
      setLocked(true);
      sfx.good();
      const nextScore = score + 1;
      setScore(nextScore);
      const feedback = roundComparisonPhrase(lang, round);
      sayThen([feedback, t(lang, "compare.praise")], () => {
        if (!isMountedRef.current) return;
        if (nextScore < roundsToWin) {
          setRound(makeCompareRound(rngRef.current, difficulty));
          wrongSideRef.current = null;
          setWrongSide(null);
          lockedRef.current = false;
          setLocked(false);
        } else {
          setWon(true);
        }
      });
    } else {
      sfx.wrong();
      cancelWrongTimers();
      wrongSideRef.current = side;
      setWrongSide(side);
      wrongTimerRef.current.push(
        setTimeout(() => {
          if (!isMountedRef.current || !isValid()) return;
          wrongSideRef.current = null;
          setWrongSide((s) => (s === side ? null : s));
        }, 450),
      );
      wrongTimerRef.current.push(
        setTimeout(() => {
          if (!isMountedRef.current || !isValid()) return;
          say(promptFor(round));
        }, 500),
      );
    }
  };

  const reset = () => {
    clearWrongState();
    lockedRef.current = false;
    setLocked(false);
    setWon(false);
    setTimerKey((k) => k + 1);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setRound(makeCompareRound(rngRef.current, difficulty));
    setScore(0);
  };

  const { width, height } = useWindowDimensions();
  const totalW = Math.min(width - 32, 620);
  const plateW = (totalW - 20) / 2;
  const plateH = Math.min(height - 84 - 180, plateW * 1.05);

  const promptText = t(
    lang,
    round.ask === "more" ? "shell.compare.subMore" : "shell.compare.subFewer",
  );

  return (
    <GameShell
      title={t(lang, "shell.compare.title")}
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
              testID="compare-timer"
            />
          ) : null}
          <ScoreChip
            label={`⚖️ ${score}/${roundsToWin}`}
            testID="compare-score"
          />
        </View>
      }
    >
      <View style={styles.board}>
        <Pressable
          disabled={won}
          onPress={() => {
            if (won || lockedRef.current) return;
            sfx.tap();
            say(promptFor(round));
          }}
          accessibilityRole="button"
          accessibilityLabel={promptText}
          style={({ pressed }) => [
            styles.promptCard,
            shadows.soft,
            round.ask === "fewer" && styles.promptCardFewer,
            pressed && styles.pressed,
          ]}
          testID={`compare-prompt-${round.ask}`}
        >
          <Text style={styles.promptText}>{promptText}</Text>
          <Text
            style={[
              styles.hearHint,
              round.ask === "fewer" && styles.hearHintFewer,
            ]}
          >
            {t(lang, "spell.hearAgain")}
          </Text>
        </Pressable>
        <View style={[styles.plates, { width: totalW }]}>
          <Plate
            data={round.left}
            width={plateW}
            height={plateH}
            wrong={wrongSide === "left"}
            isWinner={locked && round.correctSide === "left"}
            showCount={locked}
            onPress={() => pickSide("left")}
            testID={`compare-plate-left-${round.left.icon}-${round.left.count}${round.correctSide === "left" ? "-correct" : ""}`}
            badgeTestID="compare-badge-left"
            lang={lang}
          />
          <Plate
            data={round.right}
            width={plateW}
            height={plateH}
            wrong={wrongSide === "right"}
            isWinner={locked && round.correctSide === "right"}
            showCount={locked}
            onPress={() => pickSide("right")}
            testID={`compare-plate-right-${round.right.icon}-${round.right.count}${round.correctSide === "right" ? "-correct" : ""}`}
            badgeTestID="compare-badge-right"
            lang={lang}
          />
        </View>
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, "win.compare")}
        onNext={reset}
        nextLabel={t(lang, "overlay.playAgain")}
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

interface PlateProps {
  data: Side;
  width: number;
  height: number;
  wrong: boolean;
  isWinner?: boolean;
  showCount?: boolean;
  onPress: () => void;
  testID: string;
  badgeTestID?: string;
  lang: Lang;
}

function Plate({
  data,
  width,
  height,
  wrong,
  isWinner = false,
  showCount = false,
  onPress,
  testID,
  badgeTestID,
  lang,
}: PlateProps) {
  const critterSize = plateCritterSize(data.count, width, height);
  return (
    <View style={[styles.plateCol, { width }]}>
      <Pressable
        onPress={onPress}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={plateAccessibilityLabel(
          data.count,
          data.icon,
          lang,
        )}
        style={({ pressed }) => [
          styles.plate,
          shadows.soft,
          { width, height },
          wrong && styles.plateWrong,
          isWinner && styles.plateWinner,
          pressed && !showCount && styles.pressed,
        ]}
      >
        {data.positions.map((p, i) => (
          <Image
            key={i}
            source={SPOTIT_ICONS[data.icon]}
            style={{
              position: "absolute",
              ...plateCritterPos(p, critterSize, width, height),
              width: critterSize,
              height: critterSize,
            }}
            resizeMode="contain"
          />
        ))}
      </Pressable>
      <View style={styles.badgeSlot}>
        {showCount ? (
          <View style={styles.badgeContainer} pointerEvents="none">
            <View
              style={[
                styles.badge,
                shadows.soft,
                isWinner && styles.badgeWinner,
              ]}
              testID={badgeTestID}
            >
              <Text
                style={[styles.badgeText, isWinner && styles.badgeTextWinner]}
              >
                {data.count}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
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
  promptCard: {
    backgroundColor: colors.gold,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: darken(colors.gold, 0.15),
    paddingVertical: 10,
    paddingHorizontal: 22,
    alignItems: "center",
    maxWidth: 560,
  },
  promptCardFewer: {
    backgroundColor: colors.purple,
    borderColor: darken(colors.purple, 0.15),
  },
  promptText: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    textAlign: "center",
  },
  hearHint: {
    fontFamily: fonts.bodyReg,
    fontSize: 12,
    color: colors.inkSoft,
  },
  hearHintFewer: {
    color: colors.paper,
  },
  plates: { flexDirection: "row", justifyContent: "space-between" },
  plateCol: {
    alignItems: "center",
    gap: 8,
  },
  plate: {
    backgroundColor: colors.paper,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: colors.blush,
    position: "relative",
    overflow: "hidden",
  },
  plateWrong: {
    borderColor: colors.red,
    backgroundColor: "rgba(232,86,79,0.10)",
  },
  plateWinner: {
    borderColor: colors.green,
    backgroundColor: "rgba(95,191,110,0.12)",
  },
  badgeSlot: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.blush,
    paddingHorizontal: 14,
    paddingVertical: 4,
    minWidth: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeWinner: {
    borderColor: colors.green,
    backgroundColor: "#F0FFF4",
  },
  badgeText: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.ink,
  },
  badgeTextWinner: {
    color: darken(colors.green, 0.2),
  },
  pressed: { transform: [{ scale: 0.96 }] },
});
