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
  Platform,
} from 'react-native';
import { SCENE_THUMBS, SCENE_IMAGES, SPOTIT_ICONS, SPOTIT_SHADOWS, UI_IMAGES } from './src/assets/images';
import { track } from './src/analytics';
import { Lang, LANGS, loadLang, nextLang, saveLang } from './src/lang';
import { t } from './src/i18n';
import { LettersGame } from './src/games/letters/LettersGame';
import { NumbersGame } from './src/games/numbers/NumbersGame';
import { SoundsGame } from './src/games/sounds/SoundsGame';
import { RhymeGame } from './src/games/rhymegame/RhymeGame';
import { CountGame } from './src/games/count/CountGame';
import { CompareGame } from './src/games/compare/CompareGame';
import { SumsGame } from './src/games/sums/SumsGame';
import { SpellGame } from './src/games/spell/SpellGame';
import { FeedbackChip } from './src/components/Feedback';
import { LangContext } from './src/components/GameShell';
import { FilterCycleChip } from './src/components/ScenePicker';
import { TwinkleField } from './src/components/Sparkles';
import { DiffGame } from './src/games/diff/DiffGame';
import { HiddenGame } from './src/games/hidden/HiddenGame';
import { MemoryGame } from './src/games/memory/MemoryGame';
import { OddOneGame } from './src/games/oddone/OddOneGame';
import { ShadowGame } from './src/games/shadow/ShadowGame';
import { PuzzleGame } from './src/games/puzzle/PuzzleGame';
import { StickerGame } from './src/games/sticker/StickerGame';
import { StoryGame } from './src/games/story/StoryGame';
import { MusicBoxGame } from './src/games/musicbox/MusicBoxGame';
import { BingoGame } from './src/games/bingo/BingoGame';
import { CarModeGame } from './src/games/carmode/CarModeGame';
import { EscapeGame } from './src/games/escape/EscapeGame';
import { RulesGame } from './src/games/rules/RulesGame';
import { SpotItGame } from './src/games/spotit/SpotItGame';
import { DiffScene, baseImage, manifest } from './src/manifest';
import { KGB_BUILD } from './src/assets/build';
import { DifficultyFilter, difficultyOf, loadFilter, nextFilter, saveFilter } from './src/difficulty';
import { useTwoPlayer } from './src/multiplayer';
import { isMuted, say, setMuted, sfx, setSpeechLang, stopNarration } from './src/sound';
import { routeParts, useRoute } from './src/nav';
import { colors, fonts, shadows } from './src/theme';
import { useLockdown, effectiveLang, visibleCards } from './src/lockdown';
import { AdultGate } from './src/components/AdultGate';
import { LockdownSettings } from './src/components/LockdownSettings';

// Stale-cache self-heal: hashed JS is cached as immutable, so an old
// cached index.html pins an outdated bundle forever (invisible-diff bug
// class). Compare the baked build id against version.json (no-store) and
// reload once when they diverge.
if (typeof document !== 'undefined' && typeof fetch !== 'undefined') {
  const baked = KGB_BUILD;
  fetch('version.json', { cache: 'no-store' })
    .then((r) => r.json())
    .then((v) => {
      if (baked && v.build && v.build !== baked && !sessionStorage.getItem('kgb.reloaded')) {
        sessionStorage.setItem('kgb.reloaded', '1');
        location.reload();
      } else if (v.build === baked) {
        sessionStorage.removeItem('kgb.reloaded');
      }
    })
    .catch(() => { /* offline: fine */ });
}

// Asset cache: hashed bundles + scene art + voice clips are immutable, so
// a service worker caches them for instant returns (gh-pages only sends
// max-age=600). index.html/version.json bypass it — self-heal stays live.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* http dev: fine */ });
  });
}

// Kids drag fingers across the screen constantly — kill text/image
// selection and the long-press callout globally (web only).
if (typeof document !== 'undefined' && !document.getElementById('kgb-noselect')) {
  const st = document.createElement('style');
  st.id = 'kgb-noselect';
  st.textContent = `
    *, *::before, *::after { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    img { -webkit-user-drag: none; pointer-events: inherit; }
  `;
  document.head.appendChild(st);
}

