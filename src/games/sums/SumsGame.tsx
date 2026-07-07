import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SPOTIT_ICONS } from '../../assets/images';
import { spriteLT } from '../quizround/logic';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { TimerRing, useElapsed } from '../../components/TimerRing';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty, settingsFor } from '../../difficulty';
import { Lang, numberWord } from '../../lang';
import { t } from '../../i18n';
import { Position } from '../count/logic';
import { makeRng } from '../../rng';
import { colors, darken, fonts, shadows } from '../../theme';
import { sayThen, saySequence, sfx, say } from '../../sound';
import { PLUS, PRAISE, QUESTION, SumsRound, makeSumsRound, sumsSettings } from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

/**
 * Little Sums — a critters, then b more slide in. Kid picks the total.
 */
export function SumsGame({ onHome, difficulty, lang }: Props) {
  const { rounds: roundsToWin } = sumsSettings(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState<SumsRound>(() => makeSumsRound(rngRef.current, difficulty));
  const [score, setScore] = useState(0);
  const [wrongPick, setWrongPick] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const showTimer = settingsFor(difficulty).timer;
  const won = score >= roundsToWin;
  const elapsed = useElapsed(showTimer && !won, timerKey);

  // Speak "a plus b, how many now?" once per round object (repeat sums still
  // re-narrate — the round object identity changes even when the values collide).
  useEffect(() => {
    if (won) return;
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
    if (won) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < round.b; i++) {
      timers.push(setTimeout(() => sfx.boing(0.35), 400 + i * 250));
    }
    return () => timers.forEach(clearTimeout);
  }, [round, won]);

  const pickAnswer = (v: number) => {
    if (won || locked) return;
    if (v === round.sum) {
      sfx.good();
      setLocked(true);
      const nextScore = score + 1;
      setScore(nextScore);
      sayThen([numberWord(lang, round.sum).t, PRAISE[lang]], () => {
        if (nextScore < roundsToWin) {
          setRound(makeSumsRound(rngRef.current, difficulty));
          setWrongPick(null);
          setLocked(false);
        }
      });
    } else {
      sfx.wrong();
      setWrongPick(v);
      setTimeout(() => setWrongPick((w) => (w === v ? null : w)), 450);
      setTimeout(() => say(QUESTION[lang]), 500);
    }
  };

  const reset = () => {
    setTimerKey((k) => k + 1);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setRound(makeSumsRound(rngRef.current, difficulty));
    setScore(0);
    setWrongPick(null);
    setLocked(false);
  };

  const { width, height } = useWindowDimensions();
  const stageW = Math.min(width - 32, 560);
  const stageH = Math.min(height - 84 - 200, stageW * 0.72);
  const total = round.a + round.b;
  const critterSize = Math.min(Math.max(40, Math.min(70, stageW / (total <= 4 ? 5 : total <= 7 ? 6 : 7))), Math.max(30, stageH * 0.45));

  return (
    <GameShell
      title={t(lang, 'shell.sums.title')}
      subtitle={t(lang, 'shell.sums.sub')}
      onBack={onHome}
      lang={lang}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {showTimer ? <TimerRing elapsed={elapsed} size={44} stroke={5} showLabel testID="sums-timer" /> : null}
          <ScoreChip label={`➕ ${score}/${roundsToWin}`} testID="sums-score" />
        </View>
      }
    >
      <View style={styles.board}>
        <View
          style={[styles.stage, shadows.soft, { width: stageW, height: stageH }]}
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
        <View style={[styles.equation, shadows.soft]}>
          <Text style={styles.equationText}>
            {round.a} + {round.b} = ?
          </Text>
        </View>
        <View style={styles.choiceRow}>
          {round.choices.map((c) => (
            <Pressable
              key={c}
              onPress={() => pickAnswer(c)}
              testID={`sums-choice-${c}${c === round.sum ? '-answer' : ''}`}
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
      <WinOverlay
        visible={won}
        message={t(lang, 'win.sums')}
        onNext={reset}
        nextLabel={t(lang, 'overlay.playAgain')}
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

function StaticCritter({ icon, size, stageW, stageH, pos, testID }: CritterViewProps) {
  return (
    <Image
      source={SPOTIT_ICONS[icon]}
      testID={testID}
      style={{
        position: 'absolute',
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

function Incoming({ icon, size, stageW, stageH, pos, delay, testID }: IncomingProps) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: 420, delay, useNativeDriver: true }).start();
  }, [t, delay]);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] });
  return (
    <Animated.View
      testID={testID}
      style={{
        position: 'absolute',
        ...spriteLT(pos.x, pos.y, size, stageW, stageH),
        width: size,
        height: size,
        opacity: t,
        transform: [{ translateY }],
      }}
    >
      <Image source={SPOTIT_ICONS[icon]} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 16 },
  stage: {
    backgroundColor: colors.paper,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.blush,
    position: 'relative',
    overflow: 'hidden',
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
  choiceRow: { flexDirection: 'row', gap: 14 },
  choice: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.teal,
    paddingHorizontal: 26,
    paddingVertical: 14,
    minWidth: 74,
    alignItems: 'center',
  },
  choiceWrong: { borderColor: colors.red, backgroundColor: 'rgba(232,86,79,0.14)' },
  choiceText: { fontFamily: fonts.display, fontSize: 34, color: colors.ink },
  pressed: { transform: [{ scale: 0.94 }] },
});
