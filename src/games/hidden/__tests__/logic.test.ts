import { describe, expect, it } from 'vitest';
import { MIN_SCENE_W, hiddenLayout } from '../logic';

describe('hiddenLayout', () => {
  describe('mobile landscape viewports', () => {
    it('iPhone 14 Landscape (844x390): landscape mode with scene filling screen instead of 227px thumbnail', () => {
      const solo = hiddenLayout(844, 390, false);
      expect(solo.isLandscape).toBe(true);
      expect(solo.sceneWidth).toBeGreaterThanOrEqual(500);
      expect(solo.sceneWidth).toBeCloseTo(516, -1);
      expect(solo.sidebarWidth).toBe(180);
      expect(solo.sceneWidth + solo.sidebarWidth + 36).toBeLessThanOrEqual(844);

      const coop = hiddenLayout(844, 390, true);
      expect(coop.isLandscape).toBe(true);
      expect(coop.sceneWidth).toBeGreaterThanOrEqual(500);
      expect(coop.sceneWidth).toBeCloseTo(516, -1);
      expect(coop.sidebarWidth).toBe(180);
      expect(coop.sceneWidth + coop.sidebarWidth + 36).toBeLessThanOrEqual(844);
    });

    it('iPhone SE Landscape (667x375): landscape mode with playable scene dimensions', () => {
      const layout = hiddenLayout(667, 375, true);
      expect(layout.isLandscape).toBe(true);
      expect(layout.sceneWidth).toBeGreaterThanOrEqual(450);
      expect(layout.sceneWidth).toBeCloseTo(471, -1);
      expect(layout.sidebarWidth).toBe(160);
      expect(layout.sceneWidth + layout.sidebarWidth + 36).toBeLessThanOrEqual(667);
    });

    it('Android Small Landscape (800x360): landscape mode with spacious scene', () => {
      const layout = hiddenLayout(800, 360, true);
      expect(layout.isLandscape).toBe(true);
      expect(layout.sceneWidth).toBeGreaterThanOrEqual(450);
      expect(layout.sceneWidth).toBeCloseTo(462, -1);
      expect(layout.sidebarWidth).toBe(180);
      expect(layout.sceneWidth + layout.sidebarWidth + 36).toBeLessThanOrEqual(800);
    });

    it('applies minimum scene width clamp on short landscape (700x250) raising width from 267px to 320px', () => {
      // availH = 250 - 84 - 16 = 150; availH * ar = 267; maxW = 700 - 160 - 36 = 504.
      // Without MIN_SCENE_W clamp, sceneWidth would be 267. With clamp, it is raised to 320.
      const layout = hiddenLayout(700, 250, false);
      expect(layout.isLandscape).toBe(true);
      expect(layout.sceneWidth).toBe(MIN_SCENE_W);
      expect(layout.sceneWidth).toBe(320);
      expect(layout.sceneWidth + layout.sidebarWidth + 36).toBeLessThanOrEqual(700);
    });

    it('never overflows viewport on ultra-compact landscape (480x280)', () => {
      const layout = hiddenLayout(480, 280, true);
      expect(layout.isLandscape).toBe(true);
      expect(layout.sceneWidth).toBe(284);
      expect(layout.sidebarWidth).toBe(160);
      expect(layout.sceneWidth + layout.sidebarWidth + 36).toBeLessThanOrEqual(480);
    });
  });

  describe('portrait viewports', () => {
    it('iPhone 14 Portrait (390x844): portrait mode with vertical stacking', () => {
      const solo = hiddenLayout(390, 844, false);
      expect(solo.isLandscape).toBe(false);
      expect(solo.sceneWidth).toBe(366);
      expect(solo.sidebarWidth).toBe(0);
      expect(solo.sceneWidth + 24).toBeLessThanOrEqual(390);

      const coop = hiddenLayout(390, 844, true);
      expect(coop.isLandscape).toBe(false);
      expect(coop.sceneWidth).toBe(366);
      expect(coop.sidebarWidth).toBe(0);
      expect(coop.sceneWidth + 24).toBeLessThanOrEqual(390);
    });

    it('iPhone SE Portrait (375x667): portrait mode preserves scene width', () => {
      const layout = hiddenLayout(375, 667, false);
      expect(layout.isLandscape).toBe(false);
      expect(layout.sceneWidth).toBe(351);
      expect(layout.sceneWidth + 24).toBeLessThanOrEqual(375);
    });

    it('applies minimum scene width clamp on short portrait with 2P coop (400x420) raising width from 281px to 320px', () => {
      // availH = 420 - 84 - 122 - 56 = 158; availH * ar = 280.89 -> 281; maxW = 400 - 24 = 376.
      // Without MIN_SCENE_W clamp, sceneWidth would be 281. With clamp, it is raised to 320.
      const layout = hiddenLayout(400, 420, true);
      expect(layout.isLandscape).toBe(false);
      expect(layout.sceneWidth).toBe(MIN_SCENE_W);
      expect(layout.sceneWidth).toBe(320);
      expect(layout.sceneWidth + 24).toBeLessThanOrEqual(400);
    });

    it('narrow portrait (320x568): bounds scene width to available space without clipping', () => {
      const layout = hiddenLayout(320, 568, false);
      expect(layout.isLandscape).toBe(false);
      expect(layout.sceneWidth).toBe(296);
      expect(layout.sceneWidth + 24).toBeLessThanOrEqual(320);
    });

    it('Galaxy Fold cover screen (280x653): bounds scene width to available space without clipping', () => {
      const layout = hiddenLayout(280, 653, false);
      expect(layout.isLandscape).toBe(false);
      expect(layout.sceneWidth).toBe(256);
      expect(layout.sceneWidth + 24).toBeLessThanOrEqual(280);
    });
  });
});
