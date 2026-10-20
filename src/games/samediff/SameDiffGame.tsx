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
import { playSequence, stopSequence } from '../../music';
import { useWinLine } from '../winlines';
import { makeSameDiffRound, roundsToWin, isCorrect, SameDiffRound, phrasePitchRatios } from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

export function SameDiffGame({ onHome, difficulty, lang }: Props) {
  const total = roundsToWin(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState<SameDiffRound>(() => makeSameDiffRound(rngRef.current, difficulty));
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<'listenA' | 'listenB' | 'pick'>('listenA');
  const [activeNote, setActiveNote] = useState<number | null>(null);
  const [wrongPick, setWrongPick] = useState<'same' | 'different' | null>(null);
  const [sparkKey, setSparkKey] = useState(0);
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const won = score >= total;
  useWinLine(won, t(lang, 'win.samediff' as never));

  const playRound = useCallback((r: SameDiffRound) => {
    stopSequence();
    if (gapTimer.current) clearTimeout(gapTimer.current);
    setActiveNote(null);
    setPhase('listenA');
    playSequence(
      r.phraseA,
      120,
      (idx) => setActiveNote(idx),
      () => {
        setActiveNote(null);
        setPhase('listenB');
        gapTimer.current = setTimeout(() => {
          playSequence(
            r.phraseB,
            120,
            (idx) => setActiveNote(idx),
            () => {
              setActiveNote(null);
              setPhase('pick');
            },
          );
        }, 600);
      },
    );
  }, []);

  useEffect(() => {
    if (!won) {
      const timer = setTimeout(() => playRound(round), 400);
      return () => {
        clearTimeout(timer);
        if (gapTimer.current) clearTimeout(gapTimer.current);
        stopSequence();
      };
    }
  }, [round, won]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (picked: 'same' | 'different') => {
    if (won || phase !== 'pick') return;
    if (isCorrect(round, picked)) {
      sfx.good();
      setSparkKey((k) => k + 1);
      const next = score + 1;
      setScore(next);
      setWrongPick(null);
      if (next < total) {
        setRound(makeSameDiffRound(rngRef.current, difficulty));
      }
    } else {
      sfx.wrong();
      setWrongPick(picked);
      setTimeout(() => setWrongPick(null), 500);
    }
  };

  const replay = () => {
    if (phase === 'pick') playRound(round);
  };

  const reset = () => {
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setWrongPick(null);
    setActiveNote(null);
    setRound(makeSameDiffRound(rngRef.current, difficulty));
  };


  const earPulse = useRef(new Animated.Value(1)).current;
  const pickGlow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase !== 'pick') {
      pickGlow.setValue(0);
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
          Animated.timing(pickGlow, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pickGlow, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    }
    return () => { earPulse.stopAnimation(); pickGlow.stopAnimation(); };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickScale = pickGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const ratiosA = phrasePitchRatios(round, round.phraseA);
  const ratiosB = phrasePitchRatios(round, round.phraseB);

  return (
    <GameShell
      title={t(lang, 'shell.samediff.title' as never)}
      subtitle={t(lang, 'shell.samediff.sub' as never)}
      onBack={onHome}
      lang={lang}
      right={<ScoreChip label={`🎧 ${score}/${total}`} testID="samediff-score" />}
    >
      <View style={styles.board}>
        {phase !== 'pick' ? (
          <View style={[styles.listenCard, shadows.soft]}>
            <Animated.Text style={[styles.listenEmoji, { transform: [{ scale: earPulse }] }]}>👂</Animated.Text>
            <View style={styles.melodyRows}>
              <View style={styles.melodyRow} testID="melody-row-0">
                <View testID="melody-dot-0" style={[styles.melodyDot, (phase === 'listenA' || phase === 'listenB') && styles.melodyDotFilled]} />
                <View testID="melody-notes-0" style={styles.phraseNotesTrack}>
                  {ratiosA.map((ratio, i) => {
                    const isNoteActive = phase === 'listenA' && activeNote === i;
                    const stemHeight = Math.round(6 + ratio * 20);
                    return (
                      <View
                        key={i}
                        testID={`melody-0-note-${i}`}
                        aria-selected={isNoteActive}
                        style={styles.noteCueCol}
                      >
                        <View
                          testID={`melody-0-dot-${i}${isNoteActive ? '-active' : ''}`}
                          style={[
                            styles.noteDot,
                            isNoteActive && styles.noteDotActive,
                          ]}
                        />
                        <View
                          testID={`melody-0-stem-${i}`}
                          style={[
                            styles.noteStem,
                            { height: stemHeight },
                            isNoteActive && styles.noteStemActive,
                          ]}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
              <View style={styles.melodyRow} testID="melody-row-1">
                <View testID="melody-dot-1" style={[styles.melodyDot, phase === 'listenB' && styles.melodyDotFilled]} />
                <View testID="melody-notes-1" style={styles.phraseNotesTrack}>
                  {phase === 'listenB' ? (
                    ratiosB.map((ratio, i) => {
                      const isNoteActive = phase === 'listenB' && activeNote === i;
                      const stemHeight = Math.round(6 + ratio * 20);
                      return (
                        <View
                          key={i}
                          testID={`melody-1-note-${i}`}
                          aria-selected={isNoteActive}
                          style={styles.noteCueCol}
                        >
                          <View
                            testID={`melody-1-dot-${i}${isNoteActive ? '-active' : ''}`}
                            style={[
                              styles.noteDot,
                              isNoteActive && styles.noteDotActive,
                            ]}
                          />
                          <View
                            testID={`melody-1-stem-${i}`}
                            style={[
                              styles.noteStem,
                              { height: stemHeight },
                              isNoteActive && styles.noteStemActive,
                            ]}
                          />
                        </View>
                      );
                    })
                  ) : (
                    [0, 1, 2].map((i) => (
                      <View key={i} testID={`melody-1-placeholder-${i}`} style={styles.noteCueCol}>
                        <View style={styles.notePlaceholder} />
                      </View>
                    ))
                  )}
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.pickRow}>
            <Animated.View style={{ transform: [{ scale: pickScale }] }}>
              <Pressable
                onPress={() => onPick('same')}
                testID="samediff-same"
                accessibilityRole="button"
                accessibilityLabel={t(lang, 'music.same')}
                style={({ pressed }) => [
                  styles.pickBtn,
                  { backgroundColor: '#E8F5E9', borderColor: '#5FBF6E' },
                  shadows.glowGold,
                  wrongPick === 'same' && styles.wrong,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.pickEmoji}>👯</Text>
                <Text style={[styles.pickLabel, { color: '#5FBF6E' }]}>
                  {t(lang, 'music.same' as never)}
                </Text>
                <SparkleBurst trigger={round.answer === 'same' ? sparkKey : 0} count={5} size={14} />
              </Pressable>
            </Animated.View>
            <Pressable
              onPress={replay}
              testID="samediff-replay"
              accessibilityRole="button"
              accessibilityLabel={t(lang, 'spell.hearAgain')}
              style={({ pressed }) => [styles.replayBtn, shadows.soft, pressed && styles.pressed]}
            >
              <Text style={styles.replayText}>🔊</Text>
            </Pressable>
            <Animated.View style={{ transform: [{ scale: pickScale }] }}>
              <Pressable
                onPress={() => onPick('different')}
                testID="samediff-diff"
                accessibilityRole="button"
                accessibilityLabel={t(lang, 'music.different')}
                style={({ pressed }) => [
                  styles.pickBtn,
                  { backgroundColor: '#FEF3E8', borderColor: '#E89B4F' },
                  shadows.glowGold,
                  wrongPick === 'different' && styles.wrong,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.pickEmoji}>🙅</Text>
                <Text style={[styles.pickLabel, { color: '#E89B4F' }]}>
                  {t(lang, 'music.different' as never)}
                </Text>
                <SparkleBurst trigger={round.answer === 'different' ? sparkKey : 0} count={5} size={14} />
              </Pressable>
            </Animated.View>
          </View>
        )}
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, 'win.samediff' as never)}
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
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 12,
  },
  listenEmoji: { fontSize: 56 },
  melodyRows: { flexDirection: 'column', gap: 10, alignItems: 'center' },
  melodyRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  melodyDotRow: { flexDirection: 'row', gap: 12 },
  melodyDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: 'transparent',
  },
  melodyDotFilled: { backgroundColor: colors.gold },
  phraseNotesTrack: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 44,
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E8DBC5',
  },
  noteCueCol: {
    width: 26,
    height: 40,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  noteDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  noteDotActive: {
    backgroundColor: colors.green,
    borderColor: colors.ink,
    transform: [{ scale: 1.25 }],
  },
  noteStem: {
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.inkSoft,
  },
  noteStemActive: {
    backgroundColor: colors.green,
    width: 5,
  },
  notePlaceholder: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#CBBFA8',
    borderStyle: 'dashed',
    marginBottom: 12,
  },
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
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replayText: { fontSize: 36 },
});
