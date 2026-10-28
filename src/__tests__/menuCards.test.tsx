import { renderToString } from "react-dom/server";
import React from "react";
import { MenuCard } from "../components/MenuCard";
import { GAME_CARDS, MUSIC_CARDS, NUMBER_CARDS, WORD_CARDS } from "../menuCards";
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
  expect(html).toContain(
    'aria-label="Melody Bells BETA — Repeat the tune on the bells!"',
  );
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

test("NUMBER_CARDS and GAME_CARDS register Concept Match decks", () => {
  const numdots = NUMBER_CARDS.find((c) => c.route === "cm-numdots");
  expect(numdots).toBeDefined();
  expect(numdots?.key).toBe("cm-numdots");

  const numhan = NUMBER_CARDS.find((c) => c.route === "cm-numhan");
  expect(numhan).toBeDefined();
  expect(numhan?.key).toBe("cm-numhan");

  const shapes = GAME_CARDS.find((c) => c.route === "cm-shapes");
  expect(shapes).toBeDefined();
  expect(shapes?.key).toBe("cm-shapes");

  const animals = GAME_CARDS.find((c) => c.route === "cm-animals");
  expect(animals).toBeDefined();
  expect(animals?.key).toBe("cm-animals");
});

test("Concept Match menu cards render localized titles and blurbs", () => {
  const onNavigate = vi.fn();
  const numdotsCard = NUMBER_CARDS.find((c) => c.route === "cm-numdots")!;
  const numhanCard = NUMBER_CARDS.find((c) => c.route === "cm-numhan")!;
  const shapesCard = GAME_CARDS.find((c) => c.route === "cm-shapes")!;
  const animalsCard = GAME_CARDS.find((c) => c.route === "cm-animals")!;

  const enHtml = renderToString(
    <MenuCard
      g={numdotsCard}
      lang="en"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(enHtml).toContain("Number Dots");
  expect(enHtml).toContain("Match numbers to the dots!");

  const jaHtml = renderToString(
    <MenuCard
      g={numhanCard}
      lang="ja"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(jaHtml).toContain("かんすうじ");
  expect(jaHtml).toContain("すうじと かんすうじを あわせよう！");

  const cmnHtml = renderToString(
    <MenuCard
      g={shapesCard}
      lang="cmn"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(cmnHtml).toContain("形状配对");
  expect(cmnHtml).toContain("把形状和物品配对！");

  const yueHtml = renderToString(
    <MenuCard
      g={animalsCard}
      lang="yue"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(yueHtml).toContain("動物叫聲");
  expect(yueHtml).toContain("將動物同叫聲配對！");
});

