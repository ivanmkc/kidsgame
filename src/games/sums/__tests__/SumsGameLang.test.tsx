// @vitest-environment happy-dom
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LangContext } from '../../../components/GameShell';
import { Difficulty } from '../../../difficulty';
import { Lang } from '../../../lang';
import * as sound from '../../../sound';
import { SumsGame } from '../SumsGame';
import * as logic from '../logic';
import { PLUS, QUESTION } from '../logic';

function LangHarness({ difficulty = 'easy', initialLang = 'en' }: { difficulty?: Difficulty; initialLang?: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const cycleLang = () => {
    setLang((l) => (l === 'en' ? 'ja' : l === 'ja' ? 'cmn' : l === 'cmn' ? 'yue' : 'en'));
  };
  return (
    <LangContext.Provider value={{ lang, onCycle: cycleLang }}>
      <SumsGame onHome={() => {}} difficulty={difficulty} lang={lang} />
    </LangContext.Provider>
  );
}

describe('SumsGame language switch safety', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound.sfx, 'good').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'wrong').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'boing').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'tap').mockImplementation(() => {});
    vi.spyOn(sound, 'say').mockImplementation(() => {});
  });

  afterEach(() => {
    sound.stopNarration();
    cleanup();
    vi.useRealTimers();
  });

  it('preserves round and speaks new language prompt when language is cycled mid-round', () => {
    const saySeqSpy = vi.spyOn(sound, 'saySequence');
    const makeRoundSpy = vi.spyOn(logic, 'makeSumsRound');

    render(<LangHarness initialLang="en" />);

    expect(makeRoundSpy).toHaveBeenCalledTimes(1);
    expect(saySeqSpy).toHaveBeenCalledWith(expect.arrayContaining([PLUS.en, QUESTION.en]));

    saySeqSpy.mockClear();

    // Cycle language to Japanese via in-game header chip
    const langBtn = screen.getByTestId('lang-cycle');
    fireEvent.click(langBtn);

    // SumsRound has no language-specific state, so the problem is preserved without rebuilding
    expect(makeRoundSpy).toHaveBeenCalledTimes(1);

    // Prompt updated and spoken in Japanese for the current round
    expect(saySeqSpy).toHaveBeenCalledWith(expect.arrayContaining([PLUS.ja, QUESTION.ja]));
  });

  it('cycles lang during praise: finishes praise, advances to next round, and avoids double-advancing score', () => {
    vi.useFakeTimers();
    const goodSpy = vi.spyOn(sound.sfx, 'good');
    const saySeqSpy = vi.spyOn(sound, 'saySequence');
    const makeRoundSpy = vi.spyOn(logic, 'makeSumsRound');

    render(<LangHarness initialLang="en" />);

    expect(makeRoundSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sums-score').textContent).toContain('0/5');

    // Tap correct choice for round 1
    const buttons = screen.getAllByRole('button');
    const correctBtn = buttons.find((b) => b.getAttribute('data-testid')?.endsWith('-answer'))!;
    expect(correctBtn).toBeDefined();

    fireEvent.click(correctBtn);

    expect(goodSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sums-score').textContent).toContain('1/5');

    saySeqSpy.mockClear();

    // Cycle language while praise/sayThen is active
    const langBtn = screen.getByTestId('lang-cycle');
    fireEvent.click(langBtn);

    // sayThen callback runs via stopNarration cancelPendingSayThen to advance game state to round 2
    expect(makeRoundSpy).toHaveBeenCalledTimes(2);

    // Score remains 1/5 (not advanced again or reset)
    expect(screen.getByTestId('sums-score').textContent).toContain('1/5');

    // Prompt is spoken in Japanese for the next round
    expect(saySeqSpy).toHaveBeenCalledWith(expect.arrayContaining([PLUS.ja, QUESTION.ja]));

    // Play the fresh round in Japanese
    const nextButtons = screen.getAllByRole('button');
    const nextCorrectBtn = nextButtons.find((b) => b.getAttribute('data-testid')?.endsWith('-answer'))!;
    expect(nextCorrectBtn).toBeDefined();

    fireEvent.click(nextCorrectBtn);

    // Score advances cleanly to 2/5 without skipped rounds or double-advance
    expect(goodSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('sums-score').textContent).toContain('2/5');
  });

  it('drops pending wrong-tap speech and clears visual error state on language switch', () => {
    vi.useFakeTimers();
    const saySpy = vi.spyOn(sound, 'say');
    const saySeqSpy = vi.spyOn(sound, 'saySequence');
    const wrongSpy = vi.spyOn(sound.sfx, 'wrong');

    render(<LangHarness initialLang="en" />);

    saySpy.mockClear();
    saySeqSpy.mockClear();

    const buttons = screen.getAllByRole('button');
    const wrongBtn = buttons.find((b) => {
      const tid = b.getAttribute('data-testid');
      return tid && tid.startsWith('sums-choice-') && !tid.endsWith('-answer');
    })!;
    expect(wrongBtn).toBeDefined();

    // Wrong choice tap sets 450ms and 500ms timeouts
    fireEvent.click(wrongBtn);
    expect(wrongSpy).toHaveBeenCalledTimes(1);

    // Advance 100ms (still within error state)
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Cycle language mid-timeout
    const langBtn = screen.getByTestId('lang-cycle');
    fireEvent.click(langBtn);

    // New Japanese prompt spoken
    expect(saySeqSpy).toHaveBeenCalledWith(expect.arrayContaining([PLUS.ja, QUESTION.ja]));
    saySpy.mockClear();

    // Advance past the old 450ms and 500ms marks
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // The old 500ms setTimeout did NOT speak the old English question
    expect(saySpy).not.toHaveBeenCalledWith(QUESTION.en);

    // Board is interactive and can be answered correctly
    const freshButtons = screen.getAllByRole('button');
    const freshCorrect = freshButtons.find((b) => b.getAttribute('data-testid')?.endsWith('-answer'))!;
    expect(freshCorrect).toBeDefined();

    fireEvent.click(freshCorrect);

    expect(screen.getByTestId('sums-score').textContent).toContain('1/5');
  });

  it('clears wrong-answer voice timer when tapping wrong then immediately correct', () => {
    vi.useFakeTimers();
    const saySpy = vi.spyOn(sound, 'say');
    const goodSpy = vi.spyOn(sound.sfx, 'good');
    const wrongSpy = vi.spyOn(sound.sfx, 'wrong');

    render(<LangHarness initialLang="en" />);

    saySpy.mockClear();

    const buttons = screen.getAllByRole('button');
    const wrongBtn = buttons.find((b) => {
      const tid = b.getAttribute('data-testid');
      return tid && tid.startsWith('sums-choice-') && !tid.endsWith('-answer');
    })!;
    const correctBtn = buttons.find((b) => b.getAttribute('data-testid')?.endsWith('-answer'))!;

    // Tap wrong choice, scheduling 500ms voice timer
    fireEvent.click(wrongBtn);
    expect(wrongSpy).toHaveBeenCalledTimes(1);

    // Immediately tap correct choice before 500ms voice timer fires
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.click(correctBtn);
    expect(goodSpy).toHaveBeenCalledTimes(1);

    // Advance past the 500ms mark; question must not be spoken
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(saySpy).not.toHaveBeenCalledWith(QUESTION.en);
    expect(screen.getByTestId('sums-score').textContent).toContain('1/5');
  });
});
