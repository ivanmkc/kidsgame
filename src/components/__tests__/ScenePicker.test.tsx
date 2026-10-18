// @vitest-environment happy-dom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ScenePicker } from '../ScenePicker';
import { test, expect, vi } from 'vitest';

test('ScenePicker elements are accessible buttons', () => {
  const options = [
    { id: '1', name: 'Scene 1', image: 'scene1.png' },
    { id: '2', name: 'Scene 2', image: 'scene2.png' },
    { id: '3', name: 'Scene 3', image: 'scene3.png' },
  ];
  const onPick = vi.fn();
  const onSurprise = vi.fn();

  render(<ScenePicker title="Pick a Scene" options={options} onPick={onPick} onSurprise={onSurprise} />);

  // 3 scene cards + 1 surprise button
  const buttons = screen.getAllByRole('button');
  expect(buttons).toHaveLength(4);
});
