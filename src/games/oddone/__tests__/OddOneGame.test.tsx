import React from 'react';
import { Dimensions } from 'react-native';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OddOneGame } from '../OddOneGame';

describe('OddOneGame layout', () => {
  const noop = () => {};

  it('renders a balanced 2-column grid for 4 tiles on easy difficulty', () => {
    Dimensions.set({
      window: { width: 1024, height: 768, scale: 1, fontScale: 1 },
      screen: { width: 1024, height: 768, scale: 1, fontScale: 1 },
    });

    const html = renderToString(<OddOneGame onHome={noop} difficulty="easy" lang="en" />);

    // At 1024x768, tile size is 150px and gap is 12px.
    // A 2x2 grid has 2 columns: 2 * 150 + 1 * 12 = 312px.
    // The previous 3-then-1 layout had 3 columns: 3 * 150 + 2 * 12 = 474px.
    expect(html).toContain('style="width:312px;gap:12px"');
  });

  it('renders a balanced 2-column grid on landscape phones for easy', () => {
    Dimensions.set({
      window: { width: 844, height: 390, scale: 1, fontScale: 1 },
      screen: { width: 844, height: 390, scale: 1, fontScale: 1 },
    });

    const html = renderToString(<OddOneGame onHome={noop} difficulty="easy" lang="en" />);

    // At 844x390, tile size is 102px and gap is 12px.
    // A 2x2 grid has 2 columns: 2 * 102 + 1 * 12 = 216px.
    // The previous layout had 3 columns: 3 * 102 + 2 * 12 = 330px.
    expect(html).toContain('style="width:216px;gap:12px"');
  });

  it('renders a 3-column grid for 6 tiles on medium difficulty', () => {
    Dimensions.set({
      window: { width: 1024, height: 768, scale: 1, fontScale: 1 },
      screen: { width: 1024, height: 768, scale: 1, fontScale: 1 },
    });

    const html = renderToString(<OddOneGame onHome={noop} difficulty="medium" lang="en" />);

    // At 1024x768, 6 tiles render as 3 cols x 2 rows: 3 * 150 + 24 = 474px.
    expect(html).toContain('style="width:474px;gap:12px"');
  });

  it('renders a 3-column grid for 9 tiles on hard difficulty', () => {
    Dimensions.set({
      window: { width: 1024, height: 768, scale: 1, fontScale: 1 },
      screen: { width: 1024, height: 768, scale: 1, fontScale: 1 },
    });

    const html = renderToString(<OddOneGame onHome={noop} difficulty="hard" lang="en" />);

    // At 1024x768, 9 tiles render as 3 cols x 3 rows: 3 * 150 + 24 = 474px.
    expect(html).toContain('style="width:474px;gap:12px"');
  });
});
