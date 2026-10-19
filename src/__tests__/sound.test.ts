// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import React from "react";
import { Platform } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeAudioElement {
  src = "";
  preload = "";
  volume = 1;
  playbackRate = 1;
  paused = true;
  onended: ((event?: unknown) => void) | null = null;
  private listeners: Record<string, ((event?: unknown) => void)[]> = {};
  playRejection: Error | null = null;
  playThrows: Error | null = null;
  pauseThrows: Error | null = null;
  cloneThrows: Error | null = null;

  constructor(src = "") {
    this.src = src;
    createdAudios.push(this);
  }

  get currentSrc(): string {
    return this.src;
  }

  addEventListener(event: string, listener: (event?: unknown) => void): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(listener);
  }

  removeEventListener(
    event: string,
    listener: (event?: unknown) => void,
  ): void {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(
        (l) => l !== listener,
      );
    }
  }

  dispatchEvent(event: { type: string } | string): boolean {
    const type = typeof event === "string" ? event : event.type;
    this.listeners[type]?.forEach((l) => l(event));
    return true;
  }

  play(): Promise<void> {
    if (this.playThrows) throw this.playThrows;
    if (this.playRejection) return Promise.reject(this.playRejection);
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    if (this.pauseThrows) throw this.pauseThrows;
    this.paused = true;
  }

  cloneNode(_deep?: boolean): FakeAudioElement {
    if (this.cloneThrows) throw this.cloneThrows;
    const clone = new FakeAudioElement(this.src);
    clone.volume = this.volume;
    clone.preload = this.preload;
    clone.playbackRate = this.playbackRate;
    clone.playRejection = this.playRejection;
    clone.playThrows = this.playThrows;
    clone.pauseThrows = this.pauseThrows;
    return clone;
  }
}

class FakeSpeechSynthesisUtterance {
  text: string;
  rate = 1;
  pitch = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;

  constructor(text = "") {
    this.text = text;
    createdUtterances.push(this);
  }
}

function createFakeSpeechSynthesis() {
  const utterances: FakeSpeechSynthesisUtterance[] = [];
  return {
    utterances,
    speaking: false,
    speak: vi.fn((u: FakeSpeechSynthesisUtterance) => {
      utterances.push(u);
    }),
    cancel: vi.fn(() => {
      utterances.length = 0;
    }),
  };
}

let createdAudios: FakeAudioElement[] = [];
let createdUtterances: FakeSpeechSynthesisUtterance[] = [];
const originalAudio = window.Audio;

