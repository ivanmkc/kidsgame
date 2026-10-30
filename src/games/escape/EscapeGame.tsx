import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SCENE_IMAGES } from "../../assets/images";
import { GameShell } from "../../components/GameShell";
import { BetaPill } from "../../components/BetaPill";
import { FilterCycleChip, ScenePicker } from "../../components/ScenePicker";
import { WinOverlay } from "../../components/WinOverlay";
import { SparkleBurst } from "../../components/Sparkles";
import {
  Difficulty,
  DifficultyFilter,
  inFilter,
  nextFilter,
  nextSceneId,
} from "../../difficulty";
import { Lang, useLangEpoch } from "../../lang";
import { t } from "../../i18n";
import { say, sayThen, sfx } from "../../sound";
import { EscapeHotspot, EscapeRoom, manifest } from "../../manifest";
import { colors, fonts, shadows } from "../../theme";
import {
  EscapeState,
  applyTap,
  escapeDisplayWidth,
  escapeHintMs,
  isHotspotAvailable,
  nextHint,
  selectItem,
  startState,
} from "./logic";
import { SpriteAnim, SpriteCanvas } from "./SpriteCanvas";
import {
  FeedbackEmoji,
  FlyingEmoji,
  PopBurst,
  PulseRing,
} from "./EscapeEffects";

// Kid escape room: search the picture, collect up to three items in the
// tray, tap an item then tap the thing it opens. Chains are 2-4 steps and
// generator-linted solvable; an idle hint glows the next right spot so
// nobody ever wedges. Tap-select-tap only — no drag-drop at age three.

interface Props {
  onHome: () => void;
  difficulty?: Difficulty;
  filter?: DifficultyFilter;
  onFilter?: (f: DifficultyFilter) => void;
  sceneId?: string;
  onPickScene: (id: string) => void;
  onBackToPicker: () => void;
  lang: Lang;
}

function roomText(
  room: EscapeRoom,
  field: "intro" | "winText",
  lang: Lang,
): string {
  return room.t?.[lang]?.[field] ?? room[field];
}

function hotText(
  h: EscapeHotspot,
  field: "sayFound" | "saySearch" | "sayLocked",
  lang: Lang,
): string | undefined {
  const base = h[field];
  if (!base) return undefined;
  return h.t?.[lang]?.[field] ?? base;
}

function itemLabel(
  item: { label: string; t?: Record<string, string> },
  lang: Lang,
): string {
  return item.t?.[lang] ?? item.label;
}

