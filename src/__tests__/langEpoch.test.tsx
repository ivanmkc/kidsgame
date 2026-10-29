// @vitest-environment happy-dom
import React, { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Lang, useLangEpoch } from "../lang";

describe("useLangEpoch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("increments epoch on lang change, calls stopNarration synchronously in useLayoutEffect, and validates old closures", async () => {
    const { renderHook, act } = await import("@testing-library/react");
    const sound = await import("../sound");
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration");

    const { result, rerender } = renderHook(({ lang }) => useLangEpoch(lang), {
      initialProps: { lang: "en" as Lang },
    });

    expect(result.current.epoch).toBe(0);
    expect(result.current.isValid()).toBe(true);
    expect(stopNarrationSpy).not.toHaveBeenCalled();

    const oldIsValid = result.current.isValid;

    act(() => {
      rerender({ lang: "ja" });
    });

    expect(result.current.epoch).toBe(1);
    expect(result.current.isValid()).toBe(true);
    expect(oldIsValid()).toBe(false);
    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);
  });

  it("runs stopNarration before child say() and invalidates old closure pending sayThen callback", async () => {
    const { render, act } = await import("@testing-library/react");
    const sound = await import("../sound");
    const stopNarrationSpy = vi.spyOn(sound, "stopNarration");
    const saySpy = vi.spyOn(sound, "say");

    let capturedIsValid: (() => boolean) | undefined;
    const done = vi.fn();

    function Child({ lang, isValid }: { lang: Lang; isValid: () => boolean }) {
      capturedIsValid = isValid;
      useEffect(() => {
        sound.say(`Prompt for ${lang}`);
      }, [lang]);
      return null;
    }

    function Parent({ lang }: { lang: Lang }) {
      const { isValid } = useLangEpoch(lang);
      return <Child lang={lang} isValid={isValid} />;
    }

    const { rerender } = render(<Parent lang="en" />);

    // Trigger a pending sayThen with old closure state
    const oldIsValid = capturedIsValid;
    sound.sayThen(["Old speech"], () => {
      done(oldIsValid?.());
    });

    act(() => {
      rerender(<Parent lang="ja" />);
    });

    expect(stopNarrationSpy).toHaveBeenCalledTimes(1);
    expect(saySpy).toHaveBeenCalled();

    const lastStopOrder = stopNarrationSpy.mock.invocationCallOrder.at(-1);
    const lastSayOrder = saySpy.mock.invocationCallOrder.at(-1);
    expect(lastStopOrder).toBeDefined();
    expect(lastSayOrder).toBeDefined();
    expect(lastStopOrder!).toBeLessThan(lastSayOrder!);

    expect(done).toHaveBeenCalledWith(false);
  });

  it("returns isValid() false after unmount", async () => {
    const { renderHook } = await import("@testing-library/react");

    const { result, unmount } = renderHook(({ lang }) => useLangEpoch(lang), {
      initialProps: { lang: "en" as Lang },
    });

    expect(result.current.isValid()).toBe(true);
    unmount();
    expect(result.current.isValid()).toBe(false);
  });
});
