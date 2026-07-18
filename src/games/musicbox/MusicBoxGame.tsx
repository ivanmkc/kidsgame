import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GameShell } from '../../components/GameShell';
import { WinOverlay } from '../../components/WinOverlay';
import { Lang } from '../../lang';
import { t, UIKey } from '../../i18n';
import { say } from '../../sound';
import { playNote, primeMusic } from '../../music';
import { useWinLine } from '../winlines';
import { colors, fonts, shadows } from '../../theme';
import { SONGS } from './songs';
import { BoxState, advance, beatsForTap, isComplete, noteForTap, progress, songById, startState } from './logic';

// Sago-Mini-style music box: EVERY tap plays the next note of the song, so
// the melody can't go wrong and the kid owns the tempo. Free play ("magic
// keys") rambles a pentatonic scale — nothing to finish, pure noodling.

interface Props {
  onHome: () => void;
  sceneId?: string;
  onPickScene: (id: string) => void;
  onBackToPicker: () => void;
  lang: Lang;
}

const BUDDIES = ['🐰', '🐻', '🦊'];
const GLYPHS = ['🎵', '🎶', '♪', '♫'];
// Pastel sky ramp — index by song progress so the stage warms as the tune
// nears its finale (discrete per tap is plenty smooth for this).
const SKY = ['#DFF1FA', '#E3EEFB', '#EDE7F8', '#F8E7F1', '#FBE9DC', '#FDF3D8'];

