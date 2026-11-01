import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SHAPE_ICONS, SPOTIT_ICONS, RHYME_SPRITES } from "../../assets/images";
import { GameShell, ScoreChip } from "../../components/GameShell";
import { FlipCard, MemoryBoard } from "../../components/MemoryBoard";
import { WinOverlay } from "../../components/WinOverlay";
import { useMemoryLogic } from "../../components/useMemoryLogic";
import { t, UIKey } from "../../i18n";
import { Lang } from "../../lang";
import { makeRng } from "../../rng";
import { say, sfx, useSay } from "../../sound";
import { colors, fonts } from "../../theme";
import { Difficulty } from "../../difficulty";
import {
  ConceptMatchCard,
  ConceptMatchDeck,
  DECK_TO_CARD_KEY,
  buildBoard,
  hasCaptionableCards,
  isMatch,
  pairsForDifficulty,
  updateBoardLang,
} from "./logic";

export interface ConceptMatchGameProps {
  deck?: ConceptMatchDeck;
  onHome?: () => void;
  lang?: Lang;
  pairs?: number;
  difficulty?: Difficulty;
}

export function ConceptMatchGame({
  deck = "letters",
  onHome,
  lang = "en",
  pairs,
  difficulty = "medium",
}: ConceptMatchGameProps) {
  const activePairs = pairs ?? pairsForDifficulty(difficulty, deck);
  const cardKey = (deck && DECK_TO_CARD_KEY[deck]) ?? "memory";
  const groupSimilar = difficulty !== "easy";

  const [captions, setCaptions] = useState(false);
  const [roundKey, setRoundKey] = useState(0);
  const [board, setBoard] = useState<ConceptMatchCard[]>(() =>
    buildBoard(
      makeRng(Math.floor(Math.random() * 1e9)),
      deck,
      lang,
      activePairs,
      undefined,
      groupSimilar,
    ),
  );

  const { faceUp, matched, moves, lockRef, onFlip, reset, won, matchedPairs } =
    useMemoryLogic({
      board,
      isMatch,
      onMatch: () => {
        sfx.good();
      },
    });

  useSay(won ? null : t(lang, `card.${cardKey}.blurb` as UIKey));

  const prevDeck = useRef(deck);
  const prevPairs = useRef(activePairs);
  const prevLang = useRef(lang);
  const prevDifficulty = useRef(difficulty);

  useEffect(() => {
    const deckChanged = prevDeck.current !== deck;
    const pairsChanged = prevPairs.current !== activePairs;
    const langChanged = prevLang.current !== lang;
    const difficultyChanged = prevDifficulty.current !== difficulty;

    prevDeck.current = deck;
    prevPairs.current = activePairs;
    prevLang.current = lang;
    prevDifficulty.current = difficulty;

    if (deckChanged || pairsChanged || difficultyChanged) {
      setBoard(
        buildBoard(
          makeRng(Math.floor(Math.random() * 1e9)),
          deck,
          lang,
          activePairs,
          undefined,
          groupSimilar,
        ),
      );
      reset();
      return;
    }

    if (langChanged) {
      const newBoard = updateBoardLang(board, deck, lang);
      if (newBoard) {
        setBoard(newBoard);
      } else {
        setBoard(
          buildBoard(
            makeRng(Math.floor(Math.random() * 1e9)),
            deck,
            lang,
            activePairs,
            undefined,
            groupSimilar,
          ),
        );
        reset();
      }
    }
  }, [deck, lang, activePairs, difficulty, groupSimilar, reset, board]);

  useEffect(() => {
    if (won) {
      say(t(lang, "win.memory"));
    }
  }, [won, lang]);

  const resetGame = useCallback(() => {
    setRoundKey((k) => k + 1);
    setBoard(
      buildBoard(
        makeRng(Math.floor(Math.random() * 1e9)),
        deck,
        lang,
        activePairs,
        undefined,
        groupSimilar,
      ),
    );
    reset();
  }, [deck, lang, activePairs, groupSimilar, reset]);

  const handleFlip = useCallback(
    (card: ConceptMatchCard) => {
      if (lockRef.current || won) return;
      if (faceUp.length >= 2) return;
      if (faceUp.includes(card.key) || matched.includes(card.key)) return;
      say(card.speech);
      onFlip(card);
    },
    [faceUp, matched, lockRef, onFlip, won],
  );

  const totalPairs = Math.floor(board.length / 2);

  return (
    <GameShell
      title={t(lang, `card.${cardKey}.title` as UIKey)}
      subtitle={t(lang, "shell.memory.sub", { n: totalPairs })}
      onBack={onHome ?? (() => {})}
      lang={lang}
      right={
        <View style={styles.headerRight}>
          {hasCaptionableCards(board) && (
            <Pressable
              onPress={() => setCaptions((c) => !c)}
              testID="captions-toggle"
              accessibilityRole="button"
              hitSlop={12}
              style={({ pressed }) => [
                styles.captionsToggle,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.captionsToggleText}>
                💬 {t(lang, "listenchoose.captions")}:{" "}
                {t(lang, captions ? "listenchoose.on" : "listenchoose.off")}
              </Text>
            </Pressable>
          )}
          <ScoreChip
            label={`🧠 ${matchedPairs}/${totalPairs}`}
            testID="concept-score"
          />
        </View>
      }
    >
      <View style={styles.boardWrap}>
        <MemoryBoard cardCount={board.length} testID="concept-board">
          {(cardW) =>
            board.map((card) => {
              const isUp =
                faceUp.includes(card.key) || matched.includes(card.key);
              const isMatched = matched.includes(card.key);
              return (
                <FlipCard
                  key={`${roundKey}-${card.key}`}
                  size={cardW}
                  up={isUp}
                  matched={isMatched}
                  onFlip={() => handleFlip(card)}
                  accessibilityLabel={
                    isUp ? card.speech : t(lang, "memory.cardFaceDown")
                  }
                  testID={`concept-card-${card.key}`}
                  sparkleTrigger={card.conceptId}
                  renderCardFace={() => renderCardFace(card, cardW, captions)}
                />
              );
            })
          }
        </MemoryBoard>
        <Text style={styles.moves} testID="concept-moves">
          {t(lang, "memory.moves", { n: moves })}
        </Text>
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, "win.memory")}
        lang={lang}
        onNext={resetGame}
        nextLabel={t(lang, "overlay.nextRound")}
        onHome={onHome ?? (() => {})}
      />
    </GameShell>
  );
}

