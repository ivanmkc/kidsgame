import { describe, expect, it } from 'vitest';
import { Lang } from '../../../lang';
import { manifest } from '../../../manifest';
import { stickerLabel, stickerLayout } from '../logic';

describe('stickerLayout', () => {
  describe('mobile landscape viewports', () => {
    it('iPhone 14 Landscape (844x390): landscape mode with playable stage dimensions', () => {
      const layout = stickerLayout(844, 390);
      expect(layout.isLandscape).toBe(true);
      expect(layout.stageW).toBeGreaterThanOrEqual(450);
      expect(layout.stageH).toBeGreaterThanOrEqual(180);
      expect(layout.stageW).toBeLessThanOrEqual(844 - 24);
      // Stage must not collapse to near-zero as it previously did (~7px)
      expect(layout.stageW).toBeCloseTo(516, -1);
      expect(layout.stageH).toBeCloseTo(290, -1);
    });

    it('iPhone SE Landscape (667x375): landscape mode with playable stage dimensions', () => {
      const layout = stickerLayout(667, 375);
      expect(layout.isLandscape).toBe(true);
      expect(layout.stageW).toBeGreaterThanOrEqual(400);
      expect(layout.stageH).toBeGreaterThanOrEqual(180);
      // Stage must not collapse to negative dimensions as it previously did (-147px)
      expect(layout.stageW).toBeCloseTo(463, -1);
      expect(layout.stageH).toBeCloseTo(260, -1);
    });

    it('Android Small Landscape (800x360): landscape mode with positive playable dimensions', () => {
      const layout = stickerLayout(800, 360);
      expect(layout.isLandscape).toBe(true);
      expect(layout.stageW).toBeGreaterThanOrEqual(400);
      expect(layout.stageH).toBeGreaterThanOrEqual(180);
      // Previously collapsed to -174px
      expect(layout.stageW).toBeCloseTo(462, -1);
      expect(layout.stageH).toBeCloseTo(260, -1);
    });

    it('Pixel 7 Landscape (915x412): landscape mode with positive dimensions', () => {
      const layout = stickerLayout(915, 412);
      expect(layout.isLandscape).toBe(true);
      expect(layout.stageW).toBeGreaterThanOrEqual(500);
      expect(layout.stageH).toBeGreaterThanOrEqual(180);
      expect(layout.stageW).toBeCloseTo(555, -1);
      expect(layout.stageH).toBeCloseTo(312, -1);
    });
  });

  describe('portrait viewports', () => {
    it('iPhone 14 Portrait (390x844): portrait mode, stage stacked above tray', () => {
      const layout = stickerLayout(390, 844);
      expect(layout.isLandscape).toBe(false);
      expect(layout.stageW).toBe(366);
      expect(layout.stageH).toBe(206);
    });

    it('iPhone SE Portrait (375x667): portrait mode, stage never collapses', () => {
      const layout = stickerLayout(375, 667);
      expect(layout.isLandscape).toBe(false);
      expect(layout.stageW).toBe(351);
      expect(layout.stageH).toBe(197);
    });
  });

  describe('desktop and tablet viewports', () => {
    it('iPad Landscape (1024x768): unconstrained height uses portrait stack', () => {
      const layout = stickerLayout(1024, 768);
      expect(layout.isLandscape).toBe(false);
      expect(layout.stageW).toBe(825);
      expect(layout.stageH).toBe(464);
    });

    it('Desktop (1440x900): unconstrained height maintains maximum size bounds', () => {
      const layout = stickerLayout(1440, 900);
      expect(layout.isLandscape).toBe(false);
      expect(layout.stageW).toBeLessThanOrEqual(1100);
      expect(layout.stageH).toBeGreaterThan(400);
    });
  });

  describe('extreme constraints', () => {
    it('guarantees minimum playable dimensions even in ultra-short landscape', () => {
      const layout = stickerLayout(480, 240);
      expect(layout.isLandscape).toBe(true);
      expect(layout.stageH).toBeGreaterThanOrEqual(180);
      expect(layout.stageW).toBeGreaterThanOrEqual(320);
    });

    it('guarantees minimum playable dimensions in tiny window', () => {
      const layout = stickerLayout(320, 240);
      expect(layout.stageW).toBeGreaterThan(0);
      expect(layout.stageH).toBeGreaterThan(0);
      expect(layout.stageW).toBeLessThanOrEqual(320);
    });
  });
});

describe('stickerLabel', () => {
  it('localizes dressup items across all supported languages', () => {
    expect(stickerLabel('dress_pink', 'en')).toBe('pink dress');
    expect(stickerLabel('dress_pink', 'ja')).toBe('ピンクのドレス');
    expect(stickerLabel('dress_pink', 'cmn')).toBe('粉色连衣裙');
    expect(stickerLabel('dress_pink', 'yue')).toBe('粉紅色連身裙');

    expect(stickerLabel('fire_helmet', 'en')).toBe('fire helmet');
    expect(stickerLabel('fire_helmet', 'ja')).toBe('しょうぼうしのヘルメット');
    expect(stickerLabel('fire_helmet', 'cmn')).toBe('消防头盔');
    expect(stickerLabel('fire_helmet', 'yue')).toBe('消防頭盔');

    expect(stickerLabel('sunglasses', 'en')).toBe('sunglasses');
    expect(stickerLabel('sunglasses', 'ja')).toBe('サングラス');
    expect(stickerLabel('sunglasses', 'cmn')).toBe('太阳镜');
    expect(stickerLabel('sunglasses', 'yue')).toBe('太陽眼鏡');

    expect(stickerLabel('space_helmet', 'en')).toBe('space helmet');
    expect(stickerLabel('space_helmet', 'ja')).toBe('うちゅうのヘルメット');
    expect(stickerLabel('space_helmet', 'cmn')).toBe('太空头盔');
    expect(stickerLabel('space_helmet', 'yue')).toBe('太空頭盔');
  });

  it('localizes WORDS icons across all supported languages', () => {
    expect(stickerLabel('ladybug', 'en')).toBe('ladybug');
    expect(stickerLabel('ladybug', 'ja')).toBe('てんとうむし');
    expect(stickerLabel('ladybug', 'cmn')).toBe('瓢虫');
    expect(stickerLabel('ladybug', 'yue')).toBe('甲蟲');

    expect(stickerLabel('dog', 'en')).toBe('dog');
    expect(stickerLabel('dog', 'ja')).toBe('いぬ');
    expect(stickerLabel('dog', 'cmn')).toBe('狗');
    expect(stickerLabel('dog', 'yue')).toBe('狗');
  });

  it('localizes every manifest dressup icon across all supported languages', () => {
    const langs: Lang[] = ['en', 'ja', 'cmn', 'yue'];
    expect(manifest.dressup).toBeDefined();
    expect(manifest.dressup!.length).toBeGreaterThan(0);
    for (const icon of manifest.dressup!) {
      for (const lang of langs) {
        const label = stickerLabel(icon, lang);
        expect(label).toBeTruthy();
        expect(label).not.toContain('_');
      }
    }
  });

  it('fails loudly on unknown sticker icon', () => {
    expect(() => stickerLabel('unknown_custom_item', 'en')).toThrow(
      'Unknown sticker icon: unknown_custom_item',
    );
  });
});
