import React from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { manifest } from '../../../manifest';
import { EscapeGame } from '../EscapeGame';

let lastWinOverlayProps: { onHome: () => void; onNext: () => void } | null = null;

vi.mock('../../../components/WinOverlay', () => ({
  WinOverlay: (props: { onHome: () => void; onNext: () => void }) => {
    lastWinOverlayProps = props;
    return null;
  },
}));

describe('EscapeGame', () => {
  const noop = () => {};

  beforeEach(() => {
    lastWinOverlayProps = null;
  });

  it('renders the scene picker when no scene is selected', () => {
    const html = renderToString(<EscapeGame onHome={noop} onPickScene={noop} onBackToPicker={noop} lang="en" />);
    expect(html).toContain('scene-surprise');
  });

  it('wires WinOverlay onHome to onHome rather than onBackToPicker', () => {
    const onHome = vi.fn();
    const onBackToPicker = vi.fn();
    const onPickScene = vi.fn();
    const rooms = manifest.escape ?? [];
    const sceneId = rooms[0]?.id ?? 'toyroom';

    renderToString(
      <EscapeGame
        onHome={onHome}
        onPickScene={onPickScene}
        onBackToPicker={onBackToPicker}
        sceneId={sceneId}
        lang="en"
      />,
    );

    expect(lastWinOverlayProps).not.toBeNull();
    lastWinOverlayProps?.onHome();
    expect(onHome).toHaveBeenCalledOnce();
    expect(onBackToPicker).not.toHaveBeenCalled();

    const nextId = rooms[(rooms.findIndex((r) => r.id === sceneId) + 1) % rooms.length].id;
    lastWinOverlayProps?.onNext();
    expect(onPickScene).toHaveBeenCalledWith(nextId);
  });
});
