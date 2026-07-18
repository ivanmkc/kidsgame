import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { WinOverlay } from '../../components/WinOverlay';
import { SparkleBurst } from '../../components/Sparkles';
import { Difficulty } from '../../difficulty';
import { Lang } from '../../lang';
import { t } from '../../i18n';
import { makeRng } from '../../rng';
import { colors, fonts, shadows } from '../../theme';
import { sfx } from '../../sound';
import { playDrum, stopSequence } from '../../music';
import { useWinLine } from '../winlines';
import { makeSteadyBeatRound, roundsToWin, scoreTaps, passThreshold, SteadyBeatRound } from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

export function SteadyBeatGame({ onHome, difficulty, lang }: Props) {
  const total = roundsToWin(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState<SteadyBeatRound>(() => makeSteadyBeatRound(rngRef.current, difficulty));
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<'listen' | 'tap' | 'result'>('listen');
  const [tapTimesMs, setTapTimesMs] = useState<number[]>([]);
  const [startMs, setStartMs] = useState(0);
  const [hits, setHits] = useState(0);
  const [sparkKey, setSparkKey] = useState(0);
  const won = score >= total;
  useWinLine(won, t(lang, 'win.steadybeat' as never));

  const pulseAnim = useRef(new Animated.Value(0)).current;

  const startMetronome = useCallback((r: SteadyBeatRound) => {
    setPhase('listen');
    const beatMs = 60000 / r.bpm;
    let count = 0;
    const interval = setInterval(() => {
      playDrum(0.5);
      count++;
      if (count >= 4) {
        clearInterval(interval);
        setPhase('tap');
        setStartMs(performance.now());
        const tapBeatMs = 60000 / r.bpm;
        pulseAnim.setValue(0);
        Animated.loop(
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: tapBeatMs,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ).start();
      }
    }, beatMs);
    return () => clearInterval(interval);
  }, [pulseAnim]);

  useEffect(() => {
    if (!won) {
      setTapTimesMs([]);
      setHits(0);
      const cleanup = startMetronome(round);
      return () => { cleanup(); pulseAnim.stopAnimation(); };
    }
  }, [round, won]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'tap') return;
    const beatMs = 60000 / round.bpm;
    const totalTime = round.beatsPerRound * beatMs + 500;
    const timer = setTimeout(() => {
      pulseAnim.stopAnimation();
      const result = scoreTaps(round, tapTimesMs, startMs, difficulty);
      setHits(result.hits);
      setPhase('result');
      const threshold = passThreshold(difficulty);
      if (result.hits / result.total >= threshold) {
        sfx.good();
        setSparkKey((k) => k + 1);
        const nextScore = score + 1;
        setScore(nextScore);
        if (nextScore < total) {
          setTimeout(() => setRound(makeSteadyBeatRound(rngRef.current, difficulty)), 1200);
        }
      } else {
        sfx.wrong();
        setTimeout(() => setRound(makeSteadyBeatRound(rngRef.current, difficulty)), 1200);
      }
    }, totalTime);
    return () => clearTimeout(timer);
  }, [phase, startMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTap = () => {
    if (won || phase !== 'tap') return;
    playDrum();
    setTapTimesMs((prev) => [...prev, performance.now()]);
  };

  const reset = () => {
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setTapTimesMs([]);
    setHits(0);
    setRound(makeSteadyBeatRound(rngRef.current, difficulty));
  };

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 0.1, 0.5, 1],
    outputRange: [1.15, 1, 0.92, 1.15],
  });

  return (
    <GameShell
      title={t(lang, 'shell.steadybeat.title' as never)}
      subtitle={t(lang, 'shell.steadybeat.sub' as never)}
      onBack={onHome}
      lang={lang}
      right={<ScoreChip label={`💓 ${score}/${total}`} testID="steadybeat-score" />}
    >
      <View style={styles.board}>
        <View style={[styles.statusCard, shadows.soft]}>
          <Text style={styles.statusText}>
            {phase === 'listen' ? `👂 ${t(lang, 'music.listen' as never)}` :
             phase === 'result' ? `${hits}/${round.beatsPerRound} ⭐` :
             `${round.bpm} BPM`}
          </Text>
        </View>
        <Pressable
          onPress={onTap}
          testID="steadybeat-circle"
          disabled={phase !== 'tap'}
          style={({ pressed }) => [styles.circle, shadows.lifted, pressed && styles.circlePressed]}
        >
          <Animated.View
            style={[
              styles.pulse,
              phase === 'tap' && { transform: [{ scale: pulseScale }] },
            ]}
          >
            <Text style={styles.circleEmoji}>💓</Text>
          </Animated.View>
          <SparkleBurst trigger={sparkKey} count={6} size={14} />
        </Pressable>
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, 'win.steadybeat' as never)}
        onNext={reset}
        nextLabel={t(lang, 'overlay.playAgain')}
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, paddingHorizontal: 16 },
  statusCard: {
    backgroundColor: '#F7EDDA',
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.gold,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  statusText: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, textAlign: 'center' },
  circle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#9B7EDE',
    borderWidth: 6,
    borderColor: '#7A5BBF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePressed: { transform: [{ scale: 0.92 }] },
  pulse: { alignItems: 'center', justifyContent: 'center' },
  circleEmoji: { fontSize: 56 },
});