export default function App() {
  useFonts({
    Baloo2_600SemiBold,
    Baloo2_800ExtraBold,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });
  const [filter, setFilter] = useState<DifficultyFilter>(() => loadFilter());
  const [lang, setLang] = useState<Lang>(() => loadLang());
  useEffect(() => { setSpeechLang(lang); }, [lang]);
  const cycleLang = () => {
    const l = nextLang(lang);
    setLang(l); saveLang(l); setSpeechLang(l); sfx.tap(); track('lang', { mode: l });
  };
  const lockdown = useLockdown();
  useEffect(() => {
    const eff = effectiveLang(lang, lockdown.state.hiddenLangs);
    if (eff !== lang) { setLang(eff); saveLang(eff); setSpeechLang(eff); }
  }, [lockdown.state.hiddenLangs, lang]);
  const cycleLangLocked = () => {
    let l = nextLang(lang);
    let tries = LANGS.length;
    while (lockdown.state.hiddenLangs.includes(l) && tries-- > 0) l = nextLang(l);
    setLang(l); saveLang(l); setSpeechLang(l); sfx.tap(); track('lang', { mode: l });
  };
  const [twoPlayer, setTwoPlayer] = useTwoPlayer();
  const difficulty = difficultyOf(filter);
  const [route, navigate] = useRoute();
  // nav.navigate/popstate cancel the previous screen's narration synchronously
  // (before React commits) — see src/nav.ts. Doing it here in an after-mount
  // effect races the child's mount-effect say() and silences round 1.
  useEffect(() => { track('view'); }, [route]);
  const parts = routeParts(route);
  const KNOWN = ['menu', 'spotit', 'diff', 'hidden', 'memory', 'shadow', 'oddone', 'rules', 'puzzle', 'sticker', 'story', 'letters', 'numbers', 'sounds', 'rhyme', 'spell', 'count', 'compare', 'sums', 'bingo', 'musicbox', 'escape', 'carmode'];
  // A stale/mistyped hash must never strand a kid on a blank page.
  const knownScreen = KNOWN.includes(parts.screen) ? parts.screen : 'menu';
  const screen = (knownScreen !== 'menu' && lockdown.isGameHidden(knownScreen)) ? 'menu' : knownScreen;
  const param = parts.param;
  const goHome = () => navigate('menu');
  const pickFilter = (f: DifficultyFilter) => { setFilter(f); saveFilter(f); sfx.tap(); };

  // fontsLoaded intentionally does NOT gate rendering: on slow networks the
  // gate meant a blank screen for many seconds; a brief system-font flash is
  // the better trade for a kids app.
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <LangContext.Provider value={{ lang, onCycle: cycleLangLocked }}>
      {screen === 'letters' && <LettersGame onHome={goHome} difficulty={difficulty} lang={lang} />}
      {screen === 'numbers' && <NumbersGame onHome={goHome} difficulty={difficulty} lang={lang} />}
      {screen === 'sounds' && <SoundsGame onHome={goHome} difficulty={difficulty} lang={lang} />}
      {screen === 'rhyme' && <RhymeGame onHome={goHome} difficulty={difficulty} lang={lang} />}
      {screen === 'spell' && <SpellGame onHome={goHome} difficulty={difficulty} lang={lang} />}
      {screen === 'count' && <CountGame onHome={goHome} difficulty={difficulty} lang={lang} />}
      {screen === 'compare' && <CompareGame onHome={goHome} difficulty={difficulty} lang={lang} />}
      {screen === 'sums' && <SumsGame onHome={goHome} difficulty={difficulty} lang={lang} />}
      {screen === 'menu' && (
        <Menu filter={filter} onPickFilter={pickFilter} onNavigate={navigate} twoPlayer={twoPlayer} onToggleTwoPlayer={setTwoPlayer} lang={lang} onCycleLang={cycleLangLocked} lockdown={lockdown} />
      )}
      {screen === 'spotit' && <SpotItGame onHome={goHome} difficulty={difficulty} twoPlayerEnabled={twoPlayer} lang={lang} />}
      {screen === 'diff' && (
        <DiffGame
          onHome={goHome}
          difficulty={difficulty}
          filter={filter}
          onFilter={pickFilter}
          sceneId={param}
          onPickScene={(id) => navigate(`diff/${id}`)}
          onBackToPicker={() => navigate('diff')}
          lang={lang}
        />
      )}
      {screen === 'hidden' && (
        <HiddenGame
          onHome={goHome}
          difficulty={difficulty}
          filter={filter}
          onFilter={pickFilter}
          twoPlayerEnabled={twoPlayer}
          sceneId={param}
          onPickScene={(id) => navigate(`hidden/${id}`)}
          onBackToPicker={() => navigate('hidden')}
          lang={lang}
        />
      )}
      {screen === 'sticker' && (
        <StickerGame
          onHome={goHome}
          sceneId={param}
          onPickScene={(id) => navigate(`sticker/${id}`)}
          onBackToPicker={() => navigate('sticker')}
          lang={lang}
        />
      )}
      {screen === 'story' && (
        <StoryGame
          onHome={goHome}
          sceneId={param}
          onPickScene={(id) => navigate(`story/${id}`)}
          onBackToPicker={() => navigate('story')}
          lang={lang}
        />
      )}
      {screen === 'musicbox' && (
        <MusicBoxGame
          onHome={goHome}
          sceneId={param}
          onPickScene={(id) => navigate(`musicbox/${id}`)}
          onBackToPicker={() => navigate('musicbox')}
          lang={lang}
        />
      )}
      {screen === 'escape' && (
        <EscapeGame
          onHome={goHome}
          sceneId={param}
          onPickScene={(id) => navigate(`escape/${id}`)}
          onBackToPicker={() => navigate('escape')}
          lang={lang}
        />
      )}
      {screen === 'carmode' && <CarModeGame onHome={goHome} lang={lang} />}
      {screen === 'bingo' && <BingoGame onHome={goHome} difficulty={difficulty} lang={lang} />}
      {screen === 'memory' && <MemoryGame onHome={goHome} difficulty={difficulty} twoPlayerEnabled={twoPlayer} lang={lang} />}
      {screen === 'shadow' && <ShadowGame onHome={goHome} difficulty={difficulty} lang={lang} />}
      {screen === 'oddone' && <OddOneGame onHome={goHome} difficulty={difficulty} lang={lang} />}
      {screen === 'rules' && <RulesGame onHome={goHome} difficulty={difficulty} lang={lang} />}
      {screen === 'puzzle' && (
        <PuzzleGame
          onHome={goHome}
          difficulty={difficulty}
          filter={filter}
          onFilter={pickFilter}
          sceneId={param}
          onPickScene={(id) => navigate(`puzzle/${id}`)}
          onBackToPicker={() => navigate('puzzle')}
          lang={lang}
        />
      )}
      </LangContext.Provider>
    </SafeAreaView>
  );
}

