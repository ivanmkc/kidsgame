import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { SceneDef } from './scenes';

// Three parallax layers at different scroll rates. Each layer is a wide
// gradient strip rendered as a CSS linear-gradient (no image assets needed
// for the MVP placeholder — generated panoramic PNGs replace these later).

interface Props {
  scrollX: Animated.Value;
  scene: SceneDef;
}

const LAYER_WIDTH = 3000;

const PALETTES: Record<string, { bg: string[]; mid: string[]; fg: string[] }> = {
  twinkle: {
    bg: ['#1B1464', '#2E2080', '#4A3CA0', '#6B5CC0', '#8B7CDF', '#7060C8', '#4A3CA0', '#2E2080'],
    mid: ['#3B5998', '#4A7AB5', '#5B9BD5', '#6BB8E0', '#5B9BD5', '#4A7AB5'],
    fg: ['#4CAF50', '#66BB6A', '#81C784', '#A5D6A7', '#81C784', '#66BB6A'],
  },
};

function gradientStyle(colors: string[]): object {
  const stops = colors.map((c, i) => `${c} ${(i / (colors.length - 1)) * 100}%`).join(', ');
  return { backgroundImage: `linear-gradient(to right, ${stops})` };
}

export function ScrollingWorld({ scrollX, scene }: Props) {
  const palette = PALETTES[scene.id] ?? PALETTES.twinkle;

  const bgTranslate = Animated.multiply(scrollX, -0.2);
  const midTranslate = Animated.multiply(scrollX, -0.5);
  const fgTranslate = Animated.multiply(scrollX, -1);

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View
        style={[
          styles.layer,
          styles.bgLayer,
          gradientStyle(palette.bg) as object,
          { width: LAYER_WIDTH * 2, transform: [{ translateX: bgTranslate }] },
        ]}
      />
      <Animated.View
        style={[
          styles.layer,
          styles.midLayer,
          gradientStyle(palette.mid) as object,
          { width: LAYER_WIDTH * 2, transform: [{ translateX: midTranslate }] },
        ]}
      />
      <Animated.View
        style={[
          styles.layer,
          styles.fgLayer,
          gradientStyle(palette.fg) as object,
          { width: LAYER_WIDTH * 2, transform: [{ translateX: fgTranslate }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...(StyleSheet.absoluteFill as object),
  },
  layer: {
    position: 'absolute',
    left: 0,
    height: '100%' as unknown as number,
  },
  bgLayer: {
    top: 0,
    height: '100%' as unknown as number,
    zIndex: 0,
  },
  midLayer: {
    top: '30%' as unknown as number,
    height: '45%' as unknown as number,
    zIndex: 1,
    borderTopLeftRadius: 80,
    borderTopRightRadius: 120,
    opacity: 0.85,
  },
  fgLayer: {
    bottom: 0,
    top: undefined as unknown as number,
    height: '35%' as unknown as number,
    zIndex: 2,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 60,
  },
});
