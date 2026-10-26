import { Platform } from 'react-native';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BEACON_URL = 'https://kgb-beacon-692247227248.us-central1.run.app/e';

type FakeStorage = Pick<Storage, 'getItem' | 'setItem'>;

interface FakeWindow {
  sessionStorage?: FakeStorage;
  location?: Partial<Location>;
}

type SendBeaconFn = (url: string | URL, data?: BodyInit | null) => boolean;

interface FakeNavigator {
  sendBeacon?: SendBeaconFn;
}

function createFakeStorage(initialData: Record<string, string> = {}): FakeStorage & { store: Record<string, string> } {
  const store: Record<string, string> = { ...initialData };
  return {
    store,
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
  };
}

describe('analytics', () => {
  let fakeStorage: ReturnType<typeof createFakeStorage>;
  let sendBeaconMock: Mock<SendBeaconFn>;
  let fetchMock: Mock<typeof fetch>;

  beforeEach(() => {
    (Platform as { OS: string }).OS = 'web';
    vi.unstubAllGlobals();
    vi.resetModules();

    fakeStorage = createFakeStorage();
    sendBeaconMock = vi.fn(() => true);
    fetchMock = vi.fn(() => Promise.resolve(new Response()));

    const fakeWindow: FakeWindow = {
      sessionStorage: fakeStorage,
      location: { hash: '#/game' },
    };

    const fakeNavigator: FakeNavigator = {
      sendBeacon: sendBeaconMock,
    };

    vi.stubGlobal('window', fakeWindow);
    vi.stubGlobal('navigator', fakeNavigator);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = 'web';
    vi.unstubAllGlobals();
  });

  it('no-ops when Platform.OS is not web', async () => {
    (Platform as { OS: string }).OS = 'ios';
    const { track } = await import('../analytics');
    track('test_event');
    expect(sendBeaconMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no-ops when window is undefined', async () => {
    vi.stubGlobal('window', undefined);
    const { track } = await import('../analytics');
    track('test_event');
    expect(sendBeaconMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends event via navigator.sendBeacon with existing session ID and location hash', async () => {
    fakeStorage.store['kgb.sid'] = 'existing-sid-999';
    const { track } = await import('../analytics');

    track('press_button', { score: 10 });

    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
    const [url, bodyStr] = sendBeaconMock.mock.calls[0] as [string, string];
    expect(url).toBe(BEACON_URL);

    const payload = JSON.parse(bodyStr) as {
      kgb: boolean;
      e: string;
      p: Record<string, string | number>;
      sid: string;
      path: string;
    };
    expect(payload).toEqual({
      kgb: true,
      e: 'press_button',
      p: { score: 10 },
      sid: 'existing-sid-999',
      path: '#/game',
    });
  });

  it('caches session ID in memory on subsequent calls', async () => {
    fakeStorage.store['kgb.sid'] = 'cached-sid-1';
    const { track } = await import('../analytics');

    track('first_event');
    expect(fakeStorage.getItem).toHaveBeenCalledTimes(1);

    track('second_event');
    expect(fakeStorage.getItem).toHaveBeenCalledTimes(1);

    expect(sendBeaconMock).toHaveBeenCalledTimes(2);
    const firstPayload = JSON.parse(sendBeaconMock.mock.calls[0][1] as string) as { sid: string };
    const secondPayload = JSON.parse(sendBeaconMock.mock.calls[1][1] as string) as { sid: string };
    expect(firstPayload.sid).toBe('cached-sid-1');
    expect(secondPayload.sid).toBe('cached-sid-1');
  });

  it('generates a new session ID and persists to sessionStorage when none exists', async () => {
    const { track } = await import('../analytics');

    track('init_event');

    expect(fakeStorage.getItem).toHaveBeenCalledWith('kgb.sid');
    expect(fakeStorage.setItem).toHaveBeenCalledTimes(1);
    expect(fakeStorage.setItem).toHaveBeenCalledWith('kgb.sid', expect.any(String));

    const storedSid = fakeStorage.store['kgb.sid'];
    expect(storedSid).toBeDefined();
    expect(storedSid.length).toBeGreaterThan(0);

    const payload = JSON.parse(sendBeaconMock.mock.calls[0][1] as string) as {
      sid: string;
    };
    expect(payload.sid).toBe(storedSid);
  });

  it('generates session ID in catch block when sessionStorage throws', async () => {
    const brokenWindow: FakeWindow = {
      get sessionStorage(): FakeStorage {
        throw new Error('Access denied');
      },
      location: { hash: '#/play' },
    };
    vi.stubGlobal('window', brokenWindow);
    const { track } = await import('../analytics');

    track('safe_event');

    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(sendBeaconMock.mock.calls[0][1] as string) as {
      sid: string;
    };
    expect(payload.sid).toBeDefined();
    expect(payload.sid.length).toBeGreaterThan(0);
  });

  it('falls back to fetch with default path "#/" when navigator.sendBeacon is unavailable', async () => {
    const fakeNavigatorWithoutBeacon: FakeNavigator = {};
    const windowWithEmptyHash: FakeWindow = {
      sessionStorage: fakeStorage,
      location: { hash: '' },
    };
    vi.stubGlobal('navigator', fakeNavigatorWithoutBeacon);
    vi.stubGlobal('window', windowWithEmptyHash);

    const { track } = await import('../analytics');
    track('fetch_event');

    expect(sendBeaconMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(BEACON_URL, {
      method: 'POST',
      body: expect.any(String),
      keepalive: true,
    });

    const callArgs = fetchMock.mock.calls[0] as [string, { body: string }];
    const payload = JSON.parse(callArgs[1].body) as {
      kgb: boolean;
      e: string;
      p: Record<string, string | number>;
      sid: string;
      path: string;
    };
    expect(payload.kgb).toBe(true);
    expect(payload.e).toBe('fetch_event');
    expect(payload.p).toEqual({});
    expect(payload.path).toBe('#/');
  });

  it('catches and suppresses errors thrown by sendBeacon', async () => {
    const throwingNavigator: FakeNavigator = {
      sendBeacon: vi.fn(() => {
        throw new Error('Network error');
      }),
    };
    vi.stubGlobal('navigator', throwingNavigator);

    const { track } = await import('../analytics');
    expect(() => track('crash_test')).not.toThrow();
  });

  it('catches and suppresses errors thrown by fetch', async () => {
    const fakeNavigatorWithoutBeacon: FakeNavigator = {};
    vi.stubGlobal('navigator', fakeNavigatorWithoutBeacon);
    fetchMock.mockImplementation(() => {
      throw new Error('Fetch failed');
    });

    const { track } = await import('../analytics');
    expect(() => track('crash_fetch')).not.toThrow();
  });
});
