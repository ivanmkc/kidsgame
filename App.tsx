import { Baloo2_600SemiBold, Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2';
import { Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SCENE_THUMBS, SCENE_IMAGES, SPOTIT_ICONS, SPOTIT_SHADOWS, UI_IMAGES } from './src/assets/images';
import { TwinkleField } from './src/components/Sparkles';
import { DiffGame } from './src/games/diff/DiffGame';
import { HiddenGame } from './src/games/hidden/HiddenGame';
import { MemoryGame } from './src/games/memory/MemoryGame';
import { OddOneGame } from './src/games/oddone/OddOneGame';
import { ShadowGame } from './src/games/shadow/ShadowGame';
import { PuzzleGame } from './src/games/puzzle/PuzzleGame';
import { StickerGame } from './src/games/sticker/StickerGame';
import { StoryGame } from './src/games/story/StoryGame';
import { RulesGame } from './src/games/rules/RulesGame';
import { SpotItGame } from './src/games/spotit/SpotItGame';
import { DiffScene, baseImage, manifest } from './src/manifest';
import { DifficultyFilter, FILTERS, difficultyOf, loadFilter, saveFilter } from './src/difficulty';
import { isMuted, setMuted, sfx } from './src/sound';
import { routeParts, useRoute } from './src/nav';
import { colors, fonts, shadows } from './src/theme';

export default function App() {
  useFonts({
    Baloo2_600SemiBold,
    Baloo2_800ExtraBold,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });
  const [filter, setFilter] = useState<DifficultyFilter>(() => loadFilter());
  const difficulty = difficultyOf(filter);
  const [route, navigate] = useRoute();
  const parts = routeParts(route);
  const KNOWN = ['menu', 'spotit', 'diff', 'hidden', 'memory', 'shadow', 'oddone', 'rules', 'puzzle', 'sticker', 'story'];
  // A stale/mistyped hash must never strand a kid on a blank page.
  const screen = KNOWN.includes(parts.screen) ? parts.screen : 'menu';
  const param = parts.param;
  const goHome = () => navigate('menu');
  const pickFilter = (f: DifficultyFilter) => { setFilter(f); saveFilter(f); sfx.tap(); };

  // fontsLoaded intentionally does NOT gate rendering: on slow networks the
  // gate meant a blank screen for many seconds; a brief system-font flash is
  // the better trade for a kids app.
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {screen === 'menu' && (
        <Menu filter={filter} onPickFilter={pickFilter} onNavigate={navigate} />
      )}
      {screen === 'spotit' && <SpotItGame onHome={goHome} difficulty={difficulty} />}
      {screen === 'diff' && (
        <DiffGame
          onHome={goHome}
          difficulty={difficulty}
          filter={filter}
          sceneId={param}
          onPickScene={(id) => navigate(`diff/${id}`)}
          onBackToPicker={() => navigate('diff')}
        />
      )}
      {screen === 'hidden' && (
        <HiddenGame
          onHome={goHome}
          difficulty={difficulty}
          filter={filter}
          sceneId={param}
          onPickScene={(id) => navigate(`hidden/${id}`)}
          onBackToPicker={() => navigate('hidden')}
        />
      )}
      {screen === 'sticker' && (
        <StickerGame
          onHome={goHome}
          sceneId={param}
          onPickScene={(id) => navigate(`sticker/${id}`)}
          onBackToPicker={() => navigate('sticker')}
        />
      )}
      {screen === 'story' && (
        <StoryGame
          onHome={goHome}
          sceneId={param}
          onPickScene={(id) => navigate(`story/${id}`)}
          onBackToPicker={() => navigate('story')}
        />
      )}
      {screen === 'memory' && <MemoryGame onHome={goHome} difficulty={difficulty} />}
      {screen === 'shadow' && <ShadowGame onHome={goHome} difficulty={difficulty} />}
      {screen === 'oddone' && <OddOneGame onHome={goHome} difficulty={difficulty} />}
      {screen === 'rules' && <RulesGame onHome={goHome} difficulty={difficulty} />}
      {screen === 'puzzle' && (
        <PuzzleGame
          onHome={goHome}
          difficulty={difficulty}
          filter={filter}
          sceneId={param}
          onPickScene={(id) => navigate(`puzzle/${id}`)}
          onBackToPicker={() => navigate('puzzle')}
        />
      )}
    </SafeAreaView>
  );
}

