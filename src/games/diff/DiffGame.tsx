import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SCENE_IMAGES } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { TimerRing, useElapsed } from '../../components/TimerRing';
import { FilterCycleChip, ScenePicker } from '../../components/ScenePicker';
import { TapScene } from '../../components/TapScene';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty, DifficultyFilter, inFilter, nextFilter, nextSceneId, settingsFor } from '../../difficulty';
import { baseImage, manifest } from '../../manifest';
import { makeRng, sample } from '../../rng';
import { colors, fonts, shadows } from '../../theme';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  filter?: DifficultyFilter;
  onFilter?: (f: DifficultyFilter) => void;
  sceneId?: string;
  onPickScene: (id: string) => void;
  onBackToPicker: () => void;
}

export function DiffGame({ onHome, difficulty, filter = 'all', onFilter, sceneId, onPickScene, onBackToPicker }: Props) {
  const visible = manifest.diff.filter((d) => inFilter(d.level, filter));
  const scene = manifest.diff.find((d) => d.id === sceneId) ?? null;
  const [found, setFound] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [forceReady, setForceReady] = useState(false);
  const wrapRef = useRef<View>(null);
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

  // Hold the round invisible until every image (both bases + all patch
  // overlays) has fully loaded — a late-arriving patch would flicker in
  // and give the difference away. Timeout guard: never blank the game forever.
  useEffect(() => {
    setFound([]);
    setHintId(null);
    setReady(false);
    setForceReady(false);
    armHintTimer();
    const t = setTimeout(() => setForceReady(true), 8000);
    return () => {
      clearTimeout(t);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [sceneId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Pooled scenes draw a fresh random subset (and random side per
  // difference) every time the scene mounts — a level never plays the
  // same twice. Legacy flat pairs keep their fixed four.
  const { boxes, overlaysA, overlaysB, total } = useMemo(() => {
    const rng = makeRng(Math.floor(Math.random() * 1e9));
    const round = scene?.pool && scene.image
      ? sample(rng, scene.pool, settingsFor(difficulty).diffDraw)
          .map((p) => ({ box: p, patch: p.patch as string | undefined, patchOnA: rng() < 0.5 }))
      : (scene?.diffs ?? []).map((d) => ({ box: d, patch: undefined as string | undefined, patchOnA: false }));
    return {
      total: round.length,
      boxes: round.map((r, i) => ({ id: String(i), box: r.box })),
      overlaysA: round.filter((r) => r.patch && r.patchOnA).map((r) => ({ box: r.box, source: SCENE_IMAGES[r.patch!] })),
      overlaysB: round.filter((r) => r.patch && !r.patchOnA).map((r) => ({ box: r.box, source: SCENE_IMAGES[r.patch!] })),
    };
  }, [sceneId]); // eslint-disable-line react-hooks/exhaustive-deps
  const won = found.length === total && total > 0;
  const expectedAssets = 2 + overlaysA.length + overlaysB.length;

  // react-native-web's Image onLoad fires once the DIMENSIONS are known —
  // before the bytes finish streaming — so poll the real <img> elements
  // under the round container until every one is fully complete.
  useEffect(() => {
    if (ready) return;
    const iv = setInterval(() => {
      const node = wrapRef.current as unknown as { querySelectorAll?: (sel: string) => ArrayLike<HTMLImageElement> } | null;
      if (!node?.querySelectorAll) {
        setReady(true); // non-DOM platform: no gate needed
        return;
      }
      const imgs = Array.from(node.querySelectorAll('img'));
      if (imgs.length >= expectedAssets && imgs.every((im) => im.complete && im.naturalWidth > 0)) {
        setReady(true);
      }
    }, 80);
    return () => clearInterval(iv);
  }, [ready, sceneId, expectedAssets]);
  const showRound = ready || forceReady;
  const showTimer = settingsFor(difficulty).timer;
  const elapsed = useElapsed(showTimer && !won && !!scene, sceneId);
  const srcA = scene ? SCENE_IMAGES[baseImage(scene)] : 0;
  const srcB = scene ? SCENE_IMAGES[(scene.imageB ?? scene.image)!] : 0;
  const ar = scene ? scene.w / scene.h : 16 / 9;

  if (!scene) {
    return (
      <GameShell title="Find the Difference" subtitle="Choose a scene" onBack={onHome}>
        <ScenePicker
          title="Where do you want to play?"
          options={manifest.diff.map((d) => ({ id: d.id, name: d.name, image: baseImage(d), flagged: d.flagged, level: d.level, dimmed: !inFilter(d.level, filter) }))}
          onPick={onPickScene}
          onSurprise={() => onPickScene(visible[Math.floor(Math.random() * visible.length)].id)}
          filterChip={onFilter ? <FilterCycleChip filter={filter} onCycle={() => onFilter(nextFilter(filter))} /> : undefined}
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
        <View ref={wrapRef} style={[isLandscape ? styles.rowWrap : styles.colWrap, !showRound && styles.hiddenUntilLoaded]}>{pictures}</View>
        {!showRound ? (
          <View pointerEvents="none" style={styles.loadingWrap} testID="diff-loading">
            <ActivityIndicator size="large" color={colors.inkSoft} />
          </View>
        ) : null}
        {settings.diffHint && hintAvailable && !won ? (
          <Pressable onPress={showHint} testID="diff-hint" accessibilityLabel="Show a hint" accessibilityRole="button" style={({ pressed }) => [styles.hintBtn, shadows.soft, pressed && styles.pressed]}>
            <Text style={styles.hintText}>💡 Hint</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <WinOverlay
        visible={won}
        message={'Eagle eyes! You found every difference!'}
        onNext={() => onPickScene(nextSceneId(manifest.diff, visible, scene.id))}
        onHome={onHome}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 10, paddingHorizontal: 12 },
  rowWrap: { flexDirection: 'row', gap: 16, justifyContent: 'center', alignItems: 'flex-start' },
  colWrap: { flexDirection: 'column', gap: 8, alignItems: 'center' },
  hiddenUntilLoaded: { opacity: 0 },
  loadingWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
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
