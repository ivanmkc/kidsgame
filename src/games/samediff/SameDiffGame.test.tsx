import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SameDiffGame } from './SameDiffGame';

describe('SameDiffGame UI', () => {
  it('renders dots during listen phases', () => {
    const html = renderToString(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(html).not.toContain('1/2 🎵');
    expect(html).toContain('data-testid="melody-dot-0"');
    expect(html).toContain('data-testid="melody-dot-1"');
  });
});
