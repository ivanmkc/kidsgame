import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ModePicker } from '../multiplayer';
import { SpotItGame } from '../games/spotit/SpotItGame';
import { MemoryGame } from '../games/memory/MemoryGame';
import { HiddenGame } from '../games/hidden/HiddenGame';

describe('ModePicker', () => {
  it('renders Japanese title and buttons when lang="ja"', () => {
    const html = renderToString(<ModePicker onPick={vi.fn()} lang="ja" />);
    expect(html).toContain('なんにんで あそぶ？');
    expect(html).toContain('ひとり 🧒');
    expect(html).toContain('ふたり 👧👧');
  });

  it('renders English title and buttons when lang="en"', () => {
    const html = renderToString(<ModePicker onPick={vi.fn()} lang="en" />);
    expect(html).toContain('How many players?');
    expect(html).toContain('1 Player 🧒');
    expect(html).toContain('2 Players 👧👧');
  });

  it('renders Japanese ModePicker when SpotItGame has 2P enabled', () => {
    const html = renderToString(<SpotItGame onHome={vi.fn()} difficulty="easy" twoPlayerEnabled={true} lang="ja" />);
    expect(html).toContain('data-testid="mode-picker"');
    expect(html).toContain('なんにんで あそぶ？');
    expect(html).toContain('ひとり 🧒');
    expect(html).toContain('ふたり 👧👧');
  });

  it('renders Japanese ModePicker when MemoryGame has 2P enabled', () => {
    const html = renderToString(<MemoryGame onHome={vi.fn()} difficulty="easy" twoPlayerEnabled={true} lang="ja" />);
    expect(html).toContain('data-testid="mode-picker"');
    expect(html).toContain('なんにんで あそぶ？');
    expect(html).toContain('ひとり 🧒');
    expect(html).toContain('ふたり 👧👧');
  });

  it('renders Japanese ModePicker when HiddenGame has 2P enabled', () => {
    const html = renderToString(
      <HiddenGame
        onHome={vi.fn()}
        difficulty="easy"
        twoPlayerEnabled={true}
        onPickScene={vi.fn()}
        onBackToPicker={vi.fn()}
        lang="ja"
      />,
    );
    expect(html).toContain('data-testid="mode-picker"');
    expect(html).toContain('なんにんで あそぶ？');
    expect(html).toContain('ひとり 🧒');
    expect(html).toContain('ふたり 👧👧');
  });
});
