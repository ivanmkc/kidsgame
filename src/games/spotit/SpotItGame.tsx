import React, { useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SPOTIT_ICONS } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { WinOverlay } from '../../components/WinOverlay';
import { manifest } from '../../manifest';
import { Rng, makeRng } from '../../rng';
import { colors, shadows } from '../../theme';
import { Card, buildDeck, dealRound } from './logic';

const ROUNDS_TO_WIN = 5;

interface Props {
  onHome: () => void;
  seed?: number;
  playerName?: string;
}

// Classic Dobble layout: one icon in the middle, five in a ring, each with
// its own size + tilt so cards feel hand-scattered.
interface Slot {
  cx: number; // 0..1 within card
  cy: number;
  size: number; // fraction of card width
  rot: number; // degrees
}

function layoutSlots(rng: Rng): Slot[] {
  const slots: Slot[] = [{ cx: 0.5, cy: 0.5, size: 0.24 + rng() * 0.06, rot: (rng() - 0.5) * 50 }];
  const startAngle = rng() * Math.PI * 2;
  for (let i = 0; i < 5; i++) {
    const a = startAngle + (i * Math.PI * 2) / 5;
    const r = 0.31 + rng() * 0.04;
    slots.push({
      cx: 0.5 + Math.cos(a) * r,
      cy: 0.5 + Math.sin(a) * r,
      size: 0.19 + rng() * 0.09,
      rot: (rng() - 0.5) * 60,
    });
  }
  return slots;
}

export function SpotItGame({ onHome, seed, playerName }: Props) {
  const deck = useMemo(() => buildDeck(), []);
  const rngRef = useRef(makeRng(seed ?? Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState(() => dealRound(rngRef.current, deck));
  const [slots, setSlots] = useState<{ top: Slot[]; bottom: Slot[] }>(() => ({
    top: layoutSlots(rngRef.current),
    bottom: layoutSlots(rngRef.current),
  }));
  const [score, setScore] = useState(0);
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);
  const won = score >= ROUNDS_TO_WIN;

  const nextRound = () => {
    setRound(dealRound(rngRef.current, deck));
    setSlots({ top: layoutSlots(rngRef.current), bottom: layoutSlots(rngRef.current) });
  };

  const onTap = (symbol: number) => {
    if (won) return;
    if (symbol === round.answer) {
      const next = score + 1;
      setScore(next);
      setWrongFlash(null);
      if (next < ROUNDS_TO_WIN) nextRound();
    } else {
      setWrongFlash(symbol);
      setTimeout(() => setWrongFlash((w) => (w === symbol ? null : w)), 450);
    }
  };

  const reset = () => {
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setWrongFlash(null);
    nextRound();
  };

  return (
    <GameShell
      title="Spot It!"
      subtitle="Tap the picture that is on BOTH cards"
      onBack={onHome}
      right={<ScoreChip label={`⭐ ${score}/${ROUNDS_TO_WIN}`} testID="spotit-score" />}
    >
      <View style={styles.board}>
        <SpotCard card={round.top} slots={slots.top} onTap={onTap} wrongFlash={wrongFlash} tint={colors.teal} testIDPrefix="top" />
        <Text style={styles.vs}>👀</Text>
        <SpotCard card={round.bottom} slots={slots.bottom} onTap={onTap} wrongFlash={wrongFlash} tint={colors.red} testIDPrefix="bottom" />
      </View>
      <WinOverlay
        visible={won}
        message={playerName ? `Sharp eyes, ${playerName}!` : 'You spotted them all!'}
        onPlayAgain={reset}
        onHome={onHome}
      />
    </GameShell>
  );
}

function SpotCard({
  card, slots, onTap, wrongFlash, tint, testIDPrefix,
}: {
  card: Card;
  slots: Slot[];
  onTap: (s: number) => void;
  wrongFlash: number | null;
  tint: string;
  testIDPrefix: string;
}) {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width - 40, (height - 220) / 2, 380);
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
          />
        );
      })}
    </View>
  );
}

function SymbolButton({
  iconName, wrong, onTap, testID, left, top, size, rot,
}: {
  iconName: string;
  wrong: boolean;
  onTap: () => void;
  testID: string;
  left: number;
  top: number;
  size: number;
  rot: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.8, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();
    onTap();
  };
  return (
    <Pressable onPress={press} testID={testID} style={{ position: 'absolute', left, top, width: size, height: size }}>
      <Animated.View
        style={[
          styles.symbol,
          wrong && styles.wrong,
          { transform: [{ scale }, { rotate: `${rot}deg` }] },
        ]}
      >
        <Image source={SPOTIT_ICONS[iconName]} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingBottom: 10 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 5,
  },
  vs: { fontSize: 24, marginVertical: 0 },
  symbol: { flex: 1, borderRadius: 999 },
  wrong: { backgroundColor: 'rgba(232,86,79,0.35)' },
});
