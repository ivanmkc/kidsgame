import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { Confetti } from '../../components/Confetti';
import { Lang } from '../../lang';
import { t } from '../../i18n';
import { saySequence, sayThen, sfx, stopNarration } from '../../sound';
import { playNote, primeMusic } from '../../music';
import { colors, fonts, shadows } from '../../theme';
import { ALL_PACKS, PACK_ORDER, PackId, Round } from './packs';
import {
  CarModeState,
  advance,
  currentRound,
  isComplete,
  startState,
  toGap,
  toReveal,
} from './logic';

interface Props {
  onHome: () => void;
  lang: Lang;
}

const PACK_COLORS: Record<PackId, string> = {
  boops: '#E8A24F',
  rhyme: '#9C6FD6',
  simon: '#2FB8AC',
  silly: '#E8564F',
  whoami: '#5DA9E8',
  animal: '#5FBF6E',
};

const TAP_WINDOW_MS = 600;

export function CarModeGame({ onHome, lang }: Props) {
  const [packId, setPackId] = useState<PackId>('boops');
  const [state, setState] = useState<CarModeState>(() =>
    startState('boops', Math.floor(Math.random() * 1e9)),
  );
  const [celebrate, setCelebrate] = useState(0);
  const [gameKey, setGameKey] = useState(0);

  const phaseRef = useRef(state.phase);
  phaseRef.current = state.phase;
  const stateRef = useRef(state);
  stateRef.current = state;

  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const round = currentRound(state);

  const clearTimers = useCallback(() => {
    if (gapTimerRef.current) { clearTimeout(gapTimerRef.current); gapTimerRef.current = null; }
    if (tapTimerRef.current) { clearTimeout(tapTimerRef.current); tapTimerRef.current = null; }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const playBoops = useCallback((n: number) => {
    primeMusic();
    const PENTATONIC = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];
    for (let i = 0; i < n; i++) {
      setTimeout(() => playNote(PENTATONIC[i % PENTATONIC.length]), i * 400);
    }
  }, []);

  const startRound = useCallback((r: Round) => {
    if (r.pack === 'boops' && r.noteCount) {
      playBoops(r.noteCount);
      const boopsDuration = (r.noteCount - 1) * 400 + 800;
      setTimeout(() => {
        saySequence(r.prompt, () => {
          setState((s) => toGap(s));
        });
      }, boopsDuration);
    } else {
      saySequence(r.prompt, () => {
        setState((s) => toGap(s));
      });
    }
  }, [playBoops]);

  useEffect(() => {
    if (state.phase === 'prompt' && round) {
      startRound(round);
    }
  }, [state.roundIdx, gameKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.phase === 'gap' && round) {
      gapTimerRef.current = setTimeout(() => {
        setState((s) => toReveal(s));
      }, round.gapMs);
    }
    return () => {
      if (gapTimerRef.current) { clearTimeout(gapTimerRef.current); gapTimerRef.current = null; }
    };
  }, [state.phase, state.roundIdx, gameKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.phase === 'reveal' && round) {
      if (round.sfx === 'boing') sfx.boing();
      else if (round.sfx === 'good') sfx.good();
      saySequence(round.reveal);
    }
  }, [state.phase, state.roundIdx, gameKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const doAdvance = useCallback(() => {
    clearTimers();
    tapCountRef.current = 0;
    stopNarration();
    setState((s) => {
      const next = advance(s);
      if (isComplete(next)) {
        setCelebrate((c) => c + 1);
      }
      return next;
    });
  }, [clearTimers]);

  const onTap = useCallback(() => {
    sfx.tap();
    primeMusic();

    if (isComplete(stateRef.current)) return;

    if (stateRef.current.phase === 'prompt') return;

    if (stateRef.current.phase === 'gap') {
      if (gapTimerRef.current) { clearTimeout(gapTimerRef.current); gapTimerRef.current = null; }
      setState((s) => toReveal(s));
      return;
    }

    if (stateRef.current.phase === 'reveal') {
      const r = currentRound(stateRef.current);
      if (r?.twoTapAnswer) {
        tapCountRef.current++;
        if (tapCountRef.current === 1) {
          if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
          tapTimerRef.current = setTimeout(() => {
            tapCountRef.current = 0;
            doAdvance();
          }, TAP_WINDOW_MS);
          return;
        }
        if (tapCountRef.current >= 2) {
          if (tapTimerRef.current) { clearTimeout(tapTimerRef.current); tapTimerRef.current = null; }
          tapCountRef.current = 0;
          doAdvance();
          return;
        }
      }
      doAdvance();
    }
  }, [doAdvance]);

  const switchPack = useCallback((id: PackId) => {
    clearTimers();
    tapCountRef.current = 0;
    stopNarration();
    setPackId(id);
    setState(startState(id, Math.floor(Math.random() * 1e9)));
    setGameKey((k) => k + 1);
  }, [clearTimers]);

  const done = isComplete(state);
  const bgColor = PACK_COLORS[packId];
  const { width, height } = useWindowDimensions();
  const buttonSize = Math.min(width, height) * 0.5;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (state.phase === 'gap' || state.phase === 'reveal') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
  }, [state.phase, pulseAnim]);

  const packName = ALL_PACKS[packId].name;
  const roundNum = state.roundIdx + 1;
  const totalRounds = state.rounds.length;

  return (
    <GameShell
      title={t(lang, 'shell.carmode.title' as never)}
      subtitle={packName}
      onBack={onHome}
      lang={lang}
      right={<ScoreChip label={`${roundNum}/${totalRounds}`} testID="carmode-score" />}
    >
      <View style={[styles.surface, { backgroundColor: bgColor }]} testID="carmode-surface">
        {!done && (
          <Pressable
            onPress={onTap}
            style={styles.tapArea}
            accessibilityRole="button"
            accessibilityLabel="Tap to continue"
            testID="carmode-tap"
          >
            <Animated.View
              style={[
                styles.bigButton,
                {
                  width: buttonSize,
                  height: buttonSize,
                  borderRadius: buttonSize / 2,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <Text style={styles.phaseEmoji}>
                {state.phase === 'prompt' ? '👂' : state.phase === 'gap' ? '🤔' : '👆'}
              </Text>
              <Text style={styles.phaseText}>
                {state.phase === 'prompt'
                  ? 'Listen...'
                  : state.phase === 'gap'
                    ? 'Your turn!'
                    : 'Tap!'}
              </Text>
            </Animated.View>
          </Pressable>
        )}

        {done && (
          <View style={styles.doneWrap}>
            <Text style={styles.doneText}>All done!</Text>
            <View style={styles.packRow}>
              {PACK_ORDER.map((id) => (
                <Pressable
                  key={id}
                  onPress={() => switchPack(id)}
                  style={({ pressed }) => [
                    styles.packBtn,
                    { backgroundColor: PACK_COLORS[id] },
                    id === packId && styles.packBtnActive,
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityLabel={ALL_PACKS[id].name}
                  testID={`carmode-pack-${id}`}
                >
                  <Text style={styles.packBtnText}>{ALL_PACKS[id].name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>
      {celebrate ? <Confetti count={24} /> : null}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lifted,
  },
  phaseEmoji: {
    fontSize: 64,
  },
  phaseText: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: '#fff',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  doneWrap: {
    alignItems: 'center',
    gap: 24,
    paddingHorizontal: 24,
  },
  doneText: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  packRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    maxWidth: 500,
  },
  packBtn: {
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 22,
    minWidth: 130,
    alignItems: 'center',
    ...shadows.soft,
  },
  packBtnActive: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  packBtnText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: '#fff',
  },
});
