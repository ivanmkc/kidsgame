import React, { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GameShell } from '../../components/GameShell';
import { WinOverlay } from '../../components/WinOverlay';
import { makeRng } from '../../rng';
import { colors, shadows } from '../../theme';
import { Card, SYMBOLS, buildDeck, dealRound } from './logic';

const ROUNDS_TO_WIN = 5;

interface Props {
  onHome: () => void;
  seed?: number;
}

export function SpotItGame({ onHome, seed }: Props) {
  const deck = useMemo(() => buildDeck(), []);
  const [gameSeed, setGameSeed] = useState(seed ?? Math.floor(Math.random() * 1e9));
  const rngRef = useRef(makeRng(gameSeed));
  const [round, setRound] = useState(() => dealRound(rngRef.current, deck));
  const [score, setScore] = useState(0);
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);
  const won = score >= ROUNDS_TO_WIN;

  const onTap = (symbol: number) => {
    if (won) return;
    if (symbol === round.answer) {
      const next = score + 1;
      setScore(next);
      setWrongFlash(null);
      if (next < ROUNDS_TO_WIN) setRound(dealRound(rngRef.current, deck));
    } else {
      setWrongFlash(symbol);
      setTimeout(() => setWrongFlash((w) => (w === symbol ? null : w)), 450);
    }
  };

  const reset = () => {
    const s = Math.floor(Math.random() * 1e9);
    setGameSeed(s);
    rngRef.current = makeRng(s);
    setScore(0);
    setWrongFlash(null);
    setRound(dealRound(rngRef.current, deck));
  };

  return (
    <GameShell
      title="Spot It!"
      subtitle="Tap the picture that is on BOTH cards"
      onBack={onHome}
      right={<Text style={styles.score} testID="spotit-score">⭐ {score}/{ROUNDS_TO_WIN}</Text>}
    >
      <View style={styles.board}>
        <SpotCard card={round.top} onTap={onTap} wrongFlash={wrongFlash} tint={colors.secondary} testIDPrefix="top" />
        <Text style={styles.vs}>👀</Text>
        <SpotCard card={round.bottom} onTap={onTap} wrongFlash={wrongFlash} tint={colors.primary} testIDPrefix="bottom" />
      </View>
      <WinOverlay visible={won} message="You spotted them all!" onPlayAgain={reset} onHome={onHome} />
    </GameShell>
  );
}

function SpotCard({
  card,
  onTap,
  wrongFlash,
  tint,
  testIDPrefix,
}: {
  card: Card;
  onTap: (s: number) => void;
  wrongFlash: number | null;
  tint: string;
  testIDPrefix: string;
}) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - 32, 420);
  return (
    <View style={[styles.card, shadows.card, { width: size, borderColor: tint }]}>
      {card.map((sym) => (
        <SymbolButton
          key={sym}
          symbol={sym}
          wrong={wrongFlash === sym}
          onTap={() => onTap(sym)}
          testID={`${testIDPrefix}-symbol-${sym}`}
        />
      ))}
    </View>
  );
}

function SymbolButton({
  symbol,
  wrong,
  onTap,
  testID,
}: {
  symbol: number;
  wrong: boolean;
  onTap: () => void;
  testID: string;
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
    <Pressable onPress={press} testID={testID} style={styles.symbolWrap}>
      <Animated.View style={[styles.symbol, wrong && styles.wrong, { transform: [{ scale }] }]}>
        <Text style={styles.symbolText}>{SYMBOLS[symbol]}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  score: { fontSize: 18, fontWeight: '800', color: colors.text },
  board: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 26,
    borderWidth: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  vs: { fontSize: 26, marginVertical: 2 },
  symbolWrap: { padding: 4 },
  symbol: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrong: { backgroundColor: '#FFB4B4' },
  symbolText: { fontSize: 44 },
});
