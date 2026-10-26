// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { manifest } from '../../../manifest';
import { HiddenGame } from '../HiddenGame';

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
  });
  Object.defineProperty(window, 'innerHeight', {
    value: height,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'clientWidth', {
    value: width,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    value: height,
    configurable: true,
  });
  if (window.visualViewport) {
    Object.defineProperty(window.visualViewport, 'width', {
      value: width,
      configurable: true,
    });
    Object.defineProperty(window.visualViewport, 'height', {
      value: height,
      configurable: true,
    });
  }
  window.dispatchEvent(new Event('resize'));
}

describe('HiddenGame landscape layout', () => {
  const noop = () => {};

  afterEach(() => {
    cleanup();
  });

  it('renders TapScene at over 500px in mobile landscape (844x390) instead of miniature 227px thumbnail', () => {
    setViewport(844, 390);
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={false}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const checklist = screen.getByTestId('hidden-checklist');
    expect(checklist).toBeDefined();

    // TapScene frame should be rendered with landscape width ~516px, not 227px
    const target = screen.getAllByTestId(/^hidden-target-/)[0];
    const sceneFrame = target.parentElement;
    const frameStyle = sceneFrame?.getAttribute('style') ?? '';
    expect(frameStyle).toContain('width: 516px');
    expect(frameStyle).toContain('height: 290');
  });

  it('in 2P co-op mode on 844x390 landscape, preserves large scene dimensions and renders turn banner in side column', () => {
    setViewport(844, 390);
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={true}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    fireEvent.click(screen.getByTestId('mp-choose-2p'));

    const banner = screen.getByTestId('hidden-turn-banner');
    expect(banner).toBeDefined();
    expect(screen.getByTestId('hidden-checklist')).toBeDefined();

    const target = screen.getAllByTestId(/^hidden-target-/)[0];
    const sceneFrame = target.parentElement;
    const frameStyle = sceneFrame?.getAttribute('style') ?? '';
    expect(frameStyle).toContain('width: 516px');
    expect(frameStyle).toContain('height: 290');
  });

  it('in portrait mode (390x844), preserves portrait width (366px)', () => {
    setViewport(390, 844);
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={false}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    expect(screen.getByTestId('hidden-checklist')).toBeDefined();
    const target = screen.getAllByTestId(/^hidden-target-/)[0];
    const sceneFrame = target.parentElement;
    const frameStyle = sceneFrame?.getAttribute('style') ?? '';
    expect(frameStyle).toContain('width: 366px');
    expect(frameStyle).toContain('height: 205');
  });

  it('applies minimum scene width clamp on short landscape (700x250) raising width from 267px to 320px', () => {
    setViewport(700, 250);
    render(
      <HiddenGame
        onHome={noop}
        difficulty="medium"
        twoPlayerEnabled={false}
        sceneId={manifest.hidden[0].id}
        onPickScene={noop}
        onBackToPicker={noop}
        lang="en"
      />,
    );

    const target = screen.getAllByTestId(/^hidden-target-/)[0];
    const sceneFrame = target.parentElement;
    const frameStyle = sceneFrame?.getAttribute('style') ?? '';
    expect(frameStyle).toContain('width: 320px');
  });
});
