import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { colors, shadows } from '../../theme';

// Breathing glow ring — borrowed from StoryGame's ChoiceSpot feel: locks
// glow softly all the time (they're the puzzle), hints glow hard.
export function PulseRing({ strong, dim }: { strong?: boolean; dim?: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: strong ? 450 : 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: strong ? 450 : 1100,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, strong]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        strong ? styles.ringStrong : null,
        {
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: dim ? [0.06, 0.2] : [0.25, strong ? 0.95 : 0.6],
          }),
        },
      ]}
    />
  );
}

export function FlyingEmoji({
  emoji,
  fromX,
  fromY,
  toX,
  toY,
  onDone,
}: {
  emoji: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  onDone: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(progress, {
      toValue: 1,
      friction: 7,
      tension: 40,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onDone();
    });
    return () => {
      progress.stopAnimation();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const dx = toX - fromX;
  const dy = toY - fromY;
  const arcPeak = -Math.min(80, Math.abs(dy) * 0.4);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: fromX - 20,
        top: fromY - 20,
        width: 40,
        height: 40,
        zIndex: 100,
        transform: [
          {
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, dx],
            }),
          },
          {
            translateY: progress.interpolate({
              inputRange: [0, 0.2, 0.5, 0.8, 1],
              outputRange: [
                0,
                dy * 0.2 + arcPeak * 0.64,
                dy * 0.5 + arcPeak,
                dy * 0.8 + arcPeak * 0.64,
                dy,
              ],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 0.3, 0.7, 1],
              outputRange: [1.4, 1.6, 1.2, 1],
            }),
          },
        ],
      }}
    >
      <Text style={{ fontSize: 36, textAlign: 'center' }}>{emoji}</Text>
    </Animated.View>
  );
}

export function PopBurst({
  source,
  cx,
  cy,
  onDone,
}: {
  source: number;
  cx: number;
  cy: number;
  onDone: () => void;
}) {
  const pop = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(pop, {
      toValue: 1,
      friction: 5,
      tension: 60,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 350,
        delay: 250,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onDone();
      });
    });
    return () => {
      pop.stopAnimation();
      fade.stopAnimation();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const size = 120;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: cx - size / 2,
        top: cy - size / 2,
        width: size,
        height: size,
        zIndex: 90,
        opacity: fade,
        transform: [
          {
            scale: pop.interpolate({
              inputRange: [0, 0.6, 1],
              outputRange: [0.2, 1.25, 1.0],
            }),
          },
        ],
      }}
    >
      <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
    </Animated.View>
  );
}

export function FeedbackEmoji({
  emoji,
  cx,
  cy,
  isShake,
  testID,
  onDone,
}: {
  emoji: string;
  cx: number;
  cy: number;
  isShake?: boolean;
  testID?: string;
  onDone: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      onDone();
    }, 500);
    return () => {
      clearTimeout(timer);
      progress.stopAnimation();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const size = 46;
  const shakeX = isShake
    ? progress.interpolate({
        inputRange: [0, 0.15, 0.3, 0.45, 0.6, 1],
        outputRange: [0, -8, 8, -6, 6, 0],
      })
    : 0;
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden={true}
      importantForAccessibility="no"
      aria-hidden={true}
      style={{
        position: 'absolute',
        left: cx - size / 2,
        top: cy - size / 2,
        width: size,
        height: size,
        zIndex: 95,
        opacity: progress.interpolate({
          inputRange: [0, 0.1, 0.7, 1],
          outputRange: [0, 1, 1, 0],
        }),
        transform: [
          { translateX: shakeX },
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -28],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 0.2, 1],
              outputRange: [0.5, 1.25, 1],
            }),
          },
        ],
      }}
    >
      <View style={[styles.feedbackBubble, shadows.soft]}>
        <Text style={styles.feedbackEmoji}>{emoji}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: {
    flex: 1,
    margin: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,214,110,0.16)',
    shadowColor: colors.gold,
    shadowOpacity: 0.85,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
  },
  ringStrong: {
    backgroundColor: 'rgba(255,177,61,0.22)',
    shadowColor: '#FFB13D',
    shadowRadius: 34,
  },
  feedbackBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  feedbackEmoji: { fontSize: 26, textAlign: 'center' },
});
