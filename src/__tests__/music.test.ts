import { Platform } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RampMethods = 'setValueAtTime' | 'linearRampToValueAtTime' | 'exponentialRampToValueAtTime';
type FakeAudioParam = Pick<AudioParam, 'value'> & Pick<AudioParam, RampMethods>;

type FakeGainNode = Omit<Partial<GainNode>, 'gain' | 'disconnect'> & {
  gain: FakeAudioParam;
  connectedTo: unknown[];
  disconnect: ReturnType<typeof vi.fn>;
};

type FakeOscillatorNode = Omit<Partial<OscillatorNode>, 'frequency'> & {
  type: OscillatorType;
  frequency: FakeAudioParam;
  connectedTo: unknown[];
  startedAt?: number;
  stoppedAt?: number;
};

type FakeBufferSourceNode = Partial<AudioBufferSourceNode> & {
  buffer?: AudioBuffer | null;
  connectedTo: unknown[];
  startedAt?: number;
  stoppedAt?: number;
};

type FakeAudioContext = Partial<AudioContext> & {
  state: AudioContextState;
  currentTime: number;
  sampleRate: number;
  destination: AudioDestinationNode;
  resumeCalls: number;
  resumeRejects: boolean;
  gains: FakeGainNode[];
  oscillators: FakeOscillatorNode[];
  bufferSources: FakeBufferSourceNode[];
};

function createFakeParam(val = 0): FakeAudioParam {
  const ramp = (v: number) => {
    p.value = v;
    return p as unknown as AudioParam;
  };
  const p: FakeAudioParam = {
    value: val,
    setValueAtTime: vi.fn(ramp),
    linearRampToValueAtTime: vi.fn(ramp),
    exponentialRampToValueAtTime: vi.fn(ramp),
  };
  return p;
}

function createFakeGain(): FakeGainNode {
  const connectedTo: unknown[] = [];
  return {
    gain: createFakeParam(1),
    connectedTo,
    connect: vi.fn((t: unknown) => {
      connectedTo.push(t);
      return t as AudioNode;
    }) as unknown as GainNode['connect'],
    disconnect: vi.fn(() => {
      connectedTo.length = 0;
    }),
  };
}

function createFakeOscillator(): FakeOscillatorNode {
  const connectedTo: unknown[] = [];
  const osc: FakeOscillatorNode = {
    type: 'sine',
    frequency: createFakeParam(440),
    connectedTo,
    connect: vi.fn((t: unknown) => {
      connectedTo.push(t);
      return t as AudioNode;
    }) as unknown as OscillatorNode['connect'],
    start: vi.fn((w?: number) => void (osc.startedAt = w)),
    stop: vi.fn((w?: number) => void (osc.stoppedAt = w)),
  };
  return osc;
}

function createFakeBufferSource(): FakeBufferSourceNode {
  const connectedTo: unknown[] = [];
  const src: FakeBufferSourceNode = {
    buffer: null,
    connectedTo,
    connect: vi.fn((t: unknown) => {
      connectedTo.push(t);
      return t as AudioNode;
    }) as unknown as AudioBufferSourceNode['connect'],
    start: vi.fn((w?: number) => void (src.startedAt = w)),
    stop: vi.fn((w?: number) => void (src.stoppedAt = w)),
  };
  return src;
}

function track<T, R>(list: T[], item: T): R {
  list.push(item);
  return item as unknown as R;
}

