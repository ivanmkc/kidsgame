import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GameShell } from '../../components/GameShell';
import { Lang } from '../../lang';
import { t, UIKey } from '../../i18n';
import { say } from '../../sound';
import { colors, fonts, shadows } from '../../theme';
import { SCENES, sceneById } from './scenes';
import { JourneyScene } from './JourneyScene';

// Sago-Mini-style music box v2: a horizontally-scrolling journey where every
// tap plays the next melody note, scrolls the world, and spawns a visual
// object. No progress bar, no win state — the melody and landscape loop
// seamlessly. The kid owns the tempo and fills the world with art.

interface Props {
  onHome: () => void;
  sceneId?: string;
  onPickScene: (id: string) => void;
  onBackToPicker: () => void;
  lang: Lang;
}

export function MusicBoxGame({ onHome, sceneId, onPickScene, onBackToPicker, lang }: Props) {
  const scene = sceneId ? sceneById(sceneId) : undefined;

  useEffect(() => {
    if (scene) say(t(lang, 'musicbox.intro'));
  }, [scene?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Character picker: big tappable characters, no text (toddler-friendly).
  if (!scene) {
    return (
      <GameShell
        title={t(lang, 'shell.musicbox.title')}
        subtitle={t(lang, 'shell.musicbox.subPicker')}
        onBack={onHome}
        lang={lang}
      >
        <View style={styles.pickerWrap}>
          {SCENES.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => onPickScene(s.id)}
              testID={`scene-pick-${s.id}`}
              accessibilityRole="button"
              accessibilityLabel={t(lang, `song.${s.songId}` as UIKey)}
              style={({ pressed }) => [styles.charCard, pressed && styles.charPressed]}
            >
              <Text style={styles.charEmoji}>
                {s.id === 'twinkle' ? '🐰' : '🐶'}
              </Text>
              <Text style={styles.charVehicle}>
                {s.id === 'twinkle' ? '🎈' : '⛵'}
              </Text>
              <Text style={styles.charLabel}>
                {t(lang, `song.${s.songId}` as UIKey)}
              </Text>
            </Pressable>
          ))}
        </View>
      </GameShell>
    );
  }

  // Journey: the scrolling play surface. GameShell provides the back chip.
  return (
    <GameShell
      title={t(lang, `song.${scene.songId}` as UIKey)}
      onBack={onBackToPicker}
      backKind="picker"
      lang={lang}
    >
      <JourneyScene scene={scene} />
    </GameShell>
  );
}

const styles = StyleSheet.create({
  pickerWrap: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    padding: 24,
    flexWrap: 'wrap',
  },
  charCard: {
    width: 200,
    height: 240,
    borderRadius: 28,
    backgroundColor: colors.paper,
    borderWidth: 3,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...shadows.lifted,
  },
  charPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  charEmoji: {
    fontSize: 72,
  },
  charVehicle: {
    fontSize: 40,
    marginTop: -8,
  },
  charLabel: {
    fontFamily: fonts.displayMed,
    fontSize: 15,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 4,
  },
});
