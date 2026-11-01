import { describe, expect, it } from "vitest";
import { manifest, Story, StoryNode } from "../../../manifest";
import {
  filterStoriesByLang,
  isOopsieEnding,
  normalizeStoryNode,
} from "../logic";

describe("StoryGame logic: filterStoriesByLang", () => {
  const sampleStories: Story[] = [
    {
      id: "fully-translated",
      title: "Full Story",
      titleT: { ja: "完全", cmn: "完全", yue: "完全" },
      nodes: {},
    },
    {
      id: "ja-only",
      title: "Japanese Only",
      titleT: { ja: "日本語のみ" },
      nodes: {},
    },
    {
      id: "cmn-only",
      title: "Mandarin Only",
      titleT: { cmn: "普通话" },
      nodes: {},
    },
    {
      id: "whitespace-title",
      title: "Whitespace",
      titleT: { ja: "   " },
      nodes: {},
    },
    {
      id: "untranslated",
      title: "Untranslated",
      nodes: {},
    },
  ];

  it("retains all stories for English", () => {
    const filtered = filterStoriesByLang(sampleStories, "en");
    expect(filtered.map((s) => s.id)).toEqual([
      "fully-translated",
      "ja-only",
      "cmn-only",
      "whitespace-title",
      "untranslated",
    ]);
  });

  it("filters out stories lacking translations for non-English languages", () => {
    expect(filterStoriesByLang(sampleStories, "ja").map((s) => s.id)).toEqual([
      "fully-translated",
      "ja-only",
    ]);
    expect(filterStoriesByLang(sampleStories, "cmn").map((s) => s.id)).toEqual([
      "fully-translated",
      "cmn-only",
    ]);
    expect(filterStoriesByLang(sampleStories, "yue").map((s) => s.id)).toEqual([
      "fully-translated",
    ]);
  });

  it("handles empty stories array", () => {
    expect(filterStoriesByLang([], "ja")).toEqual([]);
    expect(filterStoriesByLang([], "en")).toEqual([]);
  });

  it("ensures every story retained in non-English modes has a non-empty title translation", () => {
    const stories = manifest.stories ?? [];
    for (const lang of ["ja", "cmn", "yue"] as const) {
      const filtered = filterStoriesByLang(stories, lang);
      expect(filtered.every((s) => Boolean(s.titleT?.[lang]?.trim()))).toBe(
        true,
      );
    }
  });
});

