// @vitest-environment happy-dom
import React from 'react';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import { BetaPill } from '../BetaPill';

test('BetaPill localizes text correctly for a non-English language', () => {
  const html = renderToString(<BetaPill lang="ja" />);
  expect(html).toContain('ベータ');
});
