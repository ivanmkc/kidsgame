import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import { MUSICBOX_IMAGES } from '../../assets/images';
import type { SpawnZone } from './logic';

export interface SpawnEntry {
  id: number;
  x: number;
  y: number;
  spriteKey: string;
  sceneId: string;
  big: boolean;
  zone: SpawnZone;
}

interface Props {
  entry: SpawnEntry;
}

const BASE_SIZE = 56;
const BIG_SIZE = 72;

export function SpawnedObject({ entry }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const src = MUSICBOX_IMAGES[`${entry.sceneId}/${entry.spriteKey}`];

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 2800,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const drift = entry.zone === 'sky' ? -60 : entry.zone === 'ground' ? -40 : -50;
  const size = entry.big ? BIG_SIZE : BASE_SIZE;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.spawn,
        {
          left: entry.x - size / 2,
          top: entry.y - size / 2,
          width: size,
          height: size,
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
      <Image source={src} style={{ width: size, height: size }} resizeMode="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  spawn: {
    position: 'absolute',
    zIndex: 10,
  },
});
