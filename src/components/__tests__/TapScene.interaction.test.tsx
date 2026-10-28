// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Animated } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TapScene } from '../TapScene';

describe('TapScene interactions', () => {
  const mockSource = { uri: 'stub.png' } as unknown as number;
  const boxes = [{ id: 'box1', box: { x: 10, y: 10, w: 20, h: 20 } }];

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('triggers onMiss and shake animation when backdrop is pressed and disabled is false', () => {
    const onMiss = vi.fn();
    const onHit = vi.fn();
    const sequenceSpy = vi.spyOn(Animated, 'sequence');

    render(
      <TapScene
        source={mockSource}
        sceneW={100}
        sceneH={100}
        displayWidth={100}
        boxes={boxes}
        foundIds={[]}
        onHit={onHit}
        onMiss={onMiss}
        testIDPrefix="test"
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByTestId('test-backdrop'));
    expect(onMiss).toHaveBeenCalledTimes(1);
    expect(sequenceSpy).toHaveBeenCalledTimes(1);
    expect(onHit).not.toHaveBeenCalled();
  });

  it('triggers onHit when an unfound target is pressed and disabled is false', () => {
    const onMiss = vi.fn();
    const onHit = vi.fn();

    render(
      <TapScene
        source={mockSource}
        sceneW={100}
        sceneH={100}
        displayWidth={100}
        boxes={boxes}
        foundIds={[]}
        onHit={onHit}
        onMiss={onMiss}
        testIDPrefix="test"
        disabled={false}
      />,
    );

    const target = screen.getByTestId('test-target-box1');
    expect(target.getAttribute('aria-label')).toBe('Target');
    fireEvent.click(target);
    expect(onHit).toHaveBeenCalledWith('box1');
    expect(onMiss).not.toHaveBeenCalled();
  });

  it('does not trigger onMiss or shake when backdrop is pressed and disabled is true', () => {
    const onMiss = vi.fn();
    const onHit = vi.fn();
    const sequenceSpy = vi.spyOn(Animated, 'sequence');

    render(
      <TapScene
        source={mockSource}
        sceneW={100}
        sceneH={100}
        displayWidth={100}
        boxes={boxes}
        foundIds={[]}
        onHit={onHit}
        onMiss={onMiss}
        testIDPrefix="test"
        disabled={true}
      />,
    );

    fireEvent.click(screen.getByTestId('test-backdrop'));
    expect(onMiss).not.toHaveBeenCalled();
    expect(sequenceSpy).not.toHaveBeenCalled();
  });

  it('does not trigger onHit when target is pressed and disabled is true', () => {
    const onMiss = vi.fn();
    const onHit = vi.fn();

    render(
      <TapScene
        source={mockSource}
        sceneW={100}
        sceneH={100}
        displayWidth={100}
        boxes={boxes}
        foundIds={[]}
        onHit={onHit}
        onMiss={onMiss}
        testIDPrefix="test"
        disabled={true}
      />,
    );

    fireEvent.click(screen.getByTestId('test-target-box1'));
    expect(onHit).not.toHaveBeenCalled();
    expect(onMiss).not.toHaveBeenCalled();
  });

  it('does not trigger onHit when target has already been found', () => {
    const onMiss = vi.fn();
    const onHit = vi.fn();

    render(
      <TapScene
        source={mockSource}
        sceneW={100}
        sceneH={100}
        displayWidth={100}
        boxes={boxes}
        foundIds={['box1']}
        onHit={onHit}
        onMiss={onMiss}
        testIDPrefix="test"
        disabled={false}
      />,
    );

    const target = screen.getByTestId('test-target-box1');
    expect(target.getAttribute('aria-label')).toBe('Target, found');
    fireEvent.click(target);
    expect(onHit).not.toHaveBeenCalled();
  });
});
