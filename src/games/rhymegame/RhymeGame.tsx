import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SPOTIT_ICONS } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { TimerRing, useElapsed } from '../../components/TimerRing';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty, settingsFor } from '../../difficulty';
import { Lang } from '../../lang';
import { t } from '../../i18n';
import { manifest } from '../../manifest';
import { RHYME_ICONS } from '../language/rhymeAssets';
import { makeRng } from '../../rng';
import { colors, fonts, shadows } from '../../theme';
import { sayThen, saySequence, sfx } from '../../sound';
import { useWinLine } from '../winlines';
import {
  RhymeRound, availableEntries, canPlay, effectiveLang, makeRhymeRound,
  playableFamilies, settingsForRhyme,
} from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

// Rhyme Time. EN plays the English rhyme pool; JA/CMN/YUE build native
// final-sound families (see logic.ts + words.ts). A non-EN mode with a
// thin pool (<3 families) falls back to EN silently. Tolerates a half-
// populated RHYME_ICONS atlas (uses only families with ≥2 icons).
export function RhymeGame({ onHome, difficulty, lang }: Props) {
  const iconsList = manifest.spotit.icons;
  // Memoise so React sees a stable identity across renders — otherwise
  // useEffect below would re-fire every render and re-narrate the prompt.
  const gameLang = useMemo(() => effectiveLang(lang, iconsList), [lang, iconsList]);
  const entries = useMemo(() => availableEntries(gameLang, iconsList), [gameLang, iconsList]);
  const families = useMemo(() => playableFamilies(entries), [entries]);
  const familyCount = Object.keys(families).length;
  const { rounds: roundsToWin, tiles: tileCount } = settingsForRhyme(difficulty, familyCount);
  const playable = canPlay(entries);
  const showComingSoonBanner = familyCount < 3;

  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [roundIdx, setRoundIdx] = useState(0);
  const [round, setRound] = useState<RhymeRound | null>(
    () => (playable ? makeRhymeRound(rngRef.current, entries, tileCount, gameLang) : null),
  );
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const [timerKey, setTimerKey] = useState(0);
  const showTimer = settingsFor(difficulty).timer;
  const won = playable && roundIdx >= roundsToWin;
  useWinLine(won, t(lang, 'win.rhyme'));
  const elapsed = useElapsed(showTimer && !won && playable, timerKey);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (round && !won) saySequence(round.promptLines);
  }, [round, won]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTile = (i: number) => {
    if (won || !round) return;
    if (round.tiles[i].isAnswer) {
      sfx.good();
      setWrongIdx(null);
      const nextIdx = roundIdx + 1;
      sayThen(round.confirmLines, () => {
        setRoundIdx(nextIdx);
        if (nextIdx < roundsToWin) {
          setRound(makeRhymeRound(rngRef.current, entries, tileCount, gameLang, round.target.icon));
        }
      });
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
    setRound(playable ? makeRhymeRound(rngRef.current, entries, tileCount, gameLang) : null);
    setWrongIdx(null);
  };

  const cols = tileCount;
  const gap = 14;
  // Kid-thumb floor of 44px: in short (landscape) viewports the PROMPT
  // shrinks, never the answer tiles.
  const tile = Math.max(44, Math.min(
    (Math.min(width - 32, 620) - (cols - 1) * gap) / cols,
    (height - 84 - 260) / 1,
    160,
  ));
  const promptIcon = Math.max(56, Math.min(110, height - 84 - tile * 1.2 - 150));

  const iconFor = (icon: string, bucket: 'spotit' | 'rhyme') =>
    bucket === 'rhyme' ? RHYME_ICONS[icon] : SPOTIT_ICONS[icon];

  return (
    <GameShell
      title={t(lang, 'shell.rhyme.title')}
      subtitle={t(lang, 'shell.rhyme.sub')}
      onBack={onHome}
      lang={lang}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {showTimer ? <TimerRing elapsed={elapsed} size={44} stroke={5} showLabel testID="rhyme-timer" /> : null}
          <ScoreChip label={`🎵 ${Math.min(roundIdx, roundsToWin)}/${roundsToWin}`} testID="rhyme-score" />
        </View>
      }
    >
      <View style={styles.board}>
        {!playable ? (
          <View style={[styles.banner, shadows.soft]} testID="rhyme-empty">
            <Text style={styles.bannerText}>More rhymes coming soon! 🎶</Text>
          </View>
        ) : (
          <>
            {showComingSoonBanner ? (
              <View style={[styles.banner, shadows.soft]} testID="rhyme-fewer-banner">
                <Text style={styles.bannerText}>{t(lang, 'rhyme.comingSoon')}</Text>
              </View>
            ) : null}
            {round ? (
              <>
                <View style={[styles.prompt, shadows.soft]} testID={`rhyme-prompt-${round.target.icon}`}>
                  <Image source={iconFor(round.target.icon, round.target.bucket)} style={{ width: promptIcon, height: promptIcon }} resizeMode="contain" />
                  <Text style={styles.promptText}>{round.displayPrompt}</Text>
                  {round.caption ? <Text style={styles.caption}>{round.caption}</Text> : null}
                </View>
                <View style={[styles.grid, { width: cols * tile + (cols - 1) * gap, gap }]}>
                  {round.tiles.map((t, i) => (
                    <Pressable
                      key={`${roundIdx}-${i}-${t.icon}`}
                      onPress={() => onTile(i)}
                      testID={`rhyme-tile-${i}`}
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
                      <Image source={iconFor(t.icon, t.bucket)} style={{ width: '80%', height: '80%' }} resizeMode="contain" />
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, 'win.rhyme')}
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
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.gold,
    paddingVertical: 12,
    paddingHorizontal: 22,
    alignItems: 'center',
    maxWidth: 560,
    gap: 8,
  },
  targetIcon: { width: 110, height: 110 },
  promptText: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, textAlign: 'center' },
  caption: { fontFamily: fonts.bodyReg, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  banner: {
    backgroundColor: colors.blush,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  bannerText: { fontFamily: fonts.body, fontSize: 15, color: colors.ink, textAlign: 'center' },
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
