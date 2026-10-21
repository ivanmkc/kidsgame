// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