function createFakeAudioContext(state: AudioContextState = 'running'): FakeAudioContext {
  const destination = {} as AudioDestinationNode;
  const gains: FakeGainNode[] = [];
  const oscillators: FakeOscillatorNode[] = [];
  const bufferSources: FakeBufferSourceNode[] = [];

  const ctx: FakeAudioContext = {
    state,
    currentTime: 10,
    sampleRate: 44100,
    destination,
    resumeCalls: 0,
    resumeRejects: false,
    gains,
    oscillators,
    bufferSources,
    resume: vi.fn(() => {
      ctx.resumeCalls++;
      if (ctx.resumeRejects) return Promise.reject(new Error());
      ctx.state = 'running';
      return Promise.resolve();
    }),
    createGain: vi.fn(() => track<FakeGainNode, GainNode>(gains, createFakeGain())),
    createOscillator: vi.fn(() => track<FakeOscillatorNode, OscillatorNode>(oscillators, createFakeOscillator())),
    createBufferSource: vi.fn(() =>
      track<FakeBufferSourceNode, AudioBufferSourceNode>(bufferSources, createFakeBufferSource()),
    ),
    createBuffer: vi.fn((_c: number, length: number) => {
      const data = new Float32Array(length);
      return { getChannelData: vi.fn(() => data) } as unknown as AudioBuffer;
    }),
  };
  return ctx;
}

function setupWebAudio(options?: { state?: AudioContextState; webkitOnly?: boolean }): FakeAudioContext {
  const fakeCtx = createFakeAudioContext(options?.state ?? 'running');
  const ctor = vi.fn(function () {
    return fakeCtx as unknown as AudioContext;
  });
  vi.stubGlobal('window', options?.webkitOnly ? { webkitAudioContext: ctor } : { AudioContext: ctor });
  return fakeCtx;
}

