// @vitest-environment happy-dom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../../i18n';
import { manifest } from '../../../manifest';
import { HiddenGame } from '../HiddenGame';

describe('HiddenGame localization', () => {
  const noop = () => {};

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('renders TurnBanner with Japanese text and accessibilityLabel in 2P mode', () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={true}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );

    // Enter 2-player mode via mode picker
    fireEvent.click(screen.getByTestId('mp-choose-2p'));

    const banner = screen.getByTestId('hidden-turn-banner');
    expect(banner).toBeDefined();
    expect(banner.getAttribute('aria-label')).toBe('Foxyの ばん！');
    expect(screen.getByText(/Foxyの ばん！/)).toBeDefined();
    expect(screen.queryByText(/Foxy's turn/)).toBeNull();
  });

  it('renders TurnBanner with English text in en mode', () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={true}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    fireEvent.click(screen.getByTestId('mp-choose-2p'));

    const banner = screen.getByTestId('hidden-turn-banner');
    expect(banner).toBeDefined();
    expect(banner.getAttribute('aria-label')).toBe("Foxy's turn!");
    expect(screen.getByText(/Foxy's turn!/)).toBeDefined();
  });

  it('renders TurnBanner in Chinese and Cantonese', () => {
    const { unmount: unmountCmn } = render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={true}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="cmn"
      />,
    );
    fireEvent.click(screen.getByTestId('mp-choose-2p'));
    expect(screen.getByText(/轮到Foxy了！/)).toBeDefined();
    unmountCmn();
    cleanup();

    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={true}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="yue"
      />,
    );
    fireEvent.click(screen.getByTestId('mp-choose-2p'));
    expect(screen.getByText(/到Foxy喇！/)).toBeDefined();
  });

  it('speaks localized narration cues for solo play and 2P turn changes', () => {
    const speakSpy = vi.fn();
    (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
      speak: speakSpy,
      cancel: vi.fn(),
    };
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    };

    // In scene picker with Japanese
    const { unmount: unmountPicker } = render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={false}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    expect(speakSpy).toHaveBeenCalledWith(expect.objectContaining({ text: 'どこで さがす？' }));
    unmountPicker();
    cleanup();
    speakSpy.mockClear();

    // In solo scene with Japanese
    const { unmount: unmountSolo } = render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={false}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    expect(speakSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'かくれてる ものを ぜんぶ みつけよう！',
      }),
    );
    unmountSolo();
    cleanup();
    speakSpy.mockClear();

    // In 2P scene with Japanese
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={true}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    fireEvent.click(screen.getByTestId('mp-choose-2p'));
    expect(speakSpy).toHaveBeenCalledWith(expect.objectContaining({ text: 'Foxyの ばん！' }));
  });

  it('does not speak intro prompts when mode is null (ModePicker is visible)', () => {
    const speakSpy = vi.fn();
    (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
      speak: speakSpy,
      cancel: vi.fn(),
    };
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    };

    // In picker with 2P enabled (mode === null)
    const { unmount: unmountPicker } = render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={true}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    expect(screen.getByTestId('mode-picker')).toBeDefined();
    expect(speakSpy).toHaveBeenCalledWith(expect.objectContaining({ text: t('ja', 'mp.title') }));
    expect(speakSpy).not.toHaveBeenCalledWith(expect.objectContaining({ text: t('ja', 'picker.hidden') }));

    // Choosing solo speaks the picker prompt
    speakSpy.mockClear();
    fireEvent.click(screen.getByTestId('mp-choose-1p'));
    expect(speakSpy).toHaveBeenCalledWith(expect.objectContaining({ text: t('ja', 'picker.hidden') }));

    unmountPicker();
    cleanup();
    speakSpy.mockClear();

    // In active scene with 2P enabled (mode === null)
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={true}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    expect(screen.getByTestId('mode-picker')).toBeDefined();
    expect(speakSpy).toHaveBeenCalledWith(expect.objectContaining({ text: t('ja', 'mp.title') }));
    expect(speakSpy).not.toHaveBeenCalledWith(expect.objectContaining({ text: t('ja', 'hidden.prompt') }));

    // Choosing solo speaks the game prompt
    speakSpy.mockClear();
    fireEvent.click(screen.getByTestId('mp-choose-1p'));
    expect(speakSpy).toHaveBeenCalledWith(expect.objectContaining({ text: t('ja', 'hidden.prompt') }));
  });

  it('renders TapScene targets with localized accessibilityLabel in active scene', () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={false}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );

    const targets = screen.getAllByRole('button').filter((el) =>
      el.getAttribute('data-testid')?.startsWith('hidden-target-'),
    );
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(target.getAttribute('aria-label')).toBe(t('ja', 'a11y.target'));
    }
  });
});

describe('HiddenGame gentle auto-hint', () => {
  const noop = () => {};

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
  });

  it('triggers a visual hint on an unfound target after 15 seconds of inactivity in solo mode', () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="easy"
        twoPlayerEnabled={false}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    const targets = screen.getAllByRole('button').filter((el) =>
      el.getAttribute('data-testid')?.startsWith('hidden-target-'),
    );
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((t) => t.children.length === 0)).toBe(true);

    act(() => {
      vi.advanceTimersByTime(14999);
    });
    expect(targets.every((t) => t.children.length === 0)).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    const hinted = targets.filter((t) => t.children.length > 0);
    expect(hinted.length).toBe(1);
  });

  it('clears the hint after its 2.5-second duration', () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="easy"
        twoPlayerEnabled={false}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    const targets = screen.getAllByRole('button').filter((el) =>
      el.getAttribute('data-testid')?.startsWith('hidden-target-'),
    );

    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(targets.filter((t) => t.children.length > 0).length).toBe(1);

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(targets.every((t) => t.children.length === 0)).toBe(true);
  });

  it('resets the 15-second inactivity timer when a target is found', () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="easy"
        twoPlayerEnabled={false}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    const targets = screen.getAllByRole('button').filter((el) =>
      el.getAttribute('data-testid')?.startsWith('hidden-target-'),
    );
    expect(targets.length).toBeGreaterThan(1);

    // Wait 10 seconds (no hint yet)
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(targets.every((t) => t.children.length === 0)).toBe(true);

    // Find the first target
    fireEvent.click(targets[0]);

    // Target 0 is now found (has FoundRing)
    expect(targets[0].children.length).toBeGreaterThan(0);

    const remaining = targets.slice(1);

    // Advance 10 more seconds (20 seconds since game start, but 10 seconds since hit)
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(remaining.every((t) => t.children.length === 0)).toBe(true);

    // Advance 5 more seconds (15 seconds since hit) -> hint appears on one of the remaining targets
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(remaining.filter((t) => t.children.length > 0).length).toBe(1);
  });

  it('does not trigger visual hints on hard difficulty after 15 seconds of inactivity', () => {
    render(
      <HiddenGame
        onHome={noop}
        difficulty="hard"
        filter="hard"
        twoPlayerEnabled={false}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    const targets = screen.getAllByRole('button').filter((el) =>
      el.getAttribute('data-testid')?.startsWith('hidden-target-'),
    );
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((t) => t.children.length === 0)).toBe(true);

    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(targets.every((t) => t.children.length === 0)).toBe(true);
  });
});
