// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { manifest } from '../../../manifest';
import { sfx } from '../../../sound';
import { t } from '../../../i18n';
import { DiffGame } from '../DiffGame';
import { DiffHintButton } from '../DiffHintButton';

let lastDiffWrapProps: import('react-native').ViewProps | null = null;

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-native')>();
  return {
    ...actual,
    View: (props: import('react-native').ViewProps) => {
      if (props.testID === 'diff-wrap') {
        lastDiffWrapProps = props;
      }
      return <actual.View {...props} />;
    },
  };
});

describe('DiffGame', () => {
  const noop = () => {};

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('renders the scene picker when no scene is selected', () => {
    render(
      <DiffGame onHome={noop} difficulty="medium" onPickScene={noop} onBackToPicker={noop} />,
    );
    expect(screen.getByTestId('scene-surprise')).toBeDefined();
  });

  it('plays sfx.good when a difference is found', () => {
    const sfxSpy = vi.spyOn(sfx, 'good').mockReturnValue();
    render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={manifest.diff[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    fireEvent.click(screen.getByTestId('left-target-0'));
    expect(sfxSpy).toHaveBeenCalledOnce();
  });

  it('renders hint button with localized accessibilityLabel following lang', () => {
    const htmlJa = renderToString(<DiffHintButton lang="ja" onPress={noop} />);
    expect(htmlJa).toContain('data-testid="diff-hint"');
    expect(htmlJa).toContain('role="button"');
    expect(htmlJa).toContain('aria-label="💡 ヒント"');
    expect(htmlJa).not.toContain('aria-label="Show a hint"');

    const htmlEn = renderToString(<DiffHintButton lang="en" onPress={noop} />);
    expect(htmlEn).toContain('data-testid="diff-hint"');
    expect(htmlEn).toContain('aria-label="💡 Hint"');
  });
  it('disables touch events on the invisible scene while loading', () => {
    lastDiffWrapProps = null;
    render(
      <DiffGame
        onHome={() => {}}
        difficulty="medium"
        sceneId={manifest.diff[0].id}
        onPickScene={() => {}}
        onBackToPicker={() => {}}
      />,
    );
    expect(lastDiffWrapProps).not.toBeNull();
    expect(lastDiffWrapProps!.pointerEvents).toBe('none');
  });

  it('renders TapScene targets with localized accessibilityLabel for both pictures', () => {
    render(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={manifest.diff[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );

    const leftTargets = screen.getAllByRole('button').filter((el) =>
      el.getAttribute('data-testid')?.startsWith('left-target-'),
    );
    expect(leftTargets.length).toBeGreaterThan(0);
    for (const target of leftTargets) {
      expect(target.getAttribute('aria-label')).toBe(t('ja', 'a11y.target'));
    }

    const rightTargets = screen.getAllByRole('button').filter((el) =>
      el.getAttribute('data-testid')?.startsWith('right-target-'),
    );
    expect(rightTargets.length).toBeGreaterThan(0);
    for (const target of rightTargets) {
      expect(target.getAttribute('aria-label')).toBe(t('ja', 'a11y.target'));
    }
  });
});
