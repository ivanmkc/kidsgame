import React from 'react';
import { StyleSheet } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';

let stateValues: unknown[] = [];
let stateIndex = 0;

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: (init: unknown) => {
      const i = stateIndex++;
      if (stateValues.length <= i) {
        stateValues[i] = typeof init === 'function' ? (init as () => unknown)() : init;
      }
      const setState = (next: unknown) => {
        stateValues[i] = typeof next === 'function' ? (next as (prev: unknown) => unknown)(stateValues[i]) : next;
      };
      return [stateValues[i], setState];
    },
  };
});

import { FeedbackChip } from '../Feedback';

interface ElementNode {
  type: unknown;
  props?: {
    testID?: string;
    accessibilityRole?: string;
    accessibilityLabel?: string;
    accessibilityState?: { selected?: boolean };
    style?: unknown;
    children?: unknown;
    onPress?: () => void;
  };
}

function renderChip(props: Parameters<typeof FeedbackChip>[0] = {}) {
  stateIndex = 0;
  return FeedbackChip(props) as unknown as ElementNode;
}

function findInTree(tree: unknown, predicate: (node: ElementNode) => boolean): ElementNode[] {
  const matches: ElementNode[] = [];
  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    const el = node as ElementNode;
    if (predicate(el)) matches.push(el);
    if (el.props && el.props.children) {
      React.Children.forEach(el.props.children, walk);
    }
  }
  walk(tree);
  return matches;
}

function getByTestId(tree: ElementNode, testId: string): ElementNode {
  const matches = findInTree(tree, (node) => node.props?.testID === testId);
  if (matches.length === 0) throw new Error(`Element with testID "${testId}" not found`);
  return matches[0];
}

function getByRole(tree: ElementNode, role: string, options?: { name?: string }): ElementNode {
  const matches = findInTree(tree, (node) => {
    if (node.props?.accessibilityRole !== role) return false;
    if (options?.name !== undefined && node.props?.accessibilityLabel !== options.name) return false;
    return true;
  });
  if (matches.length === 0) {
    throw new Error(`Element with role "${role}" and name "${options?.name}" not found`);
  }
  return matches[0];
}

function resolveStyle(node: ElementNode) {
  const s = typeof node.props?.style === 'function' ? node.props.style({ pressed: false }) : node.props?.style;
  return StyleSheet.flatten(s);
}

describe('Feedback modal accessibility and touch targets', () => {
  beforeEach(() => {
    stateValues = [];
    stateIndex = 0;
  });

  it('finds each modal button by role and name after opening the modal', () => {
    let tree = renderChip({ lang: 'en' });
    const openBtn = getByTestId(tree, 'feedback-open');
    expect(openBtn.props?.accessibilityRole).toBe('button');
    expect(openBtn.props?.accessibilityLabel).toBe(t('en', 'feedback.chip'));

    openBtn.props?.onPress?.();
    tree = renderChip({ lang: 'en' });

    const brokenBtn = getByRole(tree, 'button', {
      name: t('en', 'feedback.broken'),
    });
    expect(brokenBtn.props?.testID).toBe('feedback-broken');

    const ideaBtn = getByRole(tree, 'button', {
      name: t('en', 'feedback.idea'),
    });
    expect(ideaBtn.props?.testID).toBe('feedback-idea');

    const cancelBtn = getByRole(tree, 'button', {
      name: t('en', 'feedback.cancel'),
    });
    expect(cancelBtn.props?.testID).toBe('feedback-cancel');

    const sendBtn = getByRole(tree, 'button', {
      name: t('en', 'feedback.send'),
    });
    expect(sendBtn.props?.testID).toBe('feedback-send');
  });

  it('exposes selection through accessibilityState on kind buttons', () => {
    let tree = renderChip({ lang: 'en' });
    getByTestId(tree, 'feedback-open').props?.onPress?.();

    tree = renderChip({ lang: 'en' });
    let broken = getByRole(tree, 'button', {
      name: t('en', 'feedback.broken'),
    });
    let idea = getByRole(tree, 'button', { name: t('en', 'feedback.idea') });
    expect(broken.props?.accessibilityState?.selected).toBe(false);
    expect(idea.props?.accessibilityState?.selected).toBe(false);

    broken.props?.onPress?.();
    tree = renderChip({ lang: 'en' });
    broken = getByRole(tree, 'button', { name: t('en', 'feedback.broken') });
    idea = getByRole(tree, 'button', { name: t('en', 'feedback.idea') });
    expect(broken.props?.accessibilityState?.selected).toBe(true);
    expect(idea.props?.accessibilityState?.selected).toBe(false);

    idea.props?.onPress?.();
    tree = renderChip({ lang: 'en' });
    broken = getByRole(tree, 'button', { name: t('en', 'feedback.broken') });
    idea = getByRole(tree, 'button', { name: t('en', 'feedback.idea') });
    expect(broken.props?.accessibilityState?.selected).toBe(false);
    expect(idea.props?.accessibilityState?.selected).toBe(true);
  });

  it('ensures Send and Cancel buttons have at least 44pt touch height and center alignment', () => {
    let tree = renderChip({ lang: 'en' });
    getByTestId(tree, 'feedback-open').props?.onPress?.();

    tree = renderChip({ lang: 'en' });
    const sendBtn = getByRole(tree, 'button', {
      name: t('en', 'feedback.send'),
    });
    const cancelBtn = getByRole(tree, 'button', {
      name: t('en', 'feedback.cancel'),
    });

    const sendStyle = resolveStyle(sendBtn);
    const cancelStyle = resolveStyle(cancelBtn);

    expect(sendStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(sendStyle.justifyContent).toBe('center');
    expect(cancelStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(cancelStyle.justifyContent).toBe('center');
  });

  it('translates modal button accessibility labels in another language', () => {
    let tree = renderChip({ lang: 'ja' });
    getByTestId(tree, 'feedback-open').props?.onPress?.();

    tree = renderChip({ lang: 'ja' });
    expect(getByRole(tree, 'button', { name: t('ja', 'feedback.broken') })).toBeDefined();
    expect(getByRole(tree, 'button', { name: t('ja', 'feedback.idea') })).toBeDefined();
    expect(getByRole(tree, 'button', { name: t('ja', 'feedback.cancel') })).toBeDefined();
    expect(getByRole(tree, 'button', { name: t('ja', 'feedback.send') })).toBeDefined();
  });
});
