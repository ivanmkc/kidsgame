import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty, settingsFor } from '../../difficulty';
import { Lang } from '../../lang';
import { t } from '../../i18n';
import { ModePicker } from '../../multiplayer';
import { makeRng } from '../../rng';
import { colors } from '../../theme';
import { sfx } from '../../sound';
import { TimerRing, fmtTime, useElapsed } from '../../components/TimerRing';
import { DealIn, Slot, SpotCard, layoutSlots } from './cards';
import { buildDeck, dealRound } from './logic';
import { SpotItDuel } from './SpotItDuel';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  seed?: number;
  twoPlayerEnabled?: boolean;
  lang?: Lang;
}

// Thin shell: mode state + ModePicker only. All gameplay hooks live inside
// SpotItSolo / SpotItDuel so hook order here never varies.
export function SpotItGame({ onHome, difficulty, seed, twoPlayerEnabled, lang = 'en' }: Props) {
  const [mode, setMode] = useState<'solo' | '2p' | null>(twoPlayerEnabled ? null : 'solo');
  return (
    <>
      {mode === '2p' ? (
        <SpotItDuel onHome={onHome} difficulty={difficulty} seed={seed} lang={lang} />
      ) : (
        <SpotItSolo onHome={onHome} difficulty={difficulty} seed={seed} locked={mode === null} lang={lang} />
      )}
      {mode === null ? <ModePicker onPick={setMode} /> : null}
    </>
  );
}

function SpotItSolo({ onHome, difficulty, seed, locked, lang }: {
  onHome: () => void;
  difficulty: Difficulty;
  seed?: number;
  locked: boolean;
  lang: Lang;
}) {
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
  const [timerKey, setTimerKey] = useState(0);
  const won = score >= roundsToWin;
  const showTimer = settingsFor(difficulty).timer;
  const elapsed = useElapsed(showTimer && !won && !locked, timerKey);
  const mmss = fmtTime(elapsed);

  const nextRound = () => {
    setRound(dealRound(rngRef.current, deck));
    setSlots({ top: layoutSlots(rngRef.current), bottom: layoutSlots(rngRef.current) });
    setRoundKey((k) => k + 1);
  };

  const onTap = (symbol: number) => {
    if (won || locked) return;
    if (symbol === round.answer) {
      const next = score + 1;
      setScore(next);
      setWrongFlash(null);
      if (next < roundsToWin) nextRound();
      sfx.good();
    } else {
      sfx.wrong();
      setWrongFlash(symbol);
      setTimeout(() => setWrongFlash((w) => (w === symbol ? null : w)), 450);
    }
  };

  const reset = () => {
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setWrongFlash(null);
    setTimerKey((k) => k + 1);
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
      title={t(lang, 'shell.spotit.title')}
      subtitle={t(lang, 'shell.spotit.sub')}
      onBack={onHome}
      lang={lang}
      right={<ScoreChip label={`⭐ ${score}/${roundsToWin}`} testID="spotit-score" />}
    >
      <View style={[styles.board, isLandscape && styles.boardRow]}>
        <DealIn key={`t${roundKey}`} from={-1}>
          {showTimer ? (
            <TimerRing elapsed={elapsed} size={cardSize + 24} stroke={9} testID="spotit-timer">
              <SpotCard card={round.top} slots={slots.top} size={cardSize} onTap={onTap} wrongFlash={wrongFlash} tint={colors.teal} testIDPrefix="top" />
            </TimerRing>
          ) : (
            <SpotCard card={round.top} slots={slots.top} size={cardSize} onTap={onTap} wrongFlash={wrongFlash} tint={colors.teal} testIDPrefix="top" />
          )}
        </DealIn>
        <Text style={styles.vs}>👀</Text>
        <DealIn key={`b${roundKey}`} from={1}>
          <SpotCard card={round.bottom} slots={slots.bottom} size={cardSize} onTap={onTap} wrongFlash={wrongFlash} tint={colors.red} testIDPrefix="bottom" />
        </DealIn>
      </View>
      <WinOverlay
        visible={won}
        message={showTimer ? t(lang, 'win.spotitTimed', { time: mmss }) : t(lang, 'win.spotit')}
        onNext={reset} nextLabel={t(lang, 'overlay.nextRound')}
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingBottom: 8 },
  boardRow: { flexDirection: 'row', gap: 10 },
  vs: { fontSize: 22 },
});
