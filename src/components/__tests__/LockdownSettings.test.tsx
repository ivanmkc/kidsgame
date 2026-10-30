// @vitest-environment happy-dom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { LockdownSettings } from "../LockdownSettings";
import { LangContext } from "../GameShell";
import { t } from "../../i18n";

afterEach(cleanup);

describe("LockdownSettings Interactive", () => {
  it("toggles game", () => {
    const onToggleGame = vi.fn();
    render(
      <LockdownSettings
        hiddenGames={[]}
        hiddenLangs={[]}
        onToggleGame={onToggleGame}
        onToggleLang={vi.fn()}
        onDone={vi.fn()}
      />,
    );
    const inputs = screen.getAllByTestId("lock-game-bingo");
    const input = inputs[0].querySelector("input");
    fireEvent.click(input!);
    expect(onToggleGame).toHaveBeenCalledTimes(1);
    expect(onToggleGame).toHaveBeenCalledWith("bingo");
  });

  it("toggles game when tapping row label or row container", () => {
    const onToggleGame = vi.fn();
    render(
      <LockdownSettings
        hiddenGames={[]}
        hiddenLangs={[]}
        onToggleGame={onToggleGame}
        onToggleLang={vi.fn()}
        onDone={vi.fn()}
      />,
    );
    const label = screen.getByText(t("en", "card.bingo.title"));
    fireEvent.click(label);
    expect(onToggleGame).toHaveBeenCalledTimes(1);
    expect(onToggleGame).toHaveBeenCalledWith("bingo");

    const row = screen.getByTestId("lock-row-game-spotit");
    fireEvent.click(row);
    expect(onToggleGame).toHaveBeenCalledTimes(2);
    expect(onToggleGame).toHaveBeenCalledWith("spotit");
  });

  it("toggles lang ok", () => {
    const onToggleLang = vi.fn().mockReturnValue(true);
    render(
      <LockdownSettings
        hiddenGames={[]}
        hiddenLangs={[]}
        onToggleGame={vi.fn()}
        onToggleLang={onToggleLang}
        onDone={vi.fn()}
      />,
    );
    const inputs = screen.getAllByTestId("lock-lang-ja");
    const input = inputs[0].querySelector("input");
    fireEvent.click(input!);
    expect(onToggleLang).toHaveBeenCalledWith("ja");
    expect(
      screen.queryByText("At least one language must remain visible."),
    ).toBeNull();
  });

  it("toggles language when tapping language row label or row container", () => {
    const onToggleLang = vi.fn().mockReturnValue(true);
    render(
      <LockdownSettings
        hiddenGames={[]}
        hiddenLangs={[]}
        onToggleGame={vi.fn()}
        onToggleLang={onToggleLang}
        onDone={vi.fn()}
      />,
    );
    const label = screen.getByText(/日本語/);
    fireEvent.click(label);
    expect(onToggleLang).toHaveBeenCalledTimes(1);
    expect(onToggleLang).toHaveBeenCalledWith("ja");

    const row = screen.getByTestId("lock-row-lang-cmn");
    fireEvent.click(row);
    expect(onToggleLang).toHaveBeenCalledTimes(2);
    expect(onToggleLang).toHaveBeenCalledWith("cmn");
  });

  it("toggles lang fail", () => {
    vi.useFakeTimers();
    const onToggleLang = vi.fn().mockReturnValue(false);
    render(
      <LockdownSettings
        hiddenGames={[]}
        hiddenLangs={[]}
        onToggleGame={vi.fn()}
        onToggleLang={onToggleLang}
        onDone={vi.fn()}
      />,
    );
    const inputs = screen.getAllByTestId("lock-lang-en");
    const input = inputs[0].querySelector("input");
    fireEvent.click(input!);
    expect(onToggleLang).toHaveBeenCalledWith("en");
    expect(
      screen.getByText("At least one language must remain visible."),
    ).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(
      screen.queryByText("At least one language must remain visible."),
    ).toBeNull();

    vi.useRealTimers();
  });

  it("shows localized warning and titles in non-English mode", () => {
    vi.useFakeTimers();
    const onToggleLang = vi.fn().mockReturnValue(false);
    render(
      <LangContext.Provider value={{ lang: "ja", onCycle: vi.fn() }}>
        <LockdownSettings
          hiddenGames={["bingo"]}
          hiddenLangs={[]}
          onToggleGame={vi.fn()}
          onToggleLang={onToggleLang}
          onDone={vi.fn()}
        />
      </LangContext.Provider>,
    );
    expect(screen.getByText(t("ja", "lockdown.title"))).toBeTruthy();
    expect(screen.getByText(t("ja", "lockdown.subtitle"))).toBeTruthy();
    expect(screen.getByText(t("ja", "lockdown.languages"))).toBeTruthy();
    expect(
      screen.getByText(t("ja", "lockdown.doneHidden", { n: 1 })),
    ).toBeTruthy();

    const inputs = screen.getAllByTestId("lock-lang-ja");
    const input = inputs[0].querySelector("input");
    fireEvent.click(input!);
    expect(onToggleLang).toHaveBeenCalledWith("ja");
    expect(screen.getByText(t("ja", "lockdown.warning"))).toBeTruthy();
    expect(
      screen.queryByText("At least one language must remain visible."),
    ).toBeNull();

    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.queryByText(t("ja", "lockdown.warning"))).toBeNull();

    vi.useRealTimers();
  });
});
