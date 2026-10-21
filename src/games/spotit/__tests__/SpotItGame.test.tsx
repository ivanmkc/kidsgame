// @vitest-environment happy-dom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import * as sound from '../../../sound';
import { t } from '../../../i18n';
import { SpotItGame } from '../SpotItGame';

describe('SpotItGame spoken prompt localization', () => {
  let useSaySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    useSaySpy = vi.spyOn(sound, 'useSay');
  });

  afterEach(() => {
    cleanup();
  });

  it('speaks localized instructions for Japanese', () => {
    render(<SpotItGame onHome={() => {}} difficulty="easy" lang="ja" />);
    expect(useSaySpy).toHaveBeenCalledWith(t('ja', 'shell.spotit.sub'));
    expect(screen.getByText(t('ja', 'shell.spotit.sub'))).toBeTruthy();
  });

  it('speaks localized instructions for Mandarin and Cantonese', () => {
    render(<SpotItGame onHome={() => {}} difficulty="easy" lang="cmn" />);
    expect(useSaySpy).toHaveBeenCalledWith(t('cmn', 'shell.spotit.sub'));

    cleanup();
    useSaySpy.mockClear();

    render(<SpotItGame onHome={() => {}} difficulty="easy" lang="yue" />);
    expect(useSaySpy).toHaveBeenCalledWith(t('yue', 'shell.spotit.sub'));
  });

  it('speaks English prompt from translation table', () => {
    render(<SpotItGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(useSaySpy).toHaveBeenCalledWith(t('en', 'shell.spotit.sub'));
    expect(screen.getByText(t('en', 'shell.spotit.sub'))).toBeTruthy();
  });

  it('updates spoken prompt when language changes', () => {
    const { rerender } = render(<SpotItGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(useSaySpy).toHaveBeenCalledWith(t('en', 'shell.spotit.sub'));

    useSaySpy.mockClear();
    rerender(<SpotItGame onHome={() => {}} difficulty="easy" lang="ja" />);
    expect(useSaySpy).toHaveBeenCalledWith(t('ja', 'shell.spotit.sub'));
  });

  it('does not speak instructional prompt while mode picker is active', () => {
    render(<SpotItGame onHome={() => {}} difficulty="easy" twoPlayerEnabled={true} lang="ja" />);
    expect(useSaySpy).toHaveBeenCalledWith(null);
    expect(useSaySpy).not.toHaveBeenCalledWith(t('ja', 'shell.spotit.sub'));
  });

  it('renders localized accessibility labels on card symbols', () => {
    render(<SpotItGame onHome={() => {}} difficulty="easy" lang="ja" />);
    const buttons = screen.getAllByRole('button');
    const symbolButtons = buttons.filter((b) => b.getAttribute('data-testid')?.startsWith('top-symbol-'));
    expect(symbolButtons.length).toBeGreaterThan(0);
    for (const btn of symbolButtons) {
      const label = btn.getAttribute('aria-label');
      expect(label).toBeTruthy();
      expect(label).not.toMatch(/^[a-z]+$/);
    }
  });
});
