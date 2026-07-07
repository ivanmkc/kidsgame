import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SCENE_IMAGES } from '../../assets/images';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { TimerRing, useElapsed } from '../../components/TimerRing';
import { FilterCycleChip, ScenePicker } from '../../components/ScenePicker';
import { TapScene } from '../../components/TapScene';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty, DifficultyFilter, inFilter, nextSceneId, settingsFor, nextFilter } from '../../difficulty';
import { Lang } from '../../lang';
import { t } from '../../i18n';
import { manifest } from '../../manifest';
import { MP_PLAYERS, ModePicker, PlayerChip, PlayerIx, nextTurn } from '../../multiplayer';
import { makeRng, sample } from '../../rng';
import { sfx, useSay, say } from '../../sound';
import { colors, fonts, shadows } from '../../theme';
import { Find, coopDrawCount, countFor } from './coop';

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

export function HiddenGame({ onHome, difficulty, filter = 'all', onFilter, twoPlayerEnabled, sceneId, onPickScene, onBackToPicker, lang = 'en' }: Props) {
  const visible = manifest.hidden.filter((h) => inFilter(h.level, filter));
  const scene = manifest.hidden.find((h) => h.id === sceneId) ?? null;
  // With the 🎨 All filter, play each scene at ITS OWN badge difficulty —
  // flattening to medium hid the easy-mode hint/no-timer design entirely.
  const effDifficulty = (filter === 'all' && scene?.level) ? scene.level : difficulty;

  // ALL hooks live above the `if (!scene)` early return (repo hard rule).
  const [mode, setMode] = useState<'solo' | '2p' | null>(twoPlayerEnabled ? null : 'solo');
  const coop = mode === '2p';
  const [turn, setTurn] = useState<PlayerIx>(0);
  const [finds, setFinds] = useState<Find[]>([]); // solo stamps by:null
  const [hintId, setHintId] = useState<string | null>(null);
  // Synchronous mirrors: burst multi-touch fires several onPress before any
  // re-render — attribution and turn flow must not read stale state.
  const turnRef = useRef<PlayerIx>(0);
  const findsRef = useRef<Set<string>>(new Set());
  const starterRef = useRef<PlayerIx>(1); // first scene flips this to 0 (Foxy)

  const showTimer = settingsFor(effDifficulty).timer && !coop;

  const drawn = useMemo(
    () => {
      if (!scene) return [];
      const base = settingsFor(effDifficulty).hiddenDraw;
      const n = coop ? coopDrawCount(base, scene.targets.length) : base;
      return sample(makeRng(Math.floor(Math.random() * 1e9)), scene.targets, n);
    },
    [sceneId, coop]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = drawn.length;
  const won = finds.length === total && total > 0;
  const elapsed = useElapsed(showTimer && !!scene && !won, sceneId);

  useEffect(() => {
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
  }, [sceneId]);

  // Team Hunt narration: speak each turn change (identity by voice, zero reading).
  useSay(coop && scene && !won ? `${MP_PLAYERS[turn].name}'s turn!` : null);
  useSay(scene ? (coop ? null : 'Find all the hidden things!') : 'Where do you want to search?');
  useEffect(() => {
    if (won && !coop) say('Super detective! You found everything!');
  }, [won, coop]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gentle auto-hint: 15s with no find → pulse one random unfound target
  // ~2.5s. Resets on find/turn/scene.
  useEffect(() => {
    if (!coop || !scene || won) return;
    setHintId(null);
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => {
      const unfound = drawn.filter((d) => !finds.some((f) => f.id === d.id));
      if (!unfound.length) return;
      const pick = unfound[Math.floor(Math.random() * unfound.length)];
      setHintId(pick.id);
      timers.push(setTimeout(() => setHintId((h) => (h === pick.id ? null : h)), 2500));
    }, 15000));
    return () => timers.forEach(clearTimeout);
  }, [coop, scene, won, drawn, finds, turn]);

  const { width, height } = useWindowDimensions();

  if (!scene) {
    return (
      <GameShell title={t(lang, 'shell.hidden.title')} subtitle={t(lang, 'shell.hidden.subPicker')} onBack={onHome} lang={lang}>
        <ScenePicker
          title={t(lang, 'picker.hidden')}
          lang={lang}
          options={manifest.hidden.map((h) => ({ id: h.id, name: h.name, image: h.image, flagged: h.flagged, level: h.level, dimmed: !inFilter(h.level, filter) }))}
          onPick={(id) => { if (mode !== null) onPickScene(id); }}
          onSurprise={() => { if (mode !== null) onPickScene(visible[Math.floor(Math.random() * visible.length)].id); }}
          filterChip={onFilter ? <FilterCycleChip filter={filter} onCycle={() => onFilter(nextFilter(filter))} lang={lang} /> : undefined}
        />
        {twoPlayerEnabled && mode === null ? <ModePicker onPick={setMode} /> : null}
      </GameShell>
    );
  }

  const boxes = drawn.map((t) => ({ id: t.id, box: t }));
  const ar = scene.w / scene.h;

  // Checklist row (~86px) + header (+ co-op turn banner) — fit the scene into what's left.
  const availH = height - 84 - 122 - (coop ? 56 : 0);
  const sceneWidth = Math.min(width - 24, availH * ar, 1100);

  const foundIds = finds.map((f) => f.id);
  const ringColors = coop
    ? Object.fromEntries(finds.filter((f) => f.by !== null).map((f) => [f.id, MP_PLAYERS[f.by as PlayerIx].color]))
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

  return (
    <GameShell
      title={t(lang, 'shell.hidden.title')}
      subtitle={t(lang, 'shell.hidden.subPlay', { name: scene.name })}
      onBack={onBackToPicker}
      backKind="picker"
      lang={lang}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {coop ? (
            <>
              <PlayerChip player={0} count={countFor(finds, 0)} active={turn === 0 && !won} testID="hidden-player-chip-0" />
              <PlayerChip player={1} count={countFor(finds, 1)} active={turn === 1 && !won} testID="hidden-player-chip-1" />
            </>
          ) : null}
          {showTimer ? <TimerRing elapsed={elapsed} size={44} stroke={5} showLabel testID="hidden-timer" /> : null}
          <ScoreChip label={`🔎 ${finds.length}/${total}`} testID="hidden-score" />
        </View>
      }
    >
      {coop ? <TurnBanner turn={turn} /> : null}
      <View style={styles.checklist} testID="hidden-checklist">
        {drawn.map((t) => {
          const done = foundIds.includes(t.id);
          const finder = coop && done ? finderFor(t.id) : null;
          return (
            <View key={t.id} style={[styles.chip, shadows.soft, done && styles.chipFound]} testID={`checklist-${t.id}`}>
              <Image source={SCENE_IMAGES[t.thumb]} style={styles.chipImg} resizeMode="contain" />
              {done ? (
                <View style={styles.chipCheck}>
                  <Text style={styles.chipCheckText}>✔️</Text>
                </View>
              ) : null}
              {finder !== null ? (
                <View style={[styles.finderBadge, { borderColor: MP_PLAYERS[finder].color }]} testID={`checklist-${t.id}-finder`}>
                  <Text style={styles.finderBadgeText}>{MP_PLAYERS[finder].emoji}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
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
          onMiss={() => {}}
          testIDPrefix="hidden"
        />
      </ScrollView>
      <WinOverlay
        visible={won}
        message={coop ? t(lang, 'win.hiddenCoop') : t(lang, 'win.hidden')}
        onNext={() => onPickScene(nextSceneId(manifest.hidden, visible, scene.id))}
        onHome={onHome}
        lang={lang}
      />
      {twoPlayerEnabled && mode === null ? <ModePicker onPick={setMode} /> : null}
    </GameShell>
  );
}

function TurnBanner({ turn }: { turn: PlayerIx }) {
  const p = MP_PLAYERS[turn];
  const t = useRef(new Animated.Value(1)).current;
  const prev = useRef(turn);
  useEffect(() => {
    if (prev.current === turn) return;
    prev.current = turn;
    t.setValue(0.9);
    Animated.spring(t, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [turn, t]);
  return (
    <Animated.View
      testID="hidden-turn-banner"
      accessibilityLabel={`${p.name}'s turn`}
      style={[styles.banner, shadows.soft, { backgroundColor: p.color, transform: [{ scale: t }] }]}
    >
      <Text style={styles.bannerText}>{p.emoji} {p.name}&apos;s turn!</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 48,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: { fontSize: 22, fontFamily: fonts.display, color: '#FFFFFF' },
  checklist: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
    flexWrap: 'wrap',
  },
  chip: {
    width: 92,
    height: 92,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.card,
    backgroundColor: colors.paper,
    overflow: 'hidden',
    padding: 5,
  },
  chipFound: { borderColor: colors.green },
  chipImg: { width: '100%', height: '100%' },
  chipCheck: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(95,191,110,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCheckText: { fontSize: 24 },
  finderBadge: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finderBadgeText: { fontSize: 12, lineHeight: 15 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 12, paddingHorizontal: 12 },
});
