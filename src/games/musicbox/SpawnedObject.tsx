import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet } from 'react-native';
import { MUSICBOX_IMAGES } from '../../assets/images';
import type { SpawnZone } from './logic';

export interface SpawnEntry {
  id: number;
  x: number;
  y: number;
  scrollAtSpawn: number;
  spriteKey: string;
  sceneId: string;
  big: boolean;
  zone: SpawnZone;
}

interface Props {
  entry: SpawnEntry;
  scrollX: Animated.Value;
  onTapSpawn?: (entry: SpawnEntry) => void;
}

const BASE_SIZE = 56;
const BIG_SIZE = 72;

const IDLE_CONFIGS: Record<SpawnZone, { dy: number; dur: number }> = {
  sky:    { dy: 6, dur: 2200 },
  mid:    { dy: 4, dur: 2600 },
  ground: { dy: 3, dur: 3000 },
};

export function SpawnedObject({ entry, scrollX, onTapSpawn }: Props) {
  const spawnIn = useRef(new Animated.Value(0)).current;
  const idle = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const src = MUSICBOX_IMAGES[`${entry.sceneId}/${entry.spriteKey}`];
  const size = entry.big ? BIG_SIZE : BASE_SIZE;
  const cfg = IDLE_CONFIGS[entry.zone];

  useEffect(() => {
    Animated.spring(spawnIn, {
      toValue: 1,
      friction: 5,
      tension: 60,
      useNativeDriver: true,
    }).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(idle, { toValue: 1, duration: cfg.dur, useNativeDriver: true }),
          Animated.timing(idle, { toValue: 0, duration: cfg.dur, useNativeDriver: true }),
        ]),
      ).start();
    });
  }, [spawnIn, idle, cfg.dur]);

  const worldTranslateX = useMemo(
    () => Animated.add(Animated.multiply(scrollX, -1), entry.scrollAtSpawn),
    [scrollX, entry.scrollAtSpawn],
  );

  const handlePress = useCallback(() => {
    wiggle.setValue(0);
    Animated.spring(wiggle, { toValue: 1, friction: 4, useNativeDriver: true }).start(() =>
      wiggle.setValue(0),
    );
    onTapSpawn?.(entry);
  }, [entry, onTapSpawn, wiggle]);

  return (
    <Animated.View
      style={[
        styles.spawn,
        {
          left: entry.x - size / 2,
          top: entry.y - size / 2,
          width: size,
          height: size,
          opacity: spawnIn.interpolate({
            inputRange: [0, 0.3, 1],
            outputRange: [0, 1, 1],
          }),
          transform: [
            { translateX: worldTranslateX },
            {
              scale: Animated.add(
                spawnIn.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.2, 1.15, 1],
                }),
                wiggle.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.15, 0],
                }),
              ),
            },
            {
              translateY: idle.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -cfg.dy],
              }),
            },
            {
              rotate: Animated.add(
                idle.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, entry.zone === 'ground' ? 3 : 0, entry.zone === 'ground' ? -3 : 0],
                }),
                wiggle.interpolate({
                  inputRange: [0, 0.25, 0.5, 0.75, 1],
                  outputRange: [0, -8, 8, -4, 0],
                }),
              ).interpolate({
                inputRange: [-15, 15],
                outputRange: ['-15deg', '15deg'],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable onPress={handlePress} hitSlop={8}>
        <Image source={src} style={{ width: size, height: size }} resizeMode="contain" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  spawn: {
    position: 'absolute',
    zIndex: 10,
  },
});
