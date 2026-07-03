import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GameShell } from '../../components/GameShell';
import { WinOverlay } from '../../components/WinOverlay';
import { makeRng } from '../../rng';
import { colors, shadows } from '../../theme';
import { DiffPuzzle, GRID_COLS, GRID_ROWS, NUM_DIFFS, SceneCell, buildPuzzle } from './logic';

interface Props {
  onHome: () => void;
  seed?: number;
}

export function DiffGame({ onHome, seed }: Props) {
  const [puzzle, setPuzzle] = useState<DiffPuzzle>(() => buildPuzzle(makeRng(seed ?? Math.floor(Math.random() * 1e9))));
  const [found, setFound] = useState<number[]>([]);
  const [wrongCell, setWrongCell] = useState<number | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const won = found.length === NUM_DIFFS;

  const onTapCell = (idx: number) => {
    if (won || found.includes(idx)) return;
    if (puzzle.diffs.includes(idx)) {
      setFound((f) => [...f, idx]);
    } else {
      setWrongCell(idx);
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => setWrongCell(null), 450);
    }
  };

  const reset = () => {
    setPuzzle(buildPuzzle(makeRng(Math.floor(Math.random() * 1e9))));
    setFound([]);
    setWrongCell(null);
  };

  return (
    <GameShell
      title="Find the Difference"
      subtitle={`Scene: ${puzzle.theme} — find ${NUM_DIFFS} differences!`}
      onBack={onHome}
      right={<Text style={styles.score} testID="diff-score">🔍 {found.length}/{NUM_DIFFS}</Text>}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Scene cells={puzzle.left} found={found} wrongCell={wrongCell} onTapCell={onTapCell} label="Picture A" testIDPrefix="left" />
        <Scene cells={puzzle.right} found={found} wrongCell={wrongCell} onTapCell={onTapCell} label="Picture B" testIDPrefix="right" />
      </ScrollView>
      <WinOverlay visible={won} message="You found every difference!" onPlayAgain={reset} onHome={onHome} />
    </GameShell>
  );
}

function Scene({
  cells,
  found,
  wrongCell,
  onTapCell,
  label,
  testIDPrefix,
}: {
  cells: SceneCell[];
  found: number[];
  wrongCell: number | null;
  onTapCell: (i: number) => void;
  label: string;
  testIDPrefix: string;
}) {
  const { width } = useWindowDimensions();
  const sceneW = Math.min(width - 24, 520);
  const cellW = sceneW / GRID_COLS;
  const cellH = cellW * 0.9;

  return (
    <View style={styles.sceneBlock}>
      <Text style={styles.sceneLabel}>{label}</Text>
      <View style={[styles.scene, shadows.card, { width: sceneW, height: cellH * GRID_ROWS }]}>
        {cells.map((cell, i) => {
          const col = i % GRID_COLS;
          const row = Math.floor(i / GRID_COLS);
          return (
            <Pressable
              key={i}
              onPress={() => onTapCell(i)}
              testID={`${testIDPrefix}-cell-${i}`}
              style={[
                styles.cell,
                { left: col * cellW, top: row * cellH, width: cellW, height: cellH },
                found.includes(i) && styles.found,
                wrongCell === i && styles.wrong,
              ]}
            >
              {cell.emoji ? (
                <Text
                  style={{
                    fontSize: 34 * cell.scale,
                    transform: [
                      { translateX: (cell.jx - 0.5) * cellW * 0.4 },
                      { translateY: (cell.jy - 0.5) * cellH * 0.4 },
                    ],
                  }}
                >
                  {cell.emoji}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  score: { fontSize: 18, fontWeight: '800', color: colors.text },
  scroll: { alignItems: 'center', paddingBottom: 24, gap: 10 },
  sceneBlock: { alignItems: 'center', gap: 4 },
  sceneLabel: { fontSize: 15, fontWeight: '700', color: '#999' },
  scene: {
    backgroundColor: colors.card,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cell: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  found: {
    borderWidth: 4,
    borderColor: colors.green,
    borderRadius: 999,
    backgroundColor: 'rgba(107,203,119,0.18)',
  },
  wrong: { backgroundColor: 'rgba(255,107,107,0.25)', borderRadius: 999 },
});