// Card catalogue: route (drives testID + navigation) + color + preview key
// + i18n key root. Titles/blurbs resolve at render time via t(lang, ...) so
// the language chip flips the whole menu without a remount. `key` is
// strongly typed so `card.${key}.title` composes to a valid UIKey.
type CardKey =
  | 'letters' | 'sounds' | 'rhyme' | 'spell'
  | 'count' | 'numbers' | 'compare' | 'sums'
  | 'spotit' | 'diff' | 'hidden' | 'memory' | 'puzzle' | 'shadow' | 'oddone' | 'rules' | 'sticker' | 'story' | 'bingo' | 'musicbox' | 'escape' | 'carmode';
interface CardDef { route: string; color: string; key: CardKey; preview: string }
const WORD_CARDS: CardDef[] = [
  { route: 'letters', color: '#E85D75', key: 'letters', preview: 'icons0' },
  { route: 'sounds', color: '#5DA9E8', key: 'sounds', preview: 'icons8' },
  { route: 'rhyme', color: '#9C6FD6', key: 'rhyme', preview: 'icons13' },
  { route: 'spell', color: '#4FB06D', key: 'spell', preview: 'icons20' },
];
const NUMBER_CARDS: CardDef[] = [
  { route: 'count', color: '#E8A24F', key: 'count', preview: 'icons0' },
  { route: 'numbers', color: '#3E9BB8', key: 'numbers', preview: 'icons8' },
  { route: 'compare', color: '#D66FA8', key: 'compare', preview: 'icons13' },
  { route: 'sums', color: '#7A6FD6', key: 'sums', preview: 'icons20' },
];
const GAME_CARDS: CardDef[] = [
  { route: 'spotit', color: colors.red, key: 'spotit', preview: 'icons0' },
  { route: 'diff', color: colors.teal, key: 'diff', preview: 'diff' },
  { route: 'hidden', color: colors.purple, key: 'hidden', preview: 'hidden' },
  { route: 'memory', color: colors.green, key: 'memory', preview: 'icons8' },
  { route: 'puzzle', color: colors.gold, key: 'puzzle', preview: 'puzzle' },
  { route: 'shadow', color: colors.ink, key: 'shadow', preview: 'icons13' },
  { route: 'oddone', color: '#E8874F', key: 'oddone', preview: 'icons20' },
  { route: 'rules', color: '#3E9BB8', key: 'rules', preview: 'rules' },
  { route: 'sticker', color: '#D66FA8', key: 'sticker', preview: 'icons0' },
  { route: 'story', color: '#7A6FD6', key: 'story', preview: 'story' },
  { route: 'bingo', color: '#D66FA8', key: 'bingo', preview: 'bingo' },
  { route: 'musicbox', color: '#E8A24F', key: 'musicbox', preview: 'musicbox' },
  { route: 'escape', color: '#4FB06D', key: 'escape', preview: 'escape' },
  { route: 'carmode', color: '#E8A24F', key: 'carmode', preview: 'carmode' },
];

