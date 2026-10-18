// @vitest-environment happy-dom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SameDiffGame } from './SameDiffGame';

describe('SameDiffGame UI', () => {
  it('renders dots during listen phases', () => {
    const { container } = render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);
    expect(container.textContent).not.toContain('1/2 🎵');
    expect(screen.getByTestId('melody-dot-0')).toBeTruthy();
    expect(screen.getByTestId('melody-dot-1')).toBeTruthy();
  });

  it('Different card renders with a warm orange border and text', () => {
    vi.useFakeTimers();
    render(<SameDiffGame onHome={() => {}} difficulty="easy" lang="en" />);
    
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const diffButton = screen.getByTestId('samediff-diff');
    expect(diffButton.style.backgroundColor).toMatch(/rgba?\(254,\s*243,\s*232/);
    expect(diffButton.style.borderTopColor).toMatch(/rgba?\(232,\s*155,\s*79/);
    
    // The text element is a child
    const diffText = screen.getByText('Different');
    expect(diffText.style.color).toMatch(/rgba?\(232,\s*155,\s*79/);

    vi.useRealTimers();
  });
});
