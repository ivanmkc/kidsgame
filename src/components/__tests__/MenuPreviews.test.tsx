// @vitest-environment happy-dom
import { renderToString } from 'react-dom/server';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, it, expect } from 'vitest';
import { manifest } from '../../manifest';
import { previewFor } from '../MenuPreviews';

describe('MenuPreviews', () => {
  const keys = [
    'icons0',
    'icons8',
    'icons13',
    'icons20',
    'rules',
    'bingo',
    'musicbox',
    'escape',
    'carmode',
    'music',
    'diff',
    'hidden',
    'story',
    'other',
  ];

  for (const key of keys) {
    it(`renders preview for ${key}`, () => {
      const node = previewFor(key, 'en');
      expect(node).not.toBeNull();
      const html = renderToString(<>{node}</>);
      expect(html.length).toBeGreaterThan(0);
    });
  }

  it('renders BingoPreview with exactly 3 rows', () => {
    const node = previewFor('bingo', 'en');
    render(<>{node}</>);
    const rows = screen.getAllByTestId('bingo-row');
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.children).toHaveLength(3);
    }
  });

  it('renders rules preview with non-en lang', () => {
    const node = previewFor('rules', 'ja');
    expect(node).not.toBeNull();
    const html = renderToString(<>{node}</>);
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders fallback EscapePreview when escape manifest is empty', () => {
    const orig = manifest.escape;
    manifest.escape = [];
    try {
      const node = previewFor('escape', 'en');
      expect(node).not.toBeNull();
      const html = renderToString(<>{node}</>);
      expect(html.length).toBeGreaterThan(0);
    } finally {
      manifest.escape = orig;
    }
  });
});
