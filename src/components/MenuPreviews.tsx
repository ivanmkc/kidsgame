import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SCENE_IMAGES, SCENE_THUMBS, SPOTIT_ICONS, SPOTIT_SHADOWS } from '../assets/images';
import { t } from '../i18n';
import { Lang } from '../lang';
import { DiffScene, baseImage, manifest } from '../manifest';
import { colors, fonts } from '../theme';

export function previewFor(key: string, lang: Lang): React.ReactNode {
  if (key === 'icons0') return <SpotItPreview />;
  if (key === 'icons8') return <MemoryPreview />;
  if (key === 'icons13') return <ShadowPreview />;
  if (key === 'icons20') return <OddOnePreview />;
  if (key === 'rules') return <RulesPreview lang={lang} />;
  if (key === 'bingo') return <BingoPreview />;
  if (key === 'musicbox') return <MusicBoxPreview />;
  if (key === 'escape') {
    // Real room art beats the emoji strip; fall back if rooms are absent.
    const room = manifest.escape?.[0];
    const src = room ? (SCENE_THUMBS[room.image] ?? SCENE_IMAGES[room.image]) : null;
    return src ? <Image source={src} style={styles.preview} /> : <EscapePreview />;
  }
  if (key === 'carmode') return <CarModePreview />;
  if (key === 'music') return <MusicPreview />;

  const scene =
    key === 'diff'
      ? (manifest.diff.find((d) => d.id === 'unicorn') ?? manifest.diff[0])
      : key === 'hidden'
        ? (manifest.hidden.find((h) => h.id === 'ballroom') ?? manifest.hidden[0])
        : (manifest.diff.find((d) => d.id === 'princess') ?? manifest.diff[0]);
  if (!scene) return null;
  const imgKey =
    key === 'story'
      ? manifest.stories?.[0]?.nodes.start.image
      : (baseImage(scene as DiffScene) ?? (scene as { image?: string }).image);
  if (!imgKey) return null;
  const src = SCENE_THUMBS[imgKey] ?? SCENE_IMAGES[imgKey];
  return <Image source={src} style={styles.preview} />;
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
            <Image
              source={SPOTIT_ICONS[manifest.spotit.icons[8]]}
              style={{ width: '80%', height: '80%' }}
              resizeMode="contain"
            />
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
function RulesPreview({ lang }: { lang: Lang }) {
  const icons = manifest.spotit.icons;
  return (
    <View style={[styles.iconRow, { backgroundColor: 'rgba(62,155,184,0.10)', flexDirection: 'column', gap: 6 }]}>
      <View style={styles.miniRule}>
        <Text style={styles.miniRuleText}>{t(lang, 'card.rules.banner')}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[0, 18, 3, 24].map((idx, i) => (
          <View
            key={i}
            style={[
              styles.previewTile,
              { width: 46, height: 46, borderColor: [0, 3].includes(idx) ? colors.green : colors.blush },
            ]}
          >
            <Image source={SPOTIT_ICONS[icons[idx]]} style={styles.previewTileImg} />
          </View>
        ))}
      </View>
    </View>
  );
}

function BingoPreview() {
  const icons = manifest.spotit.icons;
  return (
    <View style={[styles.iconRow, { backgroundColor: 'rgba(214,111,168,0.10)' }]}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
        <View
          key={idx}
          style={[
            styles.previewTile,
            { width: 32, height: 32, borderRadius: 8, borderWidth: 2 },
            [0, 4, 8].includes(idx)
              ? { borderColor: colors.gold, backgroundColor: 'rgba(232,162,79,0.18)' }
              : { borderColor: colors.blush },
          ]}
        >
          <Image
            source={SPOTIT_ICONS[icons[idx % icons.length]]}
            style={{ width: '76%', height: '76%' }}
            resizeMode="contain"
          />
          {[0, 4, 8].includes(idx) && (
            <Text style={{ position: 'absolute', top: -4, right: -4, fontSize: 10 }}>⭐</Text>
          )}
        </View>
      ))}
    </View>
  );
}

// Music Box preview: bouncing buddies and floating notes on a pastel sky
function MusicBoxPreview() {
  return (
    <View style={[styles.iconRow, { backgroundColor: '#E3EEFB' }]}>
      <Text style={{ fontSize: 30 }}>🎵</Text>
      <Text style={{ fontSize: 40 }}>🐰</Text>
      <Text style={{ fontSize: 26 }}>🎶</Text>
      <Text style={{ fontSize: 40 }}>🐻</Text>
      <Text style={{ fontSize: 30 }}>♪</Text>
    </View>
  );
}

// Little Escapes preview: the tap-select-tap loop in three beats
function EscapePreview() {
  return (
    <View style={[styles.iconRow, { backgroundColor: 'rgba(79,176,109,0.10)' }]}>
      <Text style={{ fontSize: 34 }}>🔍</Text>
      <Text style={{ fontSize: 30 }}>🗝️</Text>
      <Text style={{ fontSize: 26, color: colors.inkSoft }}>➜</Text>
      <Text style={{ fontSize: 34 }}>🔒</Text>
      <Text style={{ fontSize: 34 }}>🐶</Text>
    </View>
  );
}

// Car Mode preview: audio waves and headphones, eyes-free vibe
function CarModePreview() {
  return (
    <View style={[styles.iconRow, { backgroundColor: 'rgba(232,162,79,0.12)' }]}>
      <Text style={{ fontSize: 30 }}>🚗</Text>
      <Text style={{ fontSize: 34 }}>👂</Text>
      <Text style={{ fontSize: 26 }}>🎵</Text>
      <Text style={{ fontSize: 34 }}>🤔</Text>
      <Text style={{ fontSize: 30 }}>👆</Text>
    </View>
  );
}

// Music Games preview: notes and instruments
function MusicPreview() {
  return (
    <View style={[styles.iconRow, { backgroundColor: 'rgba(93,169,232,0.10)' }]}>
      <Text style={{ fontSize: 30 }}>🎵</Text>
      <Text style={{ fontSize: 34 }}>🔔</Text>
      <Text style={{ fontSize: 30 }}>🥁</Text>
      <Text style={{ fontSize: 34 }}>💓</Text>
      <Text style={{ fontSize: 30 }}>🎶</Text>
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

const styles = StyleSheet.create({
  preview: { width: '100%', height: '100%' },
  iconRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.paper,
  },
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
});
