import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

interface PressableProps {
  testID?: string;
  accessibilityLabel?: string;
  children?: React.ReactNode;
  onPressIn?: () => void;
  onPressOut?: () => void;
  onPress?: () => void;
}

interface TextInputProps {
  testID?: string;
  value?: string;
  placeholder?: string;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: () => void;
}

let pressableProps: PressableProps[] = [];
let textInputProps: TextInputProps | null = null;

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-native')>();
  return {
    ...actual,
    Pressable: (props: PressableProps) => {
      pressableProps.push(props);
      return <div data-testid={props.testID}>{props.children}</div>;
    },
    TextInput: (props: TextInputProps) => {
      textInputProps = props;
      return <input data-testid={props.testID} value={props.value} />;
    },
    Animated: {
      ...actual.Animated,
      sequence: () => ({ start: (cb?: () => void) => cb?.() }),
      timing: () => ({ start: (cb?: () => void) => cb?.() }),
    },
  };
});

let gateWords = ['apple', 'banana'];
vi.mock('../../lockdown', () => ({
  randomGateWord: () => gateWords.shift() || 'default',
}));

import { AdultGate } from '../AdultGate';

const makeNode = (): Partial<HTMLElement> => ({
  nodeName: 'DIV',
  tagName: 'div',
  nodeType: 1,
  setAttribute: () => {},
  removeAttribute: () => {},
  style: {} as CSSStyleDeclaration,
  appendChild: (() => {}) as unknown as <T extends Node>(node: T) => T,
  removeChild: (() => {}) as unknown as <T extends Node>(node: T) => T,
  insertBefore: (() => {}) as unknown as <T extends Node>(node: T, child: Node | null) => T,
  addEventListener: () => {},
  removeEventListener: () => {},
});

class FakeIFrame {}

const doc: Partial<Document> = {
  nodeName: '#document',
  nodeType: 9,
  createElement: makeNode as (tagName: string, options?: ElementCreationOptions) => HTMLElement,
  createElementNS: makeNode as unknown as typeof document.createElementNS,
  createTextNode: () => ({ nodeType: 3, nodeName: '#text' }) as Text,
  addEventListener: () => {},
  removeEventListener: () => {},
  defaultView: {
    HTMLIFrameElement: FakeIFrame,
  } as unknown as Window & typeof globalThis,
  body: makeNode() as HTMLElement,
  activeElement: null,
};

interface GlobalWithReactTest {
  window?: unknown;
  document?: unknown;
  HTMLIFrameElement?: unknown;
  IS_REACT_ACT_ENVIRONMENT?: boolean;
}

describe('AdultGate', () => {
  let g: GlobalWithReactTest;
  let origWindow: unknown;
  let origDocument: unknown;
  let origHTMLIFrameElement: unknown;
  let origAct: unknown;

  beforeEach(() => {
    vi.useFakeTimers();
    gateWords = ['apple', 'banana'];
    g = globalThis as unknown as GlobalWithReactTest;
    origWindow = g.window;
    origDocument = g.document;
    origHTMLIFrameElement = g.HTMLIFrameElement;
    origAct = g.IS_REACT_ACT_ENVIRONMENT;

    g.window = doc.defaultView;
    g.HTMLIFrameElement = FakeIFrame;
    g.document = doc;
    g.IS_REACT_ACT_ENVIRONMENT = true;

    pressableProps = [];
    textInputProps = null;
  });

  afterEach(() => {
    g.window = origWindow;
    g.document = origDocument;
    g.HTMLIFrameElement = origHTMLIFrameElement;
    g.IS_REACT_ACT_ENVIRONMENT = origAct as boolean;
    vi.useRealTimers();
  });

  it('runs through the hold phase and correct word entry', () => {
    const container = { ...makeNode(), ownerDocument: doc };
    const root = createRoot(container as unknown as HTMLElement);
    const onPass = vi.fn();
    const onCancel = vi.fn();

    act(() => {
      root.render(<AdultGate onPass={onPass} onCancel={onCancel} />);
    });

    let holdBtn = pressableProps.find((p) => p.accessibilityLabel?.includes('Hold'));
    let cancelBtn = pressableProps.find((p) => {
      const child = p.children as React.ReactElement<{ children: React.ReactNode }>;
      return child?.props?.children === 'Cancel';
    });

    // Cancel straight away
    act(() => {
      cancelBtn?.onPress?.();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Press and hold
    act(() => {
      holdBtn?.onPressIn?.();
    });

    // Release early, should not pass hold phase
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      holdBtn?.onPressOut?.();
    });
    expect(textInputProps).toBeNull();

    // Press and hold to completion
    pressableProps = []; // reset to easily find new elements
    act(() => {
      holdBtn?.onPressIn?.();
    });
    act(() => {
      vi.advanceTimersByTime(3500);
    });

    expect(textInputProps).not.toBeNull();
    expect(textInputProps?.placeholder).toBe('Type the word here');

    // Idle timeout
    act(() => {
      vi.advanceTimersByTime(35000);
    });
    expect(onCancel).toHaveBeenCalledTimes(2);

    // Wrong word
    act(() => {
      textInputProps?.onChangeText?.('wrong');
    });
    act(() => {
      textInputProps?.onSubmitEditing?.();
    });
    expect(onPass).not.toHaveBeenCalled();

    // Find the cancel button in word phase
    cancelBtn = pressableProps.find((p) => {
      const child = p.children as React.ReactElement<{ children: React.ReactNode }>;
      return child?.props?.children === 'Cancel';
    });
    act(() => {
      cancelBtn?.onPress?.();
    });
    expect(onCancel).toHaveBeenCalledTimes(3);

    // Word changed to banana
    act(() => {
      textInputProps?.onChangeText?.('banana');
    });
    act(() => {
      textInputProps?.onSubmitEditing?.();
    });
    expect(onPass).toHaveBeenCalledTimes(1);

    // Unmount
    act(() => {
      root.unmount();
    });
  });
});
