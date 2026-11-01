import { describe, expect, it } from "vitest";
import {
  advance,
  currentRound,
  isComplete,
  nextPack,
  progress,
  speechLines,
  startState,
  toGap,
  toReveal,
  handleTap,
  handleTapTimeout,
} from "../logic";
import { ALL_PACKS, PACK_ORDER, PackId } from "../packs";

describe("round engine", () => {
  it("starts at round 0 in prompt phase", () => {
    const s = startState("boops", 42);
    expect(s.roundIdx).toBe(0);
    expect(s.phase).toBe("prompt");
    expect(s.pack).toBe("boops");
  });

  it("transitions prompt → gap → reveal → advance", () => {
    let s = startState("rhyme", 1);
    expect(s.phase).toBe("prompt");

    s = toGap(s);
    expect(s.phase).toBe("gap");

    s = toReveal(s);
    expect(s.phase).toBe("reveal");

    const r1 = currentRound(s);
    s = advance(s);
    expect(s.phase).toBe("prompt");
    expect(s.roundIdx).toBe(1);
    const r2 = currentRound(s);
    expect(r2).not.toBeNull();
    expect(r2!.id).not.toBe(r1!.id);
  });

  it("completes after the last round", () => {
    let s = startState("boops", 7);
    while (!isComplete(s)) {
      s = toGap(s);
      s = toReveal(s);
      s = advance(s);
    }
    expect(s.phase).toBe("done");
    expect(currentRound(s)).toBeNull();
  });

  it("progress tracks correctly", () => {
    const s = startState("rhyme", 1);
    expect(progress(s)).toBe(0);
    let s2 = s;
    for (let i = 0; i < 5; i++) {
      s2 = toGap(s2);
      s2 = toReveal(s2);
      s2 = advance(s2);
    }
    expect(progress(s2)).toBeGreaterThan(0);
  });

  it("nextPack cycles through all packs", () => {
    let p: PackId = "boops";
    const visited: PackId[] = [p];
    for (let i = 0; i < PACK_ORDER.length; i++) {
      p = nextPack(p);
      visited.push(p);
    }
    expect(visited[visited.length - 1]).toBe("boops");
    expect(new Set(visited).size).toBe(PACK_ORDER.length);
  });
});

describe("pack data integrity", () => {
  for (const packId of PACK_ORDER) {
    describe(packId, () => {
      const rounds = ALL_PACKS[packId].rounds();

      it("has at least 4 rounds", () => {
        expect(rounds.length).toBeGreaterThanOrEqual(4);
      });

      it("every round has prompt and reveal", () => {
        for (const r of rounds) {
          expect(r.prompt.length).toBeGreaterThan(0);
          expect(r.reveal.length).toBeGreaterThan(0);
          expect(r.gapMs).toBeGreaterThan(0);
          expect(r.pack).toBe(packId);
          expect(r.id).toBeTruthy();
        }
      });

      it("round ids are unique", () => {
        const ids = rounds.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
      });
    });
  }
});

describe("simon pack specifics", () => {
  const rounds = ALL_PACKS.simon.rounds();

  it("trick rounds have positive reinforcement reveal and good sfx", () => {
    const trickRounds = rounds.filter((r) => r.id.startsWith("simon-trick-"));
    expect(trickRounds.length).toBeGreaterThan(0);
    for (const r of trickRounds) {
      expect(r.reveal).toEqual([
        "I hope you stayed still! I didn't say Simon says!",
      ]);
      expect(r.sfx).toBe("good");
    }
  });
});

describe("boops pack specifics", () => {
  const rounds = ALL_PACKS.boops.rounds();

  it("noteCount matches the claimed number in the reveal", () => {
    for (const r of rounds) {
      expect(r.noteCount).toBeDefined();
      expect(r.noteCount).toBeGreaterThan(0);
      expect(r.noteCount).toBeLessThanOrEqual(10);
      expect(r.reveal[0]).toContain(String(r.noteCount));
    }
  });

  it("uses singular phrasing for round 1", () => {
    const round1 = rounds.find((r) => r.id === "boops-1");
    expect(round1).toBeDefined();
    expect(round1?.reveal).toEqual(["1! There was 1 boop!"]);
  });

  it("uses plural phrasing for rounds with more than 1 boop", () => {
    for (const r of rounds) {
      if (r.noteCount && r.noteCount > 1) {
        expect(r.reveal).toEqual([
          `${r.noteCount}! There were ${r.noteCount} boops!`,
        ]);
      }
    }
  });
});

