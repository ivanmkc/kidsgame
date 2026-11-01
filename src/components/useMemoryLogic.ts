import { useCallback, useEffect, useRef, useState } from 'react';
import { PlayerIx, nextTurn } from '../multiplayer';
import { DuelState, duelInit, duelResolve, nextStarter } from './memoryLogic';

export type { DuelState };

// --- Memory match hook ------------------------------------------------------

export interface UseMemoryLogicOptions<T extends { key: number | string }> {
  board: readonly T[];
  isMatch: (a: T, b: T) => boolean;
  onMatch?: (cardA: T, cardB: T, scorer?: PlayerIx, isLastPair?: boolean) => void;
  onMismatch?: () => void;
  onTurnChange?: (nextTurn: PlayerIx) => void;
  onFlipCard?: (card: T) => void;
  duel?: boolean;
  disabled?: boolean;
  initialTurn?: PlayerIx;
}

export interface UseMemoryLogicResult<T extends { key: number | string }> {
  faceUp: T['key'][];
  matched: T['key'][];
  matchedBy: Record<T['key'], PlayerIx>;
  duelState: DuelState;
  moves: number;
  lockRef: React.MutableRefObject<boolean>;
  onFlip: (card: T) => void;
  reset: (starter?: PlayerIx) => PlayerIx;
  won: boolean;
  matchedPairs: number;
}

export function useMemoryLogic<T extends { key: number | string }>({
  board,
  isMatch,
  onMatch,
  onMismatch,
  onTurnChange,
  onFlipCard,
  duel = false,
  disabled = false,
  initialTurn,
}: UseMemoryLogicOptions<T>): UseMemoryLogicResult<T> {
  const [faceUp, setFaceUp] = useState<T['key'][]>([]);
  const faceUpRef = useRef<T['key'][]>([]);

  const [matched, setMatched] = useState<T['key'][]>([]);
  const matchedRef = useRef<T['key'][]>([]);

  const [matchedBy, setMatchedBy] = useState<Record<T['key'], PlayerIx>>({} as Record<T['key'], PlayerIx>);
  const matchedByRef = useRef<Record<T['key'], PlayerIx>>({} as Record<T['key'], PlayerIx>);

  const [duelState, setDuelState] = useState<DuelState>(() => duelInit(initialTurn ?? (Math.random() < 0.5 ? 0 : 1)));
  const duelStateRef = useRef<DuelState>(duelState);
  duelStateRef.current = duelState;

  const [moves, setMoves] = useState(0);
  const lockRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const won = board.length > 0 && matched.length === board.length;

  const reset = useCallback((starter?: PlayerIx): PlayerIx => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    lockRef.current = false;
    faceUpRef.current = [];
    setFaceUp([]);
    matchedRef.current = [];
    setMatched([]);
    matchedByRef.current = {} as Record<T['key'], PlayerIx>;
    setMatchedBy({} as Record<T['key'], PlayerIx>);
    setMoves(0);
    const next = starter ?? nextStarter(duelStateRef.current);
    const nextDuel = duelInit(next);
    duelStateRef.current = nextDuel;
    setDuelState(nextDuel);
    return next;
  }, []);

  const onFlip = useCallback(
    (card: T) => {
      if (disabled) return;
      if (lockRef.current) return;
      if (board.length > 0 && matchedRef.current.length === board.length) return;
      if (faceUpRef.current.length >= 2) return;
      if (faceUpRef.current.includes(card.key) || matchedRef.current.includes(card.key)) return;

      const next = [...faceUpRef.current, card.key];
      faceUpRef.current = next;
      setFaceUp(next);
      onFlipCard?.(card);

      if (next.length === 2) {
        setMoves((m) => m + 1);
        const cardA = board.find((c) => c.key === next[0]);
        const cardB = board.find((c) => c.key === next[1]);
        if (!cardA || !cardB) {
          throw new Error(`Cards ${String(next[0])} or ${String(next[1])} not found on board`);
        }

        if (isMatch(cardA, cardB)) {
          const nextMatched = [...matchedRef.current, cardA.key, cardB.key];
          matchedRef.current = nextMatched;
          setMatched(nextMatched);
          faceUpRef.current = [];
          setFaceUp([]);
          const isLastPair = nextMatched.length === board.length;
          let scorer: PlayerIx | undefined;
          if (duel) {
            scorer = duelStateRef.current.turn;
            const nextMatchedBy = { ...matchedByRef.current, [cardA.key]: scorer, [cardB.key]: scorer } as Record<
              T['key'],
              PlayerIx
            >;
            matchedByRef.current = nextMatchedBy;
            setMatchedBy(nextMatchedBy);
            const nextDuel = duelResolve(duelStateRef.current, true);
            duelStateRef.current = nextDuel;
            setDuelState(nextDuel);
          }
          onMatch?.(cardA, cardB, scorer, isLastPair);
        } else {
          onMismatch?.();
          lockRef.current = true;
          const currentTurn = duelStateRef.current.turn;
          timeoutRef.current = setTimeout(() => {
            timeoutRef.current = null;
            faceUpRef.current = [];
            setFaceUp([]);
            lockRef.current = false;
            if (duel) {
              const nextTurnPlayer = nextTurn(currentTurn);
              const nextDuel = duelResolve(duelStateRef.current, false);
              duelStateRef.current = nextDuel;
              setDuelState(nextDuel);
              onTurnChange?.(nextTurnPlayer);
            }
          }, 750);
        }
      }
    },
    [board, disabled, duel, isMatch, onMatch, onMismatch, onTurnChange, onFlipCard],
  );

  return {
    faceUp,
    matched,
    matchedBy,
    duelState,
    moves,
    lockRef,
    onFlip,
    reset,
    won,
    matchedPairs: Math.floor(matched.length / 2),
  };
}
