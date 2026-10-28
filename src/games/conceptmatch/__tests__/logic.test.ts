import { describe, expect, it } from "vitest";
import { t, UIKey } from "../../../i18n";
import { hanNumeral, Lang, numberWord } from "../../../lang";
import { makeRng } from "../../../rng";
import { WORDS, wordFor } from "../../../words";
import {
  ALPHABET,
  ANIMALS,
  COLORS,
  ConceptMatchCard,
  ConceptMatchDeck,
  SHAPES,
  buildBoard,
  isMatch,
  updateBoardLang,
  updateCardLang,
} from "../logic";

describe("conceptmatch/logic", () => {
  describe("isMatch", () => {
    it("returns true when two cards share a conceptId", () => {
      const cardA: ConceptMatchCard = {
        key: "A-upper",
        conceptId: "A",
        display: { type: "text", text: "A" },
        speech: "A",
      };
      const cardB: ConceptMatchCard = {
        key: "A-lower",
        conceptId: "A",
        display: { type: "text", text: "a" },
        speech: "A",
      };
      expect(isMatch(cardA, cardB)).toBe(true);
    });

    it("returns false when two cards have different conceptIds", () => {
      const cardA: ConceptMatchCard = {
        key: "A-upper",
        conceptId: "A",
        display: { type: "text", text: "A" },
        speech: "A",
      };
      const cardB: ConceptMatchCard = {
        key: "B-lower",
        conceptId: "B",
        display: { type: "text", text: "b" },
        speech: "B",
      };
      expect(isMatch(cardA, cardB)).toBe(false);
    });

    it("matches across different display variants with the same conceptId", () => {
      const iconCard: ConceptMatchCard = {
        key: "cat-icon",
        conceptId: "cat",
        display: { type: "icon", icon: "cat" },
        speech: "cat",
      };
      const textCard: ConceptMatchCard = {
        key: "cat-word",
        conceptId: "cat",
        display: { type: "text", text: "cat" },
        speech: "cat",
      };
      const audioCard: ConceptMatchCard = {
        key: "cat-audio",
        conceptId: "cat",
        display: { type: "audio" },
        speech: "cat",
      };
      const colorCard: ConceptMatchCard = {
        key: "red-color",
        conceptId: "red",
        display: { type: "color", color: "#ff0000" },
        speech: "red",
      };
      const redTextCard: ConceptMatchCard = {
        key: "red-word",
        conceptId: "red",
        display: { type: "text", text: "red" },
        speech: "red",
      };
      const dotsCard: ConceptMatchCard = {
        key: "red-dots",
        conceptId: "red",
        display: { type: "dots", count: 3 },
        speech: "red",
      };

      expect(isMatch(iconCard, textCard)).toBe(true);
      expect(isMatch(iconCard, audioCard)).toBe(true);
      expect(isMatch(textCard, audioCard)).toBe(true);
      expect(isMatch(colorCard, redTextCard)).toBe(true);
      expect(isMatch(redTextCard, dotsCard)).toBe(true);
      expect(isMatch(iconCard, colorCard)).toBe(false);
    });
  });

  describe("buildBoard", () => {
    describe("letters deck", () => {
      it("defaults to 2 pairs (4 cards)", () => {
        const rng = makeRng(42);
        const board = buildBoard(rng);
        expect(board).toHaveLength(4);
      });

      it("generates the requested number of pairs", () => {
        const rng = makeRng(123);
        const board = buildBoard(rng, "letters", "en", 6);
        expect(board).toHaveLength(12);
      });

      it("generates one uppercase and one lowercase card for each selected letter", () => {
        const rng = makeRng(999);
        const board = buildBoard(rng, "letters", "en", 3);
        expect(board).toHaveLength(6);

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

          const upper = cards.find(
            (c) => c.display.type === "text" && c.display.text === conceptId,
          );
          const lower = cards.find(
            (c) =>
              c.display.type === "text" &&
              c.display.text === conceptId.toLowerCase(),
          );

          expect(upper).toBeDefined();
          expect(lower).toBeDefined();

          expect(upper?.speech).toBe(conceptId);
          expect(lower?.speech).toBe(conceptId);

          expect(upper?.key).toBe(`${conceptId}-upper`);
          expect(lower?.key).toBe(`${conceptId}-lower`);
        }
      });

      it("produces unique keys for every card", () => {
        const rng = makeRng(777);
        const board = buildBoard(rng, "letters", "en", 5);
        const keys = board.map((c) => c.key);
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(board.length);
      });

      it("is reproducible with the same RNG seed", () => {
        const board1 = buildBoard(makeRng(12345), "letters", "en", 4);
        const board2 = buildBoard(makeRng(12345), "letters", "en", 4);
        expect(board1).toEqual(board2);
      });

      it("produces different layouts with different RNG seeds", () => {
        const board1 = buildBoard(makeRng(1), "letters", "en", 4);
        const board2 = buildBoard(makeRng(2), "letters", "en", 4);
        expect(board1).not.toEqual(board2);
      });

      it("never contains both I and L on the same board (R6 glyph twins)", () => {
        for (let seed = 0; seed < 100; seed++) {
          const board = buildBoard(makeRng(seed), "letters", "en", 8);
          const conceptIds = new Set(board.map((c) => c.conceptId));
          expect(conceptIds.has("I") && conceptIds.has("L")).toBe(false);
        }
        for (let seed = 0; seed < 100; seed++) {
          const board = buildBoard(makeRng(seed), "letters", "en", 20);
          const conceptIds = new Set(board.map((c) => c.conceptId));
          expect(conceptIds.has("I") && conceptIds.has("L")).toBe(false);
        }
      });
    });

    describe("picture-word deck", () => {
      it("defaults to 2 pairs (4 cards)", () => {
        const rng = makeRng(42);
        const board = buildBoard(rng, "picture-word");
        expect(board).toHaveLength(4);
      });

      it("generates the requested number of pairs with icon and text display variants", () => {
        const rng = makeRng(321);
        const board = buildBoard(rng, "picture-word", "en", 4);
        expect(board).toHaveLength(8);

        const byConcept = new Map<string, ConceptMatchCard[]>();
        for (const card of board) {
          const group = byConcept.get(card.conceptId) ?? [];
          group.push(card);
          byConcept.set(card.conceptId, group);
        }

        expect(byConcept.size).toBe(4);

        for (const [conceptId, cards] of byConcept.entries()) {
          expect(cards).toHaveLength(2);
          const [card1, card2] = cards;
          expect(isMatch(card1, card2)).toBe(true);

          const entry = WORDS.find((w) => w.icon === conceptId);
          expect(entry).toBeDefined();
          const expectedWord = wordFor(entry!, "en").text;

          const iconCard = cards.find(
            (c) => c.display.type === "icon" && c.display.icon === conceptId,
          );
          const wordCard = cards.find(
            (c) => c.display.type === "text" && c.display.text === expectedWord,
          );

          expect(iconCard).toBeDefined();
          expect(wordCard).toBeDefined();

          expect(iconCard?.key).toBe(`${conceptId}-icon`);
          expect(wordCard?.key).toBe(`${conceptId}-word`);

          expect(iconCard?.speech).toBe(expectedWord);
          expect(wordCard?.speech).toBe(expectedWord);
        }
      });

      it("localizes word display and speech for other languages", () => {
        const rng = makeRng(555);
        const boardJa = buildBoard(rng, "picture-word", "ja", 3);
        expect(boardJa).toHaveLength(6);

        for (const card of boardJa) {
          const entry = WORDS.find((w) => w.icon === card.conceptId)!;
          const expectedWord = wordFor(entry, "ja").text;
          expect(card.speech).toBe(expectedWord);
          if (card.display.type === "text") {
            expect(card.display.text).toBe(expectedWord);
          }
        }
      });

      it("produces unique keys for every card", () => {
        const rng = makeRng(888);
        const board = buildBoard(rng, "picture-word", "en", 6);
        const keys = board.map((c) => c.key);
        expect(new Set(keys).size).toBe(board.length);
      });

      it("never contains name twins on the same board", () => {
        for (let seed = 0; seed < 50; seed++) {
          const board = buildBoard(makeRng(seed), "picture-word", "en", 15);
          const conceptIds = new Set(board.map((c) => c.conceptId));
          expect(conceptIds.has("blossom") && conceptIds.has("sunflower")).toBe(
            false,
          );
        }
      });
    });

    describe("picture-spoken deck", () => {
      it("defaults to 2 pairs (4 cards)", () => {
        const rng = makeRng(100);
        const board = buildBoard(rng, "picture-spoken");
        expect(board).toHaveLength(4);
      });

      it("generates the requested number of pairs with icon and audio display variants", () => {
        const rng = makeRng(456);
        const board = buildBoard(rng, "picture-spoken", "en", 5);
        expect(board).toHaveLength(10);

        const byConcept = new Map<string, ConceptMatchCard[]>();
        for (const card of board) {
          const group = byConcept.get(card.conceptId) ?? [];
          group.push(card);
          byConcept.set(card.conceptId, group);
        }

        expect(byConcept.size).toBe(5);

        for (const [conceptId, cards] of byConcept.entries()) {
          expect(cards).toHaveLength(2);
          const [card1, card2] = cards;
          expect(isMatch(card1, card2)).toBe(true);

          const entry = WORDS.find((w) => w.icon === conceptId);
          expect(entry).toBeDefined();
          const expectedWord = wordFor(entry!, "en").text;

          const iconCard = cards.find(
            (c) => c.display.type === "icon" && c.display.icon === conceptId,
          );
          const audioCard = cards.find((c) => c.display.type === "audio");

          expect(iconCard).toBeDefined();
          expect(audioCard).toBeDefined();
          expect(audioCard?.display).toEqual({ type: "audio" });

          expect(iconCard?.key).toBe(`${conceptId}-icon`);
          expect(audioCard?.key).toBe(`${conceptId}-audio`);

          expect(iconCard?.speech).toBe(expectedWord);
          expect(audioCard?.speech).toBe(expectedWord);
        }
      });

      it("localizes speech for spoken vocabulary deck in Cantonese", () => {
        const rng = makeRng(777);
        const board = buildBoard(rng, "picture-spoken", "yue", 3);
        expect(board).toHaveLength(6);

        for (const card of board) {
          const entry = WORDS.find((w) => w.icon === card.conceptId)!;
          const expectedWord = wordFor(entry, "yue").text;
          expect(card.speech).toBe(expectedWord);
          if (card.display.type === "audio") {
            expect(card.display).toEqual({ type: "audio" });
          }
        }
      });

      it("never contains name twins on the same board", () => {
        for (let seed = 0; seed < 50; seed++) {
          const board = buildBoard(makeRng(seed), "picture-spoken", "en", 15);
          const conceptIds = new Set(board.map((c) => c.conceptId));
          expect(conceptIds.has("blossom") && conceptIds.has("sunflower")).toBe(
            false,
          );
        }
      });
    });

    describe("color-word deck", () => {
      it("defaults to 2 pairs (4 cards)", () => {
        const rng = makeRng(42);
        const board = buildBoard(rng, "color-word");
        expect(board).toHaveLength(4);
      });

      it("generates the requested number of pairs with color and text display variants", () => {
        const rng = makeRng(321);
        const board = buildBoard(rng, "color-word", "en", 4);
        expect(board).toHaveLength(8);

        const byConcept = new Map<string, ConceptMatchCard[]>();
        for (const card of board) {
          const group = byConcept.get(card.conceptId) ?? [];
          group.push(card);
          byConcept.set(card.conceptId, group);
        }

        expect(byConcept.size).toBe(4);

        for (const [conceptId, cards] of byConcept.entries()) {
          expect(cards).toHaveLength(2);
          const [card1, card2] = cards;
          expect(isMatch(card1, card2)).toBe(true);

          const entry = COLORS.find((c) => c.id === conceptId);
          expect(entry).toBeDefined();

          const colorCard = cards.find(
            (c) => c.display.type === "color" && c.display.color === entry!.hex,
          );
          const wordCard = cards.find(
            (c) => c.display.type === "text" && c.display.text === conceptId,
          );

          expect(colorCard).toBeDefined();
          expect(wordCard).toBeDefined();

          expect(colorCard?.key).toBe(`${conceptId}-color`);
          expect(wordCard?.key).toBe(`${conceptId}-word`);

          expect(colorCard?.speech).toBe(conceptId);
          expect(wordCard?.speech).toBe(conceptId);
        }
      });

      it("localizes color word display and speech across all 4 languages", () => {
        const langs: Lang[] = ["en", "ja", "cmn", "yue"];
        for (const lang of langs) {
          const rng = makeRng(555);
          const board = buildBoard(rng, "color-word", lang, 11);
          expect(board).toHaveLength(22);

          for (const card of board) {
            const expectedWord = t(lang, `color.${card.conceptId}` as UIKey);
            expect(card.speech).toBe(expectedWord);
            if (card.display.type === "text") {
              expect(card.display.text).toBe(expectedWord);
            }
          }
        }
      });

      it("translates all 11 colors across all 4 languages without English fallback", () => {
        expect(COLORS).toHaveLength(11);
        for (const color of COLORS) {
          const en = t("en", `color.${color.id}` as UIKey);
          const ja = t("ja", `color.${color.id}` as UIKey);
          const cmn = t("cmn", `color.${color.id}` as UIKey);
          const yue = t("yue", `color.${color.id}` as UIKey);

          expect(en).toBeTruthy();
          expect(ja).toBeTruthy();
          expect(cmn).toBeTruthy();
          expect(yue).toBeTruthy();

          expect(ja).not.toBe(en);
          expect(cmn).not.toBe(en);
          expect(yue).not.toBe(en);
        }
      });

      it("produces unique keys for every card", () => {
        const rng = makeRng(888);
        const board = buildBoard(rng, "color-word", "en", 6);
        const keys = board.map((c) => c.key);
        expect(new Set(keys).size).toBe(board.length);
      });

      it("is reproducible with the same RNG seed", () => {
        const board1 = buildBoard(makeRng(12345), "color-word", "en", 4);
        const board2 = buildBoard(makeRng(12345), "color-word", "en", 4);
        expect(board1).toEqual(board2);
      });

      it("produces different layouts with different RNG seeds", () => {
        const board1 = buildBoard(makeRng(1), "color-word", "en", 4);
        const board2 = buildBoard(makeRng(2), "color-word", "en", 4);
        expect(board1).not.toEqual(board2);
      });
    });

    describe("numerals-han deck", () => {
      it("defaults to 2 pairs (4 cards)", () => {
        const rng = makeRng(42);
        const board = buildBoard(rng, "numerals-han");
        expect(board).toHaveLength(4);
      });

      it("generates the requested number of pairs", () => {
        const rng = makeRng(123);
        const board = buildBoard(rng, "numerals-han", "en", 5);
        expect(board).toHaveLength(10);
      });

      it("generates one Arabic and one Han text card for each chosen number from 1 to 10", () => {
        const rng = makeRng(999);
        const board = buildBoard(rng, "numerals-han", "en", 4);
        expect(board).toHaveLength(8);

        const byConcept = new Map<string, ConceptMatchCard[]>();
        for (const card of board) {
          const group = byConcept.get(card.conceptId) ?? [];
          group.push(card);
          byConcept.set(card.conceptId, group);
        }

        expect(byConcept.size).toBe(4);

        for (const [conceptId, cards] of byConcept.entries()) {
          const n = Number(conceptId);
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(10);
          expect(cards).toHaveLength(2);

          const [card1, card2] = cards;
          expect(isMatch(card1, card2)).toBe(true);

          const arabicCard = cards.find(
            (c) => c.display.type === "text" && c.display.text === String(n),
          );
          const hanCard = cards.find(
            (c) =>
              c.display.type === "text" && c.display.text === hanNumeral(n),
          );

          expect(arabicCard).toBeDefined();
          expect(hanCard).toBeDefined();

          expect(arabicCard?.key).toBe(`${n}-arabic`);
          expect(hanCard?.key).toBe(`${n}-han`);

          expect(arabicCard?.speech).toBe(numberWord("en", n).t);
          expect(hanCard?.speech).toBe(numberWord("en", n).t);
        }
      });

      it("localizes speech across all 4 languages", () => {
        const langs: Lang[] = ["en", "ja", "cmn", "yue"];
        for (const lang of langs) {
          const rng = makeRng(777);
          const board = buildBoard(rng, "numerals-han", lang, 10);
          expect(board).toHaveLength(20);

          for (const card of board) {
            const n = Number(card.conceptId);
            expect(card.speech).toBe(numberWord(lang, n).t);
          }
        }
      });

      it("produces unique keys for every card", () => {
        const rng = makeRng(888);
        const board = buildBoard(rng, "numerals-han", "en", 6);
        const keys = board.map((c) => c.key);
        expect(new Set(keys).size).toBe(board.length);
      });

      it("is reproducible with the same RNG seed", () => {
        const board1 = buildBoard(makeRng(12345), "numerals-han", "en", 4);
        const board2 = buildBoard(makeRng(12345), "numerals-han", "en", 4);
        expect(board1).toEqual(board2);
      });

      it("produces different layouts with different RNG seeds", () => {
        const board1 = buildBoard(makeRng(1), "numerals-han", "en", 4);
        const board2 = buildBoard(makeRng(2), "numerals-han", "en", 4);
        expect(board1).not.toEqual(board2);
      });

      it("caps at 10 pairs when requested pairs exceeds pool size", () => {
        const rng = makeRng(42);
        const board = buildBoard(rng, "numerals-han", "en", 15);
        expect(board).toHaveLength(20);
      });
    });

    describe("numerals-dots deck", () => {
      it("defaults to 2 pairs (4 cards)", () => {
        const rng = makeRng(42);
        const board = buildBoard(rng, "numerals-dots");
        expect(board).toHaveLength(4);
      });

      it("generates the requested number of pairs", () => {
        const rng = makeRng(123);
        const board = buildBoard(rng, "numerals-dots", "en", 4);
        expect(board).toHaveLength(8);
      });

      it("generates one Arabic text card and one dots icon card for each chosen number from 1 to 9", () => {
        const rng = makeRng(999);
        const board = buildBoard(rng, "numerals-dots", "en", 4);
        expect(board).toHaveLength(8);

        const byConcept = new Map<string, ConceptMatchCard[]>();
        for (const card of board) {
          const group = byConcept.get(card.conceptId) ?? [];
          group.push(card);
          byConcept.set(card.conceptId, group);
        }

        expect(byConcept.size).toBe(4);

        for (const [conceptId, cards] of byConcept.entries()) {
          const n = Number(conceptId);
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(9);
          expect(cards).toHaveLength(2);

          const [card1, card2] = cards;
          expect(isMatch(card1, card2)).toBe(true);

          const arabicCard = cards.find(
            (c) => c.display.type === "text" && c.display.text === String(n),
          );
          const dotsCard = cards.find(
            (c) => c.display.type === "dots" && c.display.count === n,
          );

          expect(arabicCard).toBeDefined();
          expect(dotsCard).toBeDefined();

          expect(arabicCard?.key).toBe(`${n}-arabic`);
          expect(dotsCard?.key).toBe(`${n}-dots`);

          expect(arabicCard?.speech).toBe(numberWord("en", n).t);
          expect(dotsCard?.speech).toBe(numberWord("en", n).t);
        }
      });

      it("localizes speech across all 4 languages", () => {
        const langs: Lang[] = ["en", "ja", "cmn", "yue"];
        for (const lang of langs) {
          const rng = makeRng(777);
          const board = buildBoard(rng, "numerals-dots", lang, 9);
          expect(board).toHaveLength(18);

          for (const card of board) {
            const n = Number(card.conceptId);
            expect(card.speech).toBe(numberWord(lang, n).t);
          }
        }
      });

      it("produces unique keys for every card", () => {
        const rng = makeRng(888);
        const board = buildBoard(rng, "numerals-dots", "en", 6);
        const keys = board.map((c) => c.key);
        expect(new Set(keys).size).toBe(board.length);
      });

      it("is reproducible with the same RNG seed", () => {
        const board1 = buildBoard(makeRng(12345), "numerals-dots", "en", 4);
        const board2 = buildBoard(makeRng(12345), "numerals-dots", "en", 4);
        expect(board1).toEqual(board2);
      });

      it("produces different layouts with different RNG seeds", () => {
        const board1 = buildBoard(makeRng(1), "numerals-dots", "en", 4);
        const board2 = buildBoard(makeRng(2), "numerals-dots", "en", 4);
        expect(board1).not.toEqual(board2);
      });

      it("caps at 9 pairs when requested pairs exceeds pool size", () => {
        const rng = makeRng(42);
        const board = buildBoard(rng, "numerals-dots", "en", 15);
        expect(board).toHaveLength(18);
      });
    });

    describe("shapes-objects deck", () => {
      it("defaults to 2 pairs (4 cards)", () => {
        const rng = makeRng(42);
        const board = buildBoard(rng, "shapes-objects");
        expect(board).toHaveLength(4);
      });

      it("pairs circle/clock, square/window, triangle/pizza_slice, and star/starfish", () => {
        expect(SHAPES).toEqual([
          { shape: "circle", object: "clock" },
          { shape: "square", object: "window" },
          { shape: "triangle", object: "pizza_slice" },
          { shape: "star", object: "starfish" },
        ]);
      });

      it("generates the requested number of pairs with shape and object icon display variants", () => {
        const rng = makeRng(123);
        const board = buildBoard(rng, "shapes-objects", "en", 4);
        expect(board).toHaveLength(8);

        const byConcept = new Map<string, ConceptMatchCard[]>();
        for (const card of board) {
          const group = byConcept.get(card.conceptId) ?? [];
          group.push(card);
          byConcept.set(card.conceptId, group);
        }

        expect(byConcept.size).toBe(4);

        for (const [conceptId, cards] of byConcept.entries()) {
          expect(cards).toHaveLength(2);
          const [card1, card2] = cards;
          expect(isMatch(card1, card2)).toBe(true);

          const pair = SHAPES.find((s) => s.shape === conceptId);
          expect(pair).toBeDefined();

          const shapeCard = cards.find(
            (c) => c.display.type === "icon" && c.display.icon === pair!.shape,
          );
          const objectCard = cards.find(
            (c) => c.display.type === "icon" && c.display.icon === pair!.object,
          );

          expect(shapeCard).toBeDefined();
          expect(objectCard).toBeDefined();

          expect(shapeCard?.key).toBe(`${conceptId}-shape`);
          expect(objectCard?.key).toBe(`${conceptId}-object`);

          const expectedSpeech = t("en", `shape.${conceptId}` as UIKey);
          expect(shapeCard?.speech).toBe(expectedSpeech);
          expect(objectCard?.speech).toBe(expectedSpeech);
        }
      });

      it("localizes shape speech across all 4 languages", () => {
        const langs: Lang[] = ["en", "ja", "cmn", "yue"];
        for (const lang of langs) {
          const rng = makeRng(555);
          const board = buildBoard(rng, "shapes-objects", lang, 4);
          expect(board).toHaveLength(8);

          for (const card of board) {
            const expectedSpeech = t(lang, `shape.${card.conceptId}` as UIKey);
            expect(card.speech).toBe(expectedSpeech);
          }
        }
      });

      it("translates all 4 shapes across all 4 languages without English fallback", () => {
        expect(SHAPES).toHaveLength(4);
        for (const shape of SHAPES) {
          const en = t("en", `shape.${shape.shape}` as UIKey);
          const ja = t("ja", `shape.${shape.shape}` as UIKey);
          const cmn = t("cmn", `shape.${shape.shape}` as UIKey);
          const yue = t("yue", `shape.${shape.shape}` as UIKey);

          expect(en).toBeTruthy();
          expect(ja).toBeTruthy();
          expect(cmn).toBeTruthy();
          expect(yue).toBeTruthy();

          expect(ja).not.toBe(en);
          expect(cmn).not.toBe(en);
          expect(yue).not.toBe(en);
        }
      });

      it("produces unique keys for every card", () => {
        const rng = makeRng(888);
        const board = buildBoard(rng, "shapes-objects", "en", 4);
        const keys = board.map((c) => c.key);
        expect(new Set(keys).size).toBe(board.length);
      });

      it("is reproducible with the same RNG seed", () => {
        const board1 = buildBoard(makeRng(12345), "shapes-objects", "en", 3);
        const board2 = buildBoard(makeRng(12345), "shapes-objects", "en", 3);
        expect(board1).toEqual(board2);
      });

      it("produces different layouts with different RNG seeds", () => {
        const board1 = buildBoard(makeRng(1), "shapes-objects", "en", 3);
        const board2 = buildBoard(makeRng(2), "shapes-objects", "en", 3);
        expect(board1).not.toEqual(board2);
      });

      it("caps at 4 pairs when requested pairs exceeds pool size", () => {
        const rng = makeRng(42);
        const board = buildBoard(rng, "shapes-objects", "en", 10);
        expect(board).toHaveLength(8);
      });
    });

    describe("animals-sounds deck", () => {
      it("defaults to 2 pairs (4 cards)", () => {
        const rng = makeRng(42);
        const board = buildBoard(rng, "animals-sounds");
        expect(board).toHaveLength(4);
      });

      it("generates the requested number of pairs with animal icon and audio display variants", () => {
        const rng = makeRng(100);
        const board = buildBoard(rng, "animals-sounds", "en", 3);
        expect(board).toHaveLength(6);

        const byConcept = new Map<string, ConceptMatchCard[]>();
        for (const card of board) {
          const list = byConcept.get(card.conceptId) ?? [];
          list.push(card);
          byConcept.set(card.conceptId, list);
        }

        expect(byConcept.size).toBe(3);
        for (const [conceptId, cards] of byConcept.entries()) {
          expect(cards).toHaveLength(2);
          const [card1, card2] = cards;
          expect(isMatch(card1, card2)).toBe(true);
          expect(ANIMALS).toContain(conceptId);

          const entry = WORDS.find((w) => w.icon === conceptId)!;
          const expectedName = wordFor(entry, "en").text;
          const expectedSound = t("en", `sound.${conceptId}` as UIKey);

          const iconCard = cards.find(
            (c) => c.display.type === "icon" && c.display.icon === conceptId,
          );
          const audioCard = cards.find((c) => c.display.type === "audio");

          expect(iconCard).toBeDefined();
          expect(audioCard).toBeDefined();
          expect(iconCard?.key).toBe(`${conceptId}-icon`);
          expect(audioCard?.key).toBe(`${conceptId}-sound`);
          expect(iconCard?.speech).toBe(expectedName);
          expect(audioCard?.speech).toBe(expectedSound);
          expect(audioCard?.display).toEqual({
            type: "audio",
            text: expectedSound,
          });
        }
      });

      it("localizes animal name and sound speech across all 4 languages", () => {
        const langs: Lang[] = ["en", "ja", "cmn", "yue"];
        for (const lang of langs) {
          const rng = makeRng(42);
          const board = buildBoard(rng, "animals-sounds", lang, 2);
          for (const card of board) {
            const entry = WORDS.find((w) => w.icon === card.conceptId)!;
            const expectedName = wordFor(entry, lang).text;
            const expectedSound = t(lang, `sound.${card.conceptId}` as UIKey);

            if (card.display.type === "icon") {
              expect(card.speech).toBe(expectedName);
            } else if (card.display.type === "audio") {
              expect(card.speech).toBe(expectedSound);
              expect(card.display.text).toBe(expectedSound);
            }
          }
        }
      });

      it("translates all 5 animal sounds across all 4 languages without English fallback", () => {
        expect(ANIMALS).toHaveLength(5);
        for (const animal of ANIMALS) {
          const en = t("en", `sound.${animal}` as UIKey);
          const ja = t("ja", `sound.${animal}` as UIKey);
          const cmn = t("cmn", `sound.${animal}` as UIKey);
          const yue = t("yue", `sound.${animal}` as UIKey);

          expect(en).toBeTruthy();
          expect(ja).toBeTruthy();
          expect(cmn).toBeTruthy();
          expect(yue).toBeTruthy();

          expect(ja).not.toBe(en);
          expect(cmn).not.toBe(en);
          expect(yue).not.toBe(en);
        }
      });

      it("produces unique keys for every card", () => {
        const rng = makeRng(888);
        const board = buildBoard(rng, "animals-sounds", "en", 5);
        const keys = board.map((c) => c.key);
        expect(new Set(keys).size).toBe(board.length);
      });

      it("is reproducible with the same RNG seed", () => {
        const board1 = buildBoard(makeRng(12345), "animals-sounds", "en", 3);
        const board2 = buildBoard(makeRng(12345), "animals-sounds", "en", 3);
        expect(board1).toEqual(board2);
      });

      it("produces different layouts with different RNG seeds", () => {
        const board1 = buildBoard(makeRng(1), "animals-sounds", "en", 3);
        const board2 = buildBoard(makeRng(2), "animals-sounds", "en", 3);
        expect(board1).not.toEqual(board2);
      });

      it("satisfies R3 by including visual onomatopoeia text on audio sound cards", () => {
        const board = buildBoard(makeRng(1), "animals-sounds", "en", 5);
        const audioCards = board.filter((c) => c.display.type === "audio");
        expect(audioCards).toHaveLength(5);
        for (const card of audioCards) {
          if (card.display.type === "audio") {
            expect(card.display.text).toBeTruthy();
            expect(card.display.text).toBe(card.speech);
          }
        }
      });

      it("caps at 5 pairs when requested pairs exceeds pool size", () => {
        const rng = makeRng(42);
        const board = buildBoard(rng, "animals-sounds", "en", 10);
        expect(board).toHaveLength(10);
      });
    });

    describe("mixed deck", () => {
      it("defaults to 2 pairs (4 cards)", () => {
        const rng = makeRng(42);
        const board = buildBoard(rng, "mixed");
        expect(board).toHaveLength(4);
      });

      it("returns 12 cards drawn from multiple decks for 6 pairs", () => {
        const rng = makeRng(123);
        const board = buildBoard(rng, "mixed", "en", 6);
        expect(board).toHaveLength(12);

        const displays = new Set(board.map((c) => c.display.type));
        // Mixed deck should contain a mixture of display types (e.g. text, icon, color)
        expect(displays.size).toBeGreaterThan(1);
      });

      it("contains a mixture of letters, vocabulary, and color pairs", () => {
        const rng = makeRng(77);
        const board = buildBoard(rng, "mixed", "en", 6);

        // Check that pairs belong to at least 2 distinct decks
        const hasLetter = board.some((c) => ALPHABET.includes(c.conceptId));
        const hasColor = board.some((c) =>
          COLORS.some((color) => color.id === c.conceptId),
        );
        const hasWord = board.some((c) =>
          WORDS.some((w) => w.icon === c.conceptId),
        );

        // For 6 pairs across 4 subdecks, at least 2 of these categories must be present
        const categoriesPresent = [hasLetter, hasColor, hasWord].filter(
          Boolean,
        ).length;
        expect(categoriesPresent).toBeGreaterThanOrEqual(2);
      });

      it("produces exactly 2 matching cards for each conceptId", () => {
        const rng = makeRng(555);
        const board = buildBoard(rng, "mixed", "en", 6);
        const counts = new Map<string, number>();
        for (const card of board) {
          counts.set(card.conceptId, (counts.get(card.conceptId) ?? 0) + 1);
        }
        for (const count of counts.values()) {
          expect(count).toBe(2);
        }
      });

      it("is reproducible with the same RNG seed", () => {
        const board1 = buildBoard(makeRng(999), "mixed", "en", 6);
        const board2 = buildBoard(makeRng(999), "mixed", "en", 6);
        expect(board1).toEqual(board2);
      });

      it("produces different layouts with different RNG seeds", () => {
        const board1 = buildBoard(makeRng(1), "mixed", "en", 6);
        const board2 = buildBoard(makeRng(2), "mixed", "en", 6);
        expect(board1).not.toEqual(board2);
      });

      it("produces unique keys for every card across multiple seeds", () => {
        for (let seed = 0; seed < 100; seed++) {
          const board = buildBoard(makeRng(seed), "mixed", "en", 6);
          const keys = board.map((c) => c.key);
          const uniqueKeys = new Set(keys);
          expect(uniqueKeys.size).toBe(board.length);
        }
      });
    });

    it("throws for unsupported decks", () => {
      const rng = makeRng(1);
      expect(() =>
        buildBoard(rng, "unsupported" as unknown as ConceptMatchDeck),
      ).toThrow("Unsupported deck: unsupported");
    });
  });

  describe("updateBoardLang", () => {
    it("updates text and speech for color-word deck", () => {
      const card: ConceptMatchCard = {
        key: "red-word",
        conceptId: "red",
        display: { type: "text", text: "red" },
        speech: "red",
      };
      const updated = updateCardLang(card, "color-word", "ja");
      expect(updated.speech).toBe("あか");
      expect(updated.display).toEqual({ type: "text", text: "あか" });
    });

    it("updates speech for color swatch card in color-word deck", () => {
      const card: ConceptMatchCard = {
        key: "red-color",
        conceptId: "red",
        display: { type: "color", color: "#E53935" },
        speech: "red",
      };
      const updated = updateCardLang(card, "color-word", "ja");
      expect(updated.speech).toBe("あか");
      expect(updated.display).toEqual({ type: "color", color: "#E53935" });
    });

    it("updates text and speech for picture-word deck", () => {
      const card: ConceptMatchCard = {
        key: "apple-word",
        conceptId: "apple",
        display: { type: "text", text: "apple" },
        speech: "apple",
      };
      const updated = updateCardLang(card, "picture-word", "ja");
      expect(updated.speech).toBe("りんご");
      expect(updated.display).toEqual({ type: "text", text: "りんご" });
    });

    it("updates speech for numerals deck", () => {
      const card: ConceptMatchCard = {
        key: "3-arabic",
        conceptId: "3",
        display: { type: "text", text: "3" },
        speech: "three",
      };
      const updated = updateCardLang(card, "numerals-han", "ja");
      expect(updated.speech).toBe("さん");
    });

    it("updates speech for shapes-objects deck", () => {
      const card: ConceptMatchCard = {
        key: "circle-shape",
        conceptId: "circle",
        display: { type: "icon", icon: "circle" },
        speech: "circle",
      };
      const updated = updateCardLang(card, "shapes-objects", "ja");
      expect(updated.speech).toBe("まる");
    });

    it("updates sound text and speech for animals-sounds deck", () => {
      const soundCard: ConceptMatchCard = {
        key: "dog-sound",
        conceptId: "dog",
        display: { type: "audio", text: "woof" },
        speech: "woof",
      };
      const updatedSound = updateCardLang(soundCard, "animals-sounds", "ja");
      expect(updatedSound.speech).toBe("わんわん");
      expect(updatedSound.display).toEqual({ type: "audio", text: "わんわん" });

      const animalCard: ConceptMatchCard = {
        key: "dog-icon",
        conceptId: "dog",
        display: { type: "icon", icon: "dog" },
        speech: "dog",
      };
      const updatedAnimal = updateCardLang(animalCard, "animals-sounds", "ja");
      expect(updatedAnimal.speech).toBe("いぬ");
    });

    it("maps over entire board with updateBoardLang", () => {
      const board = buildBoard(makeRng(1), "color-word", "en", 2);
      const updated = updateBoardLang(board, "color-word", "ja");
      expect(updated).toHaveLength(board.length);
      for (const card of updated) {
        if (card.display.type === "text") {
          expect(
            /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(card.display.text),
          ).toBe(true);
        }
      }
    });

    it("throws when word entry is missing for picture-word deck", () => {
      const card: ConceptMatchCard = {
        key: "unknown-word",
        conceptId: "nonexistent_concept",
        display: { type: "text", text: "unknown" },
        speech: "unknown",
      };
      expect(() => updateCardLang(card, "picture-word", "ja")).toThrow(
        "Word entry not found for concept: nonexistent_concept",
      );
    });

    it("throws when numeral conceptId is not a valid number", () => {
      const card: ConceptMatchCard = {
        key: "invalid-arabic",
        conceptId: "not-a-number",
        display: { type: "text", text: "NaN" },
        speech: "NaN",
      };
      expect(() => updateCardLang(card, "numerals-han", "ja")).toThrow(
        "Invalid numeral concept ID: not-a-number",
      );
    });

    it("throws when animal word entry is missing for animals-sounds deck", () => {
      const animalCard: ConceptMatchCard = {
        key: "unknown-icon",
        conceptId: "nonexistent_animal",
        display: { type: "icon", icon: "nonexistent_animal" },
        speech: "unknown",
      };
      expect(() => updateCardLang(animalCard, "animals-sounds", "ja")).toThrow(
        "Word entry not found for animal concept: nonexistent_animal",
      );
    });

    it("updates color and word cards while preserving letters in mixed deck", () => {
      const board = buildBoard(makeRng(123), "mixed", "en", 6);
      const updated = updateBoardLang(board, "mixed", "ja");
      expect(updated).toHaveLength(board.length);

      for (let i = 0; i < board.length; i++) {
        const original = board[i];
        const card = updated[i];
        if (ALPHABET.includes(card.conceptId)) {
          expect(card.speech).toBe(original.speech);
          expect(card.display).toEqual(original.display);
        } else if (COLORS.some((c) => c.id === card.conceptId)) {
          const expectedWord = t("ja", `color.${card.conceptId}` as UIKey);
          expect(card.speech).toBe(expectedWord);
          if (card.display.type === "text") {
            expect(card.display.text).toBe(expectedWord);
          }
        } else if (WORDS.some((w) => w.icon === card.conceptId)) {
          const entry = WORDS.find((w) => w.icon === card.conceptId)!;
          const expectedWord = wordFor(entry, "ja").text;
          expect(card.speech).toBe(expectedWord);
          if (card.display.type === "text") {
            expect(card.display.text).toBe(expectedWord);
          }
        }
      }
    });
  });
});
