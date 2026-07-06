import React, { useCallback, useRef, useState } from 'react';
import { Animated, Image, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SCENE_IMAGES, SCENE_THUMBS, SPOTIT_ICONS } from '../../assets/images';
import { GameShell } from '../../components/GameShell';
import { ScenePicker } from '../../components/ScenePicker';
import { SCENE_AR } from '../../manifest';
import { manifest } from '../../manifest';
import { allSceneOptions } from '../sceneOptions';
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

const BACKDROPS = allSceneOptions('all');

// Free-play toy mode: no win state, no timer — just decorate a scene with
// stickers. Tap a tray sticker to drop it, drag to move, double-tap to pop.
export function StickerGame({ onHome, sceneId, onPickScene, onBackToPicker }: Props) {
  const backdrops = BACKDROPS;
  const picked = backdrops.find((b) => b.id === sceneId) ?? null;
  const [placed, setPlaced] = useState<Placed[]>([]);
  const nextKey = useRef(1);

  const popSticker = useCallback((key: number) => {
    sfx.flip();
    setPlaced((p) => p.filter((s) => s.key !== key));
  }, []);

  const moveSticker = useCallback((key: number, x: number, y: number) => {
    setPlaced((p) => p.map((s) => (s.key === key ? { ...s, x, y } : s)));
  }, []);

  const { width, height } = useWindowDimensions();
  const stageFrame = useRef({ x: 0, y: 0, w: 1, h: 1 });
  const [ghost, setGhost] = useState<{ icon: string; x: number; y: number } | null>(null);

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

  const ar = SCENE_AR;
  const trayH = 96;
  const stageW = Math.min(width - 24, (height - 84 - trayH - 24) * ar, 1100);
  const stageH = stageW / ar;

  const addSticker = (icon: string, at?: { x: number; y: number }) => {
    sfx.tap();
    setPlaced((p) => [
      ...p,
      {
        key: nextKey.current++,
        icon,
        x: at ? Math.min(0.95, Math.max(0, at.x)) : 0.3 + Math.random() * 0.4,
        y: at ? Math.min(0.95, Math.max(0, at.y)) : 0.3 + Math.random() * 0.35,
        size: 0.09 + Math.random() * 0.03,
      },
    ]);
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
        <View
          style={[styles.stage, shadows.sticker, { width: stageW, height: stageH }]}
          testID="sticker-stage"
          onLayout={(e) => {
            // measure in window space for tray-drag drops
            (e.target as unknown as { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void })
              .measureInWindow((x, y, w, h) => { stageFrame.current = { x, y, w, h }; });
          }}
        >
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: trayH, width: '100%' }} contentContainerStyle={styles.tray}>
          {manifest.spotit.icons.map((icon) => (
            <TrayItem
              key={icon}
              icon={icon}
              onTap={() => addSticker(icon)}
              onDragMove={(px, py) => setGhost({ icon, x: px, y: py })}
              onDrop={(px, py) => {
                setGhost(null);
                const f = stageFrame.current;
                if (px >= f.x && px <= f.x + f.w && py >= f.y && py <= f.y + f.h) {
                  addSticker(icon, { x: (px - f.x) / f.w - 0.045, y: (py - f.y) / f.h - 0.045 });
                }
              }}
            />
          ))}
        </ScrollView>
        <Text style={styles.hint}>Drag a sticker into the picture · drag to move · double-tap to pop it!</Text>
      </View>
      {ghost ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: ghost.x - 36, top: ghost.y - 36, width: 72, height: 72, zIndex: 50 }}>
          <Image source={SPOTIT_ICONS[ghost.icon]} style={{ width: '100%', height: '100%', opacity: 0.85 }} resizeMode="contain" />
        </View>
      ) : null}
      <View style={{ display: 'none' }}>
      </View>
    </GameShell>
  );
}

function TrayItem({ icon, onTap, onDragMove, onDrop }: {
  icon: string;
  onTap: () => void;
  onDragMove: (pageX: number, pageY: number) => void;
  onDrop: (pageX: number, pageY: number) => void;
}) {
  const live = useRef({ onTap, onDragMove, onDrop });
  live.current = { onTap, onDragMove, onDrop };
  const responder = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  if (!responder.current) {
    responder.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (e, g) => {
        if (Math.abs(g.dx) + Math.abs(g.dy) > 6) {
          live.current.onDragMove(e.nativeEvent.pageX, e.nativeEvent.pageY);
        }
      },
      onPanResponderRelease: (e, g) => {
        if (Math.abs(g.dx) + Math.abs(g.dy) < 6) {
          live.current.onTap();
        } else {
          live.current.onDrop(e.nativeEvent.pageX, e.nativeEvent.pageY);
        }
      },
    });
  }
  return (
    <View
      {...responder.current.panHandlers}
      testID={`sticker-tray-${icon}`}
      accessibilityLabel={`Add ${icon} sticker`}
      style={[styles.trayItem, shadows.soft]}
    >
      <Image source={SPOTIT_ICONS[icon]} style={{ width: '80%', height: '80%' }} resizeMode="contain" />
    </View>
  );
}

const DraggableSticker = React.memo(function DraggableSticker({
  placed, stageW, stageH, onMove, onPop,
}: {
  placed: Placed;
  stageW: number;
  stageH: number;
  onMove: (key: number, x: number, y: number) => void;
  onPop: (key: number) => void;
}) {
  const size = placed.size * stageW;
  // The PanResponder is created ONCE; everything it needs at release time
  // flows through refs so re-renders never rebuild gesture plumbing.
  const live = useRef({ placed, stageW, stageH, onMove, onPop });
  live.current = { placed, stageW, stageH, onMove, onPop };
  const pan = useRef<Animated.ValueXY | null>(null);
  if (!pan.current) pan.current = new Animated.ValueXY({ x: 0, y: 0 });
  const lastTap = useRef(0);
  const responder = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  if (!responder.current) {
    responder.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
      onPanResponderMove: Animated.event([null, { dx: pan.current.x, dy: pan.current.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_e, g) => {
        const { placed: pl, stageW: w, stageH: h, onMove: mv, onPop: pop } = live.current;
        if (Math.abs(g.dx) + Math.abs(g.dy) < 6) {
          const now = Date.now();
          if (now - lastTap.current < 350) pop(pl.key);
          lastTap.current = now;
        } else {
          mv(pl.key,
             Math.min(0.95, Math.max(0, pl.x + g.dx / w)),
             Math.min(0.95, Math.max(0, pl.y + g.dy / h)));
        }
        pan.current!.setValue({ x: 0, y: 0 });
      },
    });
  }

  return (
    <Animated.View
      {...responder.current.panHandlers}
      testID={`sticker-placed-${placed.key}`}
      style={{
        position: 'absolute',
        left: placed.x * stageW,
        top: placed.y * stageH,
        width: size,
        height: size,
        transform: pan.current.getTranslateTransform(),
      }}
    >
      <Image source={SPOTIT_ICONS[placed.icon]} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
    </Animated.View>
  );
});

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
