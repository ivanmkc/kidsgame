// @vitest-environment happy-dom
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EchoBeatGame } from './EchoBeatGame';
import { LangContext } from '../../components/GameShell';
import { Difficulty } from '../../difficulty';
import { Lang } from '../../lang';
import * as sound from '../../sound';
import * as music from '../../music';

function LangHarness({
  difficulty = 'easy',
  initialLang = 'en',
}: {
  difficulty?: Difficulty;
  initialLang?: Lang;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const cycleLang = () => {
    setLang((l) => (l === 'en' ? 'ja' : l === 'ja' ? 'cmn' : l === 'cmn' ? 'yue' : 'en'));
  };
  return (
    <LangContext.Provider value={{ lang, onCycle: cycleLang }}>
      <EchoBeatGame onHome={() => {}} difficulty={difficulty} lang={lang} />
    </LangContext.Provider>
  );
}

describe('EchoBeatGame language switch safety (echobeat-lang.test.tsx)', () => {
  beforeEach(() => {
    sound.setMuted(false);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    sound.setMuted(false);
  });

  it('prevents stale speech callbacks and pending timers from executing on language switch, ensuring prompt, board, score, and playDrumSequence are safe', () => {
    vi.useFakeTimers();
    const sayThenCallbacks: Array<() => void> = [];
    vi.spyOn(sound, 'sayThen').mockImplementation((_texts, done) => {
      sayThenCallbacks.push(done);
    });
    const playDrumSeqSpy = vi.spyOn(music, 'playDrumSequence');
    const stopNarrationSpy = vi.spyOn(sound, 'stopNarration');

    render(<LangHarness initialLang="en" />);

    expect(sayThenCallbacks.length).toBe(1);
    const staleCallback = sayThenCallbacks[0];

    const langBtn = screen.getByTestId('lang-cycle');
    act(() => {
      fireEvent.click(langBtn);
    });

    expect(stopNarrationSpy).toHaveBeenCalled();
    expect(sayThenCallbacks.length).toBe(2);

    const callsBefore = playDrumSeqSpy.mock.calls.length;
    act(() => {
      staleCallback();
    });
    const callsAfter = playDrumSeqSpy.mock.calls.length;
    expect(callsAfter).toBe(callsBefore);

    expect(screen.getByText('きこえた リズムを タップ！')).toBeTruthy();
    expect(screen.getByText('きいてね…')).toBeTruthy();
    expect(screen.getByTestId('echobeat-board').children.length).toBe(3);
    expect(screen.getByTestId('echobeat-score').textContent).toContain('0/6');

    vi.useRealTimers();
  });

  it('stops narration and updates speech when lang prop changes directly', () => {
    vi.useFakeTimers();
    const sayThenCallbacks: Array<() => void> = [];
    vi.spyOn(sound, 'sayThen').mockImplementation((_texts, done) => {
      sayThenCallbacks.push(done);
    });
    const stopNarrationSpy = vi.spyOn(sound, 'stopNarration');
    const playDrumSeqSpy = vi.spyOn(music, 'playDrumSequence');

    const { rerender } = render(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="en" />);

    expect(sayThenCallbacks.length).toBe(1);
    const staleCallback = sayThenCallbacks[0];
    stopNarrationSpy.mockClear();

    rerender(<EchoBeatGame onHome={() => {}} difficulty="easy" lang="ja" />);

    expect(stopNarrationSpy).toHaveBeenCalled();
    expect(screen.getByText('きこえた リズムを タップ！')).toBeTruthy();
    expect(screen.getByText('きいてね…')).toBeTruthy();
    expect(screen.getByTestId('echobeat-score').textContent).toContain('0/6');

    const callsBefore = playDrumSeqSpy.mock.calls.length;
    act(() => {
      staleCallback();
    });
    expect(playDrumSeqSpy.mock.calls.length).toBe(callsBefore);

    vi.useRealTimers();
  });
});
