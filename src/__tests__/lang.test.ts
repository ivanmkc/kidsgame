import { Platform } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { HAN_NUMERALS, hanNumeral, LANGS, type Lang, loadLang, nextLang, numberWord, saveLang } from '../lang';
type FakePlatform = Partial<typeof Platform>;
type FakeStorage = Pick<Storage, 'getItem' | 'setItem'>;
type FakeWindow = Omit<Partial<Window>, 'localStorage'> & {
  localStorage?: FakeStorage;
};

describe('lang', () => {
  let store: Record<string, string>;
  let getItemMock: Mock<Storage['getItem']>;
  let setItemMock: Mock<Storage['setItem']>;

  beforeEach(() => {
    (Platform as FakePlatform).OS = 'web';
    store = {};
    getItemMock = vi.fn<Storage['getItem']>((key: string) => store[key] ?? null);
    setItemMock = vi.fn<Storage['setItem']>((key: string, value: string) => {
      store[key] = value;
    });

    const fakeWindow: FakeWindow = {
      localStorage: {
        getItem: getItemMock,
        setItem: setItemMock,
      },
    };
    vi.stubGlobal('window', fakeWindow);
  });

  afterEach(() => {
    (Platform as FakePlatform).OS = 'web';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('loadLang', () => {
    it.each(['en', 'ja', 'cmn', 'yue'] as const)('loads saved language "%s" from localStorage on web', (lang: Lang) => {
      store['kgb.lang.v1'] = lang;
      expect(loadLang()).toBe(lang);
      expect(getItemMock).toHaveBeenCalledWith('kgb.lang.v1');
    });

    it('defaults to "en" when localStorage has no entry', () => {
      expect(loadLang()).toBe('en');
    });

    it('defaults to "en" when stored value is invalid', () => {
      store['kgb.lang.v1'] = 'fr';
      expect(loadLang()).toBe('en');
    });

    it('defaults to "en" when window.localStorage is undefined', () => {
      vi.stubGlobal('window', {});
      expect(loadLang()).toBe('en');
    });

    it('defaults to "en" on non-web platform even if localStorage has value', () => {
      (Platform as FakePlatform).OS = 'ios';
      store['kgb.lang.v1'] = 'ja';
      expect(loadLang()).toBe('en');
      expect(getItemMock).not.toHaveBeenCalled();
    });

    it('defaults to "en" when window is undefined', () => {
      vi.unstubAllGlobals();
      expect(loadLang()).toBe('en');
    });

    it('defaults to "en" when localStorage.getItem throws SecurityError', () => {
      getItemMock.mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(loadLang()).toBe('en');
    });

    it('defaults to "en" when window.localStorage access throws SecurityError', () => {
      const fakeWindow = {
        get localStorage(): FakeStorage {
          throw new Error('SecurityError');
        },
      };
      vi.stubGlobal('window', fakeWindow);
      expect(loadLang()).toBe('en');
    });
  });

  describe('saveLang', () => {
    it('persists selected language to localStorage on web', () => {
      saveLang('ja');
      expect(setItemMock).toHaveBeenCalledWith('kgb.lang.v1', 'ja');
      expect(store['kgb.lang.v1']).toBe('ja');
    });

    it('catches and ignores localStorage.setItem errors', () => {
      setItemMock.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => saveLang('yue')).not.toThrow();
    });

    it('does nothing on non-web platforms', () => {
      (Platform as FakePlatform).OS = 'android';
      saveLang('cmn');
      expect(setItemMock).not.toHaveBeenCalled();
    });

    it('does nothing when window is undefined', () => {
      vi.unstubAllGlobals();
      expect(() => saveLang('ja')).not.toThrow();
    });
  });

  describe('nextLang', () => {
    it('cycles sequentially through all supported languages', () => {
      expect(nextLang('en')).toBe('ja');
      expect(nextLang('ja')).toBe('cmn');
      expect(nextLang('cmn')).toBe('yue');
      expect(nextLang('yue')).toBe('en');
    });
  });

  describe('numberWord', () => {
    it('returns word and romanization for 1..20 across all languages', () => {
      expect(numberWord('en', 1)).toEqual({ t: 'one', r: '' });
      expect(numberWord('en', 20)).toEqual({ t: 'twenty', r: '' });

      expect(numberWord('ja', 1)).toEqual({ t: 'いち', r: 'ichi' });
      expect(numberWord('ja', 20)).toEqual({ t: 'にじゅう', r: 'ni-juu' });

      expect(numberWord('cmn', 1)).toEqual({ t: '一', r: 'yī' });
      expect(numberWord('cmn', 20)).toEqual({ t: '二十', r: 'èr-shí' });

      expect(numberWord('yue', 1)).toEqual({ t: '一', r: 'jat' });
      expect(numberWord('yue', 20)).toEqual({ t: '二十', r: 'ji-sap' });
    });

    it('falls back to stringified number when out of range', () => {
      expect(numberWord('en', 0)).toEqual({ t: '0', r: '' });
      expect(numberWord('en', 21)).toEqual({ t: '21', r: '' });
      expect(numberWord('ja', 99)).toEqual({ t: '99', r: '' });
    });
  });

  describe('LANGS and HAN_NUMERALS constants', () => {
    it('exposes four supported languages with id, label, and emoji', () => {
      expect(LANGS).toEqual([
        { id: 'en', label: 'English', emoji: '🌎' },
        { id: 'ja', label: '日本語', emoji: '🌸' },
        { id: 'cmn', label: '普通话', emoji: '🐼' },
        { id: 'yue', label: '廣東話', emoji: '🥟' },
      ]);
    });

    it('exposes kanji/hanzi numeral tiles 1..10', () => {
      expect(HAN_NUMERALS).toEqual(['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']);
    });
  });

  describe('hanNumeral', () => {
    it('returns han numerals for 1..10', () => {
      expect(hanNumeral(1)).toBe('一');
      expect(hanNumeral(5)).toBe('五');
      expect(hanNumeral(10)).toBe('十');
    });

    it('returns compound han numerals for 11..19', () => {
      expect(hanNumeral(11)).toBe('十一');
      expect(hanNumeral(15)).toBe('十五');
      expect(hanNumeral(19)).toBe('十九');
    });

    it('returns 二十 for 20', () => {
      expect(hanNumeral(20)).toBe('二十');
    });

    it('falls back to stringified number for out-of-range numbers', () => {
      expect(hanNumeral(0)).toBe('0');
      expect(hanNumeral(21)).toBe('21');
    });
  });
});