const GAME_CARDS = [
  { route: 'spotit', color: colors.red, title: 'Spot It!', blurb: 'Find the matching picture on both cards', preview: 'icons0' },
  { route: 'diff', color: colors.teal, title: 'Find the Difference', blurb: 'What changed between the two pictures?', preview: 'diff' },
  { route: 'hidden', color: colors.purple, title: 'Hidden Objects', blurb: 'Hunt for the secret things in the scene', preview: 'hidden' },
  { route: 'memory', color: colors.green, title: 'Memory Match', blurb: 'Flip the cards and find the pairs', preview: 'icons8' },
  { route: 'puzzle', color: colors.gold, title: 'Picture Puzzle', blurb: 'Put the mixed-up picture back together', preview: 'puzzle' },
  { route: 'shadow', color: colors.ink, title: 'Shadow Match', blurb: 'Whose shadow is that? Match it!', preview: 'icons13' },
  { route: 'oddone', color: '#E8874F', title: 'Odd One Out', blurb: 'Which one does not belong?', preview: 'icons20' },
  { route: 'rules', color: '#3E9BB8', title: 'Rule Time!', blurb: 'Follow the rule — tap the right ones!', preview: 'rules' },
  { route: 'sticker', color: '#D66FA8', title: 'Sticker Party', blurb: 'Decorate scenes with silly stickers!', preview: 'icons0' },
  { route: 'story', color: '#7A6FD6', title: 'Story Path', blurb: 'Pick what happens next in the tale!', preview: 'story' },
];

function Menu({
  filter, onPickFilter, onNavigate,
}: {
  filter: DifficultyFilter;
  onPickFilter: (f: DifficultyFilter) => void;
  onNavigate: (r: string) => void;
}) {
  const [muted, setMutedState] = React.useState(isMuted());
  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    setMutedState(m);
    if (!m) sfx.good();
  };
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const cardWidth = isLandscape ? Math.min(430, (Math.min(width, 1100) - 72) / 2) : Math.min(460, width - 32);

  const previewFor = (key: string): React.ReactNode => {
    if (key === 'icons0') return <SpotItPreview />;
    if (key === 'icons8') return <MemoryPreview />;
    if (key === 'icons13') return <ShadowPreview />;
    if (key === 'icons20') return <OddOnePreview />;
    if (key === 'rules') return <RulesPreview />;

    const scene =
      key === 'diff'
        ? (manifest.diff.find((d) => d.id === 'unicorn') ?? manifest.diff[0])
        : key === 'hidden'
          ? (manifest.hidden.find((h) => h.id === 'ballroom') ?? manifest.hidden[0])
          : (manifest.diff.find((d) => d.id === 'princess') ?? manifest.diff[0]);
    if (!scene) return null;
    const imgKey = key === 'story' ? manifest.stories?.[0]?.nodes.start.image : baseImage(scene as DiffScene) ?? (scene as { image?: string }).image;
    if (!imgKey) return null;
    const src = SCENE_THUMBS[imgKey] ?? SCENE_IMAGES[imgKey];
    return <Image source={src} style={styles.preview} />;
  };

  return (
    <AppBackground>
      <TwinkleField count={9} />
      <ScrollView contentContainerStyle={styles.menu}>
        <Reveal delay={0}>
          <View style={styles.headerRow}>
            <BobbingLogo small={isLandscape} />
            <View style={{ alignItems: isLandscape ? 'flex-start' : 'center' }}>
              <Text style={styles.heading}>Kids Game Box</Text>
              <View style={styles.diffRow}>
                {FILTERS.map((f) => {
                  const on = filter === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => onPickFilter(f.id)}
                      testID={`difficulty-${f.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${f.label} levels`}
                      style={[styles.diffChip, on && styles.diffChipOn]}
                    >
                      <Text style={[styles.diffText, on && styles.diffTextOn]}>
                        {f.emoji} {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={toggleMute}
                  testID="sound-toggle"
                  accessibilityRole="button"
                  accessibilityLabel={muted ? 'Turn sound on' : 'Turn sound off'}
                  style={[styles.diffChip, styles.soundChip]}
                >
                  <Text style={styles.diffText}>{muted ? '🔇' : '🔊'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Reveal>
        <View style={[styles.cards, { maxWidth: isLandscape ? 1100 : 460 }]}>
          {GAME_CARDS.map((g, i) => (
            <Reveal key={g.route} delay={120 + i * 80}>
              <GameCard
                color={g.color}
                title={g.title}
                blurb={g.blurb}
                onPress={() => onNavigate(g.route)}
                testID={`menu-${g.route}`}
                preview={previewFor(g.preview)}
                width={cardWidth}
              />
            </Reveal>
          ))}
        </View>
      </ScrollView>
    </AppBackground>
  );
}

// Full-bleed background that actually covers any viewport: an explicit
// absolute-fill <Image>, because rn-web sizes ImageBackground's inner image
// at its intrinsic 768px and leaves a hard seam on wide screens.
function AppBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bg}>
      <Image
        source={UI_IMAGES.menu_bg}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        resizeMode="cover"
      />
      {children}
    </View>
  );
}

