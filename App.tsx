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
import { UI_IMAGES } from './src/assets/images';
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
import { ListenChooseGame } from './src/games/listenchoose/ListenChooseGame';
import { FeedbackChip } from './src/components/Feedback';
import { MenuCard } from "./src/components/MenuCard";
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
import { HighLowGame } from './src/games/highlow/HighLowGame';
import { BellsGame } from './src/games/bells/BellsGame';
import { EchoBeatGame } from './src/games/echobeat/EchoBeatGame';
import { SteadyBeatGame } from './src/games/steadybeat/SteadyBeatGame';
import { FastSlowGame } from './src/games/fastslow/FastSlowGame';
import { SameDiffGame } from './src/games/samediff/SameDiffGame';
import { RulesGame } from './src/games/rules/RulesGame';
import { SpotItGame } from './src/games/spotit/SpotItGame';
import { ConceptMatchGame } from './src/games/conceptmatch/ConceptMatchGame';
import { previewFor } from './src/components/MenuPreviews';
import { KGB_BUILD } from './src/assets/build';
import { DifficultyFilter, difficultyOf, loadFilter, nextFilter, saveFilter } from './src/difficulty';
import { useTwoPlayer } from './src/multiplayer';
import { isMuted, say, setMuted, sfx, setSpeechLang, stopNarration } from './src/sound';
import { routeParts, useRoute } from './src/nav';
import { colors, fonts } from './src/theme';
import { useLockdown, effectiveLang, visibleCards } from './src/lockdown';
import { AdultGate } from './src/components/AdultGate';
import { LockdownSettings } from './src/components/LockdownSettings';
import {
  ESCAPE_SHIPPED,
  GAME_CARDS,
  MUSIC_CARDS,
  NUMBER_CARDS,
  WORD_CARDS,
} from './src/menuCards';

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
  const KNOWN = ['menu', 'spotit', 'diff', 'hidden', 'memory', 'shadow', 'oddone', 'rules', 'puzzle', 'sticker', 'story', 'letters', 'numbers', 'sounds', 'rhyme', 'spell', 'listenchoose', 'count', 'compare', 'sums', 'bingo', 'musicbox', 'escape', 'carmode', 'highlow', 'bells', 'echobeat', 'steadybeat', 'fastslow', 'samediff', 'cm-numdots', 'cm-numhan', 'cm-shapes', 'cm-animals'];
  // A stale/mistyped hash must never strand a kid on a blank page — nor
  // must a link to a game this deploy holds back.
  const knownScreen = KNOWN.includes(parts.screen) && (parts.screen !== 'escape' || ESCAPE_SHIPPED) ? parts.screen : 'menu';
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
      {screen === 'listenchoose' && <ListenChooseGame onHome={goHome} difficulty={difficulty} lang={lang} />}
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
          difficulty={difficulty}
          filter={filter}
          onFilter={pickFilter}
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
      {screen === 'highlow' && <HighLowGame onHome={goHome} difficulty={difficulty} lang={lang} />}
      {screen === 'bells' && <BellsGame onHome={goHome} difficulty={difficulty} lang={lang} />}
      {screen === 'echobeat' && <EchoBeatGame onHome={goHome} difficulty={difficulty} lang={lang} />}
      {screen === 'steadybeat' && <SteadyBeatGame onHome={goHome} difficulty={difficulty} lang={lang} />}
      {screen === 'fastslow' && <FastSlowGame onHome={goHome} difficulty={difficulty} lang={lang} />}
      {screen === 'samediff' && <SameDiffGame onHome={goHome} difficulty={difficulty} lang={lang} />}
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
      {screen === 'cm-numdots' && <ConceptMatchGame deck="numerals-dots" onHome={goHome} lang={lang} />}
      {screen === 'cm-numhan' && <ConceptMatchGame deck="numerals-han" onHome={goHome} lang={lang} />}
      {screen === 'cm-shapes' && <ConceptMatchGame deck="shapes-objects" onHome={goHome} lang={lang} />}
      {screen === 'cm-animals' && <ConceptMatchGame deck="animals-sounds" onHome={goHome} lang={lang} />}
      </LangContext.Provider>
    </SafeAreaView>
  );
}

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
  const visMusic = visibleCards(MUSIC_CARDS, lockdown.state.hiddenGames);
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
              <MenuCard g={g} lang={lang} cardWidth={cardWidth} onNavigate={onNavigate} preview={previewFor(g.preview, lang)} />
            </Reveal>
          ))}
        </View>
        )}
        {visWords.length > 0 && (<>
        <Reveal delay={200}><Text style={styles.sectionHead}>{t(lang, 'menu.word')}</Text></Reveal>
        <View style={[styles.cards, { maxWidth: isLandscape ? 1100 : 460 }]}>
          {visWords.map((g, i) => (
            <Reveal key={g.route} delay={160 + i * 80}>
              <MenuCard g={g} lang={lang} cardWidth={cardWidth} onNavigate={onNavigate} preview={previewFor(g.preview, lang)} />
            </Reveal>
          ))}
        </View>
        </>)}
        {visNumbers.length > 0 && (<>
        <Reveal delay={220}><Text style={styles.sectionHead}>{t(lang, 'menu.number')}</Text></Reveal>
        <View style={[styles.cards, { maxWidth: isLandscape ? 1100 : 460 }]}>
          {visNumbers.map((g, i) => (
            <Reveal key={g.route} delay={180 + i * 80}>
              <MenuCard g={g} lang={lang} cardWidth={cardWidth} onNavigate={onNavigate} preview={previewFor(g.preview, lang)} />
            </Reveal>
          ))}
        </View>
        </>)}
        {visMusic.length > 0 && (<>
        <Reveal delay={230}><Text style={styles.sectionHead}>{t(lang, 'menu.music' as const)}</Text></Reveal>
        <View style={[styles.cards, { maxWidth: isLandscape ? 1100 : 460 }]}>
          {visMusic.map((g, i) => (
            <Reveal key={g.route} delay={190 + i * 80}>
              <MenuCard g={g} lang={lang} cardWidth={cardWidth} onNavigate={onNavigate} preview={previewFor(g.preview, lang)} />
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
});