describe('music', () => {
  let music: typeof import('../music');
  let sound: typeof import('../sound');

  beforeEach(async () => {
    (Platform as { OS: string }).OS = 'web';
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
    sound = await import('../sound');
    sound.setMuted(false);
    music = await import('../music');
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = 'web';
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('no-ops when Platform.OS is not web, window missing, or context missing', () => {
    setupWebAudio();
    (Platform as { OS: string }).OS = 'ios';
    music.primeMusic();
    music.playNote(60);
    music.playDrum();
    const done1 = vi.fn();
    music.playSequence([{ m: 60, b: 1 }], 120, undefined, done1);
    expect(done1).toHaveBeenCalled();

    (Platform as { OS: string }).OS = 'web';
    vi.unstubAllGlobals();
    music.primeMusic();
    music.playNote(60);
    music.playDrum();
    const done2 = vi.fn();
    music.playDrumSequence([0.5], undefined, done2);
    expect(done2).toHaveBeenCalled();

    vi.stubGlobal('window', {});
    music.primeMusic();
    music.playNote(60);
  });

  it('supports webkitAudioContext fallback', () => {
    const fake = setupWebAudio({ webkitOnly: true });
    music.playNote(60);
    expect(fake.gains.length).toBeGreaterThan(0);
  });

  it('no-ops when muted', () => {
    const fake = setupWebAudio();
    sound.setMuted(true);
    music.playNote(60);
    music.playDrum();
    expect(fake.oscillators).toHaveLength(0);
    expect(fake.bufferSources).toHaveLength(0);
  });

  it('plays note sequence across beats when muted without scheduling audio', () => {
    vi.useFakeTimers();
    const fake = setupWebAudio();
    sound.setMuted(true);
    const onNote = vi.fn();
    const onDone = vi.fn();

    music.playSequence(
      [
        { m: 60, b: 1 },
        { m: 64, b: 1 },
      ],
      120,
      onNote,
      onDone,
    );
    expect(fake.oscillators).toHaveLength(0);

    vi.advanceTimersByTime(50);
    expect(onNote).toHaveBeenCalledWith(0);
    vi.advanceTimersByTime(500);
    expect(onNote).toHaveBeenCalledWith(1);
    vi.advanceTimersByTime(500);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('plays drum sequence across gaps when muted without scheduling audio', () => {
    vi.useFakeTimers();
    const fake = setupWebAudio();
    sound.setMuted(true);
    const onHit = vi.fn();
    const onDone = vi.fn();

    music.playDrumSequence([0.2, 0.4], onHit, onDone);
    expect(fake.oscillators).toHaveLength(0);
    expect(fake.bufferSources).toHaveLength(0);

    vi.advanceTimersByTime(50);
    expect(onHit).toHaveBeenCalledWith(0);
    vi.advanceTimersByTime(200);
    expect(onHit).toHaveBeenCalledWith(1);
    vi.advanceTimersByTime(400);
    expect(onHit).toHaveBeenCalledWith(2);
    vi.advanceTimersByTime(300);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('initializes master gain connected to destination', () => {
    const fake = setupWebAudio();
    music.primeMusic();
    expect(fake.gains).toHaveLength(1);
    expect(fake.gains[0].gain.value).toBe(0.6);
    expect(fake.gains[0].connectedTo).toContain(fake.destination);
  });

  it('resumes suspended context on primeMusic and handles rejection', () => {
    const fake = setupWebAudio({ state: 'suspended' });
    music.primeMusic();
    expect(fake.resumeCalls).toBe(1);

    fake.resumeRejects = true;
    fake.state = 'suspended';
    expect(() => music.primeMusic()).not.toThrow();

    fake.state = 'running';
    music.primeMusic();
    expect(fake.resumeCalls).toBe(2);
  });

  it('plays note with partials and ramps, resuming suspended context', () => {
    const fake = setupWebAudio({ state: 'suspended' });
    music.playNote(60, 0.8);
    expect(fake.resumeCalls).toBe(1);
    expect(fake.oscillators).toHaveLength(3);
    expect(fake.gains).toHaveLength(4);

    const baseFreq = 440 * Math.pow(2, (60 - 69) / 12);
    expect(fake.oscillators[0].frequency.value).toBeCloseTo(baseFreq * 1, 2);
    expect(fake.oscillators[1].frequency.value).toBeCloseTo(baseFreq * 4, 2);
    expect(fake.oscillators[2].frequency.value).toBeCloseTo(baseFreq * 5.4, 2);

    for (let i = 0; i < 3; i++) {
      expect(fake.oscillators[i].connectedTo).toContain(fake.gains[i + 1]);
      expect(fake.gains[i + 1].connectedTo).toContain(fake.gains[0]);
      expect(fake.oscillators[i].startedAt).toBe(fake.currentTime);
    }
  });

  it('plays sequence with scheduling and callbacks, resuming suspended context', () => {
    vi.useFakeTimers();
    const fake = setupWebAudio({ state: 'suspended' });
    const onNote = vi.fn();
    const onDone = vi.fn();

    music.playSequence(
      [
        { m: 60, b: 1 },
        { m: 64, b: 2 },
      ],
      120,
      onNote,
      onDone,
    );

    expect(fake.resumeCalls).toBe(1);
    expect(fake.oscillators).toHaveLength(6);

    vi.advanceTimersByTime(50);
    expect(onNote).toHaveBeenCalledWith(0);
    vi.advanceTimersByTime(500);
    expect(onNote).toHaveBeenCalledWith(1);
    vi.advanceTimersByTime(1000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('cancels playSequence before timers trigger and supports stopSequence', () => {
    vi.useFakeTimers();
    const fake = setupWebAudio();
    const onNote = vi.fn();

    const cancel = music.playSequence([{ m: 60, b: 1 }], 120, onNote);
    const seqGain1 = fake.gains[1];
    expect(seqGain1.connectedTo).toContain(fake.gains[0]);
    expect(fake.gains[2].connectedTo).toContain(seqGain1);

    cancel();
    expect(seqGain1.disconnect).toHaveBeenCalledTimes(1);
    expect(seqGain1.connectedTo).toHaveLength(0);
    vi.advanceTimersByTime(2000);
    expect(onNote).not.toHaveBeenCalled();

    music.playSequence([{ m: 60, b: 1 }], 120, onNote);
    const seqGain2 = fake.gains[5];
    expect(seqGain2.connectedTo).toContain(fake.gains[0]);
    music.stopSequence();
    expect(seqGain2.disconnect).toHaveBeenCalledTimes(1);
    expect(seqGain2.connectedTo).toHaveLength(0);
    music.stopSequence();
    vi.advanceTimersByTime(2000);
    expect(onNote).not.toHaveBeenCalled();
  });

  it('plays drum with noise and sweep, resuming suspended context', () => {
    const fake = setupWebAudio({ state: 'suspended' });
    music.playDrum(0.5);
    expect(fake.resumeCalls).toBe(1);
    expect(fake.bufferSources).toHaveLength(1);
    expect(fake.oscillators).toHaveLength(1);
    expect(fake.bufferSources[0].startedAt).toBe(fake.currentTime);
    expect(fake.oscillators[0].startedAt).toBe(fake.currentTime);

    const dest = createFakeGain();
    const c = fake as unknown as AudioContext;
    const d = dest as unknown as GainNode;
    music.scheduleDrum(c, d, 5, 0.6);
    expect(fake.bufferSources).toHaveLength(2);
    expect(fake.bufferSources[1].startedAt).toBe(5);
  });

  it('plays drum sequence across gaps, resuming suspended context', () => {
    vi.useFakeTimers();
    const fake = setupWebAudio({ state: 'suspended' });
    const onHit = vi.fn();
    const onDone = vi.fn();

    music.playDrumSequence([0.2, 0.4], onHit, onDone);
    expect(fake.resumeCalls).toBe(1);
    expect(fake.bufferSources).toHaveLength(3);
    expect(fake.oscillators).toHaveLength(3);

    vi.advanceTimersByTime(50);
    expect(onHit).toHaveBeenCalledWith(0);
    vi.advanceTimersByTime(200);
    expect(onHit).toHaveBeenCalledWith(1);
    vi.advanceTimersByTime(400);
    expect(onHit).toHaveBeenCalledWith(2);
    vi.advanceTimersByTime(300);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('handles empty inputs in playSequence', () => {
    const done1 = vi.fn();
    music.playSequence([], 120, undefined, done1)();
    expect(done1).toHaveBeenCalled();
  });

  it('plays 1-hit drum sequence when gaps is empty', () => {
    vi.useFakeTimers();
    setupWebAudio();
    const onHit = vi.fn();
    const onDone = vi.fn();
    
    music.playDrumSequence([], onHit, onDone);
    
    vi.advanceTimersByTime(50);
    expect(onHit).toHaveBeenCalledTimes(1);
    expect(onHit).toHaveBeenCalledWith(0);
    
    vi.advanceTimersByTime(300);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('cancels playDrumSequence through returned cancel and stopSequence', () => {
    vi.useFakeTimers();
    const fake = setupWebAudio();
    const onHit = vi.fn();
    const cancel = music.playDrumSequence([0.2], onHit);
    const seqGain1 = fake.gains[1];
    expect(seqGain1.connectedTo).toContain(fake.gains[0]);
    expect(fake.gains[2].connectedTo).toContain(seqGain1);
    expect(fake.gains[3].connectedTo).toContain(seqGain1);

    cancel();
    expect(seqGain1.disconnect).toHaveBeenCalledTimes(1);
    expect(seqGain1.connectedTo).toHaveLength(0);
    vi.advanceTimersByTime(1000);
    expect(onHit).not.toHaveBeenCalled();

    music.playDrumSequence([0.2], onHit);
    const seqGain2 = fake.gains[6];
    expect(seqGain2.connectedTo).toContain(fake.gains[0]);
    music.stopSequence();
    expect(seqGain2.disconnect).toHaveBeenCalledTimes(1);
    expect(seqGain2.connectedTo).toHaveLength(0);
    vi.advanceTimersByTime(1000);
    expect(onHit).not.toHaveBeenCalled();
  });
});
