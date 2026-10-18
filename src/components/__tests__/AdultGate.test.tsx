// @vitest-environment happy-dom
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AdultGate } from '../AdultGate';
import { LangContext } from '../GameShell';
import { t } from '../../i18n';

describe('AdultGate i18n', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders Japanese title with renderToString and lang="ja"', () => {
    const jaTitle = t('ja', 'gate.title');
    const html = renderToString(<AdultGate lang="ja" onPass={vi.fn()} onCancel={vi.fn()} />);
    expect(html).toContain(jaTitle);
    expect(html).toContain('保護者用設定');
    expect(html).toContain(t('ja', 'gate.holdPrompt'));
    expect(html).toContain(t('ja', 'gate.holdButton'));
    expect(html).toContain(t('ja', 'gate.cancel'));
  });

  it('inherits language from LangContext when rendered via renderToString', () => {
    const jaTitle = t('ja', 'gate.title');
    const html = renderToString(
      <LangContext.Provider value={{ lang: 'ja', onCycle: vi.fn() }}>
        <AdultGate onPass={vi.fn()} onCancel={vi.fn()} />
      </LangContext.Provider>,
    );
    expect(html).toContain(jaTitle);
  });

  it('renders English by default when no prop or context is present', () => {
    const html = renderToString(<AdultGate onPass={vi.fn()} onCancel={vi.fn()} />);
    expect(html).toContain('Parental Controls');
    expect(html).toContain(t('en', 'gate.holdPrompt'));
    expect(html).toContain(t('en', 'gate.holdButton'));
    expect(html).toContain(t('en', 'gate.cancel'));
  });

  it('shows translated word-phase strings after holding button', () => {
    render(<AdultGate lang="ja" onPass={vi.fn()} onCancel={vi.fn()} />);

    // In React Native Web, Pressable with accessibilityLabel has aria-label
    const holdBtn = screen.getByLabelText(t('ja', 'gate.holdA11y'));
    expect(holdBtn).toBeDefined();

    // Trigger hold
    fireEvent.mouseDown(holdBtn);
    act(() => {
      vi.advanceTimersByTime(3100);
    });

    // Word phase should now be visible in Japanese
    expect(screen.getByText(t('ja', 'gate.wordTitle'))).toBeDefined();
    expect(screen.getByText(new RegExp(t('ja', 'gate.wordPrompt')))).toBeDefined();
    expect(screen.getByPlaceholderText(t('ja', 'gate.wordPlaceholder'))).toBeDefined();
    expect(screen.getByText(t('ja', 'gate.continue'))).toBeDefined();
  });
});
