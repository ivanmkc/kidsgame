import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SCENE_IMAGES } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { ScenePicker } from '../../components/ScenePicker';
import { TapScene } from '../../components/TapScene';
import { WinOverlay } from '../../components/WinOverlay';
import { HiddenScene, manifest } from '../../manifest';
import { colors, fonts, shadows } from '../../theme';

interface Props {
  onHome: () => void;
  playerName?: string;
}

export function HiddenGame({ onHome, playerName }: Props) {
  const [scene, setScene] = useState<HiddenScene | null>(null);
  const [found, setFound] = useState<string[]>([]);

  const start = (s: HiddenScene) => {
    setScene(s);
    setFound([]);
  };

  const { width } = useWindowDimensions();
  const sceneWidth = Math.min(width - 28, 640);

  if (!scene) {
    return (
      <GameShell title="Hidden Objects" subtitle="Choose a scene" onBack={onHome}>
        <ScenePicker
          title="Where do you want to search?"
          options={manifest.hidden.map((h) => ({ id: h.id, name: h.name, image: h.image }))}
          onPick={(id) => { const s = manifest.hidden.find((h) => h.id === id); if (s) start(s); }}
          onSurprise={() => start(manifest.hidden[Math.floor(Math.random() * manifest.hidden.length)])}
        />
      </GameShell>
    );
  }

  const total = scene.targets.length;
  const won = found.length === total && total > 0;
  const boxes = scene.targets.map((t) => ({ id: t.id, box: t }));
  const onHit = (id: string) => {
    if (won) return;
    setFound((f) => (f.includes(id) ? f : [...f, id]));
  };

  return (
    <GameShell
      title="Hidden Objects"
      subtitle={`${scene.name} — can you find all of these?`}
      onBack={() => setScene(null)}
      right={<ScoreChip label={`🔎 ${found.length}/${total}`} testID="hidden-score" />}
    >
      <View style={styles.checklist} testID="hidden-checklist">
        {scene.targets.map((t) => {
          const done = found.includes(t.id);
          return (
            <View key={t.id} style={[styles.chip, shadows.soft, done && styles.chipFound]} testID={`checklist-${t.id}`}>
              <Image source={SCENE_IMAGES[t.thumb]} style={styles.chipImg} />
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
        <Text style={styles.hint}>Tap the picture when you spot something from the list!</Text>
      </ScrollView>
      <WinOverlay
        visible={won}
        message={playerName ? `Super detective, ${playerName}!` : 'You found everything!'}
        onPlayAgain={() => setScene(null)}
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
    paddingBottom: 10,
    flexWrap: 'wrap',
  },
  chip: {
    width: 62,
    height: 62,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.card,
    backgroundColor: colors.card,
    overflow: 'hidden',
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
  scroll: { alignItems: 'center', paddingBottom: 28, paddingHorizontal: 14 },
  hint: {
    fontSize: 14,
    fontFamily: fonts.bodyReg,
    color: colors.inkSoft,
    marginTop: 10,
    textAlign: 'center',
  },
});
