import { describe, expect, it } from "vitest";
import {
  computeSoloCardSize,
  computeDuelCardSize,
  soloHintDelayMs,
  shouldShowSoloHintOnWrong,
} from "../logic";

describe("computeSoloCardSize", () => {
  it("prevents negative sizes on extremely small viewports", () => {
    expect(computeSoloCardSize(100, 50)).toBeGreaterThanOrEqual(0);
    expect(computeSoloCardSize(50, 100)).toBeGreaterThanOrEqual(0);
  });

  it("preserves normal card size calculation on normal viewports", () => {
    // Height = 1000, Width = 500 (Portrait)
    // availH = 1000 - 84 = 916.
    // min((916 - 60)/2, 500 - 40, 400) = min(428, 460, 400) = 400
    expect(computeSoloCardSize(500, 1000)).toBe(400);

    // Height = 500, Width = 1000 (Landscape)
    // availH = 500 - 84 = 416
    // min(416 - 24, (1000 - 72) / 2, 460) = min(392, 464, 460) = 392
    expect(computeSoloCardSize(1000, 500)).toBe(392);
  });
});

describe("computeDuelCardSize", () => {
  it("prevents negative sizes on extremely small viewports", () => {
    expect(computeDuelCardSize(100, 50)).toBeGreaterThanOrEqual(0);
    expect(computeDuelCardSize(50, 100)).toBeGreaterThanOrEqual(0);
  });

  it("preserves normal card size calculation on normal viewports", () => {
    // Height = 1000, Width = 500 (Portrait)
    // availH = 916. min((916-24)/2 - 52, (500-60)/2, 320) = min(394, 220, 320) = 220
    expect(computeDuelCardSize(500, 1000)).toBe(220);

    // Height = 500, Width = 1000 (Landscape)
    // availH = 416. min(416-90, (1000-24)/2/2 - 20, 320) = min(326, 224, 320) = 224
    expect(computeDuelCardSize(1000, 500)).toBe(224);
  });
});

describe("soloHintDelayMs", () => {
  it("returns 15000ms for easy and medium, and Infinity for hard", () => {
    expect(soloHintDelayMs("easy")).toBe(15000);
    expect(soloHintDelayMs("medium")).toBe(15000);
    expect(soloHintDelayMs("hard")).toBe(Infinity);
  });
});

describe("shouldShowSoloHintOnWrong", () => {
  it("returns false for 0 or 1 wrong taps, and true for 2 or more", () => {
    expect(shouldShowSoloHintOnWrong(0)).toBe(false);
    expect(shouldShowSoloHintOnWrong(1)).toBe(false);
    expect(shouldShowSoloHintOnWrong(2)).toBe(true);
    expect(shouldShowSoloHintOnWrong(3)).toBe(true);
  });
});
