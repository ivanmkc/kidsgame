import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { manifest } from '../../../manifest';
import { sfx } from '../../../sound';
import { DiffGame } from '../DiffGame';
import { DiffHintButton } from '../DiffHintButton';

let lastTapSceneProps: { onHit: (id: string) => void } | null = null;
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

vi.mock('../../../components/TapScene', () => ({
  TapScene: (props: { onHit: (id: string) => void }) => {
    lastTapSceneProps = props;
    return null;
  },
}));

describe('DiffGame', () => {
  const noop = () => {};

  it('renders the scene picker when no scene is selected', () => {
    const html = renderToString(
      <DiffGame onHome={noop} difficulty="medium" onPickScene={noop} onBackToPicker={noop} />,
    );
    expect(html).toContain('scene-surprise');
  });

  it('plays sfx.good when a difference is found', () => {
    const sfxSpy = vi.spyOn(sfx, 'good').mockReturnValue();
    renderToString(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={manifest.diff[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
      />,
    );

    expect(lastTapSceneProps).not.toBeNull();
    lastTapSceneProps?.onHit('0');
    expect(sfxSpy).toHaveBeenCalledOnce();
    sfxSpy.mockRestore();
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
    renderToString(
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
});
