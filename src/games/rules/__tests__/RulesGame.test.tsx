// @vitest-environment happy-dom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RulesGame } from '../RulesGame';

describe('RulesGame', () => {
  it('renders initial round for hard difficulty', () => {
    render(<RulesGame onHome={() => {}} difficulty="hard" lang="en" />);
    expect(screen.getByTestId('rules-score')).toBeDefined();
    expect(screen.getByText('Rule #1')).toBeDefined();
  });
});
