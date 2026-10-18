// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { View } from 'react-native';
import { describe, it, expect, vi } from 'vitest';
import { GameShell } from '../GameShell';

describe('GameShell', () => {
  it('renders a back button with accessibilityRole="button" and i18n label', () => {
    const onBack = vi.fn();
    const { unmount } = render(
      <GameShell title="Test Game" onBack={onBack} backKind="menu" lang="en">
        <View />
      </GameShell>,
    );

    const backBtn = screen.getByTestId('back-button');
    expect(backBtn.getAttribute('role')).toBe('button');
    expect(backBtn.getAttribute('aria-label')).toBe('Back to menu');
    unmount();
  });

  it('renders a back picker label', () => {
    const onBack = vi.fn();
    const { unmount } = render(
      <GameShell title="Test Game" onBack={onBack} backKind="picker" lang="ja">
        <View />
      </GameShell>,
    );

    const backBtn = screen.getByTestId('back-button');
    expect(backBtn.getAttribute('role')).toBe('button');
    expect(backBtn.getAttribute('aria-label')).toBe('レベルえらびにもどる');
    unmount();
  });
});
