import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Lang } from '../lang';
import { t } from '../i18n';
import { sfx } from '../sound';
import { colors, darken, fonts, shadows } from '../theme';
import { ChunkyButton } from './ChunkyButton';
import { Confetti } from './Confetti';

interface Props {
  visible: boolean;
  message: string;
  sub?: string;
  stats?: React.ReactNode;
  onNext: () => void;
  onHome: () => void;
  nextLabel?: string;
  lang?: Lang;
}

export function WinOverlay({ visible, message, sub, stats, onNext, onHome, nextLabel, lang = 'en' }: Props) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  const slideY = useRef(new Animated.Value(300)).current;
  const starAnims = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  // Tap shield: a kid hammering the final answer would otherwise punch
  // through the freshly-mounted overlay onto its buttons (and beyond, into
  // the menu). Buttons arm only after the entrance settles.
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (visible) {
      sfx.win();
      setArmed(false);
      const timer = setTimeout(() => setArmed(true), 600);
      slideY.setValue(300);
      starAnims.forEach((s) => s.setValue(0));
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
      Animated.stagger(
        160,
        starAnims.map((s) => Animated.spring(s, { toValue: 1, useNativeDriver: true, friction: 3 }))
      ).start();
      return () => clearTimeout(timer);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  const starSize = landscape ? 28 : 34;
  const bigStarSize = landscape ? 36 : 44;
  const msgSize = landscape ? 18 : 22;
  const btnWidth = landscape ? 170 : 200;
  const btnFont = landscape ? 16 : 18;
  const btnPad = landscape ? 10 : 12;

  return (
    <View style={styles.wrapper} pointerEvents="box-none" testID="win-overlay">
      <Confetti />
      <Animated.View
        style={[styles.banner, shadows.lifted, { transform: [{ translateY: slideY }] }]}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        <View style={landscape ? styles.rowLandscape : styles.colPortrait}>
          <View style={styles.celebRow}>
            <View style={styles.starRow}>
              {starAnims.map((s, i) => (
                <Animated.Text
                  key={i}
                  style={{
                    fontSize: i === 1 ? bigStarSize : starSize,
                    opacity: s,
                    transform: [
                      { scale: s.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1.35, 1] }) },
                      { rotate: s.interpolate({ inputRange: [0, 1], outputRange: [i === 1 ? '-40deg' : '40deg', '0deg'] }) },
                    ],
                  }}
                >
                  ⭐
                </Animated.Text>
              ))}
            </View>
            <View style={styles.textCol}>
              <Text style={[styles.message, { fontSize: msgSize }]} numberOfLines={2}>{message}</Text>
              {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
            </View>
          </View>
          {stats ? <View style={styles.statsWrap}>{stats}</View> : null}
          <View style={styles.btnRow}>
            <ChunkyButton label={nextLabel ?? t(lang, 'overlay.next')} color={colors.green} darkColor={darken(colors.green)} onPress={() => armed && onNext()} testID="play-again" minWidth={btnWidth} fontSize={btnFont} paddingVertical={btnPad} />
            <ChunkyButton label={t(lang, 'overlay.allGames')} color={colors.purple} darkColor={darken(colors.purple)} onPress={() => armed && onHome()} testID="win-home" minWidth={btnWidth} fontSize={btnFont} paddingVertical={btnPad} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    justifyContent: 'flex-end',
  },
  banner: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: colors.gold,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  colPortrait: { alignItems: 'center', gap: 10 },
  rowLandscape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  celebRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  starRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  textCol: { flexShrink: 1 },
  message: { fontFamily: fonts.display, color: colors.ink, textAlign: 'center' },
  sub: { fontSize: 14, fontFamily: fonts.bodyReg, color: colors.inkSoft, textAlign: 'center' },
  statsWrap: { flexDirection: 'row', justifyContent: 'center' },
  btnRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
});
