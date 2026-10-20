// @vitest-environment happy-dom
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { LangContext } from '../../../components/GameShell';
import { Lang } from '../../../lang';
import * as sound from '../../../sound';
import { SpotItGame } from '../SpotItGame';

function LangHarness({ initialLang = 'en' }: { initialLang?: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const cycleLang = () => {
    setLang((l) => (l === 'en' ? 'ja' : l === 'ja' ? 'cmn' : l === 'cmn' ? 'yue' : 'en'));
  };
  return (
    <LangContext.Provider value={{ lang, onCycle: cycleLang }}>
      <SpotItGame onHome={() => {}} difficulty="easy" seed={42} lang={lang} />
    </LangContext.Provider>
  );
}

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
  window.dispatchEvent(new Event('resize'));
}

describe('SpotItGame language switch safety', () => {
  beforeEach(() => {
    setViewport(800, 600);
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.spyOn(sound.sfx, 'good').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'wrong').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'tap').mockImplementation(() => {});
    vi.spyOn(sound, 'say').mockImplementation(() => {});
  });

  afterEach(() => {
    sound.stopNarration();
    cleanup();
    vi.useRealTimers();
  });

  it('safely switches language mid-round and updates UI instantly without corrupting the active round', () => {
    const saySpy = vi.spyOn(sound, 'say');

    render(<LangHarness initialLang="en" />);
    fireEvent.pointerDown(document.body);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Initial English title
    expect(screen.getByText('Spot It!')).toBeDefined();
    expect(screen.getByTestId('spotit-score').textContent).toContain('0/10');

    // Extract symbols from top and bottom cards before language switch
    const topButtons = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('top-symbol-'));
    const bottomButtons = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('bottom-symbol-'));
    expect(topButtons.length).toBeGreaterThan(0);
    expect(bottomButtons.length).toBeGreaterThan(0);

    const topSymbols = topButtons.map((b) => b.getAttribute('data-testid'));
    const bottomSymbols = bottomButtons.map((b) => b.getAttribute('data-testid'));

    saySpy.mockClear();

    // Switch language via in-game header LangContext lang-cycle button
    const langBtn = screen.getByTestId('lang-cycle');
    fireEvent.click(langBtn);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Assert UI labels update instantly to Japanese
    expect(screen.getByText('いっしょさがし')).toBeDefined();

    // Assert that no old-language speech or unexpected speech/timer fires after language switch (say is not called again for the sub prompt)
    expect(saySpy).not.toHaveBeenCalled();

    // Assert symbols are identical after language switch (round is not corrupted/shuffled)
    const newTopButtons = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('top-symbol-'));
    const newBottomButtons = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('bottom-symbol-'));
    expect(newTopButtons.map((b) => b.getAttribute('data-testid'))).toEqual(topSymbols);
    expect(newBottomButtons.map((b) => b.getAttribute('data-testid'))).toEqual(bottomSymbols);

    // Find a matching symbol present on both top and bottom cards to play successfully
    const topSymbolIds = topButtons.map((b) => b.getAttribute('data-testid')!.replace('top-symbol-', ''));
    const bottomSymbolIds = bottomButtons.map((b) => b.getAttribute('data-testid')!.replace('bottom-symbol-', ''));
    const matchingId = topSymbolIds.find((id) => bottomSymbolIds.includes(id));
    expect(matchingId).toBeDefined();

    const matchingButton = screen.getByTestId(`top-symbol-${matchingId}`);

    const scoreTextBefore = screen.getByTestId('spotit-score').textContent;
    act(() => {
      fireEvent.click(matchingButton);
      vi.advanceTimersByTime(100);
    });

    expect(vi.mocked(sound.sfx.good)).toHaveBeenCalled();
    expect(screen.getByTestId('spotit-score').textContent).not.toBe(scoreTextBefore);
  });
});
