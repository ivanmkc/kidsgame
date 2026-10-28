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
import { say, sfx } from "../../sound";
import { CATEGORY_TEXT } from "../iconCategories";
import { itemLabel, makeOddOneRound } from "./logic";
import { useWinLine } from "../winlines";

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang?: Lang;
}

function oddSettings(d: Difficulty): { n: number } {
  // "which one does not belong?" — always categorical; harder = more items
  if (d === "hard") return { n: 9 };
  if (d === "medium") return { n: 6 };
  return { n: 4 };
}

const CELEBRATION_MS = 600;

export function OddOneGame({ onHome, difficulty, lang = "en" }: Props) {
  useLangEpoch(lang);
  const roundsToWin = settingsFor(difficulty).spotitRounds;
  const { n } = oddSettings(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [roundKey, setRoundKey] = useState(0);
  const [round, setRound] = useState(() =>
    makeOddOneRound(rngRef.current, manifest.spotit.icons, n),
  );
  const [score, setScore] = useState(0);
  const [celebratingIdx, setCelebratingIdx] = useState<number | null>(null);
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const showTimer = settingsFor(difficulty).timer;
  useWinLine(won, t(lang, "win.oddone"));
  const elapsed = useElapsed(showTimer && !won, timerKey);
  const roundClosedRef = useRef(false);
  const celebrateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoryKey = CATEGORY_TEXT[round.baseCategory]?.not;
  const prompt = categoryKey
    ? t(lang, categoryKey)
    : t(lang, "oddone.defaultQuestion");

  useEffect(() => {
    return () => {
      if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
    };
  }, []);

  useEffect(() => {
    roundClosedRef.current = false;
  }, [round]);

  // Speak on EVERY round — keyed on the round object, not the text, so a
  // repeated category still gets read aloud (kids play entirely by ear).
  useEffect(() => {
    if (!won) say(prompt);
  }, [round, lang, won]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (idx: number) => {
    if (won || roundClosedRef.current) return;
    roundClosedRef.current = true;
    if (idx === round.oddIndex) {
      sfx.good();
      const next = score + 1;
      setScore(next);
      setWrongIdx(null);
      setCelebratingIdx(idx);
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
      if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
      celebrateTimerRef.current = setTimeout(() => {
        setCelebratingIdx(null);
        if (next < roundsToWin) {
          setRoundKey((k) => k + 1);
          setRound(makeOddOneRound(rngRef.current, manifest.spotit.icons, n));
        } else {
          roundClosedRef.current = false;
          setWon(true);
        }
      }, CELEBRATION_MS);
    } else {
      sfx.wrong();
      setWrongIdx(idx);
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = setTimeout(() => {
        roundClosedRef.current = false;
        setWrongIdx((w) => (w === idx ? null : w));
      }, 450);
    }
  };

  const reset = () => {
    if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
    if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
    setTimerKey((k) => k + 1);
    roundClosedRef.current = false;
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setWon(false);
    setWrongIdx(null);
    setCelebratingIdx(null);
    setRoundKey((k) => k + 1);
    setRound(makeOddOneRound(rngRef.current, manifest.spotit.icons, n));
  };

  const { width, height } = useWindowDimensions();
  const cols = n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const gap = 12;
  const tile = Math.max(
    60,
    Math.min(
      (Math.min(width - 32, 600) - (cols - 1) * gap) / cols,
      (height - 84 - 90 - (rows - 1) * gap) / rows,
      150,
    ),
  );

  const subtitle = t(lang, "shell.oddone.sub");

  return (
    <GameShell
      title={t(lang, "shell.oddone.title")}
      subtitle={subtitle}
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
              testID="oddone-timer"
            />
          ) : null}
          <ScoreChip
            label={`🔍 ${score}/${roundsToWin}`}
            testID="oddone-score"
          />
        </View>
      }
    >
      <View style={styles.board}>
        <Pressable
          disabled={won}
          onPress={() => {
            if (won) return;
            sfx.tap();
            say(prompt);
          }}
          accessibilityRole="button"
          accessibilityLabel={prompt}
          style={({ pressed }) => [
            styles.question,
            shadows.soft,
            pressed && styles.pressed,
          ]}
          testID={`oddone-question-${round.baseCategory}`}
        >
          <Text style={styles.questionText}>🔊 {prompt}</Text>
        </Pressable>
        <View
          style={[styles.grid, { width: cols * tile + (cols - 1) * gap, gap }]}
        >
          {round.items.map((icon, i) => (
            <Pressable
              key={`${roundKey}-${i}`}
              onPress={() => onPick(i)}
              testID={`oddone-item-${i}-${icon}${i === round.oddIndex ? "-odd" : ""}`}
              accessibilityLabel={itemLabel(icon, lang)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.tile,
                shadows.soft,
                { width: tile, height: tile },
                celebratingIdx === i && styles.correct,
                wrongIdx === i && styles.wrong,
                pressed && styles.pressed,
              ]}
            >
              <Image
                source={SPOTIT_ICONS[icon]}
                style={{ width: "80%", height: "80%" }}
                resizeMode="contain"
              />
              {celebratingIdx === i ? (
                <SparkleBurst trigger={score} count={6} size={14} />
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, "win.oddone")}
        onNext={reset}
        nextLabel={t(lang, "overlay.nextRound")}
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
  question: {
    backgroundColor: "#F7EDDA",
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.gold,
    paddingVertical: 10,
    paddingHorizontal: 22,
    maxWidth: 520,
  },
  questionText: {
    fontFamily: fonts.display,
    fontSize: 19,
    color: colors.ink,
    textAlign: "center",
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
  correct: {
    borderColor: colors.green,
    backgroundColor: "rgba(95,191,110,0.15)",
  },
  wrong: { borderColor: colors.red, backgroundColor: "rgba(232,86,79,0.15)" },
  pressed: { transform: [{ scale: 0.94 }] },
});
