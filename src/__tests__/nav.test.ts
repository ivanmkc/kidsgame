// @vitest-environment happy-dom
import {
  act,
  cleanup,
  renderHook as renderHookRTL,
} from "@testing-library/react";
import { Platform } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("routeParts", () => {
  it("splits route into screen and param when slash is present", async () => {
    const { routeParts } = await import("../nav");
    expect(routeParts("diff/farm")).toEqual({ screen: "diff", param: "farm" });
    expect(routeParts("game/level1")).toEqual({
      screen: "game",
      param: "level1",
    });
    expect(routeParts("story/forest/page2")).toEqual({
      screen: "story",
      param: "forest",
    });
  });

  it("returns screen without param when no slash is present", async () => {
    const { routeParts } = await import("../nav");
    expect(routeParts("menu")).toEqual({ screen: "menu", param: undefined });
    expect(routeParts("players")).toEqual({
      screen: "players",
      param: undefined,
    });
    expect(routeParts("")).toEqual({ screen: "", param: undefined });
  });
});

describe("useRoute", () => {
  let pushStateSpy: ReturnType<typeof vi.spyOn>;
  let replaceStateSpy: ReturnType<typeof vi.spyOn>;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let stopNarrationSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    (Platform as { OS: string }).OS = "web";
    window.location.hash = "";

    pushStateSpy = vi.spyOn(window.history, "pushState");
    replaceStateSpy = vi.spyOn(window.history, "replaceState");
    addEventListenerSpy = vi.spyOn(window, "addEventListener");
    removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const sound = await import("../sound");
    stopNarrationSpy = vi.spyOn(sound, "stopNarration");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    (Platform as { OS: string }).OS = "web";
    window.location.hash = "";
    vi.restoreAllMocks();
  });

  async function renderHook(): Promise<
    [string, (r: string, opts?: { replace?: boolean }) => void]
  > {
    const { useRoute } = await import("../nav");
    const { result } = renderHookRTL(() => useRoute());
    return [
      result.current[0],
      (r: string, opts?: { replace?: boolean }) => {
        act(() => {
          result.current[1](r, opts);
        });
      },
    ];
  }

  it("reads players route when hash is empty", async () => {
    const [route] = await renderHook();
    expect(route).toBe("players");
  });

  it("reads route from hash when present", async () => {
    window.location.hash = "#/diff/farm";
    const [route] = await renderHook();
    expect(route).toBe("diff/farm");
  });

  it("handles hash without leading slash", async () => {
    window.location.hash = "#menu";
    const [route] = await renderHook();
    expect(route).toBe("menu");
  });

  it("falls back to players when hash is only # or #/", async () => {
    window.location.hash = "#";
    const [route1] = await renderHook();
    expect(route1).toBe("players");

    window.location.hash = "#/";
    const [route2] = await renderHook();
    expect(route2).toBe("players");
  });

  it("navigates and pushes history on web", async () => {
    const [, navigate] = await renderHook();
    navigate("diff");

    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);
    expect(pushStateSpy).toHaveBeenCalledWith(null, "", "#/diff");
    expect(replaceStateSpy).not.toHaveBeenCalled();
  });

  it("navigates and replaces history when opts.replace is true", async () => {
    const [, navigate] = await renderHook();
    navigate("menu", { replace: true });

    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);
    expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "#/menu");
    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  it("does not push history if hash is already equal to target url", async () => {
    window.location.hash = "#/diff";
    const [, navigate] = await renderHook();
    navigate("diff");

    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);
    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  it("defaults to players and skips web navigation on non-web platform", async () => {
    (Platform as { OS: string }).OS = "ios";
    window.location.hash = "#/menu";

    const [route, navigate] = await renderHook();
    expect(route).toBe("players");

    navigate("diff");
    expect(stopNarrationSpy).not.toHaveBeenCalled();
    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).not.toHaveBeenCalled();
  });

  it("registers popstate and hashchange listeners on mount on web", async () => {
    const { useRoute } = await import("../nav");
    renderHookRTL(() => useRoute());

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "popstate",
      expect.any(Function),
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "hashchange",
      expect.any(Function),
    );
  });

  it("does not register popstate or hashchange listeners on non-web platform", async () => {
    (Platform as { OS: string }).OS = "ios";
    const { useRoute } = await import("../nav");
    renderHookRTL(() => useRoute());

    expect(addEventListenerSpy).not.toHaveBeenCalledWith(
      "popstate",
      expect.any(Function),
    );
    expect(addEventListenerSpy).not.toHaveBeenCalledWith(
      "hashchange",
      expect.any(Function),
    );
  });

  it("updates route and stops narration on popstate event", async () => {
    const { useRoute } = await import("../nav");
    const { result } = renderHookRTL(() => useRoute());

    expect(result.current[0]).toBe("players");
    stopNarrationSpy.mockClear();

    act(() => {
      window.history.pushState(null, "", "#/diff/farm");
      window.dispatchEvent(new Event("popstate"));
    });

    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);
    expect(result.current[0]).toBe("diff/farm");
  });

  it("updates route and stops narration on hashchange event", async () => {
    const { useRoute } = await import("../nav");
    const { result } = renderHookRTL(() => useRoute());

    expect(result.current[0]).toBe("players");
    stopNarrationSpy.mockClear();

    act(() => {
      window.location.hash = "#/menu";
    });

    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);
    expect(result.current[0]).toBe("menu");
  });

  it("removes event listeners on unmount so subsequent events do not trigger updates", async () => {
    const { useRoute } = await import("../nav");
    const { result, unmount } = renderHookRTL(() => useRoute());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "popstate",
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "hashchange",
      expect.any(Function),
    );

    stopNarrationSpy.mockClear();
    act(() => {
      window.history.pushState(null, "", "#/story");
      window.dispatchEvent(new Event("popstate"));
      window.location.hash = "#/story";
    });

    expect(stopNarrationSpy).not.toHaveBeenCalled();
    expect(result.current[0]).toBe("players");
  });

  it("synchronizes route across multiple useRoute instances when navigate is called", async () => {
    const { useRoute } = await import("../nav");
    const { result: instance1 } = renderHookRTL(() => useRoute());
    const { result: instance2 } = renderHookRTL(() => useRoute());

    expect(instance1.current[0]).toBe("players");
    expect(instance2.current[0]).toBe("players");

    act(() => {
      instance2.current[1]("diff");
    });

    expect(instance1.current[0]).toBe("diff");
    expect(instance2.current[0]).toBe("diff");
  });
});