export function MusicBoxGame({ onHome, sceneId, onPickScene, onBackToPicker, lang }: Props) {
  const song = songById(sceneId === 'freeplay' ? undefined : sceneId);
  const isFree = sceneId === 'freeplay';
  const [state, setState] = useState<BoxState>(() => startState(isFree ? null : song));
  const [glyphs, setGlyphs] = useState<Array<{ id: number; x: number; y: number; glyph: string; big: boolean }>>([]);
  const nextGlyph = useRef(1);
  const bounces = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const stageSize = useRef({ w: 1, h: 1 });
  const done = isComplete(state);

  // Reset the walk when the kid switches songs (or replays).
  useEffect(() => {
    setState(startState(isFree ? null : song));
    setGlyphs([]);
  }, [sceneId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Spoken invitation — the whole game is one repeated gesture, so one
  // line of instruction is all a 3-year-old needs.
  useEffect(() => {
    if (sceneId) say(t(lang, isFree ? 'musicbox.introFree' : 'musicbox.intro'));
  }, [sceneId]); // eslint-disable-line react-hooks/exhaustive-deps

  useWinLine(done, t(lang, 'win.musicbox'));

  const onTap = (e: { nativeEvent: { locationX?: number; locationY?: number; pageX?: number; pageY?: number } }) => {
    if (done) return;
    primeMusic();
    playNote(noteForTap(state));
    const big = beatsForTap(state) > 1;
    setState(advance(state));
    // Float a note glyph from the tap point (best-effort coords — RNW
    // supplies locationX; anything missing lands mid-stage, still charming).
    const x = e.nativeEvent.locationX ?? stageSize.current.w * (0.2 + 0.6 * Math.random());
    const y = e.nativeEvent.locationY ?? stageSize.current.h * 0.5;
    const id = nextGlyph.current++;
    setGlyphs((g) => [...g.slice(-14), { id, x, y, glyph: GLYPHS[id % GLYPHS.length], big }]);
    // Bounce the buddy nearest the tap column.
    const lane = Math.min(2, Math.max(0, Math.floor((x / Math.max(1, stageSize.current.w)) * 3)));
    const b = bounces[lane];
    b.setValue(0);
    Animated.spring(b, { toValue: 1, friction: 3, useNativeDriver: true }).start(() => b.setValue(0));
  };

  const pct = progress(state);
  const sky = SKY[Math.min(SKY.length - 1, Math.floor(pct * SKY.length))];
  const stars = useMemo(() => Math.round(pct * 10), [pct]);

  if (!sceneId) {
    return (
      <GameShell title={t(lang, 'shell.musicbox.title')} subtitle={t(lang, 'shell.musicbox.subPicker')} onBack={onHome} lang={lang}>
        <ScrollView contentContainerStyle={styles.pickerWrap}>
          <View style={styles.grid}>
            <SongCard emoji="🪄" label={t(lang, 'musicbox.freeplay')} onPress={() => onPickScene('freeplay')} testID="scene-pick-freeplay" />
            {SONGS.map((s) => (
              <SongCard key={s.id} emoji={s.emoji} label={t(lang, `song.${s.id}` as UIKey)} onPress={() => onPickScene(s.id)} testID={`scene-pick-${s.id}`} />
            ))}
          </View>
        </ScrollView>
      </GameShell>
    );
  }

  return (
    <GameShell
      title={isFree ? t(lang, 'musicbox.freeplay') : t(lang, `song.${song?.id ?? 'twinkle'}` as UIKey)}
      subtitle={t(lang, 'shell.musicbox.subPlay')}
      onBack={onBackToPicker}
      backKind="picker"
      lang={lang}
    >
      <Pressable
        style={[styles.stage, { backgroundColor: sky }]}
        onLayout={(e) => { stageSize.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; }}
        onPressIn={onTap}
        testID="musicbox-stage"
      >
        {!isFree ? (
          <View style={styles.starRow} pointerEvents="none">
            {Array.from({ length: 10 }, (_, i) => (
              <Text key={i} style={[styles.star, i >= stars && styles.starOff]}>⭐</Text>
            ))}
          </View>
        ) : null}
        {glyphs.map((g) => (
          <FloatingNote key={g.id} x={g.x} y={g.y} glyph={g.glyph} big={g.big} />
        ))}
        <View style={styles.buddies} pointerEvents="none">
          {BUDDIES.map((b, i) => (
            <Animated.Text
              key={b}
              style={[styles.buddy, {
                transform: [
                  { translateY: bounces[i].interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -34, 0] }) },
                  { scale: bounces[i].interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.18, 1] }) },
                ],
              }]}
            >
              {b}
            </Animated.Text>
          ))}
        </View>
      </Pressable>
      <WinOverlay
        visible={done}
        message={t(lang, 'win.musicbox')}
        onNext={() => {
          const i = SONGS.findIndex((s) => s.id === sceneId);
          onPickScene(SONGS[(i + 1) % SONGS.length].id);
        }}
        onHome={onBackToPicker}
        lang={lang}
      />
    </GameShell>
  );
}

function SongCard({ emoji, label, onPress, testID }: { emoji: string; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} testID={testID} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [styles.card, shadows.sticker, pressed && styles.pressed]}>
      <Text style={styles.cardEmoji}>{emoji}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </Pressable>
  );
}

function FloatingNote({ x, y, glyph, big }: { x: number; y: number; glyph: string; big: boolean }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 1100, useNativeDriver: true }).start();
  }, [a]);
  return (
    <Animated.Text
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 16,
        top: y - 16,
        fontSize: big ? 46 : 32,
        opacity: a.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
        transform: [
          { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -110] }) },
          { rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '14deg'] }) },
        ],
      }}
    >
      {glyph}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  pickerWrap: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, maxWidth: 640 },
  card: {
    width: 190,
    borderRadius: 20,
    backgroundColor: colors.paper,
    borderWidth: 3,
    borderColor: colors.card,
    alignItems: 'center',
    paddingVertical: 18,
    gap: 6,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  cardEmoji: { fontSize: 52 },
  cardLabel: { fontFamily: fonts.displayMed, fontSize: 16, color: colors.ink, textAlign: 'center', paddingHorizontal: 8 },
  stage: { flex: 1, margin: 12, borderRadius: 24, overflow: 'hidden' },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 2, paddingTop: 10 },
  star: { fontSize: 20 },
  starOff: { opacity: 0.22 },
  buddies: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  buddy: { fontSize: 64 },
});
