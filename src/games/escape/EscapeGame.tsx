import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SCENE_IMAGES, SCENE_THUMBS } from '../../assets/images';
import { GameShell } from '../../components/GameShell';
import { BetaPill } from '../../components/BetaPill';
import { ScenePicker } from '../../components/ScenePicker';
import { WinOverlay } from '../../components/WinOverlay';
import { SparkleBurst } from '../../components/Sparkles';
import { Lang } from '../../lang';
import { t } from '../../i18n';
import { say, sayThen, sfx } from '../../sound';
import { EscapeHotspot, EscapeRoom, manifest } from '../../manifest';
import { colors, fonts, shadows } from '../../theme';
import { EscapeState, applyTap, nextHint, selectItem, startState } from './logic';

interface SpriteAnim {
  hotspotId: string;
  playing: boolean;
  held: boolean;
  frameIndex: number;
}

// Kid escape room: search the picture, collect up to three items in the
// tray, tap an item then tap the thing it opens. Chains are 2-4 steps and
// generator-linted solvable; a 12s idle hint glows the next right spot so
// nobody ever wedges. Tap-select-tap only — no drag-drop at age three.

interface Props {
  onHome: () => void;
  sceneId?: string;
  onPickScene: (id: string) => void;
  onBackToPicker: () => void;
  lang: Lang;
}

const HINT_MS = 12000;

function roomText(room: EscapeRoom, field: 'intro' | 'winText', lang: Lang): string {
  return room.t?.[lang]?.[field] ?? room[field];
}

function hotText(h: EscapeHotspot, field: 'sayFound' | 'saySearch' | 'sayLocked', lang: Lang): string | undefined {
  const base = h[field];
  if (!base) return undefined;
  return h.t?.[lang]?.[field] ?? base;
}

function itemLabel(item: { label: string; t?: Record<string, string> }, lang: Lang): string {
  return item.t?.[lang] ?? item.label;
}

