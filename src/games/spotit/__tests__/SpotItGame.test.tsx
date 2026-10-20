// @vitest-environment happy-dom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpotItGame } from '../SpotItGame';
import * as logic from '../logic';
import { t } from '../../../i18n';

describe('SpotItGame', () => {
  const noop = () => {};

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows Play Again button upon winning solo mode', () => {
    let currentAnswer = 0;
    const originalDealRound = logic.dealRound;
    vi.spyOn(logic, 'dealRound').mockImplementation((rng, deck) => {
      const round = originalDealRound(rng, deck);
      currentAnswer = round.answer;
      return round;
    });

    render(<SpotItGame onHome={noop} difficulty="easy" seed={42} twoPlayerEnabled={false} lang="en" />);

    // In easy mode, we need 10 rounds to win
    for (let i = 0; i < 10; i++) {
      const topCardSymbol = screen.getByTestId(`top-symbol-${currentAnswer}`);
      fireEvent.click(topCardSymbol);
    }

    expect(screen.getByText(t('en', 'overlay.playAgain'))).toBeTruthy();
  });
});
