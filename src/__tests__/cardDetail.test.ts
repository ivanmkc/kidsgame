import { describe, expect, it } from 'vitest';
import {
  DIFFICULTIES,
  Difficulty,
  cardDetail,
  oddSettings,
  shadowSettings,
} from '../difficulty';

const LEVELS: Difficulty[] = ['easy', 'medium', 'hard'];

describe('cardDetail', () => {
  it('derives every number from the settings the games play with', () => {
    for (const d of LEVELS) {
      const s = DIFFICULTIES[d];
      expect(cardDetail('spotit', d)).toContain(`${s.spotitRounds} rounds`);
      expect(cardDetail('diff', d)).toContain(`${s.diffDraw} differences`);
      expect(cardDetail('hidden', d)).toContain(`${s.hiddenDraw}`);
      expect(cardDetail('memory', d)).toBe(`${s.memoryPairs} pairs`);
      expect(cardDetail('puzzle', d)).toBe(`${s.puzzleCols}×${s.puzzleRows} pieces`);
      expect(cardDetail('shadow', d)).toContain(`${shadowSettings(d).choices} shadows`);
      expect(cardDetail('oddone', d)).toBe(`${oddSettings(d).n} tiles`);
      expect(cardDetail('rules', d)).toContain(`${s.rulesTiles} tiles`);
    }
  });

  it('flags hints and timer where they actually apply', () => {
    for (const d of LEVELS) {
      const s = DIFFICULTIES[d];
      expect(cardDetail('diff', d)!.includes('💡')).toBe(s.diffHint);
      expect(cardDetail('spotit', d)!.includes('⏱️')).toBe(s.timer);
      expect(cardDetail('rules', d)!.includes('memory check')).toBe(s.rulesRecallFrom !== Infinity);
    }
  });

  it('difficulty actually changes each game (chips are not cosmetic)', () => {
    for (const route of ['spotit', 'diff', 'memory', 'puzzle', 'shadow', 'oddone', 'rules']) {
      expect(cardDetail(route, 'easy')).not.toBe(cardDetail(route, 'hard'));
    }
  });

  it('free-play games have no difficulty text; all plays medium rules', () => {
    expect(cardDetail('sticker', 'medium')).toBeNull();
    expect(cardDetail('story', 'medium')).toBeNull();
    for (const route of ['spotit', 'memory', 'puzzle']) {
      expect(cardDetail(route, 'all')).toBe(cardDetail(route, 'medium'));
    }
  });
});
