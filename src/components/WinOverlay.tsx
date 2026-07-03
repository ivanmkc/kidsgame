import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, shadows } from '../theme';
import { Confetti } from './Confetti';

interface Props {
  visible: boolean;
  message: string;
  onPlayAgain: () => void;
  onHome: () => void;
}

export function WinOverlay({ visible, message, onPlayAgain, onHome }: Props) {
  const scale = useRef(new Animated.Value(0.3)).current;
  const starPop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.3);
      starPop.setValue(0);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
      Animated.spring(starPop, { toValue: 1, useNativeDriver: true, friction: 3, delay: 250 }).start();
    }
  }, [visible, scale, starPop]);

  if (!visible) return null;

  return (
    <View style={styles.backdrop} testID="win-overlay">
      <Confetti />
      <Animated.View style={[styles.card, shadows.sticker, { transform: [{ scale }] }]}>
        <Animated.Text style={[styles.stars, { transform: [{ scale: starPop }] }]}>⭐⭐⭐</Animated.Text>
        <Text style={styles.message}>{message}</Text>
        <Pressable
          onPress={onPlayAgain}
          style={({ pressed }) => [styles.btn, { backgroundColor: colors.green }, pressed && styles.pressed]}
          testID="play-again"
        >
          <Text style={styles.btnText}>Play Again 🔁</Text>
        </Pressable>
        <Pressable
          onPress={onHome}
          style={({ pressed }) => [styles.btn, { backgroundColor: colors.purple }, pressed && styles.pressed]}
          testID="win-home"
        >
          <Text style={styles.btnText}>All Games 🏠</Text>
        </Pressable>
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
    paddingVertical: 30,
    paddingHorizontal: 34,
    alignItems: 'center',
    gap: 14,
    minWidth: 270,
    borderWidth: 4,
    borderColor: colors.gold,
  },
  stars: { fontSize: 46 },
  message: { fontSize: 26, fontFamily: fonts.display, color: colors.ink, textAlign: 'center' },
  btn: {
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: 220,
    alignItems: 'center',
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  btnText: { fontSize: 20, fontFamily: fonts.display, color: '#fff' },
});
