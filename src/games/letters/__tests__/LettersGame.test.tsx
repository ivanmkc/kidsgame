import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { LettersGame } from '../LettersGame';
import { sfx } from '../../../sound';

const capturedPressableMap: Record<string, { onPress?: () => void }> = {};

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const ActualPressable = actual.Pressable as React.ComponentType<Record<string, unknown>>;
  return {
    ...actual,
    Pressable: (props: Record<string, unknown>) => {
      if (typeof props.testID === 'string') {
        capturedPressableMap[props.testID] = props as { onPress?: () => void };
      }
      return React.createElement(ActualPressable, props);
    },
  };
});

describe('LettersGame tap lock', () => {
  let origWindow: unknown;
  let origDocument: unknown;
  let origAct: unknown;

  let doc: Partial<Document>;

  const g = globalThis as unknown as {
    window?: unknown;
    document?: unknown;
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    for (const key of Object.keys(capturedPressableMap)) {
      delete capturedPressableMap[key];
    }
    vi.restoreAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0.42); // deterministic round

    const makeNode = () => {
      const node: Partial<HTMLElement> = {
        nodeName: 'DIV',
        tagName: 'div',
        nodeType: 1,
        setAttribute: () => {},
        removeAttribute: () => {},
        style: {} as CSSStyleDeclaration,
        appendChild: <T extends Node>(n: T) => n,
        removeChild: <T extends Node>(n: T) => n,
        insertBefore: <T extends Node>(n: T) => n,
        addEventListener: () => {},
        removeEventListener: () => {},
        get ownerDocument() {
          return doc as Document;
        },
      };
      return node as HTMLElement;
    };

    class FakeIFrame {}

    doc = {
      nodeName: '#document',
      nodeType: 9,
      createElement: makeNode as unknown as Document['createElement'],
      createElementNS: makeNode as unknown as Document['createElementNS'],
      createTextNode: ((data: string) => ({
        nodeType: 3,
        nodeName: '#text',
        data,
      })) as unknown as Document['createTextNode'],
      addEventListener: () => {},
      removeEventListener: () => {},
      defaultView: { HTMLIFrameElement: FakeIFrame } as unknown as Window & typeof globalThis,
      body: makeNode(),
      activeElement: null,
    };

    origWindow = g.window;
    origDocument = g.document;
    origAct = g.IS_REACT_ACT_ENVIRONMENT;

    g.window = doc.defaultView;
    g.document = doc;
    g.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    vi.useRealTimers();
    g.window = origWindow;
    g.document = origDocument;
    g.IS_REACT_ACT_ENVIRONMENT = origAct as boolean | undefined;
  });

  it('prevents double-taps on the correct answer within the same render', () => {
    const sfxGood = vi.spyOn(sfx, 'good').mockImplementation(() => {});
    const sfxWrong = vi.spyOn(sfx, 'wrong').mockImplementation(() => {});

    const container = doc.createElement!('div');
    const root = createRoot(container);

    act(() => {
      root.render(<LettersGame onHome={() => {}} difficulty="easy" lang="en" />);
    });

    let correctTileFound = false;

    for (let i = 0; i < 12; i++) {
      const tile = capturedPressableMap[`letters-tile-${i}`];
      if (!tile) break;

      const goodCountBefore = sfxGood.mock.calls.length;
      const wrongCountBefore = sfxWrong.mock.calls.length;

      act(() => {
        // Double tap! Because this is in `act`, React will batch updates,
        // and we verify that the component's internal lockRef blocks the second execution.
        tile.onPress?.();
        tile.onPress?.();
      });

      if (sfxGood.mock.calls.length > goodCountBefore) {
        // Correct tile! sfx.good() should have been called EXACTLY once.
        expect(sfxGood.mock.calls.length).toBe(goodCountBefore + 1);
        correctTileFound = true;
        break;
      } else {
        // Wrong tile! sfx.wrong() should have been called EXACTLY once.
        expect(sfxWrong.mock.calls.length).toBe(wrongCountBefore + 1);
        act(() => {
          vi.advanceTimersByTime(500);
        });
      }
    }

    expect(correctTileFound).toBe(true);
    expect(sfxGood).toHaveBeenCalledTimes(1);
  });
});
