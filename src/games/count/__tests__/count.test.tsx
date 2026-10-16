import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as sound from '../../../sound';
import { CountGame } from '../CountGame';

interface TestElement {
  props?: {
    testID?: string;
    label?: string;
    nextLabel?: string;
    onTap?: () => void;
    onPress?: () => void;
    onNext?: () => void;
    children?: unknown;
    right?: unknown;
  };
}

let hookStateIndex = 0;
let states: unknown[] = [];
let hookRefIndex = 0;
let refs: Array<{ current: unknown }> = [];

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const mockUseState = <T,>(initial: T | (() => T)): [T, (next: React.SetStateAction<T>) => void] => {
    const idx = hookStateIndex++;
    if (states[idx] === undefined) {
      states[idx] = typeof initial === 'function' ? (initial as () => T)() : initial;
    }
    const setState = (next: React.SetStateAction<T>) => {
      states[idx] = typeof next === 'function' ? (next as (prev: T) => T)(states[idx] as T) : next;
    };
    return [states[idx] as T, setState];
  };
  const mockUseRef = <T,>(initial: T): { current: T } => {
    const idx = hookRefIndex++;
    if (refs[idx] === undefined) {
      refs[idx] = { current: initial };
    }
    return refs[idx] as { current: T };
  };
  const mockUseEffect = () => {};
  return {
    ...actual,
    useState: mockUseState,
    useRef: mockUseRef,
    useEffect: mockUseEffect,
    default: {
      ...actual,
      useState: mockUseState,
      useRef: mockUseRef,
      useEffect: mockUseEffect,
    },
  };
});

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-native')>();
  return {
    ...actual,
    useWindowDimensions: () => ({ width: 800, height: 600 }),
  };
});

function findInTree(tree: unknown, predicate: (node: TestElement) => boolean): TestElement[] {
  const matches: TestElement[] = [];
  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    const element = node as TestElement;
    if (predicate(element)) matches.push(element);
    if (element.props) {
      if (Array.isArray(element.props.children)) {
        element.props.children.forEach(walk);
      } else if (element.props.children) {
        walk(element.props.children);
      }
      if (element.props.right) walk(element.props.right);
    }
  }
  walk(tree);
  return matches;
}

function renderGame() {
  hookStateIndex = 0;
  hookRefIndex = 0;
  return CountGame({ onHome: () => {}, difficulty: 'easy', lang: 'en' });
}

describe('CountGame input locking', () => {
  let sayThenDoneCallbacks: Array<() => void> = [];

  beforeEach(() => {
    states = [];
    refs = [];
    hookStateIndex = 0;
    hookRefIndex = 0;
    sayThenDoneCallbacks = [];
    vi.spyOn(sound, 'sayThen').mockImplementation((_texts, done) => {
      if (done) sayThenDoneCallbacks.push(done);
    });
    vi.spyOn(sound, 'say').mockImplementation(() => {});
  });

  it('double-tap on correct answer only scores once and does not skip round', () => {
    let tree = renderGame();

    // Verify initial score chip reads 0/5
    let scoreChip = findInTree(tree, (n) => n.props?.testID === 'count-score')[0];
    expect(scoreChip.props?.label).toBe('🔢 0/5');

    // Tap all critters to finish the count phase
    const stage = findInTree(
      tree,
      (n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('count-stage-'),
    )[0];
    const n = Number(stage.props?.testID?.split('-').pop());

    for (let i = 0; i < n; i++) {
      tree = renderGame();
      const critter = findInTree(tree, (node) => node.props?.testID === `count-critter-${i}`)[0];
      expect(critter).toBeDefined();
      critter.props?.onTap?.();
    }

    // Completion of critter tapping queues a sayThen to switch to 'quiz' phase
    expect(sayThenDoneCallbacks.length).toBeGreaterThan(0);
    const finishCountSpeech = sayThenDoneCallbacks.pop()!;
    finishCountSpeech();

    // Now re-render: phase should be 'quiz'
    tree = renderGame();
    const answerChoice = findInTree(
      tree,
      (n) => typeof n.props?.testID === 'string' && n.props.testID.endsWith('-answer'),
    )[0];
    expect(answerChoice).toBeDefined();

    // First tap on correct answer
    answerChoice.props?.onPress?.();

    // Re-render: score should be 1
    tree = renderGame();
    scoreChip = findInTree(tree, (n) => n.props?.testID === 'count-score')[0];
    expect(scoreChip.props?.label).toBe('🔢 1/5');

    // Second tap (double-tap) on correct answer BEFORE praise speech sayThen completes
    const answerChoice2 = findInTree(
      tree,
      (n) => typeof n.props?.testID === 'string' && n.props.testID.endsWith('-answer'),
    )[0];
    answerChoice2.props?.onPress?.();

    // Score MUST still be 1/5, not 2/5
    tree = renderGame();
    scoreChip = findInTree(tree, (n) => n.props?.testID === 'count-score')[0];
    expect(scoreChip.props?.label).toBe('🔢 1/5');

    // Only one round-advance callback should have been queued
    expect(sayThenDoneCallbacks).toHaveLength(1);

    // Let the praise speech finish: round advances to next round
    const advanceRound = sayThenDoneCallbacks.pop()!;
    advanceRound();

    tree = renderGame();
    // After advancing, the game starts the next round in 'count' phase
    const progress = findInTree(tree, (n) => n.props?.testID === 'count-progress')[0];
    expect(progress).toBeDefined();
  });

  function playRound() {
    let tree = renderGame();
    const stage = findInTree(
      tree,
      (n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('count-stage-'),
    )[0];
    const n = Number(stage.props?.testID?.split('-').pop());
    for (let i = 0; i < n; i++) {
      tree = renderGame();
      const critter = findInTree(tree, (node) => node.props?.testID === `count-critter-${i}`)[0];
      critter.props?.onTap?.();
    }
    const finishCountSpeech = sayThenDoneCallbacks.pop()!;
    finishCountSpeech();

    tree = renderGame();
    const answerChoice = findInTree(
      tree,
      (n) => typeof n.props?.testID === 'string' && n.props.testID.endsWith('-answer'),
    )[0];
    answerChoice.props?.onPress?.();

    if (sayThenDoneCallbacks.length > 0) {
      const advanceRound = sayThenDoneCallbacks.pop()!;
      advanceRound();
    }
  }

  it('reset() resets score and unlocks input after winning', () => {
    // Play all 5 rounds to win the game
    for (let round = 0; round < 5; round++) {
      playRound();
    }

    // WinOverlay is now visible
    let tree = renderGame();
    const winOverlay = findInTree(tree, (n) => typeof n.props?.nextLabel === 'string')[0];
    expect(winOverlay).toBeDefined();

    // Tap "Play again" to reset
    winOverlay.props?.onNext?.();

    // Verify score is reset to 0/5 and game is back in count phase
    tree = renderGame();
    let scoreChip = findInTree(tree, (n) => n.props?.testID === 'count-score')[0];
    expect(scoreChip.props?.label).toBe('🔢 0/5');

    // Play next round to prove input is unlocked and answers register
    playRound();

    // Verify answer was accepted and score incremented
    tree = renderGame();
    scoreChip = findInTree(tree, (n) => n.props?.testID === 'count-score')[0];
    expect(scoreChip.props?.label).toBe('🔢 1/5');
  });
});
