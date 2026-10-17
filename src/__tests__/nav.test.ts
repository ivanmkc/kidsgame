import React from 'react';
import { renderToString } from 'react-dom/server';
import { Platform } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

describe('routeParts', () => {
  it('splits route into screen and param when slash is present', async () => {
    const { routeParts } = await import('../nav');
    expect(routeParts('diff/farm')).toEqual({ screen: 'diff', param: 'farm' });
    expect(routeParts('game/level1')).toEqual({
      screen: 'game',
      param: 'level1',
    });
    expect(routeParts('story/forest/page2')).toEqual({
      screen: 'story',
      param: 'forest',
    });
  });

  it('returns screen without param when no slash is present', async () => {
    const { routeParts } = await import('../nav');
    expect(routeParts('menu')).toEqual({ screen: 'menu', param: undefined });
    expect(routeParts('players')).toEqual({
      screen: 'players',
      param: undefined,
    });
    expect(routeParts('')).toEqual({ screen: '', param: undefined });
  });
});

describe('useRoute', () => {
  type HistoryMethod = (data: unknown, unused: string, url?: string | URL | null) => void;
  type ListenerMethod = (event: string, handler: () => void) => void;

  interface WindowStub {
    location: { hash: string };
    history: {
      pushState: HistoryMethod;
      replaceState: HistoryMethod;
    };
    addEventListener: ListenerMethod;
    removeEventListener: ListenerMethod;
  }

  let fakeWindow: WindowStub;
  let pushStateSpy: Mock<HistoryMethod>;
  let replaceStateSpy: Mock<HistoryMethod>;
  let addEventListenerSpy: Mock<ListenerMethod>;
  let removeEventListenerSpy: Mock<ListenerMethod>;
  let stopNarrationSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    (Platform as { OS: string }).OS = 'web';

    pushStateSpy = vi.fn<HistoryMethod>();
    replaceStateSpy = vi.fn<HistoryMethod>();
    addEventListenerSpy = vi.fn<ListenerMethod>();
    removeEventListenerSpy = vi.fn<ListenerMethod>();

    fakeWindow = {
      location: { hash: '' },
      history: {
        pushState: pushStateSpy,
        replaceState: replaceStateSpy,
      },
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
    };
    vi.stubGlobal('window', fakeWindow);

    const sound = await import('../sound');
    stopNarrationSpy = vi.spyOn(sound, 'stopNarration');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    (Platform as { OS: string }).OS = 'web';
    vi.restoreAllMocks();
  });

  async function renderHook(): Promise<[string, (r: string, opts?: { replace?: boolean }) => void]> {
    const { useRoute } = await import('../nav');
    let hook!: [string, (r: string, opts?: { replace?: boolean }) => void];
    function Harness() {
      hook = useRoute();
      return null;
    }
    renderToString(React.createElement(Harness));
    return hook;
  }

  it('reads players route when hash is empty', async () => {
    const [route] = await renderHook();
    expect(route).toBe('players');
  });

  it('reads route from hash when present', async () => {
    fakeWindow.location.hash = '#/diff/farm';
    const [route] = await renderHook();
    expect(route).toBe('diff/farm');
  });

  it('handles hash without leading slash', async () => {
    fakeWindow.location.hash = '#menu';
    const [route] = await renderHook();
    expect(route).toBe('menu');
  });

  it('falls back to players when hash is only # or #/', async () => {
    fakeWindow.location.hash = '#';
    const [route1] = await renderHook();
    expect(route1).toBe('players');

    fakeWindow.location.hash = '#/';
    const [route2] = await renderHook();
    expect(route2).toBe('players');
  });

  it('navigates and pushes history on web', async () => {
    const [, navigate] = await renderHook();
    navigate('diff');

    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);
    expect(pushStateSpy).toHaveBeenCalledWith(null, '', '#/diff');
    expect(replaceStateSpy).not.toHaveBeenCalled();
  });

  it('navigates and replaces history when opts.replace is true', async () => {
    const [, navigate] = await renderHook();
    navigate('menu', { replace: true });

    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '#/menu');
    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  it('does not push history if hash is already equal to target url', async () => {
    fakeWindow.location.hash = '#/diff';
    const [, navigate] = await renderHook();
    navigate('diff');

    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);
    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  it('defaults to players and skips web navigation on non-web platform', async () => {
    (Platform as { OS: string }).OS = 'ios';
    fakeWindow.location.hash = '#/menu';

    const [route, navigate] = await renderHook();
    expect(route).toBe('players');

    navigate('diff');
    expect(stopNarrationSpy).not.toHaveBeenCalled();
    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).not.toHaveBeenCalled();
  });

  it('defaults to players and skips web navigation when window is undefined', async () => {
    vi.unstubAllGlobals();

    const [route, navigate] = await renderHook();
    expect(route).toBe('players');

    navigate('diff');
    expect(stopNarrationSpy).not.toHaveBeenCalled();
  });
});