function BobbingLogo({ small }: { small: boolean }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <Animated.View
      style={{
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] }) },
        ],
      }}
    >
      <Image source={UI_IMAGES.logo} style={small ? styles.logoSmall : styles.logo} resizeMode="contain" />
    </Animated.View>
  );
}

function IconRow({ from }: { from: number }) {
  const names = manifest.spotit.icons.slice(from, from + 5);
  return (
    <View style={styles.iconRow}>
      {names.map((n) => (
        <Image key={n} source={SPOTIT_ICONS[n]} style={styles.iconRowImg} />
      ))}
    </View>
  );
}

// Spot It preview: two overlapping mini "cards" sharing one icon
function SpotItPreview() {
  const icons = manifest.spotit.icons;
  return (
    <View style={[styles.iconRow, { backgroundColor: 'rgba(232,86,79,0.08)' }]}>
      <View style={[styles.miniCard, { borderColor: colors.teal, transform: [{ rotate: '-6deg' }] }]}>
        <Image source={SPOTIT_ICONS[icons[0]]} style={styles.miniIcon} />
        <Image source={SPOTIT_ICONS[icons[4]]} style={styles.miniIcon} />
      </View>
      <View style={[styles.miniCard, { borderColor: colors.red, transform: [{ rotate: '5deg' }] }]}>
        <Image source={SPOTIT_ICONS[icons[4]]} style={styles.miniIcon} />
        <Image source={SPOTIT_ICONS[icons[9]]} style={styles.miniIcon} />
      </View>
    </View>
  );
}

// Memory preview: face-down card backs with one flipped pair
function MemoryPreview() {
  return (
    <View style={[styles.iconRow, { backgroundColor: 'rgba(95,191,110,0.08)' }]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.miniBack, i === 2 && styles.miniBackUp]}>
          {i === 2 ? (
            <Image source={SPOTIT_ICONS[manifest.spotit.icons[8]]} style={{ width: '80%', height: '80%' }} resizeMode="contain" />
          ) : (
            <Text style={{ fontSize: 22 }}>❓</Text>
          )}
        </View>
      ))}
    </View>
  );
}

// Shadow preview: a mystery silhouette tile, an equals hint, and the answer
function ShadowPreview() {
  const n = manifest.spotit.icons[10]; // unicorn
  return (
    <View style={[styles.iconRow, { backgroundColor: 'rgba(155,126,222,0.12)' }]}>
      <View style={[styles.previewTile, { borderColor: colors.purple, backgroundColor: '#EFE8F7' }]}>
        <Image source={SPOTIT_SHADOWS[n] ?? SPOTIT_ICONS[n]} style={styles.previewTileImg} />
      </View>
      <Text style={{ fontSize: 26, fontFamily: fonts.display, color: colors.purple }}>=</Text>
      <View style={[styles.previewTile, { borderColor: colors.gold }]}>
        <Image source={SPOTIT_ICONS[n]} style={styles.previewTileImg} />
      </View>
      <View style={[styles.previewTile, { borderColor: colors.blush }]}>
        <Image source={SPOTIT_ICONS[manifest.spotit.icons[4]]} style={styles.previewTileImg} />
      </View>
    </View>
  );
}

