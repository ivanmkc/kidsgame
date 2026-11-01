// @vitest-environment happy-dom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as sound from '../../../sound';
import { sfx } from '../../../sound';
import { manifest, Story } from '../../../manifest';
import { StoryGame } from '../StoryGame';

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
  });
  Object.defineProperty(window, 'innerHeight', {
    value: height,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'clientWidth', {
    value: width,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    value: height,
    configurable: true,
  });
  if (window.visualViewport) {
    Object.defineProperty(window.visualViewport, 'width', {
      value: width,
      configurable: true,
    });
    Object.defineProperty(window.visualViewport, 'height', {
      value: height,
      configurable: true,
    });
  }
  window.dispatchEvent(new Event('resize'));
}

describe('StoryGame compact viewport layout', () => {
  const initialStoryCount = manifest.stories?.length ?? 0;
  const noop = () => {};

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound, 'say').mockImplementation(() => {});
    vi.spyOn(sound, 'saySequence').mockImplementation(() => {});
    vi.spyOn(sfx, 'tap').mockImplementation(() => {});
    vi.spyOn(sfx, 'boing').mockImplementation(() => {});
    vi.spyOn(sfx, 'thunder').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    if (manifest.stories && manifest.stories.length > initialStoryCount) {
      manifest.stories.splice(initialStoryCount);
    }
  });

  it('clamps hotspot scene image and touch hotspot dimensions to non-negative on height-constrained viewports', () => {
    setViewport(600, 180);
    const { container } = render(
      <StoryGame sceneId="luna" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />,
    );

    const allElements = container.querySelectorAll('*');
    const negativeStyledElements: string[] = [];
    allElements.forEach((el) => {
      const style = el.getAttribute('style') || '';
      if (/width:\s*-[0-9]/.test(style) || /height:\s*-[0-9]/.test(style)) {
        negativeStyledElements.push(`${el.tagName}: ${style}`);
      }
    });

    expect(negativeStyledElements).toEqual([]);

    const choiceA = screen.getByTestId('story-choice-a');
    const choiceAStyle = choiceA.getAttribute('style') || '';
    expect(choiceAStyle).not.toMatch(/width:\s*-[0-9]/);
    expect(choiceAStyle).not.toMatch(/height:\s*-[0-9]/);
  });

  it('clamps button choice scene image dimensions to non-negative on height-constrained viewports', () => {
    const buttonStory: Story = {
      id: 'test-button-compact',
      title: 'Button Story Compact',
      nodes: {
        start: {
          image: 'story/luna_start.jpg',
          text: 'Where to go?',
          choices: [
            { label: 'Left', next: 'a' },
            { label: 'Right', next: 'b' },
          ],
        },
      },
    };
    manifest.stories?.push(buttonStory);

    setViewport(600, 250);
    const { container } = render(
      <StoryGame
        sceneId="test-button-compact"
        onHome={noop}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const allElements = container.querySelectorAll('*');
    const negativeStyledElements: string[] = [];
    allElements.forEach((el) => {
      const style = el.getAttribute('style') || '';
      if (/width:\s*-[0-9]/.test(style) || /height:\s*-[0-9]/.test(style)) {
        negativeStyledElements.push(`${el.tagName}: ${style}`);
      }
    });

    expect(negativeStyledElements).toEqual([]);
  });

  it('computes positive scene dimensions on standard landscape viewport', () => {
    setViewport(844, 390);
    const { container } = render(
      <StoryGame sceneId="luna" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />,
    );

    const choiceA = screen.getByTestId('story-choice-a');
    const choiceAStyle = choiceA.getAttribute('style') || '';
    expect(choiceAStyle).toMatch(/width:\s*[1-9][0-9]*(\.[0-9]+)?px/);
    expect(choiceAStyle).toMatch(/height:\s*[1-9][0-9]*(\.[0-9]+)?px/);

    const allElements = container.querySelectorAll('*');
    const negativeStyledElements: string[] = [];
    allElements.forEach((el) => {
      const style = el.getAttribute('style') || '';
      if (/width:\s*-[0-9]/.test(style) || /height:\s*-[0-9]/.test(style)) {
        negativeStyledElements.push(`${el.tagName}: ${style}`);
      }
    });
    expect(negativeStyledElements).toEqual([]);
  });
});
