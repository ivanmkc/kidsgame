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
import { sayThen, saySequence, sfx, say, stopNarration } from "../../sound";
import {
  SumsRound,
  applyTap,
  critterLabel,
  equationWords,
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
  const [roundNo, setRoundNo] = useState(0);
  const [tapped, setTapped] = useState<number[]>(() =>
    Array.from({ length: round.sum }, () => 0),
  );
  const tappedRef = useRef(tapped);
  tappedRef.current = tapped;

  const resetTapped = (sum: number) => {
    const fresh = Array.from({ length: sum }, () => 0);
    tappedRef.current = fresh;
    setTapped(fresh);
  };
  const [score, setScore] = useState(0);
  const [wrongPick, setWrongPick] = useState<number | null>(null);
  const wrongPickRef = useRef<number | null>(null);
  const [correctPick, setCorrectPick] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const lockedRef = useRef(true);
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

  const clearWrongTimer = () => {
    if (wrongPickTimer.current) {
      clearTimeout(wrongPickTimer.current);
      wrongPickTimer.current = null;
    }
    wrongPickRef.current = null;
    setWrongPick(null);
  };

  useEffect(
    () => () => {
      stopNarration();
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
    clearWrongTimer();
    setCorrectPick(null);
    saySequence(equationWords(round, lang));
  }, [round, lang, won]);

  // Play a soft boing for each incoming critter (staggered 250ms). The
  // animation itself is per-critter (Incoming component); this just adds
  // the audio beat.
  useEffect(() => {
    clearBoingTimers();
    if (won) return;
    lockedRef.current = true;
    for (let i = 0; i < round.b; i++) {
      boingTimersRef.current.push(
        setTimeout(() => sfx.boing(0.35), 400 + i * 250),
      );
    }
    boingTimersRef.current.push(
      setTimeout(
        () => {
          lockedRef.current = false;
        },
        400 + round.b * 250 + 420,
      ),
    );
    return clearBoingTimers;
  }, [round, won]);

  const tapCritter = (idx: number) => {
    if (won || lockedRef.current) return;
    const next = applyTap(tappedRef.current, idx);
    if (next === tappedRef.current) return;
    if (wrongVoiceTimer.current) {
      clearTimeout(wrongVoiceTimer.current);
      wrongVoiceTimer.current = null;
    }
    tappedRef.current = next;
    setTapped(next);
    const count = next.filter((x) => x > 0).length;
    sfx.tap();
    say(numberWord(lang, count).t);
  };

  const replayEquation = () => {
    if (won || lockedRef.current) return;
    if (wrongVoiceTimer.current) {
      clearTimeout(wrongVoiceTimer.current);
      wrongVoiceTimer.current = null;
    }
    saySequence(equationWords(round, lang));
  };

  const pickAnswer = (v: number) => {
    if (won || lockedRef.current || wrongPickRef.current === v) return;
    if (v === round.sum) {
      lockedRef.current = true;
      setCorrectPick(v);
      clearWrongTimer();
      clearBoingTimers();
      if (wrongVoiceTimer.current) {
        clearTimeout(wrongVoiceTimer.current);
        wrongVoiceTimer.current = null;
      }
      sfx.good();
      const nextScore = score + 1;
      setScore(nextScore);
      setSolved(true);
      sayThen([numberWord(lang, round.sum).t, t(lang, "sums.praise")], () => {
        lockedRef.current = false;
        setCorrectPick(null);
        if (nextScore < roundsToWin) {
          const next = makeSumsRound(rngRef.current, difficulty);
          setRound(next);
          resetTapped(next.sum);
          setSolved(false);
          setRoundNo((n) => n + 1);
          clearWrongTimer();
        } else {
          setWon(true);
        }
      });
    } else {
      sfx.wrong();
      wrongPickRef.current = v;
      setWrongPick(v);
      if (wrongPickTimer.current) clearTimeout(wrongPickTimer.current);
      wrongPickTimer.current = setTimeout(() => {
        wrongPickRef.current = null;
        setWrongPick((w) => (w === v ? null : w));
        wrongPickTimer.current = null;
      }, 450);
      if (wrongVoiceTimer.current) clearTimeout(wrongVoiceTimer.current);
      wrongVoiceTimer.current = setTimeout(() => {
        saySequence(equationWords(round, lang));
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
    clearWrongTimer();
    setTimerKey((k) => k + 1);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    const next = makeSumsRound(rngRef.current, difficulty);
    setRound(next);
    setRoundNo((n) => n + 1);
    resetTapped(next.sum);
    setScore(0);
    setCorrectPick(null);
    setSolved(false);
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
            <Critter
              key={`${roundNo}-a-${i}`}
              icon={round.icon}
              lang={lang}
              order={tapped[i]}
              size={critterSize}
              stageW={stageW}
              stageH={stageH}
              pos={p}
              onTap={() => tapCritter(i)}
              testID={`sums-initial-${i}`}
              badgeTestID={`sums-badge-${i}`}
            />
          ))}
          {round.bPositions.map((p, i) => (
            <Critter
              key={`${roundNo}-b-${i}`}
              icon={round.bIcon ?? round.icon}
              lang={lang}
              order={tapped[round.a + i]}
              size={critterSize}
              stageW={stageW}
              stageH={stageH}
              pos={p}
              delay={400 + i * 250}
              onTap={() => tapCritter(round.a + i)}
              testID={`sums-incoming-${i}`}
              badgeTestID={`sums-badge-${round.a + i}`}
            />
          ))}
        </View>
        <View
          style={[styles.controls, isLandscape && styles.controlsLandscape]}
        >
          <Pressable
            disabled={won}
            onPress={replayEquation}
            testID="sums-equation"
            accessibilityRole="button"
            accessibilityLabel={`${round.a} + ${round.b} = ${solved ? round.sum : "?"}`}
            style={({ pressed }) => [
              styles.equation,
              shadows.soft,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.equationText}>
              {round.a} + {round.b} = {solved ? round.sum : "?"}
            </Text>
          </Pressable>
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
                aria-selected={correctPick === c}
                style={({ pressed }) => [
                  styles.choice,
                  isLandscape && styles.choiceLandscape,
                  shadows.soft,
                  wrongPick === c && styles.choiceWrong,
                  correctPick === c && styles.choiceCorrect,
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

interface CritterProps {
  icon: string;
  lang: Lang;
  order: number;
  size: number;
  stageW: number;
  stageH: number;
  pos: Position;
  delay?: number;
  onTap: () => void;
  testID: string;
  badgeTestID?: string;
}

function Critter({
  icon,
  lang,
  order,
  size,
  stageW,
  stageH,
  pos,
  delay,
  onTap,
  testID,
  badgeTestID,
}: CritterProps) {
  const isIncoming = delay !== undefined;
  const enter = useRef(new Animated.Value(isIncoming ? 0 : 1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const wasTapped = useRef(false);
  const isTapped = order > 0;

  useEffect(() => {
    if (isIncoming) {
      enter.setValue(0);
      Animated.timing(enter, {
        toValue: 1,
        duration: 420,
        delay,
        useNativeDriver: true,
      }).start();
    }
  }, [enter, delay, isIncoming]);

  useEffect(() => {
    if (isTapped && !wasTapped.current) {
      wasTapped.current = true;
      scale.setValue(1.35);
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4,
      }).start();
    } else if (!isTapped && wasTapped.current) {
      wasTapped.current = false;
      scale.setValue(1);
    }
  }, [isTapped, scale]);

  const { left, top } = spriteLT(pos.x, pos.y, size, stageW, stageH);
  const translateY = isIncoming
    ? enter.interpolate({
        inputRange: [0, 1],
        outputRange: [-60, 0],
      })
    : 0;

  return (
    <Pressable
      onPress={onTap}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={critterLabel(icon, lang)}
      style={{
        position: "absolute",
        left,
        top,
        width: size,
        height: size,
      }}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          opacity: enter,
          transform: [{ translateY }, { scale }],
        }}
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
          <View style={styles.badge} testID={badgeTestID}>
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
  choiceCorrect: {
    borderColor: colors.green,
    backgroundColor: "rgba(95,191,110,0.14)",
  },
  choiceText: { fontFamily: fonts.display, fontSize: 34, color: colors.ink },
  pressed: { transform: [{ scale: 0.94 }] },
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
    pointerEvents: "none",
  },
  badgeText: {
    color: colors.paper,
    fontFamily: fonts.display,
    fontSize: 14,
    lineHeight: 16,
  },
});
