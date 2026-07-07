import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { DRESSUP_ICONS, SCENE_IMAGES, SCENE_THUMBS, SPOTIT_ICONS } from '../../assets/images';
import { GameShell } from '../../components/GameShell';
import { ScenePicker } from '../../components/ScenePicker';
import { SparkleBurst } from '../../components/Sparkles';
import { Lang } from '../../lang';
import { t, UIKey } from '../../i18n';
import { SCENE_AR } from '../../manifest';
import { manifest } from '../../manifest';
import { allSceneOptions } from '../sceneOptions';
import { ICON_CATEGORIES } from '../iconCategories';
import { Touch2, pinchTransform } from './pinch';
import { sfx } from '../../sound';
import { colors, fonts, shadows } from '../../theme';
import { cacheKey, callMagic, publicUrlReachable, resolvePublicImageUrl } from './magic';

interface Props {
  onHome: () => void;
  sceneId?: string;
  onPickScene: (id: string) => void;
  onBackToPicker: () => void;
  lang?: Lang;
}

interface Placed {
  key: number;
  icon: string;
  x: number; // scene-relative 0..1
  y: number;
  size: number; // scene-relative width fraction
  rotation: number; // degrees
}

const BACKDROPS = allSceneOptions('all');
const DRESSUP_SET = new Set(manifest.dressup ?? []);

// Phase of the AI-magic call for a single placed sticker.
type MagicPhase = 'idle' | 'pending' | 'done';

// Sticker drawer categories (Infinity Nikki-style): one tab per bucket so
// nothing ever needs a scroll marathon. Buckets mirror the ones kids
// already know from Rule Time / Odd One Out.
// TRAY_TABS references i18n keys instead of raw labels so each language
// picks up its own translation at render time.
const TRAY_TABS: { id: string; emoji: string; nameKey: UIKey }[] = [
  { id: 'dressup', emoji: '👗', nameKey: 'sticker.tab.dressup' },
  { id: 'animals', emoji: '🐾', nameKey: 'sticker.tab.animals' },
  { id: 'nature', emoji: '🌈', nameKey: 'sticker.tab.nature' },
  { id: 'food', emoji: '🍎', nameKey: 'sticker.tab.food' },
  { id: 'things', emoji: '🚗', nameKey: 'sticker.tab.things' },
];

