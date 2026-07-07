import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SPOTIT_ICONS } from '../../assets/images';
import { Confetti } from '../../components/Confetti';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { SparkleBurst } from '../../components/Sparkles';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty } from '../../difficulty';
import { Lang } from '../../lang';
import { makeRng } from '../../rng';
import { say, saySequence, sfx } from '../../sound';
import { colors, darken, fonts, shadows } from '../../theme';
import { RHYME_ICONS } from '../language/rhymeAssets';
import { SpellRound, SpellTile, decoysFor, linesForWord, makeRound, pickGameWords, wordPool, wordsPerGame } from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang; // accepted for menu wiring; English-only per phonics convention
}

// Some words come from the rhyme pack — cover both maps in one lookup.
function iconFor(icon: string): number | undefined {
  return SPOTIT_ICONS[icon] ?? RHYME_ICONS[icon];
}

export function SpellGame({ onHome, difficulty }: Props) {
  // All hooks unconditionally at the top — no early returns.
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const pool = useMemo(() => wordPool(SPOTIT_ICONS, RHYME_ICONS), []);
  const totalWords = wordsPerGame(difficulty);
  const decoys = decoysFor(difficulty);

  const [gameKey, setGameKey] = useState(0);           // bump on Play Again
  const gameWordsRef = useRef(pickGameWords(rngRef.current, pool, difficulty));
  const [wordIdx, setWordIdx] = useState(0);
  const [round, setRound] = useState<SpellRound>(() =>
    makeRound(rngRef.current, gameWordsRef.current[0], decoys),
  );
  const [placedIds, setPlacedIds] = useState<number[]>([]); // tile ids in slot order
  const [wrongId, setWrongId] = useState<number | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [celebrate, setCelebrate] = useState(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wordCount = gameWordsRef.current.length;
  const won = wordCount > 0 && wordIdx >= wordCount;

  // Fresh round → speak the intro + slowly-spelled word (chained).
  useEffect(() => {
    if (won) return;
    const { ask, spell } = linesForWord(round.word);
    saySequence([ask, spell]);
  }, [round, won]);

  useEffect(() => () => {
    if (wrongTimer.current) clearTimeout(wrongTimer.current);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  const filled = placedIds.length;
  const expected = round.letters[filled];

  const onTile = (tile: SpellTile) => {
    if (won || placedIds.includes(tile.id)) return;
    if (filled >= round.letters.length) return; // guarded during the 1s advance delay
    if (tile.letter === expected) {
      sfx.good();
      say(`${expected}!`);
      const nextPlaced = [...placedIds, tile.id];
      setPlacedIds(nextPlaced);
      if (nextPlaced.length === round.letters.length) {
        setCelebrate((c) => c + 1);
        const { done } = linesForWord(round.word);
        say(done);
        if (advanceTimer.current) clearTimeout(advanceTimer.current);
        advanceTimer.current = setTimeout(() => {
          const nextI = wordIdx + 1;
          if (nextI < wordCount) {
            setRound(makeRound(rngRef.current, gameWordsRef.current[nextI], decoys));
            setPlacedIds([]);
          }
          setWordIdx(nextI);
        }, 1700);
      }
    } else {
      sfx.wrong();
      setWrongId(tile.id);
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => setWrongId((w) => (w === tile.id ? null : w)), 500);
      // Re-speak the whole word slowly so the kid can try again with the cue.
      say(linesForWord(round.word).spell);
    }
  };

  const reset = () => {
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    gameWordsRef.current = pickGameWords(rngRef.current, pool, difficulty);
    setWordIdx(0);
    setPlacedIds([]);
    setRound(makeRound(rngRef.current, gameWordsRef.current[0], decoys));
    setGameKey((k) => k + 1);
  };

  const { width, height } = useWindowDimensions();
  const slotCount = round.letters.length;
  const tileCount = round.tiles.length;
  const bigIcon = Math.min(width * 0.4, height * 0.28, 220);
  const slot = Math.min((Math.min(width - 32, 560) - (slotCount - 1) * 10) / slotCount, 68);
  const tileSize = Math.min((Math.min(width - 32, 560) - (tileCount - 1) * 10) / tileCount, 74);

  const placedLetters = placedIds.map((id) => round.tiles.find((t) => t.id === id)?.letter ?? '');

  return (
    <GameShell
      title="Word Builder"
      subtitle="Tap the letters in order to spell the word"
      onBack={onHome}
      right={<ScoreChip label={`🔤 ${Math.min(wordIdx, wordCount)}/${wordCount}`} testID="spell-score" />}
    >
      <View style={styles.board} key={gameKey}>
        <Pressable
          onPress={() => { sfx.tap(); saySequence([linesForWord(round.word).ask, linesForWord(round.word).spell]); }}
          accessibilityLabel={`Hear the word ${round.word.en}`}
          accessibilityRole="button"
          style={({ pressed }) => [styles.iconCard, shadows.soft, pressed && styles.pressed]}
          testID={`spell-word-${round.word.icon}`}
        >
          {iconFor(round.word.icon) ? (
            <Image source={iconFor(round.word.icon)} style={{ width: bigIcon, height: bigIcon }} resizeMode="contain" />
          ) : (
            <Text style={styles.iconFallback}>{round.word.en}</Text>
          )}
          <Text style={styles.speakerHint}>🔊 Tap to hear again</Text>
        </Pressable>

        <View style={[styles.slotRow, { gap: 10 }]}>
          {round.letters.map((_, i) => {
            const filledLetter = placedLetters[i];
            const done = !!filledLetter;
            return (
              <View
                key={i}
                testID={`spell-slot-${i}`}
                style={[styles.slot, shadows.soft, { width: slot, height: slot * 1.15 }, done && styles.slotDone]}
              >
                {done ? <Text style={styles.slotText}>{filledLetter}</Text> : null}
                {done ? <SparkleBurst trigger={`${gameKey}-${wordIdx}-${i}`} count={4} size={11} /> : null}
              </View>
            );
          })}
        </View>

        <View style={[styles.tileRow, { gap: 10 }]}>
          {round.tiles.map((tile) => {
            const consumed = placedIds.includes(tile.id);
            return (
              <LetterTile
                key={`${gameKey}-${wordIdx}-${tile.id}`}
                tile={tile}
                size={tileSize}
                consumed={consumed}
                wobble={wrongId === tile.id}
                onPress={() => onTile(tile)}
              />
            );
          })}
        </View>
      </View>
      {celebrate ? <Confetti count={22} /> : null}
      <WinOverlay
        visible={won}
        message={`Great spelling! You built ${wordCount} words!`}
        onNext={reset}
        nextLabel={'Play Again ▶️'}
        onHome={onHome}
      />
    </GameShell>
  );
}

function LetterTile({
  tile, size, consumed, wobble, onPress,
}: {
  tile: SpellTile;
  size: number;
  consumed: boolean;
  wobble: boolean;
  onPress: () => void;
}) {
  const shake = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!wobble) return;
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 80, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 80, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, easing: Easing.linear, useNativeDriver: true }),
    ]).start();
  }, [wobble, shake]);
  useEffect(() => {
    Animated.spring(fade, { toValue: consumed ? 0 : 1, friction: 6, useNativeDriver: true }).start();
  }, [consumed, fade]);
  const rotate = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-9deg', '9deg'] });
  return (
    <Animated.View
      style={{
        opacity: fade,
        transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }, { rotate }],
      }}
      pointerEvents={consumed ? 'none' : 'auto'}
    >
      <Pressable
        onPress={onPress}
        testID={`spell-tile-${tile.id}`}
        accessibilityLabel={`Letter ${tile.letter}`}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.tile,
          shadows.soft,
          { width: size, height: size * 1.15 },
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.tileText}>{tile.letter}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 16 },
  iconCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.blush,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 4,
  },
  iconFallback: { fontFamily: fonts.display, fontSize: 40, color: colors.ink },
  speakerHint: { fontFamily: fonts.bodyReg, fontSize: 12, color: colors.inkSoft },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  slot: {
    backgroundColor: colors.paper,
    borderRadius: 14,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotDone: {
    borderStyle: 'solid',
    borderColor: colors.green,
    backgroundColor: 'rgba(95,191,110,0.14)',
  },
  slotText: { fontFamily: fonts.display, fontSize: 30, color: colors.ink },
  tileRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  tile: {
    backgroundColor: colors.gold,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: darken(colors.gold, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { fontFamily: fonts.display, fontSize: 32, color: colors.ink },
  pressed: { opacity: 0.75, transform: [{ scale: 0.94 }] },
});
