import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BingoGame } from '../BingoGame';

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useWindowDimensions: vi.fn(() => ({ width: 844, height: 390 })),
  };
});

describe('BingoGame layout', () => {
  it('renders speaker icon instead of full text when viewport is short', () => {
    const html = renderToString(<BingoGame onHome={() => {}} difficulty="easy" lang="en" />);
    // spell.hearAgain is '🔊 Tap to hear again'
    expect(html).not.toContain('Tap to hear again');
    expect(html).toContain('🔊');
  });
});
