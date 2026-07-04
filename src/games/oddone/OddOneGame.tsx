import React, { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SPOTIT_ICONS } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty, settingsFor } from '../../difficulty';
import { manifest } from '../../manifest';
import { makeRng } from '../../rng';
import { colors, fonts, shadows } from '../../theme';
import { makeOddOneRound } from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
}

function oddSettings(d: Difficulty): { n: number } {
  // "which one does not belong?" — always categorical; harder = more items
  if (d === 'hard') return { n: 9 };
  if (d === 'medium') return { n: 6 };
  return { n: 4 };
}

export function OddOneGame({ onHome, difficulty }: Props) {
  const roundsToWin = settingsFor(difficulty).spotitRounds;
  const { n } = oddSettings(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState(() => makeOddOneRound(rngRef.current, manifest.spotit.icons, n));
  const [score, setScore] = useState(0);
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const won = score >= roundsToWin;

  const onPick = (idx: number) => {
    if (won) return;
    if (idx === round.oddIndex) {
      const next = score + 1;
      setScore(next);
      setWrongIdx(null);
      if (next < roundsToWin) {
        setRound(makeOddOneRound(rngRef.current, manifest.spotit.icons, n));
      }
    } else {
      setWrongIdx(idx);
      setTimeout(() => setWrongIdx((w) => (w === idx ? null : w)), 450);
    }
  };

  const reset = () => {
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setWrongIdx(null);
    setRound(makeOddOneRound(rngRef.current, manifest.spotit.icons, n));
  };

  const { width, height } = useWindowDimensions();
  const cols = n <= 6 ? 3 : n <= 9 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const gap = 12;
  const tile = Math.min(
    (Math.min(width - 32, 600) - (cols - 1) * gap) / cols,
    (height - 84 - 90 - (rows - 1) * gap) / rows,
    150
  );

  const subtitle = 'Which one does NOT belong?';

  return (
    <GameShell
      title="Odd One Out"
      subtitle={subtitle}
      onBack={onHome}
      right={<ScoreChip label={`🔍 ${score}/${roundsToWin}`} testID="oddone-score" />}
    >
      <View style={styles.board}>
        <View style={[styles.grid, { width: cols * tile + (cols - 1) * gap, gap }]}>
          {round.items.map((icon, i) => (
            <Pressable
              key={`${score}-${i}`}
              onPress={() => onPick(i)}
              testID={`oddone-item-${i}-${icon}${i === round.oddIndex ? '-odd' : ''}`}
              accessibilityLabel={icon}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.tile,
                shadows.soft,
                { width: tile, height: tile },
                wrongIdx === i && styles.wrong,
                pressed && styles.pressed,
              ]}
            >
              <Image source={SPOTIT_ICONS[icon]} style={{ width: '80%', height: '80%' }} resizeMode="contain" />
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>Tap the one that's different!</Text>
      </View>
      <WinOverlay
        visible={won}
        message={'Super spotter! You found them all!'}
        onPlayAgain={reset}
        onHome={onHome}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  tile: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrong: { borderColor: colors.red, backgroundColor: 'rgba(232,86,79,0.15)' },
  pressed: { transform: [{ scale: 0.94 }] },
  hint: { fontFamily: fonts.bodyReg, color: colors.inkSoft, fontSize: 14 },
});
