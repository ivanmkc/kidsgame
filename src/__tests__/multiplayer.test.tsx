import React from "react";
import { renderToString } from "react-dom/server";
import { Platform } from "react-native";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import {
  loadTwoPlayer,
  ModePicker,
  nextTurn,
  saveTwoPlayer,
} from "../multiplayer";

type FakePlatform = Partial<typeof Platform>;
type FakeStorage = Pick<Storage, "getItem" | "setItem">;
type FakeWindow = Omit<Partial<Window>, "localStorage"> & {
  localStorage?: FakeStorage;
};
import { SpotItGame } from "../games/spotit/SpotItGame";
import { MemoryGame } from "../games/memory/MemoryGame";
import { HiddenGame } from "../games/hidden/HiddenGame";

describe("ModePicker", () => {
  it('renders Japanese title and buttons when lang="ja"', () => {
    const html = renderToString(<ModePicker onPick={vi.fn()} lang="ja" />);
    expect(html).toContain("なんにんで あそぶ？");
    expect(html).toContain("ひとり 🧒");
    expect(html).toContain("ふたり 👧👧");
  });

  it('renders English title and buttons when lang="en"', () => {
    const html = renderToString(<ModePicker onPick={vi.fn()} lang="en" />);
    expect(html).toContain("How many players?");
    expect(html).toContain("1 Player 🧒");
    expect(html).toContain("2 Players 👧👧");
  });

  it("renders Japanese ModePicker when SpotItGame has 2P enabled", () => {
    const html = renderToString(
      <SpotItGame
        onHome={vi.fn()}
        difficulty="easy"
        twoPlayerEnabled={true}
        lang="ja"
      />,
    );
    expect(html).toContain('data-testid="mode-picker"');
    expect(html).toContain("なんにんで あそぶ？");
    expect(html).toContain("ひとり 🧒");
    expect(html).toContain("ふたり 👧👧");
  });

  it("renders Japanese ModePicker when MemoryGame has 2P enabled", () => {
    const html = renderToString(
      <MemoryGame
        onHome={vi.fn()}
        difficulty="easy"
        twoPlayerEnabled={true}
        lang="ja"
      />,
    );
    expect(html).toContain('data-testid="mode-picker"');
    expect(html).toContain("なんにんで あそぶ？");
    expect(html).toContain("ひとり 🧒");
    expect(html).toContain("ふたり 👧👧");
  });

  it("renders Japanese ModePicker when HiddenGame has 2P enabled", () => {
    const html = renderToString(
      <HiddenGame
        onHome={vi.fn()}
        difficulty="easy"
        twoPlayerEnabled={true}
        onPickScene={vi.fn()}
        onBackToPicker={vi.fn()}
        lang="ja"
      />,
    );
    expect(html).toContain('data-testid="mode-picker"');
    expect(html).toContain("なんにんで あそぶ？");
    expect(html).toContain("ひとり 🧒");
    expect(html).toContain("ふたり 👧👧");
  });
});

describe("loadTwoPlayer", () => {
  let store: Record<string, string>;
  let getItemMock: Mock<Storage["getItem"]>;
  let setItemMock: Mock<Storage["setItem"]>;

  beforeEach(() => {
    (Platform as FakePlatform).OS = "web";
    store = {};
    getItemMock = vi.fn<Storage["getItem"]>(
      (key: string) => store[key] ?? null,
    );
    setItemMock = vi.fn<Storage["setItem"]>((key: string, value: string) => {
      store[key] = value;
    });

    const fakeWindow: FakeWindow = {
      localStorage: {
        getItem: getItemMock,
        setItem: setItemMock,
      },
    };
    vi.stubGlobal("window", fakeWindow);
  });

  afterEach(() => {
    (Platform as FakePlatform).OS = "web";
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads true when saved as "on" in localStorage on web', () => {
    store["kgb.twoPlayer.v1"] = "on";
    expect(loadTwoPlayer()).toBe(true);
    expect(getItemMock).toHaveBeenCalledWith("kgb.twoPlayer.v1");
  });

  it('defaults to false when stored value is "off"', () => {
    store["kgb.twoPlayer.v1"] = "off";
    expect(loadTwoPlayer()).toBe(false);
  });

  it("defaults to false when localStorage has no entry", () => {
    expect(loadTwoPlayer()).toBe(false);
  });

  it("defaults to false when stored value is invalid", () => {
    store["kgb.twoPlayer.v1"] = "yes";
    expect(loadTwoPlayer()).toBe(false);
  });

  it("defaults to false when window.localStorage is undefined", () => {
    vi.stubGlobal("window", {});
    expect(loadTwoPlayer()).toBe(false);
  });

  it("defaults to false when window is undefined", () => {
    vi.unstubAllGlobals();
    expect(loadTwoPlayer()).toBe(false);
  });

  it('defaults to false on non-web platform even if localStorage has "on"', () => {
    (Platform as FakePlatform).OS = "ios";
    store["kgb.twoPlayer.v1"] = "on";
    expect(loadTwoPlayer()).toBe(false);
    expect(getItemMock).not.toHaveBeenCalled();
  });

  it("defaults to false when localStorage.getItem throws SecurityError", () => {
    getItemMock.mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(loadTwoPlayer()).toBe(false);
  });

  it("defaults to false when window.localStorage access throws SecurityError", () => {
    const fakeWindow = {
      get localStorage(): FakeStorage {
        throw new Error("SecurityError");
      },
    };
    vi.stubGlobal("window", fakeWindow);
    expect(loadTwoPlayer()).toBe(false);
  });
});

describe("saveTwoPlayer", () => {
  let store: Record<string, string>;
  let getItemMock: Mock<Storage["getItem"]>;
  let setItemMock: Mock<Storage["setItem"]>;

  beforeEach(() => {
    (Platform as FakePlatform).OS = "web";
    store = {};
    getItemMock = vi.fn<Storage["getItem"]>(
      (key: string) => store[key] ?? null,
    );
    setItemMock = vi.fn<Storage["setItem"]>((key: string, value: string) => {
      store[key] = value;
    });

    const fakeWindow: FakeWindow = {
      localStorage: {
        getItem: getItemMock,
        setItem: setItemMock,
      },
    };
    vi.stubGlobal("window", fakeWindow);
  });

  afterEach(() => {
    (Platform as FakePlatform).OS = "web";
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('persists "on" when true and "off" when false to localStorage on web', () => {
    saveTwoPlayer(true);
    expect(setItemMock).toHaveBeenCalledWith("kgb.twoPlayer.v1", "on");
    expect(store["kgb.twoPlayer.v1"]).toBe("on");

    saveTwoPlayer(false);
    expect(setItemMock).toHaveBeenCalledWith("kgb.twoPlayer.v1", "off");
    expect(store["kgb.twoPlayer.v1"]).toBe("off");
  });

  it("catches and ignores localStorage.setItem errors", () => {
    setItemMock.mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => saveTwoPlayer(true)).not.toThrow();
  });

  it("does not touch localStorage on non-web platform", () => {
    (Platform as FakePlatform).OS = "android";
    saveTwoPlayer(true);
    expect(setItemMock).not.toHaveBeenCalled();
  });

  it("does not throw when window is undefined", () => {
    vi.unstubAllGlobals();
    expect(() => saveTwoPlayer(true)).not.toThrow();
  });
});

describe("nextTurn", () => {
  it("alternates between 0 and 1", () => {
    expect(nextTurn(0)).toBe(1);
    expect(nextTurn(1)).toBe(0);
  });
});
