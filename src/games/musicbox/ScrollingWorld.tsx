import React from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { MUSICBOX_IMAGES } from '../../assets/images';
import { SceneDef } from './scenes';

// Three parallax layers at different scroll rates. Each layer is a
// pre-generated panoramic PNG strip (1280x400) that tiles horizontally.
// Two copies side by side give seamless scrolling.
//
// The bg (sky) is fully opaque and fills the entire stage. The mid
// (mountains) and fg (meadow) strips have transparent tops that let the
// sky show through. All three layers are tall enough that resizeMode
// "cover" makes them fill their containers edge to edge.

interface Props {
  scrollX: Animated.Value;
  scene: SceneDef;
}

const STRIP_W = 1280;
const TALL = 900;

export function ScrollingWorld({ scrollX, scene }: Props) {
  const bgSrc = MUSICBOX_IMAGES[`${scene.id}/bg`];
  const midSrc = MUSICBOX_IMAGES[`${scene.id}/mid`];
  const fgSrc = MUSICBOX_IMAGES[`${scene.id}/fg`];

  const bgTranslate = Animated.multiply(scrollX, -0.2);
  const midTranslate = Animated.multiply(scrollX, -0.5);
  const fgTranslate = Animated.multiply(scrollX, -1);

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Background sky: fills entire stage */}
      <Animated.View
        style={[
          styles.row,
          { top: 0, height: TALL, width: STRIP_W * 2,
            transform: [{ translateX: bgTranslate }] },
        ]}
      >
        <Image source={bgSrc} style={{ width: STRIP_W, height: TALL }} resizeMode="stretch" />
        <Image source={bgSrc} style={{ width: STRIP_W, height: TALL }} resizeMode="stretch" />
      </Animated.View>

      {/* Midground mountains: stretches up above the meadow so peaks show */}
      <Animated.View
        style={[
          styles.row,
          { bottom: 0, height: 650, width: STRIP_W * 2,
            backgroundColor: 'transparent',
            transform: [{ translateX: midTranslate }] },
        ]}
      >
        <Image source={midSrc} style={styles.midImg} resizeMode="stretch" />
        <Image source={midSrc} style={styles.midImg} resizeMode="stretch" />
      </Animated.View>

      {/* Foreground meadow: bottom portion */}
      <Animated.View
        style={[
          styles.row,
          { bottom: 0, height: 380, width: STRIP_W * 2,
            backgroundColor: 'transparent',
            transform: [{ translateX: fgTranslate }] },
        ]}
      >
        <Image source={fgSrc} style={styles.fgImg} resizeMode="cover" />
        <Image source={fgSrc} style={styles.fgImg} resizeMode="cover" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...(StyleSheet.absoluteFill as object),
    overflow: 'hidden',
  },
  row: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
  },
  midImg: {
    width: STRIP_W,
    height: 650,
    backgroundColor: 'transparent',
  },
  fgImg: {
    width: STRIP_W,
    height: 380,
    backgroundColor: 'transparent',
  },
});
