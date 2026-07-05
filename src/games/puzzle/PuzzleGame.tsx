import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SCENE_IMAGES } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { TimerRing, useElapsed } from '../../components/TimerRing';
import { ScenePicker, SceneOption } from '../../components/ScenePicker';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty, DifficultyFilter, inFilter, settingsFor } from '../../difficulty';
import { manifest } from '../../manifest';
import { makeRng } from '../../rng';
import { colors, fonts, shadows } from '../../theme';
import { isSolved, makePuzzle, swap } from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  filter?: DifficultyFilter;
  sceneId?: string;
  onPickScene: (id: string) => void;
  onBackToPicker: () => void;
}

function puzzleOptions(filter: DifficultyFilter): SceneOption[] {
  return [
    ...manifest.diff.filter((d) => inFilter(d.level, filter))
      .map((d) => ({ id: `d-${d.id}`, name: d.name, image: d.imageA, flagged: d.flagged, level: d.level })),
    ...manifest.hidden.filter((h) => inFilter(h.level, filter))
      .map((h) => ({ id: `h-${h.id}`, name: h.name, image: h.image, flagged: h.flagged, level: h.level })),
  ];
}

export function PuzzleGame({ onHome, difficulty, filter = 'all', sceneId, onPickScene, onBackToPicker }: Props) {
  const options = puzzleOptions(filter);
  const picked = options.find((o) => o.id === sceneId) ?? null;
  const settings = settingsFor(difficulty);
  const cols = settings.puzzleCols;
  const rows = settings.puzzleRows;
  const size = cols * rows;

  const [perm, setPerm] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    if (picked) {
      setPerm(makePuzzle(makeRng(Math.floor(Math.random() * 1e9)), cols * rows));
      setSelected(null);
      setMoves(0);
    }
  }, [sceneId, cols, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const won = perm.length === size && isSolved(perm);
  const showTimer = settingsFor(difficulty).timer;
  const elapsed = useElapsed(showTimer && !won && !!picked, sceneId);

  const { width, height } = useWindowDimensions();

  if (!picked) {
    return (
      <GameShell title="Picture Puzzle" subtitle="Choose a picture" onBack={onHome}>
        <ScenePicker
          title="Which picture do you want to solve?"
          options={options}
          onPick={onPickScene}
          onSurprise={() => onPickScene(options[Math.floor(Math.random() * options.length)].id)}
        />
      </GameShell>
    );
  }

  // scene AR comes from the manifest (all scenes share W/H, but read it anyway)
  const srcScene =
    manifest.diff.find((d) => `d-${d.id}` === picked.id) ??
    manifest.hidden.find((h) => `h-${h.id}` === picked.id);
  const ar = srcScene ? srcScene.w / srcScene.h : 16 / 9;

  const availH = height - 84 - 44;
  const boardW = Math.min(width - 28, availH * ar, 1000);
  const boardH = boardW / ar;
  const tileW = boardW / cols;
  const tileH = boardH / rows;

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

  return (
    <GameShell
      title="Picture Puzzle"
      subtitle={`${picked.name} — tap two pieces to swap them`}
      onBack={onBackToPicker}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {showTimer ? <TimerRing elapsed={elapsed} size={44} stroke={5} showLabel testID="puzzle-timer" /> : null}
          <ScoreChip label={`🧩 ${moves}`} testID="puzzle-moves" />
        </View>
      }
    >
      <View style={styles.center}>
        <View style={[styles.board, shadows.sticker, { width: boardW, height: boardH }]}>
          {perm.map((piece, pos) => {
            const col = pos % cols;
            const row = Math.floor(pos / cols);
            const pCol = piece % cols;
            const pRow = Math.floor(piece / cols);
            return (
              <Pressable
                key={pos}
                testID={`puzzle-tile-${pos}-piece-${piece}`}
                onPress={() => onTile(pos)}
                style={[
                  styles.tile,
                  { left: col * tileW, top: row * tileH, width: tileW, height: tileH },
                  selected === pos && styles.selected,
                ]}
              >
                <Image
                  source={SCENE_IMAGES[picked.image]}
                  style={{
                    width: boardW,
                    height: boardH,
                    marginLeft: -pCol * tileW,
                    marginTop: -pRow * tileH,
                  }}
                />
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>Tap one piece, then tap another to swap them!</Text>
      </View>
      <WinOverlay
        visible={won}
        message={'Puzzle master! Amazing!'}
        onNext={() => {
          const ids = options.map((o) => o.id);
          onPickScene(ids[(ids.indexOf(picked.id) + 1) % ids.length]);
        }}
        onHome={onHome}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  board: { borderRadius: 18, overflow: 'hidden', backgroundColor: colors.card },
  tile: { position: 'absolute', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  selected: { borderWidth: 4, borderColor: colors.gold, zIndex: 2 },
  hint: {
    fontFamily: fonts.bodyReg,
    color: colors.inkSoft,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
});
