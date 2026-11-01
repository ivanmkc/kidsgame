import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { GameShell, ScoreChip } from "../../components/GameShell";
import { WinOverlay } from "../../components/WinOverlay";
import { SparkleBurst } from "../../components/Sparkles";
import { Difficulty } from "../../difficulty";
import { Lang, useLangEpoch } from "../../lang";
import { t } from "../../i18n";
import { makeRng } from "../../rng";
import { colors, fonts, shadows } from "../../theme";
import { isMuted, saySequence, sayThen, sfx, stopNarration } from "../../sound";
import { playSequence, stopSequence } from "../../music";
import { useWinLine } from "../winlines";
import {
  makeSameDiffRound,
  roundsToWin,
  isCorrect,
  nextScoreValue,
  SameDiffRound,
  phrasePitchRatios,
  getInstructionalFeedback,
  sameDiffLayout,
} from "./logic";

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

export function SameDiffGame({ onHome, difficulty, lang }: Props) {
  useLangEpoch(lang);
  const { width, height } = useWindowDimensions();
  const { isLandscape } = sameDiffLayout(width, height);
  const langRef = useRef(lang);
  langRef.current = lang;
  const total = roundsToWin(difficulty);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [round, setRound] = useState<SameDiffRound>(() =>
    makeSameDiffRound(rngRef.current, difficulty),
  );
  const [displayRound, setDisplayRound] = useState<SameDiffRound>(round);
  const historyRef = useRef<number[]>([round.phraseIdx]);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<
    "listenA" | "listenB" | "pick" | "transition"
  >("listenA");
  const [activeNote, setActiveNote] = useState<number | null>(null);
  const [wrongPick, setWrongPick] = useState<"same" | "different" | null>(null);
  const wrongPickRef = useRef<"same" | "different" | null>(null);
  const [correctPick, setCorrectPick] = useState<"same" | "different" | null>(
    null,
  );
  const [sparkKeys, setSparkKeys] = useState({ same: 0, different: 0 });
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundEpochRef = useRef(0);
  const lockedRef = useRef(false);
  const [roundIndex, setRoundIndex] = useState(0);
  const firstTryRef = useRef(true);
  const won = roundIndex >= total;
  useWinLine(won, t(lang, "win.samediff"));

  useEffect(() => {
    return () => {
      roundEpochRef.current++;
      if (gapTimer.current) clearTimeout(gapTimer.current);
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      if (replayTimer.current) clearTimeout(replayTimer.current);
      stopSequence();
      stopNarration();
    };
  }, []);

  const playRound = useCallback((r: SameDiffRound) => {
    const epoch = ++roundEpochRef.current;
    stopSequence();
    stopNarration();
    if (gapTimer.current) clearTimeout(gapTimer.current);
    if (wrongTimer.current) clearTimeout(wrongTimer.current);
    if (replayTimer.current) clearTimeout(replayTimer.current);
    setActiveNote(null);
    wrongPickRef.current = null;
    setWrongPick(null);
    setCorrectPick(null);
    setDisplayRound(r);
    setPhase("listenA");

    const startMelody = () => {
      if (roundEpochRef.current !== epoch) return;
      playSequence(
        r.phraseA,
        120,
        (idx) => {
          if (roundEpochRef.current === epoch) setActiveNote(idx);
        },
        () => {
          if (roundEpochRef.current !== epoch) return;
          setActiveNote(null);
          setPhase("listenB");
          gapTimer.current = setTimeout(() => {
            if (roundEpochRef.current !== epoch) return;
            playSequence(
              r.phraseB,
              120,
              (idx) => {
                if (roundEpochRef.current === epoch) setActiveNote(idx);
              },
              () => {
                if (roundEpochRef.current !== epoch) return;
                setActiveNote(null);
                setPhase("pick");
              },
            );
          }, 600);
        },
      );
    };

    if (isMuted()) {
      startMelody();
    } else {
      sayThen([t(langRef.current, "music.listen")], startMelody, 3000);
    }
  }, []);

  useEffect(() => {
    if (won) return;
    if (phase === "pick") {
      saySequence([
        t(lang, "shell.samediff.sub"),
        t(lang, "music.same"),
        t(lang, "music.different"),
      ]);
    }
  }, [phase, won, lang]);

  useEffect(() => {
    if (phase === "pick") {
      lockedRef.current = false;
    }
  }, [phase]);

  useEffect(() => {
    if (!won) {
      const delay = phase === "transition" ? 1000 : 400;
      const timer = setTimeout(() => playRound(round), delay);
      return () => {
        clearTimeout(timer);
        if (gapTimer.current) clearTimeout(gapTimer.current);
        if (wrongTimer.current) clearTimeout(wrongTimer.current);
        stopSequence();
      };
    }
  }, [round, won, playRound]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (picked: "same" | "different") => {
    if (won || phase !== "pick" || lockedRef.current) return;
    if (wrongPickRef.current === picked) return;
    stopNarration();
    if (isCorrect(round, picked)) {
      lockedRef.current = true;
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongPickRef.current = null;
      setPhase("transition");
      sfx.good();
      setCorrectPick(picked);
      setSparkKeys((keys) => ({ ...keys, [picked]: keys[picked] + 1 }));
      const nextScore = nextScoreValue(score, firstTryRef.current);
      setScore(nextScore);
      setWrongPick(null);
      const nextRoundIndex = roundIndex + 1;
      setRoundIndex(nextRoundIndex);
      if (nextRoundIndex < total) {
        firstTryRef.current = true;
        const nextRound = makeSameDiffRound(rngRef.current, difficulty, [
          ...historyRef.current,
        ]);
        historyRef.current.push(nextRound.phraseIdx);
        setRound(nextRound);
      }
    } else {
      sfx.wrong();
      firstTryRef.current = false;
      wrongPickRef.current = picked;
      setWrongPick(picked);
      setCorrectPick(round.answer);
      saySequence(getInstructionalFeedback(round, lang));
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => {
        wrongPickRef.current = null;
        setWrongPick(null);
        setCorrectPick(null);
      }, 500);
    }
  };

  const replay = () => {
    if (phase === "pick" && !lockedRef.current) {
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongPickRef.current = null;
      setWrongPick(null);
      setCorrectPick(null);
      stopNarration();
      stopSequence();
      lockedRef.current = true;
      playRound(round);
    }
  };

  const reset = () => {
    roundEpochRef.current++;
    stopNarration();
    stopSequence();
    if (wrongTimer.current) clearTimeout(wrongTimer.current);
    if (replayTimer.current) clearTimeout(replayTimer.current);
    if (gapTimer.current) clearTimeout(gapTimer.current);
    lockedRef.current = false;
    firstTryRef.current = true;
    setPhase("listenA");
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    setScore(0);
    setRoundIndex(0);
    wrongPickRef.current = null;
    setWrongPick(null);
    setCorrectPick(null);
    setSparkKeys({ same: 0, different: 0 });
    setActiveNote(null);
    const firstRound = makeSameDiffRound(rngRef.current, difficulty);
    historyRef.current = [firstRound.phraseIdx];
    setRound(firstRound);
    setDisplayRound(firstRound);
  };

  const earPulse = useRef(new Animated.Value(1)).current;
  const pickGlow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase !== "pick") {
      pickGlow.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(earPulse, {
            toValue: 1.18,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(earPulse, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      earPulse.stopAnimation();
      earPulse.setValue(1);
      Animated.loop(
        Animated.sequence([
          Animated.timing(pickGlow, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pickGlow, {
            toValue: 0,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
    return () => {
      earPulse.stopAnimation();
      pickGlow.stopAnimation();
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickScale = pickGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });
  const ratiosA = phrasePitchRatios(displayRound, displayRound.phraseA);
  const ratiosB = phrasePitchRatios(displayRound, displayRound.phraseB);

  return (
    <GameShell
      title={t(lang, "shell.samediff.title")}
      subtitle={t(lang, "shell.samediff.sub")}
      onBack={onHome}
      lang={lang}
      right={
        <ScoreChip label={`🎧 ${score}/${total}`} testID="samediff-score" />
      }
    >
      <View
        testID="samediff-board"
        style={[styles.board, isLandscape && styles.boardLandscape]}
      >
        <View
          testID="samediff-listen-card"
          style={[
            styles.listenCard,
            shadows.soft,
            isLandscape && styles.listenCardLandscape,
          ]}
        >
          <Animated.Text
            style={[
              styles.listenEmoji,
              isLandscape && styles.listenEmojiLandscape,
              { transform: [{ scale: earPulse }] },
            ]}
          >
            👂
          </Animated.Text>
          <View
            style={[
              styles.melodyRows,
              isLandscape && styles.melodyRowsLandscape,
            ]}
          >
            <View style={styles.melodyRow} testID="melody-row-0">
              <View
                testID="melody-dot-0"
                style={[
                  styles.melodyDot,
                  styles.melodyDotFilled,
                ]}
              />
              <View testID="melody-notes-0" style={styles.phraseNotesTrack}>
                {ratiosA.map((ratio, i) => {
                  const isNoteActive =
                    phase === "listenA" && activeNote === i;
                  const stemHeight = Math.max(2, Math.round(6 + ratio * 56));
                  return (
                    <View
                      key={i}
                      testID={`melody-0-note-${i}`}
                      aria-selected={isNoteActive}
                      style={styles.noteCueCol}
                    >
                      <View
                        testID={`melody-0-dot-${i}${isNoteActive ? "-active" : ""}`}
                        style={[
                          styles.noteDot,
                          isNoteActive && styles.noteDotActive,
                        ]}
                      />
                      <View
                        testID={`melody-0-stem-${i}`}
                        style={[
                          styles.noteStem,
                          { height: stemHeight },
                          isNoteActive && styles.noteStemActive,
                        ]}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
            <View style={styles.melodyRow} testID="melody-row-1">
              <View
                testID="melody-dot-1"
                style={[
                  styles.melodyDot,
                  phase !== "listenA" && styles.melodyDotFilled,
                ]}
              />
              <View testID="melody-notes-1" style={styles.phraseNotesTrack}>
                {phase !== "listenA"
                  ? ratiosB.map((ratio, i) => {
                      const isNoteActive =
                        phase === "listenB" && activeNote === i;
                      const stemHeight = Math.max(2, Math.round(6 + ratio * 56));
                      return (
                        <View
                          key={i}
                          testID={`melody-1-note-${i}`}
                          aria-selected={isNoteActive}
                          style={styles.noteCueCol}
                        >
                          <View
                            testID={`melody-1-dot-${i}${isNoteActive ? "-active" : ""}`}
                            style={[
                              styles.noteDot,
                              isNoteActive && styles.noteDotActive,
                            ]}
                          />
                          <View
                            testID={`melody-1-stem-${i}`}
                            style={[
                              styles.noteStem,
                              { height: stemHeight },
                              isNoteActive && styles.noteStemActive,
                            ]}
                          />
                        </View>
                      );
                    })
                  : [0, 1, 2].map((i) => (
                      <View
                        key={i}
                        testID={`melody-1-placeholder-${i}`}
                        style={styles.noteCueCol}
                      >
                        <View style={styles.notePlaceholder} />
                      </View>
                    ))}
              </View>
            </View>
          </View>
        </View>
        {(phase === "pick" || phase === "transition") && (
          <View
            testID="samediff-pick-container"
            style={[
              styles.pickContainer,
              isLandscape && styles.pickContainerLandscape,
            ]}
          >
            <Pressable
              onPress={replay}
              testID="samediff-replay"
              accessibilityRole="button"
              accessibilityLabel={t(lang, "spell.hearAgain")}
              style={({ pressed }) => [
                styles.replayBtn,
                shadows.soft,
                isLandscape && styles.replayBtnLandscape,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.replayText,
                  isLandscape && styles.replayTextLandscape,
                ]}
              >
                🔊
              </Text>
            </Pressable>
            <View
              style={[
                styles.pickRow,
                isLandscape && styles.pickRowLandscape,
              ]}
            >
              <Animated.View
                style={[
                  { transform: [{ scale: pickScale }] },
                  styles.pickBtnWrapper,
                  isLandscape && styles.pickBtnWrapperLandscape,
                ]}
              >
                <Pressable
                  onPress={() => onPick("same")}
                  testID="samediff-same"
                  accessibilityRole="button"
                  accessibilityLabel={t(lang, "music.same")}
                  aria-selected={correctPick === "same"}
                  style={({ pressed }) => [
                    styles.pickBtn,
                    isLandscape && styles.pickBtnLandscape,
                    {
                      backgroundColor:
                        wrongPick === "same"
                          ? "rgba(232,86,79,0.12)"
                          : correctPick === "same"
                            ? "rgba(95,191,110,0.30)"
                            : "#E8F5E9",
                      borderColor:
                        wrongPick === "same"
                          ? colors.red
                          : correctPick === "same"
                            ? colors.green
                            : "#5FBF6E",
                      borderWidth: correctPick === "same" ? 6 : 4,
                    },
                    shadows.glowGold,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.pickEmoji,
                      isLandscape && styles.pickEmojiLandscape,
                    ]}
                  >
                    👯
                  </Text>
                  <Text
                    style={[
                      styles.pickLabel,
                      isLandscape && styles.pickLabelLandscape,
                      { color: "#5FBF6E" },
                    ]}
                  >
                    {t(lang, "music.same")}
                  </Text>
                  {phase === "transition" &&
                  correctPick === "same" &&
                  sparkKeys.same > 0 ? (
                    <SparkleBurst
                      trigger={sparkKeys.same}
                      count={5}
                      size={14}
                    />
                  ) : null}
                </Pressable>
              </Animated.View>
              <Animated.View
                style={[
                  { transform: [{ scale: pickScale }] },
                  styles.pickBtnWrapper,
                  isLandscape && styles.pickBtnWrapperLandscape,
                ]}
              >
                <Pressable
                  onPress={() => onPick("different")}
                  testID="samediff-diff"
                  accessibilityRole="button"
                  accessibilityLabel={t(lang, "music.different")}
                  aria-selected={correctPick === "different"}
                  style={({ pressed }) => [
                    styles.pickBtn,
                    isLandscape && styles.pickBtnLandscape,
                    {
                      backgroundColor:
                        wrongPick === "different"
                          ? "rgba(232,86,79,0.12)"
                          : correctPick === "different"
                            ? "rgba(95,191,110,0.30)"
                            : "#FEF3E8",
                      borderColor:
                        wrongPick === "different"
                          ? colors.red
                          : correctPick === "different"
                            ? colors.green
                            : "#E89B4F",
                      borderWidth: correctPick === "different" ? 6 : 4,
                    },
                    shadows.glowGold,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.pickEmoji,
                      isLandscape && styles.pickEmojiLandscape,
                    ]}
                  >
                    🔀
                  </Text>
                  <Text
                    style={[
                      styles.pickLabel,
                      isLandscape && styles.pickLabelLandscape,
                      { color: "#E89B4F" },
                    ]}
                  >
                    {t(lang, "music.different")}
                  </Text>
                  {phase === "transition" &&
                  correctPick === "different" &&
                  sparkKeys.different > 0 ? (
                    <SparkleBurst
                      trigger={sparkKeys.different}
                      count={5}
                      size={14}
                    />
                  ) : null}
                </Pressable>
              </Animated.View>
            </View>
          </View>
        )}
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, "win.samediff")}
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
    paddingHorizontal: 16,
  },
  listenCard: {
    backgroundColor: "#F7EDDA",
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.gold,
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: "center",
    gap: 12,
  },
  listenEmoji: { fontSize: 56 },
  melodyRows: { flexDirection: "column", gap: 10, alignItems: "center" },
  melodyRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  melodyDotRow: { flexDirection: "row", gap: 12 },
  melodyDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: "transparent",
  },
  melodyDotFilled: { backgroundColor: colors.gold },
  phraseNotesTrack: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 80,
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E8DBC5",
  },
  noteCueCol: {
    width: 26,
    height: 76,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  noteDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  noteDotActive: {
    backgroundColor: colors.green,
    borderColor: colors.ink,
    transform: [{ scale: 1.25 }],
  },
  noteStem: {
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.inkSoft,
  },
  noteStemActive: {
    backgroundColor: colors.green,
    width: 5,
  },
  notePlaceholder: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#CBBFA8",
    borderStyle: "dashed",
    marginBottom: 12,
  },
  pickContainer: {
    alignItems: "center",
    gap: 16,
    width: "100%",
    maxWidth: 360,
  },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    width: "100%",
  },
  pickBtnWrapper: {
    flex: 1,
    maxWidth: 160,
  },
  pickBtn: {
    width: "100%",
    borderRadius: 28,
    borderWidth: 4,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 8,
    ...shadows.soft,
  },
  pickEmoji: { fontSize: 56 },
  pickLabel: { fontFamily: fonts.display, fontSize: 22 },
  wrong: { borderColor: colors.red, backgroundColor: "rgba(232,86,79,0.12)" },
  correct: {
    borderColor: colors.green,
    borderWidth: 6,
    backgroundColor: "rgba(95,191,110,0.30)",
  },
  pressed: { transform: [{ scale: 0.94 }] },
  replayBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  replayText: { fontSize: 36 },
  boardLandscape: {
    flexDirection: "row",
    gap: 20,
  },
  listenCardLandscape: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    gap: 6,
    borderRadius: 20,
  },
  listenEmojiLandscape: {
    fontSize: 32,
  },
  melodyRowsLandscape: {
    gap: 6,
  },
  pickContainerLandscape: {
    gap: 8,
    maxWidth: 320,
  },
  replayBtnLandscape: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  replayTextLandscape: {
    fontSize: 26,
  },
  pickRowLandscape: {
    gap: 12,
  },
  pickBtnWrapperLandscape: {
    maxWidth: 140,
  },
  pickBtnLandscape: {
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  pickEmojiLandscape: {
    fontSize: 36,
  },
  pickLabelLandscape: {
    fontSize: 18,
  },
});
