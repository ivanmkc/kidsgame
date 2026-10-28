import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { SPOTIT_ICONS } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { FlipCard, MemoryBoard } from '../../components/MemoryBoard';
import { TimerRing, useElapsed } from '../../components/TimerRing';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty, settingsFor } from '../../difficulty';
import { Lang } from '../../lang';
import { t } from '../../i18n';
import { manifest } from '../../manifest';
import { MP_PLAYERS, ModePicker, PlayerChip, PlayerIx } from '../../multiplayer';
import { makeRng } from '../../rng';
import { say, sfx, useSay } from '../../sound';
import { colors, fonts } from '../../theme';
import { duelWinner } from '../../components/memoryLogic';
import { useMemoryLogic } from '../../components/useMemoryLogic';
import { MemoryCard, buildBoard, cardLabel } from './logic';

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
  const {
    faceUp,
    matched,
    matchedBy,
    duelState,
    moves,
    onFlip,
    reset,
    won,
    matchedPairs,
  } = useMemoryLogic({
    board,
    isMatch: (a, b) => a.icon === b.icon,
    duel,
    disabled: mode === null,
    onMatch: (_a, _b, scorer, isLastPair) => {
      sfx.good();
      if (duel && scorer !== undefined && !isLastPair) {
        say(`${MP_PLAYERS[scorer].name} found a pair! Go again!`);
      }
    },
    onMismatch: () => {
      if (duel) sfx.wrong();
    },
    onTurnChange: (next) => {
      if (duel) {
        say(`${MP_PLAYERS[next].name}'s turn!`);
      }
    },
  });
  const [timerKey, setTimerKey] = useState(0);
  const showTimer = settingsFor(difficulty).timer && mode !== '2p';
  useSay(mode === null || duel ? null : t(lang, 'card.memory.blurb'));
  useEffect(() => { if (won && !duel) say(t(lang, 'win.memory')); }, [won]); // eslint-disable-line react-hooks/exhaustive-deps
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
    const starter = reset();
    if (duel) say(`${MP_PLAYERS[starter].name} starts!`);
  }, [pairs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kind spoken recap; the word "lose" never appears.
  useEffect(() => {
    if (!won || !duel) return;
    const w = duelWinner(duelState);
    say(
      w === 'tie'
        ? t(lang, 'win.memoryTie', { n: duelState.pairs[0] })
        : t(lang, 'win.memoryWinner', { name: MP_PLAYERS[w].name })
    );
  }, [won]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetGame = () => {
    setTimerKey((k) => k + 1);
    setBoard(buildBoard(makeRng(Math.floor(Math.random() * 1e9)), manifest.spotit.icons, pairs));
    const starter = reset();
    if (duel) say(`${MP_PLAYERS[starter].name} starts!`);
  };

  const turnPlayer = MP_PLAYERS[duelState.turn];
  const winner = duelWinner(duelState);

  const boardView = (
    <MemoryBoard
      cardCount={board.length}
      extraPaddingW={duel ? 26 : 0}
      extraPaddingH={duel ? 92 : 64}
    >
      {(cardW) =>
        board.map((card) => {
          const isUp = faceUp.includes(card.key) || matched.includes(card.key);
          const isMatched = matched.includes(card.key);
          const owner = matchedBy[card.key];
          return (
            <FlipCard
              key={`${timerKey}-${card.key}`}
              size={cardW}
              up={isUp}
              matched={isMatched}
              ownerColor={owner !== undefined ? MP_PLAYERS[owner].color : undefined}
              onFlip={() => onFlip(card)}
              accessibilityLabel={isUp ? cardLabel(card.icon, lang) : t(lang, 'memory.cardFaceDown')}
              testID={`memory-card-${card.key}-${card.icon}`}
              sparkleTrigger={card.icon}
              renderCardFace={() => (
                <Image source={SPOTIT_ICONS[card.icon]} style={styles.cardImage} resizeMode="contain" />
              )}
            />
          );
        })
      }
    </MemoryBoard>
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
          <ScoreChip label={`🧠 ${matchedPairs}/${pairs}`} testID="memory-score" />
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
        onNext={resetGame} nextLabel={duel ? t(lang, 'overlay.rematch') : t(lang, 'overlay.nextRound')}
        onHome={onHome}
      />
      {twoPlayerEnabled && mode === null ? <ModePicker onPick={setMode} lang={lang} /> : null}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  boardWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  cardImage: { width: '78%', height: '78%' },
  moves: {
    textAlign: 'center',
    fontFamily: fonts.bodyReg,
    color: colors.inkSoft,
    fontSize: 15,
    paddingTop: 10,
  },
});
