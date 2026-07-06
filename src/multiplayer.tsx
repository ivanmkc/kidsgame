import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { ChunkyButton } from './components/ChunkyButton';
import { useSay } from './sound';
import { colors, darken, fonts, shadows } from './theme';

// ---------------------------------------------------------------------------
// 2-Player experiment toggle — persisted like difficulty.ts (default OFF).
// ---------------------------------------------------------------------------

const KEY = 'kgb.twoPlayer.v1';

export function loadTwoPlayer(): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(KEY) === 'on';
  }
  return false;
}

export function saveTwoPlayer(on: boolean): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try { window.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* non-fatal */ }
  }
}

/** App.tsx is the single owner; games receive twoPlayerEnabled as a prop. */
export function useTwoPlayer(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => loadTwoPlayer());
  const set = (v: boolean) => { setOn(v); saveTwoPlayer(v); };
  return [on, set];
}

// ---------------------------------------------------------------------------
// Player identity — fixed to physical seats, carried by color AND animal
// emoji AND spoken name (zero reading, colorblind-safe).
// ---------------------------------------------------------------------------

export type PlayerIx = 0 | 1;

export interface MpPlayer {
  ix: PlayerIx;
  name: string;
  emoji: string;
  color: string;
}

export const MP_PLAYERS: readonly [MpPlayer, MpPlayer] = [
  { ix: 0, name: 'Foxy', emoji: '🦊', color: '#D66FA8' /* pink */ },
  { ix: 1, name: 'Bunny', emoji: '🐰', color: '#3E9BB8' /* teal */ },
] as const;

export function nextTurn(t: PlayerIx): PlayerIx {
  return (1 - t) as PlayerIx;
}

// ---------------------------------------------------------------------------
// ModePicker — the on-entry 1P/2P chooser shared by all three games.
// Rendered as conditional JSX inside the game's single return — NEVER via an
// early return before hooks (production-crash precedent).
// ---------------------------------------------------------------------------

export function ModePicker({ onPick }: { onPick: (mode: 'solo' | '2p') => void }) {
  useSay('How many players?');
  return (
    <View style={styles.backdrop} testID="mode-picker">
      <View style={[styles.pickerCard, shadows.lifted]}>
        <Text style={styles.pickerTitle}>How many players?</Text>
        <ChunkyButton
          label="1 Player 🧒"
          color={colors.green}
          darkColor={darken(colors.green)}
          onPress={() => onPick('solo')}
          testID="mp-choose-1p"
          minWidth={250}
          fontSize={24}
          paddingVertical={19}
        />
        <ChunkyButton
          label="2 Players 👧👧"
          color={colors.purple}
          darkColor={darken(colors.purple)}
          onPress={() => onPick('2p')}
          testID="mp-choose-2p"
          minWidth={250}
          fontSize={24}
          paddingVertical={19}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// PlayerChip — per-player score chip (hidden header + memory chips row).
// ---------------------------------------------------------------------------

export function PlayerChip({
  player, count, active, testID,
}: {
  player: PlayerIx;
  count: number;
  active: boolean;
  testID: string;
}) {
  const p = MP_PLAYERS[player];
  const pulse = useRef(new Animated.Value(1)).current;
  const prev = useRef(count);
  useEffect(() => {
    if (prev.current !== count) {
      prev.current = count;
      pulse.setValue(1.35);
      Animated.spring(pulse, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    }
  }, [count, pulse]);
  return (
    <Animated.View
      testID={testID}
      accessibilityLabel={`${p.name} has ${count}`}
      style={[
        styles.chip,
        shadows.soft,
        { borderColor: p.color },
        active ? styles.chipActive : styles.chipIdle,
        { transform: [{ scale: active ? 1.12 : 1 }] },
      ]}
    >
      <Text style={styles.chipEmoji}>{p.emoji}</Text>
      <Animated.Text style={[styles.chipCount, { transform: [{ scale: pulse }] }]}>{count}</Animated.Text>
    </Animated.View>
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
  pickerCard: {
    backgroundColor: colors.paper,
    borderRadius: 32,
    paddingVertical: 28,
    paddingHorizontal: 34,
    alignItems: 'center',
    gap: 14,
    minWidth: 300,
    borderWidth: 4,
    borderColor: colors.gold,
  },
  pickerTitle: { fontSize: 27, fontFamily: fonts.display, color: colors.ink, textAlign: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: 999,
    borderWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  // "gold ring": warm gold glow shadow reads as a ring on the round chip
  // without fighting the player-color border (identity must stay visible).
  chipActive: { ...shadows.glowGold, backgroundColor: '#FFF9EC' },
  chipIdle: { opacity: 0.55 },
  chipEmoji: { fontSize: 26 },
  chipCount: { fontSize: 20, fontFamily: fonts.display, color: colors.ink },
});
