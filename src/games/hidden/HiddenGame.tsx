import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SCENE_IMAGES } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { ScenePicker } from '../../components/ScenePicker';
import { TapScene } from '../../components/TapScene';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty } from '../../difficulty';
import { manifest } from '../../manifest';
import { colors, fonts, shadows } from '../../theme';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  sceneId?: string;
  onPickScene: (id: string) => void;
  onBackToPicker: () => void;
}

export function HiddenGame({ onHome, difficulty, sceneId, onPickScene, onBackToPicker }: Props) {
  const scene = manifest.hidden.find((h) => h.id === sceneId) ?? null;
  const [found, setFound] = useState<string[]>([]);

  useEffect(() => setFound([]), [sceneId]);

  const { width, height } = useWindowDimensions();

  if (!scene) {
    return (
      <GameShell title="Hidden Objects" subtitle="Choose a scene" onBack={onHome}>
        <ScenePicker
          title="Where do you want to search?"
          options={manifest.hidden.map((h) => ({ id: h.id, name: h.name, image: h.image, flagged: h.flagged }))}
          onPick={onPickScene}
          onSurprise={() => onPickScene(manifest.hidden[Math.floor(Math.random() * manifest.hidden.length)].id)}
        />
      </GameShell>
    );
  }

  const total = scene.targets.length;
  const won = found.length === total && total > 0;
  const boxes = scene.targets.map((t) => ({ id: t.id, box: t }));
  const ar = scene.w / scene.h;

  // Checklist row (~86px) + header — fit the scene into what's left.
  const availH = height - 84 - 122;
  const sceneWidth = Math.min(width - 24, availH * ar, 1100);

  const onHit = (id: string) => {
    if (won) return;
    setFound((f) => (f.includes(id) ? f : [...f, id]));
  };

  return (
    <GameShell
      title="Hidden Objects"
      subtitle={`${scene.name} — can you find all of these?`}
      onBack={onBackToPicker}
      right={<ScoreChip label={`🔎 ${found.length}/${total}`} testID="hidden-score" />}
    >
      <View style={styles.checklist} testID="hidden-checklist">
        {scene.targets.map((t) => {
          const done = found.includes(t.id);
          return (
            <View key={t.id} style={[styles.chip, shadows.soft, done && styles.chipFound]} testID={`checklist-${t.id}`}>
              <Image source={SCENE_IMAGES[t.thumb]} style={styles.chipImg} resizeMode="contain" />
              {done ? (
                <View style={styles.chipCheck}>
                  <Text style={styles.chipCheckText}>✔️</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TapScene
          source={SCENE_IMAGES[scene.image]}
          sceneW={scene.w}
          sceneH={scene.h}
          displayWidth={sceneWidth}
          boxes={boxes}
          foundIds={found}
          onHit={onHit}
          onMiss={() => {}}
          testIDPrefix="hidden"
        />
      </ScrollView>
      <WinOverlay
        visible={won}
        message={'Super detective! You found everything!'}
        onPlayAgain={onBackToPicker}
        onHome={onHome}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  checklist: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
    flexWrap: 'wrap',
  },
  chip: {
    width: 92,
    height: 92,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.card,
    backgroundColor: colors.paper,
    overflow: 'hidden',
    padding: 5,
  },
  chipFound: { borderColor: colors.green },
  chipImg: { width: '100%', height: '100%' },
  chipCheck: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(95,191,110,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCheckText: { fontSize: 24 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 12, paddingHorizontal: 12 },
});
