import React, { useRef, useState } from 'react';
import { Animated, Image, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SCENE_IMAGES, SCENE_THUMBS, SPOTIT_ICONS } from '../../assets/images';
import { GameShell } from '../../components/GameShell';
import { ScenePicker } from '../../components/ScenePicker';
import { manifest } from '../../manifest';
import { sfx } from '../../sound';
import { colors, fonts, shadows } from '../../theme';

interface Props {
  onHome: () => void;
  sceneId?: string;
  onPickScene: (id: string) => void;
  onBackToPicker: () => void;
}

interface Placed {
  key: number;
  icon: string;
  x: number; // scene-relative 0..1
  y: number;
  size: number; // scene-relative width fraction
}

// Free-play toy mode: no win state, no timer — just decorate a scene with
// stickers. Tap a tray sticker to drop it, drag to move, double-tap to pop.
export function StickerGame({ onHome, sceneId, onPickScene, onBackToPicker }: Props) {
  const backdrops = [
    ...manifest.hidden.map((h) => ({ id: h.id, name: h.name, image: h.image })),
    ...manifest.diff.map((d) => ({ id: `d-${d.id}`, name: d.name, image: (d.image ?? d.imageA)! })),
  ];
  const picked = backdrops.find((b) => b.id === sceneId) ?? null;
  const [placed, setPlaced] = useState<Placed[]>([]);
  const nextKey = useRef(1);

  const { width, height } = useWindowDimensions();

  if (!picked) {
    return (
      <GameShell title="Sticker Party" subtitle="Pick a place to decorate" onBack={onHome}>
        <ScenePicker
          title="Where's the party?"
          options={backdrops}
          onPick={(id) => { setPlaced([]); onPickScene(id); }}
          onSurprise={() => { setPlaced([]); onPickScene(backdrops[Math.floor(Math.random() * backdrops.length)].id); }}
        />
      </GameShell>
    );
  }

  const ar = 1280 / 720;
  const trayH = 96;
  const stageW = Math.min(width - 24, (height - 84 - trayH - 24) * ar, 1100);
  const stageH = stageW / ar;

  const addSticker = (icon: string) => {
    sfx.tap();
    setPlaced((p) => [
      ...p,
      {
        key: nextKey.current++,
        icon,
        x: 0.3 + Math.random() * 0.4,
        y: 0.3 + Math.random() * 0.35,
        size: 0.09 + Math.random() * 0.03,
      },
    ]);
  };

  const popSticker = (key: number) => {
    sfx.flip();
    setPlaced((p) => p.filter((s) => s.key !== key));
  };

  const moveSticker = (key: number, x: number, y: number) => {
    setPlaced((p) => p.map((s) => (s.key === key ? { ...s, x, y } : s)));
  };

  return (
    <GameShell
      title="Sticker Party"
      subtitle={`${picked.name} — decorate it your way!`}
      onBack={onBackToPicker}
      right={
        <Pressable
          onPress={() => { sfx.wrong(); setPlaced([]); }}
          testID="sticker-clear"
          accessibilityLabel="Clear all stickers"
          accessibilityRole="button"
          style={({ pressed }) => [styles.clearBtn, shadows.soft, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.clearText}>🧹 Clear</Text>
        </Pressable>
      }
    >
      <View style={styles.wrap}>
        <View style={[styles.stage, shadows.sticker, { width: stageW, height: stageH }]} testID="sticker-stage">
          <Image source={SCENE_IMAGES[picked.image] ?? SCENE_THUMBS[picked.image]} style={{ width: stageW, height: stageH }} resizeMode="cover" />
          {placed.map((s) => (
            <DraggableSticker
              key={s.key}
              placed={s}
              stageW={stageW}
              stageH={stageH}
              onMove={moveSticker}
              onPop={popSticker}
            />
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: trayH }} contentContainerStyle={styles.tray}>
          {manifest.spotit.icons.map((icon) => (
            <Pressable
              key={icon}
              onPress={() => addSticker(icon)}
              testID={`sticker-tray-${icon}`}
              accessibilityLabel={`Add ${icon} sticker`}
              accessibilityRole="button"
              style={({ pressed }) => [styles.trayItem, shadows.soft, pressed && { transform: [{ scale: 0.9 }] }]}
            >
              <Image source={SPOTIT_ICONS[icon]} style={{ width: '80%', height: '80%' }} resizeMode="contain" />
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.hint}>Tap a sticker to add it · drag to move · double-tap to pop it!</Text>
      </View>
    </GameShell>
  );
}

function DraggableSticker({
  placed, stageW, stageH, onMove, onPop,
}: {
  placed: Placed;
  stageW: number;
  stageH: number;
  onMove: (key: number, x: number, y: number) => void;
  onPop: (key: number) => void;
}) {
  const size = placed.size * stageW;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const lastTap = useRef(0);
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_e, g) => {
        if (Math.abs(g.dx) + Math.abs(g.dy) < 6) {
          const now = Date.now();
          if (now - lastTap.current < 350) onPop(placed.key);
          lastTap.current = now;
        } else {
          const nx = Math.min(0.95, Math.max(0, placed.x + g.dx / stageW));
          const ny = Math.min(0.95, Math.max(0, placed.y + g.dy / stageH));
          onMove(placed.key, nx, ny);
        }
        pan.setValue({ x: 0, y: 0 });
      },
    })
  ).current;

  return (
    <Animated.View
      {...responder.panHandlers}
      testID={`sticker-placed-${placed.key}`}
      style={{
        position: 'absolute',
        left: placed.x * stageW,
        top: placed.y * stageH,
        width: size,
        height: size,
        transform: pan.getTranslateTransform(),
      }}
    >
      <Image source={SPOTIT_ICONS[placed.icon]} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  stage: { borderRadius: 22, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 5, borderColor: colors.card },
  tray: { flexDirection: 'row', gap: 10, paddingHorizontal: 8, alignItems: 'center' },
  trayItem: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: colors.paper,
    borderWidth: 3,
    borderColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtn: { backgroundColor: colors.gold, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 14 },
  clearText: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
  hint: { fontFamily: fonts.bodyReg, color: colors.inkSoft, fontSize: 12 },
});
