import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SCENE_IMAGES } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { TimerRing, useElapsed } from '../../components/TimerRing';
import { ScenePicker } from '../../components/ScenePicker';
import { TapScene } from '../../components/TapScene';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty, DifficultyFilter, byLevel, inFilter, settingsFor } from '../../difficulty';
import { manifest } from '../../manifest';
import { colors, fonts, shadows } from '../../theme';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  filter?: DifficultyFilter;
  sceneId?: string;
  onPickScene: (id: string) => void;
  onBackToPicker: () => void;
}

export function DiffGame({ onHome, difficulty, filter = 'all', sceneId, onPickScene, onBackToPicker }: Props) {
  const visible = manifest.diff.filter((d) => inFilter(d.level, filter));
  const scene = manifest.diff.find((d) => d.id === sceneId) ?? null;
  const [found, setFound] = useState<string[]>([]);
  const [hintId, setHintId] = useState<string | null>(null);
  const [hintAvailable, setHintAvailable] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settings = settingsFor(difficulty);

  // The hint button stays hidden until the kid is genuinely stuck (~20s
  // without a find), and hides again after each use — no hint spamming.
  const armHintTimer = () => {
    setHintAvailable(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (settings.diffHint) {
      idleTimer.current = setTimeout(() => setHintAvailable(true), 20000);
    }
  };

  useEffect(() => {
    setFound([]);
    setHintId(null);
    armHintTimer();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [sceneId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Pooled scenes draw a fresh random subset (and random side per
  // difference) every time the scene mounts — a level never plays the
  // same twice. Legacy flat pairs keep their fixed four.
  const round = useMemo(() => {
    if (scene?.pool && scene.image) {
      const k = difficulty === 'easy' ? 3 : 4;
      const picked = [...scene.pool].sort(() => Math.random() - 0.5).slice(0, Math.min(k, scene.pool.length));
      return picked.map((p) => ({ box: p, patch: p.patch, patchOnA: Math.random() < 0.5 }));
    }
    return (scene?.diffs ?? []).map((d) => ({ box: d, patch: undefined as string | undefined, patchOnA: false }));
  }, [sceneId]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = round.length;
  const won = found.length === total && total > 0;
  const showTimer = settingsFor(difficulty).timer;
  const elapsed = useElapsed(showTimer && !won && !!scene, sceneId);
  const boxes = round.map((r, i) => ({ id: String(i), box: r.box }));
  const overlaysA = round.filter((r) => r.patch && r.patchOnA).map((r) => ({ box: r.box, source: SCENE_IMAGES[r.patch!] }));
  const overlaysB = round.filter((r) => r.patch && !r.patchOnA).map((r) => ({ box: r.box, source: SCENE_IMAGES[r.patch!] }));
  const srcA = scene ? SCENE_IMAGES[(scene.image ?? scene.imageA)!] : 0;
  const srcB = scene ? SCENE_IMAGES[(scene.imageB ?? scene.image)!] : 0;
  const ar = scene ? scene.w / scene.h : 16 / 9;

  if (!scene) {
    return (
      <GameShell title="Find the Difference" subtitle="Choose a scene" onBack={onHome}>
        <ScenePicker
          title="Where do you want to play?"
          options={visible.map((d) => ({ id: d.id, name: d.name, image: (d.image ?? d.imageA)!, flagged: d.flagged, level: d.level }))}
          onPick={onPickScene}
          onSurprise={() => onPickScene(visible[Math.floor(Math.random() * visible.length)].id)}
        />
      </GameShell>
    );
  }


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
    armHintTimer();
  };

  const showHint = () => {
    const remaining = boxes.map((b) => b.id).filter((id) => !found.includes(id));
    if (remaining.length === 0) return;
    setHintId(remaining[Math.floor(Math.random() * remaining.length)]);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHintId(null), 2200);
    armHintTimer(); // one peek, then back to earning it
  };

  const pictures = (
    <>
      <View style={styles.sceneBlock}>
        <Text style={styles.label}>Picture A</Text>
        <TapScene
          source={srcA}
          overlays={overlaysA}
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
          source={srcB}
          overlays={overlaysB}
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
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {showTimer ? <TimerRing elapsed={elapsed} size={44} stroke={5} showLabel testID="diff-timer" /> : null}
          <ScoreChip label={`🔍 ${found.length}/${total}`} testID="diff-score" />
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={isLandscape ? styles.rowWrap : styles.colWrap}>{pictures}</View>
        {settings.diffHint && hintAvailable && !won ? (
          <Pressable onPress={showHint} testID="diff-hint" accessibilityLabel="Show a hint" accessibilityRole="button" style={({ pressed }) => [styles.hintBtn, shadows.soft, pressed && styles.pressed]}>
            <Text style={styles.hintText}>💡 Hint</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <WinOverlay
        visible={won}
        message={'Eagle eyes! You found every difference!'}
        onNext={() => {
          const pool = byLevel(visible.some((d) => d.id === scene.id) ? visible : manifest.diff);
          const ids = pool.map((d) => d.id);
          onPickScene(ids[(ids.indexOf(scene.id) + 1) % ids.length]);
        }}
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
