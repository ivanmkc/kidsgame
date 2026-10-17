import React from 'react';
import { renderToString } from 'react-dom/server';
import { Platform } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSay } from '../sound';

type Mutable<T> = { -readonly [P in keyof T]: T[P] };
type FakeAudioElement = Partial<Mutable<HTMLAudioElement>>;

interface FakeAudioState {
  element: FakeAudioElement;
  listeners: Record<string, Array<() => void>>;
}

const windowListeners: Record<string, Array<() => void>> = {};
const mockStorage = new Map<string, string>();
const createdAudioElements: FakeAudioState[] = [];

function createFakeAudio(initialSrc = ''): FakeAudioState {
  const listeners: Record<string, Array<() => void>> = {};
  const element: FakeAudioElement = {
    preload: '',
    volume: 1,
    playbackRate: 1,
    src: initialSrc,
    currentSrc: initialSrc,
    paused: true,
    onended: null,
    play: vi.fn(async (): Promise<void> => {
      element.paused = false;
      element.currentSrc = element.src ?? '';
      for (const cb of listeners['playing'] ?? []) {
        cb();
      }
    }),
    pause: vi.fn((): void => {
      element.paused = true;
    }),
    addEventListener: vi.fn((event: string, listener: EventListenerOrEventListenerObject): void => {
      if (!listeners[event]) listeners[event] = [];
      if (typeof listener === 'function') {
        listeners[event].push(listener as () => void);
      }
    }),
    removeEventListener: vi.fn((event: string, listener: EventListenerOrEventListenerObject): void => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((l) => l !== listener);
      }
    }),
  };

  element.cloneNode = vi.fn((_deep?: boolean): Node => {
    const clone = createFakeAudio(element.src);
    clone.element.volume = element.volume;
    clone.element.playbackRate = element.playbackRate;
    clone.element.preload = element.preload;
    createdAudioElements.push(clone);
    return clone.element as unknown as Node;
  });

  return { element, listeners };
}

type FakeUtterance = Partial<Mutable<SpeechSynthesisUtterance>>;

class MockSpeechSynthesisUtterance implements FakeUtterance {
  text: string;
  rate = 1;
  pitch = 1;
  onstart: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => void) | null = null;
  onend: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => void) | null = null;

  constructor(text = '') {
    this.text = text;
  }
}

interface FakeSpeechSynthesis {
  speaking: boolean;
  lastUtterance: SpeechSynthesisUtterance | null;
  cancel: ReturnType<typeof vi.fn>;
  speak: ReturnType<typeof vi.fn>;
}

const fakeLocalStorage = {
  getItem: vi.fn((key: string): string | null => mockStorage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string): void => {
    mockStorage.set(key, value);
  }),
};

const fakeSpeechSynthesis: FakeSpeechSynthesis = {
  speaking: false,
  lastUtterance: null,
  cancel: vi.fn((): void => {
    fakeSpeechSynthesis.speaking = false;
  }),
  speak: vi.fn((utterance: SpeechSynthesisUtterance): void => {
    fakeSpeechSynthesis.speaking = true;
    fakeSpeechSynthesis.lastUtterance = utterance;
  }),
};

const MockAudio = vi.fn(function (this: unknown, src?: string) {
  const fake = createFakeAudio(src);
  createdAudioElements.push(fake);
  return fake.element;
});

function addWindowListener(event: string, listener: EventListenerOrEventListenerObject): void {
  if (!windowListeners[event]) {
    windowListeners[event] = [];
  }
  if (typeof listener === 'function') {
    windowListeners[event].push(listener as () => void);
  }
}

function removeWindowListener(event: string, listener: EventListenerOrEventListenerObject): void {
  if (windowListeners[event]) {
    windowListeners[event] = windowListeners[event].filter((l) => l !== listener);
  }
}

function triggerWindowEvent(event: string): void {
  const cbs = windowListeners[event]?.slice() ?? [];
  for (const cb of cbs) {
    cb();
  }
}

