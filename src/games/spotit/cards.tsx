import React, { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import { SPOTIT_ICONS } from '../../assets/images';
import { SparkleBurst } from '../../components/Sparkles';
import { manifest } from '../../manifest';
import { Rng } from '../../rng';
import { colors, shadows } from '../../theme';
import { Card } from './logic';

// Classic Dobble layout: one icon in the middle, five in a ring, each with
// its own size + tilt so cards feel hand-scattered.
export interface Slot {
  cx: number;
  cy: number;
  size: number;
  rot: number;
}

export function layoutSlots(rng: Rng): Slot[] {
  const slots: Slot[] = [{ cx: 0.5, cy: 0.5, size: 0.24 + rng() * 0.06, rot: (rng() - 0.5) * 50 }];
  const startAngle = rng() * Math.PI * 2;
  for (let i = 0; i < 5; i++) {
    const a = startAngle + (i * Math.PI * 2) / 5;
    const r = 0.285 + rng() * 0.03;
    slots.push({
      cx: 0.5 + Math.cos(a) * r,
      cy: 0.5 + Math.sin(a) * r,
      size: 0.18 + rng() * 0.07,
      rot: (rng() - 0.5) * 60,
    });
  }
  return slots;
}

export function DealIn({ from, children }: { from: number; children: React.ReactNode }) {
  const t = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.spring(t, { toValue: 1, friction: 7, useNativeDriver: true }).start();
  }, [t]);
  return (
    <Animated.View
      style={{
        opacity: t,
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [from * 60, 0] }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: [`${from * 7}deg`, '0deg'] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

export function SpotCard({
  card, slots, size, onTap, wrongFlash, tint, testIDPrefix, disabled, hintSymbol,
}: {
  card: Card;
  slots: Slot[];
  size: number;
  onTap: (s: number) => void;
  wrongFlash: number | null;
  tint: string;
  testIDPrefix: string;
  disabled?: boolean;
  hintSymbol?: number | null;
}) {
  return (
    <View style={[styles.card, shadows.sticker, { width: size, height: size, borderRadius: size / 2, borderColor: tint }]}>
      {card.map((sym, i) => {
        const slot = slots[i];
        const s = slot.size * size;
        return (
          <SymbolButton
            key={sym}
            iconName={manifest.spotit.icons[sym]}
            wrong={wrongFlash === sym}
            onTap={() => onTap(sym)}
            testID={`${testIDPrefix}-symbol-${sym}`}
            left={slot.cx * size - s / 2}
            top={slot.cy * size - s / 2}
            size={s}
            rot={slot.rot}
            disabled={disabled}
            hinted={hintSymbol === sym}
          />
        );
      })}
    </View>
  );
}

export function SymbolButton({
  iconName, wrong, onTap, testID, left, top, size, rot, disabled, hinted,
}: {
  iconName: string;
  wrong: boolean;
  onTap: () => void;
  testID: string;
  left: number;
  top: number;
  size: number;
  rot: number;
  disabled?: boolean;
  hinted?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!hinted) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 380, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 380, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => { loop.stop(); scale.setValue(1); };
  }, [hinted, scale]);
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.8, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();
    onTap();
  };
  return (
    <Pressable onPress={press} disabled={disabled} testID={testID} accessibilityLabel={iconName} accessibilityRole="button" style={{ position: 'absolute', left, top, width: size, height: size }}>
      <Animated.View
        style={[
          styles.symbol,
          wrong && styles.wrong,
          { transform: [{ scale }, { rotate: `${rot}deg` }] },
        ]}
      >
        <Image source={SPOTIT_ICONS[iconName]} style={{ position: 'absolute', top: '9%', left: '9%', width: '82%', height: '82%' }} resizeMode="contain" />
        {hinted ? <SparkleBurst trigger={`hint-${iconName}`} count={5} size={12} /> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 5,
  },
  symbol: { flex: 1, borderRadius: 999 },
  wrong: { backgroundColor: 'rgba(232,86,79,0.35)' },
});
