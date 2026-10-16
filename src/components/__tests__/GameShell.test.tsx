import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GameShell, LangContext, ScoreChip } from '../GameShell';

describe('GameShell', () => {
  it('allows header title to wrap up to 2 lines without truncating on single line', () => {
    const html = renderToString(
      <GameShell title="Find the Difference" onBack={vi.fn()}>
        <div>child</div>
      </GameShell>,
    );
    expect(html).toContain('Find the Difference');
    // numberOfLines={2} enables WebKit line clamping up to 2 lines
    expect(html).toContain('-webkit-line-clamp:2');
    // Without numberOfLines={2}, RNW outputs whiteSpace: nowrap (r-whiteSpace-3s2u2q)
    expect(html).not.toContain('r-whiteSpace-3s2u2q');
  });

  it('uses minWidth of 220px on titles container so chips wrap on narrow viewports', () => {
    const html = renderToString(
      <GameShell title="Find the Difference" subtitle="Choose a scene" onBack={vi.fn()}>
        <div>child</div>
      </GameShell>,
    );
    // 220px minWidth produces the atomic class r-minWidth-1e7him5 rather than 150px (r-minWidth-bgnin)
    expect(html).toContain('r-minWidth-1e7him5');
    expect(html).not.toContain('r-minWidth-bgnin');
    expect(html).toContain('Choose a scene');
  });

  it('renders picker back button with backLabel and picker accessibilityLabel', () => {
    const html = renderToString(
      <GameShell title="Find the Difference" backKind="picker" lang="en" onBack={vi.fn()}>
        <div>child</div>
      </GameShell>,
    );
    expect(html).toContain('⬅️');
    expect(html).toContain('Levels');
    expect(html).toContain('aria-label="Back to level choices"');
  });

  it('renders lang cycle chip when LangContext is provided', () => {
    const html = renderToString(
      <LangContext.Provider value={{ lang: 'en', onCycle: vi.fn() }}>
        <GameShell title="Find the Difference" onBack={vi.fn()}>
          <div>child</div>
        </GameShell>
      </LangContext.Provider>,
    );
    expect(html).toContain('data-testid="lang-cycle"');
    expect(html).toContain('🌐');
  });

  it('renders right content and ScoreChip', () => {
    const html = renderToString(
      <GameShell title="Find the Difference" onBack={vi.fn()} right={<ScoreChip label="🔎 1/5" testID="score-chip" />}>
        <div>child</div>
      </GameShell>,
    );
    expect(html).toContain('data-testid="score-chip"');
    expect(html).toContain('🔎 1/5');
  });
});