// Free-play toy mode: no win state, no timer — just decorate a scene with
// stickers. Tap a tray sticker to drop it, drag to move, double-tap to pop.
export function StickerGame({ onHome, sceneId, onPickScene, onBackToPicker, lang = 'en' }: Props) {
  const backdrops = BACKDROPS;
  const picked = backdrops.find((b) => b.id === sceneId) ?? null;
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [tab, setTab] = useState('dressup');
  const nextKey = useRef(1);

  // AI magic state: current backdrop override (data URL of the magicked
  // photo), per-sticker phase, per-scene cache, one-in-flight guard.
  // All keyed off the scene id so switching scenes wipes cleanly.
  const [magicBackdrop, setMagicBackdrop] = useState<string | null>(null);
  const [magicPhase, setMagicPhase] = useState<Record<number, MagicPhase>>({});
  const [pendingKey, setPendingKey] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [magicBurst, setMagicBurst] = useState(0);
  const magicCache = useRef<Map<string, string>>(new Map());
  const magicAborts = useRef<Map<number, AbortController>>(new Map());

  // Whether ✨ can even work in this environment. We resolve the public
  // URL of the backdrop and HEAD-check it once per scene; if it 404s
  // (usually because a local dev build's asset hash isn't on the live
  // site yet), we simply hide the ✨ affordance — the sticker still works
  // as a normal overlay. `null` = unknown yet.
  const publicImageUrl = useMemo(() => {
    if (!picked) return null;
    const src = SCENE_IMAGES[picked.image] ?? SCENE_THUMBS[picked.image];
    return resolvePublicImageUrl(src);
  }, [picked]);
  const [magicReachable, setMagicReachable] = useState<boolean | null>(null);
  useEffect(() => {
    setMagicReachable(null);
    if (!publicImageUrl) { setMagicReachable(false); return; }
    const ac = new AbortController();
    void publicUrlReachable(publicImageUrl, ac.signal).then(setMagicReachable);
    return () => ac.abort();
  }, [publicImageUrl]);

  // Scene change / Clear: cancel everything, wipe caches. Live requests
  // resolve into a no-op because we abort their signals.
  const resetMagic = useCallback(() => {
    magicAborts.current.forEach((c) => c.abort());
    magicAborts.current.clear();
    magicCache.current.clear();
    setMagicBackdrop(null);
    setMagicPhase({});
    setPendingKey(null);
    setToast(null);
  }, []);
  useEffect(() => { resetMagic(); }, [sceneId, resetMagic]);
  useEffect(() => () => { magicAborts.current.forEach((c) => c.abort()); }, []);

  const popSticker = useCallback((key: number) => {
    sfx.flip();
    setPlaced((p) => p.filter((s) => s.key !== key));
    // Abandoning a sticker mid-magic — cancel the in-flight call.
    const ac = magicAborts.current.get(key);
    if (ac) { ac.abort(); magicAborts.current.delete(key); }
    setMagicPhase((m) => { const { [key]: _drop, ...rest } = m; return rest; });
    setPendingKey((k) => (k === key ? null : k));
  }, []);

  const moveSticker = useCallback((key: number, x: number, y: number) => {
    setPlaced((p) => p.map((s) => (s.key === key ? { ...s, x, y } : s)));
  }, []);

  const transformSticker = useCallback((key: number, size: number, rotation: number) => {
    setPlaced((p) => p.map((s) => (s.key === key ? { ...s, size, rotation } : s)));
  }, []);

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3000);
  }, []);

  const runMagic = useCallback((sticker: Placed) => {
    if (!picked || !publicImageUrl) return;
    if (pendingKey !== null && pendingKey !== sticker.key) return; // one at a time
    sfx.tap();
    // Center of the sticker in scene-relative coords — that's where the
    // model should paint the wearable onto whoever's standing there.
    const cx = Math.min(0.99, Math.max(0.01, sticker.x + sticker.size / 2));
    const cy = Math.min(0.99, Math.max(0.01, sticker.y + sticker.size / 2));
    const key = cacheKey(picked.id, sticker.icon, cx, cy);

    const applySuccess = (dataUrl: string) => {
      setMagicBackdrop(dataUrl);
      setMagicPhase((m) => ({ ...m, [sticker.key]: 'done' }));
      setPlaced((p) => p.filter((s) => s.key !== sticker.key));
      setPendingKey(null);
      setMagicBurst((n) => n + 1);
      sfx.win();
    };

    const hit = magicCache.current.get(key);
    if (hit) { applySuccess(hit); return; }

    setMagicPhase((m) => ({ ...m, [sticker.key]: 'pending' }));
    setPendingKey(sticker.key);
    const ac = new AbortController();
    magicAborts.current.set(sticker.key, ac);
    const timeout = setTimeout(() => ac.abort(), 90_000);

    void callMagic({ imageUrl: publicImageUrl, x: cx, y: cy, item: sticker.icon }, { signal: ac.signal })
      .then((res) => {
        clearTimeout(timeout);
        magicAborts.current.delete(sticker.key);
        if (!res.ok || !res.image_b64) {
          setMagicPhase((m) => { const { [sticker.key]: _drop, ...rest } = m; return rest; });
          setPendingKey((k) => (k === sticker.key ? null : k));
          flashToast('The magic fizzled — try again!');
          return;
        }
        const dataUrl = `data:image/png;base64,${res.image_b64}`;
        magicCache.current.set(key, dataUrl);
        applySuccess(dataUrl);
      })
      .catch(() => {
        clearTimeout(timeout);
        magicAborts.current.delete(sticker.key);
        setMagicPhase((m) => { const { [sticker.key]: _drop, ...rest } = m; return rest; });
        setPendingKey((k) => (k === sticker.key ? null : k));
        flashToast('The magic fizzled — try again!');
      });
  }, [picked, publicImageUrl, pendingKey, flashToast]);

  const { width, height } = useWindowDimensions();
  const stageRef = useRef<View | null>(null);
  const stageFrame = useRef({ x: 0, y: 0, w: 1, h: 1 });
  const measureStage = () => {
    stageRef.current?.measureInWindow((x, y, w, h) => { stageFrame.current = { x, y, w, h }; });
  };
  const [ghost, setGhost] = useState<{ icon: string; x: number; y: number } | null>(null);

  if (!picked) {
    return (
      <GameShell title={t(lang, 'shell.sticker.title')} subtitle={t(lang, 'shell.sticker.subPicker')} onBack={onHome} lang={lang}>
        <ScenePicker
          title={t(lang, 'picker.sticker')}
          lang={lang}
          options={backdrops}
          onPick={(id) => { setPlaced([]); onPickScene(id); }}
          onSurprise={() => { setPlaced([]); onPickScene(backdrops[Math.floor(Math.random() * backdrops.length)].id); }}
        />
      </GameShell>
    );
  }

  const ar = SCENE_AR;
  const trayItems: string[] = tab === 'dressup' ? (manifest.dressup ?? []) : (ICON_CATEGORIES[tab] ?? []);
  const itemsPerRow = Math.max(6, Math.floor(Math.min(width - 24, 1100) / 74));
  const trayRows = Math.max(1, Math.ceil(trayItems.length / itemsPerRow));
  const trayH = 46 + trayRows * 72;
  const stageW = Math.min(width - 24, (height - 84 - trayH - 40) * ar, 1100);
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
        rotation: 0,
      },
    ]);
  };


  return (
    <GameShell
      title={t(lang, 'shell.sticker.title')}
      subtitle={t(lang, 'shell.sticker.subPlay', { name: picked.name })}
      onBack={onBackToPicker}
      backKind="picker"
      lang={lang}
      right={
        <Pressable
          onPress={() => { sfx.flip(); setPlaced([]); resetMagic(); }}
          testID="sticker-clear"
          accessibilityLabel="Clear all stickers"
          accessibilityRole="button"
          style={({ pressed }) => [styles.clearBtn, shadows.soft, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.clearText}>{t(lang, 'sticker.clear')}</Text>
        </Pressable>
      }
    >
      <View style={styles.wrap}>
        <View
          ref={stageRef}
          style={[styles.stage, shadows.sticker, { width: stageW, height: stageH }]}
          testID="sticker-stage"
          onLayout={measureStage}
        >
          {magicBackdrop ? (
            <Image
              source={{ uri: magicBackdrop }}
              style={{ width: stageW, height: stageH }}
              resizeMode="cover"
              testID="magic-backdrop"
            />
          ) : (
            <Image source={SCENE_IMAGES[picked.image] ?? SCENE_THUMBS[picked.image]} style={{ width: stageW, height: stageH }} resizeMode="cover" />
          )}
          {placed.map((s) => {
            const phase: MagicPhase = magicPhase[s.key] ?? 'idle';
            const isDressup = DRESSUP_SET.has(s.icon);
            const magicVisible = isDressup && magicReachable === true && phase !== 'done';
            const magicEnabled = magicVisible && (pendingKey === null || pendingKey === s.key);
            return (
              <DraggableSticker
                key={s.key}
                placed={s}
                stageW={stageW}
                stageH={stageH}
                onMove={moveSticker}
                onPop={popSticker}
                onTransform={transformSticker}
                pending={phase === 'pending'}
                magicButton={magicVisible ? (
                  <MagicButton
                    stickerKey={s.key}
                    pending={phase === 'pending'}
                    disabled={!magicEnabled}
                    onPress={() => runMagic(s)}
                  />
                ) : null}
              />
            );
          })}
          {magicBurst > 0 ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="magic-burst">
              <SparkleBurst count={12} size={26} trigger={magicBurst} />
            </View>
          ) : null}
          {toast ? (
            <View pointerEvents="none" style={styles.toast} testID="magic-toast">
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.tabRow}>
          {TRAY_TABS.map((tt) => {
            const name = t(lang, tt.nameKey);
            return (
              <Pressable
                key={tt.id}
                onPress={() => { sfx.tap(); setTab(tt.id); }}
                testID={`sticker-tab-${tt.id}`}
                accessibilityLabel={`${name} stickers`}
                accessibilityRole="button"
                style={[styles.tabChip, shadows.soft, tab === tt.id && styles.tabChipOn]}
              >
                <Text style={styles.tabEmoji}>{tt.emoji}</Text>
                <Text style={[styles.tabLabel, tab === tt.id && styles.tabLabelOn]}>{name}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.tray}>
          {trayItems.map((icon) => (
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
        </View>
        <Text style={styles.hint}>{t(lang, 'sticker.hint')}</Text>
      </View>
      {ghost ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: ghost.x - 36, top: ghost.y - 36, width: 72, height: 72, zIndex: 50 }}>
          <Image source={DRESSUP_ICONS[ghost.icon] ?? SPOTIT_ICONS[ghost.icon]} style={{ width: '100%', height: '100%', opacity: 0.85 }} resizeMode="contain" />
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
      <Image source={DRESSUP_ICONS[icon] ?? SPOTIT_ICONS[icon]} style={{ width: '80%', height: '80%' }} resizeMode="contain" />
    </View>
  );
}

const DraggableSticker = React.memo(function DraggableSticker({
  placed, stageW, stageH, onMove, onPop, onTransform, pending, magicButton,
}: {
  placed: Placed;
  stageW: number;
  stageH: number;
  onMove: (key: number, x: number, y: number) => void;
  onPop: (key: number) => void;
  onTransform: (key: number, size: number, rotation: number) => void;
  pending?: boolean;
  magicButton?: React.ReactNode;
}) {
  const size = placed.size * stageW;
  // Gentle pulse while the model works — visual reassurance that
  // something IS happening during the ~30s wait.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pending) { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pending, pulse]);
  // The PanResponder is created ONCE; everything it needs at release time
  // flows through refs so re-renders never rebuild gesture plumbing.
  const live = useRef({ placed, stageW, stageH, onMove, onPop, onTransform });
  live.current = { placed, stageW, stageH, onMove, onPop, onTransform };
  const pinchStart = useRef<{ t: Touch2; size: number; rotation: number } | null>(null);
  const pan = useRef<Animated.ValueXY | null>(null);
  if (!pan.current) pan.current = new Animated.ValueXY({ x: 0, y: 0 });
  const lastTap = useRef(0);
  const responder = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  if (!responder.current) {
    responder.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
      onPanResponderMove: (e, g) => {
        const touches = e.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          // two fingers: pinch to resize, twist to rotate
          const t: Touch2 = { x0: touches[0].pageX, y0: touches[0].pageY, x1: touches[1].pageX, y1: touches[1].pageY };
          const { placed: pl, onTransform: tf } = live.current;
          if (!pinchStart.current) {
            pinchStart.current = { t, size: pl.size, rotation: pl.rotation };
            return;
          }
          const { size, rotation } = pinchTransform(pinchStart.current.t, t, pinchStart.current.size, pinchStart.current.rotation);
          tf(pl.key, size, rotation);
          return;
        }
        Animated.event([null, { dx: pan.current!.x, dy: pan.current!.y }], { useNativeDriver: false })(e, g);
      },
      onPanResponderRelease: (_e, g) => {
        const { placed: pl, stageW: w, stageH: h, onMove: mv, onPop: pop } = live.current;
        if (pinchStart.current) {
          pinchStart.current = null;
          pan.current!.setValue({ x: 0, y: 0 });
          return;
        }
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
        transform: [...pan.current.getTranslateTransform(), { rotate: `${placed.rotation}deg` }],
      }}
    >
      <Animated.Image
        source={DRESSUP_ICONS[placed.icon] ?? SPOTIT_ICONS[placed.icon]}
        style={{ width: '100%', height: '100%', opacity: pulse }}
        resizeMode="contain"
      />
      {magicButton ? (
        <View pointerEvents="box-none" style={styles.magicSlot}>
          {magicButton}
        </View>
      ) : null}
    </Animated.View>
  );
});

// Small tappable ✨ badge that lives in the top-right corner of a
// placed dressup sticker. While pending it swaps to a rotating label
// so the kid sees the magic in flight; a second "adding the magic
// touches…" label kicks in past 30s so the wait doesn't feel dead.
function MagicButton({ stickerKey, pending, disabled, onPress }: {
  stickerKey: number;
  pending: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const [long, setLong] = useState(false);
  useEffect(() => {
    if (!pending) { setLong(false); return; }
    const to = setTimeout(() => setLong(true), 30_000);
    return () => clearTimeout(to);
  }, [pending]);
  if (pending) {
    return (
      <View testID={`magic-pending-${stickerKey}`} style={styles.magicPending}>
        <Text style={styles.magicPendingText}>
          {long ? 'Adding the magic touches…' : 'Doing magic… ✨'}
        </Text>
      </View>
    );
  }
  return (
    <Pressable
      testID={`magic-btn-${stickerKey}`}
      accessibilityLabel="Make it real"
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.magicBtn,
        shadows.soft,
        disabled && { opacity: 0.4 },
        pressed && !disabled && { transform: [{ scale: 0.92 }] },
      ]}
    >
      <Text style={styles.magicBtnText}>✨</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  stage: { borderRadius: 22, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 5, borderColor: colors.card },
  tray: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', maxWidth: 1100 },
  tabRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.paper,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: colors.blush,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  tabChipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabEmoji: { fontSize: 18 },
  tabLabel: { fontFamily: fonts.displayMed, fontSize: 13, color: colors.inkSoft },
  tabLabelOn: { color: colors.ink },
  trayItem: {
    width: 64,
    height: 64,
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
  // A slot anchored to the top-right corner of the sticker that lives
  // OUTSIDE the sticker's PanResponder-active area: pointerEvents="box-none"
  // means drag/pinch/pop keep working on the sticker itself, but the button
  // inside can still receive taps.
  magicSlot: { position: 'absolute', top: -14, right: -14, alignItems: 'flex-end' },
  magicBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  magicBtnText: { fontSize: 16 },
  magicPending: {
    backgroundColor: colors.paper,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: 180,
  },
  magicPendingText: { fontFamily: fonts.bodyReg, fontSize: 11, color: colors.ink },
  toast: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: colors.paper,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.blush,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  toastText: { fontFamily: fonts.bodyReg, fontSize: 13, color: colors.ink },
});
