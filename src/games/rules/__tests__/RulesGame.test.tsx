// @vitest-environment happy-dom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as sound from '../../../sound';
import { RulesGame } from '../RulesGame';

describe('RulesGame', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders initial round for hard difficulty', () => {
    render(<RulesGame onHome={() => {}} difficulty="hard" lang="en" />);
    expect(screen.getByTestId('rules-score')).toBeDefined();
    expect(screen.getByText('Rule #1')).toBeDefined();
  });

  it('speaks localized intro prompt on mount based on lang', () => {
    const saySeqSpy = vi.spyOn(sound, 'saySequence').mockImplementation(() => {});
    render(<RulesGame onHome={() => {}} difficulty="easy" lang="ja" />);
    expect(saySeqSpy).toHaveBeenCalledWith([
      'ルールタイム！ ルールどおりに はやく タップ！',
      expect.any(String),
    ]);
  });

  it('speaks English intro prompt when lang is en', () => {
    const saySeqSpy = vi.spyOn(sound, 'saySequence').mockImplementation(() => {});
    render(<RulesGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(saySeqSpy).toHaveBeenCalledWith([
      'Rule Time! Do what the rule says as fast as you can.',
      expect.any(String),
    ]);
  });

  it('speaks localized memory check prompt during recall rounds', () => {
    vi.useFakeTimers();
    vi.spyOn(sound, 'saySequence').mockImplementation(() => {});
    const saySpy = vi.spyOn(sound, 'say').mockImplementation(() => {});
    render(<RulesGame onHome={() => {}} difficulty="hard" lang="ja" />);

    // Advance 5 rounds to reach round index 5 (first recall round on hard)
    for (let round = 0; round < 5; round++) {
      const matchTiles = screen.getAllByTestId(/-y$/);
      for (const tile of matchTiles) {
        fireEvent.click(tile);
      }
      act(() => {
        vi.advanceTimersByTime(600);
      });
    }

    expect(saySpy).toHaveBeenCalledWith(
      expect.stringMatching(/^きおくクイズ！ ルール \d+ばん を もういちど。 おぼえてる？$/),
    );
    vi.useRealTimers();
  });
});
