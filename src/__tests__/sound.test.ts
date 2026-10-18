// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('sound sayThen', () => {
  let sound: typeof import('../sound');
  let lastAudio: HTMLAudioElement | null = null;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    lastAudio = null;

    const originalAudio = window.Audio;
    vi.spyOn(window, 'Audio').mockImplementation(function () {
      const a = new originalAudio();
      lastAudio = a;
      vi.spyOn(a, 'play').mockImplementation(() => Promise.resolve());
      return a;
    });

    sound = await import('../sound');
    sound.setMuted(false);
  });

  afterEach(() => {
    sound.stopNarration();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('runs done callback when narration sequence completes', () => {
    const done = vi.fn();
    sound.sayThen(['A big egg!'], done);

    expect(done).not.toHaveBeenCalled();
    expect(lastAudio).not.toBeNull();
    lastAudio?.onended?.(new Event('ended'));

    expect(done).toHaveBeenCalledTimes(1);
  });

  it('immediately fires done when superseded by saySequence', () => {
    const done = vi.fn();
    sound.sayThen(['A big egg!'], done);

    expect(done).not.toHaveBeenCalled();
    sound.saySequence(['A flamingo!']);

    expect(done).toHaveBeenCalledTimes(1);
  });

  it('immediately fires done when superseded by say', () => {
    const done = vi.fn();
    sound.sayThen(['A big egg!'], done);

    expect(done).not.toHaveBeenCalled();
    sound.say('A flamingo!');

    expect(done).toHaveBeenCalledTimes(1);
  });

  it('immediately fires done when superseded by stopNarration', () => {
    const done = vi.fn();
    sound.sayThen(['A big egg!'], done);

    expect(done).not.toHaveBeenCalled();
    sound.stopNarration();

    expect(done).toHaveBeenCalledTimes(1);
  });

  it('immediately fires done when superseded by another sayThen', () => {
    const done1 = vi.fn();
    const done2 = vi.fn();
    sound.sayThen(['A big egg!'], done1);

    expect(done1).not.toHaveBeenCalled();
    sound.sayThen(['A flamingo!'], done2);

    expect(done1).toHaveBeenCalledTimes(1);
    expect(done2).not.toHaveBeenCalled();
  });

  it('fires done when capMs fallback elapses without completion', () => {
    const done = vi.fn();
    sound.sayThen(['A big egg!'], done, 5000);

    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4999);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('fires done after 600ms fallback when muted', () => {
    sound.setMuted(true);
    expect(sound.isMuted()).toBe(true);

    const done = vi.fn();
    sound.sayThen(['A big egg!'], done);

    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(599);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('fires done immediately for empty texts', () => {
    const done = vi.fn();
    sound.sayThen([], done);

    expect(done).toHaveBeenCalledTimes(1);
  });
});
