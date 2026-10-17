import React from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sfx } from '../../../sound';
import * as logic from '../logic';
import { MemoryGame } from '../MemoryGame';
import type { WinOverlay } from '../../../components/WinOverlay';
import type { GameShell, ScoreChip } from '../../../components/GameShell';
import type { ModePicker } from '../../../multiplayer';

type FakeWinOverlayProps = Partial<React.ComponentProps<typeof WinOverlay>>;
type FakeGameShellProps = Partial<React.ComponentProps<typeof GameShell>>;
type FakeScoreChipProps = Partial<React.ComponentProps<typeof ScoreChip>>;
type FakeModePickerProps = Partial<React.ComponentProps<typeof ModePicker>>;

let capturedWinOverlayProps: FakeWinOverlayProps | null = null;
vi.mock('../../../components/WinOverlay', () => ({
  WinOverlay: (props: FakeWinOverlayProps) => {
    capturedWinOverlayProps = props;
    return props.visible ? <div data-testid="mock-win-overlay">{props.message}</div> : null;
  },
}));

let capturedGameShellProps: FakeGameShellProps | null = null;
vi.mock('../../../components/GameShell', () => ({
  GameShell: (props: FakeGameShellProps) => {
    capturedGameShellProps = props;
    return (
      <div data-testid="mock-game-shell">
        <div>{props.title}</div>
        <div>{props.subtitle}</div>
        {props.right}
        {props.children}
      </div>
    );
  },
  ScoreChip: (props: FakeScoreChipProps) => <div data-testid={props.testID}>{props.label}</div>,
}));

let capturedModePickerProps: FakeModePickerProps | null = null;
vi.mock('../../../multiplayer', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    ModePicker: (props: FakeModePickerProps) => {
      capturedModePickerProps = props;
      return <div data-testid="mock-mode-picker">ModePicker</div>;
    },
  };
});

const capturedPressables: Record<string, { onPress?: () => void; [key: string]: unknown }> = {};

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const ActualPressable = actual.Pressable as React.ComponentType<Record<string, unknown>>;
  return {
    ...actual,
    Pressable: (props: Record<string, unknown>) => {
      if (typeof props.testID === 'string') {
        capturedPressables[props.testID] = props;
      }
      return React.createElement(ActualPressable, props);
    },
  };
});

// Setup minimal DOM environment for interactive React root testing
class FakeElement {
  nodeType = 1;
  tagName: string;
  style: Record<string, unknown> = {};
  childNodes: FakeElement[] = [];
  ownerDocument = doc;
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
  }
  setAttribute(): void {}
  removeAttribute(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
  appendChild(c: FakeElement): void {
    this.childNodes.push(c);
  }
  removeChild(c: FakeElement): void {
    const idx = this.childNodes.indexOf(c);
    if (idx !== -1) this.childNodes.splice(idx, 1);
  }
  insertBefore(c: FakeElement, ref: FakeElement): void {
    const idx = this.childNodes.indexOf(ref);
    if (idx !== -1) this.childNodes.splice(idx, 0, c);
    else this.childNodes.push(c);
  }
}

const doc = {
  nodeType: 9,
  defaultView: null as unknown,
  addEventListener(): void {},
  removeEventListener(): void {},
  createElement(tag: string): FakeElement {
    return new FakeElement(tag);
  },
  createTextNode(text: string) {
    return { nodeType: 3, textContent: text, ownerDocument: doc };
  },
};

