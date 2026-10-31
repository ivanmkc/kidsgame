import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, StyleSheet, View, PointerEvent } from "react-native";
import { playNote, primeMusic } from "../../music";
import {
  BoxState,
  advance,
  beatsForTap,
  harmonyOffsets,
  noteForTap,
  octaveOffset,
  pickSpawnSprite,
  spawnZone,
  startState,
} from "./logic";
import { SceneDef } from "./scenes";
import { songById } from "./logic";
import { ScrollingWorld } from "./ScrollingWorld";
import { SpawnedObject, SpawnEntry } from "./SpawnedObject";
import { VehicleSprite } from "./VehicleSprite";
import { t } from "../../i18n";
import { Lang } from "../../lang";

interface Props {
  scene: SceneDef;
  freePlay?: boolean;
  richChords?: boolean;
  lang: Lang;
}

const SCROLL_PER_TAP = 48;
const MAX_SPAWNS = 20;

export function JourneyScene({
  scene,
  freePlay = false,
  richChords = false,
  lang,
}: Props) {
  const song = freePlay ? null : songById(scene.songId);
  const [state, setState] = useState<BoxState>(() => startState(song));
  const [spawns, setSpawns] = useState<SpawnEntry[]>([]);
  const spawnsRef = useRef(spawns);
  spawnsRef.current = spawns;
  const nextId = useRef(1);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollTotal = useRef(0);
  const currentScrollX = useRef(0);
  const vehicleBounce = useRef(new Animated.Value(0)).current;
  const vehicleIdle = useRef(new Animated.Value(0)).current;
  const stageSize = useRef({ w: 1, h: 1 });
  const activePointers = useRef(new Set<number>());
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const id = scrollX.addListener(({ value }) => {
      currentScrollX.current =
        typeof value === "number" ? value : Number(value);
    });
    return () => {
      scrollX.removeListener(id);
    };
  }, [scrollX]);

  useEffect(() => {
    const initial = startState(freePlay ? null : songById(scene.songId));
    stateRef.current = initial;
    setState(initial);
    setSpawns([]);
    scrollX.setValue(0);
    scrollTotal.current = 0;
    currentScrollX.current = 0;
    activePointers.current.clear();
    vehicleIdle.setValue(0);
    vehicleBounce.setValue(0);

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(vehicleIdle, {
          toValue: 1,
          duration: 2400,
          useNativeDriver: true,
        }),
        Animated.timing(vehicleIdle, {
          toValue: 0,
          duration: 2400,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scene.id, freePlay]); // eslint-disable-line react-hooks/exhaustive-deps

  const doTap = useCallback(
    (x: number, y: number, fingerCount: number) => {
      primeMusic();
      const scrollAtSpawn = currentScrollX.current;
      const yFrac = y / Math.max(1, stageSize.current.h);
      const offset = octaveOffset(yFrac);
      const s = stateRef.current;
      const midi = noteForTap(s) + offset;
      const offsets = harmonyOffsets(fingerCount, midi, richChords);
      for (const h of offsets) {
        playNote(midi + h, offsets.length > 1 ? 0.7 : 1);
      }
      const big = beatsForTap(s) > 1;
      const nextS = advance(s);
      stateRef.current = nextS;
      setState(nextS);

      const scrollAmount =
        fingerCount > 1 ? SCROLL_PER_TAP * 0.3 : SCROLL_PER_TAP;
      scrollTotal.current += scrollAmount;
      Animated.spring(scrollX, {
        toValue: scrollTotal.current,
        friction: 14,
        tension: 50,
        useNativeDriver: true,
      }).start();

      vehicleBounce.setValue(0);
      Animated.spring(vehicleBounce, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }).start(() => vehicleBounce.setValue(0));

      const zone = spawnZone(yFrac);
      const pool = scene.objects[zone];
      const activeKeys = spawnsRef.current.map((s) => s.spriteKey);
      const spriteKey = pickSpawnSprite(pool, nextId.current, activeKeys);
      const id = nextId.current++;
      setSpawns((prev) => [
        ...prev.slice(-(MAX_SPAWNS - 1)),
        {
          id,
          x,
          y,
          scrollAtSpawn,
          spriteKey,
          sceneId: scene.id,
          big,
          zone,
          midi,
        },
      ]);
    },
    [richChords, scene, scrollX, vehicleBounce],
  );

  const onTapSpawn = useCallback((entry: SpawnEntry) => {
    primeMusic();
    playNote(entry.midi, 0.5);
  }, []);

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      const id = e.nativeEvent.pointerId ?? 1;
      activePointers.current.add(id);
      const fingerCount = activePointers.current.size;
      const touch = e.nativeEvent;
      const x =
        touch.offsetX ??
        (touch as unknown as { locationX?: number }).locationX ??
        stageSize.current.w * (0.2 + 0.6 * Math.random());
      const y =
        touch.offsetY ??
        (touch as unknown as { locationY?: number }).locationY ??
        stageSize.current.h * 0.5;
      doTap(x, y, fingerCount);
    },
    [doTap],
  );

  const onPointerUp = useCallback((e: PointerEvent) => {
    const id = e.nativeEvent.pointerId ?? 1;
    activePointers.current.delete(id);
  }, []);

  const onPointerCancel = useCallback((e: PointerEvent) => {
    const id = e.nativeEvent.pointerId ?? 1;
    activePointers.current.delete(id);
  }, []);

  const vehicleTranslateY = useMemo(
    () =>
      Animated.add(
        vehicleBounce.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, -18, 0],
        }),
        vehicleIdle.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, -6, 0],
        }),
      ),
    [vehicleBounce, vehicleIdle],
  );

  const vehicleScale = useMemo(
    () =>
      vehicleBounce.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [1, 1.08, 1],
      }),
    [vehicleBounce],
  );

  const vehicleRotate = useMemo(
    () =>
      vehicleIdle.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: ["-2deg", "0deg", "2deg", "0deg", "-2deg"],
      }),
    [vehicleIdle],
  );

  return (
    <View
      style={styles.stage}
      onLayout={(e) => {
        stageSize.current = {
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        };
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerCancel}
      testID="musicbox-stage"
      accessibilityLabel={t(lang, "musicbox.stage")}
    >
      <ScrollingWorld scrollX={scrollX} scene={scene} />

      <VehicleSprite
        scene={scene}
        translateY={vehicleTranslateY}
        scale={vehicleScale}
        rotate={vehicleRotate}
      />

      {spawns.map((s) => (
        <SpawnedObject
          key={s.id}
          entry={s}
          scrollX={scrollX}
          onTapSpawn={onTapSpawn}
          lang={lang}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 12,
    margin: 4,
    backgroundColor: "#1B1440",
  },
});
