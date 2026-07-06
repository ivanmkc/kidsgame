import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SCENE_IMAGES } from '../../assets/images';
import { ChunkyButton } from '../../components/ChunkyButton';
import { Confetti } from '../../components/Confetti';
import { GameShell } from '../../components/GameShell';
import { ScenePicker } from '../../components/ScenePicker';
import { SCENE_AR, manifest, StoryNode, StoryScare } from '../../manifest';
import { say, saySequence, sfx } from '../../sound';
import { colors, darken, fonts, shadows } from '../../theme';

interface Props {
  onHome: () => void;
  sceneId?: string; // story id
  onPickScene: (id: string) => void;
  onBackToPicker: () => void;
}

// A narrated picture story where the kid steers: every node is spoken
// aloud (pre-readers), two big choices branch the tale, four endings per
// story make replays genuinely different.
export function StoryGame({ onHome, sceneId, onPickScene, onBackToPicker }: Props) {
  const stories = manifest.stories ?? [];
  const story = stories.find((s) => s.id === sceneId) ?? null;
  const [nodeId, setNodeId] = useState('start');

  useEffect(() => setNodeId('start'), [sceneId]);

  const node: StoryNode | null = story ? story.nodes[nodeId] ?? story.nodes.start : null;

  useEffect(() => {
    if (!node) return;
    const menu = (node.choices ?? []).map((c) => c.label);
    saySequence(menu.length ? [node.text, 'What should happen next?', menu[0], 'or...', menu[1] ?? ''] : [node.text]);
  }, [node]);

  const { width, height } = useWindowDimensions();

  if (!story) {
    return (
      <GameShell title="Story Path" subtitle="Pick a story" onBack={onHome}>
        <ScenePicker
          title="Which story shall we read?"
          options={stories.map((s) => ({ id: s.id, name: s.title, image: s.nodes.start.image }))}
          onPick={onPickScene}
          onSurprise={() => stories.length && onPickScene(stories[Math.floor(Math.random() * stories.length)].id)}
        />
      </GameShell>
    );
  }
  if (!node) return null;

  const ar = SCENE_AR;
  const imgW = Math.min(width - 24, (height - 84 - 190) * ar, 900);
  const isEnd = !node.choices || node.choices.length === 0;

  return (
    <GameShell title="Story Path" subtitle={story.title} onBack={onBackToPicker}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={[styles.frame, shadows.sticker]}>
          <Image source={SCENE_IMAGES[node.image]} style={{ width: imgW, height: imgW / ar }} resizeMode="cover" />
          {node.scare ? <ScareSpot key={nodeId} scare={node.scare} scale={imgW / 1280} /> : null}
          {isEnd ? <Confetti /> : null}
        </View>
        <Text style={styles.text} testID={`story-text-${nodeId}`}>{node.text}</Text>
        {isEnd ? (
          <View style={styles.choices}>
            <ChunkyButton
              label="The End! Read again 📖"
              color={colors.green}
              darkColor={darken(colors.green)}
              onPress={() => { sfx.win(); setNodeId('start'); }}
              testID="story-restart"
              minWidth={230}
            />
            <ChunkyButton
              label="All Stories 🏠"
              color={colors.purple}
              darkColor={darken(colors.purple)}
              onPress={onBackToPicker}
              testID="story-home"
              minWidth={230}
            />
          </View>
        ) : (
          <View style={styles.choices}>
            {node.choices!.map((c, i) => c.icon ? (
              <Pressable
                key={c.next}
                onPress={() => { sfx.tap(); say(c.label); setNodeId(c.next); }}
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
                <Text style={styles.pickCaption} numberOfLines={1}>{c.label}</Text>
              </Pressable>
            ) : (
              <ChunkyButton
                key={c.next}
                label={`${c.label}`}
                color={i === 0 ? colors.teal : colors.gold}
                darkColor={darken(i === 0 ? colors.teal : colors.gold)}
                onPress={() => { sfx.tap(); say(c.label); setNodeId(c.next); }}
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

// The dare-spot: a soft shimmer marks the region; tapping it makes the
// surprise SPRING out with a sting, then (after the story's beat) the
// spoken reveal lands. Re-tappable forever — that's the toy.
function ScareSpot({ scare, scale }: { scare: StoryScare; scale: number }) {
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
    revealTimer.current = setTimeout(() => say(scare.reveal), scare.delay);
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
