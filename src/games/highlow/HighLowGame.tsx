import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { WinOverlay } from '../../components/WinOverlay';
import { SparkleBurst } from '../../components/Sparkles';
import { Difficulty } from '../../difficulty';
import { Lang } from '../../lang';
import { t } from '../../i18n';
import { makeRng } from '../../rng';
import { colors, fonts, shadows } from '../../theme';
import { sfx } from '../../sound';
import { playNote, playSequence, stopSequence } from '../../music';
import { useWinLine } from '../winlines';
import { makeHighLowRound, roundsToWin, HighLowRound, getHighNote, getLowNote } from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

export function HighLowGame({ onHome, difficulty, lang }: Props) {
  const total = roundsToWin(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState<HighLowRound>(() => makeHighLowRound(rngRef.current, difficulty));
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<'listen' | 'pick'>('listen');
  const [wrongPick, setWrongPick] = useState<'high' | 'low' | null>(null);
  const [sparkKey, setSparkKey] = useState(0);
  const won = score >= total;
  useWinLine(won, t(lang, 'win.highlow' as never));

  const playRound = useCallback((r: HighLowRound) => {
    stopSequence();
    const notes = [
      { m: r.noteA, b: 2 },
      { m: r.noteB, b: 2 },
    ];
    playSequence(notes, 80, undefined, () => setPhase('pick'));
  }, []);

  useEffect(() => {
    if (!won) {
      setPhase('listen');
      const timer = setTimeout(() => playRound(round), 400);
      return () => { clearTimeout(timer); stopSequence(); };
    }
  }, [round, won]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (picked: 'high' | 'low') => {
    if (won || phase !== 'pick') return;
    const highNote = getHighNote(round);
    const lowNote = getLowNote(round);
    const isRight = (picked === 'high' && round.answer === 'high') ||
                    (picked === 'low' && round.answer === 'low');
    if (isRight) {
      sfx.good();
      setSparkKey((k) => k + 1);
      const next = score + 1;
      setScore(next);
      setWrongPick(null);
      if (next < total) {
        setRound(makeHighLowRound(rngRef.current, difficulty));
      }
    } else {
      sfx.wrong();
      setWrongPick(picked);
      setTimeout(() => setWrongPick(null), 500);
    }
  };

  const reset = () => {
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setWrongPick(null);
    setRound(makeHighLowRound(rngRef.current, difficulty));
  };

  const replay = () => {
    if (phase === 'pick') {
      setPhase('listen');
      playRound(round);
    }
  };

  return (
    <GameShell
      title={t(lang, 'shell.highlow.title' as never)}
      subtitle={t(lang, 'shell.highlow.sub' as never)}
      onBack={onHome}
      lang={lang}
      right={<ScoreChip label={`🎵 ${score}/${total}`} testID="highlow-score" />}
    >
      <View style={styles.board}>
        {phase === 'listen' ? (
          <View style={[styles.listenCard, shadows.soft]}>
            <Text style={styles.listenEmoji}>👂</Text>
            <Text style={styles.listenText}>{t(lang, 'music.listen' as never)}</Text>
          </View>
        ) : (
          <View style={styles.pickRow}>
            <Pressable
              onPress={() => onPick('high')}
              testID="highlow-high"
              style={({ pressed }) => [
                styles.pickBtn,
                { backgroundColor: '#E3EEFB', borderColor: '#5DA9E8' },
                wrongPick === 'high' && styles.wrong,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.pickEmoji}>🐦</Text>
              <Text style={[styles.pickLabel, { color: '#5DA9E8' }]}>
                {t(lang, 'music.high' as never)}
              </Text>
              <SparkleBurst trigger={round.answer === 'high' ? sparkKey : 0} count={5} size={14} />
            </Pressable>
            <Pressable
              onPress={replay}
              testID="highlow-replay"
              style={({ pressed }) => [styles.replayBtn, shadows.soft, pressed && styles.pressed]}
            >
              <Text style={styles.replayText}>🔊</Text>
            </Pressable>
            <Pressable
              onPress={() => onPick('low')}
              testID="highlow-low"
              style={({ pressed }) => [
                styles.pickBtn,
                { backgroundColor: '#FFF0E5', borderColor: '#E8874F' },
                wrongPick === 'low' && styles.wrong,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.pickEmoji}>🐻</Text>
              <Text style={[styles.pickLabel, { color: '#E8874F' }]}>
                {t(lang, 'music.low' as never)}
              </Text>
              <SparkleBurst trigger={round.answer === 'low' ? sparkKey : 0} count={5} size={14} />
            </Pressable>
          </View>
        )}
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, 'win.highlow' as never)}
        onNext={reset}
        nextLabel={t(lang, 'overlay.playAgain')}
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  listenCard: {
    backgroundColor: '#F7EDDA',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.gold,
    paddingVertical: 32,
    paddingHorizontal: 40,
    alignItems: 'center',
    gap: 12,
  },
  listenEmoji: { fontSize: 56 },
  listenText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  pickBtn: {
    borderRadius: 28,
    borderWidth: 4,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 8,
    minWidth: 130,
    ...shadows.soft,
  },
  pickEmoji: { fontSize: 56 },
  pickLabel: { fontFamily: fonts.display, fontSize: 22 },
  wrong: { borderColor: colors.red, backgroundColor: 'rgba(232,86,79,0.12)' },
  pressed: { transform: [{ scale: 0.94 }] },
  replayBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replayText: { fontSize: 28 },
});