export function EscapeGame({
  onHome,
  difficulty = "medium",
  filter = "all",
  onFilter,
  sceneId,
  onPickScene,
  onBackToPicker,
  lang,
}: Props) {
  useLangEpoch(lang);
  const rooms = manifest.escape ?? [];
  const room = rooms.find((r) => r.id === sceneId);
  const visible = rooms.filter((r) => inFilter(r.level, filter));
  const surprisePool = visible.length > 0 ? visible : rooms;
  const effDifficulty =
    filter !== "all" ? filter : (room?.level || difficulty);
  const hintMs = escapeHintMs(effDifficulty);
  const [state, setState] = useState<EscapeState>(() => startState());
  const [hintSpot, setHintSpot] = useState<string | null>(null);
  const [spriteAnims, setSpriteAnims] = useState<SpriteAnim[]>([]);
  const [flyingItems, setFlyingItems] = useState<
    Array<{
      key: string;
      emoji: string;
      fromX: number;
      fromY: number;
    }>
  >([]);
  const [popBursts, setPopBursts] = useState<
    Array<{
      key: string;
      source: number;
      cx: number;
      cy: number;
    }>
  >([]);
  const [feedbackBursts, setFeedbackBursts] = useState<
    Array<{
      key: string;
      emoji: string;
      cx: number;
      cy: number;
      hotspotId: string;
    }>
  >([]);
  const lastAction = useRef(Date.now());
  const framePos = useRef({ x: 0, y: 0 });
  const trayPos = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const { width } = useWindowDimensions();
  const stateRef = useRef(state);
  stateRef.current = state;
  // ALL hooks above the early returns (repo hard rule).
  useEffect(() => {
    setState(startState());
    setSpriteAnims([]);
    setHintSpot(null);
    setFlyingItems([]);
    setPopBursts([]);
    setFeedbackBursts([]);
    lastAction.current = Date.now();
  }, [sceneId]);

  useEffect(() => {
    if (room) say(roomText(room, "intro", lang));
  }, [sceneId, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Idle hint: after hintMs without progress, glow the next actionable spot
  // (and auto-select the needed tray item so the glow is honest).
  useEffect(() => {
    if (!room || state.done) return;
    const iv = setInterval(() => {
      if (Date.now() - lastAction.current < hintMs) return;
      const hint = nextHint(room, state);
      if (!hint) return;
      if (hint.selectItem) setState((s) => selectItem(s, hint.selectItem!));
      setHintSpot(hint.hotspotId);
    }, 1000);
    return () => clearInterval(iv);
  }, [room, state, hintMs]);

  const displayWidth = escapeDisplayWidth(width);
  const scale = displayWidth / 1280;
  const displayHeight = 720 * scale;

  // Plate model: the base image is always room.image. Every visual state
  // change is rendered as a sprite layer on top by the SpriteCanvas.

  const heldItems = useMemo(
    () =>
      room
        ? state.inventory
            .map((id) => room.items.find((i) => i.id === id)!)
            .filter(Boolean)
        : [],
    [room, state.inventory],
  );

  const startSprite = useCallback((hotspotId: string) => {
    setSpriteAnims((prev) => {
      if (prev.some((a) => a.hotspotId === hotspotId && (a.playing || a.held)))
        return prev;
      return [
        ...prev,
        { hotspotId, playing: true, held: false, frameIndex: 0 },
      ];
    });
  }, []);

  if (!sceneId || !room) {
    return (
      <GameShell
        title={t(lang, "shell.escape.title")}
        subtitle={t(lang, "shell.escape.subPicker")}
        onBack={onHome}
        lang={lang}
        right={<BetaPill testID="escape-beta" lang={lang} />}
      >
        <ScenePicker
          title={t(lang, "picker.escape")}
          options={rooms.map((r) => ({
            id: r.id,
            name: r.nameT?.[lang] ?? r.name,
            image: r.image,
            level: r.level,
            dimmed: !inFilter(r.level, filter),
          }))}
          onPick={onPickScene}
          onSurprise={() =>
            surprisePool.length &&
            onPickScene(
              surprisePool[Math.floor(Math.random() * surprisePool.length)].id,
            )
          }
          filterChip={
            onFilter ? (
              <FilterCycleChip
                filter={filter}
                onCycle={() => onFilter(nextFilter(filter))}
                lang={lang}
              />
            ) : undefined
          }
          lang={lang}
        />
      </GameShell>
    );
  }

  const onSpot = (hotspotId: string) => {
    lastAction.current = Date.now();
    setHintSpot(null);
    const h = room.hotspots.find((x) => x.id === hotspotId);
    const currentState = stateRef.current;
    const { state: next, effect } = applyTap(room, currentState, hotspotId);
    stateRef.current = next;
    setState(next);
    const locSay = (field: "sayFound" | "saySearch" | "sayLocked") =>
      h ? hotText(h, field, lang) : undefined;
    const playAnim = () => {
      if (h?.sprite?.sheet) startSprite(hotspotId);
    };
    const showFeedback = (emoji: string) => {
      if (!h) return;
      const cx = (h.box.x + h.box.w / 2) * scale;
      const cy = (h.box.y + h.box.h / 2) * scale;
      setFeedbackBursts((prev) => [
        ...prev.filter((x) => x.hotspotId !== hotspotId),
        { key: `fb-${hotspotId}-${Date.now()}`, emoji, cx, cy, hotspotId },
      ]);
    };
    switch (effect.kind) {
      case "revealed":
        sfx.good();
        playAnim();
        setFeedbackBursts((prev) =>
          prev.filter((x) => x.hotspotId !== hotspotId),
        );
        {
          const s = locSay("sayFound");
          if (s) say(s);
        }
        break;
      case "collected": {
        sfx.good();
        setFeedbackBursts((prev) =>
          prev.filter((x) => x.hotspotId !== hotspotId),
        );
        const item = room.items.find((i) => i.id === effect.item);
        if (item && h) {
          const box = h.itemBox ?? h.sprite?.itemBbox ?? h.box;
          const fromX = framePos.current.x + (box.x + box.w / 2) * scale;
          const fromY = framePos.current.y + (box.y + box.h / 2) * scale;
          if (h.pop && SCENE_IMAGES[h.pop]) {
            setPopBursts((p) => [
              ...p,
              {
                key: `pop-${hotspotId}-${Date.now()}`,
                source: SCENE_IMAGES[h.pop!],
                cx: (box.x + box.w / 2) * scale,
                cy: (box.y + box.h / 2) * scale,
              },
            ]);
          }
          setFlyingItems((f) => [
            ...f,
            {
              key: `${hotspotId}-${Date.now()}`,
              emoji: item.emoji,
              fromX,
              fromY,
            },
          ]);
        }
        if (item) say(itemLabel(item, lang));
        break;
      }
      case "unlocked":
        sfx.good();
        playAnim();
        setFeedbackBursts((prev) =>
          prev.filter((x) => x.hotspotId !== hotspotId),
        );
        {
          const s = locSay("sayFound");
          if (s) say(s);
        }
        break;
      case "win":
        playAnim();
        setFeedbackBursts((prev) =>
          prev.filter((x) => x.hotspotId !== hotspotId),
        );
        sayThen(
          [locSay("sayFound") ?? "", roomText(room, "winText", lang)],
          () => {},
        );
        break;
      case "locked":
        sfx.boing(0.4);
        showFeedback("❌");
        {
          const s = locSay("sayLocked");
          if (s) say(s);
        }
        break;
      case "flavor":
        sfx.tap();
        showFeedback("🔍");
        {
          const s = locSay("saySearch");
          if (s) say(s);
        }
        break;
      default:
        break;
    }
  };

  const onTray = (itemId: string) => {
    lastAction.current = Date.now();
    sfx.tap();
    const item = room.items.find((i) => i.id === itemId);
    if (item) say(itemLabel(item, lang));
    setState((s) => selectItem(s, itemId));
  };

  const onReplay = () => {
    if (state.done) return;
    lastAction.current = Date.now();
    setHintSpot(null);
    sfx.tap();
    say(roomText(room, "intro", lang));
  };

  return (
    <GameShell
      title={room.nameT?.[lang] ?? room.name}
      subtitle={t(lang, "shell.escape.subPlay")}
      onBack={onBackToPicker}
      backKind="picker"
      lang={lang}
      right={
        <View style={styles.headerRight}>
          <Pressable
            testID="escape-replay"
            accessibilityRole="button"
            accessibilityLabel={t(lang, "spell.hearAgain")}
            disabled={state.done}
            onPress={onReplay}
            style={({ pressed }) => [
              styles.replayBtn,
              shadows.soft,
              state.done && styles.replayBtnDisabled,
              pressed && !state.done && styles.pressed,
            ]}
          >
            <Text style={styles.replayText}>🔊</Text>
          </Pressable>
          <BetaPill testID="escape-beta" lang={lang} />
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        <View
          onLayout={(e) => {
            framePos.current = {
              x: e.nativeEvent.layout.x,
              y: e.nativeEvent.layout.y,
            };
          }}
          style={[
            styles.frame,
            shadows.sticker,
            { width: displayWidth, height: displayHeight },
          ]}
        >
          <Image
            source={SCENE_IMAGES[room.image]}
            style={{ width: displayWidth, height: displayHeight }}
            resizeMode="cover"
          />
          <SpriteCanvas
            room={room}
            state={state}
            anims={spriteAnims}
            setAnims={setSpriteAnims}
            scale={scale}
          />
          {Platform.OS === "web" &&
            room.hotspots.map((h) => {
              if (!h.sprite?.itemLayer || !h.sprite.itemBbox) return null;
              const revealed = state.revealed.includes(h.id);
              const used = state.used.includes(h.id);
              if (!revealed || used) return null;
              const ib = h.sprite.itemBbox;
              return React.createElement("img", {
                key: `item-${h.id}`,
                src: h.sprite.itemLayer,
                style: {
                  position: "absolute",
                  left: ib.x * scale,
                  top: ib.y * scale,
                  width: ib.w * scale,
                  height: ib.h * scale,
                  pointerEvents: "none",
                },
              });
            })}
          {room.hotspots.map((h) => {
            if (!isHotspotAvailable(room, state, h.id)) return null;
            const used = state.used.includes(h.id);
            const revealed = state.revealed.includes(h.id);
            const actionable =
              !used &&
              !revealed &&
              (h.kind === "search" ||
                !h.needs ||
                state.inventory.includes(h.needs));
            const box =
              (revealed ? (h.itemBox ?? h.sprite?.itemBbox) : undefined) ??
              h.box;
            return (
              <Pressable
                key={h.id}
                testID={`escape-spot-${h.id}`}
                disabled={used}
                onPress={() => onSpot(h.id)}
                accessibilityRole={used ? "none" : "button"}
                accessibilityLabel={h.id}
                style={{
                  position: "absolute",
                  left: (box.x - 8) * scale,
                  top: (box.y - 8) * scale,
                  width: (box.w + 16) * scale,
                  height: (box.h + 16) * scale,
                  pointerEvents: used ? "none" : "auto",
                }}
              >
                {revealed && <PulseRing strong />}
                {!used &&
                  !revealed &&
                  (hintSpot === h.id ? (
                    <PulseRing strong />
                  ) : h.kind !== "search" ? (
                    <PulseRing dim={!actionable} />
                  ) : null)}
                {used ? <SparkleBurst trigger="found" /> : null}
              </Pressable>
            );
          })}
          {popBursts.map((pb) => (
            <PopBurst
              key={pb.key}
              source={pb.source}
              cx={pb.cx}
              cy={pb.cy}
              onDone={() =>
                setPopBursts((p) => p.filter((x) => x.key !== pb.key))
              }
            />
          ))}
          {feedbackBursts.map((fb) => (
            <FeedbackEmoji
              key={fb.key}
              emoji={fb.emoji}
              cx={fb.cx}
              cy={fb.cy}
              isShake={fb.emoji === "❌"}
              testID={`escape-feedback-${fb.hotspotId}`}
              onDone={() =>
                setFeedbackBursts((prev) =>
                  prev.filter((x) => x.key !== fb.key),
                )
              }
            />
          ))}
        </View>
        <View
          onLayout={(e) => {
            const { x, y, width: w, height: h } = e.nativeEvent.layout;
            trayPos.current = { x, y, w, h };
          }}
          style={styles.tray}
          testID="escape-tray"
        >
          {heldItems.length === 0 ? (
            <Text style={styles.trayEmpty}>{t(lang, "escape.trayEmpty")}</Text>
          ) : (
            heldItems.map((i) => (
              <Pressable
                key={i.id}
                testID={`escape-item-${i.id}`}
                onPress={() => onTray(i.id)}
                accessibilityRole="button"
                accessibilityLabel={itemLabel(i, lang)}
                style={[
                  styles.trayItem,
                  state.selected === i.id && styles.trayItemOn,
                ]}
              >
                <Text style={styles.trayEmoji}>{i.emoji}</Text>
              </Pressable>
            ))
          )}
        </View>
        {flyingItems.map((fi) => (
          <FlyingEmoji
            key={fi.key}
            emoji={fi.emoji}
            fromX={fi.fromX}
            fromY={fi.fromY}
            toX={trayPos.current.x + trayPos.current.w / 2}
            toY={trayPos.current.y + trayPos.current.h / 2}
            onDone={() =>
              setFlyingItems((f) => f.filter((x) => x.key !== fi.key))
            }
          />
        ))}
      </ScrollView>
      <WinOverlay
        visible={state.done}
        message={roomText(room, "winText", lang)}
        onNext={() => {
          onPickScene(nextSceneId(rooms, visible, room.id));
        }}
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

// BETA pill now shared — see src/components/BetaPill.tsx.

const styles = StyleSheet.create({
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  replayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  replayBtnDisabled: { opacity: 0.4 },
  replayText: { fontSize: 22 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  wrap: { alignItems: "center", paddingBottom: 20, gap: 12 },
  frame: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: colors.card,
    borderWidth: 5,
    borderColor: colors.card,
  },
  tray: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    minHeight: 78,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.blush,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  trayEmpty: { fontFamily: fonts.bodyReg, fontSize: 14, color: colors.inkSoft },
  trayItem: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "transparent",
  },
  trayItemOn: {
    borderColor: colors.gold,
    backgroundColor: "#FFF3D6",
    transform: [{ scale: 1.1 }],
  },
  trayEmoji: { fontSize: 36 },
});
