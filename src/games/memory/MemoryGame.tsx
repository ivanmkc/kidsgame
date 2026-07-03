import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SPOTIT_ICONS } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { WinOverlay } from '../../components/WinOverlay';
import { manifest } from '../../manifest';
import { makeRng } from '../../rng';
import { colors, fonts, shadows } from '../../theme';
import { MemoryCard, buildBoard } from './logic';

const COLS = 3;

interface Props {
  onHome: () => void;
  playerName?: string;
}

export function MemoryGame({ onHome, playerName }: Props) {
  const [board, setBoard] = useState<MemoryCard[]>(() =>
    buildBoard(makeRng(Math.floor(Math.random() * 1e9)), manifest.spotit.icons)
  );
  const [faceUp, setFaceUp] = useState<number[]>([]); // card keys currently revealed
  const [matched, setMatched] = useState<string[]>([]); // icon names matched
  const [moves, setMoves] = useState(0);
  const lockRef = useRef(false);
  const won = matched.length * 2 === board.length;

  const onFlip = (card: MemoryCard) => {
    if (lockRef.current || won) return;
    if (faceUp.includes(card.key) || matched.includes(card.icon)) return;
    const next = [...faceUp, card.key];
    setFaceUp(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next.map((k) => board.find((c) => c.key === k)!);
      if (a.icon === b.icon) {
        setMatched((m) => [...m, a.icon]);
        setFaceUp([]);
      } else {
        lockRef.current = true;
        setTimeout(() => {
          setFaceUp([]);
          lockRef.current = false;
        }, 750);
      }
    }
  };

  const reset = () => {
    setBoard(buildBoard(makeRng(Math.floor(Math.random() * 1e9)), manifest.spotit.icons));
    setFaceUp([]);
    setMatched([]);
    setMoves(0);
    lockRef.current = false;
  };

  const { width, height } = useWindowDimensions();
  const cardW = Math.min((width - 32 - (COLS - 1) * 12) / COLS, (height - 200) / 4 - 12, 150);

  return (
    <GameShell
      title="Memory Match"
      subtitle="Find all the matching pairs"
      onBack={onHome}
      right={<ScoreChip label={`🧠 ${matched.length}/${board.length / 2}`} testID="memory-score" />}
    >
      <View style={styles.board}>
        {board.map((card) => (
          <FlipCard
            key={card.key}
            card={card}
            size={cardW}
            up={faceUp.includes(card.key) || matched.includes(card.icon)}
            matched={matched.includes(card.icon)}
            onFlip={() => onFlip(card)}
          />
        ))}
      </View>
      <Text style={styles.moves} testID="memory-moves">Moves: {moves}</Text>
      <WinOverlay
        visible={won}
        message={playerName ? `Amazing memory, ${playerName}!` : 'You matched them all!'}
        onPlayAgain={reset}
        onHome={onHome}
      />
    </GameShell>
  );
}

function FlipCard({
  card, size, up, matched, onFlip,
}: {
  card: MemoryCard;
  size: number;
  up: boolean;
  matched: boolean;
  onFlip: () => void;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(t, { toValue: up ? 1 : 0, useNativeDriver: true, friction: 7 }).start();
  }, [up, t]);

  const frontRot = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRot = t.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  return (
    <Pressable onPress={onFlip} testID={`memory-card-${card.key}-${card.icon}`} style={{ width: size, height: size * 1.15 }}>
      <Animated.View
        style={[styles.face, styles.faceDown, shadows.soft, { transform: [{ perspective: 700 }, { rotateY: frontRot }] }]}
      >
        <Text style={{ fontSize: size * 0.4 }}>❓</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.face,
          styles.faceUp,
          shadows.soft,
          matched && styles.faceMatched,
          { transform: [{ perspective: 700 }, { rotateY: backRot }] },
        ]}
      >
        <Image source={SPOTIT_ICONS[card.icon]} style={{ width: '78%', height: '78%' }} resizeMode="contain" />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  board: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
  },
  faceDown: { backgroundColor: colors.teal },
  faceUp: { backgroundColor: colors.card, borderWidth: 3, borderColor: colors.teal },
  faceMatched: { borderColor: colors.green, backgroundColor: 'rgba(95,191,110,0.12)' },
  moves: {
    textAlign: 'center',
    fontFamily: fonts.bodyReg,
    color: colors.inkSoft,
    fontSize: 15,
    paddingBottom: 14,
  },
});
