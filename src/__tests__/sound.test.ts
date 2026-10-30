// @vitest-environment happy-dom
import { Platform } from "react-native";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { manifest } from "../manifest";
import { VOICE } from "../assets/voice";

describe("sound sayThen", () => {
  let sound: typeof import("../sound");
  let lastAudio: HTMLAudioElement | null = null;
  let playImpl: () => Promise<void>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    lastAudio = null;
    playImpl = () => Promise.resolve();

    const originalAudio = window.Audio;
    vi.spyOn(window, "Audio").mockImplementation(function () {
      const a = new originalAudio();
      lastAudio = a;
      vi.spyOn(a, "play").mockImplementation(() => playImpl());
      return a;
    });

    sound = await import("../sound");
    sound.setMuted(false);
  });

  afterEach(() => {
    sound.stopNarration();
    window.dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(0);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("runs done callback when narration sequence completes", () => {
    const done = vi.fn();
    sound.sayThen(["A big egg!"], done);

    expect(done).not.toHaveBeenCalled();
    expect(lastAudio).not.toBeNull();
    lastAudio?.onended?.(new Event("ended"));

    expect(done).toHaveBeenCalledTimes(1);
  });

  it("immediately fires done when superseded by saySequence", () => {
    const done = vi.fn();
    sound.sayThen(["A big egg!"], done);

    expect(done).not.toHaveBeenCalled();
    sound.saySequence(["A flamingo!"]);

    expect(done).toHaveBeenCalledTimes(1);
  });

  it("immediately fires done when superseded by say", () => {
    const done = vi.fn();
    sound.sayThen(["A big egg!"], done);

    expect(done).not.toHaveBeenCalled();
    sound.say("A flamingo!");

    expect(done).toHaveBeenCalledTimes(1);
  });

  it("immediately fires done when superseded by stopNarration", () => {
    const done = vi.fn();
    sound.sayThen(["A big egg!"], done);

    expect(done).not.toHaveBeenCalled();
    sound.stopNarration();

    expect(done).toHaveBeenCalledTimes(1);
  });

  it("immediately fires done when superseded by another sayThen", () => {
    const done1 = vi.fn();
    const done2 = vi.fn();
    sound.sayThen(["A big egg!"], done1);

    expect(done1).not.toHaveBeenCalled();
    sound.sayThen(["A flamingo!"], done2);

    expect(done1).toHaveBeenCalledTimes(1);
    expect(done2).not.toHaveBeenCalled();
  });

  it("fires done when capMs fallback elapses without completion", () => {
    const done = vi.fn();
    sound.sayThen(["A big egg!"], done, 5000);

    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4999);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("fires done after 600ms fallback when muted", () => {
    sound.setMuted(true);
    expect(sound.isMuted()).toBe(true);

    const done = vi.fn();
    sound.sayThen(["A big egg!"], done);

    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(599);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("fires done immediately for empty texts", () => {
    const done = vi.fn();
    sound.sayThen([], done);

    expect(done).toHaveBeenCalledTimes(1);
  });

  it("does not prematurely resolve active sayThen on first gesture until audio ends", () => {
    let unlocked = false;
    playImpl = () =>
      unlocked
        ? Promise.resolve()
        : Promise.reject(new Error("NotAllowedError"));

    const done = vi.fn();
    sound.sayThen(["A big egg!"], done);

    expect(done).not.toHaveBeenCalled();

    unlocked = true;
    window.dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(0);

    expect(done).not.toHaveBeenCalled();
    expect(lastAudio).not.toBeNull();

    lastAudio?.onended?.(new Event("ended"));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("resolves active sayThen if superseded after first gesture replay starts", () => {
    let unlocked = false;
    playImpl = () =>
      unlocked
        ? Promise.resolve()
        : Promise.reject(new Error("NotAllowedError"));

    const done = vi.fn();
    sound.sayThen(["A big egg!"], done);

    unlocked = true;
    window.dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(0);

    // Call say while audio is playing
    sound.say("A flamingo!");
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("runs saySequence onDone callback when completed on first gesture", () => {
    let unlocked = false;
    playImpl = () =>
      unlocked
        ? Promise.resolve()
        : Promise.reject(new Error("NotAllowedError"));

    const done = vi.fn();
    sound.saySequence(["A big egg!"], done);

    expect(done).not.toHaveBeenCalled();

    unlocked = true;
    window.dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(0);

    expect(done).not.toHaveBeenCalled();
    lastAudio?.onended?.(new Event("ended"));

    expect(done).toHaveBeenCalledTimes(1);
  });

  it("does not cut off or replay clip on first gesture if autoplay succeeded without gesture", async () => {
    playImpl = () => Promise.resolve();

    sound.say("A big egg!");
    await Promise.resolve();

    const playSpy = vi.spyOn(lastAudio!, "play");
    expect(playSpy).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(0);

    // Audio should not be interrupted by primeUnlock() nor restarted by pendingNarration
    expect(lastAudio?.src).toContain("b5c04eb67ec79cec.mp3");
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it("does not restart sequence on first gesture if sequence autoplays successfully", async () => {
    playImpl = () => Promise.resolve();

    const done = vi.fn();
    sound.saySequence(["A big egg!", "A flamingo!"], done);
    await Promise.resolve();

    const playSpy = vi.spyOn(lastAudio!, "play");
    expect(playSpy).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(0);

    // Initial clip should not be interrupted by primeUnlock() nor restarted
    expect(lastAudio?.src).toContain("b5c04eb67ec79cec.mp3");
    expect(playSpy).toHaveBeenCalledTimes(1);

    // Initial clip finishes
    lastAudio?.onended?.(new Event("ended"));
    await Promise.resolve();

    // Second clip plays without restarting the first clip
    expect(lastAudio?.src).toContain("1b03801ffd5e3cfa.mp3");
    expect(playSpy).toHaveBeenCalledTimes(2);
    expect(done).not.toHaveBeenCalled();

    lastAudio?.onended?.(new Event("ended"));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["Dig here! 🕳️", "3f54f31a6f128ce6.mp3"],
    ["Climb the creaky stairs 🕯️", "952207cd8f643afa.mp3"],
    ["Ask about the key 🗝️", "4d4765717337da1c.mp3"],
    ["Sit with the Twins 🗣️", "3df1acce7b5b6003.mp3"],
    ["Try the trash-can trick 🗑️", "143dd3740969f64e.mp3"],
  ])(
    "plays pre-rendered voice clip for %s with variation selector",
    async (rawText, expectedClip) => {
      playImpl = () => Promise.resolve();

      sound.say(rawText);
      await Promise.resolve();

      expect(lastAudio?.src).toContain(expectedClip);
    },
  );
});

class FakeUtterance {
  text: string;
  lang = "";
  rate = 1;
  pitch = 1;
  onstart?: () => void;
  onend?: () => void;
  constructor(text: string) {
    this.text = text;
  }
}

describe("sound module", () => {
  let speakMock: Mock<(u: FakeUtterance) => void>;
  let cancelMock: Mock<() => void>;
  let sound: typeof import("../sound");

  beforeEach(async () => {
    vi.resetModules();
    (Platform as { OS: string }).OS = "web";
    speakMock = vi.fn();
    cancelMock = vi.fn();

    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    vi.stubGlobal("window", {
      speechSynthesis: {
        speak: speakMock,
        cancel: cancelMock,
      },
      localStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    sound = await import("../sound");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("speech synthesis fallback lang", () => {
    it.each([
      ["ja", "ja-JP"],
      ["cmn", "zh-CN"],
      ["yue", "zh-HK"],
      ["en", "en-US"],
      ["other", "en-US"],
    ] as const)(
      "sets u.lang to %s when speechLang is %s",
      (lang, expectedBcp47) => {
        sound.setSpeechLang(lang);
        sound.say("unmapped phrase for test");

        expect(speakMock).toHaveBeenCalledTimes(1);
        const utterance = speakMock.mock.calls[0][0];
        expect(utterance.text).toBe("unmapped phrase for test");
        expect(utterance.lang).toBe(expectedBcp47);
        expect(utterance.rate).toBe(1.0);
        expect(utterance.pitch).toBe(1.12);
      },
    );

    it("sets u.lang across saySequence fallback", () => {
      sound.setSpeechLang("ja");
      sound.saySequence(["unmapped first", "unmapped second"]);

      expect(speakMock).toHaveBeenCalledTimes(1);
      const first = speakMock.mock.calls[0][0];
      expect(first.lang).toBe("ja-JP");
      expect(first.text).toBe("unmapped first");

      // Trigger onend to proceed to next item in sequence
      first.onend?.();
      expect(speakMock).toHaveBeenCalledTimes(2);
      const second = speakMock.mock.calls[1][0];
      expect(second.lang).toBe("ja-JP");
      expect(second.text).toBe("unmapped second");
    });

    it("strips emojis and variation selectors from speech synthesis fallback text", () => {
      sound.say("unmapped phrase with variation 🕳️");

      expect(speakMock).toHaveBeenCalledTimes(1);
      const utterance = speakMock.mock.calls[0][0];
      expect(utterance.text).toBe("unmapped phrase with variation");
    });

    it("toggles muted status and respects muted state", () => {
      expect(sound.isMuted()).toBe(false);
      sound.setMuted(true);
      expect(sound.isMuted()).toBe(true);

      sound.say("will not speak because muted");
      expect(speakMock).not.toHaveBeenCalled();

      sound.setMuted(false);
      expect(sound.isMuted()).toBe(false);
    });
  });

  describe("localStorage and muted state", () => {
    it("loads saved muted state from localStorage on web", async () => {
      vi.resetModules();
      vi.stubGlobal("window", {
        speechSynthesis: { speak: speakMock, cancel: cancelMock },
        localStorage: {
          getItem: vi.fn((key: string) =>
            key === "kgb.sound.v1" ? "muted" : null,
          ),
          setItem: vi.fn(),
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });
      const s = await import("../sound");
      expect(s.isMuted()).toBe(true);
    });

    it("defaults to false when localStorage.getItem throws SecurityError", async () => {
      vi.resetModules();
      vi.stubGlobal("window", {
        speechSynthesis: { speak: speakMock, cancel: cancelMock },
        localStorage: {
          getItem: vi.fn(() => {
            throw new Error("SecurityError");
          }),
          setItem: vi.fn(),
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });
      const s = await import("../sound");
      expect(s.isMuted()).toBe(false);
    });

    it("defaults to false when window.localStorage access throws SecurityError", async () => {
      vi.resetModules();
      const fakeWindow = {
        speechSynthesis: { speak: speakMock, cancel: cancelMock },
        get localStorage(): Storage {
          throw new Error("SecurityError");
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      vi.stubGlobal("window", fakeWindow);
      const s = await import("../sound");
      expect(s.isMuted()).toBe(false);
    });
  });

  describe("escape room audio clip availability", () => {
    it("has pre-rendered voice clips in VOICE for all localized escape room lines", () => {
      const clean = (s: string) =>
        s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
      const langs = ["ja", "cmn", "yue"] as const;

      for (const room of manifest.escape ?? []) {
        for (const lang of langs) {
          const intro = room.t?.[lang]?.intro;
          if (intro) {
            const key = `${lang}|${clean(intro)}`;
            expect(
              VOICE[key],
              `Missing intro clip for ${room.id} [${lang}]`,
            ).toBeDefined();
          }

          const winText = room.t?.[lang]?.winText;
          if (winText) {
            const key = `${lang}|${clean(winText)}`;
            expect(
              VOICE[key],
              `Missing winText clip for ${room.id} [${lang}]`,
            ).toBeDefined();
          }

          for (const item of room.items ?? []) {
            const label = item.t?.[lang];
            if (label) {
              const key = `${lang}|${clean(label)}`;
              expect(
                VOICE[key],
                `Missing item clip for ${room.id}/${item.id} [${lang}]`,
              ).toBeDefined();
            }
          }

          for (const hotspot of room.hotspots ?? []) {
            for (const field of [
              "sayFound",
              "saySearch",
              "sayLocked",
            ] as const) {
              const text = hotspot.t?.[lang]?.[field];
              if (text) {
                const key = `${lang}|${clean(text)}`;
                expect(
                  VOICE[key],
                  `Missing hotspot clip for ${room.id}/${hotspot.id}.${field} [${lang}]`,
                ).toBeDefined();
              }
            }
          }
        }
      }
    });
  });
});
