import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SPOTIT_ICONS } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty, settingsFor } from '../../difficulty';
import { manifest } from '../../manifest';
import { Rng, makeRng } from '../../rng';
import { colors, shadows } from '../../theme';
import { Card, buildDeck, dealRound } from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  seed?: number;
}

// Classic Dobble layout: one icon in the middle, five in a ring, each with
// its own size + tilt so cards feel hand-scattered.
interface Slot {
  cx: number;
  cy: number;
  size: number;
  rot: number;
}

function layoutSlots(rng: Rng): Slot[] {
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

export function SpotItGame({ onHome, difficulty, seed }: Props) {
  const deck = useMemo(() => buildDeck(), []);
  const roundsToWin = settingsFor(difficulty).spotitRounds;
  const rngRef = useRef(makeRng(seed ?? Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState(() => dealRound(rngRef.current, deck));
  const [slots, setSlots] = useState<{ top: Slot[]; bottom: Slot[] }>(() => ({
    top: layoutSlots(rngRef.current),
    bottom: layoutSlots(rngRef.current),
  }));
  const [score, setScore] = useState(0);
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);
  const [roundKey, setRoundKey] = useState(0); // retriggers the deal-in animation
  const [elapsed, setElapsed] = useState(0);
  const won = score >= roundsToWin;

  useEffect(() => {
    if (won) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [won]);
  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  const nextRound = () => {
    setRound(dealRound(rngRef.current, deck));
    setSlots({ top: layoutSlots(rngRef.current), bottom: layoutSlots(rngRef.current) });
    setRoundKey((k) => k + 1);
  };

  const onTap = (symbol: number) => {
    if (won) return;
    if (symbol === round.answer) {
      const next = score + 1;
      setScore(next);
      setWrongFlash(null);
      if (next < roundsToWin) nextRound();
    } else {
      setWrongFlash(symbol);
      setTimeout(() => setWrongFlash((w) => (w === symbol ? null : w)), 450);
    }
  };

  const reset = () => {
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setWrongFlash(null);
    setElapsed(0);
    nextRound();
  };

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const availH = height - 84;
  // Two cards side by side in landscape, stacked in portrait — sized to fit.
  const cardSize = isLandscape
    ? Math.min(availH - 24, (width - 3 * 24) / 2, 460)
    : Math.min((availH - 60) / 2, width - 40, 400);

  return (
    <GameShell
      title="Spot It!"
      subtitle="Tap the picture that is on BOTH cards"
      onBack={onHome}
      right={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ScoreChip label={`⏱ ${mmss}`} testID="spotit-timer" />
          <ScoreChip label={`⭐ ${score}/${roundsToWin}`} testID="spotit-score" />
        </View>
      }
    >
      <View style={[styles.board, isLandscape && styles.boardRow]}>
        <DealIn key={`t${roundKey}`} from={-1}>
          <SpotCard card={round.top} slots={slots.top} size={cardSize} onTap={onTap} wrongFlash={wrongFlash} tint={colors.teal} testIDPrefix="top" />
        </DealIn>
        <Text style={styles.vs}>👀</Text>
        <DealIn key={`b${roundKey}`} from={1}>
          <SpotCard card={round.bottom} slots={slots.bottom} size={cardSize} onTap={onTap} wrongFlash={wrongFlash} tint={colors.red} testIDPrefix="bottom" />
        </DealIn>
      </View>
      <WinOverlay
        visible={won}
        message={`You matched them all in ${mmss}! ⏱`}
        onPlayAgain={reset}
        onHome={onHome}
      />
    </GameShell>
  );
}

function DealIn({ from, children }: { from: number; children: React.ReactNode }) {
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

function SpotCard({
  card, slots, size, onTap, wrongFlash, tint, testIDPrefix,
}: {
  card: Card;
  slots: Slot[];
  size: number;
  onTap: (s: number) => void;
  wrongFlash: number | null;
  tint: string;
  testIDPrefix: string;
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
    <Pressable onPress={press} testID={testID} accessibilityLabel={iconName} accessibilityRole="button" style={{ position: 'absolute', left, top, width: size, height: size }}>
      <Animated.View
        style={[
          styles.symbol,
          wrong && styles.wrong,
          { transform: [{ scale }, { rotate: `${rot}deg` }] },
        ]}
      >
        <Image source={SPOTIT_ICONS[iconName]} style={{ position: 'absolute', top: '9%', left: '9%', width: '82%', height: '82%' }} resizeMode="contain" />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingBottom: 8 },
  boardRow: { flexDirection: 'row', gap: 10 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 5,
  },
  vs: { fontSize: 22 },
  symbol: { flex: 1, borderRadius: 999 },
  wrong: { backgroundColor: 'rgba(232,86,79,0.35)' },
});
