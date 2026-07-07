import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { TimerRing, useElapsed } from '../../components/TimerRing';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty, settingsFor } from '../../difficulty';
import { Lang } from '../../lang';
import { t } from '../../i18n';
import { makeRng } from '../../rng';
import { colors, fonts, shadows } from '../../theme';
import { say, sfx } from '../../sound';
import { LetterRound, makeLetterRound, settingsForLetters } from './logic';
import { useWinLine } from '../winlines';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

// Letter Hunt: spoken letter (or kana / phonics sound) → tap the matching
// tile. Pre-readers play entirely by ear; the tile is a huge Baloo glyph.
export function LettersGame({ onHome, difficulty, lang }: Props) {
  const { rounds: roundsToWin, tiles: tileCount, tier } = settingsForLetters(difficulty, lang);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [roundIdx, setRoundIdx] = useState(0);
  const [round, setRound] = useState<LetterRound>(() => makeLetterRound(rngRef.current, tier, tileCount));
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const [timerKey, setTimerKey] = useState(0);
  const showTimer = settingsFor(difficulty).timer;
  const won = roundIdx >= roundsToWin;
  useWinLine(won, t(lang, tier === 'kana' ? 'win.lettersKana' : 'win.letters'));
  const elapsed = useElapsed(showTimer && !won, timerKey);
  const { width, height } = useWindowDimensions();

  // Speak on EVERY round — keyed on the round object, not the text, so a
  // repeated target still gets read aloud.
  useEffect(() => {
    if (!won) say(round.promptLine);
  }, [round, won]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTile = (i: number) => {
    if (won) return;
    if (round.tiles[i].isAnswer) {
      sfx.good();
      setWrongIdx(null);
      const next = roundIdx + 1;
      setRoundIdx(next);
      if (next < roundsToWin) {
        setRound(makeLetterRound(rngRef.current, tier, tileCount, round.targetKey));
      }
    } else {
      sfx.wrong();
      setWrongIdx(i);
      setTimeout(() => setWrongIdx((w) => (w === i ? null : w)), 450);
      say(round.promptLine); // re-speak so a stuck kid gets another try
    }
  };

  const reset = () => {
    setTimerKey((k) => k + 1);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setRoundIdx(0);
    setRound(makeLetterRound(rngRef.current, tier, tileCount));
    setWrongIdx(null);
  };

  const cols = tileCount <= 6 ? 3 : 4;
  const rows = Math.ceil(tileCount / cols);
  const gap = 12;
  const tile = Math.min(
    (Math.min(width - 32, 560) - (cols - 1) * gap) / cols,
    (height - 84 - 130 - (rows - 1) * gap) / rows,
    140,
  );

  const chipEmoji = tier === 'kana' ? '🈶' : tier === 'sound' ? '👂' : '🔤';

  return (
    <GameShell
      title={tier === 'kana' ? t(lang, 'shell.letters.titleKana') : t(lang, 'shell.letters.title')}
      subtitle={tier === 'sound' ? t(lang, 'shell.letters.subSound') : t(lang, 'shell.letters.subTap')}
      onBack={onHome}
      lang={lang}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {showTimer ? <TimerRing elapsed={elapsed} size={44} stroke={5} showLabel testID="letters-timer" /> : null}
          <ScoreChip label={`${chipEmoji} ${Math.min(roundIdx, roundsToWin)}/${roundsToWin}`} testID="letters-score" />
        </View>
      }
    >
      <View style={styles.board}>
        <View style={[styles.prompt, shadows.soft]} testID={`letters-prompt-${round.targetKey}`}>
          <Text style={styles.promptText}>{round.promptLine}</Text>
          {round.romanCaption ? <Text style={styles.caption}>{round.romanCaption}</Text> : null}
        </View>
        <View style={[styles.grid, { width: cols * tile + (cols - 1) * gap, gap }]}>
          {round.tiles.map((t, i) => (
            <Pressable
              key={`${roundIdx}-${i}-${t.key}`}
              onPress={() => onTile(i)}
              testID={`letters-tile-${i}`}
              accessibilityLabel={t.label}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.tile,
                shadows.soft,
                { width: tile, height: tile },
                wrongIdx === i && styles.wrong,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.glyph, { fontSize: Math.round(tile * 0.5) }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <WinOverlay
        visible={won}
        message={tier === 'kana' ? t(lang, 'win.lettersKana') : t(lang, 'win.letters')}
        onNext={reset} nextLabel={t(lang, 'overlay.playAgain')}
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 16 },
  prompt: {
    backgroundColor: '#F7EDDA',
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.gold,
    paddingVertical: 10,
    paddingHorizontal: 22,
    alignItems: 'center',
    maxWidth: 520,
  },
  promptText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, textAlign: 'center' },
  caption: { fontFamily: fonts.bodyReg, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  tile: {
    backgroundColor: colors.paper,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontFamily: fonts.display, color: colors.ink, includeFontPadding: false },
  wrong: { borderColor: colors.red, backgroundColor: 'rgba(232,86,79,0.15)' },
  pressed: { transform: [{ scale: 0.94 }] },
});
