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
    // min((916 - 96)/2, 500 - 40, 400) = min(410, 460, 400) = 400
    expect(computeSoloCardSize(500, 1000)).toBe(400);

    // Height = 500, Width = 1000 (Landscape)
    // availH = 500 - 84 = 416
    // min(416 - 24, (1000 - 72) / 2, 460) = min(392, 464, 460) = 392
    expect(computeSoloCardSize(1000, 500)).toBe(392);
  });

  it("accounts for two-row wrapped header and timer ring overhead on mobile portrait viewports", () => {
    // 320x568 portrait (iPhone SE / compact mobile):
    // Header wraps to ~120px; subtracting 96px overhead for TimerRing and divider:
    // availH = 568 - 120 = 448; (448 - 96) / 2 = 176
    expect(computeSoloCardSize(320, 568)).toBe(176);

    // Total content height including TimerRing (+24px), vs divider and padding
    // must not vertically overflow the viewport below the wrapped header (~126px)
    const card320 = computeSoloCardSize(320, 568);
    const contentH320 = card320 + 24 + 4 + 26 + 4 + card320 + 8;
    const availableH320 = 568 - 126 - 10;
    expect(contentH320).toBeLessThanOrEqual(availableH320);

    // 390x844 portrait (iPhone 12/13/14):
    // Header wraps to ~120px; subtracting 96px overhead for TimerRing and divider:
    // availH = 844 - 120 = 724; (724 - 96) / 2 = 314; min(314, 390 - 40, 400) = 314
    expect(computeSoloCardSize(390, 844)).toBe(314);

    const card390 = computeSoloCardSize(390, 844);
    const contentH390 = card390 + 24 + 4 + 26 + 4 + card390 + 8;
    const availableH390 = 844 - 107 - 10;
    expect(contentH390).toBeLessThanOrEqual(availableH390);
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
