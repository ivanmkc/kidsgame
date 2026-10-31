import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SCENE_IMAGES } from "../../assets/images";
import { GameShell, ScoreChip } from "../../components/GameShell";
import { TimerRing, useElapsed } from "../../components/TimerRing";
import { FilterCycleChip, ScenePicker } from "../../components/ScenePicker";
import { TapScene } from "../../components/TapScene";
import { WinOverlay } from "../../components/WinOverlay";
import {
  Difficulty,
  DifficultyFilter,
  inFilter,
  nextSceneId,
  settingsFor,
  nextFilter,
} from "../../difficulty";
import { Lang, useLangEpoch } from "../../lang";
import { t } from "../../i18n";
import { manifest } from "../../manifest";
import {
  MP_PLAYERS,
  ModePicker,
  PlayerChip,
  PlayerIx,
  nextTurn,
} from "../../multiplayer";
import { makeRng, sample } from "../../rng";
import { sfx, useSay, say, saySequence, stopNarration } from "../../sound";
import { colors, fonts, shadows } from "../../theme";
import { Find, coopDrawCount, countFor } from "./coop";
import { hiddenLayout } from "./logic";

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  filter?: DifficultyFilter;
  onFilter?: (f: DifficultyFilter) => void;
  twoPlayerEnabled?: boolean;
  sceneId?: string;
  onPickScene: (id: string) => void;
  onBackToPicker: () => void;
  lang?: Lang;
}

