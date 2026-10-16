import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WinOverlay } from '../WinOverlay';

describe('WinOverlay', () => {
  it('allows message to wrap up to 3 lines without capping at 2 lines', () => {
    const html = renderToString(
      <WinOverlay visible={true} message="Sharp eyes! You compared like a champ!" onNext={vi.fn()} onHome={vi.fn()} />,
    );
    expect(html).toContain('Sharp eyes! You compared like a champ!');
    expect(html).toContain('-webkit-line-clamp:3');
    expect(html).not.toContain('-webkit-line-clamp:2');
  });

  it('renders nothing when not visible', () => {
    const html = renderToString(
      <WinOverlay visible={false} message="Sharp eyes! You compared like a champ!" onNext={vi.fn()} onHome={vi.fn()} />,
    );
    expect(html).toBe('');
  });

  it('renders action buttons with accessibility roles and testIDs', () => {
    const html = renderToString(<WinOverlay visible={true} message="Great job!" onNext={vi.fn()} onHome={vi.fn()} />);
    expect(html).toContain('data-testid="play-again"');
    expect(html).toContain('data-testid="win-home"');
    expect(html).toContain('role="alert"');
  });
});
