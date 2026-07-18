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
import { playNote, stopSequence } from '../../music';
import { useWinLine } from '../winlines';
import { makeBellsRound, roundsToWin, checkSequence, BellsRound, Bell } from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

export function BellsGame({ onHome, difficulty, lang }: Props) {
  const total = roundsToWin(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState<BellsRound>(() => makeBellsRound(rngRef.current, difficulty));
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<'listen' | 'play'>('listen');
  const [glowIdx, setGlowIdx] = useState<number | null>(null);
  const [tapped, setTapped] = useState<number[]>([]);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [sparkKey, setSparkKey] = useState(0);
  const won = score >= total;
  useWinLine(won, t(lang, 'win.bells' as never));

  const playDemo = useCallback((r: BellsRound) => {
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
      setTimeout(() => { setGlowIdx(null); setTimeout(step, 200); }, 500);
    };
    setTimeout(step, 500);
  }, []);

  useEffect(() => {
    if (!won) {
      setTapped([]);
      playDemo(round);
    }
    return () => stopSequence();
  }, [round, won]); // eslint-disable-line react-hooks/exhaustive-deps

  const onBellTap = (idx: number) => {
    if (won || phase !== 'play') return;
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
          setTimeout(() => {
            const nr = makeBellsRound(rngRef.current, difficulty);
            setRound(nr);
          }, 600);
        }
      } else {
        sfx.wrong();
        setWrongFlash(true);
        setTimeout(() => {
          setWrongFlash(false);
          setTapped([]);
          playDemo(round);
        }, 800);
      }
    }
  };

  const reset = () => {
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setTapped([]);
    setWrongFlash(false);
    setRound(makeBellsRound(rngRef.current, difficulty));
  };

  const { width } = useWindowDimensions();
  const bellSize = Math.min(110, (Math.min(width - 40, 600) - (round.bells.length - 1) * 14) / round.bells.length);

  return (
    <GameShell
      title={t(lang, 'shell.bells.title' as never)}
      subtitle={t(lang, 'shell.bells.sub' as never)}
      onBack={onHome}
      lang={lang}
      right={<ScoreChip label={`🔔 ${score}/${total}`} testID="bells-score" />}
    >
      <View style={styles.board}>
        {phase === 'listen' ? (
          <View style={[styles.statusCard, shadows.soft]}>
            <Text style={styles.statusEmoji}>👂</Text>
            <Text style={styles.statusText}>{t(lang, 'music.listen' as never)}</Text>
          </View>
        ) : (
          <View style={[styles.statusCard, shadows.soft, wrongFlash && styles.wrongCard]}>
            <Text style={styles.statusText}>
              {t(lang, 'music.yourTurn' as never)} ({tapped.length}/{round.sequence.length})
            </Text>
          </View>
        )}
        <View style={styles.bellRow}>
          {round.bells.map((bell, i) => (
            <Pressable
              key={i}
              onPress={() => onBellTap(i)}
              testID={`bell-${i}`}
              style={({ pressed }) => [
                styles.bell,
                {
                  width: bellSize,
                  height: bellSize * 1.2,
                  backgroundColor: bell.color,
                  borderColor: glowIdx === i ? colors.gold : bell.color,
                },
                glowIdx === i && styles.bellGlow,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.bellText, { fontSize: bellSize * 0.4 }]}>🔔</Text>
              {glowIdx === i && <SparkleBurst trigger={sparkKey + i} count={4} size={12} />}
            </Pressable>
          ))}
        </View>
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, 'win.bells' as never)}
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
