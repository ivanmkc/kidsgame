import React, { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SCENE_IMAGES, SCENE_THUMBS } from '../assets/images';
import { colors, fonts, shadows } from '../theme';

export interface SceneOption {
  id: string;
  name: string;
  image: string; // manifest-relative path
  flagged?: boolean; // not yet quality-verified — show a warning badge
  level?: 'easy' | 'medium' | 'hard';
}

const LEVEL_EMOJI = { easy: '😊', medium: '🌟', hard: '🔥' } as const;

interface Props {
  title: string;
  options: SceneOption[];
  onPick: (id: string) => void;
  onSurprise: () => void;
}

// Pre-game theme chooser: one big tappable card per scene.
export function ScenePicker({ title, options, onPick, onSurprise }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Pressable
        onPress={onSurprise}
        testID="scene-surprise"
        style={({ pressed }) => [styles.surprise, shadows.soft, pressed && styles.pressed]}
      >
        <Text style={styles.surpriseText}>🎲 Surprise me!</Text>
      </Pressable>
      <View style={styles.grid}>
        {options.map((o, i) => (
          <PopIn key={o.id} delay={60 + i * 70} tilt={(i % 2 === 0 ? -1 : 1) * 0.9}>
            <Pressable
              onPress={() => onPick(o.id)}
              testID={`scene-pick-${o.id}`}
              style={({ pressed }) => [styles.card, shadows.sticker, pressed && styles.pressed]}
            >
              <Image source={SCENE_THUMBS[o.image] ?? SCENE_IMAGES[o.image]} style={styles.thumb} resizeMode="cover" />
              <Text style={styles.name}>{o.name}</Text>
              {o.flagged ? (
                <View style={styles.flagBadge} testID={`scene-flagged-${o.id}`}>
                  <Text style={styles.flagText}>⚠️</Text>
                </View>
              ) : null}
              {o.level ? (
                <View style={styles.levelBadge} testID={`scene-level-${o.id}-${o.level}`}>
                  <Text style={styles.flagText}>{LEVEL_EMOJI[o.level]}</Text>
                </View>
              ) : null}
            </Pressable>
          </PopIn>
        ))}
      </View>
    </ScrollView>
  );
}

function PopIn({ delay, tilt, children }: { delay: number; tilt: number; children: React.ReactNode }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(t, { toValue: 1, friction: 6, delay, useNativeDriver: true }).start();
  }, [t, delay]);
  return (
    <Animated.View
      style={{
        opacity: t,
        transform: [
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
          { rotate: `${tilt}deg` },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingBottom: 28, paddingHorizontal: 14 },
  title: { fontSize: 20, fontFamily: fonts.display, color: colors.ink, marginBottom: 10 },
  surprise: {
    backgroundColor: colors.gold,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 26,
    marginBottom: 14,
  },
  surpriseText: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    width: '100%',
    maxWidth: 640,
  },
  card: {
    width: 190,
    borderRadius: 20,
    backgroundColor: colors.paper,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.card,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  thumb: { width: '100%', height: 120 },
  flagBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  flagText: { fontSize: 14 },
  levelBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  name: {
    fontFamily: fonts.displayMed,
    fontSize: 16,
    color: colors.ink,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
