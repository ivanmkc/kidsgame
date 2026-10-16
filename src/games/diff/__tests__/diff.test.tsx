import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { manifest } from '../../../manifest';
import { sfx } from '../../../sound';
import { DiffGame } from '../DiffGame';

let lastTapSceneProps: { onHit: (id: string) => void } | null = null;

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
});
