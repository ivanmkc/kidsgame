// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as motion from '../../motion';
import { Confetti } from '../Confetti';

describe('Confetti', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hides all rendered confetti pieces with aria-hidden', () => {
    const { container } = render(<Confetti count={5} />);
    const hiddenPieces = container.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenPieces.length).toBe(5);

    const emojis = ['🎉', '⭐', '🎈', '🎊', '✨'];
    for (const piece of hiddenPieces) {
      expect(emojis).toContain(piece.textContent);
    }
  });

  it('renders default count of 18 pieces all hidden from accessibility', () => {
    const { container } = render(<Confetti />);
    const pieces = container.querySelectorAll('[aria-hidden="true"]');
    expect(pieces.length).toBe(18);
  });

  it('renders nothing when reduced motion is preferred', () => {
    vi.spyOn(motion, 'prefersReducedMotion').mockReturnValue(true);
    const { container } = render(<Confetti />);
    expect(container.innerHTML).toBe('');
  });
});
