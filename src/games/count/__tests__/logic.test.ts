import { describe, expect, it } from 'vitest';
import { CountState, countToQuiz, finishCelebration, initCountState, isCountWon, onCorrectPick } from '../logic';

describe('Count state transitions', () => {
  it('initializes to count phase with zero score', () => {
    const s = initCountState(5);
    expect(s.score).toBe(0);
    expect(s.roundsToWin).toBe(5);
    expect(s.phase).toBe('count');
    expect(isCountWon(s)).toBe(false);
  });

  it('transitions from count to quiz phase', () => {
    const s = countToQuiz(initCountState(5));
    expect(s.phase).toBe('quiz');
    expect(s.score).toBe(0);
    expect(isCountWon(s)).toBe(false);
  });

  it('defers win status during celebration while immediately incrementing score on the winning round', () => {
    const quizState: CountState = { score: 4, roundsToWin: 5, phase: 'quiz' };

    const celebratingState = onCorrectPick(quizState);
    expect(celebratingState.phase).toBe('celebrating');
    expect(celebratingState.score).toBe(5);
    expect(isCountWon(celebratingState)).toBe(false);

    const wonState = finishCelebration(celebratingState);
    expect(wonState.phase).toBe('won');
    expect(wonState.score).toBe(5);
    expect(isCountWon(wonState)).toBe(true);
  });

  it('advances to next round count phase when celebration finishes on non-final round', () => {
    const quizState: CountState = { score: 2, roundsToWin: 5, phase: 'quiz' };

    const celebratingState = onCorrectPick(quizState);
    expect(celebratingState.phase).toBe('celebrating');
    expect(celebratingState.score).toBe(3);
    expect(isCountWon(celebratingState)).toBe(false);

    const nextRoundState = finishCelebration(celebratingState);
    expect(nextRoundState.phase).toBe('count');
    expect(nextRoundState.score).toBe(3);
    expect(isCountWon(nextRoundState)).toBe(false);
  });

  it('ignores invalid phase transitions', () => {
    const countState = initCountState(5);
    expect(onCorrectPick(countState)).toBe(countState);
    expect(finishCelebration(countState)).toBe(countState);

    const quizState = countToQuiz(countState);
    expect(countToQuiz(quizState)).toBe(quizState);
    expect(finishCelebration(quizState)).toBe(quizState);

    const celebratingState = onCorrectPick(quizState);
    expect(countToQuiz(celebratingState)).toBe(celebratingState);
    expect(onCorrectPick(celebratingState)).toBe(celebratingState);

    const wonQuiz: CountState = { score: 4, roundsToWin: 5, phase: 'quiz' };
    const wonCelebrating = onCorrectPick(wonQuiz);
    const wonState = finishCelebration(wonCelebrating);
    expect(wonState.phase).toBe('won');
    expect(countToQuiz(wonState)).toBe(wonState);
    expect(onCorrectPick(wonState)).toBe(wonState);
    expect(finishCelebration(wonState)).toBe(wonState);
  });

  it('plays through a full 5-round game', () => {
    let state = initCountState(5);
    for (let r = 0; r < 4; r++) {
      expect(state.score).toBe(r);
      expect(state.phase).toBe('count');
      state = countToQuiz(state);
      expect(state.phase).toBe('quiz');
      state = onCorrectPick(state);
      expect(state.phase).toBe('celebrating');
      expect(state.score).toBe(r + 1);
      expect(isCountWon(state)).toBe(false);
      state = finishCelebration(state);
    }
    // Round 5 (final round)
    expect(state.score).toBe(4);
    expect(state.phase).toBe('count');
    state = countToQuiz(state);
    expect(state.phase).toBe('quiz');
    state = onCorrectPick(state);
    expect(state.phase).toBe('celebrating');
    expect(state.score).toBe(5);
    expect(isCountWon(state)).toBe(false);
    state = finishCelebration(state);
    expect(state.score).toBe(5);
    expect(state.phase).toBe('won');
    expect(isCountWon(state)).toBe(true);
  });
});
