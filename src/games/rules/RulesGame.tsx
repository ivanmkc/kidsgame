import React, { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SPOTIT_ICONS } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { TimerRing, useElapsed } from '../../components/TimerRing';
import { SparkleBurst } from '../../components/Sparkles';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty, settingsFor } from '../../difficulty';
import { manifest } from '../../manifest';
import { makeRng } from '../../rng';
import { colors, darken, fonts, shadows } from '../../theme';
import { sfx } from '../../sound';
import { RulesRound, makeRules, makeRulesRound } from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
}

// A gentle take on "Rules!": each round shows a rule ("Tap all the
// ANIMALS!") and a tile grid; clear every match to advance. On hard, some
// rounds only say "Do Rule #N again!" — you have to REMEMBER what it was.
export function RulesGame({ onHome, difficulty }: Props) {
  const { rulesRounds: roundsToWin, rulesTiles: tileCount, rulesRecallFrom: recallFrom } =
    settingsFor(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const rulesRef = useRef(makeRules(rngRef.current, roundsToWin));

  const buildRound = (idx: number): RulesRound => {
    // A recall round REPEATS an earlier rule without restating it — it only
    // makes sense once that rule has already been shown.
    const recall = idx >= recallFrom && idx % 3 === 2;
    const ruleIdx = recall ? idx % recallFrom : idx;
    return makeRulesRound(
      rngRef.current, manifest.spotit.icons, rulesRef.current, ruleIdx, tileCount, recall,
    );
  };

  const [roundIdx, setRoundIdx] = useState(0);
  const [round, setRound] = useState<RulesRound>(() => buildRound(0));
  const [tapped, setTapped] = useState<number[]>([]);
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState(0);
  const [timerKey, setTimerKey] = useState(0);
  const showTimer = settingsFor(difficulty).timer;
  const won = roundIdx >= roundsToWin;
  const elapsed = useElapsed(showTimer && !won, timerKey);

  const onTile = (i: number) => {
    if (won || tapped.includes(i)) return;
    if (round.tiles[i].isMatch) {
      sfx.good();
      const next = [...tapped, i];
      setTapped(next);
      if (next.length === round.matchCount) {
        setCelebrate((c) => c + 1);
        const nextIdx = roundIdx + 1;
        setTimeout(() => {
          setRoundIdx(nextIdx);
          if (nextIdx < roundsToWin) {
            setRound(buildRound(nextIdx));
            setTapped([]);
          }
        }, 550);
      }
    } else {
      sfx.wrong();
      setWrongIdx(i);
      setTimeout(() => setWrongIdx((w) => (w === i ? null : w)), 450);
    }
  };

  const reset = () => {
    setTimerKey((k) => k + 1);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    rulesRef.current = makeRules(rngRef.current, roundsToWin);
    setRoundIdx(0);
    setRound(buildRound(0));
    setTapped([]);
    setWrongIdx(null);
  };

  const { width, height } = useWindowDimensions();
  const cols = 3;
  const rows = Math.ceil(tileCount / cols);
  const gap = 12;
  const tile = Math.min(
    (Math.min(width - 32, 520) - (cols - 1) * gap) / cols,
    (height - 84 - 130 - (rows - 1) * gap) / rows,
    140
  );

  return (
    <GameShell
      title="Rule Time!"
      subtitle="Do what the rule says as fast as you can"
      onBack={onHome}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {showTimer ? <TimerRing elapsed={elapsed} size={44} stroke={5} showLabel testID="rules-timer" /> : null}
          <ScoreChip label={`📜 ${Math.min(roundIdx, roundsToWin)}/${roundsToWin}`} testID="rules-score" />
        </View>
      }
    >
      <View style={styles.board}>
        <View style={[styles.ruleCard, shadows.soft]} testID={`rules-rule-${round.rule.category}${round.isRecall ? '-recall' : ''}`}>
          <Text style={styles.ruleNumber}>{round.isRecall ? 'Memory check!' : `Rule #${round.ruleNumber}`}</Text>
          <Text style={styles.ruleText}>
            {round.isRecall ? `Do Rule #${round.ruleNumber} again — remember it? 🤔` : round.rule.label}
          </Text>
        </View>
        <View style={[styles.grid, { width: cols * tile + (cols - 1) * gap, gap }]}>
          {round.tiles.map((t, i) => {
            const done = tapped.includes(i);
            return (
              <Pressable
                key={`${roundIdx}-${i}`}
                onPress={() => onTile(i)}
                testID={`rules-tile-${i}-${t.icon}-${t.isMatch ? 'y' : 'n'}`}
                accessibilityLabel={t.icon}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.tile,
                  shadows.soft,
                  { width: tile, height: tile },
                  done && styles.tileDone,
                  wrongIdx === i && styles.wrong,
                  pressed && styles.pressed,
                ]}
              >
                <Image source={SPOTIT_ICONS[t.icon]} style={{ width: '78%', height: '78%' }} resizeMode="contain" />
                {done ? <SparkleBurst trigger={i} count={4} size={13} /> : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint} testID="rules-progress">
          Found {tapped.length} of {round.matchCount}
        </Text>
      </View>
      <WinOverlay
        visible={won}
        message={'Rule master! You followed every rule!'}
        onNext={reset} nextLabel={'Next Round ▶️'}
        onHome={onHome}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 16 },
  ruleCard: {
    backgroundColor: colors.gold,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: darken(colors.gold, 0.15),
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    maxWidth: 520,
  },
  ruleNumber: { fontFamily: fonts.body, fontSize: 12, color: darken(colors.gold, 0.5) },
  ruleText: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  tile: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileDone: { borderColor: colors.green, backgroundColor: 'rgba(95,191,110,0.14)' },
  wrong: { borderColor: colors.red, backgroundColor: 'rgba(232,86,79,0.15)' },
  pressed: { transform: [{ scale: 0.94 }] },
  hint: { fontFamily: fonts.bodyReg, color: colors.inkSoft, fontSize: 13 },
});
