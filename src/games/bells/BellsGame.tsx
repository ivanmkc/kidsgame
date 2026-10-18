import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { WinOverlay } from '../../components/WinOverlay';
import { SparkleBurst } from '../../components/Sparkles';
import { Difficulty } from '../../difficulty';
import { Lang } from '../../lang';
import { t } from '../../i18n';
import { makeRng } from '../../rng';
import { colors, fonts, shadows } from '../../theme';
import { sfx } from '../../sound';
import { playNote, stopSequence } from '../../music';
import { useWinLine } from '../winlines';
import { makeBellsRound, roundsToWin, checkSequence, BellsRound, canTap } from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

export function BellsGame({ onHome, difficulty, lang }: Props) {
  const total = roundsToWin(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const demoTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [round, setRound] = useState<BellsRound>(() => makeBellsRound(rngRef.current, difficulty));
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<'listen' | 'play'>('listen');
  const [glowIdx, setGlowIdx] = useState<number | null>(null);
  const [tapped, setTapped] = useState<number[]>([]);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [sparkKey, setSparkKey] = useState(0);
  const won = score >= total;
  useWinLine(won, t(lang, 'win.bells'));

  const clearDemo = useCallback(() => {
    demoTimers.current.forEach(clearTimeout);
    demoTimers.current = [];
  }, []);

  const playDemo = useCallback((r: BellsRound) => {
    clearDemo();
    stopSequence();
    setPhase('listen');
    let i = 0;
    const step = () => {
      if (i >= r.sequence.length) {
        setGlowIdx(null);
        setPhase('play');
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
        }, 500)
      );
    };
    demoTimers.current.push(setTimeout(step, 500));
  }, [clearDemo]);

  useEffect(() => {
    if (!won) {
      setTapped([]);
      playDemo(round);
    }
    return () => {
      clearDemo();
      stopSequence();
    };
  }, [round, won]); // eslint-disable-line react-hooks/exhaustive-deps

  const onBellTap = (idx: number) => {
    if (!canTap(round, tapped, phase, won)) return;
    playNote(round.bells[idx].midi, 0.8);
    setGlowIdx(idx);
    setTimeout(() => setGlowIdx(null), 250);
    const next = [...tapped, idx];
    setTapped(next);
    if (next.length === round.sequence.length) {
      if (checkSequence(round, next)) {
        sfx.good();
        setSparkKey((k) => k + 1);
        const nextScore = score + 1;
        setScore(nextScore);
        if (nextScore < total) {
          demoTimers.current.push(setTimeout(() => {
            const nr = makeBellsRound(rngRef.current, difficulty);
            setRound(nr);
          }, 600));
        }
      } else {
        sfx.wrong();
        setWrongFlash(true);
        demoTimers.current.push(setTimeout(() => {
          setWrongFlash(false);
          setTapped([]);
          playDemo(round);
        }, 800));
      }
    }
  };

  const reset = () => {
    clearDemo();
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setTapped([]);
    setWrongFlash(false);
    setRound(makeBellsRound(rngRef.current, difficulty));
  };

  const { width } = useWindowDimensions();
  const bellSize = Math.min(110, (Math.min(width - 40, 600) - (round.bells.length - 1) * 14) / round.bells.length);

  const earPulse = useRef(new Animated.Value(1)).current;
  const bellBounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (won) return;
    if (phase === 'listen') {
      bellBounce.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(earPulse, { toValue: 1.18, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(earPulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      earPulse.stopAnimation();
      earPulse.setValue(1);
      Animated.loop(
        Animated.sequence([
          Animated.timing(bellBounce, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(bellBounce, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    }
    return () => { earPulse.stopAnimation(); bellBounce.stopAnimation(); };
  }, [phase, won]); // eslint-disable-line react-hooks/exhaustive-deps

  const bellScale = bellBounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <GameShell
      title={t(lang, 'shell.bells.title')}
      subtitle={t(lang, 'shell.bells.sub')}
      onBack={onHome}
      lang={lang}
      right={<ScoreChip label={`🔔 ${score}/${total}`} testID="bells-score" />}
    >
      <View style={styles.board}>
        {!won && (
          phase === 'listen' ? (
            <View style={[styles.statusCard, shadows.soft]}>
              <Animated.Text style={[styles.statusEmoji, { transform: [{ scale: earPulse }] }]}>👂</Animated.Text>
              <Text style={styles.statusText}>{t(lang, 'music.listen')}</Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              testID="replay-button"
              onPress={() => {
                if (canTap(round, tapped, phase, won)) {
                  setTapped([]);
                  playDemo(round);
                }
              }}
              style={({ pressed }) => [
                styles.statusCard,
                shadows.soft,
                styles.yourTurnCard,
                wrongFlash && styles.wrongCard,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.statusEmoji}>👆</Text>
              <Text style={styles.statusText}>
                {t(lang, 'music.yourTurn')} ({tapped.length}/{round.sequence.length})
              </Text>
            </Pressable>
          )
        )}
        <View style={styles.bellRow}>
          {round.bells.map((bell, i) => (
            <Animated.View
              key={i}
              style={phase === 'play' ? { transform: [{ scale: bellScale }] } : undefined}
            >
              <Pressable
                onPress={() => onBellTap(i)}
                testID={`bell-${i}`}
                style={({ pressed }) => [
                  styles.bell,
                  {
                    width: bellSize,
                    height: bellSize * 1.2,
                    backgroundColor: bell.color,
                    borderColor: glowIdx === i ? colors.gold : bell.color,
                    opacity: phase === 'listen' && glowIdx !== i ? 0.5 : 1,
                  },
                  glowIdx === i && styles.bellGlow,
                  phase === 'play' && shadows.glowGold,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.bellText, { fontSize: bellSize * 0.4 }]}>🔔</Text>
                {glowIdx === i && <SparkleBurst trigger={sparkKey + i} count={4} size={12} />}
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, 'win.bells')}
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
  statusText: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  bellRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-end' },
  bell: {
    borderRadius: 20,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  bellGlow: {
    shadowColor: '#FFC24B',
    shadowOpacity: 0.6,
    shadowRadius: 16,
  },
  bellText: { textAlign: 'center' },
  pressed: { transform: [{ scale: 0.92 }] },
});
