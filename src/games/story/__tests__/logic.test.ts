import { describe, expect, it } from 'vitest';
import { manifest, Story } from '../../../manifest';
import { computeStoryImageDimensions, filterStoriesByLang, MIN_STORY_IMG_W } from '../logic';

describe('StoryGame logic: filterStoriesByLang', () => {
  const sampleStories: Story[] = [
    {
      id: 'fully-translated',
      title: 'Full Story',
      titleT: { ja: '完全', cmn: '完全', yue: '完全' },
      nodes: {},
    },
    {
      id: 'ja-only',
      title: 'Japanese Only',
      titleT: { ja: '日本語のみ' },
      nodes: {},
    },
    {
      id: 'cmn-only',
      title: 'Mandarin Only',
      titleT: { cmn: '普通话' },
      nodes: {},
    },
    {
      id: 'whitespace-title',
      title: 'Whitespace',
      titleT: { ja: '   ' },
      nodes: {},
    },
    {
      id: 'untranslated',
      title: 'Untranslated',
      nodes: {},
    },
  ];

  it('retains all stories for English', () => {
    const filtered = filterStoriesByLang(sampleStories, 'en');
    expect(filtered.map((s) => s.id)).toEqual([
      'fully-translated',
      'ja-only',
      'cmn-only',
      'whitespace-title',
      'untranslated',
    ]);
  });

  it('filters out stories lacking translations for non-English languages', () => {
    expect(filterStoriesByLang(sampleStories, 'ja').map((s) => s.id)).toEqual(['fully-translated', 'ja-only']);
    expect(filterStoriesByLang(sampleStories, 'cmn').map((s) => s.id)).toEqual(['fully-translated', 'cmn-only']);
    expect(filterStoriesByLang(sampleStories, 'yue').map((s) => s.id)).toEqual(['fully-translated']);
  });

  it('handles empty stories array', () => {
    expect(filterStoriesByLang([], 'ja')).toEqual([]);
    expect(filterStoriesByLang([], 'en')).toEqual([]);
  });

  it('ensures every story retained in non-English modes has a non-empty title translation', () => {
    const stories = manifest.stories ?? [];
    for (const lang of ['ja', 'cmn', 'yue'] as const) {
      const filtered = filterStoriesByLang(stories, lang);
      expect(filtered.every((s) => Boolean(s.titleT?.[lang]?.trim()))).toBe(true);
    }
  });
});

describe('StoryGame logic: computeStoryImageDimensions', () => {
  it('enforces minimum width floor on compact 640x320 landscape viewport', () => {
    // When viewport height <= 334px and hasHots is false, height - 84 - 250 is negative.
    // Previously evaluated to -24.88px inner width and -14px inner height.
    const dims = computeStoryImageDimensions(640, 320, false);
    expect(dims.imgW).toBe(MIN_STORY_IMG_W);
    expect(dims.imgH).toBeCloseTo(MIN_STORY_IMG_W / (16 / 9), 2);
  });

  it('enforces minimum width floor on standard 844x390 iPhone landscape viewport', () => {
    // Previously collapsed to a 56px height sliver (imgW = 99.55px).
    const dims = computeStoryImageDimensions(844, 390, false);
    expect(dims.imgW).toBe(MIN_STORY_IMG_W);
    expect(dims.imgH).toBeCloseTo(MIN_STORY_IMG_W / (16 / 9), 2);
  });

  it('allocates extra height for hotspot nodes without collapsing on compact viewports', () => {
    const dims = computeStoryImageDimensions(844, 390, true);
    // (390 - 84 - 110) * (16 / 9) = 196 * 1.777... = 348.44px
    expect(dims.imgW).toBeCloseTo(196 * (16 / 9), 2);
    expect(dims.imgH).toBeCloseTo(196, 2);
  });

  it('fits illustration within available width on portrait viewports', () => {
    const dims = computeStoryImageDimensions(390, 844, false);
    // width - 24 = 366
    expect(dims.imgW).toBe(366);
    expect(dims.imgH).toBeCloseTo(366 / (16 / 9), 2);
  });

  it('caps illustration width at 900px on large desktop viewports', () => {
    const dims = computeStoryImageDimensions(1440, 900, false);
    expect(dims.imgW).toBe(900);
    expect(dims.imgH).toBeCloseTo(900 / (16 / 9), 2);
  });

  it('does not horizontally overflow narrow viewports smaller than minimum width', () => {
    const dims = computeStoryImageDimensions(200, 400, false);
    expect(dims.imgW).toBe(176); // 200 - 24
    expect(dims.imgH).toBeCloseTo(176 / (16 / 9), 2);
  });

  it('handles zero or negative viewport dimensions gracefully', () => {
    const dims = computeStoryImageDimensions(0, 0, false);
    expect(dims.imgW).toBe(0);
    expect(dims.imgH).toBe(0);
  });
});
