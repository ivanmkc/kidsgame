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
import { playDrum, playDrumSequence, stopSequence } from '../../music';
import { useWinLine } from '../winlines';
import { makeEchoBeatRound, roundsToWin, checkEcho, EchoBeatRound } from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

export function EchoBeatGame({ onHome, difficulty, lang }: Props) {
  const total = roundsToWin(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState<EchoBeatRound>(() => makeEchoBeatRound(rngRef.current, difficulty));
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<'listen' | 'tap' | 'result'>('listen');
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [tapCount, setTapCount] = useState(0);
  const [result, setResult] = useState<'good' | 'bad' | null>(null);
  const [sparkKey, setSparkKey] = useState(0);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const won = score >= total;
  useWinLine(won, t(lang, 'win.echobeat' as never));

  const playDemo = useCallback((r: EchoBeatRound) => {
    stopSequence();
    setPhase('listen');
    playDrumSequence(r.gaps, undefined, () => setPhase('tap'));
  }, []);

  useEffect(() => {
    if (!won) {
      setTapTimes([]);
      setTapCount(0);
      setResult(null);
      playDemo(round);
    }
    return () => stopSequence();
  }, [round, won]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'tap' || tapCount === 0) return;
    if (resultTimer.current) clearTimeout(resultTimer.current);
    resultTimer.current = setTimeout(() => {
      const res = checkEcho(round, tapTimes, difficulty);
      if (res.countCorrect && res.timingCorrect) {
        sfx.good();
        setSparkKey((k) => k + 1);
        setResult('good');
        const nextScore = score + 1;
        setScore(nextScore);
        if (nextScore < total) {
          setTimeout(() => {
            setRound(makeEchoBeatRound(rngRef.current, difficulty));
          }, 800);
        }
      } else {
        sfx.wrong();
        setResult('bad');
        setTimeout(() => {
          setTapTimes([]);
          setTapCount(0);
          setResult(null);
          playDemo(round);
        }, 1000);
      }
    }, 1200);
    return () => { if (resultTimer.current) clearTimeout(resultTimer.current); };
  }, [tapCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTap = () => {
    if (won || phase !== 'tap') return;
    playDrum();
    const now = performance.now();
    setTapTimes((prev) => [...prev, now]);
    setTapCount((c) => c + 1);
  };

  const reset = () => {
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setTapTimes([]);
    setTapCount(0);
    setResult(null);
    setRound(makeEchoBeatRound(rngRef.current, difficulty));
  };

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (phase === 'tap' && tapCount > 0) {
      pulseAnim.setValue(1.25);
      Animated.spring(pulseAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    }
  }, [tapCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const earPulse = useRef(new Animated.Value(1)).current;
  const drumGlow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase === 'listen') {
      drumGlow.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(earPulse, { toValue: 1.18, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(earPulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      earPulse.stopAnimation();
      earPulse.setValue(1);
      if (phase === 'tap') {
        Animated.loop(
          Animated.sequence([
            Animated.timing(drumGlow, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(drumGlow, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ])
        ).start();
      }
    }
    return () => { earPulse.stopAnimation(); drumGlow.stopAnimation(); };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const drumScale = drumGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  const tapDots = [];
  const expectedHits = round.gaps.length + 1;
  for (let i = 0; i < expectedHits; i++) {
    tapDots.push(
      <View
        key={i}
        style={[styles.tapDot, i < tapCount && styles.tapDotFilled]}
      />
    );
  }

  return (
    <GameShell
      title={t(lang, 'shell.echobeat.title' as never)}
      subtitle={t(lang, 'shell.echobeat.sub' as never)}
      onBack={onHome}
      lang={lang}
      right={<ScoreChip label={`🥁 ${score}/${total}`} testID="echobeat-score" />}
    >
      <View style={styles.board}>
        {phase === 'listen' ? (
          <View style={[styles.statusCard, shadows.soft]}>
            <Animated.Text style={[styles.statusEmoji, { transform: [{ scale: earPulse }] }]}>👂</Animated.Text>
            <Text style={styles.statusText}>{t(lang, 'music.listen' as never)}</Text>
          </View>
        ) : (
          <View style={[styles.statusCard, shadows.soft, styles.yourTurnCard, result === 'bad' && styles.wrongCard]}>
            <Text style={styles.statusEmoji}>
              {result === 'good' ? '🎉' : result === 'bad' ? '🔄' : '👆'}
            </Text>
            <Text style={styles.statusText}>
              {result === 'good' ? '🎉' : result === 'bad' ? '🔄' : t(lang, 'music.yourTurn' as never)}
            </Text>
          </View>
        )}
        <Animated.View style={phase === 'tap' ? { transform: [{ scale: drumScale }] } : undefined}>
          <Pressable
            onPress={onTap}
            testID="echobeat-drum"
            disabled={phase !== 'tap'}
            style={({ pressed }) => [
              styles.drum,
              shadows.lifted,
              phase === 'listen' && styles.drumDimmed,
              phase === 'tap' && shadows.glowGold,
              pressed && styles.drumPressed,
            ]}
          >
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Text style={styles.drumEmoji}>🥁</Text>
            </Animated.View>
            <SparkleBurst trigger={sparkKey} count={6} size={14} />
          </Pressable>
        </Animated.View>
        {phase === 'tap' && <View style={styles.tapDotRow}>{tapDots}</View>}
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, 'win.echobeat' as never)}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  yourTurnCard: { borderColor: colors.green, backgroundColor: '#E8F5E9' },
  wrongCard: { borderColor: colors.red, backgroundColor: 'rgba(232,86,79,0.12)' },
  statusEmoji: { fontSize: 30 },
  statusText: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, textAlign: 'center' },
  drum: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#E8874F',
    borderWidth: 6,
    borderColor: '#C5693A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drumPressed: { transform: [{ scale: 0.92 }] },
  drumDimmed: { opacity: 0.45 },
  drumEmoji: { fontSize: 64 },
  tapDotRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  tapDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#C5693A',
    backgroundColor: 'transparent',
  },
  tapDotFilled: {
    backgroundColor: '#E8874F',
  },
});
