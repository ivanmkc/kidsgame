import React from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import { MUSICBOX_IMAGES } from '../../assets/images';
import { SceneDef } from './scenes';

interface Props {
  scene: SceneDef;
  translateY: Animated.AnimatedInterpolation<number> | Animated.AnimatedAddition<number>;
  scale: Animated.AnimatedInterpolation<number>;
  rotate?: Animated.AnimatedInterpolation<string>;
}

const VEHICLE_SIZE = 160;

export function VehicleSprite({ scene, translateY, scale, rotate }: Props) {
  const src = MUSICBOX_IMAGES[`${scene.id}/vehicle`];
  const topPct = `${scene.vehicleY * 100}%`;

  return (
    <Animated.View
      style={[
        styles.vehicle,
        {
          top: topPct as unknown as number,
          transform: rotate
            ? [
                { translateY: translateY as unknown as Animated.AnimatedInterpolation<number> },
                { scale },
                { rotate },
              ]
            : [
                { translateY: translateY as unknown as Animated.AnimatedInterpolation<number> },
                { scale },
              ],
        },
      ] as unknown as Animated.WithAnimatedObject<import('react-native').ViewStyle>[]}
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
