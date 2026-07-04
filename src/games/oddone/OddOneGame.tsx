import React, { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SPOTIT_ICONS } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { WinOverlay } from '../../components/WinOverlay';
import { settingsFor } from '../../difficulty';
import { manifest } from '../../manifest';
import { Player } from '../../profile';
import { makeRng } from '../../rng';
import { colors, fonts, shadows } from '../../theme';
import { OddKind, makeOddOneRound } from './logic';

interface Props {
  onHome: () => void;
  player: Player | null;
}

function oddSettings(p: Player | null): { n: number; kind: OddKind } {
  // easy: obviously different. medium: same-category cousin. hard: the SAME
  // sticker with one mirrored twin — genuine visual scrutiny.
  if (p?.difficulty === 'hard') return { n: 12, kind: 'mirrored' };
  if (p?.difficulty === 'medium') return { n: 9, kind: 'category' };
  return { n: 6, kind: 'different' };
}

export function OddOneGame({ onHome, player }: Props) {
  const roundsToWin = settingsFor(player?.difficulty).spotitRounds;
  const { n, kind } = oddSettings(player);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState(() => makeOddOneRound(rngRef.current, manifest.spotit.icons, n, kind));
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
        setRound(makeOddOneRound(rngRef.current, manifest.spotit.icons, n, kind));
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
    setRound(makeOddOneRound(rngRef.current, manifest.spotit.icons, n, kind));
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

  const subtitle =
    kind === 'mirrored' ? 'One sticker is flipped the wrong way!'
    : kind === 'category' ? 'One of these is a different friend!'
    : 'One of these is not like the others!';

  return (
    <GameShell
      title="Odd One Out"
      subtitle={subtitle}
      onBack={onHome}
      right={<ScoreChip label={`🔍 ${score}/${roundsToWin}`} testID="oddone-score" />}
    >
      <View style={styles.board}>
        <View style={[styles.grid, { width: cols * tile + (cols - 1) * gap, gap }]}>
          {round.items.map((item, i) => (
            <Pressable
              key={i}
              onPress={() => onPick(i)}
              testID={`oddone-item-${i}-${item.icon}${item.mirrored ? '-m' : ''}`}
              accessibilityLabel={item.icon}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.tile,
                shadows.soft,
                { width: tile, height: tile },
                wrongIdx === i && styles.wrong,
                pressed && styles.pressed,
              ]}
            >
              <Image
                source={SPOTIT_ICONS[item.icon]}
                style={{
                  width: '80%',
                  height: '80%',
                  transform: [{ scaleX: item.mirrored ? -1 : 1 }],
                }}
                resizeMode="contain"
              />
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>Tap the one that's different!</Text>
      </View>
      <WinOverlay
        visible={won}
        message={player ? `Super spotter, ${player.name}!` : 'You found them all!'}
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
