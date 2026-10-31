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
import { TimerRing, useElapsed } from "../../components/TimerRing";
import { WinOverlay } from "../../components/WinOverlay";
import { Difficulty, settingsFor } from "../../difficulty";
import { Lang, numberWord, useLangEpoch } from "../../lang";
import { t } from "../../i18n";
import { makeRng } from "../../rng";
import { colors, fonts, shadows } from "../../theme";
import { saySequence, sfx } from "../../sound";
import {
  NumberRound,
  makeNumberRound,
  reskinNumberRound,
  settingsForNumbers,
} from "./logic";
import { useWinLine } from "../winlines";

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

const SUCCESS_DELAY_MS = 400;

// Number Hunt: spoken number → tap the matching tile. JA/zh hard tier
// swaps arabic tiles for han numerals so recognition transfers across
// scripts.
export function NumbersGame({ onHome, difficulty, lang }: Props) {
  const [script, setScript] = useState<"arabic" | "han" | "auto">("auto");
  const numSettings = settingsForNumbers(difficulty, lang, script);
  const { rounds: roundsToWin } = numSettings;
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedRef = useRef(false);
  const wrongIdxRef = useRef<number | null>(null);
  const [roundIdx, setRoundIdx] = useState(0);
  const [round, setRound] = useState<NumberRound>(() =>
    makeNumberRound(rngRef.current, numSettings, lang),
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

  const { epoch, isValid } = useLangEpoch(lang);

  const clearWrongTimer = () => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    wrongIdxRef.current = null;
    setWrongIdx(null);
  };

  const mountedRef = useRef(false);

  // Lang or difficulty switch: rebuild the active round so prompt lines and tiles match the new settings.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    clearWrongTimer();
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
    lockedRef.current = false;
    setIsFinishing(false);
    setRound(makeNumberRound(rngRef.current, numSettings, lang));
    setCorrectIdx(null);
  }, [epoch, difficulty]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, []);

  // script toggle must re-skin the CURRENT round's tiles, not wait a round
  useEffect(() => {
    setRound((cur) => reskinNumberRound(cur, numSettings.useHan));
  }, [numSettings.useHan]);
  const showTimer = settingsFor(difficulty).timer;
  const won = roundIdx >= roundsToWin;
  useWinLine(won && !isFinishing, t(lang, "win.numbers"));
  const elapsed = useElapsed(showTimer && !won && !isFinishing, timerKey);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (!won) saySequence(round.promptLines);
  }, [round, won]); // eslint-disable-line react-hooks/exhaustive-deps

  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (won || isFinishing) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.15,
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
      pulse.stopAnimation();
    };
  }, [pulse, won, isFinishing]);

  const onReplayPrompt = () => {
    if (won || isFinishing || lockedRef.current) return;
    saySequence(round.promptLines);
  };

  const onTile = (i: number) => {
    if (won || isFinishing || lockedRef.current || wrongIdxRef.current === i) return;
    if (round.tiles[i].isAnswer) {
      lockedRef.current = true;
      clearWrongTimer();
      sfx.good();
      setCorrectIdx(i);
      const next = roundIdx + 1;
      if (next >= roundsToWin) {
        setIsFinishing(true);
      }
      setRoundIdx(next);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      lockTimerRef.current = setTimeout(() => {
        if (!isValid()) return;
        lockedRef.current = false;
        lockTimerRef.current = null;
        setCorrectIdx(null);
        setIsFinishing(false);
        if (next < roundsToWin) {
          setRound(
            makeNumberRound(rngRef.current, numSettings, lang, round.targetN),
          );
        }
      }, SUCCESS_DELAY_MS);
    } else {
      sfx.wrong();
      wrongIdxRef.current = i;
      setWrongIdx(i);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => {
        wrongIdxRef.current = null;
        errorTimerRef.current = null;
        if (!isValid()) return;
        setWrongIdx((w) => (w === i ? null : w));
      }, 450);
      saySequence(round.promptLines);
    }
  };

  const reset = () => {
    clearWrongTimer();
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
    lockedRef.current = false;
    setTimerKey((k) => k + 1);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setRoundIdx(0);
    setRound(makeNumberRound(rngRef.current, numSettings, lang));
    setCorrectIdx(null);
    setIsFinishing(false);
  };

  const cols = numSettings.tiles <= 6 ? 3 : numSettings.tiles <= 8 ? 4 : 3;
  const rows = Math.ceil(numSettings.tiles / cols);
  const gap = 12;
  const tile = Math.max(
    60,
    Math.min(
      (Math.min(width - 32, 560) - (cols - 1) * gap) / cols,
      (height - 84 - 130 - (rows - 1) * gap) / rows,
      140,
    ),
  );
  const caption = lang === "en" ? "" : numberWord(lang, round.targetN).r || "";

  return (
    <GameShell
      title={
        numSettings.useHan
          ? t(lang, "shell.numbers.titleHan")
          : t(lang, "shell.numbers.title")
      }
      subtitle={t(lang, "shell.numbers.sub")}
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
              testID="numbers-timer"
            />
          ) : null}
          {lang !== "en" ? (
            <Pressable
              onPress={() => {
                if (lockedRef.current || won || isFinishing) return;
                sfx.tap();
                setScript(numSettings.useHan ? "arabic" : "han");
              }}
              testID="numbers-script"
              accessibilityRole="button"
              accessibilityLabel={t(lang, "button.switchScript")}
              style={{
                backgroundColor: numSettings.useHan ? "#FFE9B8" : "white",
                borderRadius: 12,
                borderWidth: 2,
                borderColor: "#E8C97A",
                paddingVertical: 11,
                paddingHorizontal: 12,
                minHeight: 44,
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: 14,
                  color: colors.ink,
                }}
              >
                {numSettings.useHan ? "一二三" : "123"}
              </Text>
            </Pressable>
          ) : null}
          <ScoreChip
            label={`🔢 ${Math.min(roundIdx, roundsToWin)}/${roundsToWin}`}
            testID="numbers-score"
          />
        </View>
      }
    >
      <View style={styles.board}>
        <Pressable
          onPress={onReplayPrompt}
          disabled={won || isFinishing}
          accessibilityRole="button"
          accessibilityLabel={t(lang, "spell.hearAgain")}
          style={({ pressed }) => [
            styles.prompt,
            shadows.soft,
            pressed && styles.pressed,
          ]}
          testID={`numbers-prompt-${round.targetKey}`}
        >
          <Animated.Text
            style={[styles.speakerIcon, { transform: [{ scale: pulse }] }]}
            testID="speaker-icon"
          >
            🔊
          </Animated.Text>
          <View style={styles.promptTextContainer}>
            <Text style={styles.promptText}>{round.displayText}</Text>
            {caption ? <Text style={styles.caption}>{caption}</Text> : null}
          </View>
        </Pressable>
        <View
          style={[styles.grid, { width: cols * tile + (cols - 1) * gap, gap }]}
        >
          {round.tiles.map((t, i) => (
            <Pressable
              key={`${round.targetKey}-${i}-${t.key}`}
              onPress={() => onTile(i)}
              testID={`numbers-tile-${i}`}
              accessibilityLabel={t.label}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.tile,
                shadows.soft,
                { width: tile, height: tile },
                correctIdx === i && styles.correct,
                wrongIdx === i && styles.wrong,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.glyph,
                  {
                    fontSize: Math.round(
                      tile * (t.label.length > 1 ? 0.4 : 0.55),
                    ),
                  },
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <WinOverlay
        visible={won && !isFinishing}
        message={t(lang, "win.numbers")}
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
  prompt: {
    backgroundColor: "#F7EDDA",
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.gold,
    paddingVertical: 8,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minWidth: 96,
  },
  speakerIcon: {
    fontSize: 24,
  },
  promptTextContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  promptText: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.ink,
    textAlign: "center",
  },
  caption: {
    fontFamily: fonts.bodyReg,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 0,
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
  correct: {
    borderColor: colors.green,
    backgroundColor: "rgba(95,191,110,0.15)",
  },
  wrong: { borderColor: colors.red, backgroundColor: "rgba(232,86,79,0.15)" },
  pressed: { transform: [{ scale: 0.94 }] },
});