describe("silly pack specifics", () => {
  const rounds = ALL_PACKS.silly.rounds();

  it("has twoTapAnswer flag on every round", () => {
    for (const r of rounds) {
      expect(r.twoTapAnswer).toBe(true);
    }
  });

  it("has answer boolean matching silly/true", () => {
    for (const r of rounds) {
      expect(typeof r.answer).toBe("boolean");
    }
  });
});

describe("whoami pack specifics", () => {
  const rounds = ALL_PACKS.whoami.rounds();

  it("snail riddle includes a distinguishing clue not shared by a turtle", () => {
    const snailRound = rounds.find((r) => r.reveal.includes("A snail!"));
    expect(snailRound).toBeDefined();
    expect(snailRound!.prompt).toContain(
      "I leave a shiny silver trail wherever I go.",
    );
  });

  it("reveals creature types rather than character names for all riddles", () => {
    const characterNames = [
      "LUNA!",
      "PIP!",
      "MILO!",
      "MO!",
      "NOVA!",
      "REX!",
      "WILLOW!",
      "PEARL!",
    ];
    for (const r of rounds) {
      for (const name of characterNames) {
        expect(r.reveal).not.toContain(name);
      }
      expect(r.reveal[0]).toMatch(/^A(n)? [A-Za-z ]+!$/);
    }
  });

  it("medium and hard riddles do not state the creature type directly in clues", () => {
    const directStatements = [
      "I am a sparkly unicorn",
      "I am a little puppy",
      "I am a little black kitten",
      "I am a fluffy mint monster",
      "I am a brave fox knight",
      "I am a big friendly dinosaur",
      "I am a wise little owl",
      "I am a beautiful sea dragon",
    ];
    for (const r of rounds) {
      const fullPrompt = r.prompt.join(" ");
      for (const statement of directStatements) {
        expect(fullPrompt).not.toContain(statement);
      }
    }
  });

  it("includes expected creature answers for medium and hard difficulty", () => {
    const hardState = startState("whoami", 42, "hard");
    const hardAnswers = hardState.rounds.map((r) => r.reveal[0]);
    expect(hardAnswers).toEqual(
      expect.arrayContaining([
        "A unicorn!",
        "A puppy!",
        "A kitten!",
        "A monster!",
        "A fox!",
        "A sea dragon!",
      ]),
    );

    const mediumState = startState("whoami", 42, "medium");
    const mediumAnswers = mediumState.rounds.map((r) => r.reveal[0]);
    expect(mediumAnswers).toEqual(
      expect.arrayContaining([
        "A dinosaur!",
        "An owl!",
        "A snail!",
        "A flamingo!",
      ]),
    );
  });
});

describe("speechLines", () => {
  it("returns >50 lines", () => {
    const lines = speechLines();
    expect(lines.length).toBeGreaterThan(50);
  });

  it("includes lines from every pack", () => {
    const lines = new Set(speechLines());
    for (const packId of PACK_ORDER) {
      const rounds = ALL_PACKS[packId].rounds();
      const firstPrompt = rounds[0].prompt[0];
      expect(lines.has(firstPrompt)).toBe(true);
    }
  });

  it("has no empty strings", () => {
    for (const line of speechLines()) {
      expect(line.length).toBeGreaterThan(0);
    }
  });
});

