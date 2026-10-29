// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { ShadowGame } from "../ShadowGame";
import * as logic from "../logic";
import { SHADOW_PROMPTS } from "../logic";
import * as sound from "../../../sound";
const { sfx } = sound;
import { LANGS, Lang } from "../../../lang";
import { t } from "../../../i18n";

describe("ShadowGame", () => {
  const noop = () => {};

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("clamps shadowSize on short viewports", () => {
    vi.stubGlobal("innerWidth", 400);
    vi.stubGlobal("innerHeight", 250);
    fireEvent(window, new Event("resize"));

    const { container } = render(
      <ShadowGame onHome={noop} difficulty="easy" lang="en" />,
    );

    const answerCard = container.querySelector(
      '[data-testid^="shadow-answer-"]',
    );
    expect(answerCard).toBeTruthy();
    expect((answerCard as HTMLElement).style.width).toBe("112px");
    expect((answerCard as HTMLElement).style.height).toBe("112px");
  });

  it("renders correctly across all languages", () => {
    for (const { id: lang } of LANGS) {
      const { container, unmount } = render(
        <ShadowGame onHome={noop} difficulty="easy" lang={lang} />,
      );
      expect(container.innerHTML).toContain(t(lang, "shell.shadow.title"));
      unmount();
    }
  });

  it("speaks localized prompt via speechSynthesis when launched in non-English modes", () => {
    const spokenUtterances: string[] = [];
    class MockUtterance {
      text: string;
      rate = 1;
      pitch = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    const mockSpeechSynthesis = {
      cancel: vi.fn(),
      speak: vi.fn((u: MockUtterance) => {
        spokenUtterances.push(u.text);
      }),
    };
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    vi.stubGlobal("speechSynthesis", mockSpeechSynthesis);
    window.speechSynthesis = mockSpeechSynthesis as unknown as SpeechSynthesis;

    const nonEnLangs: Lang[] = ["ja", "cmn", "yue"];
    for (const lang of nonEnLangs) {
      spokenUtterances.length = 0;
      const { unmount } = render(
        <ShadowGame onHome={noop} difficulty="easy" lang={lang} />,
      );
      expect(spokenUtterances).toContain(SHADOW_PROMPTS[lang]);
      expect(spokenUtterances).not.toContain("Whose shadow is that? Match it!");
      unmount();
    }

    vi.unstubAllGlobals();
  });

  it("renders correct number of options based on difficulty", () => {
    const { container: easyContainer } = render(
      <ShadowGame onHome={() => {}} difficulty="easy" lang="en" />,
    );
    expect(
      easyContainer.querySelectorAll('[data-testid^="shadow-option-"]'),
    ).toHaveLength(3);

    const { container: medContainer } = render(
      <ShadowGame onHome={() => {}} difficulty="medium" lang="en" />,
    );
    expect(
      medContainer.querySelectorAll('[data-testid^="shadow-option-"]'),
    ).toHaveLength(4);

    const { container: hardContainer } = render(
      <ShadowGame onHome={() => {}} difficulty="hard" lang="en" />,
    );
    expect(
      hardContainer.querySelectorAll('[data-testid^="shadow-option-"]'),
    ).toHaveLength(5);
  });

  it("prevents fast-tap hammering on the correct option from advancing score and RNG twice", () => {
    const origMakeShadowRound = logic.makeShadowRound;
    const makeRoundSpy = vi
      .spyOn(logic, "makeShadowRound")
      .mockImplementation((rng, icons, diff) =>
        origMakeShadowRound(rng, icons, diff),
      );

    const sfxGoodSpy = vi.spyOn(sfx, "good").mockImplementation(() => {});

    const { container } = render(
      <ShadowGame onHome={() => {}} difficulty="easy" lang="en" />,
    );

    expect(makeRoundSpy).toHaveBeenCalledTimes(1);

    const answerCard = container.querySelector(
      '[data-testid^="shadow-answer-"]',
    );
    expect(answerCard).toBeTruthy();
    const answer = answerCard
      ?.getAttribute("data-testid")
      ?.replace("shadow-answer-", "");
    const correctBtn = container.querySelector(
      `[data-testid="shadow-option-${answer}"]`,
    ) as HTMLElement;
    expect(correctBtn).toBeTruthy();

    vi.useFakeTimers();
    try {
      act(() => {
        fireEvent.click(correctBtn);
        fireEvent.click(correctBtn);
      });

      // Verify transition is delayed
      expect(makeRoundSpy).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(sfxGoodSpy).toHaveBeenCalledTimes(1);
      expect(makeRoundSpy).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
    expect(
      container.querySelector('[data-testid="shadow-score"]')?.textContent,
    ).toContain("1/10");
  });

  it("does not lock input during wrong-tap feedback", () => {
    vi.useFakeTimers();
    try {
      const sfxWrongSpy = vi.spyOn(sfx, "wrong").mockImplementation(() => {});
      const sfxGoodSpy = vi.spyOn(sfx, "good").mockImplementation(() => {});

      const { container } = render(
        <ShadowGame onHome={() => {}} difficulty="easy" lang="en" />,
      );

      const answerCard = container.querySelector(
        '[data-testid^="shadow-answer-"]',
      );
      expect(answerCard).toBeTruthy();
      const answer = answerCard
        ?.getAttribute("data-testid")
        ?.replace("shadow-answer-", "");
      const correctBtn = container.querySelector(
        `[data-testid="shadow-option-${answer}"]`,
      ) as HTMLElement;
      const wrongBtn = Array.from(
        container.querySelectorAll<HTMLElement>(
          '[data-testid^="shadow-option-"]',
        ),
      ).find(
        (b) => b.getAttribute("data-testid") !== `shadow-option-${answer}`,
      );
      expect(wrongBtn).toBeTruthy();

      act(() => {
        fireEvent.click(wrongBtn!);
      });
      expect(sfxWrongSpy).toHaveBeenCalledTimes(1);

      // Child immediately taps the correct answer
      act(() => {
        fireEvent.click(correctBtn);
      });
      // The tap is processed immediately
      expect(sfxGoodSpy).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(
        container.querySelector('[data-testid="shadow-score"]')?.textContent,
      ).toContain("1/10");
    } finally {
      vi.useRealTimers();
    }
  });

  it("resets game state and unlocks input after completing game", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(
        <ShadowGame onHome={() => {}} difficulty="easy" lang="en" />,
      );

      for (let i = 0; i < 10; i++) {
        const answerCard = container.querySelector(
          '[data-testid^="shadow-answer-"]',
        );
        const answer = answerCard
          ?.getAttribute("data-testid")
          ?.replace("shadow-answer-", "");
        const correctBtn = container.querySelector(
          `[data-testid="shadow-option-${answer}"]`,
        ) as HTMLElement;
        act(() => {
          fireEvent.click(correctBtn);
        });
        if (i < 9) {
          const currentAnswer = container
            .querySelector('[data-testid^="shadow-answer-"]')
            ?.getAttribute("data-testid")
            ?.replace("shadow-answer-", "");
          expect(currentAnswer).toBe(answer);
        }
        act(() => {
          vi.advanceTimersByTime(10000);
        });
      }

      expect(
        container.querySelector('[data-testid="shadow-score"]')?.textContent,
      ).toContain("10/10");
      expect(
        container.querySelector('[data-testid="win-overlay"]'),
      ).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(600);
      });

      const playAgainBtn = container.querySelector(
        '[data-testid="play-again"]',
      ) as HTMLElement;
      expect(playAgainBtn).toBeTruthy();

      act(() => {
        fireEvent.click(playAgainBtn);
      });

      expect(
        container.querySelector('[data-testid="shadow-score"]')?.textContent,
      ).toContain("0/10");

      const newAnswerCard = container.querySelector(
        '[data-testid^="shadow-answer-"]',
      );
      const newAnswer = newAnswerCard
        ?.getAttribute("data-testid")
        ?.replace("shadow-answer-", "");
      const newCorrectBtn = container.querySelector(
        `[data-testid="shadow-option-${newAnswer}"]`,
      ) as HTMLElement;

      act(() => {
        fireEvent.click(newCorrectBtn);
      });
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(
        container.querySelector('[data-testid="shadow-score"]')?.textContent,
      ).toContain("1/10");
    } finally {
      vi.useRealTimers();
    }
  });

  it("applies transform on round 1 (after exactly one warmup round) on hard difficulty", () => {
    const origMakeShadowRound = logic.makeShadowRound;
    const makeRoundSpy = vi
      .spyOn(logic, "makeShadowRound")
      .mockImplementation((rng, icons, diff) =>
        origMakeShadowRound(rng, icons, diff),
      );

    const { container } = render(
      <ShadowGame onHome={() => {}} difficulty="hard" lang="en" />,
    );

    // Round 0 (warmup)
    expect(makeRoundSpy).toHaveBeenCalledTimes(1);
    expect(makeRoundSpy).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        choices: 5,
        categoryDistractors: true,
        transform: false,
      }),
    );

    // Solve Round 0
    const answerCard = container.querySelector(
      '[data-testid^="shadow-answer-"]',
    );
    const answer = answerCard
      ?.getAttribute("data-testid")
      ?.replace("shadow-answer-", "");
    const correctBtn = container.querySelector(
      `[data-testid="shadow-option-${answer}"]`,
    ) as HTMLElement;

    vi.useFakeTimers();
    try {
      act(() => {
        fireEvent.click(correctBtn);
      });

      // Verify transition is delayed
      expect(makeRoundSpy).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Round 1 (mental rotation kicks in immediately after the single warmup round)
      expect(makeRoundSpy).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
    expect(makeRoundSpy).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        choices: 5,
        categoryDistractors: true,
        transform: true,
      }),
      expect.anything(),
    );
  });

  it("sets localized accessibilityLabel on option buttons across non-English modes", () => {
    const nonEnLangs: Lang[] = ["ja", "cmn", "yue"];
    for (const lang of nonEnLangs) {
      const { container, unmount } = render(
        <ShadowGame onHome={noop} difficulty="easy" lang={lang} />,
      );
      const options = container.querySelectorAll<HTMLElement>(
        '[data-testid^="shadow-option-"]',
      );
      expect(options.length).toBeGreaterThan(0);
      for (const opt of options) {
        const icon = opt
          .getAttribute("data-testid")!
          .replace("shadow-option-", "");
        const expectedLabel = logic.shadowOptionLabel(icon, lang);
        expect(opt.getAttribute("aria-label")).toBe(expectedLabel);
        expect(opt.getAttribute("aria-label")).not.toBe(icon);
      }
      unmount();
    }
  });

  it("updates option button aria-labels when lang prop changes", () => {
    const { container, rerender } = render(
      <ShadowGame onHome={noop} difficulty="easy" lang="ja" />,
    );
    const optionsJa = container.querySelectorAll<HTMLElement>(
      '[data-testid^="shadow-option-"]',
    );
    const firstOption = optionsJa[0];
    const icon = firstOption
      .getAttribute("data-testid")!
      .replace("shadow-option-", "");
    expect(firstOption.getAttribute("aria-label")).toBe(
      logic.shadowOptionLabel(icon, "ja"),
    );

    rerender(<ShadowGame onHome={noop} difficulty="easy" lang="en" />);
    const optionsEn = container.querySelectorAll<HTMLElement>(
      '[data-testid^="shadow-option-"]',
    );
    expect(optionsEn[0].getAttribute("aria-label")).toBe(
      logic.shadowOptionLabel(icon, "en"),
    );
  });
  it("speaks the vocabulary word when the correct option is tapped and delays round advancement", () => {
    vi.useFakeTimers();
    try {
      const saySpy = vi.spyOn(sound, "say");
      const { container } = render(
        <ShadowGame onHome={() => {}} difficulty="easy" lang="en" />,
      );

      const answerCard = container.querySelector(
        '[data-testid^="shadow-answer-"]',
      );
      const answer = answerCard
        ?.getAttribute("data-testid")
        ?.replace("shadow-answer-", "");
      const correctBtn = container.querySelector(
        `[data-testid="shadow-option-${answer}"]`,
      ) as HTMLElement;

      saySpy.mockClear();

      act(() => {
        fireEvent.click(correctBtn);
      });

      expect(saySpy).toHaveBeenCalledWith(
        logic.shadowOptionLabel(answer!, "en"),
      );

      expect(
        container.querySelector('[data-testid="shadow-score"]')?.textContent,
      ).toContain("1/10");

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(
        container.querySelector('[data-testid="shadow-score"]')?.textContent,
      ).toContain("1/10");
    } finally {
      vi.useRealTimers();
    }
  });

  it("speaks both vocabulary word and win message in sequence on the winning round", () => {
    vi.useFakeTimers();
    try {
      const saySeqSpy = vi.spyOn(sound, "saySequence");
      const { container } = render(
        <ShadowGame onHome={() => {}} difficulty="easy" lang="en" />,
      );

      for (let i = 0; i < 9; i++) {
        const answerCard = container.querySelector(
          '[data-testid^="shadow-answer-"]',
        );
        const answer = answerCard
          ?.getAttribute("data-testid")
          ?.replace("shadow-answer-", "");
        const correctBtn = container.querySelector(
          `[data-testid="shadow-option-${answer}"]`,
        ) as HTMLElement;
        act(() => {
          fireEvent.click(correctBtn);
        });
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }

      saySeqSpy.mockClear();

      const lastAnswerCard = container.querySelector(
        '[data-testid^="shadow-answer-"]',
      );
      const lastAnswer = lastAnswerCard
        ?.getAttribute("data-testid")
        ?.replace("shadow-answer-", "");
      const lastCorrectBtn = container.querySelector(
        `[data-testid="shadow-option-${lastAnswer}"]`,
      ) as HTMLElement;

      act(() => {
        fireEvent.click(lastCorrectBtn);
      });

      expect(saySeqSpy).toHaveBeenCalledWith([
        logic.shadowOptionLabel(lastAnswer!, "en"),
        t("en", "win.shadow"),
      ]);
      expect(
        container.querySelector('[data-testid="shadow-score"]')?.textContent,
      ).toContain("10/10");
    } finally {
      vi.useRealTimers();
    }
  });
});
