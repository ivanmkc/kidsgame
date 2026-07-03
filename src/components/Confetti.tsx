import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions } from 'react-native';

const PIECES = ['🎉', '⭐', '🎈', '🎊', '✨'];

// Lightweight celebratory rain — pieces fall & spin once when mounted.
export function Confetti({ count = 18 }: { count?: number }) {
  const { width, height } = useWindowDimensions();
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Piece key={i} index={i} screenW={width} screenH={height} />
      ))}
    </>
  );
}

function Piece({ index, screenW, screenH }: { index: number; screenW: number; screenH: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const startX = ((index * 137) % 100) / 100 * screenW;
  const drift = (((index * 61) % 40) - 20) * 3;
  const delay = (index % 6) * 180;
  const size = 20 + ((index * 53) % 18);

  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: 2600 + ((index * 97) % 900),
      delay,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [t, delay, index]);

  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.piece,
        {
          left: startX,
          fontSize: size,
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-60, screenH + 60] }) },
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, drift] }) },
            { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${((index % 2) * 2 - 1) * 360}deg` ] }) },
          ],
        },
      ]}
    >
      {PIECES[index % PIECES.length]}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, zIndex: 20 },
});
