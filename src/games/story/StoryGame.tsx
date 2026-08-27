import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SCENE_IMAGES } from '../../assets/images';
import { ChunkyButton } from '../../components/ChunkyButton';
import { Confetti } from '../../components/Confetti';
import { SparkleBurst } from '../../components/Sparkles';
import { GameShell } from '../../components/GameShell';
import { ScenePicker } from '../../components/ScenePicker';
import { Lang } from '../../lang';
import { t } from '../../i18n';
import { SCENE_AR, manifest, StoryChoice, StoryNode, StoryScare , StoryFx} from '../../manifest';
import { say, sayThen, sfx, useSay } from '../../sound';
import { colors, darken, fonts, shadows } from '../../theme';

interface Props {
  onHome: () => void;
  sceneId?: string; // story id
  onPickScene: (id: string) => void;
  onBackToPicker: () => void;
  lang?: Lang;
}

// Backstop for the hotspot gate: how long to wait for a spoken page before
// showing the choices anyway. Only reached when audio stalls (autoplay
// still blocked, a clip that never fires 'ended') — the normal path is the
// sequence's own completion callback. Sized off the shipped clips: a
// hotspot page reads for 20s at the median and 29s at the 99th percentile
// (tools/voice_durations.py), so 35s never cuts a real page short, and it
// bounds the damage when a clip is wrong.
const NARRATION_CAP_MS = 35000;

