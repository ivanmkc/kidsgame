import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SCENE_IMAGES } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { ScenePicker, SceneOption } from '../../components/ScenePicker';
import { WinOverlay } from '../../components/WinOverlay';
import { manifest } from '../../manifest';
import { makeRng } from '../../rng';
import { colors, fonts, shadows } from '../../theme';
import { PUZZLE_N, isSolved, makePuzzle, swap } from './logic';

interface Props {
  onHome: () => void;
  playerName?: string;
}

function puzzleOptions(): SceneOption[] {
  return [
    ...manifest.diff.map((d) => ({ id: `diff-${d.id}`, name: d.name, image: d.imageA })),
    ...manifest.hidden.map((h) => ({ id: `hidden-${h.id}`, name: h.name, image: h.image })),
  ];
}

export function PuzzleGame({ onHome, playerName }: Props) {
  const options = puzzleOptions();
  const [picked, setPicked] = useState<SceneOption | null>(null);
  const [perm, setPerm] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const won = perm.length > 0 && isSolved(perm);

  const start = (opt: SceneOption) => {
    setPicked(opt);
    setPerm(makePuzzle(makeRng(Math.floor(Math.random() * 1e9))));
    setSelected(null);
    setMoves(0);
  };

  const onTile = (pos: number) => {
    if (won || perm.length === 0) return;
    if (selected === null) {
      setSelected(pos);
    } else if (selected === pos) {
      setSelected(null);
    } else {
      setPerm((p) => swap(p, selected, pos));
      setSelected(null);
      setMoves((m) => m + 1);
    }
  };

  const { width } = useWindowDimensions();
  const boardW = Math.min(width - 32, 480);
  const tileW = boardW / PUZZLE_N;
  const tileH = tileW * (768 / 1024);

  return (
    <GameShell
      title="Picture Puzzle"
      subtitle={picked ? `${picked.name} — tap two pieces to swap them` : 'Choose a picture'}
      onBack={picked ? () => setPicked(null) : onHome}
      right={picked ? <ScoreChip label={`🧩 ${moves}`} testID="puzzle-moves" /> : undefined}
    >
      {!picked ? (
        <ScenePicker title="Which picture do you want to solve?" options={options}
          onPick={(id) => { const o = options.find((x) => x.id === id); if (o) start(o); }}
          onSurprise={() => start(options[Math.floor(Math.random() * options.length)])}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.board, shadows.sticker, { width: boardW, height: tileH * PUZZLE_N }]}>
            {perm.map((piece, pos) => {
              const col = pos % PUZZLE_N;
              const row = Math.floor(pos / PUZZLE_N);
              const pCol = piece % PUZZLE_N;
              const pRow = Math.floor(piece / PUZZLE_N);
              return (
                <Pressable
                  key={pos}
                  testID={`puzzle-tile-${pos}-piece-${piece}`}
                  onPress={() => onTile(pos)}
                  style={[
                    styles.tile,
                    {
                      left: col * tileW,
                      top: row * tileH,
                      width: tileW,
                      height: tileH,
                    },
                    selected === pos && styles.selected,
                  ]}
                >
                  <Image
                    source={SCENE_IMAGES[picked.image]}
                    style={{
                      width: tileW * PUZZLE_N,
                      height: tileH * PUZZLE_N,
                      marginLeft: -pCol * tileW,
                      marginTop: -pRow * tileH,
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>Tap one piece, then tap another to swap them!</Text>
        </ScrollView>
      )}
      <WinOverlay
        visible={won}
        message={playerName ? `Puzzle master, ${playerName}!` : 'Puzzle complete!'}
        onPlayAgain={() => picked && start(picked)}
        onHome={onHome}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  scroll: { alignItems: 'center', paddingBottom: 24, paddingHorizontal: 14 },
  board: { borderRadius: 18, overflow: 'hidden', backgroundColor: colors.card },
  tile: { position: 'absolute', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  selected: { borderWidth: 4, borderColor: colors.gold, zIndex: 2 },
  hint: {
    fontFamily: fonts.bodyReg,
    color: colors.inkSoft,
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
});
