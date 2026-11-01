// @vitest-environment happy-dom
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CountGame } from '../CountGame';
import { say, saySequence, sayThen, stopNarration } from '../../../sound';
import { LangContext } from '../../../components/GameShell';
import { Difficulty } from '../../../difficulty';
import { Lang } from '../../../lang';
import { t } from '../../../i18n';
import { PROMPTS } from '../logic';

vi.mock('../../../sound', () => ({
  sfx: { good: vi.fn(), wrong: vi.fn(), win: vi.fn(), tap: vi.fn() },
  say: vi.fn(),
  saySequence: vi.fn(),
  sayThen: vi.fn((_texts: string[], done: () => void) => {
    done();
  }),
  stopNarration: vi.fn(),
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
      <CountGame onHome={() => {}} difficulty={difficulty} lang={lang} />
    </LangContext.Provider>
  );
}

describe('CountGame language switch safety', () => {
  beforeEach(() => {
    vi.mocked(say).mockClear();
    vi.mocked(saySequence).mockClear();
    vi.mocked(sayThen).mockClear();
    vi.mocked(stopNarration).mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('stops narration and updates speech prompt when language switches during count phase', () => {
    vi.useFakeTimers();
    render(<LangHarness initialLang="en" />);

    expect(say).toHaveBeenCalledWith(t('en', 'shell.count.sub'));

    vi.mocked(stopNarration).mockClear();
    vi.mocked(say).mockClear();

    const langBtn = screen.getByTestId('lang-cycle');
    act(() => {
      fireEvent.click(langBtn);
    });

    expect(stopNarration).toHaveBeenCalledTimes(1);
    expect(say).toHaveBeenCalledWith(t('ja', 'shell.count.sub'));
  });

  it('stops narration and updates quiz prompt when language switches during quiz phase', () => {
    vi.useFakeTimers();
    render(<LangHarness initialLang="en" />);

    // Play through count phase to reach quiz phase
    const stages = screen.getAllByTestId(/count-stage-/);
    const stage = stages[stages.length - 1];
    const n = Number(stage.getAttribute('data-testid')!.split('-').pop());
    for (let i = 0; i < n; i++) {
      fireEvent.click(screen.getByTestId(`count-critter-${i}`));
    }

    expect(screen.getByTestId('count-prompt')).toBeDefined();
    expect(say).toHaveBeenCalledWith(PROMPTS.en);

    vi.mocked(stopNarration).mockClear();
    vi.mocked(say).mockClear();

    const langBtn = screen.getByTestId('lang-cycle');
    act(() => {
      fireEvent.click(langBtn);
    });

    expect(stopNarration).toHaveBeenCalledTimes(1);
    expect(say).toHaveBeenCalledWith(PROMPTS.ja);
    expect(screen.getByTestId('count-prompt').textContent).toContain(t('ja', 'shell.count.prompt'));
  });

  it('clears pending wrong answer timeouts and prevents stale speech when language switches after wrong pick', () => {
    vi.useFakeTimers();
    render(<LangHarness initialLang="en" />);

    // Reach quiz phase
    const stages = screen.getAllByTestId(/count-stage-/);
    const stage = stages[stages.length - 1];
    const n = Number(stage.getAttribute('data-testid')!.split('-').pop());
    for (let i = 0; i < n; i++) {
      fireEvent.click(screen.getByTestId(`count-critter-${i}`));
    }

    const choices = screen.queryAllByTestId(/count-choice-/);
    const wrongChoice = choices.find((c) => !c.getAttribute('data-testid')?.includes('-answer'));
    expect(wrongChoice).toBeDefined();

    // Click wrong answer (schedules a timeout for retry prompt)
    fireEvent.click(wrongChoice!);
    vi.mocked(say).mockClear();

    // Switch language mid-round before timeout fires
    const langBtn = screen.getByTestId('lang-cycle');
    act(() => {
      fireEvent.click(langBtn);
    });

    expect(stopNarration).toHaveBeenCalled();

    // Advance timers past wrong answer delay
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Old-language wrong-answer speech must not fire after language switch
    expect(say).not.toHaveBeenCalledWith(PROMPTS.en);
  });
});
