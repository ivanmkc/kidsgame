// @vitest-environment happy-dom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as sound from '../../../sound';
import { t } from '../../../i18n';
import { SpotItGame } from '../SpotItGame';

describe('SpotItGame spoken prompt localization', () => {
  let useSaySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    useSaySpy = vi.spyOn(sound, 'useSay');
  });

  afterEach(() => {
    cleanup();
  });

  it('speaks localized instructions for Japanese', () => {
    render(<SpotItGame onHome={() => {}} difficulty="easy" lang="ja" />);
    expect(useSaySpy).toHaveBeenCalledWith(t('ja', 'shell.spotit.sub'));
    expect(screen.getByText(t('ja', 'shell.spotit.sub'))).toBeTruthy();
  });

  it('speaks localized instructions for Mandarin and Cantonese', () => {
    render(<SpotItGame onHome={() => {}} difficulty="easy" lang="cmn" />);
    expect(useSaySpy).toHaveBeenCalledWith(t('cmn', 'shell.spotit.sub'));

    cleanup();
    useSaySpy.mockClear();

    render(<SpotItGame onHome={() => {}} difficulty="easy" lang="yue" />);
    expect(useSaySpy).toHaveBeenCalledWith(t('yue', 'shell.spotit.sub'));
  });

  it('speaks English prompt from translation table', () => {
    render(<SpotItGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(useSaySpy).toHaveBeenCalledWith(t('en', 'shell.spotit.sub'));
    expect(screen.getByText(t('en', 'shell.spotit.sub'))).toBeTruthy();
  });

  it('updates spoken prompt when language changes', () => {
    const { rerender } = render(<SpotItGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(useSaySpy).toHaveBeenCalledWith(t('en', 'shell.spotit.sub'));

    useSaySpy.mockClear();
    rerender(<SpotItGame onHome={() => {}} difficulty="easy" lang="ja" />);
    expect(useSaySpy).toHaveBeenCalledWith(t('ja', 'shell.spotit.sub'));
  });

  it('does not speak instructional prompt while mode picker is active', () => {
    render(<SpotItGame onHome={() => {}} difficulty="easy" twoPlayerEnabled={true} lang="ja" />);
    expect(useSaySpy).toHaveBeenCalledWith(null);
    expect(useSaySpy).not.toHaveBeenCalledWith(t('ja', 'shell.spotit.sub'));
  });

  it('renders localized accessibility labels on card symbols', () => {
    render(<SpotItGame onHome={() => {}} difficulty="easy" lang="ja" />);
    const buttons = screen.getAllByRole('button');
    const symbolButtons = buttons.filter((b) => b.getAttribute('data-testid')?.startsWith('top-symbol-'));
    expect(symbolButtons.length).toBeGreaterThan(0);
    for (const btn of symbolButtons) {
      const label = btn.getAttribute('aria-label');
      expect(label).toBeTruthy();
      expect(label).not.toMatch(/^[a-z]+$/);
    }
  });
});

