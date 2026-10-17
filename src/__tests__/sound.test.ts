import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { say, saySequence, sayThen, stopNarration } from '../sound';

interface FakeAudioElement {
  src: string;
  playbackRate: number;
  volume: number;
  preload: string;
  onended: (() => void) | null;
  paused: boolean;
  play: () => Promise<void>;
  pause: () => void;
  addEventListener: (event: string, listener: () => void) => void;
  removeEventListener: (event: string, listener: () => void) => void;
}

const sharedAudio: FakeAudioElement = {
  src: '',
  playbackRate: 1,
  volume: 1,
  preload: '',
  onended: null,
  paused: false,
  play: () => Promise.resolve(),
  pause() {
    sharedAudio.paused = true;
  },
  addEventListener: () => {},
  removeEventListener: () => {},
};

function MockAudio(): FakeAudioElement {
  return sharedAudio;
}

describe('sound sayThen supersession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      Audio: MockAudio,
      speechSynthesis: { cancel: () => {}, speak: () => {} },
    });
  });

  afterEach(() => {
    stopNarration();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fires done immediately when superseded by saySequence', () => {
    const done = vi.fn();
    sayThen(['Apple!'], done);
    expect(done).not.toHaveBeenCalled();

    saySequence(['Find the apple!']);
    expect(done).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(9000);
    expect(done).toHaveBeenCalledOnce();
  });

  it('fires done immediately when superseded by say', () => {
    const done = vi.fn();
    sayThen(['Apple!'], done);
    expect(done).not.toHaveBeenCalled();

    say('Find the apple!');
    expect(done).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(9000);
    expect(done).toHaveBeenCalledOnce();
  });

  it('fires done immediately when superseded by stopNarration', () => {
    const done = vi.fn();
    sayThen(['Apple!'], done);
    expect(done).not.toHaveBeenCalled();

    stopNarration();
    expect(done).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(9000);
    expect(done).toHaveBeenCalledOnce();
  });

  it('fires done immediately when superseded by another sayThen', () => {
    const done1 = vi.fn();
    const done2 = vi.fn();
    sayThen(['Apple!'], done1);
    expect(done1).not.toHaveBeenCalled();

    sayThen(['Find the apple!'], done2);
    expect(done1).toHaveBeenCalledOnce();
    expect(done2).not.toHaveBeenCalled();
  });

  it('fires done once when audio sequence finishes normally', () => {
    const done = vi.fn();
    sayThen(['Apple!'], done);
    expect(done).not.toHaveBeenCalled();

    sharedAudio?.onended?.();
    expect(done).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(9000);
    expect(done).toHaveBeenCalledOnce();
  });

  it('fires done after capMs if playback stalls without superseding', () => {
    const done = vi.fn();
    sayThen(['Apple!'], done, 5000);
    expect(done).not.toHaveBeenCalled();

    vi.advanceTimersByTime(4999);
    expect(done).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledOnce();
  });

  it('fires done immediately when given an empty sequence', () => {
    const done = vi.fn();
    sayThen([], done);
    expect(done).toHaveBeenCalledOnce();
  });
});
