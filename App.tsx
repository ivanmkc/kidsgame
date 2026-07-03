import { Baloo2_600SemiBold, Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2';
import { Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ImageBackground,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SCENE_IMAGES, SPOTIT_ICONS, UI_IMAGES } from './src/assets/images';
import { PlayerPicker } from './src/components/PlayerPicker';
import { DiffGame } from './src/games/diff/DiffGame';
import { HiddenGame } from './src/games/hidden/HiddenGame';
import { MemoryGame } from './src/games/memory/MemoryGame';
import { PuzzleGame } from './src/games/puzzle/PuzzleGame';
import { SpotItGame } from './src/games/spotit/SpotItGame';
import { manifest } from './src/manifest';
import { Player, loadPlayers } from './src/profile';
import { colors, fonts, shadows } from './src/theme';

type Screen = 'players' | 'menu' | 'spotit' | 'diff' | 'hidden' | 'memory' | 'puzzle';

export default function App() {
  const [fontsLoaded] = useFonts({
    Baloo2_600SemiBold,
    Baloo2_800ExtraBold,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });
  const [players, setPlayers] = useState<Player[]>(() => loadPlayers());
  const [player, setPlayer] = useState<Player | null>(null);
  const [screen, setScreen] = useState<Screen>('players');
  const goHome = () => setScreen('menu');

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {screen === 'players' && (
        <ImageBackground source={UI_IMAGES.menu_bg} style={styles.bg} resizeMode="cover">
          <PlayerPicker
            players={players}
            onChange={setPlayers}
            onPick={(p) => { setPlayer(p); setScreen('menu'); }}
          />
        </ImageBackground>
      )}
      {screen === 'menu' && (
        <Menu player={player} onPick={setScreen} onSwitchPlayer={() => setScreen('players')} />
      )}
      {screen === 'spotit' && <SpotItGame onHome={goHome} playerName={player?.name} />}
      {screen === 'diff' && <DiffGame onHome={goHome} playerName={player?.name} />}
      {screen === 'hidden' && <HiddenGame onHome={goHome} playerName={player?.name} />}
      {screen === 'memory' && <MemoryGame onHome={goHome} playerName={player?.name} />}
      {screen === 'puzzle' && <PuzzleGame onHome={goHome} playerName={player?.name} />}
    </SafeAreaView>
  );
}

function Menu({
  player, onPick, onSwitchPlayer,
}: {
  player: Player | null;
  onPick: (s: Screen) => void;
  onSwitchPlayer: () => void;
}) {
  const diffPreview = manifest.diff.find((d) => d.id === 'unicorn') ?? manifest.diff[0];
  const hiddenPreview = manifest.hidden.find((h) => h.id === 'ballroom') ?? manifest.hidden[0];
  const puzzlePreview = manifest.diff.find((d) => d.id === 'princess') ?? manifest.diff[1] ?? manifest.diff[0];

  return (
    <ImageBackground source={UI_IMAGES.menu_bg} style={styles.bg} resizeMode="cover">
      <ScrollView contentContainerStyle={styles.menu}>
        <Reveal delay={0}>
          <Image source={UI_IMAGES.logo} style={styles.logo} resizeMode="contain" />
        </Reveal>
        <Reveal delay={70}>
          <Text style={styles.heading}>Kids Game Box</Text>
          {player ? (
            <Pressable onPress={onSwitchPlayer} testID="switch-player" style={styles.playerRow}>
              <Image source={SPOTIT_ICONS[player.avatar]} style={styles.playerAvatar} />
              <Text style={styles.tagline}>Have fun, {player.name}!  (switch)</Text>
            </Pressable>
          ) : (
            <Text style={styles.tagline}>Pick a game!</Text>
          )}
        </Reveal>
        <View style={styles.cards}>
          <Reveal delay={140}>
            <GameCard
              color={colors.red}
              title="Spot It!"
              blurb="Find the matching picture on both cards"
              onPress={() => onPick('spotit')}
              testID="menu-spotit"
              preview={<IconRow from={0} />}
            />
          </Reveal>
          <Reveal delay={220}>
            <GameCard
              color={colors.teal}
              title="Find the Difference"
              blurb="What changed between the two pictures?"
              onPress={() => onPick('diff')}
              testID="menu-diff"
              preview={diffPreview ? <Image source={SCENE_IMAGES[diffPreview.imageA]} style={styles.preview} /> : null}
            />
          </Reveal>
          <Reveal delay={300}>
            <GameCard
              color={colors.purple}
              title="Hidden Objects"
              blurb="Hunt for the secret things in the scene"
              onPress={() => onPick('hidden')}
              testID="menu-hidden"
              preview={hiddenPreview ? <Image source={SCENE_IMAGES[hiddenPreview.image]} style={styles.preview} /> : null}
            />
          </Reveal>
          <Reveal delay={380}>
            <GameCard
              color={colors.green}
              title="Memory Match"
              blurb="Flip the cards and find the pairs"
              onPress={() => onPick('memory')}
              testID="menu-memory"
              preview={<IconRow from={8} />}
            />
          </Reveal>
          <Reveal delay={460}>
            <GameCard
              color={colors.gold}
              title="Picture Puzzle"
              blurb="Put the mixed-up picture back together"
              onPress={() => onPick('puzzle')}
              testID="menu-puzzle"
              preview={puzzlePreview ? <Image source={SCENE_IMAGES[puzzlePreview.imageA]} style={styles.preview} /> : null}
            />
          </Reveal>
        </View>
      </ScrollView>
    </ImageBackground>
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
  color, title, blurb, preview, onPress, testID,
}: {
  color: string;
  title: string;
  blurb: string;
  preview: React.ReactNode;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.gameCard, shadows.sticker, { borderColor: color }, pressed && styles.pressed]}
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
        width: '100%',
        alignItems: 'center',
      }}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  bg: { flex: 1 },
  menu: { alignItems: 'center', paddingVertical: 26, paddingHorizontal: 16 },
  logo: { width: 120, height: 120 },
  heading: { fontSize: 38, fontFamily: fonts.display, color: colors.ink, textAlign: 'center' },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 16 },
  playerAvatar: { width: 30, height: 30 },
  tagline: {
    fontSize: 17,
    fontFamily: fonts.bodyReg,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  cards: { gap: 18, width: '100%', maxWidth: 460, alignItems: 'stretch', marginTop: 14 },
  gameCard: {
    backgroundColor: colors.paper,
    borderRadius: 26,
    borderWidth: 4,
    overflow: 'hidden',
    width: '100%',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  previewWrap: { height: 110, backgroundColor: colors.blush },
  preview: { width: '100%', height: '100%' },
  iconRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.paper,
  },
  iconRowImg: { width: 62, height: 62 },
  cardBody: { paddingHorizontal: 18, paddingVertical: 12, paddingRight: 86 },
  gameTitle: { fontSize: 23, fontFamily: fonts.display },
  gameBlurb: { fontSize: 14, fontFamily: fonts.bodyReg, color: colors.inkSoft, marginTop: 1 },
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