// A narrated picture story where the kid steers: every node is spoken
// aloud (pre-readers), two big choices branch the tale, four endings per
// story make replays genuinely different.
export function StoryGame({ onHome, sceneId, onPickScene, onBackToPicker, lang = 'en' }: Props) {
  const stories = manifest.stories ?? [];
  const story = stories.find((s) => s.id === sceneId) ?? null;
  const [nodeId, setNodeId] = useState('start');

  // Tap-to-dive: choices with in-scene hotspots zoom the camera INTO the
  // tapped spot (door, slide, boat...) before the story advances.
  const zoom = useRef(new Animated.Value(0)).current;
  const [zoomTarget, setZoomTarget] = useState<{ cx: number; cy: number } | null>(null);
  // Veo action clip playing over the scene (the hero DOES the tapped action)
  const [clip, setClip] = useState<{ src: string; next: string } | null>(null);
  const animating = useRef(false);
  // Hotspots stay hidden until the page has been read aloud. A pre-reader
  // who can already see a glowing door taps it instead of listening, and
  // the story IS the game — so the picture holds no targets until the
  // narration lets go. Keyed off the spoken sequence actually finishing,
  // never a bare timer.
  const [narrated, setNarrated] = useState(false);
  // breadcrumb trail for Go back / Try another way (+ redo for arrow keys)
  const hist = useRef<string[]>([]);
  const redo = useRef<string[]>([]);

  useEffect(() => {
    setNodeId('start');
    zoom.setValue(0);
    setZoomTarget(null);
    setClip(null);
    hist.current = [];
    animating.current = false;
  }, [sceneId]); // eslint-disable-line react-hooks/exhaustive-deps

  const node: StoryNode | null = story ? story.nodes[nodeId] ?? story.nodes.start : null;

  // Precache what each choice leads to while the current page is read
  // aloud: warm the browser HTTP cache for the next scenes' images and
  // this node's action clips, so a tap cuts straight to the new page
  // instead of a loading beat. Web only; RNW resolves require() refs to
  // {uri} objects at runtime.
  useEffect(() => {
    if (Platform.OS !== 'web' || !story || !node) return;
    const urls: string[] = [];
    const push = (src: unknown) => {
      const uri = typeof src === 'string' ? src : (src as { uri?: string })?.uri;
      if (uri) urls.push(uri);
    };
    for (const c of node.choices ?? []) {
      const next = story.nodes[c.next];
      if (next?.image) push(Image.resolveAssetSource ? Image.resolveAssetSource(SCENE_IMAGES[next.image]) : SCENE_IMAGES[next.image]);
      if (c.video) urls.push(c.video);
      if (next && !next.choices?.length && next.video) urls.push(next.video);
    }
    const cleanups: (() => void)[] = [];
    for (const u of urls) {
      if (u.endsWith('.mp4')) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'video';
        link.href = u;
        document.head.appendChild(link);
        cleanups.push(() => link.remove());
      } else {
        const im = new window.Image();
        im.src = u;
      }
    }
    return () => { cleanups.forEach((f) => f()); };
  }, [story, node]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    if (!node) return;
    let stale = false;
    setNarrated(false);
    if (!node.choices?.length && node.bad) sfx.boing();
    const cs = node.choices ?? [];
    const menu = cs.map((c) => c.label);
    const hots = cs.length > 0 && cs.every((c) => c.hot);
    const lead = hots ? 'Tap where you want to go!' : 'What should happen next?';
    const lines = menu.length ? [node.text, lead, ...menu] : [node.text];
    // sayThen (not saySequence) so muted play, a missing clip and a stalled
    // one all still reveal: silence must never leave a dead picture.
    sayThen(lines, () => { if (!stale) setNarrated(true); }, NARRATION_CAP_MS);
    return () => { stale = true; };
  }, [node]);

  // A scare or fx tap supersedes the page narration, which kills its
  // completion callback — so the interrupting line takes over the gate and
  // the hotspots arrive when IT finishes.
  const speakOver = (line: string) => {
    sayThen([line], () => setNarrated(true), NARRATION_CAP_MS);
  };

  useSay(story ? null : 'Which story shall we read?');
  const { width, height } = useWindowDimensions();

  // Arrow keys page through the story like a book: left = back, right =
  // forward again (redo). Web only; refs keep the handler stable.
  const nav = useRef({ back: () => {}, fwd: () => {} });
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') nav.current.back();
      if (e.key === 'ArrowRight') nav.current.fwd();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!story) {
    return (
      <GameShell title={t(lang, 'shell.story.title')} subtitle={t(lang, 'shell.story.subPicker')} onBack={onHome} lang={lang}>
        <ScenePicker
          title={t(lang, 'picker.story')}
          lang={lang}
          options={stories.map((s) => ({ id: s.id, name: s.title, image: s.nodes.start.image }))}
          onPick={onPickScene}
          onSurprise={() => stories.length && onPickScene(stories[Math.floor(Math.random() * stories.length)].id)}
        />
      </GameShell>
    );
  }
  if (!node) return null;

  const ar = SCENE_AR;
  const isEnd = !node.choices || node.choices.length === 0;
  const hasHots = !isEnd && node.choices!.every((c) => c.hot);
  // hotspot nodes have no button row below, so the picture gets the room
  const imgW = Math.min(width - 24, (height - 84 - (hasHots ? 110 : 250)) * ar, 900);
  const imgH = imgW / ar;

  const advance = (next: string) => {
    hist.current.push(nodeId);
    redo.current = [];
    setNodeId(next);
  };
  const goBack = () => {
    const prev = hist.current.pop();
    if (prev) {
      sfx.tap();
      redo.current.push(nodeId);
      setNodeId(prev);
    }
  };
  const goForward = () => {
    const next = redo.current.pop();
    if (next) {
      sfx.tap();
      hist.current.push(nodeId);
      setNodeId(next);
    }
  };

  nav.current = { back: goBack, fwd: goForward };

  const ZOOM = 2.4;
  const diveInto = (c: StoryChoice) => {
    if (animating.current || !c.hot) return;
    animating.current = true;
    sfx.tap();
    say(c.label);
    // Veo clip of the hero doing the action, when one exists; zoom otherwise
    if (c.video && Platform.OS === 'web') {
      setClip({ src: c.video, next: c.next });
      return;
    }
    const s = imgW / 1280;
    setZoomTarget({ cx: (c.hot.x + c.hot.w / 2) * s, cy: (c.hot.y + c.hot.h / 2) * s });
    zoom.setValue(0);
    Animated.timing(zoom, { toValue: 1, duration: 600, useNativeDriver: true }).start(() => {
      advance(c.next);
      zoom.setValue(0);
      setZoomTarget(null);
      animating.current = false;
    });
  };
  const onClipDone = () => {
    const p = clip;
    setClip(null);
    animating.current = false;
    if (p) advance(p.next);
  };
  const tx = zoomTarget ? (imgW / 2 - zoomTarget.cx) * ZOOM : 0;
  const ty = zoomTarget ? (imgH / 2 - zoomTarget.cy) * ZOOM : 0;

  return (
    <GameShell title={t(lang, 'shell.story.title')} subtitle={story.title} onBack={onBackToPicker}
      backKind="picker" lang={lang}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={[styles.frame, shadows.sticker]}>
          <Animated.View
            style={{
              width: imgW,
              height: imgH,
              opacity: zoom.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateX: zoom.interpolate({ inputRange: [0, 1], outputRange: [0, tx] }) },
                { translateY: zoom.interpolate({ inputRange: [0, 1], outputRange: [0, ty] }) },
                { scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, ZOOM] }) },
              ],
            }}
          >
            <Image source={SCENE_IMAGES[node.image]} style={{ width: imgW, height: imgH }} resizeMode="cover" />
            {isEnd && node.video && Platform.OS === 'web' ? (
              // the ending scene comes alive: gentle looping ambient clip
              // over the still (which doubles as the loading poster)
              <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="story-end-clip">
                {React.createElement('video', {
                  src: node.video,
                  autoPlay: true,
                  muted: true,
                  loop: true,
                  playsInline: true,
                  style: { width: '100%', height: '100%', objectFit: 'cover' },
                })}
              </View>
            ) : null}
            {node.scare ? <ScareSpot key={nodeId} scare={node.scare} scale={imgW / 1280} onSpeak={speakOver} /> : null}
            {(node.fx ?? []).map((f, i) => (
              <FxSpot key={`${nodeId}-fx${i}`} fx={f} scale={imgW / 1280} onSpeak={speakOver} />
            ))}
            {hasHots && !clip && narrated
              ? node.choices!.map((c, i) => (
                  <ChoiceSpot key={c.next} choice={c} index={i} scale={imgW / 1280} onPick={() => diveInto(c)} />
                ))
              : null}
          </Animated.View>
          {clip && Platform.OS === 'web' ? (
            <View style={StyleSheet.absoluteFill} testID="story-clip">
              {React.createElement('video', {
                src: clip.src,
                autoPlay: true,
                muted: true,
                playsInline: true,
                onEnded: onClipDone,
                onError: onClipDone,
                style: { width: '100%', height: '100%', objectFit: 'cover' },
              })}
            </View>
          ) : null}
          {/* No in-story back button: remembering the path IS the game.
              Arrow keys remain as a desktop/dev affordance. */}
          {isEnd && !node.bad ? <Confetti /> : null}
        </View>
        <Text style={styles.text} testID={`story-text-${nodeId}`}>{node.text}</Text>
        {isEnd ? (
          <View style={styles.choices}>
            {node.bad ? (
              <ChunkyButton
                label={t(lang, 'story.tryAgain')}
                color={colors.gold}
                darkColor={darken(colors.gold)}
                onPress={() => { hist.current = []; redo.current = []; setNodeId('start'); }}
                testID="story-try-again"
                minWidth={230}
              />
            ) : null}
            <ChunkyButton
              label={node.bad ? t(lang, 'story.startOver') : t(lang, 'story.readAgain')}
              color={colors.green}
              darkColor={darken(colors.green)}
              onPress={() => { if (!node.bad) sfx.win(); hist.current = []; setNodeId('start'); }}
              testID="story-restart"
              minWidth={230}
            />
            <ChunkyButton
              label={t(lang, 'story.allStories')}
              color={colors.purple}
              darkColor={darken(colors.purple)}
              onPress={onBackToPicker}
              testID="story-home"
              minWidth={230}
            />
          </View>
        ) : hasHots ? null : (
          <View style={styles.choices}>
            {node.choices!.map((c, i) => c.icon ? (
              <Pressable
                key={c.next}
                onPress={() => { sfx.tap(); say(c.label); hist.current.push(nodeId); setNodeId(c.next); }}
                testID={`story-choice-${c.next}`}
                accessibilityLabel={c.label}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.pickTile, shadows.sticker,
                  { borderColor: i === 0 ? colors.teal : colors.gold },
                  pressed && { transform: [{ scale: 0.95 }] },
                ]}
              >
                <Image source={SCENE_IMAGES[c.icon]} style={styles.pickImg} resizeMode="contain" />
                <Text style={styles.pickCaption} numberOfLines={2}>{c.label}</Text>
              </Pressable>
            ) : (
              <ChunkyButton
                key={c.next}
                label={`${c.label}`}
                color={i === 0 ? colors.teal : colors.gold}
                darkColor={darken(i === 0 ? colors.teal : colors.gold)}
                onPress={() => { sfx.tap(); say(c.label); hist.current.push(nodeId); setNodeId(c.next); }}
                testID={`story-choice-${c.next}`}
                minWidth={230}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </GameShell>
  );
}

// An in-scene choice: the door/slide/boat itself glows gently and the kid
// taps it directly — no buttons off the picture. The glow breathes so
// pre-readers spot both options without any text.
function ChoiceSpot({ choice, index, scale, onPick }: {
  choice: StoryChoice; index: number; scale: number; onPick: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);
  const h = choice.hot!;
  const color = index === 0 ? colors.teal : colors.gold;
  return (
    <Pressable
      onPress={onPick}
      testID={`story-choice-${choice.next}`}
      accessibilityLabel={choice.label}
      accessibilityRole="button"
      style={{ position: 'absolute', left: h.x * scale, top: h.y * scale, width: h.w * scale, height: h.h * scale }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.hotGlow,
          {
            borderColor: color,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.95] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
          },
        ]}
      />
    </Pressable>
  );
}