interface MockWindow extends Partial<Window> {
  Audio?: typeof Audio;
}

function setupGlobalWindow(overrides?: MockWindow): void {
  for (const k of Object.keys(windowListeners)) {
    delete windowListeners[k];
  }
  mockStorage.clear();
  createdAudioElements.length = 0;
  MockAudio.mockClear();
  fakeLocalStorage.getItem.mockClear();
  fakeLocalStorage.setItem.mockClear();
  fakeSpeechSynthesis.cancel.mockClear();
  fakeSpeechSynthesis.speak.mockClear();
  fakeSpeechSynthesis.speaking = false;
  fakeSpeechSynthesis.lastUtterance = null;
  (Platform as { OS: string }).OS = 'web';

  const mockWindow: MockWindow = {
    localStorage: fakeLocalStorage as unknown as Storage,
    Audio: MockAudio as unknown as typeof Audio,
    speechSynthesis: fakeSpeechSynthesis as unknown as SpeechSynthesis,
    addEventListener: vi.fn(addWindowListener) as unknown as typeof window.addEventListener,
    removeEventListener: vi.fn(removeWindowListener) as unknown as typeof window.removeEventListener,
    ...overrides,
  };

  vi.stubGlobal('window', mockWindow);
  vi.stubGlobal('SpeechSynthesisUtterance', MockSpeechSynthesisUtterance);
}

function TestSpeaker({ text }: { text: string | null }): React.ReactElement | null {
  useSay(text);
  return null;
}

