import { describe, expect, it } from "vitest";
import { mismatchDelay } from "../logic";

describe("mismatchDelay", () => {
  it("returns 1500 for easy", () => {
    expect(mismatchDelay("easy")).toBe(1500);
  });
  it("returns 1200 for medium", () => {
    expect(mismatchDelay("medium")).toBe(1200);
  });
  it("returns 900 for hard", () => {
    expect(mismatchDelay("hard")).toBe(900);
  });
});
