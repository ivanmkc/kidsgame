// @vitest-environment happy-dom
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { LockdownSettings } from '../LockdownSettings';

afterEach(cleanup);

describe('LockdownSettings Interactive', () => {
  it('toggles game', () => {
    const onToggleGame = vi.fn();
    render(
      <LockdownSettings
        hiddenGames={[]}
        hiddenLangs={[]}
        onToggleGame={onToggleGame}
        onToggleLang={vi.fn()}
        onDone={vi.fn()}
      />,
    );
    const inputs = screen.getAllByTestId('lock-game-bingo');
    const input = inputs[0].querySelector('input');
    fireEvent.click(input!);
    expect(onToggleGame).toHaveBeenCalledWith('bingo');
  });

  it('toggles lang ok', () => {
    const onToggleLang = vi.fn().mockReturnValue(true);
    render(
      <LockdownSettings
        hiddenGames={[]}
        hiddenLangs={[]}
        onToggleGame={vi.fn()}
        onToggleLang={onToggleLang}
        onDone={vi.fn()}
      />,
    );
    const inputs = screen.getAllByTestId('lock-lang-ja');
    const input = inputs[0].querySelector('input');
    fireEvent.click(input!);
    expect(onToggleLang).toHaveBeenCalledWith('ja');
    expect(screen.queryByText('At least one language must remain visible.')).toBeNull();
  });

  it('toggles lang fail', () => {
    vi.useFakeTimers();
    const onToggleLang = vi.fn().mockReturnValue(false);
    render(
      <LockdownSettings
        hiddenGames={[]}
        hiddenLangs={[]}
        onToggleGame={vi.fn()}
        onToggleLang={onToggleLang}
        onDone={vi.fn()}
      />,
    );
    const inputs = screen.getAllByTestId('lock-lang-en');
    const input = inputs[0].querySelector('input');
    fireEvent.click(input!);
    expect(onToggleLang).toHaveBeenCalledWith('en');
    expect(screen.getByText('At least one language must remain visible.')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.queryByText('At least one language must remain visible.')).toBeNull();

    vi.useRealTimers();
  });
});
