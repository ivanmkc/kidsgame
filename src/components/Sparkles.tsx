import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { prefersReducedMotion } from '../motion';

// SparkleBurst — a one-shot ring of sparkles radiating from the center of
// its parent (parent must be position:relative-ish; we absolute-fill).
export function SparkleBurst({ count = 6, size = 16, trigger }: { count?: number; size?: number; trigger: number | string }) {
  if (prefersReducedMotion()) return null;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <BurstPiece key={`${trigger}-${i}`} index={i} count={count} size={size} />
      ))}
    </>
  );
}

function BurstPiece({ index, count, size }: { index: number; count: number; size: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [t]);
  const angle = (index / count) * Math.PI * 2 + 0.4;
  const dist = 34 + (index % 3) * 10;
  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.burst,
        {
          fontSize: size,
          opacity: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
          transform: [
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * dist] }) },
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * dist] }) },
            { scale: t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 1.15, 0.6] }) },
            { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) },
          ],
        },
      ]}
    >
      {index % 2 === 0 ? '✨' : '⭐'}
    </Animated.Text>
  );
}

// TwinkleField — ambient looping twinkles for the menu / player picker.
export function TwinkleField({ count = 7 }: { count?: number }) {
  if (prefersReducedMotion()) return null;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Twinkle key={i} index={i} />
      ))}
    </>
  );
}

function Twinkle({ index }: { index: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay((index * 617) % 2400),
        Animated.timing(t, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay((index * 331) % 1500),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t, index]);
  const left = `${(index * 137 + 11) % 92 + 3}%`;
  const top = `${(index * 211 + 7) % 86 + 4}%`;
  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.twinkle,
        {
          left: left as unknown as number,
          top: top as unknown as number,
          fontSize: 13 + ((index * 53) % 9),
          opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0, 0.85] }),
          transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.1] }) }],
        },
      ]}
    >
      ✨
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  burst: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -8,
    marginTop: -10,
    zIndex: 5,
  },
  twinkle: { position: 'absolute', zIndex: 1 },
});
