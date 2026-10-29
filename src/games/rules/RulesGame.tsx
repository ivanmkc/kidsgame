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
import { TimerRing, useElapsed } from "../../components/TimerRing";
import { SparkleBurst } from "../../components/Sparkles";
import { WinOverlay } from "../../components/WinOverlay";
import { Difficulty, settingsFor } from "../../difficulty";
import { Lang } from "../../lang";
import { t } from "../../i18n";
import { manifest } from "../../manifest";
import { makeRng } from "../../rng";
import { colors, darken, fonts, shadows } from "../../theme";
import { say, saySequence, sfx, stopNarration } from "../../sound";
import {
  RulesRound,
  makeRules,
  makeRulesRound,
  pickRuleIndex,
  rulesIntroLine,
  rulesLayout,
  rulesRecallLine,
  tileLabel,
} from "./logic";
import { useWinLine } from "../winlines";

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang?: Lang;
}

// A gentle take on "Rules!": each round shows a rule ("Tap all the
// ANIMALS!") and a tile grid; clear every match to advance. On hard, some
// rounds only say "Do Rule #N again!" — you have to REMEMBER what it was.
export function RulesGame({ onHome, difficulty, lang = "en" }: Props) {
  const {
    rulesRounds: roundsToWin,
    rulesTiles: tileCount,
    rulesRecallFrom: recallFrom,
  } = settingsFor(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const rulesRef = useRef(makeRules(rngRef.current, roundsToWin));
  const lockedRef = useRef(false);

  const buildRound = (idx: number): RulesRound => {
    // A recall round REPEATS an earlier rule without restating it — it only
    // makes sense once that rule has already been shown.
    const { ruleIdx, isRecall } = pickRuleIndex(
      rngRef.current,
      idx,
      recallFrom,
      rulesRef.current,
    );
    return makeRulesRound(
      rngRef.current,
      manifest.spotit.icons,
      rulesRef.current,
      ruleIdx,
      tileCount,
      isRecall,
    );
  };

  const [roundIdx, setRoundIdx] = useState(0);
  const [round, setRound] = useState<RulesRound>(() => buildRound(0));
  const [tapped, setTapped] = useState<number[]>([]);
  const tappedRef = useRef<number[]>([]);
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const [reminded, setReminded] = useState(false);
  const remindTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remind = () => {
    sfx.tap();
    say(round.rule.label);
    setReminded(true);
    if (remindTimer.current) clearTimeout(remindTimer.current);
    remindTimer.current = setTimeout(() => setReminded(false), 2600);
  };
  const [celebrate, setCelebrate] = useState(0);
  const [timerKey, setTimerKey] = useState(0);
  const showTimer = settingsFor(difficulty).timer;
  const won = roundIdx >= roundsToWin;
  useWinLine(won, t(lang, "win.rules"));
  const elapsed = useElapsed(showTimer && !won, timerKey);

  useEffect(() => {
    return () => {
      stopNarration();
      if (remindTimer.current) clearTimeout(remindTimer.current);
      if (winTimer.current) clearTimeout(winTimer.current);
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
    };
  }, []);

  // Speak the game intro once, then every rule aloud — pre-readers play
  // entirely by ear here.
  const introDone = useRef(false);
  useEffect(() => {
    if (won || lockedRef.current) return;
    const line = round.isRecall
      ? rulesRecallLine(round.ruleNumber, lang)
      : round.rule.label;
    setReminded(false);
    if (!introDone.current) {
      introDone.current = true;
      saySequence([rulesIntroLine(lang), line]);
    } else {
      say(line);
    }
  }, [round, lang, won]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTile = (i: number) => {
    if (lockedRef.current || won || tappedRef.current.includes(i)) return;
    if (round.tiles[i].isMatch) {
      sfx.good();
      const next = [...tappedRef.current, i];
      tappedRef.current = next;
      setTapped((prev) => (prev.includes(i) ? prev : [...prev, i]));
      if (next.length === round.matchCount) {
        lockedRef.current = true;
        setCelebrate((c) => c + 1);
        const nextIdx = roundIdx + 1;
        if (remindTimer.current) clearTimeout(remindTimer.current);
        if (winTimer.current) clearTimeout(winTimer.current);
        winTimer.current = setTimeout(() => {
          lockedRef.current = false;
          setRoundIdx(nextIdx);
          if (nextIdx < roundsToWin) {
            setRound(buildRound(nextIdx));
            tappedRef.current = [];
            setTapped([]);
          }
        }, 550);
      }
    } else {
      lockedRef.current = true;
      sfx.wrong();
      say(tileLabel(round.tiles[i].icon, lang));
      setWrongIdx(i);
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => {
        lockedRef.current = false;
        setWrongIdx((w) => (w === i ? null : w));
      }, 450);
    }
  };

  const reset = () => {
    lockedRef.current = false;
    setTimerKey((k) => k + 1);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    rulesRef.current = makeRules(rngRef.current, roundsToWin);
    setRoundIdx(0);
    setRound(buildRound(0));
    tappedRef.current = [];
    setTapped([]);
    setWrongIdx(null);
  };

  const { width, height } = useWindowDimensions();
  const { tile, gap, cols, isLandscape } = rulesLayout(
    width,
    height,
    tileCount,
  );

  return (
    <GameShell
      title={t(lang, "shell.rules.title")}
      subtitle={t(lang, "shell.rules.sub")}
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
              testID="rules-timer"
            />
          ) : null}
          <ScoreChip
            label={`📜 ${Math.min(roundIdx, roundsToWin)}/${roundsToWin}`}
            testID="rules-score"
          />
        </View>
      }
    >
      <View
        style={[styles.board, isLandscape && styles.boardLandscape]}
        testID="rules-board"
      >
        <View
          style={[
            styles.ruleCard,
            isLandscape && styles.ruleCardLandscape,
            shadows.soft,
          ]}
          testID={`rules-rule-${round.rule.category}${round.isRecall ? "-recall" : ""}`}
        >
          <Text style={styles.ruleNumber}>
            {round.isRecall
              ? t(lang, "rules.memoryCheck")
              : t(lang, "rules.ruleNumber", { n: round.ruleNumber })}
          </Text>
          <Text
            style={[styles.ruleText, isLandscape && styles.ruleTextLandscape]}
          >
            {round.isRecall && !reminded
              ? t(lang, "rules.doAgain", { n: round.ruleNumber })
              : round.rule.label}
          </Text>
          {round.isRecall && !reminded ? (
            <Pressable
              onPress={remind}
              testID="rules-remind"
              accessibilityLabel={t(lang, "rules.remind")}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.remindBtn,
                shadows.soft,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.remindText}>{t(lang, "rules.remind")}</Text>
            </Pressable>
          ) : null}
        </View>
        <View
          style={[styles.gridArea, isLandscape && styles.gridAreaLandscape]}
        >
          <View
            style={[
              styles.grid,
              { width: cols * tile + (cols - 1) * gap, gap },
            ]}
          >
            {round.tiles.map((t, i) => {
              const done = tapped.includes(i);
              return (
                <Pressable
                  key={`${roundIdx}-${i}`}
                  onPress={() => onTile(i)}
                  testID={`rules-tile-${i}-${t.icon}-${t.isMatch ? "y" : "n"}`}
                  accessibilityLabel={tileLabel(t.icon, lang)}
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
                  <Image
                    source={SPOTIT_ICONS[t.icon]}
                    style={{ width: "78%", height: "78%" }}
                    resizeMode="contain"
                  />
                  {done ? (
                    <SparkleBurst trigger={i} count={4} size={13} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint} testID="rules-progress">
            {t(lang, "rules.progress", {
              found: tapped.length,
              total: round.matchCount,
            })}
          </Text>
        </View>
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, "win.rules")}
        onNext={reset}
        nextLabel={t(lang, "overlay.nextRound")}
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  remindBtn: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    marginTop: 6,
    alignSelf: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  remindText: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
  board: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 16,
    minHeight: 0,
  },
  boardLandscape: {
    flexDirection: "row",
    gap: 20,
  },
  ruleCard: {
    backgroundColor: colors.gold,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: darken(colors.gold, 0.15),
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: "center",
    maxWidth: 520,
  },
  ruleCardLandscape: {
    maxWidth: 220,
    paddingHorizontal: 16,
  },
  ruleNumber: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: darken(colors.gold, 0.5),
  },
  ruleText: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    textAlign: "center",
  },
  ruleTextLandscape: {
    fontSize: 18,
  },
  gridArea: {
    alignItems: "center",
    gap: 16,
  },
  gridAreaLandscape: {
    gap: 8,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  tile: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  tileDone: {
    borderColor: colors.green,
    backgroundColor: "rgba(95,191,110,0.14)",
  },
  wrong: { borderColor: colors.red, backgroundColor: "rgba(232,86,79,0.15)" },
  pressed: { transform: [{ scale: 0.94 }] },
  hint: { fontFamily: fonts.bodyReg, color: colors.inkSoft, fontSize: 13 },
});
