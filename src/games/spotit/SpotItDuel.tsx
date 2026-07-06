import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty, settingsFor } from '../../difficulty';
import { MP_PLAYERS, PlayerIx } from '../../multiplayer';
import { makeRng } from '../../rng';
import { say, sfx } from '../../sound';
import { colors, fonts } from '../../theme';
import { DealIn, Slot, SpotCard, layoutSlots } from './cards';
import { DuelRound, buildDeck, dealDuelRound, hintAfterMs, leaderDealDelayMs } from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  seed?: number;
}

type Phase = 'ready' | 'play' | 'roundEnd' | 'matchEnd';
type ZoneId = 'a' | 'b';

interface ZoneSlots {
  aOwn: Slot[];
  aShared: Slot[];
  bOwn: Slot[];
  bShared: Slot[];
}

const ZONE_PLAYER: Record<ZoneId, PlayerIx> = { a: 0, b: 1 };

// Competitive same-device duel: bottom zone = Foxy (player 0), top zone =
// Bunny (player 1, rotated 180° in portrait). Each kid hunts a DIFFERENT
// answer between her own card and her upright copy of the shared center card.
export function SpotItDuel({ onHome, difficulty, seed }: Props) {
  const deck = useMemo(() => buildDeck(), []);
  const settings = settingsFor(difficulty);
  const winsNeeded = settings.duelWins;
  const hintSecs = settings.duelHintSecs;
  const rngRef = useRef(makeRng(seed ?? Math.floor(Math.random() * 1e9)));
  const newSlots = (): ZoneSlots => ({
    aOwn: layoutSlots(rngRef.current),
    aShared: layoutSlots(rngRef.current),
    bOwn: layoutSlots(rngRef.current),
    bShared: layoutSlots(rngRef.current),
  });

  const [phase, setPhase] = useState<Phase>('ready');
  const [count, setCount] = useState(3);
  const [round, setRound] = useState<DuelRound>(() => dealDuelRound(rngRef.current, deck));
  const [slots, setSlots] = useState<ZoneSlots>(newSlots);
  const [roundKey, setRoundKey] = useState(0);
  const [scores, setScores] = useState({ a: 0, b: 0 });
  const [wrongFlash, setWrongFlash] = useState<{ a: number | null; b: number | null }>({ a: null, b: null });
  const [frozen, setFrozen] = useState({ a: false, b: false });
  const [hint, setHint] = useState({ a: false, b: false });
  const [roundWinner, setRoundWinner] = useState<ZoneId | null>(null);

  // Two simultaneous onPress events can fire before any re-render, so round
  // arbitration MUST be a synchronous ref — state would double-score.
  const roundClosedRef = useRef(false);
  const frozenRef = useRef({ a: false, b: false });
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => { timersRef.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

  // READY: 3-2-1 countdown, taps ignored until play.
  useEffect(() => {
    if (phase !== 'ready') return;
    say('Ready... Spot!');
    setCount(3);
    const iv = setInterval(() => setCount((c) => Math.max(0, c - 1)), 800);
    return () => clearInterval(iv);
  }, [phase]);
  useEffect(() => {
    if (phase === 'ready' && count === 0) {
      roundClosedRef.current = false;
      setPhase('play');
    }
  }, [phase, count]);

  // Fairness hints: trailing-by->=2 sparkle after hintSecs; 10s universal
  // unstick pulses both answers. Reset every round.
  useEffect(() => {
    if (phase !== 'play') return;
    setHint({ a: false, b: false });
    const ts: ReturnType<typeof setTimeout>[] = [];
    const hA = hintAfterMs(scores.a, scores.b, hintSecs);
    if (Number.isFinite(hA)) ts.push(setTimeout(() => setHint((h) => ({ ...h, a: true })), hA));
    const hB = hintAfterMs(scores.b, scores.a, hintSecs);
    if (Number.isFinite(hB)) ts.push(setTimeout(() => setHint((h) => ({ ...h, b: true })), hB));
    ts.push(setTimeout(() => setHint({ a: true, b: true }), 10000));
    return () => ts.forEach(clearTimeout);
  }, [phase, roundKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kind spoken recap once the match ends (no say() during rounds — the
  // cancel-previous behavior would clip itself).
  useEffect(() => {
    if (phase !== 'matchEnd') return;
    const w = scores.a > scores.b ? MP_PLAYERS[0] : MP_PLAYERS[1];
    const l = scores.a > scores.b ? MP_PLAYERS[1] : MP_PLAYERS[0];
    const lScore = Math.min(scores.a, scores.b);
    say(`${w.name} wins! ${l.name} spotted ${lScore} ${lScore === 1 ? 'star' : 'stars'}. Great eyes, both of you!`);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const redeal = () => {
    setRound(dealDuelRound(rngRef.current, deck));
    setSlots(newSlots());
    setRoundKey((k) => k + 1);
    setWrongFlash({ a: null, b: null });
    frozenRef.current = { a: false, b: false };
    setFrozen({ a: false, b: false });
    setRoundWinner(null);
    roundClosedRef.current = false;
    setPhase('play');
  };

  const rematch = () => {
    setScores({ a: 0, b: 0 });
    setRound(dealDuelRound(rngRef.current, deck));
    setSlots(newSlots());
    setRoundKey((k) => k + 1);
    setWrongFlash({ a: null, b: null });
    frozenRef.current = { a: false, b: false };
    setFrozen({ a: false, b: false });
    setRoundWinner(null);
    roundClosedRef.current = true; // taps ignored until countdown finishes
    setPhase('ready');
  };

  const tapFor = (z: ZoneId) => (sym: number) => {
    if (phase !== 'play') return;
    if (frozenRef.current[z]) return;
    const answer = z === 'a' ? round.answerA : round.answerB;
    if (sym !== answer) {
      // symmetric wrong-tap penalty: that zone only freezes 700ms
      sfx.wrong(0.3);
      setWrongFlash((w) => ({ ...w, [z]: sym }));
      frozenRef.current[z] = true;
      setFrozen((f) => ({ ...f, [z]: true }));
      later(() => setWrongFlash((w) => (w[z] === sym ? { ...w, [z]: null } : w)), 450);
      later(() => {
        frozenRef.current[z] = false;
        setFrozen((f) => ({ ...f, [z]: false }));
      }, 700);
      return;
    }
    if (roundClosedRef.current) return; // checked-and-set synchronously
    roundClosedRef.current = true;
    sfx.good();
    const other: ZoneId = z === 'a' ? 'b' : 'a';
    const myNew = scores[z] + 1;
    const otherScore = scores[other];
    setScores((s) => ({ ...s, [z]: s[z] + 1 }));
    setRoundWinner(z);
    setPhase('roundEnd');
    if (myNew >= winsNeeded) {
      later(() => setPhase('matchEnd'), 900);
    } else {
      // simultaneous redeal; the leader's rubber-band delay reads as a longer shuffle
      later(redeal, 900 + leaderDealDelayMs(myNew, otherScore));
    }
  };

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const availH = height - 84;
  const cardSize = isLandscape
    ? Math.min(availH - 90, (width - 2 * 12) / 2 / 2 - 20, 320)
    : Math.min((availH - 24) / 2 - 52, (width - 60) / 2, 320);

  const winnerIx: PlayerIx = scores.a > scores.b ? 0 : 1;
  const winner = MP_PLAYERS[winnerIx];
  const loser = MP_PLAYERS[(1 - winnerIx) as PlayerIx];
  const loserScore = Math.min(scores.a, scores.b);

  const zone = (z: ZoneId) => (
    <Zone
      z={z}
      rotated={!isLandscape && z === 'b'}
      phase={phase}
      count={count}
      card={z === 'a' ? round.a : round.b}
      center={round.center}
      ownSlots={z === 'a' ? slots.aOwn : slots.bOwn}
      sharedSlots={z === 'a' ? slots.aShared : slots.bShared}
      cardSize={cardSize}
      roundKey={roundKey}
      onTap={tapFor(z)}
      wrongFlash={wrongFlash[z]}
      frozen={frozen[z]}
      hintSymbol={
        roundWinner === z
          ? (z === 'a' ? round.answerA : round.answerB) // round-end: her answer pulses on both her cards
          : hint[z] && phase === 'play'
            ? (z === 'a' ? round.answerA : round.answerB)
            : null
      }
      won={roundWinner === z}
      score={scores[z]}
      total={winsNeeded}
      landscape={isLandscape}
    />
  );

  return (
    <GameShell
      title="Spot It! Duel"
      subtitle="Each of you: find YOUR match with the middle card!"
      onBack={onHome}
      right={<ScoreChip label={`🦊 ${scores.a} · ${scores.b} 🐰`} testID="spotit-duel-score" />}
    >
      <View style={[styles.board, isLandscape && styles.boardRow]}>
        {isLandscape ? (
          <>
            {zone('a')}
            {zone('b')}
          </>
        ) : (
          <>
            {zone('b')}
            {zone('a')}
          </>
        )}
      </View>
      <WinOverlay
        visible={phase === 'matchEnd'}
        message={`🏆 ${winner.name} wins!`}
        sub={`${loser.emoji} ${loser.name} spotted ${loserScore} ${loserScore === 1 ? 'star' : 'stars'} — great eyes!`}
        stats={
          <View style={styles.statsCol}>
            <StarPips player={0} score={scores.a} total={winsNeeded} testID="duel-final-score-a" />
            <StarPips player={1} score={scores.b} total={winsNeeded} testID="duel-final-score-b" />
          </View>
        }
        onNext={rematch}
        nextLabel="Rematch ⚔️"
        onHome={onHome}
      />
    </GameShell>
  );
}

function Zone({
  z, rotated, phase, count, card, center, ownSlots, sharedSlots, cardSize, roundKey,
  onTap, wrongFlash, frozen, hintSymbol, won, score, total, landscape,
}: {
  z: ZoneId;
  rotated: boolean;
  phase: Phase;
  count: number;
  card: number[];
  center: number[];
  ownSlots: Slot[];
  sharedSlots: Slot[];
  cardSize: number;
  roundKey: number;
  onTap: (s: number) => void;
  wrongFlash: number | null;
  frozen: boolean;
  hintSymbol: number | null;
  won: boolean;
  score: number;
  total: number;
  landscape: boolean;
}) {
  const p = MP_PLAYERS[ZONE_PLAYER[z]];
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!frozen) return;
    Animated.sequence([
      Animated.timing(shake, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [frozen, shake]);

  const disabled = phase !== 'play' || frozen;

  return (
    <Animated.View
      style={[
        styles.zone,
        won && styles.zoneWon,
        wrongFlash !== null && styles.zoneWrong,
        {
          opacity: frozen ? 0.55 : 1,
          transform: [{ rotate: rotated ? '180deg' : '0deg' }, { translateX: shake }],
        },
      ]}
    >
      <View style={styles.zoneCards}>
        <DealIn key={`${z}s${roundKey}`} from={-1}>
          <SpotCard
            card={center}
            slots={sharedSlots}
            size={cardSize}
            onTap={onTap}
            wrongFlash={wrongFlash}
            tint={colors.gold}
            testIDPrefix={`duel-${z}-shared`}
            disabled={disabled}
            hintSymbol={hintSymbol}
          />
        </DealIn>
        <DealIn key={`${z}o${roundKey}`} from={1}>
          <SpotCard
            card={card}
            slots={ownSlots}
            size={cardSize}
            onTap={onTap}
            wrongFlash={wrongFlash}
            tint={p.color}
            testIDPrefix={`duel-${z}-my`}
            disabled={disabled}
            hintSymbol={hintSymbol}
          />
        </DealIn>
      </View>
      <StarPips player={ZONE_PLAYER[z]} score={score} total={total} testID={`duel-score-${z}`} />
      {phase === 'ready' ? (
        <View style={styles.countWrap} pointerEvents="none">
          <Text style={styles.count} testID={z === 'a' ? 'duel-countdown' : undefined}>
            {count > 0 ? count : 'Spot!'}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

function StarPips({ player, score, total, testID }: { player: PlayerIx; score: number; total: number; testID: string }) {
  const p = MP_PLAYERS[player];
  return (
    <View
      testID={testID}
      accessibilityLabel={`${p.name} has ${score} stars`}
      style={[styles.pips, { borderColor: p.color }]}
    >
      <Text style={styles.pipEmoji}>{p.emoji}</Text>
      {Array.from({ length: total }, (_, i) => (i < score ? <PipStar key={`s${i}`} /> : <View key={`e${i}`} style={styles.pipEmpty} />))}
    </View>
  );
}

function PipStar() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(t, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }, [t]);
  return (
    <Animated.Text style={[styles.pipStar, { opacity: t, transform: [{ scale: t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1.4, 1] }) }] }]}>
      ⭐
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, alignItems: 'center', justifyContent: 'space-evenly', paddingBottom: 6 },
  statsCol: { alignItems: 'center', gap: 6 },
  boardRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  zone: {
    alignItems: 'center',
    gap: 6,
    borderRadius: 24,
    padding: 6,
  },
  zoneWon: { backgroundColor: 'rgba(95,191,110,0.18)' },
  zoneWrong: { backgroundColor: 'rgba(232,86,79,0.14)' },
  zoneCards: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  pipEmoji: { fontSize: 18, marginRight: 2 },
  pipStar: { fontSize: 17 },
  pipEmpty: {
    width: 15,
    height: 15,
    borderRadius: 999,
    backgroundColor: 'rgba(67,48,75,0.12)',
    marginHorizontal: 1,
  },
  countWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontSize: 84,
    fontFamily: fonts.display,
    color: colors.ink,
    textShadowColor: '#FFFFFF',
    textShadowRadius: 14,
  },
});
