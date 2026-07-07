import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions  } from 'react-native';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { TimerRing, useElapsed } from '../../components/TimerRing';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty, settingsFor } from '../../difficulty';
import { Lang, numberWord } from '../../lang';
import { t } from '../../i18n';
import { makeRng } from '../../rng';
import { colors, fonts, shadows  } from '../../theme';
import { saySequence, sfx } from '../../sound';
import { NumberRound, makeNumberRound, settingsForNumbers } from './logic';
import { useWinLine } from '../winlines';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

// Number Hunt: spoken number → tap the matching tile. JA/zh hard tier
// swaps arabic tiles for han numerals so recognition transfers across
// scripts.
export function NumbersGame({ onHome, difficulty, lang }: Props) {
  const [script, setScript] = useState<'arabic' | 'han' | 'auto'>('auto');
  const numSettings = settingsForNumbers(difficulty, lang, script);
  const { rounds: roundsToWin } = numSettings;
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [roundIdx, setRoundIdx] = useState(0);
  const [round, setRound] = useState<NumberRound>(() => makeNumberRound(rngRef.current, numSettings, lang));
  // script toggle must re-skin the CURRENT round's tiles, not wait a round
  useEffect(() => {
    setRound(makeNumberRound(rngRef.current, numSettings, lang));
  }, [script]); // eslint-disable-line react-hooks/exhaustive-deps
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const [timerKey, setTimerKey] = useState(0);
  const showTimer = settingsFor(difficulty).timer;
  const won = roundIdx >= roundsToWin;
  useWinLine(won, t(lang, 'win.numbers'));
  const elapsed = useElapsed(showTimer && !won, timerKey);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (!won) saySequence(round.promptLines);
  }, [round, won]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTile = (i: number) => {
    if (won) return;
    if (round.tiles[i].isAnswer) {
      sfx.good();
      setWrongIdx(null);
      const next = roundIdx + 1;
      setRoundIdx(next);
      if (next < roundsToWin) {
        setRound(makeNumberRound(rngRef.current, numSettings, lang, round.targetN));
      }
    } else {
      sfx.wrong();
      setWrongIdx(i);
      setTimeout(() => setWrongIdx((w) => (w === i ? null : w)), 450);
      saySequence(round.promptLines);
    }
  };

  const reset = () => {
    setTimerKey((k) => k + 1);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setRoundIdx(0);
    setRound(makeNumberRound(rngRef.current, numSettings, lang));
    setWrongIdx(null);
  };

  const cols = numSettings.tiles <= 6 ? 3 : numSettings.tiles <= 8 ? 4 : 3;
  const rows = Math.ceil(numSettings.tiles / cols);
  const gap = 12;
  const tile = Math.min(
    (Math.min(width - 32, 560) - (cols - 1) * gap) / cols,
    (height - 84 - 130 - (rows - 1) * gap) / rows,
    140,
  );
  const caption = lang === 'en' ? '' : (numberWord(lang, round.targetN).r || '');

  return (
    <GameShell
      title={numSettings.useHan ? t(lang, 'shell.numbers.titleHan') : t(lang, 'shell.numbers.title')}
      subtitle={t(lang, 'shell.numbers.sub')}
      onBack={onHome}
      lang={lang}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {showTimer ? <TimerRing elapsed={elapsed} size={44} stroke={5} showLabel testID="numbers-timer" /> : null}
          {lang !== 'en' ? (
            <Pressable
              onPress={() => { sfx.tap(); setScript(numSettings.useHan ? 'arabic' : 'han'); }}
              testID="numbers-script"
              accessibilityRole="button"
              accessibilityLabel="Switch numeral script"
              style={{ backgroundColor: numSettings.useHan ? '#FFE9B8' : 'white', borderRadius: 12, borderWidth: 2, borderColor: '#E8C97A', paddingVertical: 11, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: fonts.display, fontSize: 14, color: colors.ink }}>{numSettings.useHan ? '一二三' : '123'}</Text>
            </Pressable>
          ) : null}
          <ScoreChip label={`🔢 ${Math.min(roundIdx, roundsToWin)}/${roundsToWin}`} testID="numbers-score" />
        </View>
      }
    >
      <View style={styles.board}>
        <View style={[styles.prompt, shadows.soft]} testID={`numbers-prompt-${round.targetKey}`}>
          <Text style={styles.promptText}>{round.displayText}</Text>
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        </View>
        <View style={[styles.grid, { width: cols * tile + (cols - 1) * gap, gap }]}>
          {round.tiles.map((t, i) => (
            <Pressable
              key={`${roundIdx}-${i}-${t.key}`}
              onPress={() => onTile(i)}
              testID={`numbers-tile-${i}`}
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
              <Text style={[styles.glyph, { fontSize: Math.round(tile * (t.label.length > 1 ? 0.4 : 0.55)) }]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, 'win.numbers')}
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
    paddingVertical: 8,
    paddingHorizontal: 22,
    alignItems: 'center',
    minWidth: 96,
  },
  promptText: { fontFamily: fonts.display, fontSize: 34, color: colors.ink, textAlign: 'center' },
  caption: { fontFamily: fonts.bodyReg, fontSize: 13, color: colors.inkSoft, marginTop: 0 },
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
