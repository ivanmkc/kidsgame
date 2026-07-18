import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SCENE_IMAGES, SCENE_THUMBS } from '../../assets/images';
import { GameShell } from '../../components/GameShell';
import { ScenePicker } from '../../components/ScenePicker';
import { WinOverlay } from '../../components/WinOverlay';
import { SparkleBurst } from '../../components/Sparkles';
import { Lang } from '../../lang';
import { t } from '../../i18n';
import { say, sayThen, sfx } from '../../sound';
import { EscapeRoom, manifest } from '../../manifest';
import { colors, fonts, shadows } from '../../theme';
import { EscapeState, applyTap, nextHint, selectItem, startState } from './logic';

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

export function EscapeGame({ onHome, sceneId, onPickScene, onBackToPicker, lang }: Props) {
  const rooms = manifest.escape ?? [];
  const room = rooms.find((r) => r.id === sceneId);
  const [state, setState] = useState<EscapeState>(() => startState());
  const [hintSpot, setHintSpot] = useState<string | null>(null);
  const [pops, setPops] = useState<Array<{ id: string; pop: string }>>([]);
  const lastAction = useRef(Date.now());
  const { width } = useWindowDimensions();

  // ALL hooks above the early returns (repo hard rule).
  useEffect(() => {
    setState(startState());
    setPops([]);
    setHintSpot(null);
    lastAction.current = Date.now();
  }, [sceneId]);

  useEffect(() => {
    if (room) say(room.intro);
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

  // Full-scene state chain: find the latest afterScene for used hotspots.
  // Hotspots with afterScene form a linear chain in spec order; the current
  // scene = the afterScene of the last used state-changing hotspot.
  const sceneChain = useMemo(() => {
    if (!room) return [];
    return room.hotspots.filter((h) => h.afterScene).map((h) => h.id);
  }, [room]);

  const currentSceneKey = useMemo(() => {
    if (!room) return '';
    for (let i = sceneChain.length - 1; i >= 0; i--) {
      if (state.used.includes(sceneChain[i])) {
        const h = room.hotspots.find((x) => x.id === sceneChain[i]);
        if (h?.afterScene) return h.afterScene;
      }
    }
    return room.image;
  }, [room, sceneChain, state.used]);

  const prevSceneKey = useRef(currentSceneKey);
  const crossfade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (currentSceneKey !== prevSceneKey.current) {
      crossfade.setValue(0);
      Animated.timing(crossfade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      prevSceneKey.current = currentSceneKey;
    }
  }, [currentSceneKey, crossfade]);

  const heldItems = useMemo(
    () => (room ? state.inventory.map((id) => room.items.find((i) => i.id === id)!).filter(Boolean) : []),
    [room, state.inventory],
  );

  if (!sceneId || !room) {
    return (
      <GameShell title={t(lang, 'shell.escape.title')} subtitle={t(lang, 'shell.escape.subPicker')} onBack={onHome} lang={lang} right={<BetaPill />}>
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

  const onSpot = (hotspotId: string) => {
    lastAction.current = Date.now();
    setHintSpot(null);
    const { state: next, effect } = applyTap(room, state, hotspotId);
    setState(next);
    switch (effect.kind) {
      case 'found':
        sfx.good();
        if (effect.pop) setPops((p) => [...p, { id: hotspotId, pop: effect.pop! }]);
        if (effect.say) say(effect.say);
        break;
      case 'unlocked':
        sfx.good();
        if (effect.pop) setPops((p) => [...p, { id: hotspotId, pop: effect.pop! }]);
        if (effect.say) say(effect.say);
        break;
      case 'win':
        if (effect.pop) setPops((p) => [...p, { id: hotspotId, pop: effect.pop! }]);
        sayThen([effect.say ?? '', room.winText], () => { /* WinOverlay reads state.done */ });
        break;
      case 'locked':
        sfx.boing(0.4);
        if (effect.say) say(effect.say);
        break;
      case 'flavor':
        sfx.tap();
        if (effect.say) say(effect.say);
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
      right={<BetaPill />}
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={[styles.frame, shadows.sticker, { width: displayWidth, height: displayHeight }]}>
          <Image source={SCENE_THUMBS[currentSceneKey] ?? SCENE_IMAGES[currentSceneKey]} style={{ width: displayWidth, height: displayHeight }} resizeMode="cover" />
          {currentSceneKey !== room.image && (
            <Animated.Image
              source={SCENE_IMAGES[currentSceneKey]}
              style={{ position: 'absolute', width: displayWidth, height: displayHeight, opacity: crossfade }}
              resizeMode="cover"
            />
          )}
          {room.hotspots.map((h) => {
            const used = state.used.includes(h.id);
            const actionable = !used && (h.kind === 'search' || !h.needs || state.inventory.includes(h.needs));
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
                {!used && (hintSpot === h.id ? <PulseRing strong /> : h.kind !== 'search' ? <PulseRing dim={!actionable} /> : null)}
                {used && pops.find((p) => p.id === h.id) ? <PopSprite path={pops.find((p) => p.id === h.id)!.pop} /> : null}
                {used ? <SparkleBurst trigger="found" /> : null}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.tray} testID="escape-tray">
          {heldItems.length === 0 ? (
            <Text style={styles.trayEmpty}>{t(lang, 'escape.trayEmpty')}</Text>
          ) : heldItems.map((i) => (
            <Pressable
              key={i.id}
              testID={`escape-item-${i.id}`}
              onPress={() => onTray(i.id)}
              accessibilityRole="button"
              accessibilityLabel={i.label}
              style={[styles.trayItem, state.selected === i.id && styles.trayItemOn]}
            >
              <Text style={styles.trayEmoji}>{i.emoji}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <WinOverlay
        visible={state.done}
        message={room.winText}
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

// Small BETA pill in the header — parents should know this game is new.
function BetaPill() {
  return (
    <View style={styles.betaPill} testID="escape-beta">
      <Text style={styles.betaPillText}>BETA</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  betaPill: {
    backgroundColor: 'rgba(60,45,70,0.85)',
    borderRadius: 999,
    paddingHorizontal: 10,
    height: 44,
    justifyContent: 'center',
  },
  betaPillText: { color: colors.gold, fontFamily: fonts.display, fontSize: 12, letterSpacing: 1.5 },
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
