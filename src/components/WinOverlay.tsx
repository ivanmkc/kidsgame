import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { sfx } from '../sound';
import { colors, darken, fonts, shadows } from '../theme';
import { ChunkyButton } from './ChunkyButton';
import { Confetti } from './Confetti';

interface Props {
  visible: boolean;
  message: string;
  /** Kind runner-up line under the message (duel modes). */
  sub?: string;
  /** Extra content between message and buttons — star rows / player chips. */
  stats?: React.ReactNode;
  /** Advance to fresh content — next scene or a new random round set. */
  onNext: () => void;
  onHome: () => void;
  nextLabel?: string;
}

export function WinOverlay({ visible, message, sub, stats, onNext, onHome, nextLabel }: Props) {
  const scale = useRef(new Animated.Value(0.3)).current;
  const stars = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  // Tap shield: a kid hammering the final answer would otherwise punch
  // through the freshly-mounted overlay onto its buttons (and beyond, into
  // the menu). Buttons arm only after the entrance settles.
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (visible) {
      sfx.win();
      setArmed(false);
      const t = setTimeout(() => setArmed(true), 600);
      scale.setValue(0.3);
      stars.forEach((s) => s.setValue(0));
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
      Animated.stagger(
        160,
        stars.map((s) => Animated.spring(s, { toValue: 1, useNativeDriver: true, friction: 3 }))
      ).start();
      return () => clearTimeout(t);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  return (
    <Pressable style={styles.backdrop} testID="win-overlay" onPress={() => {}}>
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
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
        {stats ?? null}
        <ChunkyButton label={nextLabel ?? 'Next Level ▶️'} color={colors.green} darkColor={darken(colors.green)} onPress={() => armed && onNext()} testID="play-again" minWidth={224} />
        <ChunkyButton label="All Games 🏠" color={colors.purple} darkColor={darken(colors.purple)} onPress={() => armed && onHome()} testID="win-home" minWidth={224} />
      </Animated.View>
    </Pressable>
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
  sub: { fontSize: 16, fontFamily: fonts.bodyReg, color: colors.inkSoft, textAlign: 'center', marginTop: -6 },
});