export function EscapeGame({ onHome, sceneId, onPickScene, onBackToPicker, lang }: Props) {
  const rooms = manifest.escape ?? [];
  const room = rooms.find((r) => r.id === sceneId);
  const [state, setState] = useState<EscapeState>(() => startState());
  const [hintSpot, setHintSpot] = useState<string | null>(null);
  const [pops, setPops] = useState<Array<{ id: string; pop: string }>>([]);
  const [spriteAnims, setSpriteAnims] = useState<SpriteAnim[]>([]);
  const [flyingItems, setFlyingItems] = useState<Array<{
    key: string; emoji: string; fromX: number; fromY: number;
  }>>([]);
  const lastAction = useRef(Date.now());
  const framePos = useRef({ x: 0, y: 0 });
  const trayPos = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const { width } = useWindowDimensions();

  // ALL hooks above the early returns (repo hard rule).
  useEffect(() => {
    setState(startState());
    setPops([]);
    setSpriteAnims([]);
    setHintSpot(null);
    setFlyingItems([]);
    lastAction.current = Date.now();
  }, [sceneId]);

  useEffect(() => {
    if (room) say(roomText(room, 'intro', lang));
  }, [sceneId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Idle hint: after 12s without progress, glow the next actionable spot
  // (and auto-select the needed tray item so the glow is honest).
  useEffect(() => {
    if (!room || state.done) return;
    const iv = setInterval(() => {
      if (Date.now() - lastAction.current < HINT_MS) return;
      const hint = nextHint(room, state);
      if (!hint) return;
      if (hint.selectItem) setState((s) => selectItem(s, hint.selectItem!));
      setHintSpot(hint.hotspotId);
    }, 1000);
    return () => clearInterval(iv);
  }, [room, state]);

  const displayWidth = Math.min(width - 24, 980);
  const scale = displayWidth / 1280;
  const displayHeight = 720 * scale;

  // Plate model: the base image is always room.image. Every visual state
  // change is rendered as a sprite layer on top by the SpriteCanvas.

  const heldItems = useMemo(
    () => (room ? state.inventory.map((id) => room.items.find((i) => i.id === id)!).filter(Boolean) : []),
    [room, state.inventory],
  );

  if (!sceneId || !room) {
    return (
      <GameShell title={t(lang, 'shell.escape.title')} subtitle={t(lang, 'shell.escape.subPicker')} onBack={onHome} lang={lang} right={<BetaPill testID="escape-beta" />}>
        <ScenePicker
          title={t(lang, 'picker.escape')}
          options={rooms.map((r) => ({ id: r.id, name: r.nameT?.[lang] ?? r.name, image: r.image, level: r.level }))}
          onPick={onPickScene}
          onSurprise={() => rooms.length && onPickScene(rooms[Math.floor(Math.random() * rooms.length)].id)}
          lang={lang}
        />
      </GameShell>
    );
  }

  const startSprite = useCallback((hotspotId: string) => {
    setSpriteAnims((prev) => {
      if (prev.some((a) => a.hotspotId === hotspotId && (a.playing || a.held))) return prev;
      return [...prev, { hotspotId, playing: true, held: false, frameIndex: 0 }];
    });
  }, []);

  const onSpot = (hotspotId: string) => {
    lastAction.current = Date.now();
    setHintSpot(null);
    const h = room.hotspots.find((x) => x.id === hotspotId);
    const { state: next, effect } = applyTap(room, state, hotspotId);
    setState(next);
    const locSay = (field: 'sayFound' | 'saySearch' | 'sayLocked') =>
      h ? hotText(h, field, lang) : undefined;
    const playAnim = () => {
      if (h?.sprite?.sheet) startSprite(hotspotId);
    };
    switch (effect.kind) {
      case 'revealed':
        sfx.good();
        playAnim();
        break;
      case 'collected': {
        sfx.good();
        if (effect.pop && !h?.sprite) setPops((p) => [...p, { id: hotspotId, pop: effect.pop! }]);
        const item = room.items.find((i) => i.id === effect.item);
        if (item && h) {
          const box = h.itemBox ?? h.box;
          const fromX = framePos.current.x + (box.x + box.w / 2) * scale;
          const fromY = framePos.current.y + (box.y + box.h / 2) * scale;
          setFlyingItems((f) => [...f, {
            key: `${hotspotId}-${Date.now()}`, emoji: item.emoji, fromX, fromY,
          }]);
        }
        { const s = locSay('sayFound'); if (s) say(s); }
        break;
      }
      case 'unlocked':
        sfx.good();
        playAnim();
        { const s = locSay('sayFound'); if (s) say(s); }
        break;
      case 'win':
        playAnim();
        if (effect.pop && !h?.sprite) setPops((p) => [...p, { id: hotspotId, pop: effect.pop! }]);
        sayThen([locSay('sayFound') ?? '', roomText(room, 'winText', lang)], () => {});
        break;
      case 'locked':
        sfx.boing(0.4);
        { const s = locSay('sayLocked'); if (s) say(s); }
        break;
      case 'flavor':
        sfx.tap();
        { const s = locSay('saySearch'); if (s) say(s); }
        break;
      default:
        break;
    }
  };

  const onTray = (itemId: string) => {
    lastAction.current = Date.now();
    sfx.tap();
    setState((s) => selectItem(s, itemId));
  };

  return (
    <GameShell
      title={room.nameT?.[lang] ?? room.name}
      subtitle={t(lang, 'shell.escape.subPlay')}
      onBack={onBackToPicker}
      backKind="picker"
      lang={lang}
      right={<BetaPill testID="escape-beta" />}
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        <View
          onLayout={(e) => { framePos.current = { x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y }; }}
          style={[styles.frame, shadows.sticker, { width: displayWidth, height: displayHeight }]}
        >
          <Image source={SCENE_THUMBS[room.image] ?? SCENE_IMAGES[room.image]} style={{ width: displayWidth, height: displayHeight }} resizeMode="cover" />
          <SpriteCanvas room={room} state={state} anims={spriteAnims} setAnims={setSpriteAnims} scale={scale} />
          {room.hotspots.map((h) => {
            const used = state.used.includes(h.id);
            const revealed = state.revealed.includes(h.id);
            const actionable = !used && !revealed && (h.kind === 'search' || !h.needs || state.inventory.includes(h.needs));
            return (
              <Pressable
                key={h.id}
                testID={`escape-spot-${h.id}`}
                onPress={() => onSpot(h.id)}
                style={{
                  position: 'absolute',
                  left: (h.box.x - 8) * scale,
                  top: (h.box.y - 8) * scale,
                  width: (h.box.w + 16) * scale,
                  height: (h.box.h + 16) * scale,
                }}
              >
                {revealed && <PulseRing strong />}
                {!used && !revealed && (hintSpot === h.id ? <PulseRing strong /> : h.kind !== 'search' ? <PulseRing dim={!actionable} /> : null)}
                {used && pops.find((p) => p.id === h.id) ? <PopSprite path={pops.find((p) => p.id === h.id)!.pop} /> : null}
                {used ? <SparkleBurst trigger="found" /> : null}
              </Pressable>
            );
          })}
        </View>
        <View
          onLayout={(e) => {
            const { x, y, width: w, height: h } = e.nativeEvent.layout;
            trayPos.current = { x, y, w, h };
          }}
          style={styles.tray}
          testID="escape-tray"
        >
          {heldItems.length === 0 ? (
            <Text style={styles.trayEmpty}>{t(lang, 'escape.trayEmpty')}</Text>
          ) : heldItems.map((i) => (
            <Pressable
              key={i.id}
              testID={`escape-item-${i.id}`}
              onPress={() => onTray(i.id)}
              accessibilityRole="button"
              accessibilityLabel={itemLabel(i, lang)}
              style={[styles.trayItem, state.selected === i.id && styles.trayItemOn]}
            >
              <Text style={styles.trayEmoji}>{i.emoji}</Text>
            </Pressable>
          ))}
        </View>
        {flyingItems.map((fi) => (
          <FlyingEmoji
            key={fi.key}
            emoji={fi.emoji}
            fromX={fi.fromX}
            fromY={fi.fromY}
            toX={trayPos.current.x + trayPos.current.w / 2}
            toY={trayPos.current.y + trayPos.current.h / 2}
            onDone={() => setFlyingItems((f) => f.filter((x) => x.key !== fi.key))}
          />
        ))}
      </ScrollView>
      <WinOverlay
        visible={state.done}
        message={roomText(room, 'winText', lang)}
        onNext={() => {
          const idx = rooms.findIndex((r) => r.id === room.id);
          onPickScene(rooms[(idx + 1) % rooms.length].id);
        }}
        onHome={onBackToPicker}
        lang={lang}
      />
    </GameShell>
  );
}

// Breathing glow ring — borrowed from StoryGame's ChoiceSpot feel: locks
// glow softly all the time (they're the puzzle), hints glow hard.
function PulseRing({ strong, dim }: { strong?: boolean; dim?: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: strong ? 450 : 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: strong ? 450 : 1100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, strong]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        strong ? styles.ringStrong : null,
        { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: dim ? [0.06, 0.2] : [0.25, strong ? 0.95 : 0.6] }) },
      ]}
    />
  );
}