export function HiddenGame({
  onHome,
  difficulty,
  filter = "all",
  onFilter,
  twoPlayerEnabled,
  sceneId,
  onPickScene,
  onBackToPicker,
  lang = "en",
}: Props) {
  useLangEpoch(lang);
  const visible = manifest.hidden.filter((h) => inFilter(h.level, filter));
  const surprisePool = visible.length > 0 ? visible : manifest.hidden;
  const scene = manifest.hidden.find((h) => h.id === sceneId) ?? null;
  // With the 🎨 All filter, play each scene at ITS OWN badge difficulty —
  // flattening to medium hid the easy-mode hint/no-timer design entirely.
  const effDifficulty =
    filter !== "all" ? filter : (scene?.level ?? difficulty);

  // ALL hooks live above the `if (!scene)` early return (repo hard rule).
  const [mode, setMode] = useState<"solo" | "2p" | null>(
    twoPlayerEnabled ? null : "solo",
  );
  const coop = mode === "2p";
  const [turn, setTurn] = useState<PlayerIx>(0);
  const [finds, setFinds] = useState<Find[]>([]); // solo stamps by:null
  const [hintId, setHintId] = useState<string | null>(null);
  const [prevSceneId, setPrevSceneId] = useState<string | null>(null);
  // Synchronous mirrors: burst multi-touch fires several onPress before any
  // re-render — attribution and turn flow must not read stale state.
  const turnRef = useRef<PlayerIx>(0);
  const findsRef = useRef<Set<string>>(new Set());
  const starterRef = useRef<PlayerIx>(1); // first scene flips this to 0 (Foxy)

  if (sceneId !== (prevSceneId ?? undefined)) {
    setPrevSceneId(sceneId ?? null);
    setFinds([]);
    findsRef.current = new Set();
    setHintId(null);
    if (sceneId) {
      // starting player alternates each scene
      const s = nextTurn(starterRef.current);
      starterRef.current = s;
      turnRef.current = s;
      setTurn(s);
    }
  }

  const settings = settingsFor(effDifficulty);
  const showTimer = mode !== null && settings.timer && !coop;

  const drawn = useMemo(() => {
    if (!scene) return [];
    const base = settings.hiddenDraw;
    const n = coop ? coopDrawCount(base, scene.targets.length) : base;
    return sample(makeRng(Math.floor(Math.random() * 1e9)), scene.targets, n);
  }, [sceneId, coop]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = drawn.length;
  const won = finds.length === total && total > 0;
  const elapsed = useElapsed(showTimer && !!scene && !won, sceneId);

  useEffect(
    () => () => {
      stopNarration();
    },
    [],
  );

  useSay(mode === null || scene ? null : t(lang, "picker.hidden"));

  const sceneEntranceKeyRef = useRef<string | null>(null);
  const announcedTurnRef = useRef<PlayerIx | null>(null);
  useEffect(() => {
    if (mode === null || !scene || won) {
      sceneEntranceKeyRef.current = null;
      announcedTurnRef.current = null;
      return;
    }
    const sceneKey = `${scene.id}:${mode}:${lang}`;
    const prompt = t(lang, "hidden.prompt");
    if (!coop) {
      if (sceneEntranceKeyRef.current !== sceneKey) {
        sceneEntranceKeyRef.current = sceneKey;
        say(prompt);
      }
      return;
    }
    const turnText = t(lang, "hidden.turn", {
      name: t(lang, MP_PLAYERS[turn].name),
    });
    if (sceneEntranceKeyRef.current !== sceneKey) {
      sceneEntranceKeyRef.current = sceneKey;
      announcedTurnRef.current = turn;
      saySequence([prompt, turnText]);
    } else if (announcedTurnRef.current !== turn) {
      announcedTurnRef.current = turn;
      say(turnText);
    }
  }, [mode, scene, coop, turn, won, lang]);
  useEffect(() => {
    if (won) say(t(lang, coop ? "win.hiddenCoop" : "win.hidden"));
  }, [won, coop, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gentle auto-hint: pulse one random unfound target after inactivity delay
  // ~2.5s. Resets on find/turn/scene. Disabled on Hard (hiddenHintSecs: Infinity).
  useEffect(() => {
    if (!scene || won || mode === null || !isFinite(settings.hiddenHintSecs))
      return;
    setHintId(null);
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        const unfound = drawn.filter((d) => !finds.some((f) => f.id === d.id));
        if (!unfound.length) return;
        const pick = unfound[Math.floor(Math.random() * unfound.length)];
        setHintId(pick.id);
        timers.push(
          setTimeout(() => setHintId((h) => (h === pick.id ? null : h)), 2500),
        );
      }, settings.hiddenHintSecs * 1000),
    );
    return () => timers.forEach(clearTimeout);
  }, [coop, scene, won, drawn, finds, turn, settings.hiddenHintSecs, mode]);

  const { width, height } = useWindowDimensions();

  if (!scene) {
    return (
      <GameShell
        title={t(lang, "shell.hidden.title")}
        subtitle={t(lang, "shell.hidden.subPicker")}
        onBack={onHome}
        lang={lang}
      >
        <ScenePicker
          title={t(lang, "picker.hidden")}
          lang={lang}
          options={manifest.hidden.map((h) => ({
            id: h.id,
            name: h.nameT?.[lang] ?? h.name,
            image: h.image,
            flagged: h.flagged,
            level: h.level,
            dimmed: !inFilter(h.level, filter),
          }))}
          onPick={(id) => {
            if (mode !== null) onPickScene(id);
          }}
          onSurprise={() => {
            if (mode !== null && surprisePool.length > 0)
              onPickScene(
                surprisePool[Math.floor(Math.random() * surprisePool.length)]
                  .id,
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
        {twoPlayerEnabled && mode === null ? (
          <ModePicker onPick={setMode} lang={lang} />
        ) : null}
      </GameShell>
    );
  }

  const boxes = drawn.map((t) => ({ id: t.id, box: t }));
  const ar = scene.w / scene.h;

  const { isLandscape, sceneWidth, sidebarWidth } = hiddenLayout(
    width,
    height,
    coop,
    ar,
  );

  const foundIds = finds.map((f) => f.id);
  const ringColors = coop
    ? Object.fromEntries(
        finds
          .filter((f) => f.by !== null)
          .map((f) => [f.id, MP_PLAYERS[f.by as PlayerIx].color]),
      )
    : undefined;

  const onHit = (id: string) => {
    if (won || mode === null) return;
    if (findsRef.current.has(id)) return; // synchronous de-dupe under burst taps
    findsRef.current.add(id);
    sfx.good();
    // Attribution-by-turn: the turn holder gets credit for ANY find —
    // helping is the mechanic. Stamp before flipping the turn.
    const by: PlayerIx | null = coop ? turnRef.current : null;
    setFinds((f) => (f.some((x) => x.id === id) ? f : [...f, { id, by }]));
    if (coop) {
      turnRef.current = nextTurn(turnRef.current);
      setTurn(turnRef.current);
    }
  };

  const finderFor = (id: string): PlayerIx | null => {
    const f = finds.find((x) => x.id === id);
    return f && f.by !== null ? f.by : null;
  };

  const turnBanner = coop ? (
    <TurnBanner turn={turn} lang={lang} compact={isLandscape} />
  ) : null;

  const checklistChips = drawn.map((target) => {
    const done = foundIds.includes(target.id);
    const finder = coop && done ? finderFor(target.id) : null;
    return (
      <View
        key={target.id}
        style={[
          styles.chip,
          isLandscape && styles.chipLandscape,
          shadows.soft,
          done && styles.chipFound,
        ]}
        testID={`checklist-${target.id}`}
        accessibilityRole="image"
        accessibilityLabel={t(lang, done ? "a11y.targetFound" : "a11y.target")}
      >
        <Image
          source={SCENE_IMAGES[target.thumb]}
          style={styles.chipImg}
          resizeMode="contain"
        />
        {done ? (
          <View style={styles.chipCheck}>
            <Text
              style={[
                styles.chipCheckText,
                isLandscape && styles.chipCheckTextLandscape,
              ]}
            >
              ✔️
            </Text>
          </View>
        ) : null}
        {finder !== null ? (
          <View
            style={[
              styles.finderBadge,
              isLandscape && styles.finderBadgeLandscape,
              { borderColor: MP_PLAYERS[finder].color },
            ]}
            testID={`checklist-${target.id}-finder`}
          >
            <Text
              style={[
                styles.finderBadgeText,
                isLandscape && styles.finderBadgeTextLandscape,
              ]}
            >
              {MP_PLAYERS[finder].emoji}
            </Text>
          </View>
        ) : null}
      </View>
    );
  });

  return (
    <GameShell
      title={t(lang, "shell.hidden.title")}
      subtitle={t(lang, "shell.hidden.subPlay", {
        name: scene.nameT?.[lang] ?? scene.name,
      })}
      onBack={onBackToPicker}
      backKind="picker"
      lang={lang}
      right={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {coop ? (
            <>
              <PlayerChip
                player={0}
                count={countFor(finds, 0)}
                active={turn === 0 && !won}
                testID="hidden-player-chip-0"
                lang={lang}
              />
              <PlayerChip
                player={1}
                count={countFor(finds, 1)}
                active={turn === 1 && !won}
                testID="hidden-player-chip-1"
                lang={lang}
              />
            </>
          ) : null}
          {showTimer ? (
            <TimerRing
              elapsed={elapsed}
              size={44}
              stroke={5}
              showLabel
              testID="hidden-timer"
            />
          ) : null}
          <ScoreChip
            label={`🔎 ${finds.length}/${total}`}
            testID="hidden-score"
          />
        </View>
      }
    >
      {!isLandscape && turnBanner}
      {!isLandscape && (
        <View style={styles.checklist} testID="hidden-checklist">
          {checklistChips}
        </View>
      )}
      <View style={[styles.main, isLandscape && styles.mainLandscape]}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            isLandscape && styles.scrollLandscape,
          ]}
        >
          <TapScene
            source={SCENE_IMAGES[scene.image]}
            sceneW={scene.w}
            sceneH={scene.h}
            displayWidth={sceneWidth}
            boxes={boxes}
            foundIds={foundIds}
            ringColors={ringColors}
            hintId={hintId}
            onHit={onHit}
            onMiss={() => {
              sfx.tap();
              say(t(lang, "hidden.prompt"));
            }}
            testIDPrefix="hidden"
            lang={lang}
            disabled={won}
          />
        </ScrollView>
        {isLandscape && (
          <View style={[styles.sidebar, { width: sidebarWidth }]}>
            {turnBanner}
            <ScrollView
              style={styles.sidebarScroll}
              contentContainerStyle={styles.sidebarScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={[styles.checklist, styles.checklistLandscape]}
                testID="hidden-checklist"
              >
                {checklistChips}
              </View>
            </ScrollView>
          </View>
        )}
      </View>
      <WinOverlay
        visible={won}
        message={coop ? t(lang, "win.hiddenCoop") : t(lang, "win.hidden")}
        onNext={() =>
          onPickScene(nextSceneId(manifest.hidden, visible, scene.id))
        }
        onHome={onHome}
        lang={lang}
      />
      {twoPlayerEnabled && mode === null ? (
        <ModePicker onPick={setMode} lang={lang} />
      ) : null}
    </GameShell>
  );
}

function TurnBanner({
  turn,
  lang,
  compact,
}: {
  turn: PlayerIx;
  lang: Lang;
  compact?: boolean;
}) {
  const p = MP_PLAYERS[turn];
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prev = useRef(turn);
  useEffect(() => {
    if (prev.current === turn) return;
    prev.current = turn;
    scaleAnim.setValue(0.9);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [turn, scaleAnim]);
  const turnLabel = t(lang, "hidden.turn", { name: t(lang, p.name) });
  return (
    <Animated.View
      testID="hidden-turn-banner"
      accessibilityLabel={turnLabel}
      style={[
        styles.banner,
        compact && styles.bannerCompact,
        shadows.soft,
        { backgroundColor: p.color, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Text style={[styles.bannerText, compact && styles.bannerTextCompact]}>
        {p.emoji} {turnLabel}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 48,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerCompact: {
    height: 38,
    marginHorizontal: 0,
    marginBottom: 6,
    borderRadius: 12,
    width: "100%",
  },
  bannerText: { fontSize: 22, fontFamily: fonts.display, color: "#FFFFFF" },
  bannerTextCompact: { fontSize: 15 },
  main: { flex: 1 },
  mainLandscape: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 12,
  },
  sidebar: {
    alignItems: "center",
    justifyContent: "flex-start",
    maxHeight: "100%",
  },
  sidebarScroll: {
    flexGrow: 0,
    maxHeight: "100%",
  },
  sidebarScrollContent: {
    alignItems: "center",
    paddingVertical: 2,
  },
  checklist: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
    flexWrap: "wrap",
  },
  checklistLandscape: {
    gap: 8,
    paddingHorizontal: 0,
    paddingBottom: 4,
  },
  chip: {
    width: 92,
    height: 92,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.card,
    backgroundColor: colors.paper,
    overflow: "hidden",
    padding: 5,
  },
  chipLandscape: {
    width: 68,
    height: 68,
    borderRadius: 14,
    borderWidth: 2.5,
    padding: 4,
  },
  chipFound: { borderColor: colors.green },
  chipImg: { width: "100%", height: "100%" },
  chipCheck: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(95,191,110,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  chipCheckText: { fontSize: 24 },
  chipCheckTextLandscape: { fontSize: 20 },
  finderBadge: {
    position: "absolute",
    right: 3,
    bottom: 3,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  finderBadgeLandscape: {
    right: 2,
    bottom: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  finderBadgeText: { fontSize: 12, lineHeight: 15 },
  finderBadgeTextLandscape: { fontSize: 11, lineHeight: 14 },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  scrollLandscape: {
    paddingBottom: 4,
    paddingHorizontal: 4,
  },
});
