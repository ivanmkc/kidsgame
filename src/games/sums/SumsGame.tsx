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
import { spriteLT } from "../quizround/logic";
import { GameShell, ScoreChip } from "../../components/GameShell";
import { TimerRing, useElapsed } from "../../components/TimerRing";
import { WinOverlay } from "../../components/WinOverlay";
import { Difficulty, settingsFor } from "../../difficulty";
import { Lang, numberWord, useLangEpoch } from "../../lang";
import { t } from "../../i18n";
import { Position } from "../count/logic";
import { makeRng } from "../../rng";
import { colors, darken, fonts, shadows } from "../../theme";
import { sayThen, saySequence, sfx, say } from "../../sound";
import {
  PLUS,
  PRAISE,
  QUESTION,
  SumsRound,
  makeSumsRound,
  sumsLayout,
  sumsSettings,
} from "./logic";
import { useWinLine } from "../winlines";

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

/**
 * Little Sums — a critters, then b more slide in. Kid picks the total.
 */
export function SumsGame({ onHome, difficulty, lang }: Props) {
  useLangEpoch(lang);
  const { rounds: roundsToWin } = sumsSettings(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState<SumsRound>(() =>
    makeSumsRound(rngRef.current, difficulty),
  );
  const [score, setScore] = useState(0);
  const [wrongPick, setWrongPick] = useState<number | null>(null);
  const lockedRef = useRef(false);
  const [timerKey, setTimerKey] = useState(0);
  const showTimer = settingsFor(difficulty).timer;
  const [won, setWon] = useState(false);
  useWinLine(won, t(lang, "win.sums"));
  const elapsed = useElapsed(showTimer && !won, timerKey);
  const wrongVoiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongPickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearBoingTimers = () => {
    boingTimersRef.current.forEach(clearTimeout);
    boingTimersRef.current = [];
  };

  useEffect(
    () => () => {
      if (wrongVoiceTimer.current) clearTimeout(wrongVoiceTimer.current);
      if (wrongPickTimer.current) clearTimeout(wrongPickTimer.current);
      clearBoingTimers();
    },
    [],
  );

  // Speak "a plus b, how many now?" once per round object or language switch
  // (repeat sums still re-narrate — the round object identity changes even when the values collide).
  useEffect(() => {
    if (won) return;
    if (wrongVoiceTimer.current) {
      clearTimeout(wrongVoiceTimer.current);
      wrongVoiceTimer.current = null;
    }
    if (wrongPickTimer.current) {
      clearTimeout(wrongPickTimer.current);
      wrongPickTimer.current = null;
      setWrongPick(null);
      lockedRef.current = false;
    }
    saySequence([
      numberWord(lang, round.a).t,
      PLUS[lang],
      numberWord(lang, round.b).t,
      QUESTION[lang],
    ]);
  }, [round, lang, won]);

  // Play a soft boing for each incoming critter (staggered 250ms). The
  // animation itself is per-critter (Incoming component); this just adds
  // the audio beat.
  useEffect(() => {
    clearBoingTimers();
    if (won) return;
    for (let i = 0; i < round.b; i++) {
      boingTimersRef.current.push(
        setTimeout(() => sfx.boing(0.35), 400 + i * 250),
      );
    }
    return clearBoingTimers;
  }, [round, won]);

  const pickAnswer = (v: number) => {
    if (won || lockedRef.current) return;
    if (v === round.sum) {
      lockedRef.current = true;
      clearBoingTimers();
      if (wrongVoiceTimer.current) {
        clearTimeout(wrongVoiceTimer.current);
        wrongVoiceTimer.current = null;
      }
      if (wrongPickTimer.current) {
        clearTimeout(wrongPickTimer.current);
        wrongPickTimer.current = null;
      }
      sfx.good();
      const nextScore = score + 1;
      setScore(nextScore);
      sayThen([numberWord(lang, round.sum).t, PRAISE[lang]], () => {
        lockedRef.current = false;
        if (nextScore < roundsToWin) {
          setRound(makeSumsRound(rngRef.current, difficulty));
          setWrongPick(null);
        } else {
          setWon(true);
        }
      });
    } else {
      lockedRef.current = true;
      sfx.wrong();
      setWrongPick(v);
      if (wrongPickTimer.current) clearTimeout(wrongPickTimer.current);
      wrongPickTimer.current = setTimeout(() => {
        lockedRef.current = false;
        setWrongPick((w) => (w === v ? null : w));
        wrongPickTimer.current = null;
      }, 450);
      if (wrongVoiceTimer.current) clearTimeout(wrongVoiceTimer.current);
      wrongVoiceTimer.current = setTimeout(() => {
        say(QUESTION[lang]);
        wrongVoiceTimer.current = null;
      }, 500);
    }
  };

  const reset = () => {
    clearBoingTimers();
    if (wrongVoiceTimer.current) {
      clearTimeout(wrongVoiceTimer.current);
      wrongVoiceTimer.current = null;
    }
    if (wrongPickTimer.current) {
      clearTimeout(wrongPickTimer.current);
      wrongPickTimer.current = null;
    }
    setTimerKey((k) => k + 1);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setRound(makeSumsRound(rngRef.current, difficulty));
    setScore(0);
    setWrongPick(null);
    lockedRef.current = false;
    setWon(false);
  };

  const { width, height } = useWindowDimensions();
  const total = round.a + round.b;
  const { isLandscape, stageW, stageH, critterSize } = sumsLayout(
    width,
    height,
    total,
  );

  return (
    <GameShell
      title={t(lang, "shell.sums.title")}
      subtitle={t(lang, "shell.sums.sub")}
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
              testID="sums-timer"
            />
          ) : null}
          <ScoreChip label={`➕ ${score}/${roundsToWin}`} testID="sums-score" />
        </View>
      }
    >
      <View style={[styles.board, isLandscape && styles.boardLandscape]}>
        <View
          style={[
            styles.stage,
            shadows.soft,
            { width: stageW, height: stageH },
          ]}
          testID={`sums-stage-${round.a}+${round.b}`}
        >
          {round.aPositions.map((p, i) => (
            <StaticCritter
              key={`${score}-a-${i}`}
              icon={round.icon}
              size={critterSize}
              stageW={stageW}
              stageH={stageH}
              pos={p}
              testID={`sums-initial-${i}`}
            />
          ))}
          {round.bPositions.map((p, i) => (
            <Incoming
              key={`${score}-b-${i}`}
              icon={round.icon}
              size={critterSize}
              stageW={stageW}
              stageH={stageH}
              pos={p}
              delay={400 + i * 250}
              testID={`sums-incoming-${i}`}
            />
          ))}
        </View>
        <View
          style={[styles.controls, isLandscape && styles.controlsLandscape]}
        >
          <View style={[styles.equation, shadows.soft]}>
            <Text style={styles.equationText}>
              {round.a} + {round.b} = ?
            </Text>
          </View>
          <View
            style={[styles.choiceRow, isLandscape && styles.choiceRowLandscape]}
          >
            {round.choices.map((c) => (
              <Pressable
                key={c}
                onPress={() => pickAnswer(c)}
                testID={`sums-choice-${c}${c === round.sum ? "-answer" : ""}`}
                accessibilityRole="button"
                accessibilityLabel={String(c)}
                style={({ pressed }) => [
                  styles.choice,
                  isLandscape && styles.choiceLandscape,
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
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, "win.sums")}
        onNext={reset}
        nextLabel={t(lang, "overlay.playAgain")}
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

interface CritterViewProps {
  icon: string;
  size: number;
  stageW: number;
  stageH: number;
  pos: Position;
  testID: string;
}

function StaticCritter({
  icon,
  size,
  stageW,
  stageH,
  pos,
  testID,
}: CritterViewProps) {
  return (
    <Image
      source={SPOTIT_ICONS[icon]}
      testID={testID}
      style={{
        position: "absolute",
        ...spriteLT(pos.x, pos.y, size, stageW, stageH),
        width: size,
        height: size,
      }}
      resizeMode="contain"
    />
  );
}

interface IncomingProps extends CritterViewProps {
  delay: number;
}

function Incoming({
  icon,
  size,
  stageW,
  stageH,
  pos,
  delay,
  testID,
}: IncomingProps) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration: 420,
      delay,
      useNativeDriver: true,
    }).start();
  }, [t, delay]);
  const translateY = t.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 0],
  });
  return (
    <Animated.View
      testID={testID}
      style={{
        position: "absolute",
        ...spriteLT(pos.x, pos.y, size, stageW, stageH),
        width: size,
        height: size,
        opacity: t,
        transform: [{ translateY }],
      }}
    >
      <Image
        source={SPOTIT_ICONS[icon]}
        style={{ width: "100%", height: "100%" }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  board: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 16,
  },
  boardLandscape: {
    flexDirection: "row",
    gap: 20,
  },
  controls: {
    alignItems: "center",
    gap: 14,
  },
  controlsLandscape: {
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  stage: {
    backgroundColor: colors.paper,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.blush,
    position: "relative",
    overflow: "hidden",
  },
  equation: {
    backgroundColor: colors.gold,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: darken(colors.gold, 0.15),
    paddingVertical: 8,
    paddingHorizontal: 22,
  },
  equationText: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  choiceRow: { flexDirection: "row", gap: 14 },
  choiceRowLandscape: { gap: 10 },
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
  choiceLandscape: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 64,
  },
  choiceWrong: {
    borderColor: colors.red,
    backgroundColor: "rgba(232,86,79,0.14)",
  },
  choiceText: { fontFamily: fonts.display, fontSize: 34, color: colors.ink },
  pressed: { transform: [{ scale: 0.94 }] },
});
