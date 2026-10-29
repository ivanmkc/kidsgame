// @vitest-environment happy-dom
import React from 'react';
import { Animated } from 'react-native';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as sound from '../../../sound';
import { sfx } from '../../../sound';
import { manifest, Story } from '../../../manifest';
import { LangContext } from '../../../components/GameShell';
import { Lang } from '../../../lang';
import { StoryGame } from '../StoryGame';

describe('StoryGame ScareSpot interactions', () => {
  const initialStoryCount = manifest.stories?.length ?? 0;
  const noop = () => {};

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound, 'say').mockImplementation(() => {});
    vi.spyOn(sound, 'saySequence').mockImplementation(() => {});
    vi.spyOn(sfx, 'tap').mockImplementation(() => {});
    vi.spyOn(sfx, 'boing').mockImplementation(() => {});
    vi.spyOn(sfx, 'thunder').mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    cleanup();
    if (manifest.stories && manifest.stories.length > initialStoryCount) {
      manifest.stories.splice(initialStoryCount);
    }
  });

  it('rapid taps on ScareSpot only trigger sound and voice once', () => {
    const sfxThunderSpy = vi.spyOn(sfx, 'thunder');
    const saySpy = vi.spyOn(sound, 'say');

    const scareStory: Story = {
      id: 'test-scare-hammer',
      title: 'Scare Story Hammer',
      nodes: {
        start: {
          image: 'story/luna_start.jpg',
          text: 'Look closely...',
          scare: {
            x: 10,
            y: 20,
            w: 80,
            h: 90,
            pop: 'story/luna_start_c0.png',
            sting: 'thunder',
            reveal: 'It is a friendly ghost!',
            delay: 300,
          },
        },
      },
    };
    manifest.stories?.push(scareStory);

    render(<StoryGame sceneId="test-scare-hammer" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />);

    const scareSpot = screen.getByTestId('story-scare');
    expect(scareSpot).toBeDefined();

    // Rapidly tap the scare spot three times
    fireEvent.click(scareSpot);
    fireEvent.click(scareSpot);
    fireEvent.click(scareSpot);

    // Sound effect should only fire once
    expect(sfxThunderSpy).toHaveBeenCalledOnce();

    // Advance timers through reveal delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Voice should be queued once
    expect(saySpy).toHaveBeenCalledWith('It is a friendly ghost!');

    // Advance any remaining animation frames
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // After animation and reveal finish, tapping again triggers it
    fireEvent.click(scareSpot);
    expect(sfxThunderSpy).toHaveBeenCalledTimes(2);
  });

  it('ignores taps while spring animation is running even if delay is 0', () => {
    let finishSpring: (() => void) | null = null;
    vi.spyOn(Animated, 'spring').mockImplementation(() => ({
      start: (cb) => {
        finishSpring = () => cb?.({ finished: true });
      },
      stop: () => {},
      reset: () => {},
    }));

    const sfxBoingSpy = vi.spyOn(sfx, 'boing');
    const saySpy = vi.spyOn(sound, 'say');

    const zeroDelayStory: Story = {
      id: 'test-scare-zero-delay',
      title: 'Zero Delay Story',
      nodes: {
        start: {
          image: 'story/luna_start.jpg',
          text: 'Look closely...',
          scare: {
            x: 10,
            y: 20,
            w: 80,
            h: 90,
            pop: 'story/luna_start_c0.png',
            sting: 'boing',
            reveal: 'Instant reveal!',
            delay: 0,
          },
        },
      },
    };
    manifest.stories?.push(zeroDelayStory);

    render(
      <StoryGame sceneId="test-scare-zero-delay" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />,
    );

    const scareSpot = screen.getByTestId('story-scare');

    fireEvent.click(scareSpot);
    expect(sfxBoingSpy).toHaveBeenCalledOnce();

    // Fire timer for delay 0 so revealTimer is cleared
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(saySpy).toHaveBeenCalledWith('Instant reveal!');

    // Tap while spring animation is still running: should be ignored
    fireEvent.click(scareSpot);
    expect(sfxBoingSpy).toHaveBeenCalledOnce();

    // Now complete the spring animation
    act(() => {
      finishSpring?.();
    });

    // Re-tapping now works
    fireEvent.click(scareSpot);
    expect(sfxBoingSpy).toHaveBeenCalledTimes(2);
  });

  it('cancels in-flight scare reveal speech when language is switched mid-scare before reveal fires', () => {
    const saySpy = vi.spyOn(sound, 'say');

    const scareStory: Story = {
      id: 'test-scare-lang-switch',
      title: 'Scare Story Lang Switch',
      nodes: {
        start: {
          image: 'story/luna_start.jpg',
          text: 'Look closely...',
          t: {
            ja: 'よく みてね...',
          },
          scare: {
            x: 10,
            y: 20,
            w: 80,
            h: 90,
            pop: 'story/luna_start_c0.png',
            sting: 'thunder',
            reveal: 'It is a friendly ghost!',
            t: {
              ja: 'やさしい おばけ だよ！',
            },
            delay: 300,
          },
        },
      },
    };
    manifest.stories?.push(scareStory);

    function Harness() {
      const [lang, setLang] = React.useState<Lang>('en');
      return (
        <LangContext.Provider
          value={{
            lang,
            onCycle: () => setLang((l) => (l === 'en' ? 'ja' : 'en')),
          }}
        >
          <StoryGame
            sceneId="test-scare-lang-switch"
            onHome={noop}
            onPickScene={noop}
            onBackToPicker={noop}
            lang={lang}
          />
        </LangContext.Provider>
      );
    }

    render(<Harness />);

    const scareSpot = screen.getByTestId('story-scare');
    fireEvent.click(scareSpot);

    // Visual pop should appear
    expect(screen.getByTestId('story-scare-pop')).toBeTruthy();

    // Switch language before reveal delay elapses
    fireEvent.click(screen.getByTestId('lang-cycle'));

    // Advance time to allow reveal timer to fire
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Mid-game language switch cancels in-flight scare reveal speech
    expect(saySpy).not.toHaveBeenCalled();

    // UI safely reflects the new language
    expect(screen.getByTestId('story-text-start').textContent).toBe('よく みてね...');
    expect(screen.getByTestId('story-scare-pop')).toBeTruthy();
  });
});

