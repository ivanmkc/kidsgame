import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SCENE_IMAGES } from "../../assets/images";
import { GameShell, ScoreChip } from "../../components/GameShell";
import { TimerRing, useElapsed } from "../../components/TimerRing";
import { FilterCycleChip, ScenePicker } from "../../components/ScenePicker";
import { allSceneOptions } from "../sceneOptions";
import { useWinLine } from "../winlines";
import { WinOverlay } from "../../components/WinOverlay";
import {
  Difficulty,
  DifficultyFilter,
  settingsFor,
  nextFilter,
  nextSceneId,
} from "../../difficulty";
import { Lang } from "../../lang";
import { t } from "../../i18n";
import { manifest } from "../../manifest";
import { makeRng } from "../../rng";
import { colors, fonts, shadows } from "../../theme";
import { sfx, useSay } from "../../sound";
import { SparkleBurst } from "../../components/Sparkles";
import { isSolved, makePuzzle, swap } from "./logic";

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  filter?: DifficultyFilter;
  onFilter?: (f: DifficultyFilter) => void;
  sceneId?: string;
  onPickScene: (id: string) => void;
  onBackToPicker: () => void;
  lang?: Lang;
}

export function PuzzleGame({
  onHome,
  difficulty,
  filter = "all",
  onFilter,
  sceneId,
  onPickScene,
  onBackToPicker,
  lang = "en",
}: Props) {
  const options = allSceneOptions(filter, lang);
  const allOptions = allSceneOptions("all", lang).map((o) => ({
    ...o,
    dimmed: !options.some((v) => v.id === o.id),
  }));
  const picked = allOptions.find((o) => o.id === sceneId) ?? null;
  // With the 🎨 All filter, play each scene at ITS OWN badge difficulty —
  // flattening to medium hid the easy-mode hint/no-timer design entirely.
  const effDifficulty =
    filter === "all" && picked?.level ? picked.level : difficulty;
  const settings = settingsFor(effDifficulty);
  const cols = settings.puzzleCols;
  const rows = settings.puzzleRows;
  const size = cols * rows;

  const [perm, setPerm] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const selectedRef = useRef<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [sparkles, setSparkles] = useState<Record<number, number>>({});
  // Peek: flash the finished picture over the board for a few seconds
  const [peek, setPeek] = useState(false);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showPeek = () => {
    sfx.tap();
    setPeek(true);
    if (peekTimer.current) clearTimeout(peekTimer.current);
    peekTimer.current = setTimeout(() => setPeek(false), 2500);
  };

  useEffect(() => {
    if (picked) {
      setPerm(
        makePuzzle(makeRng(Math.floor(Math.random() * 1e9)), cols * rows),
      );
      setSelected(null);
      selectedRef.current = null;
      setMoves(0);
      setPeek(false);
      setSparkles({});
    }
    return () => {
      if (peekTimer.current) clearTimeout(peekTimer.current);
    };
  }, [sceneId, cols, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const won = perm.length === size && isSolved(perm);
  useSay(
    won ? null : picked ? t(lang, "puzzle.hint") : t(lang, "picker.puzzle"),
  );
  const showTimer = settings.timer;
  const elapsed = useElapsed(showTimer && !won && !!picked, sceneId);

  useWinLine(won, t(lang, "win.puzzle"));
  const { width, height } = useWindowDimensions();

  if (!picked) {
    return (
      <GameShell
        title={t(lang, "shell.puzzle.title")}
        subtitle={t(lang, "shell.puzzle.subPicker")}
        onBack={onHome}
        lang={lang}
      >
        <ScenePicker
          title={t(lang, "picker.puzzle")}
          lang={lang}
          options={allOptions}
          onPick={onPickScene}
          onSurprise={() => {
            const surprisePool = options.length > 0 ? options : allOptions;
            onPickScene(
              surprisePool[Math.floor(Math.random() * surprisePool.length)].id,
            );
          }}
          filterChip={
            onFilter ? (
              <FilterCycleChip
                filter={filter}
                onCycle={() => onFilter(nextFilter(filter))}
                lang={lang}
              />
            ) : undefined
          }
        />
      </GameShell>
    );
  }

  // scene AR comes from the manifest (all scenes share W/H, but read it anyway)
  const srcScene =
    manifest.diff.find((d) => `d-${d.id}` === picked.id) ??
    manifest.hidden.find((h) => `h-${h.id}` === picked.id);
  const ar = srcScene ? srcScene.w / srcScene.h : 16 / 9;

  const availH = Math.max(10, height - 150);
  const boardW = Math.max(10, Math.min(width - 28, availH * ar, 1000));
  const boardH = boardW / ar;
  const tileW = boardW / cols;
  const tileH = boardH / rows;

  const onTile = (pos: number) => {
    if (won || perm.length === 0) return;
    const current = selectedRef.current;
    if (current === null) {
      sfx.tap();
      selectedRef.current = pos;
      setSelected(pos);
    } else if (current === pos) {
      sfx.tap();
      selectedRef.current = null;
      setSelected(null);
    } else {
      const next = swap(perm, current, pos);
      const posCorrect = next[pos] === pos;
      const currentCorrect = next[current] === current;
      if (posCorrect || currentCorrect) {
        sfx.good();
      } else {
        sfx.flip();
      }
      setSparkles((prev) => {
        const nextSparkles = { ...prev };
        if (posCorrect) {
          nextSparkles[pos] = (prev[pos] ?? 0) + 1;
        } else {
          delete nextSparkles[pos];
        }
        if (currentCorrect) {
          nextSparkles[current] = (prev[current] ?? 0) + 1;
        } else {
          delete nextSparkles[current];
        }
        return nextSparkles;
      });
      setPerm((p) => swap(p, current, pos));
      selectedRef.current = null;
      setSelected(null);
      setMoves((m) => m + 1);
    }
  };

  return (
    <GameShell
      title={t(lang, "shell.puzzle.title")}
      subtitle={t(lang, "shell.puzzle.subPlay", { name: picked.name })}
      onBack={onBackToPicker}
      backKind="picker"
      lang={lang}
      right={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {showTimer ? (
            <TimerRing
              elapsed={elapsed}
              size={44}
              stroke={5}
              showLabel
              testID="puzzle-timer"
            />
          ) : null}
          <ScoreChip label={`🧩 ${moves}`} testID="puzzle-moves" />
          <Pressable
            onPress={showPeek}
            testID="puzzle-peek"
            accessibilityLabel={t(lang, "puzzle.peekA11y")}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.peekBtn,
              shadows.soft,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.peekText}>{t(lang, "puzzle.peek")}</Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.center}>
        <View
          style={[
            styles.board,
            shadows.sticker,
            { width: boardW, height: boardH },
          ]}
        >
          {perm.map((piece, pos) => {
            const col = pos % cols;
            const row = Math.floor(pos / cols);
            const pCol = piece % cols;
            const pRow = Math.floor(piece / cols);
            return (
              <Pressable
                key={pos}
                testID={`puzzle-tile-${pos}-piece-${piece}`}
                accessibilityRole="button"
                accessibilityLabel={t(lang, "puzzle.tileA11y", {
                  row: row + 1,
                  col: col + 1,
                })}
                onPress={() => onTile(pos)}
                style={[
                  styles.tile,
                  {
                    left: col * tileW,
                    top: row * tileH,
                    width: tileW,
                    height: tileH,
                  },
                  selected === pos && styles.selected,
                ]}
              >
                <Image
                  source={SCENE_IMAGES[picked.image]}
                  style={{
                    width: boardW,
                    height: boardH,
                    marginLeft: -pCol * tileW,
                    marginTop: -pRow * tileH,
                  }}
                />
                {sparkles[pos] ? (
                  <SparkleBurst trigger={sparkles[pos]} />
                ) : null}
              </Pressable>
            );
          })}
          {peek ? (
            <Image
              source={SCENE_IMAGES[picked.image]}
              style={[
                StyleSheet.absoluteFill as object,
                { width: boardW, height: boardH },
              ]}
              testID="puzzle-peek-overlay"
            />
          ) : null}
        </View>
        <Text style={styles.hint}>{t(lang, "puzzle.hint")}</Text>
      </View>
      <WinOverlay
        visible={won}
        message={t(lang, "win.puzzle")}
        onNext={() => onPickScene(nextSceneId(allOptions, options, picked.id))}
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  peekBtn: {
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  peekText: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  board: { borderRadius: 18, overflow: "hidden", backgroundColor: colors.card },
  tile: {
    position: "absolute",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  selected: { borderWidth: 4, borderColor: colors.gold, zIndex: 2 },
  hint: {
    fontFamily: fonts.bodyReg,
    color: colors.inkSoft,
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
});
