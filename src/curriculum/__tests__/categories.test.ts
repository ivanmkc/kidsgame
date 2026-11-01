import { describe, expect, it } from 'vitest';
import {
  CATEGORY_CONFLICTS,
  CATEGORY_TEXT,
  CURRICULUM,
  ICON_CATEGORIES,
  categoryOf,
  sameCategory,
} from '../content';

describe('curriculum/categories', () => {
  it('defines the four expected visual categories', () => {
    const keys = Object.keys(ICON_CATEGORIES);
    expect(keys).toEqual(['animals', 'nature', 'food', 'things']);
    for (const key of keys) {
      expect(ICON_CATEGORIES[key].length).toBeGreaterThan(0);
    }
  });

  it('matches CURRICULUM.categories to ICON_CATEGORIES', () => {
    expect(CURRICULUM.categories).toBe(ICON_CATEGORIES);
  });

  it('provides kid-facing tap text and i18n key for every category', () => {
    for (const key of Object.keys(ICON_CATEGORIES)) {
      const entry = CATEGORY_TEXT[key];
      expect(entry).toBeDefined();
      expect(entry.tap).toBeTruthy();
      expect(entry.not).toMatch(/^oddone\.not\./);
    }
  });

  it('defines confusable category pairs in CATEGORY_CONFLICTS', () => {
    expect(CATEGORY_CONFLICTS.nature).toContain('animals');
    expect(CATEGORY_CONFLICTS.food).toContain('animals');
  });

  it('correctly maps icons to their categories', () => {
    expect(categoryOf('cat')).toBe('animals');
    expect(categoryOf('sunflower')).toBe('nature');
    expect(categoryOf('pizza')).toBe('food');
    expect(categoryOf('balloon')).toBe('things');
  });

  it('falls back to things for unknown icons', () => {
    expect(categoryOf('nonexistent_widget')).toBe('things');
  });

  it('retrieves same category icon pool for an icon', () => {
    expect(sameCategory('dog')).toEqual(ICON_CATEGORIES.animals);
    expect(sameCategory('apple')).toEqual(ICON_CATEGORIES.food);
    expect(sameCategory('unknown_icon')).toEqual(ICON_CATEGORIES.things);
  });
});
