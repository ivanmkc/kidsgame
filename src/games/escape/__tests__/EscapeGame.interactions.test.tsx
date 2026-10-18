// @vitest-environment happy-dom
import React from 'react';
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EscapeGame } from '../EscapeGame';

const noop = () => {};

describe('EscapeGame revealed item hit target', () => {
  afterEach(() => {
    cleanup();
  });

  it('moves hit target to revealed item position and allows collection', () => {
    render(<EscapeGame onHome={noop} sceneId="toyroom" onPickScene={noop} onBackToPicker={noop} lang="en" />);

    const pillowSpot = screen.getByTestId('escape-spot-pillow');
    expect(pillowSpot).toBeDefined();

    // Initial position before revealing
    const initialLeft = pillowSpot.style.left;

    // Tap pillow to reveal the key
    fireEvent.click(pillowSpot);

    // After reveal, hit target position should have moved to the key's itemBox
    const revealedLeft = pillowSpot.style.left;
    expect(revealedLeft).not.toBe(initialLeft);

    // Tap the revealed item hit target to collect it
    fireEvent.click(pillowSpot);

    // Key is now collected into the inventory tray
    expect(screen.getByTestId('escape-item-key')).toBeDefined();
  });
});
