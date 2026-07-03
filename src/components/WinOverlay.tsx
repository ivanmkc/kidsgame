import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadows } from '../theme';

interface Props {
  visible: boolean;
  message: string;
  onPlayAgain: () => void;
  onHome: () => void;
}

export function WinOverlay({ visible, message, onPlayAgain, onHome }: Props) {
  const scale = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.3);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
    }
  }, [visible, scale]);

  if (!visible) return null;

  return (
    <View style={styles.backdrop} testID="win-overlay">
      <Animated.View style={[styles.card, shadows.card, { transform: [{ scale }] }]}>
        <Text style={styles.stars}>⭐⭐⭐</Text>
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
    backgroundColor: 'rgba(58,56,69,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 14,
    minWidth: 260,
  },
  stars: { fontSize: 44 },
  message: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center' },
  btn: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: 210,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  btnText: { fontSize: 19, fontWeight: '800', color: '#fff' },
});
