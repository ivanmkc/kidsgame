// @vitest-environment happy-dom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import * as sound from '../../../sound';
import { NumbersGame } from '../NumbersGame';

describe('NumbersGame', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound.sfx, 'tap').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'good').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'wrong').mockImplementation(() => {});
    vi.spyOn(sound, 'saySequence').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it('re-skins tiles and prompt without re-rolling the target number on script toggle', () => {
    const onHome = vi.fn();
    render(<NumbersGame onHome={onHome} difficulty="easy" lang="ja" />);

    // In easy ja, initial script is Arabic numbers.
    const scriptBtn = screen.getByTestId('numbers-script');
    expect(scriptBtn).toBeDefined();

    // Check the initial prompt text and tile values.
    const promptEl = screen.getByTestId(/^numbers-prompt-/);
    const initialPromptId = promptEl.getAttribute('data-testid');
    const targetKey = initialPromptId?.replace('numbers-prompt-', '');
    expect(targetKey).toMatch(/^n-\d+$/);
    const targetN = targetKey?.replace('n-', '');

    const initialTileLabels = [0, 1, 2, 3, 4].map((i) => {
      const tile = screen.getByTestId(`numbers-tile-${i}`);
      return tile.getAttribute('aria-label');
    });

    // Toggle script to Han.
    fireEvent.click(scriptBtn);

    // Prompt key should now be h-<targetN>, preserving the exact target number.
    const toggledPromptEl = screen.getByTestId(/^numbers-prompt-/);
    expect(toggledPromptEl.getAttribute('data-testid')).toBe(`numbers-prompt-h-${targetN}`);

    // All tiles should preserve their numbers in the same positions, re-skinned to Han.
    const hanTileLabels = [0, 1, 2, 3, 4].map((i) => {
      const tile = screen.getByTestId(`numbers-tile-${i}`);
      return tile.getAttribute('aria-label');
    });

    for (const label of hanTileLabels) {
      expect(label).toMatch(/^[一二三四五六七八九十]+$/);
    }

    // Toggle script back to Arabic.
    fireEvent.click(scriptBtn);

    const restoredPromptEl = screen.getByTestId(/^numbers-prompt-/);
    expect(restoredPromptEl.getAttribute('data-testid')).toBe(`numbers-prompt-n-${targetN}`);

    const restoredTileLabels = [0, 1, 2, 3, 4].map((i) => {
      const tile = screen.getByTestId(`numbers-tile-${i}`);
      return tile.getAttribute('aria-label');
    });

    expect(restoredTileLabels).toEqual(initialTileLabels);
  });
});
