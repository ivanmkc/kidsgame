import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SPOTIT_ICONS } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { TimerRing, useElapsed } from '../../components/TimerRing';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty, settingsFor } from '../../difficulty';
import { Lang } from '../../lang';
import { manifest } from '../../manifest';
import { makeRng } from '../../rng';
import { colors, fonts, shadows } from '../../theme';
import { saySequence, sfx } from '../../sound';
import { SoundsRound, makeSoundsRound, settingsForSounds } from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

// First Sounds (EN) / First Words (JA/cmn/yue): kids hear a phonic cue or
// a spoken word, then tap the matching sticker.
export function SoundsGame({ onHome, difficulty, lang }: Props) {
  const soundSettings = settingsForSounds(difficulty);
  const { rounds: roundsToWin, tiles: tileCount } = soundSettings;
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [roundIdx, setRoundIdx] = useState(0);
  const [round, setRound] = useState<SoundsRound>(
    () => makeSoundsRound(rngRef.current, manifest.spotit.icons, lang, tileCount),
  );
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const [timerKey, setTimerKey] = useState(0);
  const showTimer = settingsFor(difficulty).timer;
  const won = roundIdx >= roundsToWin;
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
      // Say the confirmation chime, then advance a beat later so the kid
      // hears the reward before the next prompt lands.
      saySequence(round.confirmLines);
      const nextIdx = roundIdx + 1;
      setTimeout(() => {
        setRoundIdx(nextIdx);
        if (nextIdx < roundsToWin) {
          setRound(makeSoundsRound(rngRef.current, manifest.spotit.icons, lang, tileCount, round.tiles[i].icon));
        }
      }, 650);
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
    setRound(makeSoundsRound(rngRef.current, manifest.spotit.icons, lang, tileCount));
    setWrongIdx(null);
  };

  const cols = tileCount <= 3 ? 3 : tileCount === 4 ? 2 : 3;
  const rows = Math.ceil(tileCount / cols);
  const gap = 14;
  const tile = Math.min(
    (Math.min(width - 32, 600) - (cols - 1) * gap) / cols,
    (height - 84 - 130 - (rows - 1) * gap) / rows,
    170,
  );

  return (
    <GameShell
      title={lang === 'en' ? 'First Sounds' : 'First Words'}
      subtitle={lang === 'en' ? 'Tap the picture that starts with the sound' : 'Tap the picture you hear'}
      onBack={onHome}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {showTimer ? <TimerRing elapsed={elapsed} size={44} stroke={5} showLabel testID="sounds-timer" /> : null}
          <ScoreChip label={`👂 ${Math.min(roundIdx, roundsToWin)}/${roundsToWin}`} testID="sounds-score" />
        </View>
      }
    >
      <View style={styles.board}>
        <View style={[styles.prompt, shadows.soft]} testID={`sounds-prompt-${round.targetIdx}`}>
          <Text style={styles.promptText}>{round.displayPrompt}</Text>
          {round.caption ? <Text style={styles.caption}>{round.caption}</Text> : null}
        </View>
        <View style={[styles.grid, { width: cols * tile + (cols - 1) * gap, gap }]}>
          {round.tiles.map((t, i) => (
            <Pressable
              key={`${roundIdx}-${i}-${t.icon}`}
              onPress={() => onTile(i)}
              testID={`sounds-tile-${i}`}
              accessibilityLabel={t.icon}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.tile,
                shadows.soft,
                { width: tile, height: tile },
                wrongIdx === i && styles.wrong,
                pressed && styles.pressed,
              ]}
            >
              <Image source={SPOTIT_ICONS[t.icon]} style={{ width: '80%', height: '80%' }} resizeMode="contain" />
            </Pressable>
          ))}
        </View>
      </View>
      <WinOverlay
        visible={won}
        message={lang === 'en' ? 'Sound spotter! Great listening!' : 'Word spotter! Great listening!'}
        onNext={reset} nextLabel={'Play Again ▶️'}
        onHome={onHome}
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
  promptText: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, textAlign: 'center' },
  caption: { fontFamily: fonts.bodyReg, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  tile: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrong: { borderColor: colors.red, backgroundColor: 'rgba(232,86,79,0.15)' },
  pressed: { transform: [{ scale: 0.94 }] },
});
