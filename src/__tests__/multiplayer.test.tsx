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
  MP_PLAYERS,
  nextTurn,
  PlayerChip,
  saveTwoPlayer,
} from "../multiplayer";
import { t } from "../i18n";

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

describe("MP_PLAYERS", () => {
  it("stores translation keys that resolve across all supported languages", () => {
    expect(MP_PLAYERS[0].name).toBe("mp.foxy");
    expect(MP_PLAYERS[1].name).toBe("mp.bunny");

    expect(t("en", MP_PLAYERS[0].name)).toBe("Foxy");
    expect(t("ja", MP_PLAYERS[0].name)).toBe("きつね");
    expect(t("cmn", MP_PLAYERS[0].name)).toBe("狐狸");
    expect(t("yue", MP_PLAYERS[0].name)).toBe("狐狸");

    expect(t("en", MP_PLAYERS[1].name)).toBe("Bunny");
    expect(t("ja", MP_PLAYERS[1].name)).toBe("うさぎ");
    expect(t("cmn", MP_PLAYERS[1].name)).toBe("兔子");
    expect(t("yue", MP_PLAYERS[1].name)).toBe("兔仔");
  });
});

describe("PlayerChip", () => {
  it("renders localized accessibilityLabel in English", () => {
    const html = renderToString(
      <PlayerChip player={0} count={3} active={true} testID="test-chip-0" lang="en" />
    );
    expect(html).toContain('aria-label="Foxy has 3"');
  });

  it("renders localized accessibilityLabel in Japanese", () => {
    const htmlFoxy = renderToString(
      <PlayerChip player={0} count={3} active={true} testID="test-chip-0" lang="ja" />
    );
    expect(htmlFoxy).toContain('aria-label="きつねは 3こ"');

    const htmlBunny = renderToString(
      <PlayerChip player={1} count={2} active={false} testID="test-chip-1" lang="ja" />
    );
    expect(htmlBunny).toContain('aria-label="うさぎは 2こ"');
  });

  it("renders localized accessibilityLabel in Mandarin and Cantonese", () => {
    const htmlCmn = renderToString(
      <PlayerChip player={0} count={5} active={true} testID="test-chip-0" lang="cmn" />
    );
    expect(htmlCmn).toContain('aria-label="狐狸有 5 个"');

    const htmlYue = renderToString(
      <PlayerChip player={1} count={4} active={false} testID="test-chip-1" lang="yue" />
    );
    expect(htmlYue).toContain('aria-label="兔仔有 4 個"');
  });
});

