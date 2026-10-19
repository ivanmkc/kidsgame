// @vitest-environment happy-dom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as sound from '../../../sound';
import { sfx } from '../../../sound';
import { manifest, Story } from '../../../manifest';
import { StoryGame } from '../StoryGame';

describe('StoryGame i18n', () => {
  const initialStoryCount = manifest.stories?.length ?? 0;
  const noop = () => {};

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound, 'say').mockImplementation(() => {});
    vi.spyOn(sound, 'saySequence').mockImplementation(() => {});
    vi.spyOn(sfx, 'tap').mockImplementation(() => {});
    vi.spyOn(sfx, 'boing').mockImplementation(() => {});
    vi.spyOn(sfx, 'thunder').mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    cleanup();
    if (manifest.stories && manifest.stories.length > initialStoryCount) {
      manifest.stories.splice(initialStoryCount);
    }
  });

  it('localizes story titles in ScenePicker options for non-English languages', () => {
    render(<StoryGame onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />);

    expect(screen.getByText('ルナの たのしい いちにち')).toBeTruthy();
  });

  it('renders localized subtitle, story text, and speaks localized sequence for Japanese', () => {
    const saySeqSpy = vi.spyOn(sound, 'saySequence');

    render(<StoryGame sceneId="luna" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />);

    expect(screen.getByText('ルナの たのしい いちにち')).toBeTruthy();
    const storyTextEl = screen.getByTestId('story-text-start');
    expect(storyTextEl.textContent).toBe(
      'ユニコーンの ルナは、はれた あさに めを さましたよ。きょうは どこへ いこうかな？',
    );

    expect(saySeqSpy).toHaveBeenCalledWith([
      'ユニコーンの ルナは、はれた あさに めを さましたよ。きょうは どこへ いこうかな？',
      'いきたい ほうを タップ！',
      'もりへ ぱかぱか！ 🌲',
      'うみへ ぎゃろっぷ！ 🌊',
    ]);
  });

  it('speaks localized choice label on hotspot dive tap', () => {
    const saySpy = vi.spyOn(sound, 'say');

    render(<StoryGame sceneId="luna" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />);

    const choiceA = screen.getByTestId('story-choice-a');
    expect(choiceA.getAttribute('aria-label')).toBe('もりへ ぱかぱか！ 🌲');

    fireEvent.click(choiceA);
    expect(saySpy).toHaveBeenCalledWith('もりへ ぱかぱか！ 🌲');
  });

  it('localizes node text, choice menu, and tap speech for Mandarin', () => {
    const saySeqSpy = vi.spyOn(sound, 'saySequence');
    const saySpy = vi.spyOn(sound, 'say');

    render(<StoryGame sceneId="luna" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="cmn" />);

    expect(screen.getByText('露娜的开心一天')).toBeTruthy();
    const storyTextEl = screen.getByTestId('story-text-start');
    expect(storyTextEl.textContent).toBe('独角兽露娜在晴天早晨醒来了。今天要去哪儿呢？');

    expect(saySeqSpy).toHaveBeenCalledWith([
      '独角兽露娜在晴天早晨醒来了。今天要去哪儿呢？',
      '想去哪就点哪！',
      '小跑去森林！ 🌲',
      '飞奔到海边！ 🌊',
    ]);

    const choiceB = screen.getByTestId('story-choice-b');
    fireEvent.click(choiceB);
    expect(saySpy).toHaveBeenCalledWith('飞奔到海边！ 🌊');
  });

  it('localizes button choices and speaks localized label on tap', () => {
    const customStory: Story = {
      id: 'test-button-i18n',
      title: 'Button Story',
      titleT: { ja: 'ボタンのおはなし' },
      nodes: {
        start: {
          image: 'story/luna_start.jpg',
          text: 'Where to go?',
          t: { ja: 'どこへいく？' },
          choices: [
            {
              label: 'Go left',
              t: { ja: 'ひだりへ' },
              next: 'left',
            },
            {
              label: 'Go right',
              t: { ja: 'みぎへ' },
              next: 'right',
            },
          ],
        },
        left: {
          image: 'story/luna_start.jpg',
          text: 'You went left.',
          t: { ja: 'ひだりにきたよ。' },
        },
      },
    };
    manifest.stories?.push(customStory);

    const saySeqSpy = vi.spyOn(sound, 'saySequence');
    const saySpy = vi.spyOn(sound, 'say');
    render(<StoryGame sceneId="test-button-i18n" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />);

    expect(screen.getByText('ひだりへ')).toBeTruthy();
    expect(screen.getByText('みぎへ')).toBeTruthy();

    expect(saySeqSpy).toHaveBeenCalledWith(['どこへいく？', 'つぎは どうなる？', 'ひだりへ', 'みぎへ']);

    fireEvent.click(screen.getByTestId('story-choice-left'));
    expect(saySpy).toHaveBeenCalledWith('ひだりへ');
  });

  it('speaks localized scare reveal in Japanese when triggered', () => {
    const saySpy = vi.spyOn(sound, 'say');

    render(<StoryGame sceneId="whisper" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />);

    const scareBtn = screen.getByTestId('story-scare');
    fireEvent.click(scareBtn);

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(saySpy).toHaveBeenCalledWith('ただの ふるい カラスさん！ しげみで ねてたんだって。すすもう、ミロ…');
  });

  it('falls back to English when non-English translations are missing', () => {
    const englishOnlyStory: Story = {
      id: 'test-en-only',
      title: 'English Only Title',
      nodes: {
        start: {
          image: 'story/luna_start.jpg',
          text: 'English node text.',
          choices: [
            {
              label: 'English choice',
              next: 'next',
            },
          ],
          scare: {
            x: 0,
            y: 0,
            w: 10,
            h: 10,
            pop: 'story/luna_start_c0.png',
            sting: 'boing',
            reveal: 'English reveal!',
            delay: 100,
          },
        },
      },
    };
    manifest.stories?.push(englishOnlyStory);

    const saySeqSpy = vi.spyOn(sound, 'saySequence');
    const saySpy = vi.spyOn(sound, 'say');

    render(<StoryGame sceneId="test-en-only" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />);

    expect(screen.getByText('English Only Title')).toBeTruthy();
    expect(screen.getByText('English node text.')).toBeTruthy();
    expect(screen.getByText('English choice')).toBeTruthy();

    // With lang="ja", untranslated story content falls back to English, while prompt lead uses ja
    expect(saySeqSpy).toHaveBeenCalledWith(['English node text.', 'つぎは どうなる？', 'English choice']);

    fireEvent.click(screen.getByTestId('story-scare'));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(saySpy).toHaveBeenCalledWith('English reveal!');
  });

  it('localizes node text, choice menu, and tap speech for Cantonese', () => {
    const saySeqSpy = vi.spyOn(sound, 'saySequence');
    const saySpy = vi.spyOn(sound, 'say');

    render(<StoryGame sceneId="luna" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="yue" />);

    expect(screen.getByText('露娜開心嘅一日')).toBeTruthy();
    const storyTextEl = screen.getByTestId('story-text-start');
    expect(storyTextEl.textContent).toBe('獨角獸露娜喺晴天朝早瞓醒喇。今日去邊度好呢？');

    expect(saySeqSpy).toHaveBeenCalledWith([
      '獨角獸露娜喺晴天朝早瞓醒喇。今日去邊度好呢？',
      '想去邊就撳邊！',
      '跑去森林！ 🌲',
      '飛奔去海邊！ 🌊',
    ]);

    const choiceA = screen.getByTestId('story-choice-a');
    fireEvent.click(choiceA);
    expect(saySpy).toHaveBeenCalledWith('跑去森林！ 🌲');
  });
});
