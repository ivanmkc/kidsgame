import { renderToString } from 'react-dom/server';
import React from 'react';
import { MenuCard } from '../components/MenuCard';
import { CardDef } from '../menuCards';
import { expect, test, vi } from 'vitest';

test('MenuCard shows beta badge only for beta cards', () => {
  const betaCard: CardDef = { route: 'highlow', color: '#5DA9E8', key: 'highlow', preview: 'music', beta: true };
  const normalCard: CardDef = { route: 'spotit', color: '#E85D75', key: 'spotit', preview: 'icons0' };

  const onNavigate = vi.fn();

  const betaHtml = renderToString(
    <MenuCard g={betaCard} lang="en" cardWidth={100} onNavigate={onNavigate} preview={<div>preview</div>} />,
  );
  expect(betaHtml).toContain('data-testid="menu-highlow-beta"');
  expect(betaHtml).toContain('BETA');

  const jaBetaHtml = renderToString(
    <MenuCard g={betaCard} lang="ja" cardWidth={100} onNavigate={onNavigate} preview={<div>preview</div>} />,
  );
  expect(jaBetaHtml).toContain('ベータ');

  const normalHtml = renderToString(
    <MenuCard g={normalCard} lang="en" cardWidth={100} onNavigate={onNavigate} preview={<div>preview</div>} />,
  );
  expect(normalHtml).not.toContain('data-testid="menu-spotit-beta"');
});
