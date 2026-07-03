import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GameShell } from '../../components/GameShell';
import { WinOverlay } from '../../components/WinOverlay';
import { makeRng } from '../../rng';
import { colors, shadows } from '../../theme';
import { HIDDEN_COLS, HIDDEN_ROWS, HiddenPuzzle, buildHiddenPuzzle } from './logic';

interface Props {
  onHome: () => void;
  seed?: number;
}

export function HiddenGame({ onHome, seed }: Props) {
  const [puzzle, setPuzzle] = useState<HiddenPuzzle>(() =>
    buildHiddenPuzzle(makeRng(seed ?? Math.floor(Math.random() * 1e9)))
  );
  const [found, setFound] = useState<string[]>([]);
  const [wrongCell, setWrongCell] = useState<number | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const won = found.length === puzzle.targets.length;

  const onTapCell = (idx: number) => {
    if (won) return;
    const cell = puzzle.cells[idx];
    if (cell.isTarget && !found.includes(cell.emoji)) {
      setFound((f) => [...f, cell.emoji]);
    } else if (!cell.isTarget) {
      setWrongCell(idx);
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => setWrongCell(null), 450);
    }
  };

  const reset = () => {
    setPuzzle(buildHiddenPuzzle(makeRng(Math.floor(Math.random() * 1e9))));
    setFound([]);
    setWrongCell(null);
  };

  const { width } = useWindowDimensions();
  const sceneW = Math.min(width - 24, 520);
  const cellW = sceneW / HIDDEN_COLS;
  const cellH = cellW * 0.95;

  return (
    <GameShell
      title="Hidden Objects"
      subtitle={`Scene: ${puzzle.scene} — find all of these!`}
      onBack={onHome}
      right={<Text style={styles.score} testID="hidden-score">🔎 {found.length}/{puzzle.targets.length}</Text>}
    >
      <View style={styles.checklist} testID="hidden-checklist">
        {puzzle.targets.map((t) => (
          <View key={t} style={[styles.chip, found.includes(t) && styles.chipFound]}>
            <Text style={styles.chipEmoji}>{t}</Text>
            {found.includes(t) ? <Text style={styles.chipCheck}>✔️</Text> : null}
          </View>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.scene, shadows.card, { width: sceneW, height: cellH * HIDDEN_ROWS }]}>
          {puzzle.cells.map((cell, i) => {
            const col = i % HIDDEN_COLS;
            const row = Math.floor(i / HIDDEN_COLS);
            const isFoundTarget = cell.isTarget && found.includes(cell.emoji);
            return (
              <Pressable
                key={i}
                onPress={() => onTapCell(i)}
                testID={`hidden-cell-${i}`}
                style={[
                  styles.cell,
                  { left: col * cellW, top: row * cellH, width: cellW, height: cellH },
                  isFoundTarget && styles.found,
                  wrongCell === i && styles.wrong,
                ]}
              >
                <Text
                  style={{
                    fontSize: 30 * cell.scale,
                    transform: [
                      { translateX: (cell.jx - 0.5) * cellW * 0.5 },
                      { translateY: (cell.jy - 0.5) * cellH * 0.5 },
                      { rotate: `${cell.rot}deg` },
                    ],
                  }}
                >
                  {cell.emoji}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <WinOverlay visible={won} message="You found everything!" onPlayAgain={reset} onHome={onHome} />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  score: { fontSize: 18, fontWeight: '800', color: colors.text },
  checklist: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
    borderWidth: 2,
    borderColor: colors.soft,
  },
  chipFound: { borderColor: colors.green, backgroundColor: 'rgba(107,203,119,0.15)' },
  chipEmoji: { fontSize: 24 },
  chipCheck: { fontSize: 14 },
  scroll: { alignItems: 'center', paddingBottom: 24 },
  scene: { backgroundColor: colors.card, borderRadius: 20, overflow: 'hidden' },
  cell: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  found: {
    borderWidth: 4,
    borderColor: colors.green,
    borderRadius: 999,
    backgroundColor: 'rgba(107,203,119,0.18)',
  },
  wrong: { backgroundColor: 'rgba(255,107,107,0.25)', borderRadius: 999 },
});
