import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, darken, fonts, shadows } from '../theme';
import { ChunkyButton } from './ChunkyButton';
import { Confetti } from './Confetti';

interface Props {
  visible: boolean;
  message: string;
  onPlayAgain: () => void;
  onHome: () => void;
}

export function WinOverlay({ visible, message, onPlayAgain, onHome }: Props) {
  const scale = useRef(new Animated.Value(0.3)).current;
  const stars = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    if (visible) {
      scale.setValue(0.3);
      stars.forEach((s) => s.setValue(0));
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
      Animated.stagger(
        160,
        stars.map((s) => Animated.spring(s, { toValue: 1, useNativeDriver: true, friction: 3 }))
      ).start();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  return (
    <View style={styles.backdrop} testID="win-overlay">
      <Confetti />
      <Animated.View style={[styles.card, shadows.lifted, { transform: [{ scale }] }]}>
        <View style={styles.starRow}>
          {stars.map((s, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.star,
                i === 1 && styles.starBig,
                {
                  opacity: s,
                  transform: [
                    { scale: s.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1.35, 1] }) },
                    { rotate: s.interpolate({ inputRange: [0, 1], outputRange: [i === 1 ? '-40deg' : '40deg', '0deg'] }) },
                  ],
                },
              ]}
            >
              ⭐
            </Animated.Text>
          ))}
        </View>
        <Text style={styles.message}>{message}</Text>
        <ChunkyButton label="Play Again 🔁" color={colors.green} darkColor={darken(colors.green)} onPress={onPlayAgain} testID="play-again" minWidth={224} />
        <ChunkyButton label="All Games 🏠" color={colors.purple} darkColor={darken(colors.purple)} onPress={onHome} testID="win-home" minWidth={224} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(67,48,75,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  card: {
    backgroundColor: colors.paper,
    borderRadius: 32,
    paddingVertical: 28,
    paddingHorizontal: 34,
    alignItems: 'center',
    gap: 12,
    minWidth: 280,
    borderWidth: 4,
    borderColor: colors.gold,
  },
  starRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 62 },
  star: { fontSize: 38 },
  starBig: { fontSize: 54, marginBottom: 2 },
  message: { fontSize: 25, fontFamily: fonts.display, color: colors.ink, textAlign: 'center' },
});
