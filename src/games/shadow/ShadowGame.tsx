import React, { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SPOTIT_ICONS, SPOTIT_SHADOWS } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { TimerRing, useElapsed } from '../../components/TimerRing';
import { SparkleBurst } from '../../components/Sparkles';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty, settingsFor } from '../../difficulty';
import { Lang } from '../../lang';
import { t } from '../../i18n';
import { manifest } from '../../manifest';
import { makeRng } from '../../rng';
import { colors, fonts, shadows } from '../../theme';
import { sfx } from '../../sound';
import { ShadowDifficulty, makeShadowRound } from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang?: Lang;
}

function shadowDifficulty(d: Difficulty): ShadowDifficulty {
  // medium+ turns on mental rotation and confusable same-category options
  if (d === 'hard') return { choices: 5, categoryDistractors: true, transform: true };
  if (d === 'medium') return { choices: 4, categoryDistractors: true, transform: true };
  return { choices: 3, categoryDistractors: false, transform: false };
}

export function ShadowGame({ onHome, difficulty, lang = 'en' }: Props) {
  const roundsToWin = settingsFor(difficulty).spotitRounds;
  const diff = shadowDifficulty(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState(() => makeShadowRound(rngRef.current, manifest.spotit.icons, diff));
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(0);
  const [timerKey, setTimerKey] = useState(0);
  const showTimer = settingsFor(difficulty).timer;
  const won = score >= roundsToWin;
  const elapsed = useElapsed(showTimer && !won, timerKey);

  const onPick = (icon: string) => {
    if (won) return;
    if (icon === round.answer) {
      sfx.good();
      setCelebrate((c) => c + 1);
      const next = score + 1;
      setScore(next);
      setWrong(null);
      if (next < roundsToWin) {
        setRound(makeShadowRound(rngRef.current, manifest.spotit.icons, diff));
      }
    } else {
      sfx.wrong();
      setWrong(icon);
      setTimeout(() => setWrong((w) => (w === icon ? null : w)), 450);
    }
  };

  const reset = () => {
    setTimerKey((k) => k + 1);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setWrong(null);
    setRound(makeShadowRound(rngRef.current, manifest.spotit.icons, diff));
  };

  const { width, height } = useWindowDimensions();
  const shadowSize = Math.min(width - 100, height - 84 - 210, 280);
  const optionSize = Math.min((Math.min(width, 640) - 32 - (diff.choices - 1) * 14) / diff.choices, 108);

  return (
    <GameShell
      title={t(lang, 'shell.shadow.title')}
      subtitle={diff.transform ? t(lang, 'shell.shadow.subTricky') : t(lang, 'shell.shadow.sub')}
      onBack={onHome}
      lang={lang}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {showTimer ? <TimerRing elapsed={elapsed} size={44} stroke={5} showLabel testID="shadow-timer" /> : null}
          <ScoreChip label={`🌙 ${score}/${roundsToWin}`} testID="shadow-score" />
        </View>
      }
    >
      <View style={styles.board}>
        <View
          style={[styles.shadowCard, shadows.sticker, { width: shadowSize + 48, height: shadowSize + 48 }]}
          testID={`shadow-answer-${round.answer}`}
        >
          <Image
            source={SPOTIT_SHADOWS[round.answer] ?? SPOTIT_ICONS[round.answer]}
            style={{
              width: shadowSize,
              height: shadowSize,
              transform: [
                { rotate: `${round.rotation}deg` },
                { scaleX: round.mirrored ? -1 : 1 },
              ],
            }}
            resizeMode="contain"
          />
          <SparkleBurst trigger={celebrate} count={7} />
        </View>
        <View style={styles.options}>
          {round.options.map((icon) => (
            <Pressable
              key={icon}
              onPress={() => onPick(icon)}
              testID={`shadow-option-${icon}`}
              accessibilityLabel={icon}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.option,
                shadows.soft,
                { width: optionSize, height: optionSize },
                wrong === icon && styles.wrong,
                pressed && styles.pressed,
              ]}
            >
              <Image source={SPOTIT_ICONS[icon]} style={{ width: '82%', height: '82%' }} resizeMode="contain" />
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>
          {diff.transform ? t(lang, 'shadow.hintTricky') : t(lang, 'shadow.hint')}
        </Text>
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, 'win.shadow')}
        onNext={reset} nextLabel={t(lang, 'overlay.nextRound')}
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 16 },
  shadowCard: {
    backgroundColor: colors.paper,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  options: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', justifyContent: 'center' },
  option: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrong: { borderColor: colors.red, backgroundColor: 'rgba(232,86,79,0.15)' },
  pressed: { transform: [{ scale: 0.94 }] },
  hint: { fontFamily: fonts.bodyReg, color: colors.inkSoft, fontSize: 14, textAlign: 'center' },
});
