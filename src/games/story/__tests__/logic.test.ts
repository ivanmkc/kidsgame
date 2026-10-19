import { describe, expect, it } from 'vitest';
import { manifest, Story } from '../../../manifest';
import { filterStoriesByLang } from '../logic';

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
