import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import * as music from '../../music';
import { FastSlowGame } from './FastSlowGame';

let fastPress: (() => void) | undefined;
let slowPress: (() => void) | undefined;

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-native')>();
  return {
    ...actual,
    Pressable: (props: {
      testID?: string;
      onPress?: () => void;
      children: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
    }) => {
      if (props.testID === 'fastslow-fast') fastPress = props.onPress;
      if (props.testID === 'fastslow-slow') slowPress = props.onPress;
      const children = typeof props.children === 'function' ? props.children({ pressed: false }) : props.children;
      return React.createElement('div', { 'data-testid': props.testID }, children);
    },
  };
});

describe('FastSlowGame', () => {
  it('delays playing the next round by 1000ms after a correct pick', () => {
    vi.useFakeTimers();
    let playCb: (() => void) | undefined;
    let actualSpeed: 'fast' | 'slow' | undefined;

    const playSpy = vi.spyOn(music, 'playSequence').mockImplementation((notes, bpm, inst, cb) => {
      playCb = cb;
      actualSpeed = bpm >= 140 ? 'fast' : 'slow';
      return () => {};
    });

    type FakeDocument = Omit<
      Partial<Document>,
      'createElement' | 'createElementNS' | 'createTextNode' | 'defaultView' | 'body'
    > & {
      createElement: (tag: string) => FakeNode;
      createElementNS: (ns: string | null, tag: string) => FakeNode;
      createTextNode: (text: string) => FakeNode;
      defaultView: { HTMLIFrameElement: typeof FakeIFrame };
      body: FakeNode;
      activeElement: null;
    };

    type FakeNode = Partial<HTMLElement> & {
      appendChild: <T extends Node>(n: T) => T;
      removeChild: <T extends Node>(n: T) => T;
      insertBefore: <T extends Node>(n: T, _r: Node | null) => T;
    };

    const makeNode = (type: number, name: string): FakeNode => ({
      nodeName: name,
      tagName: name.toLowerCase(),
      nodeType: type,
      setAttribute: () => {},
      removeAttribute: () => {},
      style: {} as CSSStyleDeclaration,
      appendChild: <T extends Node>(n: T): T => n,
      removeChild: <T extends Node>(n: T): T => n,
      insertBefore: <T extends Node>(n: T, _r: Node | null): T => n,
      addEventListener: () => {},
      removeEventListener: () => {},
    });

    class FakeIFrame {}

    const doc: FakeDocument = {
      nodeName: '#document',
      nodeType: 9,
      createElement: (tag: string) => ({ ...makeNode(1, tag.toUpperCase()), ownerDocument: doc as Document }),
      createElementNS: (ns: string | null, tag: string) => makeNode(1, tag.toUpperCase()),
      createTextNode: () => makeNode(3, '#text'),
      addEventListener: () => {},
      removeEventListener: () => {},
      defaultView: { HTMLIFrameElement: FakeIFrame },
      body: makeNode(1, 'BODY'),
      activeElement: null,
    };

    const g = globalThis as Partial<typeof globalThis> & {
      HTMLIFrameElement?: unknown;
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    const origWindow = g.window;
    const origDocument = g.document;
    const origHTMLIFrameElement = g.HTMLIFrameElement;
    const origAct = g.IS_REACT_ACT_ENVIRONMENT;
    Object.assign(globalThis, {
      window: doc.defaultView,
      document: doc,
      HTMLIFrameElement: FakeIFrame,
      IS_REACT_ACT_ENVIRONMENT: true,
    });

    let root: Root | undefined;
    try {
      const container = doc.createElement('div');
      root = createRoot(container as HTMLElement);
      act(() => {
        root!.render(React.createElement(FastSlowGame, { onHome: () => {}, difficulty: 'easy', lang: 'en' }));
      });

      // Initially listen phase, waits 400ms to start sequence
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(playSpy).toHaveBeenCalledTimes(1);

      // Sequence finishes, changes phase to 'pick'
      act(() => {
        if (playCb) playCb();
      });

      // Tap the correct answer
      act(() => {
        if (actualSpeed === 'fast' && fastPress) fastPress();
        if (actualSpeed === 'slow' && slowPress) slowPress();
      });

      // During the 1000ms delay + 400ms next round delay, nothing new plays
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(playSpy).toHaveBeenCalledTimes(1);

      // After the new round is set, there's another 400ms before playSequence is called
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(playSpy).toHaveBeenCalledTimes(2);
    } finally {
      if (root) {
        act(() => {
          root!.unmount();
        });
      }
      Object.assign(globalThis, {
        window: origWindow,
        document: origDocument,
        HTMLIFrameElement: origHTMLIFrameElement,
        IS_REACT_ACT_ENVIRONMENT: origAct,
      });
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });
});