function PopSprite({ path }: { path: string }) {
  const spring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(spring, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }, [spring]);
  const src = SCENE_IMAGES[path];
  if (!src) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.Image
        source={src}
        style={{
          position: 'absolute',
          left: '-15%',
          top: '-30%',
          width: '130%',
          height: '130%',
          transform: [
            { translateY: spring.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
            { scale: spring.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.2, 1.12, 1] }) },
          ],
        }}
        resizeMode="contain"
      />
    </View>
  );
}

function FlyingEmoji({ emoji, fromX, fromY, toX, toY, onDone }: {
  emoji: string; fromX: number; fromY: number;
  toX: number; toY: number; onDone: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(progress, {
      toValue: 1, friction: 7, tension: 40, useNativeDriver: true,
    }).start(({ finished }) => { if (finished) onDone(); });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  const dx = toX - fromX;
  const dy = toY - fromY;
  const arcPeak = -Math.min(80, Math.abs(dy) * 0.4);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: fromX - 20,
        top: fromY - 20,
        width: 40,
        height: 40,
        zIndex: 100,
        transform: [
          { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
          { translateY: progress.interpolate({
            inputRange: [0, 0.2, 0.5, 0.8, 1],
            outputRange: [
              0,
              dy * 0.2 + arcPeak * 0.64,
              dy * 0.5 + arcPeak,
              dy * 0.8 + arcPeak * 0.64,
              dy,
            ],
          }) },
          { scale: progress.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: [1.4, 1.6, 1.2, 1] }) },
        ],
      }}
    >
      <Text style={{ fontSize: 36, textAlign: 'center' }}>{emoji}</Text>
    </Animated.View>
  );
}

