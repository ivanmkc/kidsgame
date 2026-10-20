// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMemoryLogic } from '../useMemoryLogic';

describe('useMemoryLogic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  interface TestCard {
    key: number;
    matchId: string;
  }

  const sampleBoard: TestCard[] = [
    { key: 0, matchId: 'apple' },
    { key: 1, matchId: 'apple' },
    { key: 2, matchId: 'banana' },
    { key: 3, matchId: 'banana' },
  ];

  it('flips a single card without incrementing moves', () => {
    const { result } = renderHook(() =>
      useMemoryLogic({
        board: sampleBoard,
        isMatch: (a, b) => a.matchId === b.matchId,
      }),
    );

    expect(result.current.faceUp).toEqual([]);
    expect(result.current.moves).toBe(0);

    act(() => {
      result.current.onFlip(sampleBoard[0]);
    });

    expect(result.current.faceUp).toEqual([0]);
    expect(result.current.moves).toBe(0);
    expect(result.current.matched).toEqual([]);
  });

  it('matches pairs, calls onMatch, and tracks moves', () => {
    const onMatch = vi.fn();
    const { result } = renderHook(() =>
      useMemoryLogic({
        board: sampleBoard,
        isMatch: (a, b) => a.matchId === b.matchId,
        onMatch,
      }),
    );

    act(() => {
      result.current.onFlip(sampleBoard[0]);
    });
    act(() => {
      result.current.onFlip(sampleBoard[1]);
    });

    expect(result.current.moves).toBe(1);
    expect(result.current.matched).toEqual([0, 1]);
    expect(result.current.faceUp).toEqual([]);
    expect(result.current.matchedPairs).toBe(1);
    expect(onMatch).toHaveBeenCalledWith(sampleBoard[0], sampleBoard[1], undefined, false);
  });

  it('locks on mismatch, calls onMismatch, ignores taps during lock, then flips face down after 750ms', () => {
    const onMismatch = vi.fn();
    const { result } = renderHook(() =>
      useMemoryLogic({
        board: sampleBoard,
        isMatch: (a, b) => a.matchId === b.matchId,
        onMismatch,
      }),
    );

    act(() => {
      result.current.onFlip(sampleBoard[0]);
      result.current.onFlip(sampleBoard[2]);
    });

    expect(result.current.moves).toBe(1);
    expect(onMismatch).toHaveBeenCalledTimes(1);
    expect(result.current.lockRef.current).toBe(true);
    expect(result.current.faceUp).toEqual([0, 2]);
    expect(result.current.matched).toEqual([]);

    // Tapping another card while locked is ignored
    act(() => {
      result.current.onFlip(sampleBoard[1]);
    });
    expect(result.current.faceUp).toEqual([0, 2]);

    // Fast-forward through mismatch delay
    act(() => {
      vi.advanceTimersByTime(750);
    });

    expect(result.current.lockRef.current).toBe(false);
    expect(result.current.faceUp).toEqual([]);
  });

  it('supports custom isMatch evaluation logic for concept matching', () => {
    interface ConceptCard {
      key: number;
      concept: string;
      representation: 'numeral' | 'dots';
    }

    const conceptBoard: ConceptCard[] = [
      { key: 10, concept: 'three', representation: 'numeral' },
      { key: 20, concept: 'three', representation: 'dots' },
      { key: 30, concept: 'four', representation: 'numeral' },
      { key: 40, concept: 'four', representation: 'dots' },
    ];

    const { result } = renderHook(() =>
      useMemoryLogic({
        board: conceptBoard,
        isMatch: (a, b) => a.concept === b.concept && a.representation !== b.representation,
      }),
    );

    act(() => {
      result.current.onFlip(conceptBoard[0]);
      result.current.onFlip(conceptBoard[1]);
    });

    expect(result.current.matched).toEqual([10, 20]);
    expect(result.current.matchedPairs).toBe(1);
  });

  it('manages duel turns, extra turns on match, matchedBy, and onMatch with scorer info', () => {
    const onMatch = vi.fn();
    const { result } = renderHook(() =>
      useMemoryLogic({
        board: sampleBoard,
        isMatch: (a, b) => a.matchId === b.matchId,
        duel: true,
        initialTurn: 0,
        onMatch,
      }),
    );

    expect(result.current.duelState.turn).toBe(0);

    // Turn 0 matches first pair -> keeps turn, credits player 0
    act(() => {
      result.current.onFlip(sampleBoard[0]);
      result.current.onFlip(sampleBoard[1]);
    });

    expect(result.current.duelState.turn).toBe(0);
    expect(result.current.duelState.pairs).toEqual([1, 0]);
    expect(result.current.matchedBy[0]).toBe(0);
    expect(result.current.matchedBy[1]).toBe(0);
    expect(onMatch).toHaveBeenCalledWith(sampleBoard[0], sampleBoard[1], 0, false);

    // Attempting to flip an already matched card is ignored
    act(() => {
      result.current.onFlip(sampleBoard[0]);
    });
    expect(result.current.faceUp).toEqual([]);
  });

  it('handles duel turn flip and fires onTurnChange on mismatch', () => {
    const onMismatch = vi.fn();
    const onTurnChange = vi.fn();
    const { result } = renderHook(() =>
      useMemoryLogic({
        board: sampleBoard,
        isMatch: (a, b) => a.matchId === b.matchId,
        duel: true,
        initialTurn: 0,
        onMismatch,
        onTurnChange,
      }),
    );

    // Mismatch: 0 and 2
    act(() => {
      result.current.onFlip(sampleBoard[0]);
      result.current.onFlip(sampleBoard[2]);
    });

    expect(onMismatch).toHaveBeenCalledTimes(1);
    expect(result.current.duelState.turn).toBe(0);

    act(() => {
      vi.advanceTimersByTime(750);
    });

    expect(result.current.duelState.turn).toBe(1);
    expect(onTurnChange).toHaveBeenCalledWith(1);
  });

  it('detects win when all cards are matched and flags isLastPair on final match', () => {
    const onMatch = vi.fn();
    const { result } = renderHook(() =>
      useMemoryLogic({
        board: sampleBoard,
        isMatch: (a, b) => a.matchId === b.matchId,
        duel: true,
        initialTurn: 0,
        onMatch,
      }),
    );

    // Pair 1
    act(() => {
      result.current.onFlip(sampleBoard[0]);
      result.current.onFlip(sampleBoard[1]);
    });
    expect(onMatch).toHaveBeenLastCalledWith(sampleBoard[0], sampleBoard[1], 0, false);

    // Pair 2 (final pair)
    act(() => {
      result.current.onFlip(sampleBoard[2]);
      result.current.onFlip(sampleBoard[3]);
    });

    expect(result.current.won).toBe(true);
    expect(onMatch).toHaveBeenLastCalledWith(sampleBoard[2], sampleBoard[3], 0, true);
  });

  it('resets board state and advances starter', () => {
    const { result } = renderHook(() =>
      useMemoryLogic({
        board: sampleBoard,
        isMatch: (a, b) => a.matchId === b.matchId,
        duel: true,
        initialTurn: 0,
      }),
    );

    act(() => {
      result.current.onFlip(sampleBoard[0]);
      result.current.onFlip(sampleBoard[1]);
    });
    expect(result.current.moves).toBe(1);
    expect(result.current.matched).toHaveLength(2);

    act(() => {
      const next = result.current.reset();
      expect(next).toBe(1);
    });

    expect(result.current.moves).toBe(0);
    expect(result.current.matched).toEqual([]);
    expect(result.current.faceUp).toEqual([]);
    expect(result.current.matchedBy).toEqual({});
    expect(result.current.duelState.turn).toBe(1);
  });

  it('ignores card flips when disabled', () => {
    const { result } = renderHook(() =>
      useMemoryLogic({
        board: sampleBoard,
        isMatch: (a, b) => a.matchId === b.matchId,
        disabled: true,
      }),
    );

    act(() => {
      result.current.onFlip(sampleBoard[0]);
    });

    expect(result.current.faceUp).toEqual([]);
    expect(result.current.moves).toBe(0);
  });
});
