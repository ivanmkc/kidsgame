import { Platform } from 'react-native';
import { buildFeedbackContext, generateUuid } from '../analyticsContext';
import * as difficulty from '../difficulty';
import pkg from '../../package.json';
import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('analyticsContext', () => {
  beforeEach(() => {
    (Platform as { OS: string }).OS = 'web';
  });

  describe('buildFeedbackContext', () => {
    it('builds a feedback context with sceneId', () => {
      vi.spyOn(difficulty, 'loadFilter').mockReturnValue('hard');
      const ctx = buildFeedbackContext(
        'story/dog',
        'en',
        { width: 1024, height: 768 },
        'broken',
        'It froze',
        '1234-abcd',
      );
      expect(ctx).toEqual({
        gameId: 'story',
        screen: 'story/dog',
        lang: 'en',
        difficulty: 'hard',
        sceneId: 'dog',
        version: pkg.version || '1.0.0',
        platform: 'web',
        viewport: '1024x768',
        kind: 'broken',
        text: 'It froze',
        uuid: '1234-abcd',
      });
    });

    it('builds a feedback context without sceneId and with empty text', () => {
      vi.spyOn(difficulty, 'loadFilter').mockReturnValue('all');
      const ctx = buildFeedbackContext('menu', 'ja', { width: 375.4, height: 667.5 }, null, '  ', '4321-dcba');
      expect(ctx).toEqual({
        gameId: 'menu',
        screen: 'menu',
        lang: 'ja',
        difficulty: 'all',
        version: pkg.version || '1.0.0',
        platform: 'web',
        viewport: '375x668',
        kind: 'idea',
        uuid: '4321-dcba',
        text: '',
      });
    });
  });

  describe('generateUuid', () => {
    it('returns a valid UUID v4 format and generates unique values', () => {
      const uuid1 = generateUuid();
      const uuid2 = generateUuid();

      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid1).toMatch(uuidV4Regex);
      expect(uuid2).toMatch(uuidV4Regex);

      expect(uuid1).not.toEqual(uuid2);
    });

    it('falls back to Math.random when crypto is undefined', () => {
      vi.stubGlobal('crypto', undefined);

      const uuid1 = generateUuid();
      const uuid2 = generateUuid();

      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid1).toMatch(uuidV4Regex);
      expect(uuid2).toMatch(uuidV4Regex);
      expect(uuid1).not.toEqual(uuid2);

      vi.unstubAllGlobals();
    });

    it('falls back to Math.random when crypto.randomUUID is not available', () => {
      // Simulate an environment where crypto exists but lacks randomUUID.
      const mockCrypto = {};
      vi.stubGlobal('crypto', mockCrypto);

      const uuid = generateUuid();

      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidV4Regex);

      vi.unstubAllGlobals();
    });
  });
});
