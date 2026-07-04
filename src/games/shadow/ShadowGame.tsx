import React, { useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SPOTIT_ICONS } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { SparkleBurst } from '../../components/Sparkles';
import { WinOverlay } from '../../components/WinOverlay';
import { settingsFor } from '../../difficulty';
import { manifest } from '../../manifest';
import { Player } from '../../profile';
import { makeRng } from '../../rng';
import { colors, fonts, shadows } from '../../theme';
import { makeShadowRound } from './logic';

interface Props {
  onHome: () => void;
  player: Player | null;
}

export function ShadowGame({ onHome, player }: Props) {
  const settings = settingsFor(player?.difficulty);
  const roundsToWin = settings.spotitRounds; // reuse the 3/5/7 ladder
  const choices = player?.difficulty === 'hard' ? 5 : player?.difficulty === 'medium' ? 4 : 3;
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState(() => makeShadowRound(rngRef.current, manifest.spotit.icons, choices));
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(0);
  const won = score >= roundsToWin;

  const onPick = (icon: string) => {
    if (won) return;
    if (icon === round.answer) {
      setCelebrate((c) => c + 1);
      const next = score + 1;
      setScore(next);
      setWrong(null);
      if (next < roundsToWin) {
        setRound(makeShadowRound(rngRef.current, manifest.spotit.icons, choices));
      }
    } else {
      setWrong(icon);
      setTimeout(() => setWrong((w) => (w === icon ? null : w)), 450);
    }
  };

  const reset = () => {
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setWrong(null);
    setRound(makeShadowRound(rngRef.current, manifest.spotit.icons, choices));
  };

  const { width, height } = useWindowDimensions();
  const shadowSize = Math.min(width - 80, height - 84 - 200, 300);
  const optionSize = Math.min((width - 32 - (choices - 1) * 14) / choices, 110);

  return (
    <GameShell
      title="Shadow Match"
      subtitle="Whose shadow is this?"
      onBack={onHome}
      right={<ScoreChip label={`🌙 ${score}/${roundsToWin}`} testID="shadow-score" />}
    >
      <View style={styles.board}>
        <View
          style={[styles.shadowCard, shadows.sticker, { width: shadowSize + 44, height: shadowSize + 44 }]}
          testID={`shadow-answer-${round.answer}`}
        >
          <Image
            source={SPOTIT_ICONS[round.answer]}
            style={{ width: shadowSize, height: shadowSize, tintColor: '#4B3A57' }}
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
        <Text style={styles.hint}>Tap the sticker that makes the shadow!</Text>
      </View>
      <WinOverlay
        visible={won}
        message={player ? `Shadow wizard, ${player.name}!` : 'You matched every shadow!'}
        onPlayAgain={reset}
        onHome={onHome}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, paddingHorizontal: 16 },
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
  hint: { fontFamily: fonts.bodyReg, color: colors.inkSoft, fontSize: 14 },
});
