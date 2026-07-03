import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { SCENE_IMAGES } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { ScenePicker } from '../../components/ScenePicker';
import { TapScene } from '../../components/TapScene';
import { WinOverlay } from '../../components/WinOverlay';
import { DiffScene, manifest } from '../../manifest';
import { colors, fonts } from '../../theme';

interface Props {
  onHome: () => void;
  playerName?: string;
}

export function DiffGame({ onHome, playerName }: Props) {
  const [scene, setScene] = useState<DiffScene | null>(null);
  const [found, setFound] = useState<string[]>([]);

  const start = (s: DiffScene) => {
    setScene(s);
    setFound([]);
  };

  const { width } = useWindowDimensions();
  const sceneWidth = Math.min(width - 28, 560);

  if (!scene) {
    return (
      <GameShell title="Find the Difference" subtitle="Choose a scene" onBack={onHome}>
        <ScenePicker
          title="Where do you want to play?"
          options={manifest.diff.map((d) => ({ id: d.id, name: d.name, image: d.imageA }))}
          onPick={(id) => { const s = manifest.diff.find((d) => d.id === id); if (s) start(s); }}
          onSurprise={() => start(manifest.diff[Math.floor(Math.random() * manifest.diff.length)])}
        />
      </GameShell>
    );
  }

  const total = scene.diffs.length;
  const won = found.length === total && total > 0;
  const boxes = scene.diffs.map((d, i) => ({ id: String(i), box: d }));
  const onHit = (id: string) => {
    if (won) return;
    setFound((f) => (f.includes(id) ? f : [...f, id]));
  };

  return (
    <GameShell
      title="Find the Difference"
      subtitle={`${scene.name} — ${total} sneaky changes hide in picture B!`}
      onBack={() => setScene(null)}
      right={<ScoreChip label={`🔍 ${found.length}/${total}`} testID="diff-score" />}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>Picture A</Text>
        <TapScene
          source={SCENE_IMAGES[scene.imageA]}
          sceneW={scene.w}
          sceneH={scene.h}
          displayWidth={sceneWidth}
          boxes={boxes}
          foundIds={found}
          onHit={onHit}
          onMiss={() => {}}
          testIDPrefix="left"
        />
        <Text style={styles.label}>Picture B</Text>
        <TapScene
          source={SCENE_IMAGES[scene.imageB]}
          sceneW={scene.w}
          sceneH={scene.h}
          displayWidth={sceneWidth}
          boxes={boxes}
          foundIds={found}
          onHit={onHit}
          onMiss={() => {}}
          testIDPrefix="right"
        />
      </ScrollView>
      <WinOverlay
        visible={won}
        message={playerName ? `Eagle eyes, ${playerName}!` : 'You found every difference!'}
        onPlayAgain={() => setScene(null)}
        onHome={onHome}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  scroll: { alignItems: 'center', paddingBottom: 28, gap: 6, paddingHorizontal: 14 },
  label: {
    fontSize: 15,
    fontFamily: fonts.displayMed,
    color: colors.inkSoft,
    marginTop: 4,
  },
});
