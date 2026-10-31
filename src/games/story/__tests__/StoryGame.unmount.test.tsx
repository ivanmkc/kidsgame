// @vitest-environment happy-dom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as sound from '../../../sound';
import { StoryGame } from '../StoryGame';

describe('StoryGame unmount and navigation audio cleanup', () => {
  const noop = () => {};

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound, 'say').mockImplementation(() => {});
    vi.spyOn(sound, 'saySequence').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it('stops narration on unmount when viewing a story scene', () => {
    const stopNarrationSpy = vi.spyOn(sound, 'stopNarration');
    const { unmount } = render(
      <StoryGame sceneId="luna" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />,
    );
    stopNarrationSpy.mockClear();

    unmount();

    expect(stopNarrationSpy).toHaveBeenCalled();
  });

  it('stops narration on unmount from the story picker screen', () => {
    const stopNarrationSpy = vi.spyOn(sound, 'stopNarration');
    const { unmount } = render(
      <StoryGame onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />,
    );
    stopNarrationSpy.mockClear();

    unmount();

    expect(stopNarrationSpy).toHaveBeenCalled();
  });

  it('stops narration when sceneId prop changes from active story back to picker', () => {
    const stopNarrationSpy = vi.spyOn(sound, 'stopNarration');
    const { rerender } = render(
      <StoryGame sceneId="luna" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />,
    );
    stopNarrationSpy.mockClear();

    rerender(<StoryGame onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />);

    expect(stopNarrationSpy).toHaveBeenCalled();
  });
});