describe("sound", () => {
  let sound: typeof import("../sound");
  let fakeSpeechSynthesis: ReturnType<typeof createFakeSpeechSynthesis>;

  beforeEach(async () => {
    (Platform as { OS: string }).OS = "web";
    vi.unstubAllGlobals();
    vi.useFakeTimers();
    vi.resetModules();
    createdAudios = [];
    createdUtterances = [];

    window.localStorage.clear();
    window.Audio = FakeAudioElement as unknown as typeof Audio;
    fakeSpeechSynthesis = createFakeSpeechSynthesis();
    (window as unknown as { speechSynthesis: unknown }).speechSynthesis =
      fakeSpeechSynthesis;
    (
      window as unknown as { SpeechSynthesisUtterance: unknown }
    ).SpeechSynthesisUtterance = FakeSpeechSynthesisUtterance;
    (
      globalThis as unknown as { SpeechSynthesisUtterance: unknown }
    ).SpeechSynthesisUtterance = FakeSpeechSynthesisUtterance;
    delete (window as unknown as { __kgbAudioDebug?: unknown }).__kgbAudioDebug;

    sound = await import("../sound");
    sound.setMuted(false);
  });

  afterEach(() => {
    cleanup();
    sound?.stopNarration();
    (Platform as { OS: string }).OS = "web";
    vi.unstubAllGlobals();
    if (typeof window !== "undefined") {
      window.Audio = originalAudio;
      delete (window as unknown as { speechSynthesis?: unknown })
        .speechSynthesis;
      delete (window as unknown as { SpeechSynthesisUtterance?: unknown })
        .SpeechSynthesisUtterance;
      delete (window as unknown as { __kgbAudioDebug?: unknown })
        .__kgbAudioDebug;
    }
    delete (globalThis as unknown as { SpeechSynthesisUtterance?: unknown })
      .SpeechSynthesisUtterance;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("mute state and localStorage persistence", () => {
    it("initializes muted to false when localStorage has no entry", async () => {
      vi.resetModules();
      window.localStorage.clear();
      const s = await import("../sound");
      expect(s.isMuted()).toBe(false);
    });

    it("initializes muted to true when localStorage has muted entry", async () => {
      vi.resetModules();
      window.localStorage.setItem("kgb.sound.v1", "muted");
      const s = await import("../sound");
      expect(s.isMuted()).toBe(true);
    });

    it('sets muted to true and writes "muted" to localStorage', () => {
      sound.setMuted(true);
      expect(sound.isMuted()).toBe(true);
      expect(window.localStorage.getItem("kgb.sound.v1")).toBe("muted");
    });

    it('sets muted to false and writes "on" to localStorage', () => {
      sound.setMuted(true);
      sound.setMuted(false);
      expect(sound.isMuted()).toBe(false);
      expect(window.localStorage.getItem("kgb.sound.v1")).toBe("on");
    });

    it("swallows errors when localStorage.setItem throws", () => {
      vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      expect(() => sound.setMuted(true)).not.toThrow();
      expect(sound.isMuted()).toBe(true);
    });

    it("handles non-web Platform and missing window gracefully", async () => {
      (Platform as { OS: string }).OS = "ios";
      sound.setMuted(true);
      expect(sound.isMuted()).toBe(true);

      vi.resetModules();
      (Platform as { OS: string }).OS = "ios";
      const s1 = await import("../sound");
      expect(s1.isMuted()).toBe(false);

      vi.resetModules();
      (Platform as { OS: string }).OS = "web";
      const origStorage = Object.getOwnPropertyDescriptor(
        window,
        "localStorage",
      );
      Object.defineProperty(window, "localStorage", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      try {
        const s2 = await import("../sound");
        s2.setMuted(true);
        expect(s2.isMuted()).toBe(true);
      } finally {
        if (origStorage) {
          Object.defineProperty(window, "localStorage", origStorage);
        } else {
          delete (window as unknown as { localStorage?: unknown }).localStorage;
        }
      }
    });
  });

  describe("sfx", () => {
    it("plays all sfx types with correct audio source and volume", () => {
      sound.sfx.tap();
      expect(createdAudios[0].src).toBe("sfx/tap.mp3");
      expect(createdAudios[0].preload).toBe("auto");
      expect(createdAudios[1].volume).toBe(0.35);

      sound.sfx.good();
      expect(createdAudios[3].volume).toBe(0.5);

      sound.sfx.wrong();
      expect(createdAudios[5].volume).toBe(0.4);

      sound.sfx.wrong(0.8);
      expect(createdAudios[6].volume).toBe(0.8);

      sound.sfx.flip();
      expect(createdAudios[8].volume).toBe(0.35);

      sound.sfx.win();
      expect(createdAudios[10].volume).toBe(0.6);

      sound.sfx.boing();
      expect(createdAudios[12].volume).toBe(0.6);

      sound.sfx.boing(0.2);
      expect(createdAudios[13].volume).toBe(0.2);

      sound.sfx.thunder();
      expect(createdAudios[15].volume).toBe(0.75);
    });

    it("reuses cached Audio instance on repeated plays", () => {
      sound.sfx.tap();
      const initialCount = createdAudios.length; // 1 cache + 1 clone = 2
      sound.sfx.tap();
      // Only 1 new clone should be created; cache element is reused
      expect(createdAudios.length).toBe(initialCount + 1);
    });

    it("no-ops when muted, non-web, or window.Audio missing", () => {
      sound.setMuted(true);
      sound.sfx.tap();
      expect(createdAudios).toHaveLength(0);

      sound.setMuted(false);
      (Platform as { OS: string }).OS = "android";
      sound.sfx.tap();
      expect(createdAudios).toHaveLength(0);

      (Platform as { OS: string }).OS = "web";
      (window as unknown as { Audio?: unknown }).Audio = undefined;
      expect(() => sound.sfx.tap()).not.toThrow();
    });

    it("catches and ignores injected play() promise rejections", () => {
      FakeAudioElement.prototype.playRejection = new Error("Autoplay blocked");
      expect(() => sound.sfx.tap()).not.toThrow();
      FakeAudioElement.prototype.playRejection = null;
    });

    it("catches synchronous errors in play()", () => {
      FakeAudioElement.prototype.cloneThrows = new Error("Clone failed");
      expect(() => sound.sfx.tap()).not.toThrow();
      FakeAudioElement.prototype.cloneThrows = null;
    });
  });

  describe("speech lang and voice clips", () => {
    it("plays English clip matching VOICE hash and sets narration properties", () => {
      sound.say("A big egg!");
      const narration = createdAudios[0];
      expect(narration.src).toBe("voice/b5c04eb67ec79cec.mp3");
      expect(narration.volume).toBe(0.85);
      expect(narration.playbackRate).toBe(1.15);
    });

    it("strips emojis before looking up clip in VOICE", () => {
      sound.say("🥚 A big egg! 🐣");
      const narration = createdAudios[0];
      expect(narration.src).toBe("voice/b5c04eb67ec79cec.mp3");
    });

    it("looks up language-prefixed clip when speechLang is set", () => {
      sound.setSpeechLang("cmn");
      sound.say("一个大鸡蛋！");
      const narration = createdAudios[0];
      expect(narration.src).toBe("voice/c9599acd5f465456.mp3");
    });

    it("falls back to English clip if non-English key does not exist", () => {
      sound.setSpeechLang("cmn");
      sound.say("A flamingo!");
      const narration = createdAudios[0];
      expect(narration.src).toBe("voice/1b03801ffd5e3cfa.mp3");
    });

    it("catches narration play() rejection cleanly", () => {
      FakeAudioElement.prototype.playRejection = new Error(
        "Narration play rejected",
      );
      expect(() => sound.say("A big egg!")).not.toThrow();
      FakeAudioElement.prototype.playRejection = null;
    });
  });

  describe("narration debug hook", () => {
    it("ignores silent unlock data: URI but increments on narration playing", () => {
      sound.say("A big egg!");
      const narration = createdAudios[0];

      narration.src = "data:audio/wav;base64,silent";
      narration.dispatchEvent("playing");
      const debug1 = (
        window as unknown as {
          __kgbAudioDebug?: { playing: number; lastSrc: string };
        }
      ).__kgbAudioDebug;
      expect(debug1).toBeUndefined();

      narration.src = "voice/b5c04eb67ec79cec.mp3";
      narration.dispatchEvent("playing");
      const debug2 = (
        window as unknown as {
          __kgbAudioDebug?: { playing: number; lastSrc: string };
        }
      ).__kgbAudioDebug;
      expect(debug2).toEqual({
        playing: 1,
        lastSrc: "voice/b5c04eb67ec79cec.mp3",
      });

      narration.dispatchEvent("playing");
      const debug3 = (
        window as unknown as {
          __kgbAudioDebug?: { playing: number; lastSrc: string };
        }
      ).__kgbAudioDebug;
      expect(debug3?.playing).toBe(2);
    });
  });

  describe("first gesture unlock and pending narration", () => {
    it("primes silent WAV and executes pending narration on gesture", () => {
      sound.say("A big egg!");
      expect(createdAudios).toHaveLength(1);
      expect(createdAudios[0].src).toBe("voice/b5c04eb67ec79cec.mp3");

      // Dispatch first gesture event
      window.dispatchEvent(new Event("pointerdown"));

      // Silent WAV was loaded for unlocking
      expect(createdAudios[0].src).toContain("data:audio/wav;base64");

      // Advance timers for the queued saySequence
      vi.advanceTimersByTime(0);
      expect(createdAudios[0].src).toBe("voice/b5c04eb67ec79cec.mp3");
    });

    it("guards pending narration with token so navigation cancels it", () => {
      sound.say("A big egg!");

      // User taps a button: gesture fires and queues pendingNarration
      window.dispatchEvent(new Event("pointerdown"));

      // Before timer ticks, screen changes and stops narration (bumps token)
      sound.stopNarration();

      // Advancing timer does NOT replay stale queue
      vi.advanceTimersByTime(0);
      expect(createdAudios[0].src).toContain("data:audio/wav;base64");
    });

    it("supports custom sequence in say() pending narration", () => {
      sound.say("A big egg!", ["A flamingo!"]);
      window.dispatchEvent(new Event("touchstart"));

      vi.advanceTimersByTime(0);
      expect(createdAudios[0].src).toBe("voice/1b03801ffd5e3cfa.mp3");
    });

    it("catches play() rejection during prime unlock", () => {
      FakeAudioElement.prototype.playRejection = new Error(
        "Prime play rejected",
      );
      expect(() => window.dispatchEvent(new Event("keydown"))).not.toThrow();
      FakeAudioElement.prototype.playRejection = null;
    });
  });

  describe("fadeStop and stopNarration", () => {
    it("decrements volume in 30ms steps of 0.12 and pauses at <= 0.08", () => {
      sound.say("A big egg!");
      const narration = createdAudios[0];
      narration.paused = false;
      narration.volume = 0.85;

      sound.stopNarration();
      // Step 0: immediately decreased by 0.12
      expect(narration.volume).toBeCloseTo(0.73, 2);
      expect(narration.paused).toBe(false);

      vi.advanceTimersByTime(30);
      expect(narration.volume).toBeCloseTo(0.61, 2);

      vi.advanceTimersByTime(30);
      expect(narration.volume).toBeCloseTo(0.49, 2);

      vi.advanceTimersByTime(30);
      expect(narration.volume).toBeCloseTo(0.37, 2);

      vi.advanceTimersByTime(30);
      expect(narration.volume).toBeCloseTo(0.25, 2);

      vi.advanceTimersByTime(30);
      expect(narration.volume).toBeCloseTo(0.13, 2);

      vi.advanceTimersByTime(30);
      expect(narration.volume).toBeCloseTo(0.01, 2);

      vi.advanceTimersByTime(30);
      // Volume dropped to <= 0.08; paused called
      expect(narration.paused).toBe(true);
    });

    it("clears active fadeTimer if a new stopNarration or say is called", () => {
      sound.say("A big egg!");
      const narration = createdAudios[0];
      narration.paused = false;
      narration.volume = 0.85;

      sound.stopNarration();
      expect(narration.volume).toBeCloseTo(0.73, 2);

      // Calling stopNarration again resets the step
      narration.volume = 0.85;
      sound.stopNarration();
      expect(narration.volume).toBeCloseTo(0.73, 2);

      // Calling say() also clears fade timer
      sound.say("A flamingo!");
      vi.advanceTimersByTime(30);
      expect(narration.volume).toBe(0.85);
    });

    it("no-ops when non-web or narration is already paused", () => {
      (Platform as { OS: string }).OS = "ios";
      expect(() => sound.stopNarration()).not.toThrow();

      (Platform as { OS: string }).OS = "web";
      sound.say("A big egg!");
      const narration = createdAudios[0];
      narration.paused = true;
      sound.stopNarration();
      expect(narration.volume).toBe(0.85);
    });

    it("swallows errors when pause or speechSynthesis.cancel throw", () => {
      sound.say("A big egg!");
      const narration = createdAudios[0];
      narration.paused = false;
      narration.pauseThrows = new Error("Pause failed");

      fakeSpeechSynthesis.cancel = vi.fn(() => {
        throw new Error("Cancel failed");
      });

      sound.stopNarration();
      vi.advanceTimersByTime(250);
      expect(() => sound.stopNarration()).not.toThrow();
    });
  });

  describe("speechSynthesis fallback", () => {
    it("speaks via SpeechSynthesisUtterance when clip is not in VOICE", () => {
      sound.say("A completely unrecorded novel instruction line");
      expect(fakeSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
      expect(createdUtterances).toHaveLength(1);

      const u = createdUtterances[0];
      expect(u.text).toBe("A completely unrecorded novel instruction line");
      expect(u.rate).toBe(1.0);
      expect(u.pitch).toBe(1.12);

      expect(() => u.onstart?.()).not.toThrow();
    });

    it("executes onEnded in fallback utterance if token matches", () => {
      const done = vi.fn();
      sound.saySequence(["Unrecorded clip 1", "Unrecorded clip 2"], done);
      expect(createdUtterances).toHaveLength(1);

      createdUtterances[0].onend?.();
      expect(createdUtterances).toHaveLength(2);

      createdUtterances[1].onend?.();
      expect(done).toHaveBeenCalledTimes(1);
    });

    it("ignores onend in fallback utterance if superseded by stopNarration", () => {
      const done = vi.fn();
      sound.saySequence(["Unrecorded clip 1", "Unrecorded clip 2"], done);
      expect(createdUtterances).toHaveLength(1);

      sound.stopNarration();
      createdUtterances[0].onend?.();
      expect(createdUtterances).toHaveLength(1);
      expect(done).not.toHaveBeenCalled();
    });

    it("handles missing speechSynthesis or speak error gracefully", () => {
      delete (window as unknown as { speechSynthesis?: unknown })
        .speechSynthesis;
      expect(() => sound.say("Unrecorded clip")).not.toThrow();

      (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
        speak: vi.fn(() => {
          throw new Error("TTS failed");
        }),
        cancel: vi.fn(),
      };
      expect(() => sound.say("Unrecorded clip")).not.toThrow();
    });
  });

  describe("sequences and sayThen", () => {
    it("plays clips in order and calls onDone on completion", () => {
      const onDone = vi.fn();
      sound.saySequence(["A big egg!", "A flamingo!"], onDone);

      const narration = createdAudios[0];
      expect(narration.src).toBe("voice/b5c04eb67ec79cec.mp3");
      expect(onDone).not.toHaveBeenCalled();

      narration.onended?.();
      expect(narration.src).toBe("voice/1b03801ffd5e3cfa.mp3");
      expect(onDone).not.toHaveBeenCalled();

      narration.onended?.();
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("filters empty strings and handles empty sequence immediately", () => {
      const done1 = vi.fn();
      sound.saySequence(["", "A big egg!", ""], done1);
      expect(createdAudios[0].src).toBe("voice/b5c04eb67ec79cec.mp3");

      const done2 = vi.fn();
      sound.saySequence([], done2);
      expect(done2).toHaveBeenCalledTimes(1);
    });

    it("aborts sequence continuation when token changes", () => {
      sound.saySequence(["A big egg!", "A flamingo!"]);
      const narration = createdAudios[0];

      sound.stopNarration();
      narration.onended?.();
      // Did not advance to 'A flamingo!'
      expect(narration.src).toBe("voice/b5c04eb67ec79cec.mp3");
    });

    it("sayThen: runs done callback when narration sequence completes", () => {
      const done = vi.fn();
      sound.sayThen(["A big egg!"], done);

      expect(done).not.toHaveBeenCalled();
      createdAudios[0].onended?.();
      expect(done).toHaveBeenCalledTimes(1);
    });

    it("sayThen: immediately fires done when superseded by saySequence", () => {
      const done = vi.fn();
      sound.sayThen(["A big egg!"], done);

      expect(done).not.toHaveBeenCalled();
      sound.saySequence(["A flamingo!"]);
      expect(done).toHaveBeenCalledTimes(1);
    });

    it("sayThen: immediately fires done when superseded by say", () => {
      const done = vi.fn();
      sound.sayThen(["A big egg!"], done);

      expect(done).not.toHaveBeenCalled();
      sound.say("A flamingo!");
      expect(done).toHaveBeenCalledTimes(1);
    });

    it("sayThen: immediately fires done when superseded by stopNarration", () => {
      const done = vi.fn();
      sound.sayThen(["A big egg!"], done);

      expect(done).not.toHaveBeenCalled();
      sound.stopNarration();
      expect(done).toHaveBeenCalledTimes(1);
    });

    it("sayThen: immediately fires done when superseded by another sayThen", () => {
      const done1 = vi.fn();
      const done2 = vi.fn();
      sound.sayThen(["A big egg!"], done1);

      expect(done1).not.toHaveBeenCalled();
      sound.sayThen(["A flamingo!"], done2);

      expect(done1).toHaveBeenCalledTimes(1);
      expect(done2).not.toHaveBeenCalled();
    });

    it("sayThen: fires done when capMs fallback elapses without completion", () => {
      const done = vi.fn();
      sound.sayThen(["A big egg!"], done, 5000);

      expect(done).not.toHaveBeenCalled();
      vi.advanceTimersByTime(4999);
      expect(done).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(done).toHaveBeenCalledTimes(1);
    });

    it("sayThen: fires done after 600ms fallback when muted or non-web", () => {
      sound.setMuted(true);
      const done1 = vi.fn();
      sound.sayThen(["A big egg!"], done1);

      expect(done1).not.toHaveBeenCalled();
      vi.advanceTimersByTime(599);
      expect(done1).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(done1).toHaveBeenCalledTimes(1);

      sound.setMuted(false);
      (Platform as { OS: string }).OS = "ios";
      const done2 = vi.fn();
      sound.sayThen(["A big egg!"], done2);
      vi.advanceTimersByTime(600);
      expect(done2).toHaveBeenCalledTimes(1);
    });

    it("sayThen: fires done immediately for empty texts", () => {
      const done = vi.fn();
      sound.sayThen([], done);
      expect(done).toHaveBeenCalledTimes(1);
    });
  });

  describe("useSay hook and early exits", () => {
    function UseSayComponent({ text }: { text: string | null }) {
      sound.useSay(text);
      return null;
    }

    it("executes effect to speak text on mount and prop changes via useSay", () => {
      const { rerender } = render(
        React.createElement(UseSayComponent, { text: "A big egg!" }),
      );
      expect(createdAudios.length).toBeGreaterThan(0);
      expect(createdAudios[0].src).toBe("voice/b5c04eb67ec79cec.mp3");

      // Rerender with null stays silent without new audio creation
      const countBefore = createdAudios.length;
      rerender(React.createElement(UseSayComponent, { text: null }));
      expect(createdAudios.length).toBe(countBefore);

      // Rerender with new text triggers speech for new line
      rerender(React.createElement(UseSayComponent, { text: "A flamingo!" }));
      expect(createdAudios[0].src).toBe("voice/1b03801ffd5e3cfa.mp3");
    });

    it("early-returns in say and saySequence when muted or non-web", () => {
      sound.setMuted(true);
      sound.say("A big egg!");
      expect(createdAudios).toHaveLength(0);

      sound.saySequence(["A big egg!"]);
      expect(createdAudios).toHaveLength(0);

      sound.setMuted(false);
      (Platform as { OS: string }).OS = "ios";
      sound.say("A big egg!");
      expect(createdAudios).toHaveLength(0);
    });

    it("early-returns in say, sfx, and stopNarration when window is undefined", () => {
      vi.stubGlobal("window", undefined);
      expect(() => sound.say("A big egg!")).not.toThrow();
      expect(() => sound.stopNarration()).not.toThrow();
      expect(() => sound.sfx.tap()).not.toThrow();
    });
  });
});