describe("StoryGame logic: isOopsieEnding and normalizeStoryNode", () => {
  it("identifies oopsie endings without false positives on words like swoops or loop-the-loops", () => {
    // True oopsie endings
    expect(isOopsieEnding("Oopsie ending!")).toBe(true);
    expect(
      isOopsieEnding("Milo dives into the soy barrel. Oopsie ending!"),
    ).toBe(true);
    expect(isOopsieEnding("Oops! That path was blocked.")).toBe(true);
    expect(isOopsieEnding("wheee, oops — and lands on a cushion")).toBe(true);
    expect(isOopsieEnding("A bunch of oopsies happened")).toBe(true);

    // Words containing "oops" as substrings must NOT trigger false positives
    expect(isOopsieEnding("The owl swoops overhead! The End!")).toBe(false);
    expect(
      isOopsieEnding("The baby comet swooped into her arms! The End!"),
    ).toBe(false);
    expect(
      isOopsieEnding(
        "The dragonfly did loop-the-loops above the crowd! The End!",
      ),
    ).toBe(false);
    expect(
      isOopsieEnding("Luna flies all the way home, loop-de-loop! The End!"),
    ).toBe(false);
    expect(isOopsieEnding("They had a blast at the chicken coop!")).toBe(false);

    // Null, undefined, empty string
    expect(isOopsieEnding("")).toBe(false);
    expect(isOopsieEnding(null)).toBe(false);
    expect(isOopsieEnding(undefined)).toBe(false);
  });

  it("evaluates StoryNode objects for oopsie ending detection", () => {
    const oopsNode: StoryNode = {
      image: "story/test.jpg",
      text: "Down into the puddle! Oopsie ending!",
      choices: [],
    };
    expect(isOopsieEnding(oopsNode)).toBe(true);

    const badExplicitNode: StoryNode = {
      image: "story/test.jpg",
      text: "Blocked cave with no exit.",
      bad: true,
      choices: [],
    };
    expect(isOopsieEnding(badExplicitNode)).toBe(true);

    // Non-ending node with choices is not an ending even if text contains oops
    const intermediateNode: StoryNode = {
      image: "story/test.jpg",
      text: "Oops! Which door should we try?",
      choices: [{ label: "Left door", next: "left" }],
    };
    expect(isOopsieEnding(intermediateNode)).toBe(false);

    // Happy ending node without oops
    const happyNode: StoryNode = {
      image: "story/test.jpg",
      text: "They lived happily ever after! The End!",
      choices: [],
    };
    expect(isOopsieEnding(happyNode)).toBe(false);

    // Ending with "swoops" or "loop-the-loops"
    const swoopNode: StoryNode = {
      image: "story/test.jpg",
      text: "The owl swoops overhead! The End!",
      choices: [],
    };
    expect(isOopsieEnding(swoopNode)).toBe(false);

    const loopNode: StoryNode = {
      image: "story/test.jpg",
      text: "Pip did loop-the-loops above the crowd! The End!",
      choices: [],
    };
    expect(isOopsieEnding(loopNode)).toBe(false);
  });

  it("normalizes oopsie ending nodes to set bad=true while leaving happy endings intact", () => {
    const rawOopsNode: StoryNode = {
      image: "story/test.jpg",
      text: "SKIDDDD — SPLOOOOSH! Milo dives into soy barrel. Oopsie ending!",
      choices: [],
    };
    const normalized = normalizeStoryNode(rawOopsNode);
    expect(normalized.bad).toBe(true);
    expect(normalized.text).toBe(rawOopsNode.text);

    // Already bad node preserves bad=true and returns same reference
    const alreadyBadNode: StoryNode = {
      image: "story/test.jpg",
      text: "Already bad ending",
      bad: true,
      choices: [],
    };
    expect(normalizeStoryNode(alreadyBadNode)).toBe(alreadyBadNode);

    // Happy ending without bad flag remains unchanged
    const happyNode: StoryNode = {
      image: "story/test.jpg",
      text: "The dragon-child gives the melon back. The End!",
      choices: [],
    };
    expect(normalizeStoryNode(happyNode).bad).toBeUndefined();
    expect(normalizeStoryNode(happyNode)).toBe(happyNode);

    // Nodes with swoops or loop-the-loops remain unchanged
    const swoopNode: StoryNode = {
      image: "story/test.jpg",
      text: "The owl swoops overhead! The End!",
      choices: [],
    };
    expect(normalizeStoryNode(swoopNode).bad).toBeUndefined();

    // Repeated normalization returns cached identical reference
    const firstCall = normalizeStoryNode(rawOopsNode);
    const secondCall = normalizeStoryNode(rawOopsNode);
    expect(firstCall).toBe(secondCall);

    // Null and undefined pass through safely
    expect(normalizeStoryNode(null)).toBeNull();
    expect(normalizeStoryNode(undefined)).toBeUndefined();
  });

  it("correctly marks real manifest oopsie ending branches as bad=true", () => {
    const stories = manifest.stories ?? [];
    const nightStory = stories.find((s) => s.id === "night");
    expect(nightStory).toBeDefined();

    // night's end_soy_barrel omits bad in raw manifest
    const soyBarrelRaw = nightStory!.nodes["end_soy_barrel"];
    expect(soyBarrelRaw).toBeDefined();
    expect(soyBarrelRaw.bad).toBeUndefined();
    expect(soyBarrelRaw.text).toContain("Oopsie ending!");

    // normalizeStoryNode marks it as bad=true
    const soyBarrelNorm = normalizeStoryNode(soyBarrelRaw);
    expect(soyBarrelNorm.bad).toBe(true);

    // night's end_court_confetti is a genuine happy ending
    const confettiRaw = nightStory!.nodes["end_court_confetti"];
    expect(confettiRaw).toBeDefined();
    expect(confettiRaw.bad).toBeUndefined();
    expect(normalizeStoryNode(confettiRaw).bad).toBeUndefined();
  });
});
