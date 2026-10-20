import { describe, expect, it } from 'vitest';
import { makeRng } from '../../../rng';
import { ALPHABET, ConceptMatchCard, buildBoard, isMatch } from '../logic';

describe('conceptmatch/logic', () => {
  describe('isMatch', () => {
    it('returns true when two cards share a conceptId', () => {
      const cardA: ConceptMatchCard = {
        key: 'A-upper',
        conceptId: 'A',
        display: 'A',
        speech: 'A',
      };
      const cardB: ConceptMatchCard = {
        key: 'A-lower',
        conceptId: 'A',
        display: 'a',
        speech: 'A',
      };
      expect(isMatch(cardA, cardB)).toBe(true);
    });

    it('returns false when two cards have different conceptIds', () => {
      const cardA: ConceptMatchCard = {
        key: 'A-upper',
        conceptId: 'A',
        display: 'A',
        speech: 'A',
      };
      const cardB: ConceptMatchCard = {
        key: 'B-lower',
        conceptId: 'B',
        display: 'b',
        speech: 'B',
      };
      expect(isMatch(cardA, cardB)).toBe(false);
    });
  });

  describe('buildBoard', () => {
    it('defaults to 2 pairs (4 cards)', () => {
      const rng = makeRng(42);
      const board = buildBoard(rng);
      expect(board).toHaveLength(4);
    });

    it('generates the requested number of pairs', () => {
      const rng = makeRng(123);
      const board = buildBoard(rng, 6);
      expect(board).toHaveLength(12);
    });

    it('generates one uppercase and one lowercase card for each selected letter', () => {
      const rng = makeRng(999);
      const board = buildBoard(rng, 3);
      expect(board).toHaveLength(6);

      // Group cards by conceptId
      const byConcept = new Map<string, ConceptMatchCard[]>();
      for (const card of board) {
        const group = byConcept.get(card.conceptId) ?? [];
        group.push(card);
        byConcept.set(card.conceptId, group);
      }

      expect(byConcept.size).toBe(3);

      for (const [conceptId, cards] of byConcept.entries()) {
        expect(ALPHABET).toContain(conceptId);
        expect(cards).toHaveLength(2);

        const [card1, card2] = cards;
        expect(isMatch(card1, card2)).toBe(true);

        const upper = cards.find((c) => c.display === conceptId);
        const lower = cards.find((c) => c.display === conceptId.toLowerCase());

        expect(upper).toBeDefined();
        expect(lower).toBeDefined();

        expect(upper?.speech).toBe(conceptId);
        expect(lower?.speech).toBe(conceptId);

        expect(upper?.key).toBe(`${conceptId}-upper`);
        expect(lower?.key).toBe(`${conceptId}-lower`);
      }
    });

    it('produces unique keys for every card', () => {
      const rng = makeRng(777);
      const board = buildBoard(rng, 5);
      const keys = board.map((c) => c.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(board.length);
    });

    it('is reproducible with the same RNG seed', () => {
      const board1 = buildBoard(makeRng(12345), 4);
      const board2 = buildBoard(makeRng(12345), 4);
      expect(board1).toEqual(board2);
    });

    it('produces different layouts with different RNG seeds', () => {
      const board1 = buildBoard(makeRng(1), 4);
      const board2 = buildBoard(makeRng(2), 4);
      expect(board1).not.toEqual(board2);
    });

    it('never contains both I and L on the same board (R6 glyph twins)', () => {
      for (let seed = 0; seed < 100; seed++) {
        const board = buildBoard(makeRng(seed), 8);
        const conceptIds = new Set(board.map((c) => c.conceptId));
        expect(conceptIds.has('I') && conceptIds.has('L')).toBe(false);
      }
      for (let seed = 0; seed < 100; seed++) {
        const board = buildBoard(makeRng(seed), 20);
        const conceptIds = new Set(board.map((c) => c.conceptId));
        expect(conceptIds.has('I') && conceptIds.has('L')).toBe(false);
      }
    });
  });
});
