import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from "vitest";
import {
  primeMusic,
  playNote,
  playSequence,
  stopSequence,
  playDrum,
  playDrumSequence,
  SeqNote,
} from "../music";
import * as soundModule from "../sound";

describe("music", () => {
  const mockOsc = {
    type: "",
    frequency: {
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };

  const mockGain = {
    gain: {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };

  const mockBufferSource = {
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };

  const mockAudioContext = {
    state: "suspended",
    currentTime: 0,
    sampleRate: 44100,
    resume: vi.fn().mockResolvedValue(undefined),
    createGain: vi.fn().mockReturnValue(mockGain),
    createOscillator: vi.fn().mockReturnValue(mockOsc),
    createBuffer: vi.fn().mockReturnValue({
      getChannelData: vi.fn().mockReturnValue(new Float32Array(1000)),
    }),
    createBufferSource: vi.fn().mockReturnValue(mockBufferSource),
    destination: {},
  };

  beforeAll(() => {
    class MockAudioContextClass {
      constructor() {
        return mockAudioContext;
      }
    }
    vi.stubGlobal("window", { AudioContext: MockAudioContextClass });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(soundModule, "isMuted").mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes and primes AudioContext", () => {
    primeMusic();
    expect(mockAudioContext.resume).toHaveBeenCalled();
  });

  it("playNote schedules oscillator and gain nodes", () => {
    playNote(60, 1);
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockAudioContext.createGain).toHaveBeenCalled();
    expect(mockOsc.start).toHaveBeenCalled();
  });

  it("does not play note if muted", () => {
    vi.spyOn(soundModule, "isMuted").mockReturnValue(true);
    playNote(60, 1);
    expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
  });

  it("playSequence schedules notes and respects onNote/onDone callbacks", async () => {
    vi.useFakeTimers();
    const onNote = vi.fn();
    const onDone = vi.fn();
    const notes: SeqNote[] = [
      { m: 60, b: 1 },
      { m: 62, b: 1 },
    ];

    const cancel = playSequence(notes, 120, onNote, onDone);

    expect(mockAudioContext.createOscillator).toHaveBeenCalled();

    // Advance timers to trigger callbacks
    vi.runAllTimers();

    expect(onNote).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledTimes(1);

    cancel();
    vi.useRealTimers();
  });

  it("playSequence handles empty notes", () => {
    const onDone = vi.fn();
    const cancel = playSequence([], 120, undefined, onDone);
    expect(onDone).toHaveBeenCalled();
    cancel();
  });

  it("stopSequence cancels the current sequence", () => {
    vi.useFakeTimers();
    const onNote = vi.fn();
    playSequence([{ m: 60, b: 1 }], 120, onNote);
    stopSequence();
    vi.runAllTimers();
    expect(onNote).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("playDrum schedules noise and oscillator", () => {
    playDrum();
    expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
  });

  it("playDrumSequence schedules drums and respects callbacks", () => {
    vi.useFakeTimers();
    const onHit = vi.fn();
    const onDone = vi.fn();
    const cancel = playDrumSequence([0.5, 0.5], onHit, onDone);

    expect(mockAudioContext.createBufferSource).toHaveBeenCalled();

    vi.runAllTimers();

    expect(onHit).toHaveBeenCalledTimes(3); // gaps + 1
    expect(onDone).toHaveBeenCalledTimes(1);

    cancel();
    vi.useRealTimers();
  });

  it("playDrumSequence does not play if muted", () => {
    vi.spyOn(soundModule, "isMuted").mockReturnValue(true);
    const onDone = vi.fn();
    playDrumSequence([0.5], undefined, onDone);
    expect(onDone).toHaveBeenCalled();
    expect(mockAudioContext.createBufferSource).not.toHaveBeenCalled();
  });

  it("playSequence does not play if muted", () => {
    vi.spyOn(soundModule, "isMuted").mockReturnValue(true);
    const onDone = vi.fn();
    playSequence([{ m: 60, b: 1 }], 120, undefined, onDone);
    expect(onDone).toHaveBeenCalled();
    expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
  });

  it("handles environment without window (e.g. Node) safely", () => {
    vi.unstubAllGlobals();
    primeMusic();
    playNote(60);
    playSequence([{ m: 60, b: 1 }], 120);
    playDrum();
    playDrumSequence([0.5]);
    stopSequence();
    // Re-stub for any subsequent tests
    class MockAudioContextClass {
      constructor() {
        return mockAudioContext;
      }
    }
    vi.stubGlobal("window", { AudioContext: MockAudioContextClass });
  });
});
