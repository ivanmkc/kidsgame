// @vitest-environment happy-dom
import React from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as magic from '../magic';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../../i18n';
import { Lang } from '../../../lang';
import * as sound from '../../../sound';
const { sfx } = sound;
import { LangContext } from '../../../components/GameShell';
import { allSceneOptions } from '../../sceneOptions';
import { StickerGame } from '../StickerGame';
import { CHARACTER_ICONS } from '../../../assets/images';

vi.mock('../../../assets/images', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { manifest } = await import('../../../manifest');
  const charSet = new Set(manifest.characters ?? []);
  const charProxy = new Proxy(
    {},
    {
      get: (_t, prop) =>
        typeof prop === 'string' && charSet.has(prop)
          ? { uri: `character_${prop}.png` }
          : undefined,
    },
  );
  return {
    ...actual,
    CHARACTER_ICONS: charProxy,
  };
});

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

vi.mock('../../../components/GameShell', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../components/GameShell')>();
  return {
    ...actual,
    GameShell: (props: Parameters<typeof actual.GameShell>[0]) => {
      capturedGameShellProps = props;
      const langCtx = React.useContext(actual.LangContext);
      return (
        <div data-testid="mock-game-shell">
          <div>{props.title}</div>
          <div>{props.subtitle}</div>
          {langCtx ? (
            <button data-testid="lang-cycle" onClick={langCtx.onCycle}>
              🌐
            </button>
          ) : null}
          {props.right}
          {props.children}
        </div>
      );
    },
  };
});

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

  it('passes localized backdrop options to ScenePicker across non-English languages', () => {
    const nonEnLangs: Lang[] = ['ja', 'cmn', 'yue'];
    for (const lang of nonEnLangs) {
      renderToString(
        <StickerGame onHome={noop} onPickScene={noop} onBackToPicker={noop} lang={lang} />,
      );
      expect(capturedPickerProps).not.toBeNull();
      expect(capturedPickerProps?.lang).toBe(lang);
      const expectedOptions = allSceneOptions('all', lang);
      expect(capturedPickerProps?.options).toEqual(expectedOptions);

      const options = capturedPickerProps?.options as { id: string; name: string }[];
      const farmOption = options?.find((o) => o.id === 'd-farm');
      expect(farmOption).toBeDefined();
      if (lang === 'ja') {
        expect(farmOption?.name).toBe('ぼくじょう');
      } else if (lang === 'cmn') {
        expect(farmOption?.name).toBe('农场');
      } else if (lang === 'yue') {
        expect(farmOption?.name).toBe('農場');
      }
    }
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
    expect(html).toContain('data-testid="sticker-tab-characters"');
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
    const tabs = ['dressup', 'characters', 'animals', 'nature', 'food', 'things'];
    for (const tabId of tabs) {
      const tabBtn = capturedPressableProps[`sticker-tab-${tabId}`];
      expect(tabBtn).toBeDefined();
      expect(tabBtn?.accessibilityRole).toBe('button');
      expect(tabBtn?.hitSlop).toEqual({ top: 12, bottom: 12, left: 12, right: 12 });
      expect(tabBtn?.style).toContainEqual(expect.objectContaining({ minHeight: 44 }));
      tabBtn?.onPress?.();
    }
    expect(sfxTapSpy).toHaveBeenCalledTimes(6);
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

  it('interpolates localized scene name into header subtitle across languages', () => {
    const cases: { lang: Lang; expectedSubtitle: string }[] = [
      { lang: 'ja', expectedSubtitle: 'ぼくじょう — きみの すきに かざろう！' },
      { lang: 'cmn', expectedSubtitle: '农场 — 随你怎么装饰！' },
      { lang: 'yue', expectedSubtitle: '農場 — 隨你點樣裝飾！' },
    ];
    for (const { lang, expectedSubtitle } of cases) {
      renderToString(
        <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang={lang} />,
      );
      expect(capturedGameShellProps?.subtitle).toBe(expectedSubtitle);
    }
  });

  it('handles tray item interactions including tap and drag/drop', async () => {
    const sfxTapSpy = vi.spyOn(sfx, 'tap').mockReturnValue();

    const { container, unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );

    const trayItem = screen.getAllByRole('button').find(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    expect(trayItem).toBeDefined();

    // Trigger stage layout measurement (bounds: x: 10, y: 20, w: 300, h: 200)
    const stageProps = capturedViewProps['sticker-stage'];
    expect(stageProps).toBeDefined();
    stageProps?.onLayout?.({} as unknown);

    expect(container.querySelector('[style*="z-index: 50"]')).toBeNull();

    const dispatchTouch = (type: 'start' | 'move' | 'end', x: number, y: number) => {
      const touch = { pageX: x, pageY: y, clientX: x, clientY: y, identifier: 0, target: trayItem! };
      if (type === 'start') {
        fireEvent.touchStart(trayItem!, { touches: [touch], changedTouches: [touch] });
      } else if (type === 'move') {
        fireEvent.touchMove(trayItem!, { touches: [touch], changedTouches: [touch] });
      } else {
        fireEvent.touchEnd(trayItem!, { touches: [], changedTouches: [touch] });
      }
    };

    // 1. Tap: clicking tray item adds sticker to stage
    expect(sfxTapSpy).toHaveBeenCalledTimes(0);
    act(() => {
      fireEvent.click(trayItem!);
    });
    expect(sfxTapSpy).toHaveBeenCalledTimes(1);

    // 2. Immediate vertical swipes (down or up without holding) do not claim responder, allowing drawer scroll
    act(() => {
      dispatchTouch('start', 100, 100);
      dispatchTouch('move', 100, 150);
    });
    expect(container.querySelector('[style*="z-index: 50"]')).toBeNull();
    act(() => {
      dispatchTouch('end', 100, 150);
    });

    act(() => {
      dispatchTouch('start', 100, 100);
      dispatchTouch('move', 100, 50);
    });
    expect(container.querySelector('[style*="z-index: 50"]')).toBeNull();
    act(() => {
      dispatchTouch('end', 100, 50);
    });

    // Vertical swipe with ~20px horizontal drift (e.g. thumb arc) does not claim responder
    act(() => {
      dispatchTouch('start', 100, 100);
      dispatchTouch('move', 120, 180);
    });
    expect(container.querySelector('[style*="z-index: 50"]')).toBeNull();
    act(() => {
      dispatchTouch('end', 120, 180);
    });

    // Touch movement > 8px (scroll swipe) before 200ms disarms long-press and cancels arming
    act(() => {
      dispatchTouch('start', 100, 100);
      dispatchTouch('move', 100, 130);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 210));
    });
    expect(trayItem?.parentElement?.getAttribute('style') ?? '').not.toContain('scale(1.1)');
    act(() => {
      dispatchTouch('end', 100, 130);
    });
    expect(sfxTapSpy).toHaveBeenCalledTimes(1);

    // 3. Upward drag with long-press: arms visual lift, claims responder and spawns ghost
    await act(async () => {
      dispatchTouch('start', 500, 500);
      await new Promise((r) => setTimeout(r, 210));
    });
    expect(trayItem?.parentElement?.getAttribute('style')).toContain('scale(1.1)');
    act(() => {
      dispatchTouch('move', 500, 450);
    });
    expect(container.querySelector('[style*="z-index: 50"]')).not.toBeNull();
    act(() => {
      dispatchTouch('end', 500, 450);
    });
    expect(container.querySelector('[style*="z-index: 50"]')).toBeNull();
    expect(trayItem?.parentElement?.getAttribute('style') ?? '').not.toContain('scale(1.1)');
    expect(sfxTapSpy).toHaveBeenCalledTimes(1);

    // 4. Horizontal drag: claims responder immediately and spawns ghost
    act(() => {
      dispatchTouch('start', 100, 100);
      dispatchTouch('move', 130, 100);
    });
    expect(container.querySelector('[style*="z-index: 50"]')).not.toBeNull();

    // 5. Drop outside stage frame does not add sticker, clears ghost
    act(() => {
      dispatchTouch('move', 500, 500);
      dispatchTouch('end', 500, 500);
    });
    expect(sfxTapSpy).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[style*="z-index: 50"]')).toBeNull();

    // Horizontal drag then click must not call sfx.tap again
    act(() => {
      fireEvent.click(trayItem!);
    });
    expect(sfxTapSpy).toHaveBeenCalledTimes(1);

    // 6. Long-press then drag into stage bounds: survives tray scroll and drops sticker
    await act(async () => {
      dispatchTouch('start', 100, 100);
      await new Promise((r) => setTimeout(r, 210));
      dispatchTouch('move', 50, 50);
    });
    expect(container.querySelector('[style*="z-index: 50"]')).not.toBeNull();

    // Scroll event on the tray must not terminate responder while dragging
    const trayScroll = screen.getByTestId('sticker-tray-scroll');
    act(() => {
      fireEvent.scroll(trayScroll, { target: { scrollTop: 50 } });
    });
    expect(container.querySelector('[style*="z-index: 50"]')).not.toBeNull();

    act(() => {
      dispatchTouch('end', 50, 50);
    });
    expect(sfxTapSpy).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[style*="z-index: 50"]')).toBeNull();
    expect(trayItem?.parentElement?.getAttribute('style') ?? '').not.toContain('scale(1.1)');

    // 7. Long-press and release without moving adds sticker via onPressOut
    await act(async () => {
      dispatchTouch('start', 100, 100);
      await new Promise((r) => setTimeout(r, 210));
    });
    expect(trayItem?.parentElement?.getAttribute('style')).toContain('scale(1.1)');
    act(() => {
      dispatchTouch('end', 100, 100);
    });
    expect(trayItem?.parentElement?.getAttribute('style') ?? '').not.toContain('scale(1.1)');
    expect(sfxTapSpy).toHaveBeenCalledTimes(3);

    // 8. Subsequent quick tap works on first try
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
      dispatchTouch('start', 100, 100);
      dispatchTouch('end', 100, 100);
      fireEvent.click(trayItem!);
    });
    expect(sfxTapSpy).toHaveBeenCalledTimes(4);

    unmount();
  });

  it('removes placed sticker when delete button is pressed', async () => {
    const sfxFlipSpy = vi.spyOn(sfx, 'flip').mockReturnValue();
    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );

    const trayItem = screen.getAllByRole('button').find(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    expect(trayItem).toBeDefined();

    act(() => {
      fireEvent.click(trayItem!);
    });

    let deleteBtns = screen.queryAllByTestId(/sticker-delete-/);
    expect(deleteBtns.length).toBe(1);

    act(() => {
      fireEvent.click(deleteBtns[0]);
    });

    expect(sfxFlipSpy).toHaveBeenCalledTimes(1);
    deleteBtns = screen.queryAllByTestId(/sticker-delete-/);
    expect(deleteBtns.length).toBe(0);

    unmount();
  });

  it('drops sticker onto the stage with y-offset scaled by aspect ratio', async () => {
    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );

    const trayItem = screen.getAllByRole('button').find(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    expect(trayItem).toBeDefined();

    const stageProps = capturedViewProps['sticker-stage'];
    expect(stageProps).toBeDefined();
    // f.x = 10, f.y = 20, f.w = 300, f.h = 200
    stageProps?.onLayout?.({} as unknown);

    const dispatchTouch = (type: 'start' | 'move' | 'end', x: number, y: number) => {
      const touch = { pageX: x, pageY: y, clientX: x, clientY: y, identifier: 0, target: trayItem! };
      if (type === 'start') {
        fireEvent.touchStart(trayItem!, { touches: [touch], changedTouches: [touch] });
      } else if (type === 'move') {
        fireEvent.touchMove(trayItem!, { touches: [touch], changedTouches: [touch] });
      } else {
        fireEvent.touchEnd(trayItem!, { touches: [], changedTouches: [touch] });
      }
    };

    await act(async () => {
      dispatchTouch('start', 100, 100);
      await new Promise((r) => setTimeout(r, 210));
      dispatchTouch('move', 50, 50); // drop at px = 50, py = 50
    });
    act(() => {
      dispatchTouch('end', 50, 50);
    });

    // Calculations for stage frame f.x=10, f.y=20, f.w=300, f.h=200
    // Drop at px=50, py=50
    // y = (50 - 20) / 200 - 0.045 * (300 / 200) = 30 / 200 - 0.045 * 1.5 = 0.15 - 0.0675 = 0.0825
    const stickers = screen.getAllByTestId(/sticker-placed-/);
    expect(stickers.length).toBeGreaterThan(0);
    const style = stickers[0].getAttribute('style') || '';
    
    const topMatch = /top:\s*([\d.]+)px/.exec(style);
    expect(topMatch).not.toBeNull();
    const top = parseFloat(topMatch![1]);
    
    const stage = screen.getByTestId('sticker-stage');
    const stageStyle = stage.getAttribute('style') || '';
    const stageHMatch = /height:\s*([\d.]+)px/.exec(stageStyle);
    const stageH = parseFloat(stageHMatch![1]);
    
    expect(Math.abs(top / stageH - 0.0825)).toBeLessThan(0.001);

    unmount();
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

  it('speaks localized welcoming instruction when a scene is entered across languages', () => {
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

    const langs: Lang[] = ['en', 'ja', 'cmn', 'yue'];
    for (const lang of langs) {
      spokenUtterances.length = 0;
      const { unmount } = render(
        <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang={lang} />,
      );
      expect(spokenUtterances).toContain(t(lang, 'card.sticker.blurb'));
      expect(spokenUtterances).not.toContain(t(lang, 'picker.sticker'));
      unmount();
    }
  });

  it('shows fizzle toast when magic API resolves with ok: false', async () => {
    vi.spyOn(magic, 'resolvePublicImageUrl').mockReturnValue('https://example.com/image.png');
    vi.spyOn(magic, 'publicUrlReachable').mockResolvedValue(true);
    vi.spyOn(magic, 'callMagic').mockResolvedValue({ ok: false });

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />
    );

    const trayBtn = screen.getAllByRole('button').find(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    if (trayBtn) {
      act(() => {
        fireEvent.click(trayBtn);
      });
    }

    const magicBtn = await screen.findByRole('button', { name: 'ほんものに する' });
    
    await act(async () => {
      fireEvent.click(magicBtn);
    });

    const toastText = await screen.findByText('まほうに しっぱいしちゃった — もういちど！');
    expect(toastText).toBeDefined();

    unmount();
  });

  it('shows fizzle toast when magic API rejects', async () => {
    vi.spyOn(magic, 'resolvePublicImageUrl').mockReturnValue('https://example.com/image.png');
    vi.spyOn(magic, 'publicUrlReachable').mockResolvedValue(true);
    vi.spyOn(magic, 'callMagic').mockRejectedValue(new Error('network'));

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />
    );

    const trayBtn = screen.getAllByRole('button').find(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    if (trayBtn) {
      act(() => {
        fireEvent.click(trayBtn);
      });
    }

    const magicBtn = await screen.findByRole('button', { name: 'ほんものに する' });
    
    await act(async () => {
      fireEvent.click(magicBtn);
    });

    const toastText = await screen.findByText('まほうに しっぱいしちゃった — もういちど！');
    expect(toastText).toBeDefined();

    unmount();
  });

  it('adds sticker to stage when tray item is tapped in the DOM', () => {
    const sfxTapSpy = vi.spyOn(sfx, 'tap').mockReturnValue();
    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );

    const trayButtons = screen.getAllByRole('button');
    const trayItem = trayButtons.find((btn) => btn.getAttribute('aria-label')?.includes('Add'));
    expect(trayItem).toBeDefined();

    if (trayItem) {
      act(() => {
        fireEvent.click(trayItem);
      });
      expect(sfxTapSpy).toHaveBeenCalled();
    }
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

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />
    );

    const trayBtn = screen.getAllByRole('button').find(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    if (trayBtn) {
      act(() => {
        fireEvent.click(trayBtn);
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

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />
    );

    const trayBtn = screen.getAllByRole('button').find(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    if (trayBtn) {
      act(() => {
        fireEvent.click(trayBtn);
      });
    }

    const magicBtn = await screen.findByRole('button', { name: 'ほんものに する' });

    await act(async () => {
      fireEvent.click(magicBtn);
    });

    const deleteBtn = screen.queryAllByTestId(/sticker-delete-/)[0];
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(screen.queryByTestId('magic-toast')).toBeNull();
    expect(screen.queryByText('まほうに しっぱいしちゃった — もういちど！')).toBeNull();

    unmount();
  });

  it('clears active toast and timeout when clear is pressed', async () => {
    vi.spyOn(magic, 'resolvePublicImageUrl').mockReturnValue('https://example.com/image.png');
    vi.spyOn(magic, 'publicUrlReachable').mockResolvedValue(true);
    vi.spyOn(magic, 'callMagic').mockResolvedValue({ ok: false });

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />
    );

    const trayBtn = screen.getAllByRole('button').find(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    if (trayBtn) {
      act(() => {
        fireEvent.click(trayBtn);
      });
    }

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

    unmount();
  });

  it('clears active toast timeout on unmount', async () => {
    vi.spyOn(magic, 'resolvePublicImageUrl').mockReturnValue('https://example.com/image.png');
    vi.spyOn(magic, 'publicUrlReachable').mockResolvedValue(true);
    vi.spyOn(magic, 'callMagic').mockResolvedValue({ ok: false });

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />
    );

    const trayBtn = screen.getAllByRole('button').find(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    if (trayBtn) {
      act(() => {
        fireEvent.click(trayBtn);
      });
    }

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

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="ja" />
    );

    const trayBtn = screen.getAllByRole('button').find(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    if (trayBtn) {
      act(() => {
        fireEvent.click(trayBtn);
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

    unmount();
    vi.useRealTimers();
  });

  it('disables magic button for other stickers once one is magicked', async () => {
    vi.spyOn(magic, 'resolvePublicImageUrl').mockReturnValue('https://example.com/image.png');
    vi.spyOn(magic, 'publicUrlReachable').mockResolvedValue(true);
    vi.spyOn(magic, 'callMagic').mockImplementation(async (args) => ({
      ok: true,
      image_b64: `b64_${args.item}`,
    }));

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );

    const trayBtns = screen.getAllByRole('button').filter(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));

    // Place first sticker
    act(() => {
      fireEvent.click(trayBtns[0]);
    });

    expect(screen.getByTestId('sticker-placed-1')).not.toBeNull();
    const magicBtn1 = await screen.findByTestId('magic-btn-1');

    // Apply magic to first sticker
    await act(async () => {
      fireEvent.click(magicBtn1);
    });

    // First sticker is now baked into backdrop, visually hidden from draggable overlays
    expect(screen.getByTestId('magic-backdrop')).not.toBeNull();
    expect(screen.queryByTestId('sticker-placed-1')).toBeNull();

    // Place second sticker
    act(() => {
      fireEvent.click(trayBtns[1]);
    });

    expect(screen.getByTestId('sticker-placed-2')).not.toBeNull();
    expect(screen.queryByTestId('sticker-placed-1')).toBeNull();

    const magicBtn2 = await screen.findByTestId('magic-btn-2');

    // Magic button on second sticker is disabled because one sticker is already baked
    expect(capturedPressableProps['magic-btn-2']?.disabled).toBe(true);
    expect(magicBtn2.getAttribute('aria-disabled')).toBe('true');

    // Attempting to tap the disabled magic button does not trigger magic or un-bake the first sticker
    await act(async () => {
      fireEvent.click(magicBtn2);
    });

    expect(magic.callMagic).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('magic-backdrop')).not.toBeNull();
    expect(screen.queryByTestId('sticker-placed-1')).toBeNull();
    expect(screen.getByTestId('sticker-placed-2')).not.toBeNull();

    unmount();
  });

  it('sets localized accessibilityLabel on TrayItem across languages without underscores', () => {
    const cases: { lang: Lang; expectedDress: string; expectedHelmet: string; expectedLadybug: string }[] = [
      {
        lang: 'en',
        expectedDress: 'Add pink dress sticker',
        expectedHelmet: 'Add fire helmet sticker',
        expectedLadybug: 'Add ladybug sticker',
      },
      {
        lang: 'ja',
        expectedDress: 'ピンクのドレスの シールを はる',
        expectedHelmet: 'しょうぼうしのヘルメットの シールを はる',
        expectedLadybug: 'てんとうむしの シールを はる',
      },
      {
        lang: 'cmn',
        expectedDress: '添加粉色连衣裙贴纸',
        expectedHelmet: '添加消防头盔贴纸',
        expectedLadybug: '添加瓢虫贴纸',
      },
      {
        lang: 'yue',
        expectedDress: '加粉紅色連身裙貼紙',
        expectedHelmet: '加消防頭盔貼紙',
        expectedLadybug: '加甲蟲貼紙',
      },
    ];

    for (const c of cases) {
      const { unmount } = render(
        <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang={c.lang} />,
      );

      const dressPink = screen.getByTestId('sticker-tray-dress_pink');
      const fireHelmet = screen.getByTestId('sticker-tray-fire_helmet');
      expect(dressPink.getAttribute('aria-label')).toBe(c.expectedDress);
      expect(fireHelmet.getAttribute('aria-label')).toBe(c.expectedHelmet);
      expect(dressPink.getAttribute('aria-label')).not.toContain('_');
      expect(fireHelmet.getAttribute('aria-label')).not.toContain('_');

      fireEvent.click(screen.getByTestId('sticker-tab-animals'));
      const ladybug = screen.getByTestId('sticker-tray-ladybug');
      expect(ladybug.getAttribute('aria-label')).toBe(c.expectedLadybug);
      expect(ladybug.getAttribute('aria-label')).not.toContain('_');

      unmount();
    }
  });

  it('renders placed canvas stickers with accessible={true}, accessibilityRole="image", and localized accessibilityLabel', () => {
    const cases: { lang: Lang; expectedDress: string; expectedLadybug: string }[] = [
      {
        lang: 'en',
        expectedDress: 'pink dress',
        expectedLadybug: 'ladybug',
      },
      {
        lang: 'ja',
        expectedDress: 'ピンクのドレス',
        expectedLadybug: 'てんとうむし',
      },
      {
        lang: 'cmn',
        expectedDress: '粉色连衣裙',
        expectedLadybug: '瓢虫',
      },
      {
        lang: 'yue',
        expectedDress: '粉紅色連身裙',
        expectedLadybug: '甲蟲',
      },
    ];

    for (const c of cases) {
      const { unmount } = render(
        <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang={c.lang} />,
      );

      const dressPink = screen.getByTestId('sticker-tray-dress_pink');
      act(() => {
        fireEvent.click(dressPink);
      });

      const placedDress = screen.getByTestId('sticker-placed-1');
      expect(placedDress.getAttribute('role')).toBe('img');
      expect(placedDress.getAttribute('aria-label')).toBe(c.expectedDress);
      expect(placedDress.getAttribute('aria-label')).not.toContain('_');

      fireEvent.click(screen.getByTestId('sticker-tab-animals'));
      const ladybug = screen.getByTestId('sticker-tray-ladybug');
      act(() => {
        fireEvent.click(ladybug);
      });

      const placedLadybug = screen.getByTestId('sticker-placed-2');
      expect(placedLadybug.getAttribute('role')).toBe('img');
      expect(placedLadybug.getAttribute('aria-label')).toBe(c.expectedLadybug);
      expect(placedLadybug.getAttribute('aria-label')).not.toContain('_');

      unmount();
    }
  });

  it('resets magic state when sceneId changes', async () => {
    vi.spyOn(magic, 'resolvePublicImageUrl').mockReturnValue('https://example.com/image.png');
    vi.spyOn(magic, 'publicUrlReachable').mockResolvedValue(true);
    vi.spyOn(magic, 'callMagic').mockReturnValue(new Promise(() => {}));

    const { rerender, unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );
    const trayBtn = screen.getAllByRole('button').find(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    if (trayBtn) {
      act(() => { fireEvent.click(trayBtn); });
    }
    const magicBtn = await screen.findByTestId('magic-btn-1');
    await act(async () => {
      fireEvent.click(magicBtn);
    });
    expect(screen.queryByTestId('magic-pending-1')).not.toBeNull();

    rerender(
      <StickerGame sceneId="d-space" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );
    expect(screen.queryByTestId('magic-pending-1')).toBeNull();
    unmount();
  });

  it('does not overwrite magicReachable with false when aborted previous scene check resolves', async () => {
    let urlIndex = 0;
    vi.spyOn(magic, 'resolvePublicImageUrl').mockImplementation(() => `https://example.com/image-${++urlIndex}.png`);
    let scene1AbortResolver: ((v: boolean) => void) | undefined;
    const scene1Promise = new Promise<boolean>((resolve) => {
      scene1AbortResolver = resolve;
    });

    let callCount = 0;
    vi.spyOn(magic, 'publicUrlReachable').mockImplementation((_url, signal) => {
      callCount++;
      if (callCount === 1) {
        signal?.addEventListener('abort', () => {
          queueMicrotask(() => scene1AbortResolver?.(false));
        });
        return scene1Promise;
      }
      return Promise.resolve(true);
    });

    const { rerender, unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );

    rerender(
      <StickerGame sceneId="d-beach" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );

    await act(async () => {
      await Promise.resolve();
    });

    const trayBtn = screen.getAllByRole('button').find(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    if (trayBtn) {
      act(() => { fireEvent.click(trayBtn); });
    }

    const magicBtn = await screen.findByTestId('magic-btn-1');
    expect(magicBtn).toBeDefined();
    unmount();
  });

  it('cleans up timers and abort controllers on unmount', async () => {
    vi.spyOn(magic, 'resolvePublicImageUrl').mockReturnValue('https://example.com/image.png');
    vi.spyOn(magic, 'publicUrlReachable').mockResolvedValue(true);
    let aborted = false;
    vi.spyOn(magic, 'callMagic').mockImplementation((_args, init) => {
      init?.signal?.addEventListener('abort', () => {
        aborted = true;
      });
      return new Promise(() => {});
    });

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );
    const trayBtn = screen.getAllByRole('button').find(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    if (trayBtn) {
      act(() => { fireEvent.click(trayBtn); });
    }
    const magicBtn = await screen.findByTestId('magic-btn-1');
    await act(async () => {
      fireEvent.click(magicBtn);
    });

    expect(aborted).toBe(false);
    unmount();
    expect(aborted).toBe(true);
  });

  it('moves placed sticker via drag release', () => {
    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );
    const trayBtn = screen.getAllByRole('button').find(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    if (trayBtn) {
      act(() => { fireEvent.click(trayBtn); });
    }

    const placed = screen.getByTestId('sticker-placed-1');
    expect(placed).toBeDefined();

    const initialLeft = placed.style.left;
    const initialTop = placed.style.top;

    const touch = { pageX: 50, pageY: 50, clientX: 50, clientY: 50, identifier: 0, target: placed };
    act(() => {
      fireEvent.touchStart(placed, { touches: [touch], changedTouches: [touch] });
      fireEvent.touchMove(placed, { touches: [{ ...touch, pageX: 150, pageY: 150 }], changedTouches: [{ ...touch, pageX: 150, pageY: 150 }] });
      fireEvent.touchEnd(placed, { touches: [], changedTouches: [{ ...touch, pageX: 150, pageY: 150 }] });
    });

    const newLeft = placed.style.left;
    const newTop = placed.style.top;
    expect(newLeft !== initialLeft || newTop !== initialTop).toBe(true);

    unmount();
  });

  it('constrains sticker dragging bounds to keep it and its UI fully inside the stage', () => {
    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );
    const trayBtn = screen.getAllByRole('button').find(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    if (trayBtn) {
      act(() => { fireEvent.click(trayBtn); });
    }

    const placed = screen.getByTestId('sticker-placed-1');
    expect(placed).toBeDefined();

    const touch = { pageX: 50, pageY: 50, clientX: 50, clientY: 50, identifier: 0, target: placed };
    act(() => {
      fireEvent.touchStart(placed, { touches: [touch], changedTouches: [touch] });
      fireEvent.touchMove(placed, { touches: [{ ...touch, pageX: 9999, pageY: -9999 }], changedTouches: [{ ...touch, pageX: 9999, pageY: -9999 }] });
      fireEvent.touchEnd(placed, { touches: [], changedTouches: [{ ...touch, pageX: 9999, pageY: -9999 }] });
    });

    const newLeft = parseFloat(placed.style.left);
    const newTop = parseFloat(placed.style.top);

    expect(newTop).toBeCloseTo(14, 1);
    expect(newLeft).toBeLessThan(2000);
    expect(newLeft).toBeGreaterThan(0);

    unmount();
  });

  it('commits drag progress when interrupted by a pinch gesture', () => {
    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );
    const trayBtn = screen.getAllByRole('button').find(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    if (trayBtn) {
      act(() => { fireEvent.click(trayBtn); });
    }

    const placed = screen.getByTestId('sticker-placed-1');
    expect(placed).toBeDefined();

    const initialLeft = placed.style.left;
    const initialTop = placed.style.top;

    const t1 = { pageX: 50, pageY: 50, clientX: 50, clientY: 50, identifier: 0, target: placed };
    const t2 = { pageX: 100, pageY: 100, clientX: 100, clientY: 100, identifier: 1, target: placed };

    act(() => {
      // Start drag with one finger
      fireEvent.touchStart(placed, { touches: [t1], changedTouches: [t1] });
      // Move 100px
      fireEvent.touchMove(placed, {
        touches: [{ ...t1, pageX: 150, pageY: 150 }],
        changedTouches: [{ ...t1, pageX: 150, pageY: 150 }]
      });
      // Add second finger (pinch start)
      fireEvent.touchStart(placed, {
        touches: [{ ...t1, pageX: 150, pageY: 150 }, t2],
        changedTouches: [t2]
      });
      fireEvent.touchMove(placed, {
        touches: [{ ...t1, pageX: 150, pageY: 150 }, t2],
        changedTouches: [t2]
      });
      // Release fingers
      fireEvent.touchEnd(placed, { touches: [], changedTouches: [{ ...t1, pageX: 150, pageY: 150 }, t2] });
    });

    const newLeft = placed.style.left;
    const newTop = placed.style.top;
    expect(newLeft !== initialLeft || newTop !== initialTop).toBe(true);

    unmount();
  });

  it('transforms placed sticker via two-touch pinch/rotate gesture', () => {
    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );
    const trayBtn = screen.getAllByRole('button').find(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    if (trayBtn) {
      act(() => { fireEvent.click(trayBtn); });
    }

    const placed = screen.getByTestId('sticker-placed-1');
    expect(placed).toBeDefined();

    const initialStyle = placed.getAttribute('style');

    const t1 = { pageX: 10, pageY: 10, clientX: 10, clientY: 10, identifier: 0, target: placed };
    const t2 = { pageX: 100, pageY: 100, clientX: 100, clientY: 100, identifier: 1, target: placed };

    act(() => {
      fireEvent.touchStart(placed, { touches: [t1, t2], changedTouches: [t1, t2] });
      fireEvent.touchMove(placed, {
        touches: [
          { ...t1, pageX: 10, pageY: 10 },
          { ...t2, pageX: 100, pageY: 100 },
        ],
        changedTouches: [
          { ...t1, pageX: 10, pageY: 10 },
          { ...t2, pageX: 100, pageY: 100 },
        ],
      });
      fireEvent.touchMove(placed, {
        touches: [
          { ...t1, pageX: 2, pageY: 2 },
          { ...t2, pageX: 150, pageY: 150 },
        ],
        changedTouches: [
          { ...t1, pageX: 2, pageY: 2 },
          { ...t2, pageX: 150, pageY: 150 },
        ],
      });
      fireEvent.touchEnd(placed, { touches: [], changedTouches: [t1, t2] });
    });

    const newStyle = placed.getAttribute('style');
    expect(newStyle).not.toBe(initialStyle);

    unmount();
  });

  it('does not jump when one finger is lifted during pinch gesture', () => {
    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );
    const trayBtn = screen.getAllByRole('button').find(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    if (trayBtn) {
      act(() => { fireEvent.click(trayBtn); });
    }

    const placed = screen.getByTestId('sticker-placed-1');
    expect(placed).toBeDefined();

    const t1 = { pageX: 10, pageY: 10, clientX: 10, clientY: 10, identifier: 0, target: placed };
    const t2 = { pageX: 100, pageY: 100, clientX: 100, clientY: 100, identifier: 1, target: placed };

    act(() => {
      fireEvent.touchStart(placed, { touches: [t1, t2], changedTouches: [t1, t2] });
      fireEvent.touchMove(placed, {
        touches: [
          { ...t1, pageX: 10, pageY: 10 },
          { ...t2, pageX: 100, pageY: 100 },
        ],
        changedTouches: [
          { ...t1, pageX: 10, pageY: 10 },
          { ...t2, pageX: 100, pageY: 100 },
        ],
      });
      fireEvent.touchMove(placed, {
        touches: [
          { ...t1, pageX: 2, pageY: 2 },
          { ...t2, pageX: 150, pageY: 150 },
        ],
        changedTouches: [
          { ...t1, pageX: 2, pageY: 2 },
          { ...t2, pageX: 150, pageY: 150 },
        ],
      });
      // Lift t2 (finger 2 lifted, finger 1 still on screen)
      fireEvent.touchEnd(placed, {
        touches: [t1],
        changedTouches: [t2],
      });
      // Move remaining finger
      fireEvent.touchMove(placed, {
        touches: [
          { ...t1, pageX: 300, pageY: 300 },
        ],
        changedTouches: [
          { ...t1, pageX: 300, pageY: 300 },
        ],
      });
    });

    expect(placed.style.transform).toContain('translateX(0px) translateY(0px)');

    act(() => {
      fireEvent.touchEnd(placed, {
        touches: [],
        changedTouches: [{ ...t1, pageX: 300, pageY: 300 }],
      });
    });

    expect(screen.getByTestId('sticker-placed-1')).toBeDefined();
    expect(placed.style.transform).toContain('translateX(0px) translateY(0px)');

    unmount();
  });

  it('uses cache and plays win sound on duplicate magic location', async () => {
    const sfxWinSpy = vi.spyOn(sfx, 'win').mockReturnValue();
    vi.spyOn(magic, 'resolvePublicImageUrl').mockReturnValue('https://example.com/image.png');
    vi.spyOn(magic, 'publicUrlReachable').mockResolvedValue(true);
    const callMagicSpy = vi.spyOn(magic, 'callMagic').mockResolvedValue({
      ok: true,
      image_b64: 'b64_data',
    });
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );

    const trayBtns = screen.getAllByRole('button').filter(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    act(() => {
      fireEvent.click(trayBtns[0]);
    });
    const magicBtn1 = await screen.findByTestId('magic-btn-1');
    await act(async () => {
      fireEvent.click(magicBtn1);
    });
    expect(callMagicSpy).toHaveBeenCalledTimes(1);
    expect(sfxWinSpy).toHaveBeenCalled();

    act(() => {
      fireEvent.click(trayBtns[0]);
    });
    const magicBtn2 = await screen.findByTestId('magic-btn-2');
    await act(async () => {
      fireEvent.click(magicBtn2);
    });
    expect(callMagicSpy).toHaveBeenCalledTimes(1);

    randomSpy.mockRestore();
    unmount();
  });

  it('sends vertically aspect-ratio-corrected cy coordinate to AI model', async () => {
    vi.spyOn(magic, 'resolvePublicImageUrl').mockReturnValue('https://example.com/image.png');
    vi.spyOn(magic, 'publicUrlReachable').mockResolvedValue(true);
    const callMagicSpy = vi.spyOn(magic, 'callMagic').mockResolvedValue({
      ok: true,
      image_b64: 'b64_data',
    });
    // With Math.random() = 0.5:
    // y = 0.3 + 0.5 * 0.35 = 0.475
    // size = 0.09 + 0.5 * 0.03 = 0.105
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );

    const trayBtns = screen.getAllByRole('button').filter(b => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    act(() => {
      fireEvent.click(trayBtns[0]);
    });
    const magicBtn = await screen.findByTestId('magic-btn-1');
    await act(async () => {
      fireEvent.click(magicBtn);
    });

    const expectedCy = 0.475 + (0.105 * (16 / 9)) / 2;
    expect(callMagicSpy).toHaveBeenCalledWith(
      expect.objectContaining({ y: expectedCy }),
      expect.anything()
    );

    randomSpy.mockRestore();
    unmount();
  });

  it('updates toast text dynamically on mid-round language switch without holding stale language state', async () => {
    const spokenUtterances: string[] = [];
    class MockUtterance {
      text: string;
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

    vi.spyOn(magic, 'resolvePublicImageUrl').mockReturnValue('https://example.com/image.png');
    vi.spyOn(magic, 'publicUrlReachable').mockResolvedValue(true);
    vi.spyOn(magic, 'callMagic').mockResolvedValue({ ok: false });

    function Harness() {
      const [lang, setLang] = React.useState<Lang>('en');
      const onCycle = () => {
        setLang((l) => (l === 'en' ? 'ja' : l === 'ja' ? 'cmn' : l === 'cmn' ? 'yue' : 'en'));
      };
      return (
        <LangContext.Provider value={{ lang, onCycle }}>
          <StickerGame
            sceneId="d-farm"
            onHome={noop}
            onPickScene={noop}
            onBackToPicker={noop}
            lang={lang}
          />
        </LangContext.Provider>
      );
    }

    const { unmount } = render(<Harness />);

    // Initial welcoming instruction spoken in English and header subtitle has English scene name
    expect(spokenUtterances).toContain(t('en', 'card.sticker.blurb'));
    expect(capturedGameShellProps?.subtitle).toBe('Farm — decorate it your way!');

    // Place a sticker onto the stage
    const trayBtn = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('data-testid')?.startsWith('sticker-tray-'));
    expect(trayBtn).toBeDefined();
    act(() => {
      fireEvent.click(trayBtn!);
    });

    // Trigger magic, which resolves with ok: false to trigger fizzle toast
    const magicBtn = await screen.findByRole('button', { name: 'Make it real' }, { timeout: 10_000 });
    await act(async () => {
      fireEvent.click(magicBtn);
    });

    // English toast is displayed
    expect(await screen.findByText('The magic fizzled — try again!', undefined, { timeout: 10_000 })).toBeDefined();

    spokenUtterances.length = 0;

    // Switch language mid-toast via in-game lang-cycle button
    const langBtn = screen.getByTestId('lang-cycle');
    act(() => {
      fireEvent.click(langBtn);
    });

    // Toast text dynamically updates to Japanese without holding stale English state
    expect(await screen.findByText('まほうに しっぱいしちゃった — もういちど！', undefined, { timeout: 10_000 })).toBeDefined();
    expect(screen.queryByText('The magic fizzled — try again!')).toBeNull();

    // Header subtitle updates dynamically to Japanese with localized scene name
    expect(capturedGameShellProps?.subtitle).toBe('ぼくじょう — きみの すきに かざろう！');

    // useSay speaks the new Japanese prompt and no old English narration plays
    expect(spokenUtterances).toContain(t('ja', 'card.sticker.blurb'));
    expect(spokenUtterances).not.toContain(t('en', 'card.sticker.blurb'));

    // Placed sticker remains safely on stage with updated localized accessibility label
    const placed1 = screen.getByTestId('sticker-placed-1');
    expect(placed1).toBeDefined();
    expect(placed1.getAttribute('role')).toBe('img');
    expect(placed1.getAttribute('aria-label')).toBe('ピンクのドレス');

    unmount();
  });

  it('stops narration on unmount', () => {
    const stopNarrationSpy = vi.spyOn(sound, 'stopNarration');
    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );
    expect(stopNarrationSpy).not.toHaveBeenCalled();
    unmount();
    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);
    stopNarrationSpy.mockRestore();
  });

  it('renders character tab items and drops character sticker onto stage', async () => {
    const { unmount } = render(
      <StickerGame sceneId="d-farm" onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />
    );

    const charTab = screen.getByTestId('sticker-tab-characters');
    expect(charTab).toBeDefined();
    act(() => {
      fireEvent.click(charTab);
    });

    const princessTray = screen.getByTestId('sticker-tray-princess_pink');
    expect(princessTray).toBeDefined();
    expect(princessTray.getAttribute('aria-label')).toBe('Add pink princess sticker');

    // Assert that the tray tile renders an image whose source matches CHARACTER_ICONS.princess_pink
    const expectedUri = (CHARACTER_ICONS.princess_pink as unknown as { uri: string }).uri;
    const trayImg = princessTray.querySelector('img');
    expect(trayImg).not.toBeNull();
    expect(trayImg?.getAttribute('src')).toBe(expectedUri);

    const stageProps = capturedViewProps['sticker-stage'];
    expect(stageProps).toBeDefined();
    stageProps?.onLayout?.({} as unknown);

    const dispatchTouch = (type: 'start' | 'move' | 'end', x: number, y: number) => {
      const touch = { pageX: x, pageY: y, clientX: x, clientY: y, identifier: 0, target: princessTray };
      if (type === 'start') {
        fireEvent.touchStart(princessTray, { touches: [touch], changedTouches: [touch] });
      } else if (type === 'move') {
        fireEvent.touchMove(princessTray, { touches: [touch], changedTouches: [touch] });
      } else {
        fireEvent.touchEnd(princessTray, { touches: [], changedTouches: [touch] });
      }
    };

    await act(async () => {
      dispatchTouch('start', 100, 100);
      await new Promise((r) => setTimeout(r, 210));
      dispatchTouch('move', 50, 50);
    });

    // Assert that the drag ghost renders an image whose source matches CHARACTER_ICONS.princess_pink
    const ghostImg = document.querySelector('[style*="z-index: 50"] img');
    expect(ghostImg).not.toBeNull();
    expect(ghostImg?.getAttribute('src')).toBe(expectedUri);

    act(() => {
      dispatchTouch('end', 50, 50);
    });

    const placedSticker = screen.getByTestId('sticker-placed-1');
    expect(placedSticker).toBeDefined();

    // Assert that the placed sticker renders an image whose source matches CHARACTER_ICONS.princess_pink
    const placedImg = placedSticker.querySelector('img');
    expect(placedImg).not.toBeNull();
    expect(placedImg?.getAttribute('src')).toBe(expectedUri);

    unmount();
  });
});
