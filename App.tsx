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
import { SCENE_IMAGES, SPOTIT_ICONS, UI_IMAGES } from './src/assets/images';
import { PlayerPicker } from './src/components/PlayerPicker';
import { TwinkleField } from './src/components/Sparkles';
import { DiffGame } from './src/games/diff/DiffGame';
import { HiddenGame } from './src/games/hidden/HiddenGame';
import { MemoryGame } from './src/games/memory/MemoryGame';
import { OddOneGame } from './src/games/oddone/OddOneGame';
import { ShadowGame } from './src/games/shadow/ShadowGame';
import { PuzzleGame } from './src/games/puzzle/PuzzleGame';
import { SpotItGame } from './src/games/spotit/SpotItGame';
import { manifest } from './src/manifest';
import { routeParts, useRoute } from './src/nav';
import { Player, loadPlayers } from './src/profile';
import { colors, fonts, shadows } from './src/theme';

export default function App() {
  useFonts({
    Baloo2_600SemiBold,
    Baloo2_800ExtraBold,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });
  const [players, setPlayers] = useState<Player[]>(() => loadPlayers());
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [route, navigate] = useRoute();
  const parts = routeParts(route);
  const KNOWN = ['players', 'menu', 'spotit', 'diff', 'hidden', 'memory', 'shadow', 'oddone', 'puzzle'];
  // A stale/mistyped hash must never strand a kid on a blank page.
  const screen = KNOWN.includes(parts.screen) ? parts.screen : 'players';
  const param = parts.param;
  // Deep links / refreshes land past the picker — fall back to the first kid.
  const player = players.find((p) => p.id === playerId) ?? (screen !== 'players' ? players[0] : null);
  const goHome = () => navigate('menu');

  // fontsLoaded intentionally does NOT gate rendering: on slow networks the
  // gate meant a blank screen for many seconds; a brief system-font flash is
  // the better trade for a kids app.
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {screen === 'players' && (
        <AppBackground>
          <TwinkleField count={8} />
          <PlayerPicker
            players={players}
            onChange={setPlayers}
            onPick={(p) => { setPlayerId(p.id); navigate('menu'); }}
          />
        </AppBackground>
      )}
      {screen === 'menu' && (
        <Menu player={player} onNavigate={navigate} onSwitchPlayer={() => navigate('players')} />
      )}
      {screen === 'spotit' && <SpotItGame onHome={goHome} player={player} />}
      {screen === 'diff' && (
        <DiffGame
          onHome={goHome}
          player={player}
          sceneId={param}
          onPickScene={(id) => navigate(`diff/${id}`)}
          onBackToPicker={() => navigate('diff')}
        />
      )}
      {screen === 'hidden' && (
        <HiddenGame
          onHome={goHome}
          player={player}
          sceneId={param}
          onPickScene={(id) => navigate(`hidden/${id}`)}
          onBackToPicker={() => navigate('hidden')}
        />
      )}
      {screen === 'memory' && <MemoryGame onHome={goHome} player={player} />}
      {screen === 'shadow' && <ShadowGame onHome={goHome} player={player} />}
      {screen === 'oddone' && <OddOneGame onHome={goHome} player={player} />}
      {screen === 'puzzle' && (
        <PuzzleGame
          onHome={goHome}
          player={player}
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
  { route: 'oddone', color: '#E8874F', title: 'Odd One Out', blurb: 'Spot the one that is different', preview: 'icons20' },
];

function Menu({
  player, onNavigate, onSwitchPlayer,
}: {
  player: Player | null;
  onNavigate: (r: string) => void;
  onSwitchPlayer: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const cardWidth = isLandscape ? Math.min(430, (Math.min(width, 1100) - 72) / 2) : Math.min(460, width - 32);

  const previewFor = (key: string): React.ReactNode => {
    if (key === 'icons0') return <IconRow from={0} />;
    if (key === 'icons8') return <IconRow from={8} />;
    if (key === 'icons13') return <IconRow from={13} />;
    if (key === 'icons20') return <IconRow from={20} />;
    const scene =
      key === 'diff'
        ? (manifest.diff.find((d) => d.id === 'unicorn') ?? manifest.diff[0])
        : key === 'hidden'
          ? (manifest.hidden.find((h) => h.id === 'ballroom') ?? manifest.hidden[0])
          : (manifest.diff.find((d) => d.id === 'princess') ?? manifest.diff[0]);
    if (!scene) return null;
    const src = 'imageA' in scene ? SCENE_IMAGES[(scene as { imageA: string }).imageA] : SCENE_IMAGES[(scene as { image: string }).image];
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
              {player ? (
                <Pressable onPress={onSwitchPlayer} testID="switch-player" style={styles.playerRow}>
                  <Image source={SPOTIT_ICONS[player.avatar]} style={styles.playerAvatar} />
                  <Text style={styles.tagline}>Have fun, {player.name}!  (switch)</Text>
                </Pressable>
              ) : (
                <Text style={styles.tagline}>Pick a game!</Text>
              )}
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
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerAvatar: { width: 26, height: 26 },
  tagline: { fontSize: 16, fontFamily: fonts.bodyReg, color: colors.inkSoft },
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
