import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SPOTIT_ICONS } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { SparkleBurst } from '../../components/Sparkles';
import { WinOverlay } from '../../components/WinOverlay';
import { settingsFor } from '../../difficulty';
import { manifest } from '../../manifest';
import { Player } from '../../profile';
import { makeRng } from '../../rng';
import { colors, fonts, shadows } from '../../theme';
import { MemoryCard, buildBoard } from './logic';

interface Props {
  onHome: () => void;
  player: Player | null;
}

export function MemoryGame({ onHome, player }: Props) {
  const settings = settingsFor(player?.difficulty);
  const pairs = settings.memoryPairs;
  const [board, setBoard] = useState<MemoryCard[]>(() =>
    buildBoard(makeRng(Math.floor(Math.random() * 1e9)), manifest.spotit.icons, pairs)
  );
  const [faceUp, setFaceUp] = useState<number[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const lockRef = useRef(false);
  const won = matched.length * 2 === board.length;

  const prevPairs = useRef(pairs);
  useEffect(() => {
    // rebuild ONLY when difficulty actually changes — running on mount would
    // replace the board a frame after first paint (flicker + stale taps)
    if (prevPairs.current === pairs) return;
    prevPairs.current = pairs;
    setBoard(buildBoard(makeRng(Math.floor(Math.random() * 1e9)), manifest.spotit.icons, pairs));
    setFaceUp([]);
    setMatched([]);
    setMoves(0);
  }, [pairs]);

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
    setBoard(buildBoard(makeRng(Math.floor(Math.random() * 1e9)), manifest.spotit.icons, pairs));
    setFaceUp([]);
    setMatched([]);
    setMoves(0);
    lockRef.current = false;
  };

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const count = board.length;
  // Choose a grid that fills the viewport without scrolling.
  const cols = isLandscape ? Math.ceil(count / 2) : count <= 8 ? 2 : count <= 12 ? 3 : 4;
  const rows = Math.ceil(count / cols);
  const gap = 12;
  const availW = Math.min(width - 32, 1100);
  const availH = height - 84 - 40; // header + moves line
  const cardW = Math.min(
    (availW - (cols - 1) * gap) / cols,
    (availH - (rows - 1) * gap) / rows / 1.15,
    150
  );

  return (
    <GameShell
      title="Memory Match"
      subtitle={`Find all ${pairs} pairs`}
      onBack={onHome}
      right={<ScoreChip label={`🧠 ${matched.length}/${pairs}`} testID="memory-score" />}
    >
      <View style={styles.boardWrap}>
        <View style={[styles.board, { width: cols * cardW + (cols - 1) * gap, gap }]}>
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
      </View>
      <WinOverlay
        visible={won}
        message={player ? `Amazing memory, ${player.name}!` : 'You matched them all!'}
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
        <View style={styles.backRim}>
          <View style={styles.backBadge}>
            <Text style={{ fontSize: size * 0.3 }}>❓</Text>
          </View>
          <View style={[styles.backDot, { top: 7, left: 7 }]} />
          <View style={[styles.backDot, { top: 7, right: 7 }]} />
          <View style={[styles.backDot, { bottom: 7, left: 7 }]} />
          <View style={[styles.backDot, { bottom: 7, right: 7 }]} />
        </View>
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
        {matched ? <SparkleBurst trigger={card.icon} count={5} size={13} /> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boardWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  board: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
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
  faceDown: { backgroundColor: colors.teal, padding: 5 },
  backRim: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBadge: {
    width: '58%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  faceUp: { backgroundColor: colors.card, borderWidth: 3, borderColor: colors.teal },
  faceMatched: { borderColor: colors.green, backgroundColor: 'rgba(95,191,110,0.12)' },
  moves: {
    textAlign: 'center',
    fontFamily: fonts.bodyReg,
    color: colors.inkSoft,
    fontSize: 15,
    paddingTop: 10,
  },
});
