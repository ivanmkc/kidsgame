// @vitest-environment happy-dom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { OddOneGame } from '../OddOneGame';

vi.mock('../../../sound', () => ({
  say: vi.fn(),
  sfx: {
    good: vi.fn(),
    wrong: vi.fn(),
  },
}));

describe('OddOneGame', () => {
  it('renders a 2-column grid for 4 tiles on easy difficulty', () => {
    const { container } = render(<OddOneGame onHome={() => {}} difficulty="easy" lang="en" />);
    const buttons = container.querySelectorAll('[data-testid^="oddone-item-"]');
    expect(buttons).toHaveLength(4);
    const grid = buttons[0]?.parentElement;
    expect(grid).toBeTruthy();
    const tileWidth = parseFloat((buttons[0] as HTMLElement).style.width);
    const gridWidth = parseFloat((grid as HTMLElement).style.width);
    const gap = 12;
    // For cols = 2, grid width is 2 * tile + gap.
    // For cols = 3, grid width is 3 * tile + 2 * gap.
    const cols = Math.round((gridWidth + gap) / (tileWidth + gap));
    expect(cols).toBe(2);
  });

  it('renders a 3-column grid for 6 tiles on medium difficulty', () => {
    const { container } = render(<OddOneGame onHome={() => {}} difficulty="medium" lang="en" />);
    const buttons = container.querySelectorAll('[data-testid^="oddone-item-"]');
    expect(buttons).toHaveLength(6);
    const grid = buttons[0]?.parentElement;
    expect(grid).toBeTruthy();
    const tileWidth = parseFloat((buttons[0] as HTMLElement).style.width);
    const gridWidth = parseFloat((grid as HTMLElement).style.width);
    const gap = 12;
    const cols = Math.round((gridWidth + gap) / (tileWidth + gap));
    expect(cols).toBe(3);
  });

  it('renders a 3-column grid for 9 tiles on hard difficulty', () => {
    const { container } = render(<OddOneGame onHome={() => {}} difficulty="hard" lang="en" />);
    const buttons = container.querySelectorAll('[data-testid^="oddone-item-"]');
    expect(buttons).toHaveLength(9);
    const grid = buttons[0]?.parentElement;
    expect(grid).toBeTruthy();
    const tileWidth = parseFloat((buttons[0] as HTMLElement).style.width);
    const gridWidth = parseFloat((grid as HTMLElement).style.width);
    const gap = 12;
    const cols = Math.round((gridWidth + gap) / (tileWidth + gap));
    expect(cols).toBe(3);
  });
});
