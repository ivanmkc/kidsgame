// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LangContext } from '../../../components/GameShell';
import { Lang } from '../../../lang';
import { manifest } from '../../../manifest';
import * as sound from '../../../sound';
import { WORDS } from '../../../words';
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
    const pool = WORDS.filter((w) => manifest.spotit.icons.includes(w.icon));
    const match = (screen.getByTestId(/^sounds-prompt-/).getAttribute('data-testid') || '').match(/^sounds-prompt-(\d+)$/);
    const targetIdx = match ? Number(match[1]) : -1;
    const targetIcon = targetIdx >= 0 ? pool[targetIdx]?.icon : undefined;
    const tiles = screen.getAllByTestId(/^sounds-tile-/);
    const wrongTile = tiles.find((t) => t.getAttribute('aria-label') !== targetIcon) ?? tiles[0];
    fireEvent.click(wrongTile);

    expect(wrongSpy).toHaveBeenCalledTimes(1);
    expect(saySeqSpy).toHaveBeenCalledWith(['どれかな？', expect.any(String)]);
  });
});

describe('SoundsGame fast-tap lock', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('locks input during sayThen so rapid taps do not skip rounds', () => {
    let confirmCb: (() => void) | null = null;
    vi.spyOn(sound, 'sayThen').mockImplementation((lines, cb) => {
      confirmCb = cb;
    });
    vi.spyOn(sound, 'saySequence').mockImplementation(() => {});

    render(<SoundsGame onHome={() => {}} difficulty="easy" lang="en" />);

    vi.spyOn(sound.sfx, 'good').mockImplementation(() => {});

    const tiles = [
      screen.getByTestId('sounds-tile-0'),
      screen.getByTestId('sounds-tile-1'),
      screen.getByTestId('sounds-tile-2'),
    ];

    let correctTile: HTMLElement | null = null;
    for (const tile of tiles) {
      fireEvent.click(tile);
      if (vi.mocked(sound.sfx.good).mock.calls.length === 1) {
        correctTile = tile;
        break;
      }
    }

    expect(correctTile).not.toBeNull();
    expect(sound.sayThen).toHaveBeenCalledTimes(1);

    // Rapid second tap before callback fires.
    fireEvent.click(correctTile!);

    // Should still only have called good/sayThen once!
    expect(sound.sfx.good).toHaveBeenCalledTimes(1);
    expect(sound.sayThen).toHaveBeenCalledTimes(1);

    // Fire the callback
    act(() => {
      if (confirmCb) confirmCb();
    });

    // Score should show round 1. In easy, 8 rounds to win.
    const score = screen.getByTestId('sounds-score');
    expect(score.textContent).toMatch(/1\/8/);
  });
});
