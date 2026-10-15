import { describe, it, expect } from "vitest";
import { capitalize } from "./text";

describe("capitalize", () => {
  it("capitalizes words", () => {
    expect(capitalize("")).toBe("");
    expect(capitalize("dog")).toBe("Dog");
    expect(capitalize("Cat")).toBe("Cat");
  });
});
