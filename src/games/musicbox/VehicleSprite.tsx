import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SceneDef } from './scenes';

interface Props {
  scene: SceneDef;
  translateY: Animated.AnimatedInterpolation<number>;
  scale: Animated.AnimatedInterpolation<number>;
}

// Placeholder: emoji character in a balloon basket. Replaced by a generated
// chroma sprite once the asset pipeline runs.
const VEHICLE_EMOJI: Record<string, string> = {
  twinkle: '🎈',
};

const CHARACTER_EMOJI: Record<string, string> = {
  twinkle: '🐰',
};

export function VehicleSprite({ scene, translateY, scale }: Props) {
  const vehicleEmoji = VEHICLE_EMOJI[scene.id] ?? '🎈';
  const charEmoji = CHARACTER_EMOJI[scene.id] ?? '🐰';
  const topPct = `${scene.vehicleY * 100}%`;

  return (
    <Animated.View
      style={[
        styles.vehicle,
        {
          top: topPct as unknown as number,
          transform: [{ translateY }, { scale }],
        },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.balloon}>{vehicleEmoji}</Text>
      <View style={styles.basket}>
        <Text style={styles.character}>{charEmoji}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  vehicle: {
    position: 'absolute',
    left: '18%' as unknown as number,
    zIndex: 5,
    alignItems: 'center',
  },
  balloon: {
    fontSize: 72,
  },
  basket: {
    marginTop: -12,
    backgroundColor: '#8B4513',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  character: {
    fontSize: 36,
  },
});
