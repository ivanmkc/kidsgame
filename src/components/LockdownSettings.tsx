import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Lang, LANGS } from '../lang';
import { colors, fonts, shadows } from '../theme';

interface Props {
  hiddenGames: string[];
  hiddenLangs: string[];
  onToggleGame: (id: string) => void;
  onToggleLang: (lang: Lang) => boolean;
  onDone: () => void;
}

interface GameEntry {
  id: string;
  label: string;
}

const GAME_SECTION: { title: string; games: GameEntry[] } [] = [
  {
    title: 'Games',
    games: [
      { id: 'spotit', label: 'Spot It!' },
      { id: 'diff', label: 'Find the Difference' },
      { id: 'hidden', label: 'Hidden Objects' },
      { id: 'memory', label: 'Memory Match' },
      { id: 'puzzle', label: 'Picture Puzzle' },
      { id: 'shadow', label: 'Shadow Match' },
      { id: 'oddone', label: 'Odd One Out' },
      { id: 'rules', label: 'Rule Time!' },
      { id: 'sticker', label: 'Sticker Party' },
      { id: 'story', label: 'Story Path' },
      { id: 'carmode', label: 'Car Mode' },
    ],
  },
  {
    title: 'Word Games',
    games: [
      { id: 'letters', label: 'Letter Hunt' },
      { id: 'sounds', label: 'First Sounds' },
      { id: 'rhyme', label: 'Rhyme Time' },
      { id: 'spell', label: 'Word Builder' },
    ],
  },
  {
    title: 'Number Games',
    games: [
      { id: 'count', label: 'Count With Me' },
      { id: 'numbers', label: 'Number Hunt' },
      { id: 'compare', label: 'More or Less' },
      { id: 'sums', label: 'Little Sums' },
    ],
  },
];

export function LockdownSettings({
  hiddenGames,
  hiddenLangs,
  onToggleGame,
  onToggleLang,
  onDone,
}: Props) {
  const [langWarning, setLangWarning] = useState(false);

  const handleLangToggle = (lang: Lang) => {
    const ok = onToggleLang(lang);
    if (!ok) {
      setLangWarning(true);
      setTimeout(() => setLangWarning(false), 2500);
    }
  };

  const totalHidden = hiddenGames.length + hiddenLangs.length;

  return (
    <View style={styles.backdrop}>
      <View style={styles.panel}>
        <Text style={styles.title}>Parental Controls</Text>
        <Text style={styles.subtitle}>
          Toggle off games or languages to hide them from your child.
        </Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {GAME_SECTION.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.games.map((game) => {
                const hidden = hiddenGames.includes(game.id);
                return (
                  <View key={game.id} style={styles.row}>
                    <Text style={[styles.rowLabel, hidden && styles.rowLabelOff]}>
                      {game.label}
                    </Text>
                    <Switch
                      value={!hidden}
                      onValueChange={() => onToggleGame(game.id)}
                      trackColor={{ false: '#ddd', true: colors.teal }}
                      thumbColor={colors.card}
                      testID={`lock-game-${game.id}`}
                    />
                  </View>
                );
              })}
            </View>
          ))}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Languages</Text>
            {langWarning && (
              <Text style={styles.warning}>
                At least one language must remain visible.
              </Text>
            )}
            {LANGS.map((lang) => {
              const hidden = hiddenLangs.includes(lang.id);
              return (
                <View key={lang.id} style={styles.row}>
                  <Text style={[styles.rowLabel, hidden && styles.rowLabelOff]}>
                    {lang.emoji} {lang.label}
                  </Text>
                  <Switch
                    value={!hidden}
                    onValueChange={() => handleLangToggle(lang.id)}
                    trackColor={{ false: '#ddd', true: colors.teal }}
                    thumbColor={colors.card}
                    testID={`lock-lang-${lang.id}`}
                  />
                </View>
              );
            })}
          </View>
        </ScrollView>

        <Pressable
          onPress={onDone}
          style={styles.doneBtn}
          testID="lockdown-done"
        >
          <Text style={styles.doneText}>
            Done{totalHidden > 0 ? ` (${totalHidden} hidden)` : ''}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  panel: {
    backgroundColor: colors.paper,
    borderRadius: 24,
    padding: 24,
    width: '92%',
    maxWidth: 420,
    maxHeight: '85%',
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fonts.bodyReg,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: 12,
  },
  scroll: {
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 8,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.blush,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  rowLabel: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    flex: 1,
  },
  rowLabelOff: {
    color: colors.inkSoft,
    textDecorationLine: 'line-through',
  },
  warning: {
    fontFamily: fonts.bodyReg,
    fontSize: 13,
    color: colors.red,
    marginBottom: 6,
  },
  doneBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 16,
    backgroundColor: colors.teal,
    minHeight: 44,
    justifyContent: 'center',
    ...shadows.soft,
  },
  doneText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: '#fff',
  },
});
