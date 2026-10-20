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
import { Lang, numberWord } from "../../lang";
import { t } from "../../i18n";
import { makeRng } from "../../rng";
import { colors, darken, fonts, shadows } from "../../theme";
import { say, sayThen, sfx } from "../../sound";
import { useWinLine } from "../winlines";
import {
  CompareRound,
  FEWER_PROMPT,
  MORE_PROMPT,
  PRAISE,
  Side,
  compareSettings,
  makeCompareRound,
  plateCritterPos,
  plateCritterSize,
} from "./logic";

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

/**
 * More or Less — two plates of critters, kid taps the one with MORE (or
 * FEWER on hard). On correct, the winning count is spoken aloud.
 */
export function CompareGame({ onHome, difficulty, lang }: Props) {
  const { rounds: roundsToWin } = compareSettings(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState<CompareRound>(() =>
    makeCompareRound(rngRef.current, difficulty),
  );
  const [score, setScore] = useState(0);
  const [wrongSide, setWrongSide] = useState<"left" | "right" | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedRef = useRef(false);
  const [timerKey, setTimerKey] = useState(0);
  const showTimer = settingsFor(difficulty).timer;
  const won = score >= roundsToWin;
  useWinLine(won, t(lang, "win.compare"));
  const elapsed = useElapsed(showTimer && !won, timerKey);

  const promptFor = (r: CompareRound) =>
    r.ask === "more" ? MORE_PROMPT[lang] : FEWER_PROMPT[lang];

  // Keyed on the round OBJECT — repeats still re-speak.
  useEffect(() => {
    if (!won) say(promptFor(round));
  }, [round, lang, won]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
    },
    [],
  );

  const pickSide = (side: "left" | "right") => {
    if (won || lockedRef.current || wrongSide !== null) return;
    if (side === round.correctSide) {
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      lockedRef.current = true;
      sfx.good();
      const winningSide =
        round.correctSide === "left" ? round.left : round.right;
      const nextScore = score + 1;
      setScore(nextScore);
      sayThen([numberWord(lang, winningSide.count).t, PRAISE[lang]], () => {
        if (nextScore < roundsToWin) {
          setRound(makeCompareRound(rngRef.current, difficulty));
          setWrongSide(null);
          lockedRef.current = false;
        }
      });
    } else {
      lockedRef.current = true;
      sfx.wrong();
      setWrongSide(side);
      setTimeout(() => {
        setWrongSide((s) => (s === side ? null : s));
        lockedRef.current = false;
      }, 450);
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => say(promptFor(round)), 500);
    }
  };

  const reset = () => {
    if (wrongTimer.current) clearTimeout(wrongTimer.current);
    lockedRef.current = false;
    setTimerKey((k) => k + 1);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setRound(makeCompareRound(rngRef.current, difficulty));
    setScore(0);
    setWrongSide(null);
  };

  const { width, height } = useWindowDimensions();
  const totalW = Math.min(width - 32, 620);
  const plateW = (totalW - 20) / 2;
  const plateH = Math.min(height - 84 - 180, plateW * 1.05);

  return (
    <GameShell
      title={t(lang, "shell.compare.title")}
      subtitle={
        round.ask === "fewer"
          ? t(lang, "shell.compare.subFewer")
          : t(lang, "shell.compare.subMore")
      }
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
          accessibilityLabel={promptFor(round)}
          style={({ pressed }) => [
            styles.promptCard,
            shadows.soft,
            round.ask === "fewer" && styles.promptCardFewer,
            pressed && styles.pressed,
          ]}
          testID={`compare-prompt-${round.ask}`}
        >
          <Text style={styles.promptText}>{promptFor(round)}</Text>
          <Text style={styles.hearHint}>{t(lang, "spell.hearAgain")}</Text>
        </Pressable>
        <View style={[styles.plates, { width: totalW }]}>
          <Plate
            data={round.left}
            width={plateW}
            height={plateH}
            wrong={wrongSide === "left"}
            onPress={() => pickSide("left")}
            testID={`compare-plate-left-${round.left.icon}-${round.left.count}${round.correctSide === "left" ? "-correct" : ""}`}
          />
          <Plate
            data={round.right}
            width={plateW}
            height={plateH}
            wrong={wrongSide === "right"}
            onPress={() => pickSide("right")}
            testID={`compare-plate-right-${round.right.icon}-${round.right.count}${round.correctSide === "right" ? "-correct" : ""}`}
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
  onPress: () => void;
  testID: string;
}

function Plate({ data, width, height, wrong, onPress, testID }: PlateProps) {
  const critterSize = plateCritterSize(data.count, width, height);
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${data.count} ${data.icon}`}
      style={({ pressed }) => [
        styles.plate,
        shadows.soft,
        { width, height },
        wrong && styles.plateWrong,
        pressed && styles.pressed,
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
  plates: { flexDirection: "row", justifyContent: "space-between" },
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
  pressed: { transform: [{ scale: 0.96 }] },
});