// Rule Time preview: a mini rule banner over tiles
function RulesPreview() {
  const icons = manifest.spotit.icons;
  return (
    <View style={[styles.iconRow, { backgroundColor: 'rgba(62,155,184,0.10)', flexDirection: 'column', gap: 6 }]}>
      <View style={styles.miniRule}><Text style={styles.miniRuleText}>Tap all the ANIMALS! 🐾</Text></View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[0, 18, 3, 24].map((idx, i) => (
          <View key={i} style={[styles.previewTile, { width: 46, height: 46, borderColor: [0, 3].includes(idx) ? colors.green : colors.blush }]}>
            <Image source={SPOTIT_ICONS[icons[idx]]} style={styles.previewTileImg} />
          </View>
        ))}
      </View>
    </View>
  );
}

// Odd One Out preview: proper game tiles, the odd one popped in gold
function OddOnePreview() {
  const icons = manifest.spotit.icons;
  return (
    <View style={[styles.iconRow, { backgroundColor: 'rgba(232,135,79,0.10)' }]}>
      {[0, 0, 22, 0].map((idx, i) => (
        <View
          key={i}
          style={[
            styles.previewTile,
            { borderColor: idx === 22 ? colors.gold : colors.blush },
            idx === 22 && { transform: [{ rotate: '-4deg' }, { scale: 1.08 }] },
          ]}
        >
          <Image source={SPOTIT_ICONS[icons[idx]]} style={styles.previewTileImg} />
        </View>
      ))}
    </View>
  );
}

function GameCard({
  color, title, blurb, preview, onPress, testID, width,
}: {
  color: string;
  title: string;
  blurb: string;
  preview: React.ReactNode;
  onPress: () => void;
  testID: string;
  width: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.gameCard, shadows.sticker, { borderColor: color, width }, pressed && styles.pressed]}
    >
      <View style={styles.previewWrap}>{preview}</View>
      <View style={styles.cardBody}>
        <Text style={[styles.gameTitle, { color }]}>{title}</Text>
        <Text style={styles.gameBlurb}>{blurb}</Text>
      </View>
      <View style={[styles.playBadge, { backgroundColor: color }]}>
        <Text style={styles.playBadgeText}>PLAY</Text>
      </View>
    </Pressable>
  );
}

function Reveal({ delay, children }: { delay: number; children: React.ReactNode }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(t, { toValue: 1, useNativeDriver: true, friction: 7, delay }).start();
  }, [t, delay]);
  return (
    <Animated.View
      style={{
        opacity: t,
        transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // overflow hidden clips the rn-web background IMG that otherwise renders
  // at its intrinsic width and forces horizontal scroll on small phones
  safe: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  bg: { flex: 1, overflow: 'hidden' },
  menu: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    flexWrap: 'wrap',
  },
  logo: { width: 104, height: 104 },
  logoSmall: { width: 72, height: 72 },
  heading: { fontSize: 36, fontFamily: fonts.display, color: colors.ink },
  diffRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  diffChip: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  soundChip: { paddingHorizontal: 10 },
  diffChipOn: { backgroundColor: colors.gold },
  diffText: { fontSize: 14, fontFamily: fonts.body, color: colors.inkSoft },
  diffTextOn: { color: colors.ink },
  cards: {
    gap: 16,
    width: '100%',
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  gameCard: {
    backgroundColor: colors.paper,
    borderRadius: 26,
    borderWidth: 4,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  previewWrap: { height: 104, backgroundColor: colors.blush },
  preview: { width: '100%', height: '100%' },
  iconRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.paper,
  },
  iconRowImg: { width: '16%', aspectRatio: 1, maxWidth: 58 },
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  miniIcon: { width: 34, height: 34 },
  miniBack: {
    width: 44,
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  miniBackUp: { backgroundColor: colors.card, borderColor: colors.green },
  previewTile: {
    width: 58,
    height: 58,
    borderRadius: 14,
    borderWidth: 3,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B8905F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },
  previewTileImg: { width: '76%', height: '76%', resizeMode: 'contain' } as object,
  miniRule: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  miniRuleText: { fontFamily: fonts.display, fontSize: 12, color: colors.ink },
  cardBody: { paddingHorizontal: 18, paddingVertical: 12, paddingRight: 86 },
  gameTitle: { fontSize: 22, fontFamily: fonts.display },
  gameBlurb: { fontSize: 13, fontFamily: fonts.bodyReg, color: colors.inkSoft, marginTop: 1 },
  playBadge: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  playBadgeText: { color: '#fff', fontFamily: fonts.display, fontSize: 15, letterSpacing: 1 },
});