describe("handleTap pure transitions", () => {
  it("gap phase single tap starts pending state if twoTapAnswer", () => {
    let s = startState("silly", 42); // silly pack has twoTapAnswer
    s = toGap(s);
    const next = handleTap(s);
    expect(next.pendingTaps).toBe(1);
    expect(next.phase).toBe("gap");
  });

  it("gap phase single tap transitions to reveal for standard packs", () => {
    let s = startState("rhyme", 42);
    s = toGap(s);
    const next = handleTap(s);
    expect(next.phase).toBe("reveal");
    expect(next.pendingTaps).toBe(0);
  });

  it("gap phase double tap transitions immediately if twoTapAnswer", () => {
    let s = startState("silly", 42);
    s = toGap(s);
    s.pendingTaps = 1; // Simulate one tap already happened
    const next = handleTap(s);
    expect(next.phase).toBe("reveal");
    expect(next.pendingTaps).toBe(0);
  });

  it("reveal phase single tap advances immediately even if twoTapAnswer", () => {
    let s = startState("silly", 42);
    s = toReveal(s);
    const next = handleTap(s);
    expect(next.phase).toBe("prompt");
    expect(next.pendingTaps).toBe(0);
    expect(next.roundIdx).toBe(1);
  });
});

describe("handleTapTimeout pure transitions", () => {
  it("transitions to reveal from gap on timeout", () => {
    let s = startState("silly", 42);
    s = toGap(s);
    s.pendingTaps = 1;
    const next = handleTapTimeout(s);
    expect(next.phase).toBe("reveal");
    expect(next.pendingTaps).toBe(0);
  });

  it("advances from reveal on timeout", () => {
    let s = startState("silly", 42);
    s = toReveal(s);
    s.pendingTaps = 1;
    const next = handleTapTimeout(s);
    expect(next.phase).toBe("prompt");
    expect(next.pendingTaps).toBe(0);
  });
});

describe("difficulty filter in startState", () => {
  it("limits boops to 1-3 on easy", () => {
    const s = startState("boops", 42, "easy");
    expect(s.rounds.length).toBe(3);
    for (const r of s.rounds) {
      expect(r.noteCount).toBeLessThanOrEqual(3);
    }
  });

  it("limits boops to 4-6 on medium", () => {
    const s = startState("boops", 42, "medium");
    expect(s.rounds.length).toBe(3);
    for (const r of s.rounds) {
      expect(r.noteCount).toBeGreaterThanOrEqual(4);
      expect(r.noteCount).toBeLessThanOrEqual(6);
    }
  });

  it("limits boops to 7-10 on hard", () => {
    const s = startState("boops", 42, "hard");
    expect(s.rounds.length).toBe(4);
    for (const r of s.rounds) {
      expect(r.noteCount).toBeGreaterThanOrEqual(7);
      expect(r.noteCount).toBeLessThanOrEqual(10);
    }
  });

  it("includes all 10 boops when difficulty is all", () => {
    const s = startState("boops", 42, "all");
    expect(s.rounds.length).toBe(10);
  });

  it("filters silly pack by easy level", () => {
    const allRounds = ALL_PACKS.silly.rounds();
    const s = startState("silly", 42, "easy");
    const expectedLength = allRounds.filter((r) => r.level === "easy").length;
    expect(s.rounds.length).toBe(expectedLength);
  });

  it("filters silly pack by medium level", () => {
    const allRounds = ALL_PACKS.silly.rounds();
    const s = startState("silly", 42, "medium");
    const expectedLength = allRounds.filter((r) => r.level === "medium").length;
    expect(s.rounds.length).toBe(expectedLength);
  });

  it("filters silly pack by hard level", () => {
    const allRounds = ALL_PACKS.silly.rounds();
    const s = startState("silly", 42, "hard");
    const expectedLength = allRounds.filter((r) => r.level === "hard").length;
    expect(s.rounds.length).toBe(expectedLength);
  });

  it("includes all silly rounds when difficulty is all", () => {
    const allRounds = ALL_PACKS.silly.rounds();
    const s = startState("silly", 42, "all");
    expect(s.rounds.length).toBe(allRounds.length);
  });

  it("gap phase tap advances to reveal for standard packs", () => {
    let s = startState("boops", 42);
    s = toGap(s);
    const next = handleTap(s);
    expect(next.phase).toBe("reveal");
  });
});
