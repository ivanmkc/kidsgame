// @vitest-environment happy-dom
import { renderToString } from "react-dom/server";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { MenuCard } from "../components/MenuCard";
import { CardDef } from "../menuCards";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("expo-font", () => ({
  useFonts: () => [true, null],
}));

vi.mock("../analytics", () => ({
  track: vi.fn(),
}));

vi.mock("../sound", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../sound")>();
  return {
    ...actual,
    say: vi.fn(),
  };
});

vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
}));

test("MenuCard shows beta badge only for beta cards", () => {
  const betaCard: CardDef = {
    route: "highlow",
    color: "#5DA9E8",
    key: "highlow",
    preview: "music",
    beta: true,
  };
  const normalCard: CardDef = {
    route: "spotit",
    color: "#E85D75",
    key: "spotit",
    preview: "icons0",
  };

  const onNavigate = vi.fn();

  const betaHtml = renderToString(
    <MenuCard
      g={betaCard}
      lang="en"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(betaHtml).toContain('data-testid="menu-highlow-beta"');
  expect(betaHtml).toContain("BETA");
  expect(betaHtml).toContain(
    'aria-label="High or Low BETA — Was the second note higher or lower?"',
  );

  const jaBetaHtml = renderToString(
    <MenuCard
      g={betaCard}
      lang="ja"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(jaBetaHtml).toContain("ベータ");
  expect(jaBetaHtml).toContain(
    'aria-label="たかい ひくい ベータ — にばんめの おとは たかくなった？ ひくくなった？"',
  );

  const normalHtml = renderToString(
    <MenuCard
      g={normalCard}
      lang="en"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(normalHtml).not.toContain('data-testid="menu-spotit-beta"');
  expect(normalHtml).toContain(
    'aria-label="Spot It! — Find the matching picture on both cards"',
  );
});

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

test.each([
  ["cm-numdots"],
  ["cm-numhan"],
  ["cm-shapes"],
  ["cm-animals"],
  ["cm-picword"],
  ["cm-picspeak"],
  ["cm-colors"],
])(
  "App routes to ConceptMatchGame for %s",
  async (route) => {
    window.location.hash = `#/${route}`;
    const { default: App } = await import("../../App");
    render(<App />);
    expect(screen.getByTestId("concept-board")).toBeTruthy();
  },
  15000,
);