// Non-nav surprise: a whisper-subtle shimmer invites a tap; tapping makes
// the region itself bounce with a sparkle burst + sfx (+ optional spoken
// line). Never navigates — a toy inside the page, re-tappable forever.
function FxSpot({ fx, scale, onSpeak }: {
  fx: StoryFx; scale: number; onSpeak: (line: string) => void;
}) {
  const bounce = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);
  const trigger = () => {
    if (fx.sting === 'flip') sfx.flip(); else if (fx.sting === 'tap') sfx.tap(); else sfx.boing();
    if (fx.line) onSpeak(fx.line);
    setBurst((b) => b + 1);
    bounce.setValue(0);
    Animated.spring(bounce, { toValue: 1, friction: 3, useNativeDriver: true }).start(() => bounce.setValue(0));
  };
  return (
    <Pressable
      onPress={trigger}
      testID="story-fx"
      accessibilityLabel="Something fun is here"
      accessibilityRole="button"
      style={{ position: 'absolute', left: fx.x * scale, top: fx.y * scale, width: fx.w * scale, height: fx.h * scale }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.fxShimmer,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.28] }),
            transform: [
              { scale: bounce.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.12, 1] }) },
            ],
          },
        ]}
      />
      {burst > 0 ? <SparkleBurst key={burst} trigger="found" /> : null}
    </Pressable>
  );
}

