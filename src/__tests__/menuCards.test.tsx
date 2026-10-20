import { renderToString } from 'react-dom/server';
import React from 'react';
import { MenuCard } from '../components/MenuCard';
import { MUSIC_CARDS } from '../menuCards';
import { expect, test, vi } from 'vitest';

test('every music-category game is marked beta and renders the pill', () => {
  const onNavigate = vi.fn();

  // Assert every music card has beta: true
  MUSIC_CARDS.forEach((card) => {
    expect(card.beta).toBe(true);
  });

  // Pick an active music game, such as 'bells', to verify the beta pill renders
  const bellsCard = MUSIC_CARDS.find((c) => c.route === 'bells')!;
  const html = renderToString(
    <MenuCard g={bellsCard} lang="en" cardWidth={100} onNavigate={onNavigate} preview={<div>preview</div>} />,
  );

  expect(html).toContain('BETA');
  expect(html).toContain('data-testid="menu-bells-beta"');
});
