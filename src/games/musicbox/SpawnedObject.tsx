import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import type { SpawnZone } from './logic';

export interface SpawnEntry {
  id: number;
  x: number;
  y: number;
  emoji: string;
  big: boolean;
  zone: SpawnZone;
}

interface Props {
  entry: SpawnEntry;
}

export function SpawnedObject({ entry }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 2800,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const drift = entry.zone === 'sky' ? -60 : entry.zone === 'ground' ? -40 : -50;

  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.spawn,
        {
          left: entry.x - 20,
          top: entry.y - 20,
          fontSize: entry.big ? 42 : 30,
          opacity: anim.interpolate({
            inputRange: [0, 0.08, 0.7, 1],
            outputRange: [0, 1, 0.8, 0],
          }),
          transform: [
            {
              scale: anim.interpolate({
                inputRange: [0, 0.1, 0.3, 1],
                outputRange: [0.3, 1.15, 1, 0.85],
              }),
            },
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, drift],
              }),
            },
            {
              rotate: anim.interpolate({
                inputRange: [0, 1],
                outputRange: ['-8deg', '12deg'],
              }),
            },
          ],
        },
      ]}
    >
      {entry.emoji}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  spawn: {
    position: 'absolute',
    zIndex: 10,
  },
});