// The dare-spot: a soft shimmer marks the region; tapping it makes the
// surprise SPRING out with a sting, then (after the story's beat) the
// spoken reveal lands. Re-tappable forever — that's the toy.
function ScareSpot({ scare, scale, onSpeak }: {
  scare: StoryScare; scale: number; onSpeak: (line: string) => void;
}) {
  const [popped, setPopped] = useState(false);
  const spring = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 650, useNativeDriver: true }),
      ])
    ).start();
    return () => { if (revealTimer.current) clearTimeout(revealTimer.current); };
  }, [pulse]);

  const trigger = () => {
    if (scare.sting === 'thunder') sfx.thunder(); else sfx.boing();
    setPopped(true);
    spring.setValue(0);
    Animated.spring(spring, { toValue: 1, friction: 3.2, tension: 160, useNativeDriver: true }).start();
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => onSpeak(scare.reveal), scare.delay);
  };

  const l = scare.x * scale;
  const t = scare.y * scale;
  const w = scare.w * scale;
  const h = scare.h * scale;
  const popSize = Math.max(w, h) * 1.35;
  return (
    <>
      <Pressable
        onPress={trigger}
        testID="story-scare"
        accessibilityLabel="Something is hiding here"
        accessibilityRole="button"
        hitSlop={12}
        style={{ position: 'absolute', left: l, top: t, width: w, height: h }}
      >
        {!popped ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.shimmer, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.55] }) }]}
          />
        ) : null}
      </Pressable>
      {popped ? (
        <Animated.View
          pointerEvents="none"
          testID="story-scare-pop"
          style={{
            position: 'absolute',
            left: l + w / 2 - popSize / 2,
            top: t + h / 2 - popSize / 2,
            width: popSize,
            height: popSize,
            transform: [
              { scale: spring.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1.25, 1] }) },
              { rotate: spring.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '0deg'] }) },
            ],
          }}
        >
          <Image source={SCENE_IMAGES[scare.pop]} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  backChip: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 999,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChipText: { fontSize: 20 },
  fxShimmer: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: 'rgba(255,236,160,0.5)',
  },
  hotGlow: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 5,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  shimmer: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: 'rgba(255,235,150,0.9)',
    backgroundColor: 'rgba(255,235,150,0.18)',
  },
  wrap: { alignItems: 'center', gap: 12, paddingBottom: 20, paddingHorizontal: 12 },
  frame: { borderRadius: 22, overflow: 'hidden', borderWidth: 5, borderColor: colors.card, backgroundColor: colors.card },
  text: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    textAlign: 'center',
    maxWidth: 640,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  pickTile: {
    width: 190,
    height: 178,
    borderRadius: 24,
    borderWidth: 5,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  pickImg: { width: '100%', height: 118 },
  pickCaption: { fontFamily: fonts.displayMed, fontSize: 13, color: colors.ink, textAlign: 'center', marginTop: 4 },
});
