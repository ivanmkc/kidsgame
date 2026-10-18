import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Lang } from '../../../lang';
import { manifest } from '../../../manifest';
import { sfx } from '../../../sound';
import { DiffGame } from '../DiffGame';
import { DiffHintButton } from '../DiffHintButton';

let lastTapSceneProps: { onHit: (id: string) => void; lang?: Lang } | null = null;

vi.mock('../../../components/TapScene', () => ({
  TapScene: (props: { onHit: (id: string) => void; lang?: Lang }) => {
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

  it('passes lang to TapScene', () => {
    renderToString(
      <DiffGame
        onHome={noop}
        difficulty="medium"
        sceneId={manifest.diff[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="ja"
      />,
    );
    expect(lastTapSceneProps?.lang).toBe('ja');
  });
});
