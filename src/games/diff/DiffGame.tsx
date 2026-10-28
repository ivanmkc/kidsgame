import { say, sfx } from "../../sound";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SCENE_IMAGES } from "../../assets/images";
import { GameShell } from "../../components/GameShell";
import { TimerRing, useElapsed } from "../../components/TimerRing";
import { FilterCycleChip, ScenePicker } from "../../components/ScenePicker";
import { TapScene } from "../../components/TapScene";
import { WinOverlay } from "../../components/WinOverlay";
import {
  Difficulty,
  DifficultyFilter,
  inFilter,
  nextFilter,
  nextSceneId,
  settingsFor,
} from "../../difficulty";
import { Lang, useLangEpoch } from "../../lang";
import { useWinLine } from "../winlines";
import { t } from "../../i18n";
import { baseImage, manifest } from "../../manifest";
import { makeRng, sample } from "../../rng";
import { colors, fonts, shadows } from "../../theme";
import { DiffHintButton } from "./DiffHintButton";
import { diffPrompt, diffSceneWidth } from "./logic";

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

export function DiffGame({
  onHome,
  difficulty,
  filter = "all",
  onFilter,
  sceneId,
  onPickScene,
  onBackToPicker,
  lang = "en",
}: Props) {
  useLangEpoch(lang);
  const visible = manifest.diff.filter((d) => inFilter(d.level, filter));
  const scene = manifest.diff.find((d) => d.id === sceneId) ?? null;
  // With the 🎨 All filter, play each scene at ITS OWN badge difficulty —
  // flattening to medium hid the easy-mode hint/no-timer design entirely.
  const effDifficulty =
    filter === "all" && scene?.level ? scene.level : difficulty;
  const [found, setFound] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [forceReady, setForceReady] = useState(false);
  const wrapRef = useRef<View>(null);
  const [hintRegion, setHintRegion] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [hintAvailable, setHintAvailable] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSceneIdRef = useRef<string | undefined | null>(null);
  const settings = settingsFor(effDifficulty);

  // The hint button stays hidden until the kid is genuinely stuck (~10s
  // without a find), and hides again after each use — no hint spamming.
  const armHintTimer = () => {
    setHintAvailable(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (settings.diffHint) {
      idleTimer.current = setTimeout(() => setHintAvailable(true), 10000);
    }
  };

  // Hold the round invisible until every image (both bases + all patch
  // overlays) has fully loaded — a late-arriving patch would flicker in
  // and give the difference away. Timeout guard: never blank the game forever.
  useEffect(() => {
    setFound([]);
    setHintRegion(null);
    setReady(false);
    setForceReady(false);
    prevFoundCount.current = 0;
    armHintTimer();
    const t = setTimeout(() => setForceReady(true), 8000);
    return () => {
      clearTimeout(t);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, [sceneId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Pooled scenes draw a fresh random subset (and random side per
  // difference) every time the scene mounts — a level never plays the
  // same twice. Legacy flat pairs keep their fixed four.
  const { boxes, overlaysA, overlaysB, total } = useMemo(() => {
    const rng = makeRng(Math.floor(Math.random() * 1e9));
    const round =
      scene?.pool && scene.image
        ? sample(rng, scene.pool, settingsFor(effDifficulty).diffDraw).map(
            (p) => ({
              box: p,
              patch: p.patch as string | undefined,
              patchOnA: rng() < 0.5,
            }),
          )
        : (scene?.diffs ?? []).map((d) => ({
            box: d,
            patch: undefined as string | undefined,
            patchOnA: false,
          }));
    return {
      total: round.length,
      boxes: round.map((r, i) => ({ id: String(i), box: r.box })),
      overlaysA: round
        .filter((r) => r.patch && r.patchOnA)
        .map((r) => ({ box: r.box, source: SCENE_IMAGES[r.patch!] })),
      overlaysB: round
        .filter((r) => r.patch && !r.patchOnA)
        .map((r) => ({ box: r.box, source: SCENE_IMAGES[r.patch!] })),
    };
  }, [sceneId]); // eslint-disable-line react-hooks/exhaustive-deps
  const won = found.length === total && total > 0;
  const progressPulse = useRef(new Animated.Value(1)).current;
  const prevFoundCount = useRef(0);
  useEffect(() => {
    if (found.length > prevFoundCount.current) {
      progressPulse.setValue(1.35);
      Animated.spring(progressPulse, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }).start();
    }
    prevFoundCount.current = found.length;
  }, [found.length, progressPulse]);

  const onReplay = () => {
    if (won) return;
    sfx.tap();
    say(diffPrompt(lang, true));
  };
  useEffect(() => {
    const sceneChanged = sceneId !== lastSceneIdRef.current;
    lastSceneIdRef.current = sceneId;
    if (sceneChanged || !won) {
      say(diffPrompt(lang, !!scene));
    }
  }, [sceneId, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const expectedAssets = 2 + overlaysA.length + overlaysB.length;

  // react-native-web's Image onLoad fires once the DIMENSIONS are known —
  // before the bytes finish streaming — so poll the real <img> elements
  // under the round container until every one is fully complete.
  useEffect(() => {
    if (ready) return;
    const iv = setInterval(() => {
      const node = wrapRef.current as unknown as {
        querySelectorAll?: (sel: string) => ArrayLike<HTMLImageElement>;
      } | null;
      if (!node?.querySelectorAll) {
        setReady(true); // non-DOM platform: no gate needed
        return;
      }
      const imgs = Array.from(node.querySelectorAll("img"));
      if (
        imgs.length >= expectedAssets &&
        imgs.every((im) => im.complete && im.naturalWidth > 0)
      ) {
        setReady(true);
      }
    }, 80);
    return () => clearInterval(iv);
  }, [ready, sceneId, expectedAssets]);
  useWinLine(won, t(lang, "win.diff"));
  const showRound = ready || forceReady;
  const showTimer = settingsFor(effDifficulty).timer;
  const elapsed = useElapsed(showTimer && !won && !!scene, sceneId);
  const srcA = scene ? SCENE_IMAGES[baseImage(scene)] : 0;
  const srcB = scene ? SCENE_IMAGES[(scene.imageB ?? scene.image)!] : 0;
  const ar = scene ? scene.w / scene.h : 16 / 9;

  if (!scene) {
    return (
      <GameShell
        title={t(lang, "shell.diff.title")}
        subtitle={t(lang, "shell.diff.subPicker")}
        onBack={onHome}
        lang={lang}
      >
        <ScenePicker
          title={t(lang, "picker.diff")}
          lang={lang}
          options={manifest.diff.map((d) => ({
            id: d.id,
            name: d.nameT?.[lang] ?? d.name,
            image: baseImage(d),
            flagged: d.flagged,
            level: d.level,
            dimmed: !inFilter(d.level, filter),
          }))}
          onPick={onPickScene}
          onSurprise={() => {
            const surprisePool = visible.length > 0 ? visible : manifest.diff;
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

  // Fit both pictures in the viewport — side by side in landscape,
  // stacked in portrait — clamped to a minimum playable width.
  const sceneWidth = diffSceneWidth(
    width,
    height,
    Boolean(settings.diffHint),
    ar,
  );

  const onHit = (id: string) => {
    if (won) return;
    sfx.good();
    setFound((f) => (f.includes(id) ? f : [...f, id]));
    setHintRegion(null);
    armHintTimer();
  };

  // Hint = a BIG search area that contains exactly ONE remaining difference,
  // jittered so the target is never centered — narrows the hunt without
  // handing over the answer.
  const showHint = () => {
    const remaining = boxes.filter((b) => !found.includes(b.id));
    if (remaining.length === 0) return;
    const target = remaining[Math.floor(Math.random() * remaining.length)];
    const RW = Math.round(scene.w * 0.45);
    const RH = Math.round(scene.h * 0.55);
    const clamp = (v: number, lo: number, hi: number) =>
      Math.min(hi, Math.max(lo, v));
    const overlaps = (
      r: { x: number; y: number; w: number; h: number },
      b: typeof target,
    ) =>
      !(
        b.box.x > r.x + r.w ||
        b.box.x + b.box.w < r.x ||
        b.box.y > r.y + r.h ||
        b.box.y + b.box.h < r.y
      );
    let best: { x: number; y: number; w: number; h: number } | null = null;
    for (let tries = 0; tries < 40; tries++) {
      const ox = Math.random() * Math.max(1, RW - target.box.w);
      const oy = Math.random() * Math.max(1, RH - target.box.h);
      const r = {
        x: clamp(Math.round(target.box.x - ox), 0, scene.w - RW),
        y: clamp(Math.round(target.box.y - oy), 0, scene.h - RH),
        w: RW,
        h: RH,
      };
      if (!overlaps(r, target)) continue;
      const hits = remaining.filter((b) => overlaps(r, b)).length;
      if (hits === 1) {
        best = r;
        break;
      }
      if (!best) best = r; // fallback: at least contains the target
    }
    if (!best) return;
    setHintRegion(best);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHintRegion(null), 3200);
    armHintTimer(); // one peek, then back to earning it
  };

  const pictures = (
    <>
      <View style={styles.sceneBlock}>
        <Text style={styles.label}>{t(lang, "diff.pictureA")}</Text>
        <TapScene
          source={srcA}
          overlays={overlaysA}
          sceneW={scene.w}
          sceneH={scene.h}
          displayWidth={sceneWidth}
          boxes={boxes}
          foundIds={found}
          hintRegion={hintRegion}
          onHit={onHit}
          onMiss={() => {}}
          testIDPrefix="left"
          lang={lang}
          disabled={won}
        />
      </View>
      <View style={styles.sceneBlock}>
        <Text style={styles.label}>{t(lang, "diff.pictureB")}</Text>
        <TapScene
          source={srcB}
          overlays={overlaysB}
          sceneW={scene.w}
          sceneH={scene.h}
          displayWidth={sceneWidth}
          boxes={boxes}
          foundIds={found}
          hintRegion={hintRegion}
          onHit={onHit}
          onMiss={() => {}}
          testIDPrefix="right"
          lang={lang}
          disabled={won}
        />
      </View>
    </>
  );

  return (
    <GameShell
      title={t(lang, "shell.diff.title")}
      subtitle={t(lang, "shell.diff.subPlay", {
        name: scene.nameT?.[lang] ?? scene.name,
        n: total,
      })}
      onBack={onBackToPicker}
      backKind="picker"
      lang={lang}
      right={
        <View style={styles.headerRight}>
          <Pressable
            testID="diff-replay"
            accessibilityRole="button"
            accessibilityLabel={t(lang, "spell.hearAgain")}
            disabled={won}
            onPress={onReplay}
            style={({ pressed }) => [
              styles.replayBtn,
              shadows.soft,
              won && styles.replayBtnDisabled,
              pressed && !won && styles.pressed,
            ]}
          >
            <Text style={styles.replayText}>🔊</Text>
          </Pressable>
          {showTimer ? (
            <TimerRing
              elapsed={elapsed}
              size={44}
              stroke={5}
              showLabel
              testID="diff-timer"
            />
          ) : null}
          <Animated.View
            style={[
              styles.progressChip,
              shadows.soft,
              { transform: [{ scale: progressPulse }] },
            ]}
            testID="diff-progress"
            accessibilityRole="text"
            accessibilityLabel={`${found.length}/${total}`}
          >
            <View style={styles.slotsRow} testID="diff-slots">
              {Array.from({ length: total }).map((_, i) => {
                const isFilled = i < found.length;
                return (
                  <View
                    key={i}
                    testID={`diff-slot-${i}`}
                    style={[styles.slot, isFilled && styles.slotFilled]}
                  >
                    <View
                      testID={isFilled ? "diff-slot-filled" : "diff-slot-empty"}
                      style={styles.slotInner}
                    >
                      {isFilled ? (
                        <Text style={styles.slotStar}>⭐</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
            <Text style={styles.scoreText} testID="diff-score">
              {`🔍 ${found.length}/${total}`}
            </Text>
          </Animated.View>
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View
          ref={wrapRef}
          testID="diff-wrap"
          pointerEvents={showRound ? "auto" : "none"}
          style={[
            isLandscape ? styles.rowWrap : styles.colWrap,
            !showRound && styles.hiddenUntilLoaded,
          ]}
        >
          {pictures}
        </View>
        {!showRound ? (
          <View
            pointerEvents="none"
            style={styles.loadingWrap}
            testID="diff-loading"
          >
            <ActivityIndicator size="large" color={colors.inkSoft} />
          </View>
        ) : null}
        {settings.diffHint ? (
          <View style={styles.hintSlot} testID="diff-hint-slot">
            {hintAvailable && !won ? (
              <DiffHintButton lang={lang} onPress={showHint} />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <WinOverlay
        visible={won}
        message={t(lang, "win.diff")}
        onNext={() =>
          onPickScene(nextSceneId(manifest.diff, visible, scene.id))
        }
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  rowWrap: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  colWrap: { flexDirection: "column", gap: 8, alignItems: "center" },
  hiddenUntilLoaded: { opacity: 0 },
  loadingWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  sceneBlock: { alignItems: "center" },
  label: {
    fontSize: 14,
    fontFamily: fonts.displayMed,
    color: colors.inkSoft,
    marginBottom: 2,
  },
  hintSlot: {
    height: 44,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  replayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  replayBtnDisabled: {
    opacity: 0.4,
  },
  replayText: {
    fontSize: 22,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
  progressChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.06)",
  },
  slotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  slot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D4C5A9",
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  slotFilled: {
    borderColor: colors.gold,
    backgroundColor: "#FFF8E7",
  },
  slotInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  slotStar: {
    fontSize: 11,
    lineHeight: 13,
  },
  scoreText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.ink,
  },
});
