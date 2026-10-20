import { describe, expect, it } from 'vitest';
import { shouldShowGlyph } from '../logic';

describe('shouldShowGlyph', () => {
  it('hides the glyph by default', () => {
    expect(shouldShowGlyph(0, false)).toBe(false);
  });

  it('reveals the glyph after 2 misses', () => {
    expect(shouldShowGlyph(1, false)).toBe(false);
    expect(shouldShowGlyph(2, false)).toBe(true);
    expect(shouldShowGlyph(3, false)).toBe(true);
  });

  it('forces the glyph if forceShow is true', () => {
    expect(shouldShowGlyph(0, true)).toBe(true);
    expect(shouldShowGlyph(1, true)).toBe(true);
  });
});
