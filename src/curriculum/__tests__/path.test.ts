import { describe, expect, it } from 'vitest';
import { ALL_MENU_CARDS, CardKey } from '../../menuCards';
import { CURRICULUM_PATH } from '../path';

describe('CURRICULUM_PATH', () => {
  it('maps early literacy strand progressions', () => {
    expect(CURRICULUM_PATH['listenchoose']).toBe('sounds');
    expect(CURRICULUM_PATH['sounds']).toBe('rhyme');
    expect(CURRICULUM_PATH['rhyme']).toBe('letters');
    expect(CURRICULUM_PATH['letters']).toBe('spell');
    expect(CURRICULUM_PATH['spell']).toBe('bingo');
    expect(CURRICULUM_PATH['bingo']).toBe('story');
  });

  it('maps numeracy strand progressions', () => {
    expect(CURRICULUM_PATH['numbers']).toBe('count');
    expect(CURRICULUM_PATH['count']).toBe('compare');
    expect(CURRICULUM_PATH['compare']).toBe('sums');
  });

  it('maps music strand progressions', () => {
    expect(CURRICULUM_PATH['highlow']).toBe('bells');
    expect(CURRICULUM_PATH['bells']).toBe('fastslow');
    expect(CURRICULUM_PATH['fastslow']).toBe('echobeat');
    expect(CURRICULUM_PATH['steadybeat']).toBe('echobeat');
  });

  it('maps executive function strand progressions', () => {
    expect(CURRICULUM_PATH['samediff']).toBe('shadow');
    expect(CURRICULUM_PATH['shadow']).toBe('diff');
    expect(CURRICULUM_PATH['diff']).toBe('hidden');
    expect(CURRICULUM_PATH['hidden']).toBe('oddone');
    expect(CURRICULUM_PATH['oddone']).toBe('memory');
    expect(CURRICULUM_PATH['memory']).toBe('puzzle');
    expect(CURRICULUM_PATH['puzzle']).toBe('rules');
    expect(CURRICULUM_PATH['rules']).toBe('spotit');
  });

  it('contains only destinations that resolve to existing menu cards or shipped cards', () => {
    const cardKeys = new Set(ALL_MENU_CARDS.map((c) => c.key));
    for (const [fromKey, toKey] of Object.entries(CURRICULUM_PATH)) {
      expect(fromKey).toBeTruthy();
      expect(toKey).toBeTruthy();
      if (toKey !== 'escape') {
        expect(cardKeys.has(toKey as CardKey)).toBe(true);
      }
    }
  });

  it('contains no circular progression chains', () => {
    for (const startKey of Object.keys(CURRICULUM_PATH) as CardKey[]) {
      const visited = new Set<CardKey>();
      let current: CardKey | undefined = startKey;
      while (current) {
        expect(visited.has(current)).toBe(false);
        visited.add(current);
        current = CURRICULUM_PATH[current];
      }
    }
  });
});
