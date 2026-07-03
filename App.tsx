import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DiffGame } from './src/games/diff/DiffGame';
import { HiddenGame } from './src/games/hidden/HiddenGame';
import { SpotItGame } from './src/games/spotit/SpotItGame';
import { colors, shadows } from './src/theme';

type Screen = 'menu' | 'spotit' | 'diff' | 'hidden';

const GAMES: { key: Screen; emoji: string; title: string; blurb: string; color: string }[] = [
  { key: 'spotit', emoji: '👀', title: 'Spot It!', blurb: 'Find the matching picture on both cards', color: colors.primary },
  { key: 'diff', emoji: '🔍', title: 'Find the Difference', blurb: 'What changed between the two pictures?', color: colors.secondary },
  { key: 'hidden', emoji: '🕵️', title: 'Hidden Objects', blurb: 'Hunt for the secret things in the scene', color: colors.purple },
];

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const goHome = () => setScreen('menu');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {screen === 'menu' && (
        <ScrollView contentContainerStyle={styles.menu}>
          <Text style={styles.logo}>🎪</Text>
          <Text style={styles.heading}>Kids Game Box</Text>
          <Text style={styles.tagline}>Pick a game!</Text>
          <View style={styles.cards}>
            {GAMES.map((g) => (
              <Pressable
                key={g.key}
                onPress={() => setScreen(g.key)}
                testID={`menu-${g.key}`}
                style={({ pressed }) => [
                  styles.gameCard,
                  shadows.card,
                  { borderColor: g.color },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.gameEmoji}>{g.emoji}</Text>
                <View style={styles.gameTextWrap}>
                  <Text style={[styles.gameTitle, { color: g.color }]}>{g.title}</Text>
                  <Text style={styles.gameBlurb}>{g.blurb}</Text>
                </View>
                <Text style={styles.go}>▶️</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
      {screen === 'spotit' && <SpotItGame onHome={goHome} />}
      {screen === 'diff' && <DiffGame onHome={goHome} />}
      {screen === 'hidden' && <HiddenGame onHome={goHome} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  menu: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 16 },
  logo: { fontSize: 64 },
  heading: { fontSize: 34, fontWeight: '900', color: colors.text, marginTop: 4 },
  tagline: { fontSize: 18, color: '#8a8794', marginBottom: 24 },
  cards: { gap: 16, width: '100%', maxWidth: 480 },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 3,
    padding: 18,
    gap: 14,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  gameEmoji: { fontSize: 44 },
  gameTextWrap: { flex: 1 },
  gameTitle: { fontSize: 21, fontWeight: '800' },
  gameBlurb: { fontSize: 14, color: '#8a8794', marginTop: 2 },
  go: { fontSize: 22 },
});
