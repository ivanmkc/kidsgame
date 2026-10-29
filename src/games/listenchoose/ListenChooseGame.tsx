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
  useWindowDimensions,
} from "react-native";
import { SPOTIT_ICONS, RHYME_SPRITES } from "../../assets/images";
import { GameShell, ScoreChip } from "../../components/GameShell";
import { SparkleBurst } from "../../components/Sparkles";
import { WinOverlay } from "../../components/WinOverlay";
import { Difficulty } from "../../difficulty";
import { Lang, useLangEpoch } from "../../lang";
import { t } from "../../i18n";
import { makeRng } from "../../rng";
import { sayThen, sfx, stopNarration, useSay } from "../../sound";
import { colors, fonts, shadows } from "../../theme";
import { Word } from "./data";
import {
  GameState,
  ListenChooseLayout,
  getWordText,
  initGameState,
  listenChooseLayout,
  updateGameState,
  ROUNDS_TO_WIN,
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
  const { epoch, isValid } = useLangEpoch(lang);
  const [started, setStarted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakEpochRef = useRef(0);
  const [captions, setCaptions] = useState(false);
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const [state, setGameState] = useState<GameState>(() =>
    initGameState(rngRef.current, difficulty, lang),
  );
  const [wobbleIcon, setWobbleIcon] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const celebrateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wobbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongPickRef = useRef<string | null>(null);
  const lockedRef = useRef(false);

  const clearWrongTimer = () => {
    if (wobbleTimerRef.current) {
      clearTimeout(wobbleTimerRef.current);
      wobbleTimerRef.current = null;
    }
    wrongPickRef.current = null;
    setWobbleIcon(null);
  };

  const { width, height } = useWindowDimensions();
  const layout = listenChooseLayout(
    width,
    height,
    state.currentRound.choices.length,
  );

  useSay(!started ? t(lang, "card.listenchoose.blurb") : null);

  useWinLine(state.won, t(lang, "win.soundsWords"));

  useEffect(() => {
    return () => {
      stopNarration();
      if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
      if (wobbleTimerRef.current) clearTimeout(wobbleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (epoch === 0) return;
    if (celebrateTimerRef.current) {
      clearTimeout(celebrateTimerRef.current);
      celebrateTimerRef.current = null;
    }
    clearWrongTimer();
    lockedRef.current = false;
    setCelebrate(false);
    setStarted(false);
    setIsSpeaking(false);
    setGameState(initGameState(rngRef.current, difficulty, lang));
  }, [epoch]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPlay = () => {
    if (!isValid()) return;
    lockedRef.current = false;
    clearWrongTimer();
    setStarted(true);
    const targetWord = getWordText(state.currentRound.target, lang);
    const currentSpeakEpoch = ++speakEpochRef.current;
    setIsSpeaking(true);
    sayThen([targetWord], () => {
      if (!isValid()) return;
      if (speakEpochRef.current === currentSpeakEpoch) setIsSpeaking(false);
    });
  };

  const onReplay = () => {
    if (!isValid()) return;
    clearWrongTimer();
    const targetWord = getWordText(state.currentRound.target, lang);
    const currentSpeakEpoch = ++speakEpochRef.current;
    setIsSpeaking(true);
    sayThen([targetWord], () => {
      if (!isValid()) return;
      if (speakEpochRef.current === currentSpeakEpoch) setIsSpeaking(false);
    });
  };

  const handleHome = () => {
    lockedRef.current = false;
    clearWrongTimer();
    onHome();
  };

  const onPick = (choice: Word) => {
    if (lockedRef.current || !isValid() || wrongPickRef.current === choice.icon) return;
    const isCorrect = choice.icon === state.currentRound.target.icon;
    if (isCorrect) {
      lockedRef.current = true;
      clearWrongTimer();
      sfx.good();
      setCelebrate(true);
      if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
      celebrateTimerRef.current = setTimeout(() => {
        if (!isValid()) return;
        lockedRef.current = false;
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
          if (!isValid()) return;
          const nextWord = getWordText(next.currentRound.target, lang);
          const currentSpeakEpoch = ++speakEpochRef.current;
          setIsSpeaking(true);
          sayThen([nextWord], () => {
            if (!isValid()) return;
            if (speakEpochRef.current === currentSpeakEpoch) setIsSpeaking(false);
          });
        }
      }, 800);
    } else {
      sfx.wrong();
      wrongPickRef.current = choice.icon;
      setWobbleIcon(choice.icon);
      if (wobbleTimerRef.current) clearTimeout(wobbleTimerRef.current);
      wobbleTimerRef.current = setTimeout(() => {
        if (!isValid()) return;
        wrongPickRef.current = null;
        setWobbleIcon((w) => (w === choice.icon ? null : w));
        wobbleTimerRef.current = null;
      }, 450);
      const next = updateGameState(
        state,
        choice.icon,
        rngRef.current,
        difficulty,
        lang,
      );
      setGameState(next);
      if (!isValid()) return;
      const targetWord = getWordText(state.currentRound.target, lang);
      const currentSpeakEpoch = ++speakEpochRef.current;
      setIsSpeaking(true);
      sayThen([targetWord], () => {
        if (!isValid()) return;
        if (speakEpochRef.current === currentSpeakEpoch) setIsSpeaking(false);
      });
    }
  };

  return (
    <GameShell
      title={t(lang, "shell.listenchoose.title")}
      subtitle={t(lang, "shell.listenchoose.sub")}
      onBack={handleHome}
      lang={lang}
      right={
        <ScoreChip
          label={`⭐ ${state.streak} / ${ROUNDS_TO_WIN}`}
          testID="listenchoose-streak"
        />
      }
    >
      <ScrollView
        testID="listenchoose-scrollview"
        style={{ flex: 1 }}
        contentContainerStyle={layout.shortH ? styles.boardShort : styles.board}
      >
        {!started ? (
          <View
            style={[
              styles.startScreen,
              layout.shortH && styles.startScreenShort,
            ]}
          >
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
            <View
              style={[
                styles.speakerArea,
                layout.shortH && styles.speakerAreaShort,
              ]}
            >
              <Pressable
                onPress={onReplay}
                testID="speaker-button"
                accessibilityRole="button"
                accessibilityLabel={t(lang, "spell.hearAgain")}
                style={({ pressed }) => [
                  styles.speakerButton,
                  layout.shortH && styles.speakerButtonShort,
                  {
                    width: layout.speakerSize,
                    height: layout.speakerSize,
                    borderRadius: layout.speakerSize / 2,
                  },
                  shadows.soft,
                  (pressed || isSpeaking) && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.speakerIcon,
                    layout.shortH && styles.speakerIconShort,
                  ]}
                >
                  🔊
                </Text>
              </Pressable>
              {captions && (
                <Text
                  style={[styles.caption, layout.shortH && styles.captionShort]}
                  testID="listenchoose-caption"
                >
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
                  layout.shortH && styles.captionsToggleMiniShort,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.captionsToggleMiniText,
                    layout.shortH && styles.captionsToggleMiniTextShort,
                  ]}
                >
                  💬 {t(lang, "listenchoose.captions")}:{" "}
                  {t(lang, captions ? "listenchoose.on" : "listenchoose.off")}
                </Text>
              </Pressable>
            </View>
            <View style={[styles.choicesContainer, { gap: layout.gap }]}>
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
                  layout={layout}
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
          if (!isValid()) return;
          lockedRef.current = false;
          const next = initGameState(rngRef.current, difficulty, lang);
          setGameState(next);
          if (!isValid()) return;
          const currentSpeakEpoch = ++speakEpochRef.current;
          setIsSpeaking(true);
          sayThen([getWordText(next.currentRound.target, lang)], () => {
            if (!isValid()) return;
            if (speakEpochRef.current === currentSpeakEpoch) setIsSpeaking(false);
          });
        }}
        onHome={handleHome}
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
  layout = listenChooseLayout(0, 800),
}: {
  choice: Word;
  index: number;
  lang: Lang;
  highlight: boolean;
  wobble: boolean;
  onPress: () => void;
  layout?: ListenChooseLayout;
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
          layout.shortH && styles.choiceCardShort,
          { width: layout.cardWidth, height: layout.cardHeight },
          shadows.soft,
          highlight && styles.highlightChoice,
          wobble && styles.wrongChoice,
          pressed && styles.pressed,
        ]}
      >
        <Image
          source={wordImage(choice.icon)}
          style={[
            styles.choiceImage,
            { width: layout.cardImageSize, height: layout.cardImageSize },
          ]}
          resizeMode="contain"
        />
        <Text
          style={[styles.choiceLabel, layout.shortH && styles.choiceLabelShort]}
        >
          {label}
        </Text>
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
  boardShort: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  startScreen: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    maxWidth: 420,
    padding: 24,
  },
  startScreenShort: {
    gap: 10,
    padding: 12,
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
  captionsToggleMiniShort: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginTop: 0,
  },
  captionsToggleMiniText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  captionsToggleMiniTextShort: {
    fontSize: 11,
  },
  speakerArea: {
    alignItems: "center",
    gap: 8,
  },
  speakerAreaShort: {
    gap: 4,
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
  speakerButtonShort: {
    borderWidth: 2.5,
  },
  speakerIcon: {
    fontSize: 42,
  },
  speakerIconShort: {
    fontSize: 26,
  },
  caption: {
    fontFamily: fonts.displayMed,
    fontSize: 18,
    color: colors.inkSoft,
  },
  captionShort: {
    fontSize: 15,
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
    borderWidth: 4,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 8,
  },
  choiceCardShort: {
    borderRadius: 18,
    padding: 8,
    gap: 4,
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
  choiceLabelShort: {
    fontSize: 15,
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
