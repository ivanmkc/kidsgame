import React from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import { MUSICBOX_IMAGES } from '../../assets/images';
import { SceneDef } from './scenes';

interface Props {
  scene: SceneDef;
  translateY: Animated.AnimatedInterpolation<number>;
  scale: Animated.AnimatedInterpolation<number>;
}

const VEHICLE_SIZE = 160;

export function VehicleSprite({ scene, translateY, scale }: Props) {
  const src = MUSICBOX_IMAGES[`${scene.id}/vehicle`];
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
      <Image
        source={src}
        style={styles.sprite}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  vehicle: {
    position: 'absolute',
    left: '12%' as unknown as number,
    zIndex: 5,
    alignItems: 'center',
  },
  sprite: {
    width: VEHICLE_SIZE,
    height: VEHICLE_SIZE,
  },
});
