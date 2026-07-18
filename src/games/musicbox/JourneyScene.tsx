import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View, GestureResponderEvent } from 'react-native';
import { playNote, primeMusic } from '../../music';
import { BoxState, advance, beatsForTap, harmonyOffsets, noteForTap, octaveOffset, spawnZone, startState } from './logic';
import { SceneDef } from './scenes';
import { songById } from './logic';
import { ScrollingWorld } from './ScrollingWorld';
import { SpawnedObject, SpawnEntry } from './SpawnedObject';
import { VehicleSprite } from './VehicleSprite';

interface Props {
  scene: SceneDef;
}

const SCROLL_PER_TAP = 48;
const MAX_SPAWNS = 20;

export function JourneyScene({ scene }: Props) {
  const song = songById(scene.songId);
  const [state, setState] = useState<BoxState>(() => startState(song));
  const [spawns, setSpawns] = useState<SpawnEntry[]>([]);
  const nextId = useRef(1);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollTotal = useRef(0);
  const vehicleBounce = useRef(new Animated.Value(0)).current;
  const vehicleIdle = useRef(new Animated.Value(0)).current;
  const stageSize = useRef({ w: 1, h: 1 });
  const holdDown = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    setState(startState(song));
    setSpawns([]);
    scrollX.setValue(0);
    scrollTotal.current = 0;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(vehicleIdle, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(vehicleIdle, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scene.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const doTap = useCallback((x: number, y: number, fingerCount: number) => {
    primeMusic();
    const yFrac = y / Math.max(1, stageSize.current.h);
    const offset = octaveOffset(yFrac);
    const s = stateRef.current;
    const midi = noteForTap(s);
    const offsets = harmonyOffsets(fingerCount);
    for (const h of offsets) {
      playNote(midi + offset + h, fingerCount > 1 ? 0.7 : 1);
    }
    const big = beatsForTap(s) > 1;
    setState(advance(s));

    const scrollAmount = holdDown.current ? SCROLL_PER_TAP * 0.3 : SCROLL_PER_TAP;
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
    const spriteKey = pool[nextId.current % pool.length];
    const id = nextId.current++;
    const scrollAtSpawn = scrollTotal.current;
    setSpawns((prev) => [
      ...prev.slice(-(MAX_SPAWNS - 1)),
      { id, x, y, scrollAtSpawn, spriteKey, sceneId: scene.id, big, zone },
    ]);
  }, [scene, scrollX, vehicleBounce]);

  const onTapSpawn = useCallback((entry: SpawnEntry) => {
    primeMusic();
    const s = stateRef.current;
    const midi = noteForTap(s);
    playNote(midi, 0.5);
  }, []);

  const onTouchStart = useCallback((e: GestureResponderEvent) => {
    const touch = e.nativeEvent;
    const fingerCount = (touch as unknown as { touches?: unknown[] }).touches?.length ?? 1;
    const x = touch.locationX ?? stageSize.current.w * (0.2 + 0.6 * Math.random());
    const y = touch.locationY ?? stageSize.current.h * 0.5;
    doTap(x, y, fingerCount);
  }, [doTap]);

  const onPressIn = useCallback(() => { holdDown.current = true; }, []);
  const onPressOut = useCallback(() => { holdDown.current = false; }, []);

  const vehicleTranslateY = useMemo(() =>
    Animated.add(
      vehicleBounce.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, -18, 0],
      }),
      vehicleIdle.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, -6, 0],
      }),
    ), [vehicleBounce, vehicleIdle]);

  const vehicleScale = useMemo(() =>
    vehicleBounce.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 1.08, 1],
    }), [vehicleBounce]);

  const vehicleRotate = useMemo(() =>
    vehicleIdle.interpolate({
      inputRange: [0, 0.25, 0.5, 0.75, 1],
      outputRange: ['-2deg', '0deg', '2deg', '0deg', '-2deg'],
    }), [vehicleIdle]);

  return (
    <View
      style={styles.stage}
      onLayout={(e) => {
        stageSize.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => false}
      onResponderGrant={(e) => {
        onPressIn();
        onTouchStart(e);
      }}
      onResponderRelease={onPressOut}
      onResponderTerminate={onPressOut}
      testID="musicbox-stage"
    >
      <ScrollingWorld scrollX={scrollX} scene={scene} />

      <VehicleSprite
        scene={scene}
        translateY={vehicleTranslateY}
        scale={vehicleScale}
        rotate={vehicleRotate}
      />

      {spawns.map((s) => (
        <SpawnedObject key={s.id} entry={s} scrollX={scrollX} onTapSpawn={onTapSpawn} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 12,
    margin: 4,
    backgroundColor: '#1B1440',
  },
});
