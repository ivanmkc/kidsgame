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

test("WORD_CARDS, NUMBER_CARDS and GAME_CARDS register Concept Match decks", () => {
  const picword = WORD_CARDS.find((c) => c.route === "cm-picword");
  expect(picword).toBeDefined();
  expect(picword?.key).toBe("cm-picword");

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

  const picspeak = WORD_CARDS.find((c) => c.route === "cm-picspeak");
  expect(picspeak).toBeDefined();
  expect(picspeak?.key).toBe("cm-picspeak");

  const colors = WORD_CARDS.find((c) => c.route === "cm-colors");
  expect(colors).toBeDefined();
  expect(colors?.key).toBe("cm-colors");
});

test("Concept Match menu cards render localized titles and blurbs", () => {
  const onNavigate = vi.fn();
  const picwordCard = WORD_CARDS.find((c) => c.route === "cm-picword")!;
  const picspeakCard = WORD_CARDS.find((c) => c.route === "cm-picspeak")!;
  const colorsCard = WORD_CARDS.find((c) => c.route === "cm-colors")!;
  const numdotsCard = NUMBER_CARDS.find((c) => c.route === "cm-numdots")!;
  const numhanCard = NUMBER_CARDS.find((c) => c.route === "cm-numhan")!;
  const shapesCard = GAME_CARDS.find((c) => c.route === "cm-shapes")!;
  const animalsCard = GAME_CARDS.find((c) => c.route === "cm-animals")!;

  const picspeakHtml = renderToString(
    <MenuCard
      g={picspeakCard}
      lang="en"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(picspeakHtml).toContain("Picture &amp; Audio");
  expect(picspeakHtml).toContain("Match the picture to the spoken word!");

  const picwordHtml = renderToString(
    <MenuCard
      g={picwordCard}
      lang="en"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(picwordHtml).toContain("Picture &amp; Word");
  expect(picwordHtml).toContain("Match the picture to its word!");

  const colorsHtml = renderToString(
    <MenuCard
      g={colorsCard}
      lang="en"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(colorsHtml).toContain("Colors &amp; Words");
  expect(colorsHtml).toContain("Match the color to its word!");

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

  const picwordJaHtml = renderToString(
    <MenuCard
      g={picwordCard}
      lang="ja"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(picwordJaHtml).toContain("絵と言葉");
  expect(picwordJaHtml).toContain("絵と言葉を合わせよう！");

  const picwordCmnHtml = renderToString(
    <MenuCard
      g={picwordCard}
      lang="cmn"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(picwordCmnHtml).toContain("图片与文字");
  expect(picwordCmnHtml).toContain("把图片和文字连成对！");

  const picwordYueHtml = renderToString(
    <MenuCard
      g={picwordCard}
      lang="yue"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(picwordYueHtml).toContain("圖片同文字");
  expect(picwordYueHtml).toContain("將圖片同文字配成一對！");
});


test("WORD_CARDS registers Word Family card with beta: true and localized text", () => {
  const onNavigate = vi.fn();
  const wordfamilyCard = WORD_CARDS.find((c) => c.route === "wordfamily")!;
  expect(wordfamilyCard).toBeDefined();
  expect(wordfamilyCard.beta).toBe(true);

  const enHtml = renderToString(
    <MenuCard
      g={wordfamilyCard}
      lang="en"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(enHtml).toContain("Word Family");
  expect(enHtml).toContain("Match the sound to make a word!");

  const cmnHtml = renderToString(
    <MenuCard
      g={wordfamilyCard}
      lang="cmn"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(cmnHtml).toContain("词族");
  expect(cmnHtml).toContain("配对发音，拼出单词！");

  const jaHtml = renderToString(
    <MenuCard
      g={wordfamilyCard}
      lang="ja"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(jaHtml).toContain("ことばの かぞく");
  expect(jaHtml).toContain("おとを あわせて ことばを つくろう！");

  const yueHtml = renderToString(
    <MenuCard
      g={wordfamilyCard}
      lang="yue"
      cardWidth={100}
      onNavigate={onNavigate}
      preview={<div>preview</div>}
    />,
  );
  expect(yueHtml).toContain("詞語家族");
  expect(yueHtml).toContain("配對發音，砌出字詞！");
});
