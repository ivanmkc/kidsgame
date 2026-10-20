// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LangContext } from '../../../components/GameShell';
import { Lang } from '../../../lang';
import * as sound from '../../../sound';
import { SoundsGame } from '../SoundsGame';

function LangHarness({
  initialLang = 'en',
  difficulty = 'easy',
}: {
  initialLang?: Lang;
  difficulty?: 'easy' | 'medium' | 'hard';
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const cycleLang = () => {
    setLang((l) => (l === 'en' ? 'ja' : l === 'ja' ? 'cmn' : l === 'cmn' ? 'yue' : 'en'));
  };
  return (
    <LangContext.Provider value={{ lang, onCycle: cycleLang }}>
      <SoundsGame onHome={() => {}} difficulty={difficulty} lang={lang} />
    </LangContext.Provider>
  );
}

describe('SoundsGame language switch safety', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound.sfx, 'good').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'wrong').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'tap').mockImplementation(() => {});
    vi.spyOn(sound, 'saySequence').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('updates display prompt and speaks new language prompt when language switches mid-round', () => {
    const saySeqSpy = vi.spyOn(sound, 'saySequence');

    render(<LangHarness initialLang="en" />);

    // English prompt spoken initially
    expect(saySeqSpy).toHaveBeenCalledWith([expect.stringMatching(/^Which one starts with .+\?$/)]);
    saySeqSpy.mockClear();

    // Verify visual prompt in English
    const promptText = screen.getByTestId(/^sounds-prompt-/).textContent;
    expect(promptText).toMatch(/^Which one starts with .+\?$/);

    // Initial tile set on the board
    const initialTiles = screen.getAllByTestId(/^sounds-tile-/).map((t) => t.getAttribute('aria-label'));

    // Header chip switches to Japanese
    const langBtn = screen.getByTestId('lang-cycle');
    fireEvent.click(langBtn);

    // Visual prompt immediately resolves to Japanese with "どれかな？"
    const jaPromptText = screen.getByTestId(/^sounds-prompt-/).textContent;
    expect(jaPromptText).toContain('どれかな？');

    // Japanese prompt is spoken via saySequence
    expect(saySeqSpy).toHaveBeenCalledWith(['どれかな？', expect.any(String)]);

    // Board tiles remain identical across the language switch
    const currentTiles = screen.getAllByTestId(/^sounds-tile-/).map((t) => t.getAttribute('aria-label'));
    expect(currentTiles).toEqual(initialTiles);

    // Score remains at 0/8
    expect(screen.getByTestId('sounds-score').textContent).toContain('0/8');
  });

  it('plays confirmation in current language after mid-round switch', () => {
    const sayThenSpy = vi.spyOn(sound, 'sayThen');

    render(<LangHarness initialLang="en" />);

    // Switch from EN to JA mid-round
    fireEvent.click(screen.getByTestId('lang-cycle'));
    sayThenSpy.mockClear();

    // Tap tiles until answer is found
    const tiles = screen.getAllByTestId(/^sounds-tile-/);
    for (const tile of tiles) {
      fireEvent.click(tile);
      if (sayThenSpy.mock.calls.length > 0) break;
    }

    // Confirmation must be spoken in Japanese (ends with full-width exclamation mark)
    expect(sayThenSpy).toHaveBeenCalledTimes(1);
    const confirmLines = sayThenSpy.mock.calls[0][0];
    expect(confirmLines[0]).toMatch(/！$/);
  });

  it('drops pending confirmation callback and does not advance round if language switches during praise', () => {
    vi.useFakeTimers();
    const saySeqSpy = vi.spyOn(sound, 'saySequence');
    const goodSpy = vi.spyOn(sound.sfx, 'good');

    render(<LangHarness initialLang="en" />);

    expect(screen.getByTestId('sounds-score').textContent).toContain('0/8');

    // Click answer tile in English
    const tiles = screen.getAllByTestId(/^sounds-tile-/);
    for (const tile of tiles) {
      fireEvent.click(tile);
      if (goodSpy.mock.calls.length > 0) break;
    }

    expect(goodSpy).toHaveBeenCalledTimes(1);
    saySeqSpy.mockClear();

    // Cycle language while confirmation is active
    const langBtn = screen.getByTestId('lang-cycle');
    fireEvent.click(langBtn);

    // Old sayThen callback was cancelled by useLangEpoch and dropped by !isValid()
    expect(screen.getByTestId('sounds-score').textContent).toContain('0/8');

    // Japanese prompt is spoken for the active round
    expect(saySeqSpy).toHaveBeenCalledWith(['どれかな？', expect.any(String)]);
  });

  it('re-speaks prompt in current language on incorrect tile tap after language switch', () => {
    const saySeqSpy = vi.spyOn(sound, 'saySequence');
    const wrongSpy = vi.spyOn(sound.sfx, 'wrong');

    render(<LangHarness initialLang="en" />);

    // Switch to JA
    fireEvent.click(screen.getByTestId('lang-cycle'));
    saySeqSpy.mockClear();

    // Find and click an incorrect tile
    const tiles = screen.getAllByTestId(/^sounds-tile-/);
    for (const tile of tiles) {
      fireEvent.click(tile);
      if (wrongSpy.mock.calls.length > 0) break;
    }

    expect(wrongSpy).toHaveBeenCalledTimes(1);
    expect(saySeqSpy).toHaveBeenCalledWith(['どれかな？', expect.any(String)]);
  });
});
