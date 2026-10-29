// @vitest-environment happy-dom
import React from 'react';
import { Animated } from 'react-native';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../assets/images', () => ({
  MUSICBOX_IMAGES: {
    'twinkle/obj_sky_sun_rays': { uri: 'test.png' },
  },
}));

import { SpawnedObject } from '../musicbox/SpawnedObject';

describe('musicbox SpawnedObject', () => {
  it('cleans up animations on unmount', () => {
    const springSpy = vi.spyOn(Animated, 'spring');
    const loopSpy = vi.spyOn(Animated, 'loop');
    const entry = {
      id: 1,
      x: 100,
      y: 100,
      scrollAtSpawn: 0,
      spriteKey: 'obj_sky_sun_rays',
      sceneId: 'twinkle',
      big: false,
      zone: 'sky' as const,
      midi: 60,
    };
    const scrollX = new Animated.Value(0);
    const { unmount } = render(<SpawnedObject entry={entry} scrollX={scrollX} lang="en" />);

    expect(springSpy).toHaveBeenCalled();
    const springObj = springSpy.mock.results[0].value;
    const springStopSpy = vi.spyOn(springObj, 'stop');

    // loop Anim might not be started immediately if spring didn't finish immediately,
    // but the object is created during useEffect.
    expect(loopSpy).toHaveBeenCalled();
    const loopObj = loopSpy.mock.results[0].value;
    const loopStopSpy = vi.spyOn(loopObj, 'stop');

    unmount();

    expect(springStopSpy).toHaveBeenCalled();
    expect(loopStopSpy).toHaveBeenCalled();

    springSpy.mockRestore();
    loopSpy.mockRestore();
  });
});