describe('StoryGame choice navigation and redo history', () => {
  const initialStoryCount = manifest.stories?.length ?? 0;
  const noop = () => {};

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound, 'say').mockImplementation(() => {});
    vi.spyOn(sound, 'saySequence').mockImplementation(() => {});
    vi.spyOn(sfx, 'tap').mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    cleanup();
    if (manifest.stories && manifest.stories.length > initialStoryCount) {
      manifest.stories.splice(initialStoryCount);
    }
  });

  it('clears redo stack when selecting a button choice after going back', () => {
    const testStory: Story = {
      id: 'test-button-redo-story',
      title: 'Button Redo Story',
      nodes: {
        start: {
          image: 'story/luna_start.jpg',
          text: 'Where shall we go?',
          choices: [
            { label: 'Forest', next: 'forest' },
            { label: 'Castle', next: 'castle' },
          ],
        },
        forest: {
          image: 'story/luna_start.jpg',
          text: 'In the deep forest',
          choices: [],
        },
        castle: {
          image: 'story/luna_start.jpg',
          text: 'At the castle gate',
          choices: [],
        },
      },
    };
    manifest.stories?.push(testStory);

    render(
      <StoryGame
        sceneId="test-button-redo-story"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    // 1. Advance to forest
    fireEvent.click(screen.getByTestId('story-choice-forest'));
    expect(screen.getByTestId('story-text-forest')).toBeDefined();

    // 2. Go back with ArrowLeft
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByTestId('story-text-start')).toBeDefined();

    // 3. Choose castle instead
    fireEvent.click(screen.getByTestId('story-choice-castle'));
    expect(screen.getByTestId('story-text-castle')).toBeDefined();

    // 4. Press ArrowRight (redo) - should not jump back to forest
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('story-text-castle')).toBeDefined();
    expect(screen.queryByTestId('story-text-forest')).toBeNull();
  });

  it('clears redo stack when selecting an icon tile choice after going back', () => {
    const testIconStory: Story = {
      id: 'test-icon-redo-story',
      title: 'Icon Redo Story',
      nodes: {
        start: {
          image: 'story/luna_start.jpg',
          text: 'Pick an item',
          choices: [
            { label: 'Apple', next: 'apple', icon: 'story/luna_start_c0.png' },
            { label: 'Berry', next: 'berry', icon: 'story/luna_start_c1.png' },
          ],
        },
        apple: {
          image: 'story/luna_start.jpg',
          text: 'You chose the apple',
          choices: [],
        },
        berry: {
          image: 'story/luna_start.jpg',
          text: 'You chose the berry',
          choices: [],
        },
      },
    };
    manifest.stories?.push(testIconStory);

    render(
      <StoryGame
        sceneId="test-icon-redo-story"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    // 1. Advance to apple
    fireEvent.click(screen.getByTestId('story-choice-apple'));
    expect(screen.getByTestId('story-text-apple')).toBeDefined();

    // 2. Go back with ArrowLeft
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByTestId('story-text-start')).toBeDefined();

    // 3. Choose berry instead
    fireEvent.click(screen.getByTestId('story-choice-berry'));
    expect(screen.getByTestId('story-text-berry')).toBeDefined();

    // 4. Press ArrowRight (redo) - should not jump back to apple
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('story-text-berry')).toBeDefined();
    expect(screen.queryByTestId('story-text-apple')).toBeNull();
  });

  it('ignores rapid double taps on standard button choices to prevent skipping scenes', () => {
    const testRapidStory: Story = {
      id: 'test-rapid-tap',
      title: 'Rapid Tap Story',
      nodes: {
        start: {
          image: 'story/luna_start.jpg',
          text: 'Where shall we go?',
          choices: [{ label: 'Forest', next: 'forest' }],
        },
        forest: {
          image: 'story/luna_start.jpg',
          text: 'In the deep forest',
          choices: [{ label: 'Castle', next: 'castle' }],
        },
        castle: {
          image: 'story/luna_start.jpg',
          text: 'At the castle gate',
          choices: [],
        },
      },
    };
    manifest.stories?.push(testRapidStory);

    render(
      <StoryGame
        sceneId="test-rapid-tap"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    // Rapid double-tap
    fireEvent.click(screen.getByTestId('story-choice-forest'));
    // Instantly tap where the next scene's choice will appear
    fireEvent.click(screen.getByTestId('story-choice-castle'));

    // Ensure we are only on the first chosen scene, not skipped to the second
    expect(screen.getByTestId('story-text-forest')).toBeDefined();
    expect(screen.queryByTestId('story-text-castle')).toBeNull();
  });
});
