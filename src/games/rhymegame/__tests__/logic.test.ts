import { describe, expect, it } from 'vitest';
import { rhymeLayout } from '../logic';

describe('rhymeLayout', () => {
  it('prioritizes answer tiles on mobile landscape viewports (844x390, 667x375)', () => {
    // Repro case: viewport 844x390 shrank tiles to 44px dots while leaving prompt card >150px
    const landscape844 = rhymeLayout(844, 390);
    expect(landscape844.shortH).toBe(true);
    expect(landscape844.tile).toBeGreaterThanOrEqual(80);
    expect(landscape844.tile).toBeLessThanOrEqual(100);
    expect(landscape844.tile).toBe(91);
    expect(landscape844.promptIcon).toBeLessThanOrEqual(68);
    expect(landscape844.promptIcon).toBeGreaterThanOrEqual(56);
    expect(landscape844.promptIcon).toBe(68);

    // Repro case: viewport 667x375
    const landscape667 = rhymeLayout(667, 375);
    expect(landscape667.shortH).toBe(true);
    expect(landscape667.tile).toBeGreaterThanOrEqual(80);
    expect(landscape667.tile).toBeLessThanOrEqual(100);
    expect(landscape667.tile).toBe(87);
    expect(landscape667.promptIcon).toBe(68);
  });

  it('allocates 80-100px for answer tiles across mobile landscape screen heights', () => {
    const screenHeights = [360, 375, 390, 414, 428];
    for (const height of screenHeights) {
      const layout = rhymeLayout(800, height);
      expect(layout.shortH).toBe(true);
      expect(layout.tile).toBeGreaterThanOrEqual(80);
      expect(layout.tile).toBeLessThanOrEqual(100);
      expect(layout.promptIcon).toBeLessThanOrEqual(68);
      expect(layout.promptIcon).toBeGreaterThanOrEqual(48);
    }
  });

  it('preserves full tile and prompt sizing on mobile portrait screens', () => {
    // iPhone 12/13/14 portrait (390x844)
    const portrait390 = rhymeLayout(390, 844);
    expect(portrait390.shortH).toBe(false);
    expect(portrait390.tile).toBe(110);
    expect(portrait390.promptIcon).toBe(110);

    // iPhone SE portrait (375x667)
    const portrait375 = rhymeLayout(375, 667);
    expect(portrait375.shortH).toBe(false);
    expect(portrait375.tile).toBe(105);
    expect(portrait375.promptIcon).toBe(110);
  });

  it('preserves spacious layout on tablets in landscape (1024x768)', () => {
    const tablet = rhymeLayout(1024, 768);
    expect(tablet.shortH).toBe(false);
    expect(tablet.tile).toBe(160);
    expect(tablet.promptIcon).toBe(110);
  });

  it('clamps tile and promptIcon gracefully on extreme small viewports', () => {
    const tiny = rhymeLayout(320, 320);
    expect(tiny.shortH).toBe(true);
    expect(tiny.tile).toBeGreaterThanOrEqual(44);
    expect(tiny.promptIcon).toBeGreaterThanOrEqual(48);
  });
});
