// @vitest-environment happy-dom
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AdultGate } from '../AdultGate';
import { LangContext } from '../GameShell';
import { t } from '../../i18n';

let gateWords = ['apple', 'banana'];
vi.mock('../../lockdown', () => ({
  randomGateWord: () => gateWords.shift() || 'default',
}));

describe('AdultGate i18n and interaction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    gateWords = ['apple', 'banana'];
  });

  afterEach(() => {
    cleanup();
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

  it('shows translated word-phase strings after holding button in Japanese', () => {
    render(<AdultGate lang="ja" onPass={vi.fn()} onCancel={vi.fn()} />);

    const holdBtn = screen.getByLabelText(t('ja', 'gate.holdA11y'));
    expect(holdBtn).toBeDefined();

    fireEvent.mouseDown(holdBtn);
    act(() => {
      vi.advanceTimersByTime(3100);
    });

    expect(screen.getByText(t('ja', 'gate.wordTitle'))).toBeDefined();
    expect(screen.getByText(new RegExp(t('ja', 'gate.wordPrompt')))).toBeDefined();
    expect(screen.getByPlaceholderText(t('ja', 'gate.wordPlaceholder'))).toBeDefined();
    expect(screen.getByText(t('ja', 'gate.continue'))).toBeDefined();
  });

  it('handles cancel button click in hold phase', () => {
    const onPass = vi.fn();
    const onCancel = vi.fn();
    render(<AdultGate lang="en" onPass={onPass} onCancel={onCancel} />);

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('exercises onHoldEnd by releasing the hold button before 3 seconds and ensuring timer is cleared', () => {
    const onPass = vi.fn();
    const onCancel = vi.fn();
    render(<AdultGate lang="en" onPass={onPass} onCancel={onCancel} />);

    const holdBtn = screen.getByLabelText('Hold for 3 seconds to access parental controls');
    fireEvent.mouseDown(holdBtn);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.mouseUp(holdBtn);

    // Advance by another 3000ms; if onHoldEnd didn't clear the interval, it would reach 3000ms total and trigger the word phase
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByPlaceholderText('Type the word here')).toBeNull();
  });

  it('triggers idle timeout (onCancel) after 30 seconds without interaction', () => {
    const onPass = vi.fn();
    const onCancel = vi.fn();
    render(<AdultGate lang="en" onPass={onPass} onCancel={onCancel} />);

    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('runs through the hold phase, submits wrong word via submit button, and submits correct word to trigger onPass', () => {
    const onPass = vi.fn();
    const onCancel = vi.fn();

    render(<AdultGate lang="en" onPass={onPass} onCancel={onCancel} />);

    const holdBtn = screen.getByLabelText('Hold for 3 seconds to access parental controls');
    expect(holdBtn).toBeDefined();

    // Press and hold to completion
    fireEvent.mouseDown(holdBtn);
    act(() => {
      vi.advanceTimersByTime(3500);
    });

    const input = screen.getByTestId('gate-input');
    expect(input).toBeDefined();

    // Type wrong word and click submit button
    fireEvent.change(input, { target: { value: 'wrongword' } });
    const submitBtn = screen.getByTestId('gate-submit');
    fireEvent.click(submitBtn);
    expect(onPass).not.toHaveBeenCalled();

    // Type correct word (banana) and click submit button
    fireEvent.change(input, { target: { value: 'banana' } });
    fireEvent.click(submitBtn);
    expect(onPass).toHaveBeenCalledTimes(1);
  });
});
