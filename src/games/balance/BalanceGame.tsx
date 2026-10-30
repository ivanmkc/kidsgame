import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SPOTIT_ICONS } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { TimerRing, useElapsed } from '../../components/TimerRing';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty, settingsFor } from '../../difficulty';
import { Lang, numberWord, useLangEpoch } from '../../lang';
import { t } from '../../i18n';
import { makeRng } from '../../rng';
import { colors, fonts, shadows } from '../../theme';
import { say, sayThen, sfx } from '../../sound';
import { useWinLine } from '../winlines';
import { BalanceRound, balanceSettings, makeBalanceRound } from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

export function BalanceGame({ onHome, difficulty, lang }: Props) {
  const { isValid } = useLangEpoch(lang);
  const { rounds: roundsToWin } = balanceSettings(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState<BalanceRound>(() =>
    makeBalanceRound(rngRef.current, difficulty),
  );
  const [score, setScore] = useState(0);
  const [wrongPick, setWrongPick] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const lockedRef = useRef(false);
  const [timerKey, setTimerKey] = useState(0);
  const showTimer = settingsFor(difficulty).timer;
  const [won, setWon] = useState(false);
  useWinLine(won, t(lang, 'win.balance'));
  const elapsed = useElapsed(showTimer && !won, timerKey);
  const wrongPickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongVoiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (wrongPickTimer.current) clearTimeout(wrongPickTimer.current);
    if (wrongVoiceTimer.current) clearTimeout(wrongVoiceTimer.current);
  };

  useEffect(
    () => () => {
      if (wrongPickTimer.current) clearTimeout(wrongPickTimer.current);
      if (wrongVoiceTimer.current) clearTimeout(wrongVoiceTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (won) return;
    say(t(lang, 'shell.balance.sub'));
  }, [round, lang, won]);

  const pickAnswer = (v: number) => {
    if (won || lockedRef.current || revealed) return;
    if (v === round.answer) {
      lockedRef.current = true;
      setRevealed(true);
      clearTimers();
      sfx.good();
      const nextScore = score + 1;
      setScore(nextScore);
      sayThen([numberWord(lang, round.answer).t, t(lang, 'balance.praise')], () => {
        lockedRef.current = false;
        setRevealed(false);
        if (nextScore < roundsToWin) {
          setRound(makeBalanceRound(rngRef.current, difficulty));
          setWrongPick(null);
        } else {
          setWon(true);
        }
      });
    } else {
      lockedRef.current = true;
      sfx.wrong();
      setWrongPick(v);
      if (wrongPickTimer.current) clearTimeout(wrongPickTimer.current);
      wrongPickTimer.current = setTimeout(() => {
        lockedRef.current = false;
        setWrongPick(null);
      }, 450);
      if (wrongVoiceTimer.current) clearTimeout(wrongVoiceTimer.current);
      wrongVoiceTimer.current = setTimeout(() => {
        if (!isValid()) return;
        say(t(lang, 'shell.balance.sub'));
      }, 500);
    }
  };

  const reset = () => {
    lockedRef.current = false;
    setRevealed(false);
    setTimerKey((k) => k + 1);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setRound(makeBalanceRound(rngRef.current, difficulty));
    setScore(0);
    setWrongPick(null);
    setWon(false);
  };

  const iconSource = SPOTIT_ICONS[round.icon as keyof typeof SPOTIT_ICONS] || SPOTIT_ICONS.apple;

  const isLeftMissing = round.missingSide === 'left';
  const isRightMissing = round.missingSide === 'right';

  return (
    <GameShell
      title={t(lang, 'shell.balance.title')}
      subtitle={t(lang, 'shell.balance.sub')}
      onBack={onHome}
      lang={lang}
      right={
        <View style={styles.headerRight}>
          {showTimer && <TimerRing elapsed={elapsed} size={42} />}
          <ScoreChip label={`${score} / ${roundsToWin}`} />
        </View>
      }
    >
      <View style={styles.container}>
        <View style={[styles.wholeBox, shadows.sticker]}>
          <Text style={styles.wholeLabel}>
            {t(lang, 'shell.balance.title')}: {round.total}
          </Text>
          <View style={styles.itemsRow}>
            {Array.from({ length: round.total }).map((_, i) => (
              <Image key={i} source={iconSource} style={styles.iconStyle} />
            ))}
          </View>
        </View>

        <View style={styles.partsRow}>
          <View style={[styles.partBox, shadows.soft]}>
            <Text style={styles.partLabel}>
              {isLeftMissing && !revealed ? '?' : round.leftCount}
            </Text>
            {isLeftMissing && !revealed ? (
              <Text style={styles.questionMark}>?</Text>
            ) : (
              <View style={styles.itemsRowSmall}>
                {Array.from({ length: round.leftCount }).map((_, i) => (
                  <Image key={i} source={iconSource} style={styles.iconSmallStyle} />
                ))}
              </View>
            )}
          </View>

          <View style={[styles.partBox, shadows.soft]}>
            <Text style={styles.partLabel}>
              {isRightMissing && !revealed ? '?' : round.rightCount}
            </Text>
            {isRightMissing && !revealed ? (
              <Text style={styles.questionMark}>?</Text>
            ) : (
              <View style={styles.itemsRowSmall}>
                {Array.from({ length: round.rightCount }).map((_, i) => (
                  <Image key={i} source={iconSource} style={styles.iconSmallStyle} />
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.choicesRow}>
          {round.choices.map((val) => {
            const isWrong = wrongPick === val;
            return (
              <Pressable
                key={val}
                testID={`choice-${val}`}
                onPress={() => pickAnswer(val)}
                style={({ pressed }) => [
                  styles.choiceButton,
                  isWrong && styles.choiceWrong,
                  shadows.sticker,
                  pressed && { transform: [{ scale: 0.95 }] },
                ]}
              >
                <View style={styles.choiceInner}>
                  <Text style={styles.choiceText}>{val}</Text>
                  <View style={styles.itemsRowTiny}>
                    {Array.from({ length: val }).map((_, i) => (
                      <Image key={i} source={iconSource} style={styles.iconTinyStyle} />
                    ))}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <WinOverlay
        visible={won}
        message={t(lang, 'win.balance')}
        onNext={reset}
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 20,
  },
  wholeBox: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.blush,
    width: '100%',
    maxWidth: 400,
  },
  wholeLabel: {
    fontFamily: fonts.displayMed,
    fontSize: 20,
    color: colors.ink,
    marginBottom: 8,
  },
  itemsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  iconStyle: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  partsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 400,
  },
  partBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.blush,
    minHeight: 100,
    justifyContent: 'center',
  },
  partLabel: {
    fontFamily: fonts.displayMed,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 4,
  },
  questionMark: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.teal,
  },
  itemsRowSmall: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
  iconSmallStyle: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  choicesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
  },
  choiceButton: {
    backgroundColor: colors.teal,
    borderRadius: 20,
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  choiceWrong: {
    backgroundColor: colors.red,
  },
  choiceInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  choiceText: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: '#fff',
    lineHeight: 24,
  },
  itemsRowTiny: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 2,
    maxWidth: 72,
  },
  iconTinyStyle: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
});
