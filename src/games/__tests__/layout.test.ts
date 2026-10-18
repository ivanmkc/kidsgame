import { describe, expect, it } from 'vitest';
import { spriteLT } from '../layout';

describe('spriteLT', () => {
  it('positions sprite center at given stage percentages when away from edges', () => {
    const pos = spriteLT(50, 50, 100, 1000, 800);
    expect(pos).toEqual({ left: 450, top: 350 });
  });

  it('clamps sprite inside stage boundaries near top and left edges', () => {
    const atOrigin = spriteLT(0, 0, 100, 1000, 800);
    expect(atOrigin).toEqual({ left: 0, top: 0 });

    const pastOrigin = spriteLT(-20, -50, 100, 1000, 800);
    expect(pastOrigin).toEqual({ left: 0, top: 0 });

    const nearLeft = spriteLT(2, 3, 100, 1000, 800);
    expect(nearLeft.left).toBe(0);
  });

  it('clamps sprite inside stage boundaries near bottom and right edges', () => {
    const atFarEdge = spriteLT(100, 100, 100, 1000, 800);
    expect(atFarEdge).toEqual({ left: 900, top: 700 });

    const pastFarEdge = spriteLT(120, 150, 100, 1000, 800);
    expect(pastFarEdge).toEqual({ left: 900, top: 700 });
  });

  it('handles small stages where size exceeds stage dimensions', () => {
    const pos = spriteLT(50, 50, 100, 60, 40);
    expect(pos).toEqual({ left: 0, top: 0 });
  });
});
