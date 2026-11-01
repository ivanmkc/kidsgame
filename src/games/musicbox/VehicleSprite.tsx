import React from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import { MUSICBOX_IMAGES } from '../../assets/images';
import { SceneDef } from './scenes';

interface Props {
  scene: SceneDef;
  translateY: Animated.AnimatedInterpolation<number> | Animated.AnimatedAddition<number>;
  scale: Animated.AnimatedInterpolation<number>;
  rotate?: Animated.AnimatedInterpolation<string>;
  flourishRotate?: Animated.AnimatedInterpolation<string>;
}

const VEHICLE_SIZE = 160;

export function VehicleSprite({ scene, translateY, scale, rotate, flourishRotate }: Props) {
  const src = MUSICBOX_IMAGES[`${scene.id}/vehicle`];
  const topPct = `${scene.vehicleY * 100}%`;

  const transforms: unknown[] = [
    { translateY: translateY as unknown as Animated.AnimatedInterpolation<number> },
    { scale },
  ];
  if (rotate) transforms.push({ rotate });
  if (flourishRotate) transforms.push({ rotate: flourishRotate });

  return (
    <Animated.View
      style={[
        styles.vehicle,
        {
          top: topPct as unknown as number,
          transform: transforms,
        },
      ] as unknown as Animated.WithAnimatedObject<import('react-native').ViewStyle>[]}
      pointerEvents="none"
      testID="musicbox-vehicle"
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
