import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { GameShell, ScoreChip } from "../../components/GameShell";
import { SparkleBurst } from "../../components/Sparkles";
import { TimerRing, useElapsed } from "../../components/TimerRing";
import { WinOverlay } from "../../components/WinOverlay";
import { Difficulty, settingsFor } from "../../difficulty";
import { Lang, useLangEpoch } from "../../lang";
import { t } from "../../i18n";
import { makeRng } from "../../rng";
import { colors, fonts, shadows } from "../../theme";
import { say, sfx, stopNarration } from "../../sound";
import {
  LetterRound,
  makeLetterRound,
  settingsForLetters,
  shouldShowGlyph,
} from "./logic";
import { useWinLine } from "../winlines";

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

const SUCCESS_DELAY_MS = 600;

// Letter Hunt: spoken letter (or kana / phonics sound) → tap the matching
// tile. Pre-readers play entirely by ear; the tile is a huge Baloo glyph.
export function LettersGame({ onHome, difficulty, lang }: Props) {
  useLangEpoch(lang);
  const {
    rounds: roundsToWin,
    tiles: tileCount,
    tier,
  } = settingsForLetters(difficulty, lang);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const lockedRef = useRef(false);
  const wrongIdxRef = useRef<number | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [started, setStarted] = useState(false);
  const [captions, setCaptions] = useState(false);
  const [misses, setMisses] = useState(0);

  const [roundIdx, setRoundIdx] = useState(0);
  const [round, setRound] = useState<LetterRound>(() =>
    makeLetterRound(rngRef.current, tier, tileCount, undefined, lang),
  );
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const [correctIdx, setCorrectIdx] = useState<number | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [prevDifficulty, setPrevDifficulty] = useState(difficulty);
  if (difficulty !== prevDifficulty) {
    setPrevDifficulty(difficulty);
    setRoundIdx(0);
    setTimerKey((k) => k + 1);
  }
  const showTimer = settingsFor(difficulty).timer;
  const won = roundIdx >= roundsToWin;
  useWinLine(
    won && !isFinishing,
    t(lang, tier === "kana" ? "win.lettersKana" : "win.letters"),
  );
  const elapsed = useElapsed(
    showTimer && !won && !isFinishing && started,
    timerKey,
  );
  const { width, height } = useWindowDimensions();

  // Lang switch: rebuild the live round so prompt/caption re-skin immediately.
  const langMounted = useRef(false);
  const clearWrongTimer = () => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    wrongIdxRef.current = null;
    setWrongIdx(null);
  };
  useEffect(() => {
    if (!langMounted.current) {
      langMounted.current = true;
      return;
    }
    clearWrongTimer();
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    lockedRef.current = false;
    setRound(makeLetterRound(rngRef.current, tier, tileCount, undefined, lang));
    setCaptions(false);
    setMisses(0);
    setCorrectIdx(null);
    setIsFinishing(false);
  }, [difficulty, lang, tier, tileCount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      stopNarration();
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    },
    [],
  );

  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!started) return;
    if (won || isFinishing) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(1);
    };
  }, [pulse, started, won, isFinishing]);

  useEffect(() => {
    lockedRef.current = false;
    clearWrongTimer();
  }, [round]);

  // Speak on EVERY round — keyed on the round object, not the text, so a
  // repeated target still gets read aloud.
  useEffect(() => {
    if (started && !won && !isFinishing) say(round.promptLine);
  }, [round, won, isFinishing, started]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTile = (i: number) => {
    if (!started || won || isFinishing || lockedRef.current || wrongIdxRef.current === i) return;
    if (round.tiles[i].isAnswer) {
      lockedRef.current = true;
      clearWrongTimer();
      sfx.good();
      setMisses(0);
      setCorrectIdx(i);
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
      const next = roundIdx + 1;
      if (next >= roundsToWin) {
        setIsFinishing(true);
      }
      setRoundIdx(next);
      successTimerRef.current = setTimeout(() => {
        lockedRef.current = false;
        successTimerRef.current = null;
        setCorrectIdx(null);
        setIsFinishing(false);
        if (next < roundsToWin) {
          setRound(
            makeLetterRound(
              rngRef.current,
              tier,
              tileCount,
              round.targetKey,
              lang,
            ),
          );
        }
      }, SUCCESS_DELAY_MS);
    } else {
      sfx.wrong();
      wrongIdxRef.current = i;
      setWrongIdx(i);
      setMisses((m) => m + 1);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => {
        wrongIdxRef.current = null;
        setWrongIdx((w) => (w === i ? null : w));
        errorTimerRef.current = null;
      }, 450);
      say(round.promptLine); // re-speak so a stuck kid gets another try
    }
  };

  const reset = () => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    lockedRef.current = false;
    clearWrongTimer();
    setTimerKey((k) => k + 1);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setRoundIdx(0);
    setMisses(0);
    setRound(makeLetterRound(rngRef.current, tier, tileCount, undefined, lang));
    setCorrectIdx(null);
    setIsFinishing(false);
  };

  const cols = tileCount <= 6 ? 3 : 4;
  const rows = Math.ceil(tileCount / cols);
  const gap = 12;
  const tile = Math.max(
    10,
    Math.min(
      (Math.min(width - 32, 560) - (cols - 1) * gap) / cols,
      (height - 84 - 130 - (rows - 1) * gap) / rows,
      140,
    ),
  );

  const chipEmoji = tier === "kana" ? "🈶" : tier === "sound" ? "👂" : "🔤";
  const title =
    tier === "kana"
      ? t(lang, "shell.letters.titleKana")
      : t(lang, "shell.letters.title");

  return (
    <GameShell
      title={title}
      subtitle={
        tier === "sound"
          ? t(lang, "shell.letters.subSound")
          : t(lang, "shell.letters.subTap")
      }
      onBack={onHome}
      lang={lang}
      right={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {showTimer ? (
            <TimerRing
              elapsed={elapsed}
              size={44}
              stroke={5}
              showLabel
              testID="letters-timer"
            />
          ) : null}
          <ScoreChip
            label={`${chipEmoji} ${Math.min(roundIdx, roundsToWin)}/${roundsToWin}`}
            testID="letters-score"
          />
        </View>
      }
    >
      <View style={styles.board}>
        {!started ? (
          <View style={styles.startScreen}>
            <Text style={styles.startTitle}>{title}</Text>
            <Text style={styles.startBlurb}>
              {t(lang, "card.letters.blurb")}
            </Text>
            <Pressable
              onPress={() => setStarted(true)}
              testID="play-button"
              accessibilityRole="button"
              accessibilityLabel={t(lang, "listenchoose.play")}
              style={({ pressed }) => [
                styles.playButton,
                shadows.soft,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.playButtonText}>
                {t(lang, "listenchoose.play")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setCaptions((c) => !c)}
              testID="captions-toggle"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.captionsToggle,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.captionsToggleText}>
                💬 {t(lang, "listenchoose.captions")}:{" "}
                {t(lang, captions ? "listenchoose.on" : "listenchoose.off")}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.prompt,
                shadows.soft,
                shouldShowGlyph(misses, captions)
                  ? null
                  : styles.promptAudioOnly,
              ]}
              testID={`letters-prompt-${round.targetKey}`}
            >
              <Pressable
                onPress={() => {
                  if (!won && !isFinishing) say(round.promptLine);
                }}
                disabled={won || isFinishing}
                testID="speaker-button"
                accessibilityRole="button"
                accessibilityLabel={t(lang, "spell.hearAgain")}
                style={({ pressed }) => [
                  styles.speakerButton,
                  pressed && styles.pressed,
                ]}
              >
                <Animated.Text
                  style={[
                    styles.speakerIcon,
                    { transform: [{ scale: pulse }] },
                  ]}
                >
                  🔊
                </Animated.Text>
              </Pressable>
              {shouldShowGlyph(misses, captions) && (
                <View style={styles.promptGlyphContainer}>
                  <Text style={styles.promptGlyph} testID="letters-glyph">
                    {round.targetDisplay}
                  </Text>
                  {round.romanCaption ? (
                    <Text style={styles.caption}>{round.romanCaption}</Text>
                  ) : null}
                </View>
              )}
            </View>
            <View
              style={[
                styles.grid,
                { width: cols * tile + (cols - 1) * gap, gap },
              ]}
            >
              {round.tiles.map((t, i) => (
                <Pressable
                  key={`${round.targetKey}-${i}-${t.key}`}
                  onPress={() => onTile(i)}
                  testID={`letters-tile-${i}`}
                  accessibilityLabel={t.label}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.tile,
                    shadows.soft,
                    { width: tile, height: tile },
                    wrongIdx === i && styles.wrong,
                    correctIdx === i && styles.correct,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[styles.glyph, { fontSize: Math.round(tile * 0.5) }]}
                  >
                    {t.label}
                  </Text>
                  {correctIdx === i ? (
                    <SparkleBurst trigger={correctIdx} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
      <WinOverlay
        visible={won && !isFinishing}
        message={
          tier === "kana" ? t(lang, "win.lettersKana") : t(lang, "win.letters")
        }
        onNext={reset}
        nextLabel={t(lang, "overlay.playAgain")}
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  board: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 16,
  },
  startScreen: {
    alignItems: "center",
    gap: 24,
  },
  startTitle: {
    fontFamily: fonts.display,
    fontSize: 48,
    color: colors.ink,
    textAlign: "center",
  },
  startBlurb: {
    fontFamily: fonts.bodyReg,
    fontSize: 24,
    color: colors.inkSoft,
    textAlign: "center",
    maxWidth: 400,
  },
  playButton: {
    backgroundColor: colors.teal,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 36,
    alignItems: "center",
  },
  playButtonText: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: "#FFF",
  },
  captionsToggle: {
    backgroundColor: colors.paper,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  captionsToggleText: {
    fontFamily: fonts.body,
    fontSize: 18,
    color: colors.inkSoft,
  },
  prompt: {
    backgroundColor: "#F7EDDA",
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.gold,
    paddingVertical: 10,
    paddingHorizontal: 22,
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    maxWidth: 520,
  },
  promptAudioOnly: {
    borderRadius: 44,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  speakerButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  speakerIcon: {
    fontSize: 36,
  },
  promptGlyphContainer: {
    alignItems: "center",
  },
  promptGlyph: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.ink,
    textAlign: "center",
  },
  caption: {
    fontFamily: fonts.bodyReg,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 2,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  tile: {
    backgroundColor: colors.paper,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    fontFamily: fonts.display,
    color: colors.ink,
    includeFontPadding: false,
  },
  wrong: { borderColor: colors.red, backgroundColor: "rgba(232,86,79,0.15)" },
  correct: {
    borderColor: colors.teal,
    backgroundColor: "rgba(34,166,153,0.15)",
  },
  pressed: { transform: [{ scale: 0.94 }] },
});
