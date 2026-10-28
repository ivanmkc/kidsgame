// @vitest-environment happy-dom
import React from 'react';
import { render } from '@testing-library/react';
import { SpriteCanvas, SpriteAnim } from '../SpriteCanvas';
import { EscapeRoom } from '../../../manifest';
import { EscapeState } from '../logic';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('SpriteCanvas', () => {
  let originalImage: typeof Image;

  beforeEach(() => {
    originalImage = window.Image;
    window.Image = class {
      onload: (() => void) | null = null;
      src: string = '';
      naturalWidth = 100;
      naturalHeight = 100;
      constructor() {
        setTimeout(() => this.onload?.(), 0);
      }
    } as unknown as typeof Image;
  });

  afterEach(() => {
    window.Image = originalImage;
  });

  it('redraws when scale changes', async () => {
    const mockRoom: EscapeRoom = {
      id: 'test_room',
      name: 'Test Room',
      image: 'img.jpg',
      intro: 'intro',
      winText: 'win',
      items: [],
      hotspots: [
        {
          id: 'test_hotspot',
          box: { x: 10, y: 10, w: 50, h: 50 },
          kind: 'search',
          sprite: {
            rest: 'rest.png',
            restBbox: { x: 0, y: 0, w: 100, h: 100 },
            bbox: { x: 0, y: 0, w: 100, h: 100 },
          },
        },
      ],
    };

    const mockState: EscapeState = {
      revealed: [],
      used: [],
      inventory: [],
      selected: null,
      done: false,
    };

    const mockContext = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
    };
    const mockGetContext = vi.fn(() => mockContext);
    HTMLCanvasElement.prototype.getContext =
      mockGetContext as unknown as HTMLCanvasElement['getContext'];

    const anims: SpriteAnim[] = [];
    const setAnims = () => {};

    const { rerender } = render(
      <SpriteCanvas
        room={mockRoom}
        state={mockState}
        anims={anims}
        setAnims={setAnims}
        scale={1.0}
      />,
    );

    await new Promise((r) => setTimeout(r, 100)); // ensure all onloads fire
    expect(mockContext.clearRect).toHaveBeenCalled();
    const callsBefore = mockContext.clearRect.mock.calls.length;

    rerender(
      <SpriteCanvas
        room={mockRoom}
        state={mockState}
        anims={anims}
        setAnims={setAnims}
        scale={2.0}
      />,
    );

    await new Promise((r) => setTimeout(r, 100));
    const callsAfter = mockContext.clearRect.mock.calls.length;

    expect(callsAfter).toBeGreaterThan(callsBefore);
  });
});