describe('sound module', () => {
  let sound: typeof import('../sound');

  beforeEach(async () => {
    vi.useFakeTimers();
    setupGlobalWindow();
    vi.resetModules();
    sound = await import('../sound');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    (Platform as { OS: string }).OS = 'web';
  });

  describe('mute state management', () => {
    it('initializes unmuted by default when storage is empty', () => {
      expect(sound.isMuted()).toBe(false);
    });

    it('initializes muted when stored preference is muted', async () => {
      mockStorage.set('kgb.sound.v1', 'muted');
      vi.resetModules();
      const mutedSound = await import('../sound');
      expect(mutedSound.isMuted()).toBe(true);
    });

    it('initializes unmuted when stored preference is on', async () => {
      mockStorage.set('kgb.sound.v1', 'on');
      vi.resetModules();
      const unmutedSound = await import('../sound');
      expect(unmutedSound.isMuted()).toBe(false);
    });

    it('initializes safely when window is undefined', async () => {
      vi.unstubAllGlobals();
      vi.resetModules();
      const noWindowSound = await import('../sound');
      expect(noWindowSound.isMuted()).toBe(false);
    });

    it('toggles muted state and writes to localStorage', () => {
      sound.setMuted(true);
      expect(sound.isMuted()).toBe(true);
      expect(mockStorage.get('kgb.sound.v1')).toBe('muted');

      sound.setMuted(false);
      expect(sound.isMuted()).toBe(false);
      expect(mockStorage.get('kgb.sound.v1')).toBe('on');
    });

    it('handles localStorage errors gracefully without throwing', () => {
      fakeLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceeded');
      });

      expect(() => sound.setMuted(true)).not.toThrow();
      expect(sound.isMuted()).toBe(true);
    });

    it('updates muted state safely when Platform.OS is not web', () => {
      (Platform as { OS: string }).OS = 'ios';
      sound.setMuted(true);
      expect(sound.isMuted()).toBe(true);
      expect(mockStorage.has('kgb.sound.v1')).toBe(false);
    });

    it('updates muted state safely when window is undefined', () => {
      vi.unstubAllGlobals();
      sound.setMuted(true);
      expect(sound.isMuted()).toBe(true);
    });
  });

  describe('sfx playback', () => {
    it('plays tap sound and caches the audio element for subsequent calls', () => {
      sound.sfx.tap();
      expect(MockAudio).toHaveBeenCalledWith('sfx/tap.mp3');
      expect(createdAudioElements.length).toBe(2); // original cached + clone
      expect(createdAudioElements[1].element.volume).toBe(0.35);
      expect(createdAudioElements[1].element.play).toHaveBeenCalled();

      // Second tap reuses the cached element and clones it without constructing new Audio
      sound.sfx.tap();
      expect(MockAudio).toHaveBeenCalledTimes(1);
      expect(createdAudioElements.length).toBe(3); // one more clone
      expect(createdAudioElements[2].element.volume).toBe(0.35);
    });

    it('plays all sfx variants with appropriate default and custom volumes', () => {
      sound.sfx.good();
      expect(createdAudioElements.at(-1)?.element.volume).toBe(0.5);

      sound.sfx.wrong();
      expect(createdAudioElements.at(-1)?.element.volume).toBe(0.4);

      sound.sfx.wrong(0.8);
      expect(createdAudioElements.at(-1)?.element.volume).toBe(0.8);

      sound.sfx.flip();
      expect(createdAudioElements.at(-1)?.element.volume).toBe(0.35);

      sound.sfx.win();
      expect(createdAudioElements.at(-1)?.element.volume).toBe(0.6);

      sound.sfx.boing();
      expect(createdAudioElements.at(-1)?.element.volume).toBe(0.6);

      sound.sfx.boing(0.2);
      expect(createdAudioElements.at(-1)?.element.volume).toBe(0.2);

      sound.sfx.thunder();
      expect(createdAudioElements.at(-1)?.element.volume).toBe(0.75);
    });

    it('does not play sfx when muted', () => {
      sound.setMuted(true);
      sound.sfx.tap();
      expect(MockAudio).not.toHaveBeenCalled();
    });

    it('does not play sfx when Platform.OS is not web', () => {
      (Platform as { OS: string }).OS = 'android';
      sound.sfx.tap();
      expect(MockAudio).not.toHaveBeenCalled();
    });

    it('does not play sfx when window is undefined', () => {
      vi.unstubAllGlobals();
      expect(() => sound.sfx.tap()).not.toThrow();
    });

    it('does not play sfx when window.Audio is undefined', async () => {
      setupGlobalWindow({ Audio: undefined });
      vi.resetModules();
      const noAudioSound = await import('../sound');

      expect(() => noAudioSound.sfx.tap()).not.toThrow();
      expect(createdAudioElements.length).toBe(0);
    });

    it('catches audio play rejection cleanly', () => {
      MockAudio.mockImplementationOnce(function (this: unknown, src?: string) {
        const fake = createFakeAudio(src);
        fake.element.cloneNode = vi.fn((_deep?: boolean): Node => {
          const clone = createFakeAudio(src);
          clone.element.play = vi.fn().mockRejectedValue(new Error('Autoplay prevented'));
          createdAudioElements.push(clone);
          return clone.element as unknown as Node;
        });
        createdAudioElements.push(fake);
        return fake.element;
      });

      expect(() => sound.sfx.tap()).not.toThrow();
    });

    it('catches audio creation failure gracefully', () => {
      MockAudio.mockImplementationOnce(function (this: unknown) {
        throw new Error('Audio constructor error');
      });

      expect(() => sound.sfx.tap()).not.toThrow();
    });
  });

  describe('narration element and unlock gesture', () => {
    it('attaches gesture listeners on module load and unlocks on first gesture', () => {
      expect(windowListeners['pointerdown']?.length).toBe(1);
      expect(windowListeners['touchstart']?.length).toBe(1);
      expect(windowListeners['keydown']?.length).toBe(1);

      // Trigger first gesture
      triggerWindowEvent('pointerdown');

      // Listeners should be removed
      expect(windowListeners['pointerdown']?.length).toBe(0);
      expect(windowListeners['touchstart']?.length).toBe(0);
      expect(windowListeners['keydown']?.length).toBe(0);

      // Silent WAV should have been primed
      const primed = createdAudioElements.find((a) => a.element.src?.startsWith('data:audio/wav;base64'));
      expect(primed).toBeDefined();
      expect(primed?.element.play).toHaveBeenCalled();
    });

    it('handles primeUnlock rejection or non-thenable play result without crashing', async () => {
      MockAudio.mockImplementationOnce(function (this: unknown, src?: string) {
        const fake = createFakeAudio(src);
        fake.element.play = vi.fn().mockRejectedValue(new Error('Priming rejected'));
        createdAudioElements.push(fake);
        return fake.element;
      });

      vi.resetModules();
      await import('../sound');

      expect(() => triggerWindowEvent('touchstart')).not.toThrow();
    });

    it('plays queued pending narration after first gesture settles', () => {
      // Queue narration before unlocking
      sound.say('A flamingo!');

      // Gesture triggers unlock and schedules pending narration
      triggerWindowEvent('keydown');

      // Advancing timer runs saySequence on pending narration
      vi.advanceTimersByTime(1);

      const narrationElement = createdAudioElements.find((a) => a.element.src?.includes('1b03801ffd5e3cfa.mp3'));
      expect(narrationElement).toBeDefined();
    });

    it('discards pending narration if token changes before timeout settles', () => {
      sound.say('A flamingo!');
      triggerWindowEvent('pointerdown');

      // An intervening action bumps currentToken before the pending timer fires
      sound.stopNarration();
      vi.advanceTimersByTime(1);

      // The queued sequence should not have fired on the flamingo clip
      const flamingoClips = createdAudioElements.filter((a) => a.element.src?.includes('1b03801ffd5e3cfa.mp3'));
      expect(flamingoClips.length).toBe(0);
    });

    it('tracks debug playing events on window.__kgbAudioDebug for non-data audio', () => {
      sound.say('A flamingo!');

      const debug = (
        window as unknown as {
          __kgbAudioDebug?: { playing: number; lastSrc: string };
        }
      ).__kgbAudioDebug;
      expect(debug).toBeDefined();
      expect(debug?.playing).toBeGreaterThan(0);
      expect(debug?.lastSrc).toContain('1b03801ffd5e3cfa.mp3');
    });
  });

  describe('speech language configuration', () => {
    it('sets speech language and resolves localized clips', () => {
      sound.setSpeechLang('cmn');
      sound.say('一');

      // Clip for 'cmn|一' is '0f6edec87e9c0736.mp3'
      const matched = createdAudioElements.find((a) => a.element.src?.includes('0f6edec87e9c0736.mp3'));
      expect(matched).toBeDefined();

      // Reset to English
      sound.setSpeechLang('en');
    });

    it('falls back to English key if language specific clip does not exist', () => {
      sound.setSpeechLang('ja');
      sound.say('A flamingo!');

      const matched = createdAudioElements.find((a) => a.element.src?.includes('1b03801ffd5e3cfa.mp3'));
      expect(matched).toBeDefined();

      sound.setSpeechLang('en');
    });
  });

  describe('say and playClip', () => {
    it('strips emoji characters and whitespace before looking up clip', () => {
      sound.say('🦩 A flamingo! ✨');

      const matched = createdAudioElements.find((a) => a.element.src?.includes('1b03801ffd5e3cfa.mp3'));
      expect(matched).toBeDefined();
    });

    it('falls back to Web Speech synthesis when no pre-rendered clip matches', () => {
      sound.say('Unheard phrase that was never pre-rendered');

      expect(fakeSpeechSynthesis.speak).toHaveBeenCalled();
      expect(fakeSpeechSynthesis.lastUtterance?.text).toBe('Unheard phrase that was never pre-rendered');
      expect(fakeSpeechSynthesis.lastUtterance?.rate).toBe(1.0);
      expect(fakeSpeechSynthesis.lastUtterance?.pitch).toBe(1.12);

      // Utterance start callback clears pending narration and marks unlocked
      const fakeEv = {} as SpeechSynthesisEvent;
      fakeSpeechSynthesis.lastUtterance?.onstart?.call(
        fakeSpeechSynthesis.lastUtterance as SpeechSynthesisUtterance,
        fakeEv,
      );
    });

    it('does not speak when muted or on non-web platform', () => {
      sound.setMuted(true);
      sound.say('A flamingo!');
      expect(createdAudioElements.length).toBe(0);

      sound.setMuted(false);
      (Platform as { OS: string }).OS = 'ios';
      sound.say('A flamingo!');
      expect(createdAudioElements.length).toBe(0);

      vi.unstubAllGlobals();
      expect(() => sound.say('A flamingo!')).not.toThrow();
    });

    it('handles missing speechSynthesis during fallback gracefully', async () => {
      setupGlobalWindow({ speechSynthesis: undefined });
      vi.resetModules();
      const noSpeechSound = await import('../sound');

      expect(() => noSpeechSound.say('No clip phrase')).not.toThrow();
    });

    it('handles speech play rejection cleanly', () => {
      MockAudio.mockImplementationOnce(function (this: unknown, src?: string) {
        const fake = createFakeAudio(src);
        fake.element.play = vi.fn().mockRejectedValue(new Error('Audio play blocked'));
        createdAudioElements.push(fake);
        return fake.element;
      });

      expect(() => sound.say('A flamingo!')).not.toThrow();
    });
  });

  describe('saySequence', () => {
    it('calls onDone immediately when texts array is empty or empty strings', () => {
      const onDone = vi.fn();
      sound.saySequence([], onDone);
      expect(onDone).toHaveBeenCalledTimes(1);

      const onDone2 = vi.fn();
      sound.saySequence(['', ''], onDone2);
      expect(onDone2).toHaveBeenCalledTimes(1);
    });

    it('plays consecutive clips in sequence chained by onended', () => {
      const onDone = vi.fn();
      sound.saySequence(['A flamingo!', 'A big egg!'], onDone);

      const narration = createdAudioElements[0].element;
      expect(narration.src).toContain('1b03801ffd5e3cfa.mp3'); // Flamingo

      // First clip ends -> advances to second clip
      narration.onended?.call(narration as unknown as GlobalEventHandlers, {} as Event);
      expect(narration.src).toContain('b5c04eb67ec79cec.mp3'); // Big egg

      // Second clip ends -> calls onDone
      narration.onended?.call(narration as unknown as GlobalEventHandlers, {} as Event);
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('chains through Web Speech fallback onend', () => {
      const onDone = vi.fn();
      sound.saySequence(['Phrase 1 without clip', 'Phrase 2 without clip'], onDone);

      expect(fakeSpeechSynthesis.lastUtterance?.text).toBe('Phrase 1 without clip');

      // First utterance finishes
      fakeSpeechSynthesis.lastUtterance?.onend?.call(
        fakeSpeechSynthesis.lastUtterance as SpeechSynthesisUtterance,
        {} as SpeechSynthesisEvent,
      );

      expect(fakeSpeechSynthesis.lastUtterance?.text).toBe('Phrase 2 without clip');

      // Second utterance finishes
      fakeSpeechSynthesis.lastUtterance?.onend?.call(
        fakeSpeechSynthesis.lastUtterance as SpeechSynthesisUtterance,
        {} as SpeechSynthesisEvent,
      );

      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('aborts chain when superseded by another speech call', () => {
      const onDone = vi.fn();
      sound.saySequence(['A flamingo!', 'A big egg!'], onDone);

      // Intervening say call bumps token
      sound.say('A flamingo!');

      // Triggering first sequence onended should not continue old sequence
      const narration = createdAudioElements[0].element;
      narration.onended?.call(narration as unknown as GlobalEventHandlers, {} as Event);

      expect(onDone).not.toHaveBeenCalled();
    });
  });

  describe('stopNarration and fadeStop', () => {
    it('cancels speech synthesis and fades playing narration to silence', () => {
      sound.say('A flamingo!');
      const narration = createdAudioElements[0].element;
      expect(narration.paused).toBe(false);

      sound.stopNarration();
      expect(fakeSpeechSynthesis.cancel).toHaveBeenCalled();

      // Fade steps down volume by 0.12 every 30ms
      expect(narration.volume).toBeCloseTo(0.73, 2);

      vi.advanceTimersByTime(30);
      expect(narration.volume).toBeCloseTo(0.61, 2);

      // Advance through remaining steps until paused
      vi.advanceTimersByTime(300);
      expect(narration.paused).toBe(true);
    });

    it('clears previous fade timer if stopNarration is called again during a fade', () => {
      sound.say('A flamingo!');
      sound.stopNarration();

      // Second stop narration while fade is pending
      expect(() => sound.stopNarration()).not.toThrow();
    });

    it('returns immediately if narration is not playing or null', () => {
      expect(() => sound.stopNarration()).not.toThrow();
    });

    it('returns immediately when Platform.OS is not web or window is undefined', () => {
      (Platform as { OS: string }).OS = 'ios';
      expect(() => sound.stopNarration()).not.toThrow();

      vi.unstubAllGlobals();
      expect(() => sound.stopNarration()).not.toThrow();
    });

    it('handles pause throwing an error during fadeStop non-fatally', () => {
      sound.say('A flamingo!');
      const narration = createdAudioElements[0].element;
      narration.volume = 0.05; // Will trigger pause on next step
      narration.pause = vi.fn(() => {
        throw new Error('Pause error');
      });

      expect(() => sound.stopNarration()).not.toThrow();
    });
  });

  describe('sayThen', () => {
    it('fires callback after 600ms beat when muted or non-web', () => {
      sound.setMuted(true);
      const done = vi.fn();
      sound.sayThen(['A flamingo!'], done);

      expect(done).not.toHaveBeenCalled();
      vi.advanceTimersByTime(600);
      expect(done).toHaveBeenCalledTimes(1);

      // Test non-web
      sound.setMuted(false);
      (Platform as { OS: string }).OS = 'ios';
      const doneNonWeb = vi.fn();
      sound.sayThen(['A flamingo!'], doneNonWeb);

      vi.advanceTimersByTime(600);
      expect(doneNonWeb).toHaveBeenCalledTimes(1);
    });

    it('fires callback once when sequence completes before cap', () => {
      const done = vi.fn();
      sound.sayThen(['A flamingo!'], done, 5000);

      const narration = createdAudioElements[0].element;
      narration.onended?.call(narration as unknown as GlobalEventHandlers, {} as Event);

      expect(done).toHaveBeenCalledTimes(1);

      // Advancing past cap does not fire done a second time
      vi.advanceTimersByTime(6000);
      expect(done).toHaveBeenCalledTimes(1);
    });

    it('fires callback when speech stalls and cap timeout expires', () => {
      const done = vi.fn();
      sound.sayThen(['A flamingo!'], done, 3000);

      vi.advanceTimersByTime(2999);
      expect(done).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(done).toHaveBeenCalledTimes(1);

      // Eventual onended after cap does not fire done again
      const narration = createdAudioElements[0].element;
      narration.onended?.call(narration as unknown as GlobalEventHandlers, {} as Event);
      expect(done).toHaveBeenCalledTimes(1);
    });
  });

  describe('useSay component hook', () => {
    it('renders with text and null without errors', () => {
      expect(() => {
        renderToString(React.createElement(TestSpeaker, { text: 'A flamingo!' }));
      }).not.toThrow();

      expect(() => {
        renderToString(React.createElement(TestSpeaker, { text: null }));
      }).not.toThrow();
    });
  });
});