function Menu({
  filter, onPickFilter, onNavigate, twoPlayer, onToggleTwoPlayer, lang, onCycleLang, lockdown,
}: {
  lang: Lang;
  onCycleLang: () => void;
  filter: DifficultyFilter;
  onPickFilter: (f: DifficultyFilter) => void;
  onNavigate: (r: string) => void;
  twoPlayer: boolean;
  onToggleTwoPlayer: (on: boolean) => void;
  lockdown: ReturnType<typeof useLockdown>;
}) {
  const [muted, setMutedState] = React.useState(isMuted());
  const [showGate, setShowGate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const visGames = visibleCards(GAME_CARDS, lockdown.state.hiddenGames);
  const visWords = visibleCards(WORD_CARDS, lockdown.state.hiddenGames);
  const visNumbers = visibleCards(NUMBER_CARDS, lockdown.state.hiddenGames);
  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    setMutedState(m);
    if (m) stopNarration(); // 🔇 must silence the CURRENT voice too
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
    if (key === 'rules') return <RulesPreview lang={lang} />;
    if (key === 'bingo') return <BingoPreview />;
    if (key === 'musicbox') return <MusicBoxPreview />;
    if (key === 'escape') return <EscapePreview />;
    if (key === 'carmode') return <CarModePreview />;

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
            <View style={{ alignItems: isLandscape ? 'flex-start' : 'center', flexShrink: 1, minWidth: 0, maxWidth: '100%' }}>
              <Text style={styles.heading}>{t(lang, 'menu.heading')}</Text>
              <View style={styles.diffRow}>
                <FilterCycleChip filter={filter} onCycle={() => onPickFilter(nextFilter(filter))} verbose lang={lang} />
                <Pressable
                  onPress={lockdown.allowedLangs.length > 1 ? onCycleLang : undefined}
                  testID="lang-cycle"
                  accessibilityRole="button"
                  accessibilityLabel={t(lang, 'a11y.langCycle', { name: LANGS.find((l) => l.id === lang)?.label ?? '' })}
                  style={[styles.diffChip, styles.soundChip, lockdown.allowedLangs.length <= 1 && { opacity: 0.5 }]}
                  disabled={lockdown.allowedLangs.length <= 1}
                >
                  <Text style={styles.diffText}>{LANGS.find((l) => l.id === lang)?.emoji} {LANGS.find((l) => l.id === lang)?.label}</Text>
                </Pressable>
                <Pressable
                  onPress={toggleMute}
                  testID="sound-toggle"
                  accessibilityRole="button"
                  accessibilityLabel={muted ? t(lang, 'a11y.soundOn') : t(lang, 'a11y.soundOff')}
                  style={[styles.diffChip, styles.soundChip]}
                >
                  <Text style={styles.diffText}>{muted ? t(lang, 'chip.muted') : t(lang, 'chip.sound')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const on = !twoPlayer;
                    onToggleTwoPlayer(on);
                    sfx.tap();
                    // Spoken cue stays English on purpose — voice clips are keyed
                    // per language elsewhere; this trigger only speaks in EN.
                    if (on) say('Two player mode is on!');
                  }}
                  testID="mp-toggle"
                  accessibilityRole="button"
                  accessibilityLabel={t(lang, 'a11y.twoPlayer')}
                  style={[styles.diffChip, styles.soundChip, twoPlayer && styles.diffChipOn]}
                >
                  <Text style={[styles.diffText, twoPlayer && styles.diffTextOn]}>{twoPlayer ? t(lang, 'chip.twoPlayersOn') : t(lang, 'chip.twoPlayers')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Reveal>
        {visGames.length > 0 && (
        <View style={[styles.cards, { maxWidth: isLandscape ? 1100 : 460 }]}>
          {visGames.map((g, i) => (
            <Reveal key={g.route} delay={120 + i * 80}>
              <GameCard
                color={g.color}
                title={t(lang, `card.${g.key}.title` as const)}
                blurb={t(lang, `card.${g.key}.blurb` as const)}
                onPress={() => onNavigate(g.route)}
                testID={`menu-${g.route}`}
                preview={previewFor(g.preview)}
                width={cardWidth}
              />
            </Reveal>
          ))}
        </View>
        )}
        {visWords.length > 0 && (<>
        <Reveal delay={200}><Text style={styles.sectionHead}>{t(lang, 'menu.word')}</Text></Reveal>
        <View style={[styles.cards, { maxWidth: isLandscape ? 1100 : 460 }]}>
          {visWords.map((g, i) => (
            <Reveal key={g.route} delay={160 + i * 80}>
              <GameCard color={g.color} title={t(lang, `card.${g.key}.title` as const)} blurb={t(lang, `card.${g.key}.blurb` as const)} onPress={() => onNavigate(g.route)} testID={`menu-${g.route}`} preview={previewFor(g.preview)} width={cardWidth} />
            </Reveal>
          ))}
        </View>
        </>)}
        {visNumbers.length > 0 && (<>
        <Reveal delay={220}><Text style={styles.sectionHead}>{t(lang, 'menu.number')}</Text></Reveal>
        <View style={[styles.cards, { maxWidth: isLandscape ? 1100 : 460 }]}>
          {visNumbers.map((g, i) => (
            <Reveal key={g.route} delay={180 + i * 80}>
              <GameCard color={g.color} title={t(lang, `card.${g.key}.title` as const)} blurb={t(lang, `card.${g.key}.blurb` as const)} onPress={() => onNavigate(g.route)} testID={`menu-${g.route}`} preview={previewFor(g.preview)} width={cardWidth} />
            </Reveal>
          ))}
        </View>
        </>)}
        <Reveal delay={240}>
          <View style={styles.grownups}>
            <Text style={styles.grownupsHead}>{t(lang, 'menu.grownups')}</Text>
            <View style={styles.grownupsRow}>
              <InstallChip lang={lang} />
              <ShareChip lang={lang} />
              <FeedbackChip lang={lang} />
              <Pressable
                onPress={() => setShowGate(true)}
                testID="parental-controls"
                accessibilityRole="button"
                accessibilityLabel="Parental Controls"
                style={({ pressed }) => [styles.grownupsBtn, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.grownupsBtnText}>
                  Parental Controls{lockdown.isActive ? ' (active)' : ''}
                </Text>
              </Pressable>
            </View>
          </View>
        </Reveal>
      </ScrollView>
      {showGate && (
        <AdultGate
          onPass={() => { setShowGate(false); setShowSettings(true); }}
          onCancel={() => setShowGate(false)}
        />
      )}
      {showSettings && (
        <LockdownSettings
          hiddenGames={lockdown.state.hiddenGames}
          hiddenLangs={lockdown.state.hiddenLangs}
          onToggleGame={lockdown.toggleGame}
          onToggleLang={lockdown.toggleLang}
          onDone={() => setShowSettings(false)}
        />
      )}
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
function RulesPreview({ lang }: { lang: Lang }) {
  const icons = manifest.spotit.icons;
  return (
    <View style={[styles.iconRow, { backgroundColor: 'rgba(62,155,184,0.10)', flexDirection: 'column', gap: 6 }]}>
      <View style={styles.miniRule}><Text style={styles.miniRuleText}>{t(lang, 'card.rules.banner')}</Text></View>
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
          <Image source={SPOTIT_ICONS[icons[idx % icons.length]]} style={{ width: '76%', height: '76%' }} resizeMode="contain" />
          {[0, 4, 8].includes(idx) && <Text style={{ position: 'absolute', top: -4, right: -4, fontSize: 10 }}>⭐</Text>}
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
      accessibilityRole="button"
      accessibilityLabel={`${title} — ${blurb}`}
      style={({ pressed }) => [styles.gameCard, shadows.sticker, { borderColor: color, width }, pressed && styles.pressed]}
    >
      {/* decorative preview: keep it out of the accessible name */}
      <View style={styles.previewWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        {preview}
      </View>
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

// "Add to Home Screen": real install prompt on Android/Chrome; on iOS
// Safari there is no API, so show the two-tap recipe instead.
let deferredInstall: { prompt: () => Promise<void> } | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e as unknown as { prompt: () => Promise<void> };
  });
}

function InstallChip({ lang }: { lang: Lang }) {
  const [showIosHelp, setShowIosHelp] = useState(false);
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || (window.navigator as { standalone?: boolean }).standalone === true;
  if (standalone) return null;
  const isIos = /iPad|iPhone|iPod/.test(window.navigator.userAgent)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  const onPress = async () => {
    sfx.tap();
    track('install_tap', { kind: isIos ? 'ios' : deferredInstall ? 'prompt' : 'none' });
    if (deferredInstall) {
      await deferredInstall.prompt();
      deferredInstall = null;
    } else {
      setShowIosHelp(true);
      setTimeout(() => setShowIosHelp(false), 6000);
    }
  };
  return (
    <>
      <Pressable onPress={onPress} testID="install-app" accessibilityRole="button" accessibilityLabel={t(lang, 'install.iosHint')} style={({ pressed }) => [styles.grownupsBtn, pressed && { opacity: 0.8 }]}>
        <Text style={styles.grownupsBtnText}>{t(lang, 'grownups.install')}</Text>
      </Pressable>
      {showIosHelp ? (
        <View style={styles.iosHelp} testID="install-ios-help">
          <Text style={styles.iosHelpText}>{t(lang, 'install.iosHelp')}</Text>
        </View>
      ) : null}
    </>
  );
}

function ShareChip({ lang }: { lang: Lang }) {
  const [copied, setCopied] = useState(false);
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const onPress = async () => {
    sfx.tap();
    track('share_tap');
    const url = 'https://ivanmkc.github.io/kidsgame/';
    // OS share sheet preview stays English on purpose \u2014 that text goes to
    // the recipient's chat/mail app, not to the current viewer's UI.
    const data = { title: 'Kids Game Box', text: 'Free picture games and talking storybooks for little kids!', url };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch { /* user cancelled */ }
  };
  return (
    <>
      <Pressable onPress={onPress} testID="share-app" accessibilityRole="button" accessibilityLabel={t(lang, 'grownups.share')} style={({ pressed }) => [styles.grownupsBtn, pressed && { opacity: 0.8 }]}>
        <Text style={styles.grownupsBtnText}>{copied ? t(lang, 'grownups.copied') : t(lang, 'grownups.share')}</Text>
      </Pressable>
      {copied ? (
        <View style={styles.iosHelp}><Text style={styles.iosHelpText}>{t(lang, 'share.copied')}</Text></View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    marginTop: 18,
    marginBottom: 2,
    textAlign: 'center',
  },
  iosHelp: {
    position: 'absolute',
    top: 46,
    right: 0,
    backgroundColor: 'rgba(60,45,70,0.94)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    zIndex: 60,
    maxWidth: 240,
  },
  iosHelpText: { color: 'white', fontSize: 13, fontFamily: 'System' },
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
  diffRow: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' , maxWidth: '100%' },
  diffChip: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  soundChip: { paddingHorizontal: 10 },
  grownups: { alignItems: 'center', marginTop: 26, marginBottom: 10, gap: 8 },
  grownupsHead: { fontFamily: fonts.displayMed, fontSize: 15, color: colors.inkSoft },
  grownupsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  grownupsBtn: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.blush,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minHeight: 44,
    justifyContent: 'center',
  },
  grownupsBtnText: { fontFamily: fonts.displayMed, fontSize: 14, color: colors.ink },
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
