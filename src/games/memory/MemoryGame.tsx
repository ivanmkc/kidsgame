import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SPOTIT_ICONS } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { TimerRing, useElapsed } from '../../components/TimerRing';
import { SparkleBurst } from '../../components/Sparkles';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty, settingsFor } from '../../difficulty';
import { Lang } from '../../lang';
import { t } from '../../i18n';
import { manifest } from '../../manifest';
import { MP_PLAYERS, ModePicker, PlayerChip, PlayerIx, nextTurn } from '../../multiplayer';
import { makeRng } from '../../rng';
import { say, sfx } from '../../sound';
import { colors, fonts, shadows } from '../../theme';
import { DuelState, MemoryCard, buildBoard, duelInit, duelResolve, duelWinner, nextStarter } from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  twoPlayerEnabled?: boolean;
  lang?: Lang;
}

export function MemoryGame({ onHome, difficulty, twoPlayerEnabled, lang = 'en' }: Props) {
  const settings = settingsFor(difficulty);
  const pairs = settings.memoryPairs;
  // All hooks unconditionally at top; ModePicker is conditional JSX in the
  // single return — never an early return (repo hard rule).
  const [mode, setMode] = useState<'solo' | '2p' | null>(twoPlayerEnabled ? null : 'solo');
  const duel = mode === '2p';
  const [board, setBoard] = useState<MemoryCard[]>(() =>
    buildBoard(makeRng(Math.floor(Math.random() * 1e9)), manifest.spotit.icons, pairs)
  );
  const [faceUp, setFaceUp] = useState<number[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [matchedBy, setMatchedBy] = useState<Record<string, PlayerIx>>({});
  const [duelState, setDuelState] = useState<DuelState>(() => duelInit(Math.random() < 0.5 ? 0 : 1));
  const [moves, setMoves] = useState(0);
  const lockRef = useRef(false);
  const [timerKey, setTimerKey] = useState(0);
  const showTimer = settingsFor(difficulty).timer && mode !== '2p';
  const won = matched.length * 2 === board.length;
  const elapsed = useElapsed(showTimer && !won && mode !== null, timerKey);

  // Turn halo pulse — restarted whenever the turn changes.
  const halo = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!duel) return;
    halo.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, { toValue: 0.65, duration: 700, useNativeDriver: true }),
        Animated.timing(halo, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [duel, duelState.turn, halo]);

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
    // scores must not leak across boards
    setMatchedBy({});
    const starter = nextStarter(duelState);
    setDuelState(duelInit(starter));
    if (duel) say(`${MP_PLAYERS[starter].name} starts!`);
  }, [pairs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kind spoken recap; the word "lose" never appears.
  useEffect(() => {
    if (!won || !duel) return;
    const w = duelWinner(duelState);
    if (w === 'tie') {
      say(`It's a tie! You both found ${duelState.pairs[0]} pairs!`);
    } else {
      const l = nextTurn(w);
      say(`${MP_PLAYERS[w].name} wins! ${MP_PLAYERS[w].name} found ${duelState.pairs[w]} pairs and ${MP_PLAYERS[l].name} found ${duelState.pairs[l]} pairs. Great game, both of you!`);
    }
  }, [won]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFlip = (card: MemoryCard) => {
    if (mode === null) return; // inert while the 1P/2P picker is up
    if (lockRef.current || won) return;
    if (faceUp.length >= 2) return; // multi-touch hardening
    if (faceUp.includes(card.key) || matched.includes(card.icon)) return;
    const next = [...faceUp, card.key];
    setFaceUp(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next.map((k) => board.find((c) => c.key === k)!);
      if (a.icon === b.icon) {
        setMatched((m) => [...m, a.icon]);
        setFaceUp([]);
        sfx.good();
        if (duel) {
          const scorer = duelState.turn;
          setMatchedBy((mb) => ({ ...mb, [a.icon]: scorer }));
          setDuelState((d) => duelResolve(d, true));
          const lastPair = (matched.length + 1) * 2 === board.length;
          // ONE combined utterance — say() cancels prior speech.
          if (!lastPair) say(`${MP_PLAYERS[scorer].name} found a pair! Go again!`);
        }
      } else {
        if (duel) sfx.wrong();
        lockRef.current = true;
        setTimeout(() => {
          setFaceUp([]);
          lockRef.current = false;
          if (duel) {
            // turn signal lands exactly when input unlocks
            setDuelState((d) => duelResolve(d, false));
            say(`${MP_PLAYERS[nextTurn(duelState.turn)].name}'s turn!`);
          }
        }, 750);
      }
    }
  };

  const reset = () => {
    setTimerKey((k) => k + 1);
    setBoard(buildBoard(makeRng(Math.floor(Math.random() * 1e9)), manifest.spotit.icons, pairs));
    setFaceUp([]);
    setMatched([]);
    setMoves(0);
    lockRef.current = false;
    // scores must not leak across boards; the non-winner starts the rematch
    setMatchedBy({});
    const starter = nextStarter(duelState);
    setDuelState(duelInit(starter));
    if (duel) say(`${MP_PLAYERS[starter].name} starts!`);
  };

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const count = board.length;
  // Choose a grid that fills the viewport without scrolling.
  const cols = isLandscape ? Math.ceil(count / 2) : count <= 8 ? 2 : count <= 12 ? 3 : 4;
  const rows = Math.ceil(count / cols);
  const gap = 12;
  const availW = Math.min(width - 32, 1100) - (duel ? 26 : 0); // halo padding
  const availH = height - 84 - (duel ? 92 : 64); // header + chips/moves line
  const cardW = Math.min(
    (availW - (cols - 1) * gap) / cols,
    (availH - (rows - 1) * gap) / rows / 1.15,
    150
  );

  const turnPlayer = MP_PLAYERS[duelState.turn];
  const winner = duelWinner(duelState);

  const boardView = (
    <View style={[styles.board, { width: cols * cardW + (cols - 1) * gap, gap }]}>
      {board.map((card) => (
        <FlipCard
          key={card.key}
          card={card}
          size={cardW}
          up={faceUp.includes(card.key) || matched.includes(card.icon)}
          matched={matched.includes(card.icon)}
          ownerColor={matchedBy[card.icon] !== undefined ? MP_PLAYERS[matchedBy[card.icon]].color : undefined}
          onFlip={() => onFlip(card)}
        />
      ))}
    </View>
  );

  return (
    <GameShell
      title={t(lang, 'shell.memory.title')}
      subtitle={t(lang, 'shell.memory.sub', { n: pairs })}
      onBack={onHome}
      lang={lang}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {showTimer ? <TimerRing elapsed={elapsed} size={44} stroke={5} showLabel testID="memory-timer" /> : null}
          <ScoreChip label={`🧠 ${matched.length}/${pairs}`} testID="memory-score" />
        </View>
      }
    >
      <View style={styles.boardWrap}>
        {duel ? (
          <View style={{ padding: 13 }}>
            <Animated.View
              pointerEvents="none"
              testID="memory-turn-halo"
              accessibilityLabel={`${turnPlayer.name}'s turn`}
              style={[
                styles.halo,
                {
                  borderColor: turnPlayer.color,
                  shadowColor: turnPlayer.color,
                  opacity: halo,
                },
              ]}
            />
            {boardView}
          </View>
        ) : (
          boardView
        )}
        {duel ? (
          <View style={styles.chipsRow}>
            <PlayerChip player={0} count={duelState.pairs[0]} active={duelState.turn === 0 && !won} testID="memory-duel-chip-0" />
            <PlayerChip player={1} count={duelState.pairs[1]} active={duelState.turn === 1 && !won} testID="memory-duel-chip-1" />
          </View>
        ) : (
          <Text style={styles.moves} testID="memory-moves">{t(lang, 'memory.moves', { n: moves })}</Text>
        )}
      </View>
      <WinOverlay
        visible={won}
        message={
          duel
            ? winner === 'tie'
              ? t(lang, 'win.memoryTie', { n: duelState.pairs[0] })
              : t(lang, 'win.memoryWinner', { name: MP_PLAYERS[winner].name })
            : t(lang, 'win.memory')
        }
        lang={lang}
        stats={
          duel ? (
            <View style={styles.winStats} testID="memory-win-stats">
              {([0, 1] as PlayerIx[]).map((ix) => (
                <View key={ix} style={styles.winStatCol}>
                  <Text style={styles.crown}>{winner === ix || winner === 'tie' ? '👑' : ' '}</Text>
                  <PlayerChip player={ix} count={duelState.pairs[ix]} active={winner === ix || winner === 'tie'} testID={`memory-win-chip-${ix}`} />
                </View>
              ))}
            </View>
          ) : undefined
        }
        onNext={reset} nextLabel={duel ? t(lang, 'overlay.rematch') : t(lang, 'overlay.nextRound')}
        onHome={onHome}
      />
      {twoPlayerEnabled && mode === null ? <ModePicker onPick={setMode} /> : null}
    </GameShell>
  );
}

function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function FlipCard({
  card, size, up, matched, ownerColor, onFlip,
}: {
  card: MemoryCard;
  size: number;
  up: boolean;
  matched: boolean;
  ownerColor?: string;
  onFlip: () => void;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(t, { toValue: up ? 1 : 0, useNativeDriver: true, friction: 7 }).start();
  }, [up, t]);

  const frontRot = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRot = t.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  return (
    <Pressable
      onPress={onFlip}
      testID={`memory-card-${card.key}-${card.icon}`}
      accessibilityLabel={up ? card.icon : 'face-down card'}
      accessibilityRole="button"
      style={{ width: size, height: size * 1.15 }}
    >
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
          matched && ownerColor ? { borderColor: ownerColor, backgroundColor: tint(ownerColor, 0.12) } : null,
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
  halo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 5,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
  },
  winStats: { flexDirection: 'row', gap: 22, alignItems: 'flex-end', justifyContent: 'center' },
  winStatCol: { alignItems: 'center', gap: 4 },
  crown: { fontSize: 24, height: 30 },
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
