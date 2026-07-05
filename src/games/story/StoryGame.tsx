import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SCENE_IMAGES } from '../../assets/images';
import { ChunkyButton } from '../../components/ChunkyButton';
import { Confetti } from '../../components/Confetti';
import { GameShell } from '../../components/GameShell';
import { ScenePicker } from '../../components/ScenePicker';
import { manifest, StoryNode } from '../../manifest';
import { say, sfx } from '../../sound';
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
    if (node) say(node.text);
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

  const ar = 1280 / 720;
  const imgW = Math.min(width - 24, (height - 84 - 190) * ar, 900);
  const isEnd = !node.choices || node.choices.length === 0;

  return (
    <GameShell title="Story Path" subtitle={story.title} onBack={onBackToPicker}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={[styles.frame, shadows.sticker]}>
          <Image source={SCENE_IMAGES[node.image]} style={{ width: imgW, height: imgW / ar }} resizeMode="cover" />
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
            {node.choices!.map((c, i) => (
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

const styles = StyleSheet.create({
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
});
