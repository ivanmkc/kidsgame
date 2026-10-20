import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SPOTIT_ICONS, RHYME_SPRITES } from "../../assets/images";
import { GameShell, ScoreChip } from "../../components/GameShell";
import { SparkleBurst } from "../../components/Sparkles";
import { WinOverlay } from "../../components/WinOverlay";
import { Difficulty } from "../../difficulty";
import { Lang } from "../../lang";
import { t } from "../../i18n";
import { makeRng } from "../../rng";
import { sayThen, sfx } from "../../sound";
import { colors, fonts, shadows } from "../../theme";
import { Word } from "./data";
import {
  GameState,
  getWordText,
  initGameState,
  updateGameState,
} from "./logic";
import { useWinLine } from "../winlines";

interface Props {
  onHome: () => void;
  difficulty?: Difficulty;
  lang?: Lang;
}

function wordImage(icon: string) {
  return SPOTIT_ICONS[icon] ?? RHYME_SPRITES[icon];
}

export function ListenChooseGame({
  onHome,
  difficulty = "easy",
  lang = "en",
}: Props) {
  const [started, setStarted] = useState(false);
  const [captions, setCaptions] = useState(true);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [state, setGameState] = useState<GameState>(() =>
    initGameState(rngRef.current, difficulty, lang),
  );
  const [wobbleIcon, setWobbleIcon] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const celebrateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wobbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useWinLine(state.won, t(lang, "win.soundsWords"));

  useEffect(() => {
    return () => {
      if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
      if (wobbleTimerRef.current) clearTimeout(wobbleTimerRef.current);
    };
  }, []);

  const onPlay = () => {
    setStarted(true);
    const targetWord = getWordText(state.currentRound.target, lang);
    sayThen([targetWord], () => {});
  };

  const onReplay = () => {
    const targetWord = getWordText(state.currentRound.target, lang);
    sayThen([targetWord], () => {});
  };

  const onPick = (choice: Word) => {
    if (celebrate || wobbleIcon === choice.icon) return;
    const isCorrect = choice.icon === state.currentRound.target.icon;
    if (isCorrect) {
      sfx.good();
      setWobbleIcon(null);
      setCelebrate(true);
      if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
      celebrateTimerRef.current = setTimeout(() => {
        setCelebrate(false);
        const next = updateGameState(
          state,
          choice.icon,
          rngRef.current,
          difficulty,
          lang,
        );
        setGameState(next);
        if (!next.won) {
          const nextWord = getWordText(next.currentRound.target, lang);
          sayThen([nextWord], () => {});
        }
      }, 800);
    } else {
      setWobbleIcon(choice.icon);
      if (wobbleTimerRef.current) clearTimeout(wobbleTimerRef.current);
      wobbleTimerRef.current = setTimeout(
        () => setWobbleIcon((w) => (w === choice.icon ? null : w)),
        450,
      );
      const next = updateGameState(
        state,
        choice.icon,
        rngRef.current,
        difficulty,
        lang,
      );
      setGameState(next);
      const targetWord = getWordText(state.currentRound.target, lang);
      sayThen([targetWord], () => {});
    }
  };

  return (
    <GameShell
      title={t(lang, "shell.listenchoose.title")}
      subtitle={t(lang, "shell.listenchoose.sub")}
      onBack={onHome}
      lang={lang}
      right={
        <ScoreChip label={`⭐ ${state.streak}`} testID="listenchoose-streak" />
      }
    >
      <ScrollView testID="listenchoose-scrollview" style={{ flex: 1 }} contentContainerStyle={styles.board}>
        {!started ? (
          <View style={styles.startScreen}>
            <Text style={styles.startTitle}>
              {t(lang, "shell.listenchoose.title")}
            </Text>
            <Text style={styles.startBlurb}>
              {t(lang, "card.listenchoose.blurb")}
            </Text>
            <Pressable
              onPress={onPlay}
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
              hitSlop={12}
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
            {celebrate && (
              <View
                testID="celebration"
                style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
              >
                <SparkleBurst trigger={state.streak} count={8} size={28} />
              </View>
            )}
            <View style={styles.speakerArea}>
              <Pressable
                onPress={onReplay}
                testID="speaker-button"
                accessibilityRole="button"
                accessibilityLabel={t(lang, "spell.hearAgain")}
                style={({ pressed }) => [
                  styles.speakerButton,
                  shadows.soft,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.speakerIcon}>🔊</Text>
              </Pressable>
              {captions && (
                <Text style={styles.caption} testID="listenchoose-caption">
                  {getWordText(state.currentRound.target, lang)}
                </Text>
              )}
              <Pressable
                onPress={() => setCaptions((c) => !c)}
                testID="captions-toggle"
                accessibilityRole="button"
                hitSlop={12}
                style={({ pressed }) => [
                  styles.captionsToggleMini,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.captionsToggleMiniText}>
                  💬 {t(lang, "listenchoose.captions")}:{" "}
                  {t(lang, captions ? "listenchoose.on" : "listenchoose.off")}
                </Text>
              </Pressable>
            </View>
            <View style={styles.choicesContainer}>
              {state.currentRound.choices.map((choice, i) => (
                <ChoiceCard
                  key={`${state.streak}-${choice.icon}`}
                  choice={choice}
                  index={i}
                  lang={lang}
                  highlight={
                    state.highlightCorrect &&
                    choice.icon === state.currentRound.target.icon
                  }
                  wobble={wobbleIcon === choice.icon}
                  onPress={() => onPick(choice)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
      <WinOverlay
        visible={state.won}
        message={t(lang, "win.soundsWords")}
        onNext={() => {
          const next = initGameState(rngRef.current, difficulty, lang);
          setGameState(next);
          sayThen([getWordText(next.currentRound.target, lang)], () => {});
        }}
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

function ChoiceCard({
  choice,
  index,
  lang,
  highlight,
  wobble,
  onPress,
}: {
  choice: Word;
  index: number;
  lang: Lang;
  highlight: boolean;
  wobble: boolean;
  onPress: () => void;
}) {
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!wobble) return;
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, {
        toValue: 1,
        duration: 60,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: -1,
        duration: 80,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 1,
        duration: 80,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 0,
        duration: 60,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  }, [wobble, shake]);

  const rotate = shake.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-9deg", "9deg"],
  });
  const label = getWordText(choice, lang);

  return (
    <Animated.View
      testID={`choice-${index}`}
      style={{ transform: [{ rotate }] }}
    >
      <Pressable
        onPress={onPress}
        testID={`choice-${choice.icon}`}
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ selected: highlight }}
        aria-selected={highlight}
        style={({ pressed }) => [
          styles.choiceCard,
          shadows.soft,
          highlight && styles.highlightChoice,
          wobble && styles.wrongChoice,
          pressed && styles.pressed,
        ]}
      >
        <Image
          source={wordImage(choice.icon)}
          style={styles.choiceImage}
          resizeMode="contain"
        />
        <Text style={styles.choiceLabel}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  board: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 16,
  },
  startScreen: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    maxWidth: 420,
    padding: 24,
  },
  startTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.ink,
    textAlign: "center",
  },
  startBlurb: {
    fontFamily: fonts.bodyReg,
    fontSize: 16,
    color: colors.inkSoft,
    textAlign: "center",
  },
  playButton: {
    backgroundColor: colors.teal,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 36,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 160,
  },
  playButtonText: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: "#FFF",
  },
  captionsToggle: {
    backgroundColor: colors.paper,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.blush,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  captionsToggleText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  captionsToggleMini: {
    backgroundColor: colors.paper,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.blush,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 2,
  },
  captionsToggleMiniText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  speakerArea: {
    alignItems: "center",
    gap: 8,
  },
  speakerButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  speakerIcon: {
    fontSize: 42,
  },
  caption: {
    fontFamily: fonts.displayMed,
    fontSize: 18,
    color: colors.inkSoft,
  },
  choicesContainer: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 20,
  },
  choiceCard: {
    width: 150,
    height: 170,
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.blush,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 8,
  },
  choiceImage: {
    width: 96,
    height: 96,
  },
  choiceLabel: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    textAlign: "center",
  },
  highlightChoice: {
    borderColor: colors.green,
    borderWidth: 4,
    backgroundColor: "#F0FFF4",
  },
  wrongChoice: {
    borderColor: colors.red,
    backgroundColor: "rgba(232,86,79,0.15)",
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
});
