// @vitest-environment happy-dom
import React from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as magic from '../magic';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../../i18n';
import { Lang } from '../../../lang';
import { GestureResponderEvent, PanResponder, PanResponderCallbacks, PanResponderGestureState } from 'react-native';
import { sfx } from '../../../sound';
import { allSceneOptions } from '../../sceneOptions';
import { StickerGame } from '../StickerGame';

type FakeResponderEvent = Omit<Partial<GestureResponderEvent>, 'nativeEvent'> & {
  nativeEvent?: Partial<GestureResponderEvent['nativeEvent']>;
};
type FakeGestureState = Partial<PanResponderGestureState>;

// Intercept ScenePicker to verify props and simulate interactions
let capturedPickerProps: {
  title?: string;
  lang?: string;
  options?: unknown[];
  onPick?: (id: string) => void;
  onSurprise?: () => void;
} | null = null;

vi.mock('../../../components/ScenePicker', () => ({
  ScenePicker: (props: {
    title?: string;
    lang?: string;
    options?: unknown[];
    onPick?: (id: string) => void;
    onSurprise?: () => void;
  }) => {
    capturedPickerProps = props;
    return <div data-testid="mock-scene-picker">{props.title}</div>;
  },
}));

let capturedGameShellProps: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  backKind?: string;
  right?: React.ReactNode;
} | null = null;

vi.mock('../../../components/GameShell', () => ({
  GameShell: (props: {
    title?: string;
    subtitle?: string;
    onBack?: () => void;
    backKind?: string;
    right?: React.ReactNode;
    children?: React.ReactNode;
  }) => {
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
}));

const capturedPressableProps: Record<
  string,
  {
    onPress?: () => void;
    disabled?: boolean;
    style?: unknown;
    testID?: string;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    [key: string]: unknown;
  }
> = {};

const capturedViewProps: Record<
  string,
  {
    onLayout?: (e: unknown) => void;
    testID?: string;
    ref?: unknown;
    [key: string]: unknown;
  }
> = {};

let mockDimensions: { width: number; height: number } | null = null;

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const ActualPressable = actual.Pressable as React.ComponentType<Record<string, unknown>>;
  const ActualView = actual.View as React.ComponentType<Record<string, unknown>>;

  return {
    ...actual,
    useWindowDimensions: () =>
      mockDimensions ?? (actual.useWindowDimensions as () => { width: number; height: number })(),
    Pressable: (props: Record<string, unknown>) => {
      const testID = typeof props.testID === 'string' ? props.testID : undefined;
      if (testID) {
        capturedPressableProps[testID] = props;
      }
      return React.createElement(ActualPressable, props);
    },
    View: (props: Record<string, unknown>) => {
      const testID = typeof props.testID === 'string' ? props.testID : undefined;
      if (testID) {
        capturedViewProps[testID] = props;
      }
      const ref = props.ref as { current: unknown } | undefined;
      if (ref && testID === 'sticker-stage') {
        ref.current = {
          measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => {
            cb(10, 20, 300, 200);
          },
        };
      }
      return React.createElement(ActualView, props);
    },
  };
});