interface SpriteEntry {
  hotspotId: string;
  playing: boolean;
  held: boolean;
  frameIndex: number;
  accumulator: number;
}

function SpriteCanvas({ room, state, anims, setAnims, scale }: {
  room: EscapeRoom;
  state: EscapeState;
  anims: SpriteAnim[];
  setAnims: React.Dispatch<React.SetStateAction<SpriteAnim[]>>;
  scale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheetsRef = useRef<Record<string, HTMLImageElement>>({});
  const patchesRef = useRef<Record<string, HTMLImageElement>>({});
  const takenRef = useRef<Record<string, HTMLImageElement>>({});
  const rafRef = useRef<number>(0);
  const entriesRef = useRef<SpriteEntry[]>([]);
  const lastTimeRef = useRef<number>(0);
  const roomRef = useRef(room);
  roomRef.current = room;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const stateRef = useRef(state);
  stateRef.current = state;
  const setAnimsRef = useRef(setAnims);
  setAnimsRef.current = setAnims;
  const needsRedrawRef = useRef(false);

  useEffect(() => {
    for (const h of room.hotspots) {
      if (!h.sprite) continue;
      if (h.sprite.sheet && !sheetsRef.current[h.id]) {
        const img = new window.Image();
        img.src = h.sprite.sheet;
        sheetsRef.current[h.id] = img;
      }
      if (h.sprite.patch && !patchesRef.current[h.id]) {
        const img = new window.Image();
        img.src = h.sprite.patch;
        patchesRef.current[h.id] = img;
      }
      if (h.sprite.takenPatch && !takenRef.current[h.id]) {
        const img = new window.Image();
        img.src = h.sprite.takenPatch;
        takenRef.current[h.id] = img;
      }
    }
  }, [room]);

  const drawStatic = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = scaleRef.current;
    const rm = roomRef.current;
    const st = stateRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const h of rm.hotspots) {
      if (!h.sprite) continue;
      const sp = h.sprite;
      const isUsed = st.used.includes(h.id);
      const isRevealed = st.revealed.includes(h.id);

      if (isUsed && sp.takenPatch) {
        const taken = takenRef.current[h.id];
        if (taken?.naturalWidth) {
          ctx.drawImage(taken, sp.bbox.x * s, sp.bbox.y * s, sp.bbox.w * s, sp.bbox.h * s);
        }
        continue;
      }

      const entry = entriesRef.current.find((e) => e.hotspotId === h.id);
      if (!entry) {
        if ((isUsed || isRevealed) && sp.sheet) {
          const sheet = sheetsRef.current[h.id];
          if (sheet?.naturalWidth && sp.cols && sp.frameCount && sp.fps) {
            const patch = patchesRef.current[h.id];
            if (patch?.naturalWidth) {
              ctx.drawImage(patch, sp.bbox.x * s, sp.bbox.y * s, sp.bbox.w * s, sp.bbox.h * s);
            }
            const frameW = sheet.naturalWidth / sp.cols;
            const rows = Math.ceil(sp.frameCount / sp.cols);
            const frameH = sheet.naturalHeight / rows;
            const lastIdx = sp.frameCount - 1;
            const col = lastIdx % sp.cols;
            const row = Math.floor(lastIdx / sp.cols);
            ctx.drawImage(sheet, col * frameW, row * frameH, frameW, frameH,
              sp.bbox.x * s, sp.bbox.y * s, sp.bbox.w * s, sp.bbox.h * s);
          }
        }
        continue;
      }

      if (!sp.sheet || !sp.cols || !sp.frameCount) continue;

      const patch = patchesRef.current[h.id];
      if (patch?.naturalWidth) {
        ctx.drawImage(patch, sp.bbox.x * s, sp.bbox.y * s, sp.bbox.w * s, sp.bbox.h * s);
      }

      const sheet = sheetsRef.current[h.id];
      if (!sheet?.naturalWidth) continue;
      const frameW = sheet.naturalWidth / sp.cols;
      const rows = Math.ceil(sp.frameCount / sp.cols);
      const frameH = sheet.naturalHeight / rows;
      const col = entry.frameIndex % sp.cols;
      const row = Math.floor(entry.frameIndex / sp.cols);
      ctx.drawImage(sheet, col * frameW, row * frameH, frameW, frameH,
        sp.bbox.x * s, sp.bbox.y * s, sp.bbox.w * s, sp.bbox.h * s);
    }
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current) return;
    lastTimeRef.current = 0;
    const tick = (timestamp: number) => {
      const dt = lastTimeRef.current
        ? Math.min((timestamp - lastTimeRef.current) / 1000, 0.1)
        : 0;
      lastTimeRef.current = timestamp;

      let anyPlaying = false;
      let anyCompleted = false;

      for (const entry of entriesRef.current) {
        const h = roomRef.current.hotspots.find((x) => x.id === entry.hotspotId);
        if (!h?.sprite?.sheet || !h.sprite.cols || !h.sprite.frameCount || !h.sprite.fps) continue;
        const { fps, frameCount } = h.sprite;
        const sheet = sheetsRef.current[h.id];
        if (!sheet?.naturalWidth) {
          if (entry.playing) anyPlaying = true;
          continue;
        }

        if (entry.playing) {
          if (dt > 0) {
            const frameDuration = 1 / fps;
            entry.accumulator += dt;
            while (entry.accumulator >= frameDuration) {
              entry.accumulator -= frameDuration;
              entry.frameIndex++;
            }
            if (entry.frameIndex >= frameCount - 1) {
              entry.frameIndex = frameCount - 1;
              entry.playing = false;
              entry.held = true;
              anyCompleted = true;
            }
          }
          if (entry.playing) anyPlaying = true;
        }
      }

      drawStatic();

      if (anyCompleted) {
        setAnimsRef.current((prev) => prev.map((a) => {
          const entry = entriesRef.current.find((e) => e.hotspotId === a.hotspotId);
          if (entry && entry.held) {
            return { ...a, playing: false, held: true, frameIndex: entry.frameIndex };
          }
          return a;
        }));
      }

      if (anyPlaying) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = 0;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [drawStatic]);

  useEffect(() => {
    if (anims.length === 0) {
      entriesRef.current = [];
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
      lastTimeRef.current = 0;
      needsRedrawRef.current = true;
    } else {
      const existing = new Set(entriesRef.current.map((e) => e.hotspotId));
      let added = false;
      for (const a of anims) {
        if (a.playing && !existing.has(a.hotspotId)) {
          entriesRef.current.push({
            hotspotId: a.hotspotId, playing: true, held: false,
            frameIndex: 0, accumulator: 0,
          });
          added = true;
        }
      }
      const validIds = new Set(anims.map((a) => a.hotspotId));
      entriesRef.current = entriesRef.current.filter((e) => validIds.has(e.hotspotId));
      if (added) startLoop();
      else needsRedrawRef.current = true;
    }
  }, [anims, startLoop]);

  useEffect(() => {
    needsRedrawRef.current = true;
  }, [state.used.length, state.revealed.length]);

  useEffect(() => {
    if (!needsRedrawRef.current) return;
    needsRedrawRef.current = false;
    if (!rafRef.current) drawStatic();
  });

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  if (Platform.OS !== 'web') return null;
  const w = Math.round(1280 * scale);
  const h = Math.round(720 * scale);
  return React.createElement('canvas', {
    ref: canvasRef,
    width: w,
    height: h,
    style: { position: 'absolute', top: 0, left: 0, width: w, height: h, pointerEvents: 'none' },
  });
}

// BETA pill now shared — see src/components/BetaPill.tsx.

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingBottom: 20, gap: 12 },
  frame: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 5,
    borderColor: colors.card,
  },
  ring: {
    flex: 1,
    borderWidth: 5,
    borderColor: colors.gold,
    borderRadius: 26,
    backgroundColor: 'rgba(255,214,110,0.14)',
  },
  ringStrong: { borderColor: '#FFB13D', backgroundColor: 'rgba(255,177,61,0.28)' },
  tray: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 78,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.blush,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  trayEmpty: { fontFamily: fonts.bodyReg, fontSize: 14, color: colors.inkSoft },
  trayItem: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  trayItemOn: {
    borderColor: colors.gold,
    backgroundColor: '#FFF3D6',
    transform: [{ scale: 1.1 }],
  },
  trayEmoji: { fontSize: 36 },
});
