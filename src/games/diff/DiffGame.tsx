import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SCENE_IMAGES } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { ScenePicker } from '../../components/ScenePicker';
import { TapScene } from '../../components/TapScene';
import { WinOverlay } from '../../components/WinOverlay';
import { settingsFor } from '../../difficulty';
import { manifest } from '../../manifest';
import { Player } from '../../profile';
import { colors, fonts, shadows } from '../../theme';

interface Props {
  onHome: () => void;
  player: Player | null;
  sceneId?: string;
  onPickScene: (id: string) => void;
  onBackToPicker: () => void;
}

export function DiffGame({ onHome, player, sceneId, onPickScene, onBackToPicker }: Props) {
  const scene = manifest.diff.find((d) => d.id === sceneId) ?? null;
  const [found, setFound] = useState<string[]>([]);
  const [hintId, setHintId] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settings = settingsFor(player?.difficulty);

  useEffect(() => {
    setFound([]);
    setHintId(null);
  }, [sceneId]);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  if (!scene) {
    return (
      <GameShell title="Find the Difference" subtitle="Choose a scene" onBack={onHome}>
        <ScenePicker
          title="Where do you want to play?"
          options={manifest.diff.map((d) => ({ id: d.id, name: d.name, image: d.imageA }))}
          onPick={onPickScene}
          onSurprise={() => onPickScene(manifest.diff[Math.floor(Math.random() * manifest.diff.length)].id)}
        />
      </GameShell>
    );
  }

  const total = scene.diffs.length;
  const won = found.length === total && total > 0;
  const boxes = scene.diffs.map((d, i) => ({ id: String(i), box: d }));
  const ar = scene.w / scene.h;

  // Fit both pictures in the viewport — side by side in landscape,
  // stacked in portrait — so no scrolling is needed on normal screens.
  const headerAllowance = 84;
  const labelAllowance = 26;
  const availH = height - headerAllowance - (settings.diffHint ? 54 : 12);
  let sceneWidth: number;
  if (isLandscape) {
    sceneWidth = Math.min((width - 44) / 2, (availH - labelAllowance) * ar, 760);
  } else {
    sceneWidth = Math.min(width - 24, ((availH - 2 * labelAllowance - 8) / 2) * ar, 640);
  }

  const onHit = (id: string) => {
    if (won) return;
    setFound((f) => (f.includes(id) ? f : [...f, id]));
    if (hintId === id) setHintId(null);
  };

  const showHint = () => {
    const remaining = boxes.map((b) => b.id).filter((id) => !found.includes(id));
    if (remaining.length === 0) return;
    setHintId(remaining[Math.floor(Math.random() * remaining.length)]);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHintId(null), 2200);
  };

  const pictures = (
    <>
      <View style={styles.sceneBlock}>
        <Text style={styles.label}>Picture A</Text>
        <TapScene
          source={SCENE_IMAGES[scene.imageA]}
          sceneW={scene.w}
          sceneH={scene.h}
          displayWidth={sceneWidth}
          boxes={boxes}
          foundIds={found}
          hintId={hintId}
          onHit={onHit}
          onMiss={() => {}}
          testIDPrefix="left"
        />
      </View>
      <View style={styles.sceneBlock}>
        <Text style={styles.label}>Picture B</Text>
        <TapScene
          source={SCENE_IMAGES[scene.imageB]}
          sceneW={scene.w}
          sceneH={scene.h}
          displayWidth={sceneWidth}
          boxes={boxes}
          foundIds={found}
          hintId={hintId}
          onHit={onHit}
          onMiss={() => {}}
          testIDPrefix="right"
        />
      </View>
    </>
  );

  return (
    <GameShell
      title="Find the Difference"
      subtitle={`${scene.name} — ${total} sneaky changes!`}
      onBack={onBackToPicker}
      right={<ScoreChip label={`🔍 ${found.length}/${total}`} testID="diff-score" />}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={isLandscape ? styles.rowWrap : styles.colWrap}>{pictures}</View>
        {settings.diffHint && !won ? (
          <Pressable onPress={showHint} testID="diff-hint" style={({ pressed }) => [styles.hintBtn, shadows.soft, pressed && styles.pressed]}>
            <Text style={styles.hintText}>💡 Hint</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <WinOverlay
        visible={won}
        message={player ? `Eagle eyes, ${player.name}!` : 'You found every difference!'}
        onPlayAgain={onBackToPicker}
        onHome={onHome}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 10, paddingHorizontal: 12 },
  rowWrap: { flexDirection: 'row', gap: 16, justifyContent: 'center', alignItems: 'flex-start' },
  colWrap: { flexDirection: 'column', gap: 8, alignItems: 'center' },
  sceneBlock: { alignItems: 'center' },
  label: { fontSize: 14, fontFamily: fonts.displayMed, color: colors.inkSoft, marginBottom: 2 },
  hintBtn: {
    marginTop: 10,
    backgroundColor: colors.gold,
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 24,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  hintText: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
});