describe('StickerGame', () => {
  beforeEach(() => {
    mockDimensions = null;
    capturedPickerProps = null;
    capturedGameShellProps = null;
    for (const key of Object.keys(capturedPressableProps)) {
      delete capturedPressableProps[key];
    }
    for (const key of Object.keys(capturedViewProps)) {
      delete capturedViewProps[key];
    }
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  });

  afterEach(() => {
    cleanup();
  });

  const noop = () => {};

  it('renders ScenePicker when sceneId is omitted', () => {
    const onHomeSpy = vi.fn();
    const onPickSpy = vi.fn();

    const html = renderToString(
      <StickerGame onHome={onHomeSpy} onPickScene={onPickSpy} onBackToPicker={noop} lang="en" />,
    );

    expect(html).toContain('Sticker Party');
    expect(html).toContain('Pick a place to decorate');
    expect(capturedPickerProps).not.toBeNull();
    expect(capturedGameShellProps?.title).toBe('Sticker Party');
    expect(capturedGameShellProps?.subtitle).toBe('Pick a place to decorate');

    // Test onBack in GameShell calls onHome
    capturedGameShellProps?.onBack?.();
    expect(onHomeSpy).toHaveBeenCalledOnce();

    // Verify onPick handler
    capturedPickerProps?.onPick?.('d-farm');
    expect(onPickSpy).toHaveBeenCalledWith('d-farm');

    // Verify onSurprise handler
    capturedPickerProps?.onSurprise?.();
    expect(onPickSpy).toHaveBeenCalledTimes(2);
  });

  it('falls back to ScenePicker when sceneId does not match any known backdrop', () => {
    const html = renderToString(
      <StickerGame sceneId="unknown-scene" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />,
    );

    expect(html).toContain('シールあそび');
    expect(html).toContain('かざる ばしょを えらぼう');
    expect(capturedPickerProps).not.toBeNull();
  });

  it('renders correctly in other supported languages', () => {
    const htmlCmn = renderToString(<StickerGame onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="cmn" />);
    expect(htmlCmn).toContain('贴纸派对');
    expect(htmlCmn).toContain('选个地方装饰');

    const htmlYue = renderToString(<StickerGame onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="yue" />);
    expect(htmlYue).toContain('貼紙派對');
    expect(htmlYue).toContain('揀個地方裝飾');
  });

  it('renders game canvas with stage, tabs, tray and clear button when sceneId is valid', () => {
    const onBackToPickerSpy = vi.fn();
    const sfxFlipSpy = vi.spyOn(sfx, 'flip').mockReturnValue();
    const sfxTapSpy = vi.spyOn(sfx, 'tap').mockReturnValue();

    const html = renderToString(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={onBackToPickerSpy} lang="ja" />,
    );

    expect(html).toContain('data-testid="sticker-stage"');
    expect(html).toContain('data-testid="sticker-clear"');
    expect(html).toContain('data-testid="sticker-tab-dressup"');
    expect(html).toContain('data-testid="sticker-tab-animals"');
    expect(html).toContain('data-testid="sticker-tab-nature"');
    expect(html).toContain('data-testid="sticker-tab-food"');
    expect(html).toContain('data-testid="sticker-tab-things"');

    // Test onBack in GameShell calls onBackToPicker
    expect(capturedGameShellProps?.backKind).toBe('picker');
    capturedGameShellProps?.onBack?.();
    expect(onBackToPickerSpy).toHaveBeenCalledOnce();

    // Test clear button press
    const clearBtn = capturedPressableProps['sticker-clear'];
    expect(clearBtn).toBeDefined();
    expect(clearBtn?.accessibilityLabel).toBe('シールを ぜんぶ けす');
    expect(clearBtn?.accessibilityRole).toBe('button');
    expect(clearBtn?.hitSlop).toEqual({ top: 12, bottom: 12, left: 12, right: 12 });

    // Exercise style function on clear button
    expect(typeof clearBtn?.style).toBe('function');
    const styleFn = clearBtn?.style as (state: { pressed: boolean }) => unknown[];
    const styleNormal = styleFn({ pressed: false });
    const stylePressed = styleFn({ pressed: true });
    expect(stylePressed).toContainEqual({ opacity: 0.8 });
    expect(styleNormal).not.toContainEqual({ opacity: 0.8 });
    expect(styleNormal).toContainEqual(expect.objectContaining({ minHeight: 44 }));

    clearBtn?.onPress?.();
    expect(sfxFlipSpy).toHaveBeenCalledOnce();

    // Test all tab buttons press and style
    const tabs = ['dressup', 'animals', 'nature', 'food', 'things'];
    for (const tabId of tabs) {
      const tabBtn = capturedPressableProps[`sticker-tab-${tabId}`];
      expect(tabBtn).toBeDefined();
      expect(tabBtn?.accessibilityRole).toBe('button');
      expect(tabBtn?.hitSlop).toEqual({ top: 12, bottom: 12, left: 12, right: 12 });
      expect(tabBtn?.style).toContainEqual(expect.objectContaining({ minHeight: 44 }));
      tabBtn?.onPress?.();
    }
    expect(sfxTapSpy).toHaveBeenCalledTimes(5);
  });

  it('renders across various backdrop scenes with subtitle interpolation', () => {
    const backdrops = allSceneOptions('all');
    for (const b of backdrops.slice(0, 4)) {
      const html = renderToString(
        <StickerGame sceneId={b.id} onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />,
      );
      expect(html).toContain('data-testid="sticker-stage"');
      expect(html).toContain(b.name);
      expect(capturedGameShellProps?.subtitle).toBe(`${b.name} — decorate it your way!`);
    }
  });

  it('handles tray item interactions including tap and drag/drop', () => {
    const sfxTapSpy = vi.spyOn(sfx, 'tap').mockReturnValue();
    const configs: PanResponderCallbacks[] = [];
    const panSpy = vi.spyOn(PanResponder, 'create').mockImplementation((config) => {
      configs.push(config);
      const fakePan: Partial<ReturnType<typeof PanResponder.create>> = {
        panHandlers: {
          onStartShouldSetResponder: () => true,
        } as ReturnType<typeof PanResponder.create>['panHandlers'],
      };
      return fakePan as ReturnType<typeof PanResponder.create>;
    });

    renderToString(<StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />);

    expect(configs.length).toBeGreaterThan(0);
    const trayPan = configs[0];

    const fakeEvent: FakeResponderEvent = {
      nativeEvent: { pageX: 100, pageY: 100 },
    };
    const emptyEvent: FakeResponderEvent = {};
    const emptyGesture: FakeGestureState = {};

    // Verify shouldSetPanResponder
    const callStart = trayPan.onStartShouldSetPanResponder as
      ((e: FakeResponderEvent, g: FakeGestureState) => boolean) | undefined;
    expect(callStart?.(emptyEvent, emptyGesture)).toBe(true);

    const callRelease = trayPan.onPanResponderRelease as
      ((e: FakeResponderEvent, g: FakeGestureState) => void) | undefined;

    // Tap release (< 6px) triggers onTap and addSticker (calling sfx.tap once)
    expect(sfxTapSpy).toHaveBeenCalledTimes(0);
    callRelease?.(fakeEvent, { dx: 2, dy: 2 });
    expect(sfxTapSpy).toHaveBeenCalledTimes(1);

    // Trigger stage layout measurement (bounds: x: 10, y: 20, w: 300, h: 200)
    const stageProps = capturedViewProps['sticker-stage'];
    expect(stageProps).toBeDefined();
    stageProps?.onLayout?.({} as unknown);

    // Drop release inside stage frame bounds triggers addSticker (sfx.tap called again)
    const dropInEvent: FakeResponderEvent = {
      nativeEvent: { pageX: 50, pageY: 50 },
    };
    callRelease?.(dropInEvent, { dx: 20, dy: 20 });
    expect(sfxTapSpy).toHaveBeenCalledTimes(2);

    // Drop release outside stage frame bounds does not add sticker (sfx.tap count unchanged)
    const dropOutEvent: FakeResponderEvent = {
      nativeEvent: { pageX: 500, pageY: 500 },
    };
    callRelease?.(dropOutEvent, { dx: 20, dy: 20 });
    expect(sfxTapSpy).toHaveBeenCalledTimes(2);

    panSpy.mockRestore();
  });

  it('renders a large, playable stage in mobile landscape viewports without collapsing', () => {
    mockDimensions = { width: 844, height: 390 };
    const html = renderToString(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />,
    );

    expect(html).toContain('data-testid="sticker-stage"');
    const stageProps = capturedViewProps['sticker-stage'];
    expect(stageProps).toBeDefined();

    const stylesList = Array.isArray(stageProps?.style) ? stageProps?.style : [stageProps?.style];
    const sizeStyle = stylesList.find(
      (s: unknown) => typeof s === 'object' && s !== null && 'width' in s && 'height' in s,
    ) as { width: number; height: number } | undefined;

    expect(sizeStyle?.width).toBeGreaterThanOrEqual(450);
    expect(sizeStyle?.height).toBeGreaterThanOrEqual(180);
  });

  it('displays accurate gesture hint describing pinch without referencing +/- buttons or wiggle', () => {
    const expectedHints = {
      en: 'Drag to place · pinch to resize & turn · double-tap to pop!',
      ja: 'シールを えへ · ピンチで おおきさ と むき · ダブルタップで けす！',
      cmn: '把贴纸拖进画里 · 双指缩放和旋转 · 双击去掉！',
      yue: '將貼紙拖入畫面 · 雙指縮放同旋轉 · 連撳兩下除走！',
    } as const;

    for (const [lang, hintText] of Object.entries(expectedHints)) {
      const html = renderToString(
        <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang={lang as 'en' | 'ja' | 'cmn' | 'yue'} />,
      );
      expect(html).toContain(hintText.replace('&', '&amp;'));
      expect(html).not.toMatch(/wiggle|\+\/[-−]|うごく|会动|會郁/);
    }
  });

  it('speaks localized voice prompt when scene picker is displayed in non-English languages', () => {
    const spokenUtterances: string[] = [];
    class MockUtterance {
      text: string;
      rate = 1;
      pitch = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    const mockSpeechSynthesis = {
      cancel: vi.fn(),
      speak: vi.fn((u: MockUtterance) => {
        spokenUtterances.push(u.text);
      }),
    };
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
    vi.stubGlobal('speechSynthesis', mockSpeechSynthesis);
    window.speechSynthesis = mockSpeechSynthesis as unknown as SpeechSynthesis;

    const nonEnLangs: Lang[] = ['ja', 'cmn', 'yue'];
    for (const lang of nonEnLangs) {
      spokenUtterances.length = 0;
      const { unmount } = render(
        <StickerGame onHome={noop} onPickScene={noop} onBackToPicker={noop} lang={lang} />,
      );
      expect(spokenUtterances).toContain(t(lang, 'picker.sticker'));
      expect(spokenUtterances).not.toContain("Where's the party?");
      unmount();
    }
  });

  it('stays silent when a scene is already picked', () => {
    const spokenUtterances: string[] = [];
    class MockUtterance {
      text: string;
      rate = 1;
      pitch = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    const mockSpeechSynthesis = {
      cancel: vi.fn(),
      speak: vi.fn((u: MockUtterance) => {
        spokenUtterances.push(u.text);
      }),
    };
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
    vi.stubGlobal('speechSynthesis', mockSpeechSynthesis);
    window.speechSynthesis = mockSpeechSynthesis as unknown as SpeechSynthesis;

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />,
    );
    expect(spokenUtterances).toHaveLength(0);
    unmount();
  });

  it('shows fizzle toast when magic API resolves with ok: false', async () => {
    vi.spyOn(magic, 'resolvePublicImageUrl').mockReturnValue('https://example.com/image.png');
    vi.spyOn(magic, 'publicUrlReachable').mockResolvedValue(true);
    vi.spyOn(magic, 'callMagic').mockResolvedValue({ ok: false });

    const configs: PanResponderCallbacks[] = [];
    const panSpy = vi.spyOn(PanResponder, 'create').mockImplementation((config) => {
      configs.push(config);
      const fakePan: Partial<ReturnType<typeof PanResponder.create>> = {
        panHandlers: {
          onStartShouldSetResponder: () => true,
        } as ReturnType<typeof PanResponder.create>['panHandlers'],
      };
      return fakePan as ReturnType<typeof PanResponder.create>;
    });

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />
    );

    const trayPan = configs.find(c => c.onPanResponderRelease && (c.onPanResponderRelease.toString().includes('onTap()') || c.onPanResponderRelease.toString().includes('onDrop')));
    
    const release = trayPan?.onPanResponderRelease as ((e: FakeResponderEvent, g: FakeGestureState) => void) | undefined;
    if (release) {
      act(() => {
        release({}, { dx: 0, dy: 0 });
      });
    }

    const magicBtn = await screen.findByRole('button', { name: 'ほんものに する' });
    
    await act(async () => {
      fireEvent.click(magicBtn);
    });

    const toastText = await screen.findByText('まほうに しっぱいしちゃった — もういちど！');
    expect(toastText).toBeDefined();

    panSpy.mockRestore();
    unmount();
  });

  it('shows fizzle toast when magic API rejects', async () => {
    vi.spyOn(magic, 'resolvePublicImageUrl').mockReturnValue('https://example.com/image.png');
    vi.spyOn(magic, 'publicUrlReachable').mockResolvedValue(true);
    vi.spyOn(magic, 'callMagic').mockRejectedValue(new Error('network'));

    const configs: PanResponderCallbacks[] = [];
    const panSpy = vi.spyOn(PanResponder, 'create').mockImplementation((config) => {
      configs.push(config);
      const fakePan: Partial<ReturnType<typeof PanResponder.create>> = {
        panHandlers: {
          onStartShouldSetResponder: () => true,
        } as ReturnType<typeof PanResponder.create>['panHandlers'],
      };
      return fakePan as ReturnType<typeof PanResponder.create>;
    });

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />
    );

    const trayPan = configs.find(c => c.onPanResponderRelease && (c.onPanResponderRelease.toString().includes('onTap()') || c.onPanResponderRelease.toString().includes('onDrop')));
    
    const release = trayPan?.onPanResponderRelease as ((e: FakeResponderEvent, g: FakeGestureState) => void) | undefined;
    if (release) {
      act(() => {
        release({}, { dx: 0, dy: 0 });
      });
    }

    const magicBtn = await screen.findByRole('button', { name: 'ほんものに する' });
    
    await act(async () => {
      fireEvent.click(magicBtn);
    });

    const toastText = await screen.findByText('まほうに しっぱいしちゃった — もういちど！');
    expect(toastText).toBeDefined();

    panSpy.mockRestore();
    unmount();
  });

  it('does not show fizzle toast when in-flight magic is cancelled by clear', async () => {
    vi.spyOn(magic, 'resolvePublicImageUrl').mockReturnValue('https://example.com/image.png');
    vi.spyOn(magic, 'publicUrlReachable').mockResolvedValue(true);
    vi.spyOn(magic, 'callMagic').mockImplementation((_args, init) => {
      return new Promise((resolve) => {
        init?.signal?.addEventListener('abort', () => {
          resolve({ ok: false, reason: 'aborted' });
        });
      });
    });

    const configs: PanResponderCallbacks[] = [];
    const panSpy = vi.spyOn(PanResponder, 'create').mockImplementation((config) => {
      configs.push(config);
      const fakePan: Partial<ReturnType<typeof PanResponder.create>> = {
        panHandlers: {
          onStartShouldSetResponder: () => true,
        } as ReturnType<typeof PanResponder.create>['panHandlers'],
      };
      return fakePan as ReturnType<typeof PanResponder.create>;
    });

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />
    );

    const trayPan = configs.find(
      c => c.onPanResponderRelease &&
      (c.onPanResponderRelease.toString().includes('onTap()') || c.onPanResponderRelease.toString().includes('onDrop')),
    );

    const release = trayPan?.onPanResponderRelease as ((e: FakeResponderEvent, g: FakeGestureState) => void) | undefined;
    if (release) {
      act(() => {
        release({}, { dx: 0, dy: 0 });
      });
    }

    const magicBtn = await screen.findByRole('button', { name: 'ほんものに する' });

    await act(async () => {
      fireEvent.click(magicBtn);
    });

    const clearBtn = capturedPressableProps['sticker-clear'];
    await act(async () => {
      clearBtn?.onPress?.();
    });

    expect(screen.queryByTestId('magic-toast')).toBeNull();
    expect(screen.queryByText('まほうに しっぱいしちゃった — もういちど！')).toBeNull();

    panSpy.mockRestore();
    unmount();
  });

  it('does not show fizzle toast when sticker is popped mid-magic', async () => {
    vi.spyOn(magic, 'resolvePublicImageUrl').mockReturnValue('https://example.com/image.png');
    vi.spyOn(magic, 'publicUrlReachable').mockResolvedValue(true);
    vi.spyOn(magic, 'callMagic').mockImplementation((_args, init) => {
      return new Promise((resolve) => {
        init?.signal?.addEventListener('abort', () => {
          resolve({ ok: false, reason: 'aborted' });
        });
      });
    });

    const configs: PanResponderCallbacks[] = [];
    const panSpy = vi.spyOn(PanResponder, 'create').mockImplementation((config) => {
      configs.push(config);
      const fakePan: Partial<ReturnType<typeof PanResponder.create>> = {
        panHandlers: {
          onStartShouldSetResponder: () => true,
        } as ReturnType<typeof PanResponder.create>['panHandlers'],
      };
      return fakePan as ReturnType<typeof PanResponder.create>;
    });

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />
    );

    const trayPan = configs.find(
      c => c.onPanResponderRelease &&
      (c.onPanResponderRelease.toString().includes('onTap()') || c.onPanResponderRelease.toString().includes('onDrop')),
    );

    const release = trayPan?.onPanResponderRelease as ((e: FakeResponderEvent, g: FakeGestureState) => void) | undefined;
    if (release) {
      act(() => {
        release({}, { dx: 0, dy: 0 });
      });
    }

    const magicBtn = await screen.findByRole('button', { name: 'ほんものに する' });

    await act(async () => {
      fireEvent.click(magicBtn);
    });

    const placedPan = configs.find(
      c => c !== trayPan && c.onPanResponderRelease && c.onPanResponderRelease.toString().includes('lastTap'),
    );
    const placedRelease = placedPan?.onPanResponderRelease as ((e: FakeResponderEvent, g: FakeGestureState) => void) | undefined;

    expect(placedRelease).toBeDefined();
    await act(async () => {
      placedRelease!({}, { dx: 0, dy: 0 });
      placedRelease!({}, { dx: 0, dy: 0 });
    });

    expect(screen.queryByTestId('magic-toast')).toBeNull();
    expect(screen.queryByText('まほうに しっぱいしちゃった — もういちど！')).toBeNull();

    panSpy.mockRestore();
    unmount();
  });

  it('clears active toast and timeout when clear is pressed', async () => {
    vi.spyOn(magic, 'resolvePublicImageUrl').mockReturnValue('https://example.com/image.png');
    vi.spyOn(magic, 'publicUrlReachable').mockResolvedValue(true);
    vi.spyOn(magic, 'callMagic').mockResolvedValue({ ok: false });

    const configs: PanResponderCallbacks[] = [];
    const panSpy = vi.spyOn(PanResponder, 'create').mockImplementation((config) => {
      configs.push(config);
      const fakePan: Partial<ReturnType<typeof PanResponder.create>> = {
        panHandlers: {
          onStartShouldSetResponder: () => true,
        } as ReturnType<typeof PanResponder.create>['panHandlers'],
      };
      return fakePan as ReturnType<typeof PanResponder.create>;
    });

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />
    );

    const trayPan = configs.find(
      c => c.onPanResponderRelease &&
      (c.onPanResponderRelease.toString().includes('onTap()') || c.onPanResponderRelease.toString().includes('onDrop')),
    );

    const release = trayPan?.onPanResponderRelease as ((e: FakeResponderEvent, g: FakeGestureState) => void) | undefined;
    expect(release).toBeDefined();
    act(() => {
      release!({}, { dx: 0, dy: 0 });
    });

    const magicBtn = await screen.findByRole('button', { name: 'ほんものに する' });

    await act(async () => {
      fireEvent.click(magicBtn);
    });

    const toastText = await screen.findByText('まほうに しっぱいしちゃった — もういちど！');
    expect(toastText).toBeDefined();

    const toastCallIndex = setTimeoutSpy.mock.calls.findIndex(
      (call) => call[1] === 3000,
    );
    expect(toastCallIndex).toBeGreaterThanOrEqual(0);
    const toastTimerId = setTimeoutSpy.mock.results[toastCallIndex].value;

    const clearBtn = capturedPressableProps['sticker-clear'];
    expect(clearBtn).toBeDefined();
    act(() => {
      clearBtn?.onPress?.();
    });

    expect(screen.queryByTestId('magic-toast')).toBeNull();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(toastTimerId);

    panSpy.mockRestore();
    unmount();
  });

  it('clears active toast timeout on unmount', async () => {
    vi.spyOn(magic, 'resolvePublicImageUrl').mockReturnValue('https://example.com/image.png');
    vi.spyOn(magic, 'publicUrlReachable').mockResolvedValue(true);
    vi.spyOn(magic, 'callMagic').mockResolvedValue({ ok: false });

    const configs: PanResponderCallbacks[] = [];
    const panSpy = vi.spyOn(PanResponder, 'create').mockImplementation((config) => {
      configs.push(config);
      const fakePan: Partial<ReturnType<typeof PanResponder.create>> = {
        panHandlers: {
          onStartShouldSetResponder: () => true,
        } as ReturnType<typeof PanResponder.create>['panHandlers'],
      };
      return fakePan as ReturnType<typeof PanResponder.create>;
    });

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />
    );

    const trayPan = configs.find(
      c => c.onPanResponderRelease &&
      (c.onPanResponderRelease.toString().includes('onTap()') || c.onPanResponderRelease.toString().includes('onDrop')),
    );

    const release = trayPan?.onPanResponderRelease as ((e: FakeResponderEvent, g: FakeGestureState) => void) | undefined;
    expect(release).toBeDefined();
    act(() => {
      release!({}, { dx: 0, dy: 0 });
    });

    const magicBtn = await screen.findByRole('button', { name: 'ほんものに する' });

    await act(async () => {
      fireEvent.click(magicBtn);
    });

    const toastCallIndex = setTimeoutSpy.mock.calls.findIndex(
      (call) => call[1] === 3000,
    );
    expect(toastCallIndex).toBeGreaterThanOrEqual(0);
    const toastTimerId = setTimeoutSpy.mock.results[toastCallIndex].value;

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(toastTimerId);
    panSpy.mockRestore();
  });

  it('handles 90-second timeout by clearing pending state and displaying fizzle toast', async () => {
    vi.spyOn(magic, 'resolvePublicImageUrl').mockReturnValue('https://example.com/image.png');
    vi.spyOn(magic, 'publicUrlReachable').mockResolvedValue(true);
    vi.spyOn(magic, 'callMagic').mockImplementation((_args, init) => {
      return new Promise((resolve) => {
        init?.signal?.addEventListener('abort', () => {
          resolve({ ok: false, reason: 'aborted' });
        });
      });
    });

    const configs: PanResponderCallbacks[] = [];
    const panSpy = vi.spyOn(PanResponder, 'create').mockImplementation((config) => {
      configs.push(config);
      const fakePan: Partial<ReturnType<typeof PanResponder.create>> = {
        panHandlers: {
          onStartShouldSetResponder: () => true,
        } as ReturnType<typeof PanResponder.create>['panHandlers'],
      };
      return fakePan as ReturnType<typeof PanResponder.create>;
    });

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />
    );

    const trayPan = configs.find(
      c => c.onPanResponderRelease &&
      (c.onPanResponderRelease.toString().includes('onTap()') || c.onPanResponderRelease.toString().includes('onDrop')),
    );

    const release = trayPan?.onPanResponderRelease as ((e: FakeResponderEvent, g: FakeGestureState) => void) | undefined;
    if (release) {
      act(() => {
        release({}, { dx: 0, dy: 0 });
      });
    }

    const magicBtn = await screen.findByRole('button', { name: 'ほんものに する' });

    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(magicBtn);
    });

    expect(screen.queryByTestId('magic-pending-1')).not.toBeNull();

    // Advance past the 90-second timeout
    await act(async () => {
      vi.advanceTimersByTime(90_000);
    });

    // Verify pending state was cleared and fizzle toast is displayed
    expect(screen.queryByTestId('magic-pending-1')).toBeNull();
    expect(screen.queryByText('まほうに しっぱいしちゃった — もういちど！')).not.toBeNull();

    panSpy.mockRestore();
    unmount();
    vi.useRealTimers();
  });
});
