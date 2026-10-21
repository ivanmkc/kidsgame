import { renderToString } from "react-dom/server";
import React from "react";
import { MenuCard } from "../components/MenuCard";
import { MUSIC_CARDS, WORD_CARDS } from "../menuCards";
import { expect, test, vi } from "vitest";

test("every music-category game is marked beta and renders the pill", () => {
  const onNavigate = vi.fn();

  // Assert every music card has beta: true
  MUSIC_CARDS.forEach((card) => {
    expect(card.beta).toBe(true);
  });

  // Pick an active music game, such as 'bells', to verify the beta pill renders
  const bellsCard = MUSIC_CARDS.find((c) => c.route === "bells")!;
  const html = renderToString(
    <MenuCard
      g={bellsCard}
      lang="en"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );

  expect(html).toContain("BETA");
  expect(html).toContain('data-testid="menu-bells-beta"');
});

test("sounds card title and blurb match whole-word matching in ja, cmn, and yue", () => {
  const onNavigate = vi.fn();
  const soundsCard = WORD_CARDS.find((c) => c.route === "sounds")!;

  const jaHtml = renderToString(
    <MenuCard
      g={soundsCard}
      lang="ja"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(jaHtml).toContain("ことばさがし");
  expect(jaHtml).toContain("きこえた ことばの えを えらぼう");
  expect(jaHtml).not.toContain("はじめのおと");

  const cmnHtml = renderToString(
    <MenuCard
      g={soundsCard}
      lang="cmn"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(cmnHtml).toContain("听词找图");
  expect(cmnHtml).toContain("点你听到的词对应的图");
  expect(cmnHtml).not.toContain("首音");

  const yueHtml = renderToString(
    <MenuCard
      g={soundsCard}
      lang="yue"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(yueHtml).toContain("聽詞搵圖");
  expect(yueHtml).toContain("撳你聽到嘅詞對應嘅圖");
  expect(yueHtml).not.toContain("首音");
});