function renderCardFace(
  card: ConceptMatchCard,
  size: number,
  captions: boolean,
) {
  const { display } = card;
  switch (display.type) {
    case "text":
      return (
        <Text
          testID={`card-text-${card.key}`}
          style={[
            styles.cardText,
            {
              fontSize:
                display.text.length <= 2
                  ? size * 0.42
                  : Math.min(size * 0.22, 24),
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {display.text}
        </Text>
      );
    case "icon": {
      const iconSource =
        SPOTIT_ICONS[display.icon] ??
        (SHAPE_ICONS as Record<string, number>)[display.icon] ??
        RHYME_SPRITES[display.icon];
      if (!iconSource) {
        throw new Error(`Missing icon asset for concept: ${display.icon}`);
      }
      return (
        <Image
          testID={`card-icon-${card.key}`}
          source={iconSource}
          style={styles.cardImage}
          resizeMode="contain"
        />
      );
    }
    case "color":
      return (
        <View
          testID={`card-color-${card.key}`}
          style={[
            styles.colorSwatch,
            {
              backgroundColor: display.color,
              width: size * 0.62,
              height: size * 0.62,
              borderRadius: size * 0.16,
            },
          ]}
        />
      );
    case "audio": {
      const visualText = captions ? card.speech : null;
      return (
        <View testID={`card-audio-${card.key}`} style={styles.audioWrap}>
          <Text style={{ fontSize: size * 0.32 }}>🔊</Text>
          {visualText ? (
            <Text
              testID={`card-audio-text-${card.key}`}
              style={[
                styles.audioText,
                { fontSize: Math.min(size * 0.18, 22) },
              ]}
              numberOfLines={1}
            >
              {visualText}
            </Text>
          ) : null}
        </View>
      );
    }
    case "dots": {
      const dotSize = Math.max(8, Math.min(size * 0.16, 16));
      return (
        <View testID={`card-dots-${card.key}`} style={styles.dotsWrap}>
          {Array.from({ length: display.count }, (_, i) => (
            <View
              key={i}
              testID={`card-dot-${card.key}-${i}`}
              style={[
                styles.dot,
                {
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                },
              ]}
            />
          ))}
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  captionsToggle: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  captionsToggleText: {
    fontFamily: fonts.bodyReg,
    color: colors.ink,
    fontSize: 14,
  },
  boardWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardImage: {
    width: "78%",
    height: "78%",
  },
  cardText: {
    fontFamily: fonts.display,
    color: colors.ink,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  colorSwatch: {
    borderWidth: 2,
    borderColor: "rgba(0, 0, 0, 0.12)",
  },
  audioWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  audioText: {
    fontFamily: fonts.display,
    color: colors.ink,
    textAlign: "center",
  },
  dotsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    width: "80%",
    gap: 6,
  },
  dot: {
    backgroundColor: colors.teal,
  },
  moves: {
    textAlign: "center",
    fontFamily: fonts.bodyReg,
    color: colors.inkSoft,
    fontSize: 15,
    paddingTop: 10,
  },
});
