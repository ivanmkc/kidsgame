// @vitest-environment happy-dom
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FastSlowGame } from './FastSlowGame';
import { playSequence, stopSequence } from '../../music';
import { say, saySequence, stopNarration } from '../../sound';
import { LangContext } from '../../components/GameShell';
import { Difficulty } from '../../difficulty';
import { Lang } from '../../lang';
import { t } from '../../i18n';

vi.mock('../../sound', () => ({
  sfx: { good: vi.fn(), wrong: vi.fn(), win: vi.fn(), tap: vi.fn() },
  say: vi.fn(),
  saySequence: vi.fn(),
  sayThen: vi.fn((_texts: string[], done: () => void) => {
    done();
  }),
  stopNarration: vi.fn(),
}));

const defaultPlaySequenceImpl = (
  _notes?: unknown,
  _bpm?: unknown,
  _cb?: ((index: number) => void) | unknown,
  onEnd?: () => void,
) => {
  if (onEnd) onEnd();
  return () => {};
};

vi.mock('../../music', () => ({
  playSequence: vi.fn((notes, bpm, cb, onEnd) => defaultPlaySequenceImpl(notes, bpm, cb, onEnd)),
  stopSequence: vi.fn(),
}));

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
      <FastSlowGame onHome={() => {}} difficulty={difficulty} lang={lang} />
    </LangContext.Provider>
  );
}

describe('FastSlowGame language switch safety', () => {
  beforeEach(() => {
    vi.mocked(playSequence).mockImplementation(defaultPlaySequenceImpl);
    vi.mocked(stopSequence).mockClear();
    vi.mocked(say).mockClear();
    vi.mocked(saySequence).mockClear();
    vi.mocked(stopNarration).mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('stops narration and updates speech prompt when language switches during pick phase', () => {
    vi.useFakeTimers();
    render(<LangHarness initialLang="en" />);

    // Fast-forward initial 1000ms delay to finish listen phase and enter pick phase
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('fastslow-fast').textContent).toContain('Fast');
    expect(screen.getByTestId('fastslow-slow').textContent).toContain('Slow');

    vi.mocked(stopNarration).mockClear();
    vi.mocked(saySequence).mockClear();

    // Switch language to Japanese mid-round during pick phase
    const langBtn = screen.getByTestId('lang-cycle');
    act(() => {
      fireEvent.click(langBtn);
    });

    // Acceptance criteria: sound.stopNarration is called on language switch
    expect(stopNarration).toHaveBeenCalledTimes(1);

    // Audio queue race prevention: stopNarration must precede new language prompt
    const stopOrder = vi.mocked(stopNarration).mock.invocationCallOrder[0];
    const sayOrder = vi.mocked(saySequence).mock.invocationCallOrder[0];
    expect(stopOrder).toBeDefined();
    expect(sayOrder).toBeDefined();
    expect(stopOrder).toBeLessThan(sayOrder);

    // Prompt updated to Japanese
    expect(saySequence).toHaveBeenCalledWith([
      t('ja', 'shell.fastslow.sub' as never),
      t('ja', 'music.fast' as never),
      t('ja', 'music.slow' as never),
    ]);

    // UI buttons update immediately to Japanese
    expect(screen.getByTestId('fastslow-fast').textContent).toContain(
      t('ja', 'music.fast' as never),
    );
    expect(screen.getByTestId('fastslow-slow').textContent).toContain(
      t('ja', 'music.slow' as never),
    );
  });

  it('calls stopNarration when lang prop changes directly in pick phase', () => {
    vi.useFakeTimers();
    const { rerender } = render(<FastSlowGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Advance to pick phase
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('fastslow-fast').textContent).toContain('Fast');

    vi.mocked(stopNarration).mockClear();
    vi.mocked(saySequence).mockClear();

    // Rerender with new language directly
    rerender(<FastSlowGame onHome={() => {}} difficulty="easy" lang="cmn" />);

    expect(stopNarration).toHaveBeenCalledTimes(1);
    expect(saySequence).toHaveBeenCalledWith([
      t('cmn', 'shell.fastslow.sub' as never),
      t('cmn', 'music.fast' as never),
      t('cmn', 'music.slow' as never),
    ]);
  });

  it('stops narration and sequence when language switches during listen phase', () => {
    vi.useFakeTimers();
    render(<LangHarness initialLang="en" />);

    // Advance 500ms into 1000ms listen delay
    act(() => {
      vi.advanceTimersByTime(500);
    });

    vi.mocked(stopNarration).mockClear();
    vi.mocked(say).mockClear();

    // Switch language to Japanese mid-listen
    const langBtn = screen.getByTestId('lang-cycle');
    act(() => {
      fireEvent.click(langBtn);
    });

    expect(stopNarration).toHaveBeenCalled();
    expect(say).toHaveBeenCalledWith(t('ja', 'music.listen' as never));
  });

  it('cycles through all languages mid-round without audio overlap', () => {
    vi.useFakeTimers();
    render(<LangHarness initialLang="en" />);

    // Advance to pick phase
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const langBtn = screen.getByTestId('lang-cycle');
    const langs: Lang[] = ['ja', 'cmn', 'yue', 'en'];

    for (const nextLang of langs) {
      vi.mocked(stopNarration).mockClear();
      vi.mocked(saySequence).mockClear();

      act(() => {
        fireEvent.click(langBtn);
      });

      expect(stopNarration).toHaveBeenCalledTimes(1);
      expect(saySequence).toHaveBeenCalledWith([
        t(nextLang, 'shell.fastslow.sub' as never),
        t(nextLang, 'music.fast' as never),
        t(nextLang, 'music.slow' as never),
      ]);
      expect(screen.getByTestId('fastslow-fast').textContent).toContain(
        t(nextLang, 'music.fast' as never),
      );
    }
  });
});