const win = {
  HTMLIFrameElement: class {},
  HTMLElement: FakeElement,
  Element: FakeElement,
  Image: class {
    onload: (() => void) | null = null;
    src = '';
  },
  addEventListener(): void {},
  removeEventListener(): void {},
  document: doc,
  navigator: { userAgent: 'node' },
};
doc.defaultView = win;
global.window = win as unknown as Window & typeof globalThis;
global.document = doc as unknown as Document;
(global as unknown as Record<string, unknown>).HTMLIFrameElement = win.HTMLIFrameElement;
(global as unknown as Record<string, unknown>).HTMLElement = FakeElement;
(global as unknown as Record<string, unknown>).Element = FakeElement;
(global as unknown as Record<string, unknown>).Image = win.Image;
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('MemoryGame', () => {
  const noop = () => {};

  beforeEach(() => {
    capturedWinOverlayProps = null;
    capturedGameShellProps = null;
    capturedModePickerProps = null;
    for (const key of Object.keys(capturedPressables)) {
      delete capturedPressables[key];
    }
    vi.restoreAllMocks();
  });

  it('renders solo easy mode with 4 pairs, title, moves counter and no timer', () => {
    const onHomeSpy = vi.fn();
    const html = renderToString(<MemoryGame onHome={onHomeSpy} difficulty="easy" lang="en" />);

    expect(html).toContain('Memory Match');
    expect(html).toContain('Find all 4 pairs');
    expect(html).toContain('Moves: 0');
    expect(html).not.toContain('memory-timer');
    expect(html).toContain('memory-score');

    // OnBack in GameShell triggers onHome
    expect(capturedGameShellProps?.title).toBe('Memory Match');
    expect(capturedGameShellProps?.subtitle).toBe('Find all 4 pairs');
    capturedGameShellProps?.onBack?.();
    expect(onHomeSpy).toHaveBeenCalledOnce();

    // WinOverlay is configured with reset and onHome handlers and is initially hidden
    expect(capturedWinOverlayProps).not.toBeNull();
    expect(capturedWinOverlayProps?.visible).toBe(false);
    expect(capturedWinOverlayProps?.nextLabel).toBe('Next Round ▶️');
    expect(typeof capturedWinOverlayProps?.onNext).toBe('function');
    capturedWinOverlayProps?.onHome?.();
    expect(onHomeSpy).toHaveBeenCalledTimes(2);

    // Call onNext to test reset behavior and assert buildBoard and duelInit are called
    const buildBoardSpy = vi.spyOn(logic, 'buildBoard');
    const nextStarterSpy = vi.spyOn(logic, 'nextStarter');
    const duelInitSpy = vi.spyOn(logic, 'duelInit');
    capturedWinOverlayProps?.onNext?.();
    expect(buildBoardSpy).toHaveBeenCalledWith(expect.anything(), expect.anything(), 4);
    expect(nextStarterSpy).toHaveBeenCalled();
    expect(duelInitSpy).toHaveBeenCalled();
  });

  it('renders solo medium mode with timer and 6 pairs', () => {
    const html = renderToString(<MemoryGame onHome={noop} difficulty="medium" lang="en" />);
    expect(html).toContain('Find all 6 pairs');
    expect(html).toContain('memory-timer');
  });

  it('renders solo hard mode with timer and 8 pairs', () => {
    const html = renderToString(<MemoryGame onHome={noop} difficulty="hard" lang="en" />);
    expect(html).toContain('Find all 8 pairs');
    expect(html).toContain('memory-timer');
  });

  it('supports localization', () => {
    const htmlJa = renderToString(<MemoryGame onHome={noop} difficulty="easy" lang="ja" />);
    expect(htmlJa).toContain('しんけいすいじゃく');
    expect(htmlJa).toContain('4くみ ぜんぶ さがそう');
    expect(htmlJa).toContain('てすう: 0');

    const htmlCmn = renderToString(<MemoryGame onHome={noop} difficulty="easy" lang="cmn" />);
    expect(htmlCmn).toContain('记忆配对');
    expect(htmlCmn).toContain('找出全部 4 对');
    expect(htmlCmn).toContain('步数：0');

    const htmlYue = renderToString(<MemoryGame onHome={noop} difficulty="easy" lang="yue" />);
    expect(htmlYue).toContain('記憶配對');
    expect(htmlYue).toContain('搵晒 4 對');
    expect(htmlYue).toContain('步數：0');
  });

  it('conditionally renders mode picker based on twoPlayerEnabled', () => {
    const htmlWithPicker = renderToString(<MemoryGame onHome={noop} difficulty="easy" twoPlayerEnabled lang="en" />);
    expect(htmlWithPicker).toContain('mock-mode-picker');
    expect(capturedModePickerProps).not.toBeNull();
    expect(typeof capturedModePickerProps?.onPick).toBe('function');

    capturedModePickerProps = null;
    const htmlSolo = renderToString(<MemoryGame onHome={noop} difficulty="easy" twoPlayerEnabled={false} lang="en" />);
    expect(htmlSolo).not.toContain('mock-mode-picker');
    expect(capturedModePickerProps).toBeNull();
    expect(htmlSolo).toContain('Moves: 0');
  });

  it('renders all cards and handles interactive card matching with sound effects', async () => {
    vi.useFakeTimers();
    try {
      const sfxGoodSpy = vi.spyOn(sfx, 'good').mockReturnValue();
      const container = doc.createElement('div');
      const root = createRoot(container as unknown as HTMLElement);

      await React.act(async () => {
        root.render(<MemoryGame onHome={noop} difficulty="easy" lang="en" />);
      });

      const cardKeys = Object.keys(capturedPressables);
      expect(cardKeys.length).toBe(8);

      // Verify all cards have button roles and accessibility labels
      for (const key of cardKeys) {
        const card = capturedPressables[key];
        expect(card.accessibilityRole).toBe('button');
        expect(card.accessibilityLabel).toBe('face-down card');
        expect(typeof card.onPress).toBe('function');
      }

      // Group cards by icon (format: memory-card-{key}-{icon})
      const iconToKeys = new Map<string, string[]>();
      for (const key of cardKeys) {
        const icon = key.replace(/^memory-card-\d+-/, '');
        const list = iconToKeys.get(icon) ?? [];
        list.push(key);
        iconToKeys.set(icon, list);
      }

      const icons = Array.from(iconToKeys.keys());
      const [pairAFirst, pairASecond] = iconToKeys.get(icons[0])!;
      const [pairBFirst] = iconToKeys.get(icons[1])!;

      // Flip two non-matching cards (pairAFirst and pairBFirst)
      await React.act(async () => {
        capturedPressables[pairAFirst].onPress?.();
      });
      await React.act(async () => {
        capturedPressables[pairBFirst].onPress?.();
      });

      // Advance mismatch flip timer
      await React.act(async () => {
        vi.advanceTimersByTime(750);
      });

      // Now flip a matching pair (pairAFirst and pairASecond)
      await React.act(async () => {
        capturedPressables[pairAFirst].onPress?.();
      });
      await React.act(async () => {
        capturedPressables[pairASecond].onPress?.();
      });

      // Flipping a matching pair triggers sfx.good()!
      expect(sfxGoodSpy).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
