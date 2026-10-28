// @vitest-environment happy-dom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as sound from '../../../sound';
import { t } from '../../../i18n';
import { SpotItGame } from '../SpotItGame';
import * as difficultyModule from '../../../difficulty';

describe('SpotItGame win line localization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.spyOn(sound.sfx, 'wrong').mockImplementation(() => {});
    vi.spyOn(sound.sfx, 'good').mockImplementation(() => {});
    vi.spyOn(difficultyModule, 'settingsFor').mockReturnValue({
      ...difficultyModule.settingsFor('easy'),
      spotitRounds: 1, // fast win
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('updates spoken win message when language changes', async () => {
    const saySpy = vi.spyOn(sound, 'say').mockImplementation(() => {});
    const { rerender } = render(
      <SpotItGame onHome={() => {}} difficulty="easy" seed={42} lang="en" />,
    );

    // Play one round to win
    const topButtons = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('top-symbol-'));
    const bottomButtons = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('bottom-symbol-'));
    const topSymbolIds = topButtons.map((b) =>
      b.getAttribute('data-testid')!.replace('top-symbol-', ''),
    );
    const bottomSymbolIds = bottomButtons.map((b) =>
      b.getAttribute('data-testid')!.replace('bottom-symbol-', ''),
    );
    const matchingId = topSymbolIds.find((id) => bottomSymbolIds.includes(id));

    fireEvent.click(screen.getByTestId(`top-symbol-${matchingId}`));

    // Expect English win line
    expect(saySpy).toHaveBeenCalledWith(t('en', 'win.spotit'));

    saySpy.mockClear();

    // Rerender with Japanese
    rerender(<SpotItGame onHome={() => {}} difficulty="easy" seed={42} lang="ja" />);

    // Expect Japanese win line to be spoken because it was re-rendered with new lang
    expect(saySpy).toHaveBeenCalledWith(t('ja', 'win.spotit'));
  });
});
