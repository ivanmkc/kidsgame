import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SPOTIT_ICONS } from "../../assets/images";
import { GameShell, ScoreChip } from "../../components/GameShell";
import { SparkleBurst } from "../../components/Sparkles";
import { TimerRing, useElapsed } from "../../components/TimerRing";
import { WinOverlay } from "../../components/WinOverlay";
import { Difficulty, settingsFor } from "../../difficulty";
import { Lang, useLangEpoch } from "../../lang";
import { t } from "../../i18n";
import { manifest } from "../../manifest";
import { makeRng } from "../../rng";
import { colors, fonts, shadows } from "../../theme";
import { sayThen, saySequence, sfx, stopNarration } from "../../sound";
import { WORDS, wordFor } from "../../curriculum/content";
import {
  SoundsRound,
  makeSoundsRound,
  resolveSoundsPrompts,
  settingsForSounds,
  soundsLayout,
} from "./logic";
import { useWinLine } from "../winlines";

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
  const lockedRef = useRef(false);
  const wrongTimerRef = useRef<NodeJS.Timeout | null>(null);
  const diffMounted = useRef(false);
  const roundEpochRef = useRef(0);
  const [roundIdx, setRoundIdx] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [round, setRound] = useState<SoundsRound>(() =>
    makeSoundsRound(rngRef.current, manifest.spotit.icons, lang, tileCount),
  );
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const [correctIdx, setCorrectIdx] = useState<number | null>(null);
  const [timerKey, setTimerKey] = useState(0);
  const [prevDifficulty, setPrevDifficulty] = useState(difficulty);

  if (difficulty !== prevDifficulty) {
    setPrevDifficulty(difficulty);
    setRoundIdx(0);
    setTimerKey((k) => k + 1);
    setIsFinishing(false);
    setWrongIdx(null);
    setCorrectIdx(null);
    setRound(
      makeSoundsRound(rngRef.current, manifest.spotit.icons, lang, tileCount),
    );
  }

  const showTimer = settingsFor(difficulty).timer;
  const currentRoundIdx = difficulty !== prevDifficulty ? 0 : roundIdx;
  const won = currentRoundIdx >= roundsToWin;
  useWinLine(won, t(lang, lang === "en" ? "win.sounds" : "win.soundsWords"));
  useLangEpoch(lang);
  const elapsed = useElapsed(showTimer && !won && !isFinishing, timerKey);
  const { width, height } = useWindowDimensions();

  const prompts = resolveSoundsPrompts(round.target, lang);

  useEffect(() => {
    if (!diffMounted.current) {
      diffMounted.current = true;
      return;
    }
    lockedRef.current = false;
    roundEpochRef.current += 1;
    if (wrongTimerRef.current) {
      clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = null;
    }
  }, [difficulty]);

  useEffect(
    () => () => {
      stopNarration();
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
    },
    [],
  );
  useEffect(() => {
    if (!won) saySequence(prompts.promptLines);
  }, [round, lang, won]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTile = (i: number) => {
    if (won || lockedRef.current) return;
    if (round.tiles[i].isAnswer) {
      lockedRef.current = true;
      sfx.good();
      setWrongIdx(null);
      setCorrectIdx(i);
      // Wait for the confirmation chime to finish before advancing — otherwise
      // the next round's prompt say() cancels the celebration mid-word.
      const nextIdx = currentRoundIdx + 1;
      if (nextIdx >= roundsToWin) setIsFinishing(true);
      const epoch = roundEpochRef.current;
      sayThen(prompts.confirmLines, () => {
        lockedRef.current = false;
        setCorrectIdx(null);
        if (epoch !== roundEpochRef.current) return;
        setRoundIdx(nextIdx);
        if (nextIdx < roundsToWin) {
          setRound(
            makeSoundsRound(
              rngRef.current,
              manifest.spotit.icons,
              lang,
              tileCount,
              round.tiles[i].icon,
            ),
          );
        }
      });
    } else {
      sfx.wrong();
      setWrongIdx(i);
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = setTimeout(() => {
        wrongTimerRef.current = null;
        setWrongIdx((w) => (w === i ? null : w));
      }, 450);
      saySequence(prompts.promptLines);
    }
  };

  const onReplay = () => {
    if (won || lockedRef.current) return;
    saySequence(prompts.promptLines);
  };

  const reset = () => {
    if (wrongTimerRef.current) {
      clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = null;
    }
    setIsFinishing(false);
    lockedRef.current = false;
    roundEpochRef.current += 1;
    setTimerKey((k) => k + 1);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setRoundIdx(0);
    setRound(
      makeSoundsRound(rngRef.current, manifest.spotit.icons, lang, tileCount),
    );
    setWrongIdx(null);
    setCorrectIdx(null);
  };

  const { gap, tile, gridWidth } = soundsLayout(width, height, tileCount);

  return (
    <GameShell
      title={
        lang === "en"
          ? t(lang, "shell.sounds.titleEn")
          : t(lang, "shell.sounds.titleWords")
      }
      subtitle={
        lang === "en"
          ? t(lang, "shell.sounds.subEn")
          : t(lang, "shell.sounds.subWord")
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
              testID="sounds-timer"
            />
          ) : null}
          <ScoreChip
            label={`👂 ${Math.min(currentRoundIdx, roundsToWin)}/${roundsToWin}`}
            testID="sounds-score"
          />
        </View>
      }
    >
      <View style={styles.board}>
        <View style={styles.promptRow}>
          <Pressable
            onPress={onReplay}
            testID="speaker-button"
            accessibilityRole="button"
            accessibilityLabel={t(lang, "spell.hearAgain")}
            disabled={won}
            style={({ pressed }) => [
              styles.speakerButton,
              shadows.soft,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.speakerIcon}>🔊</Text>
          </Pressable>
          <Pressable
            onPress={onReplay}
            testID={`sounds-prompt-${round.targetIdx}`}
            accessibilityRole="button"
            accessibilityLabel={t(lang, "spell.hearAgain")}
            disabled={won}
            style={({ pressed }) => [
              styles.prompt,
              shadows.soft,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.promptText}>{prompts.displayPrompt}</Text>
            {prompts.caption ? (
              <Text style={styles.caption}>{prompts.caption}</Text>
            ) : null}
          </Pressable>
        </View>
        <View style={[styles.grid, { width: gridWidth, gap }]}>
          {round.tiles.map((t, i) => (
            <Pressable
              key={`${currentRoundIdx}-${i}-${t.icon}`}
              onPress={() => onTile(i)}
              testID={`sounds-tile-${i}`}
              accessibilityLabel={wordFor(WORDS[t.wordIdx], lang).text}
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
              <Image
                source={SPOTIT_ICONS[t.icon]}
                style={{ width: "80%", height: "80%" }}
                resizeMode="contain"
              />
              {correctIdx === i ? <SparkleBurst trigger={correctIdx} /> : null}
            </Pressable>
          ))}
        </View>
      </View>
      <WinOverlay
        visible={won}
        message={
          lang === "en" ? t(lang, "win.sounds") : t(lang, "win.soundsWords")
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
  promptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    maxWidth: 560,
  },
  speakerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F7EDDA",
    borderWidth: 3,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  speakerIcon: {
    fontSize: 24,
  },
  prompt: {
    backgroundColor: "#F7EDDA",
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.gold,
    paddingVertical: 10,
    paddingHorizontal: 22,
    alignItems: "center",
    maxWidth: 520,
    flexShrink: 1,
  },
  promptText: {
    fontFamily: fonts.display,
    fontSize: 20,
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
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  wrong: { borderColor: colors.red, backgroundColor: "rgba(232,86,79,0.15)" },
  correct: {
    borderColor: colors.green,
    backgroundColor: "rgba(95,191,110,0.15)",
  },
  pressed: { transform: [{ scale: 0.94 }] },
});
