// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Animated } from 'react-native';
import { BellsGame } from '../BellsGame';
import * as bellsLogic from '../logic';

describe('BellsGame', () => {
  it('halts animations when won', () => {
    let rounds = 5;
    const roundsSpy = vi.spyOn(bellsLogic, 'roundsToWin').mockImplementation(() => rounds);
    const loopSpy = vi.spyOn(Animated, 'loop');
    const stopSpy = vi.spyOn(Animated.Value.prototype, 'stopAnimation');

    const { rerender, unmount } = render(<BellsGame onHome={() => {}} difficulty="hard" lang="en" />);

    loopSpy.mockClear();

    rounds = 0;
    rerender(<BellsGame onHome={() => {}} difficulty="hard" lang="en" />);

    expect(stopSpy).toHaveBeenCalled();
    expect(loopSpy).not.toHaveBeenCalled();

    loopSpy.mockRestore();
    stopSpy.mockRestore();
    roundsSpy.mockRestore();
    unmount();
  });
});
