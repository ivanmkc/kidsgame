import React, { useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import { Box } from '../manifest';
import { colors, shadows } from '../theme';

interface Props {
  source: number; // require() ref
  sceneW: number; // intrinsic scene size from manifest
  sceneH: number;
  displayWidth: number;
  boxes: { id: string; box: Box }[];
  foundIds: string[];
  hintId?: string | null; // temporarily flash this box's ring (easy mode)
  onHit: (id: string) => void;
  onMiss: () => void;
  testIDPrefix: string;
}

// Scene image with exact invisible hitboxes from the asset manifest.
// Found boxes get a celebratory ring; misses shake the whole frame.
export function TapScene({
  source, sceneW, sceneH, displayWidth, boxes, foundIds, hintId, onHit, onMiss, testIDPrefix,
}: Props) {
  const scale = displayWidth / sceneW;
  const displayHeight = sceneH * scale;
  const shake = useRef(new Animated.Value(0)).current;

  const miss = () => {
    Animated.sequence([
      Animated.timing(shake, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    onMiss();
  };

  const PAD = 8; // extra forgiveness around each hitbox, in scene px

  return (
    <Animated.View
      style={[styles.frame, shadows.sticker, { width: displayWidth, height: displayHeight, transform: [{ translateX: shake }] }]}
    >
      <Image source={source} style={{ width: displayWidth, height: displayHeight }} resizeMode="cover" />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={miss}
        testID={`${testIDPrefix}-backdrop`}
        accessibilityLabel="scene"
      />
      {boxes.map(({ id, box }) => {
        const found = foundIds.includes(id);
        const l = (box.x - PAD) * scale;
        const t = (box.y - PAD) * scale;
        const w = (box.w + 2 * PAD) * scale;
        const h = (box.h + 2 * PAD) * scale;
        return (
          <Pressable
            key={id}
            testID={`${testIDPrefix}-target-${id}`}
            onPress={() => (found ? undefined : onHit(id))}
            style={{ position: 'absolute', left: l, top: t, width: w, height: h }}
          >
            {found ? <FoundRing /> : hintId === id ? <HintRing /> : null}
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

function FoundRing() {
  const pop = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 4 }).start();
  }, [pop]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ring, { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }]}
    />
  );
}

function HintRing() {
  const pulse = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 450, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.hint, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.9] }) }]}
    />
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 4,
    borderColor: colors.card,
  },
  ring: {
    flex: 1,
    borderWidth: 5,
    borderColor: colors.ring,
    borderRadius: 999,
    backgroundColor: 'rgba(95,191,110,0.16)',
  },
  hint: {
    flex: 1,
    borderWidth: 5,
    borderColor: colors.gold,
    borderRadius: 999,
    backgroundColor: 'rgba(255,194,75,0.25)',
  },
});
