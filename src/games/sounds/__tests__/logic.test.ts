import { describe, expect, it } from "vitest";
import { makeSoundsRound, soundsLayout } from "../logic";

describe("soundsLayout", () => {
  it("enlarges tiles to 1x4 row across mobile landscape screens", () => {
    // Android landscape (780x360) with 4 tiles (Medium/Hard)
    const androidLandscape = soundsLayout(780, 360, 4);
    expect(androidLandscape.tile).toBe(139.5);
    expect(androidLandscape.gridWidth).toBe(600);
    expect(androidLandscape.gap).toBe(14);

    // iPhone landscape (844x390)
    const iphoneLandscape = soundsLayout(844, 390, 4);
    expect(iphoneLandscape.tile).toBe(139.5);
    expect(iphoneLandscape.gridWidth).toBe(600);

    // Compact landscape (667x375)
    const compactLandscape = soundsLayout(667, 375, 4);
    expect(compactLandscape.tile).toBe(139.5);
    expect(compactLandscape.gridWidth).toBe(600);

    // Small landscape (568x320)
    const smallLandscape = soundsLayout(568, 320, 4);
    expect(smallLandscape.tile).toBe(106);
    expect(smallLandscape.gridWidth).toBe(466);
  });

  it("preserves 2x2 grid with 170px tiles on tablet/desktop landscape", () => {
    // iPad landscape (1024x768)
    const tabletLandscape = soundsLayout(1024, 768, 4);
    expect(tabletLandscape.tile).toBe(170);
    expect(tabletLandscape.gridWidth).toBe(354);

    // Desktop/laptop landscape (1366x768)
    const desktopLandscape = soundsLayout(1366, 768, 4);
    expect(desktopLandscape.tile).toBe(170);
    expect(desktopLandscape.gridWidth).toBe(354);
  });

  it("preserves 2x2 grid with 170px tiles on mobile portrait", () => {
    // iPhone portrait (390x844) with 4 tiles
    const iphonePortrait = soundsLayout(390, 844, 4);
    expect(iphonePortrait.tile).toBe(170);
    expect(iphonePortrait.gridWidth).toBe(354);
  });

  it("sizes 3 tiles correctly across orientations", () => {
    // Landscape (780x360) with 3 tiles (Easy)
    const landscape3 = soundsLayout(780, 360, 3);
    expect(landscape3.tile).toBe(146);
    expect(landscape3.gridWidth).toBe(466);

    // Portrait (390x844) with 3 tiles (Easy)
    const portrait3 = soundsLayout(390, 844, 3);
    expect(portrait3.tile).toBe(110);
    expect(portrait3.gridWidth).toBe(358);
  });

  it("keeps 2x2 grid with 170px tiles on square screen", () => {
    const square = soundsLayout(600, 600, 4);
    expect(square.tile).toBe(170);
    expect(square.gridWidth).toBe(354);
  });

  it("clamps tile size to 0 on short or narrow screens where dimensions would be negative", () => {
    // Screen height less than 214px (e.g. 210px or 200px)
    const shortLandscape4 = soundsLayout(800, 210, 4);
    expect(shortLandscape4.tile).toBe(0);

    const shortLandscape3 = soundsLayout(800, 200, 3);
    expect(shortLandscape3.tile).toBe(0);

    // Narrow screen (e.g. width < 32px)
    const narrowScreen = soundsLayout(20, 600, 4);
    expect(narrowScreen.tile).toBe(0);

    const tinyScreen = soundsLayout(20, 100, 4);
    expect(tinyScreen.tile).toBe(0);
  });
});

describe("makeSoundsRound", () => {
  it('excludes plane as distractor when target sound is "aa"', () => {
    // Plane can be called "airplane" ('aa'), so it must not be a distractor
    // when prompting for 'aa' (e.g. apple).
    const icons = ["apple", "plane", "rocket"];
    const rng = () => 0;
    const round = makeSoundsRound(rng, icons, "en", 3);
    expect(round.target.icon).toBe("apple");
    const tileIcons = round.tiles.map((t) => t.icon);
    expect(tileIcons).not.toContain("plane");
  });

  it('excludes ladybug as distractor when target sound is "buh"', () => {
    // Ladybug can be called "bug" ('buh'), so it must not be a distractor
    // when prompting for 'buh' (e.g. butterfly).
    const icons = ["butterfly", "ladybug", "rocket"];
    const rng = () => 0;
    const round = makeSoundsRound(rng, icons, "en", 3);
    expect(round.target.icon).toBe("butterfly");
    const tileIcons = round.tiles.map((t) => t.icon);
    expect(tileIcons).not.toContain("ladybug");
  });
});
