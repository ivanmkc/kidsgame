import { describe, it, expect } from "vitest";
import { formatScore } from "./format";

describe("formatScore", () => {
  it("formats the score correctly", () => {
    expect(formatScore(3, 10)).toBe("⭐ 3/10");
    expect(formatScore(0, 5)).toBe("⭐ 0/5");
  });
});