describe('SpotItGame wrong-tap timer cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.spyOn(sound.sfx, 'wrong').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'good').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('clears wrong-tap timer on unmount', () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { unmount } = render(<SpotItGame onHome={() => {}} difficulty="easy" seed={42} lang="en" />);

    const topButtons = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('top-symbol-'));
    const bottomButtons = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('bottom-symbol-'));

    const topSymbolIds = topButtons.map((b) => b.getAttribute('data-testid')!.replace('top-symbol-', ''));
    const bottomSymbolIds = bottomButtons.map((b) => b.getAttribute('data-testid')!.replace('bottom-symbol-', ''));
    const matchingId = topSymbolIds.find((id) => bottomSymbolIds.includes(id));

    const wrongId = topSymbolIds.find((id) => id !== matchingId);
    expect(wrongId).toBeDefined();

    fireEvent.click(screen.getByTestId(`top-symbol-${wrongId}`));

    const wrongCallIndex = setTimeoutSpy.mock.calls.findIndex((call) => call[1] === 450);
    expect(wrongCallIndex).toBeGreaterThanOrEqual(0);
    const wrongTimerId = setTimeoutSpy.mock.results[wrongCallIndex].value;

    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(wrongTimerId);
    expect(() => {
      vi.advanceTimersByTime(500);
    }).not.toThrow();
  });

  it('clears previous wrong-tap timer when another wrong symbol is tapped', () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    render(<SpotItGame onHome={() => {}} difficulty="easy" seed={42} lang="en" />);

    const topButtons = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('top-symbol-'));
    const bottomButtons = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('bottom-symbol-'));

    const topSymbolIds = topButtons.map((b) => b.getAttribute('data-testid')!.replace('top-symbol-', ''));
    const bottomSymbolIds = bottomButtons.map((b) => b.getAttribute('data-testid')!.replace('bottom-symbol-', ''));
    const matchingId = topSymbolIds.find((id) => bottomSymbolIds.includes(id));

    const wrongIds = topSymbolIds.filter((id) => id !== matchingId);
    expect(wrongIds.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByTestId(`top-symbol-${wrongIds[0]}`));
    const firstCallIndex = setTimeoutSpy.mock.calls.findIndex((call) => call[1] === 450);
    const firstTimerId = setTimeoutSpy.mock.results[firstCallIndex].value;

    fireEvent.click(screen.getByTestId(`top-symbol-${wrongIds[1]}`));
    expect(clearTimeoutSpy).toHaveBeenCalledWith(firstTimerId);
  });

  it('clears wrong-tap timer when correct symbol is tapped', () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    render(<SpotItGame onHome={() => {}} difficulty="easy" seed={42} lang="en" />);

    const topButtons = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('top-symbol-'));
    const bottomButtons = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('bottom-symbol-'));

    const topSymbolIds = topButtons.map((b) => b.getAttribute('data-testid')!.replace('top-symbol-', ''));
    const bottomSymbolIds = bottomButtons.map((b) => b.getAttribute('data-testid')!.replace('bottom-symbol-', ''));
    const matchingId = topSymbolIds.find((id) => bottomSymbolIds.includes(id));

    const wrongId = topSymbolIds.find((id) => id !== matchingId);
    expect(wrongId).toBeDefined();

    fireEvent.click(screen.getByTestId(`top-symbol-${wrongId}`));
    const wrongCallIndex = setTimeoutSpy.mock.calls.findIndex((call) => call[1] === 450);
    const wrongTimerId = setTimeoutSpy.mock.results[wrongCallIndex].value;

    fireEvent.click(screen.getByTestId(`top-symbol-${matchingId}`));
    expect(clearTimeoutSpy).toHaveBeenCalledWith(wrongTimerId);
  });
});

describe('SpotItGame inactivity timer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.spyOn(sound.sfx, 'wrong').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'good').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('resets inactivity timer when wrong answer is tapped', () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    render(<SpotItGame onHome={() => {}} difficulty="easy" seed={42} lang="en" />);

    const topButtons = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('top-symbol-'));
    const bottomButtons = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('bottom-symbol-'));

    const topSymbolIds = topButtons.map((b) => b.getAttribute('data-testid')!.replace('top-symbol-', ''));
    const bottomSymbolIds = bottomButtons.map((b) => b.getAttribute('data-testid')!.replace('bottom-symbol-', ''));
    const matchingId = topSymbolIds.find((id) => bottomSymbolIds.includes(id));
    const wrongId = topSymbolIds.find((id) => id !== matchingId);
    expect(wrongId).toBeDefined();

    const hintCallIndex = setTimeoutSpy.mock.calls.findIndex((call) => call[1] === 15000);
    const initialHintTimerId = setTimeoutSpy.mock.results[hintCallIndex].value;

    vi.advanceTimersByTime(14000);
    
    fireEvent.click(screen.getByTestId(`top-symbol-${wrongId}`));

    expect(clearTimeoutSpy).toHaveBeenCalledWith(initialHintTimerId);

    const newHintCallIndices = setTimeoutSpy.mock.calls
      .map((call, i) => (call[1] === 15000 ? i : -1))
      .filter((i) => i !== -1);
    expect(newHintCallIndices.length).toBeGreaterThan(1);
  });
});
