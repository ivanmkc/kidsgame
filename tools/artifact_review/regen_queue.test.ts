import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { main } from "./plan_regen";
import {
  buildRegenQueue,
  extractSpecRef,
  formatPlan,
  isRegenerateVerdict,
  type RegenConfig,
  type VerdictExport,
} from "./regen_queue";

describe("isRegenerateVerdict", () => {
  it("returns true for regenerate variants", () => {
    expect(isRegenerateVerdict("regenerate")).toBe(true);
    expect(isRegenerateVerdict("regenerate-image")).toBe(true);
    expect(isRegenerateVerdict("regenerate-video")).toBe(true);
    expect(isRegenerateVerdict("regenerate_image")).toBe(true);
    expect(isRegenerateVerdict("REGENERATE")).toBe(true);
  });

  it("returns false for keep, unsure, or other non-regenerate verdicts", () => {
    expect(isRegenerateVerdict("keep")).toBe(false);
    expect(isRegenerateVerdict("unsure")).toBe(false);
    expect(isRegenerateVerdict("reject")).toBe(false);
    expect(isRegenerateVerdict("")).toBe(false);
  });
});

describe("extractSpecRef", () => {
  it("extracts positional argument or --only flag argument", () => {
    expect(
      extractSpecRef({
        script: "tools/gen_stories.py",
        args: ["acorn"],
        model: "image",
      }),
    ).toBe("acorn");
    expect(
      extractSpecRef({
        script: "tools/generate_assets.py",
        args: ["--only", "icons"],
        model: "image",
      }),
    ).toBe("icons");
    expect(
      extractSpecRef({
        script: "tools/gen_dressup.py",
        args: [],
        model: "image",
      }),
    ).toBe("");
  });
});

describe("buildRegenQueue", () => {
  it("yields jobs only for regenerate entries, using the image or Veo model from config", () => {
    const verdicts: VerdictExport = [
      { path: "assets/game/story/acorn_a.jpg", verdict: "keep" },
      {
        path: "assets/game/escape/toyroom_clean.png",
        verdict: "regenerate-image",
      },
      {
        path: "public/story-video/luna_start_0.mp4",
        verdict: "regenerate-video",
      },
    ];
    const config: RegenConfig = {
      image: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
      video: "veo-3.1-fast-generate-001",
    };

    const { jobs, unmatched } = buildRegenQueue(verdicts, config);

    expect(unmatched).toEqual([]);
    expect(jobs).toHaveLength(2);

    const imageJob = jobs.find(
      (j) => j.asset === "assets/game/escape/toyroom_clean.png",
    );
    expect(imageJob).toBeDefined();
    expect(imageJob).toEqual({
      asset: "assets/game/escape/toyroom_clean.png",
      mediaKind: "image",
      generator: "tools/gen_escape.py",
      specRef: "toyroom",
      model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
    });

    const videoJob = jobs.find(
      (j) => j.asset === "public/story-video/luna_start_0.mp4",
    );
    expect(videoJob).toBeDefined();
    expect(videoJob).toEqual({
      asset: "public/story-video/luna_start_0.mp4",
      mediaKind: "video",
      generator: "tools/gen_story_videos.py",
      specRef: "luna",
      model: "veo-3.1-fast-generate-001",
    });
  });

  it("puts an asset with no known generator into unmatched and not in jobs", () => {
    const verdicts: VerdictExport = [
      { path: "assets/game/unknown/nonexistent.png", verdict: "regenerate" },
      { path: "assets/game/escape/toyroom_clean.png", verdict: "regenerate" },
    ];

    const { jobs, unmatched } = buildRegenQueue(verdicts);

    expect(unmatched).toEqual(["assets/game/unknown/nonexistent.png"]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].asset).toBe("assets/game/escape/toyroom_clean.png");
  });

  it("surfaces a mismatched verdict kind in unmatched rather than papering over it", () => {
    const verdicts: VerdictExport = [
      {
        path: "assets/game/escape/toyroom_clean.png",
        verdict: "regenerate-video",
      },
    ];

    const { jobs, unmatched } = buildRegenQueue(verdicts);

    expect(jobs).toEqual([]);
    expect(unmatched).toEqual(["assets/game/escape/toyroom_clean.png"]);
  });

  it("surfaces a mismatched verdict kind in unmatched regardless of casing or delimiters", () => {
    const verdicts: VerdictExport = [
      {
        path: "assets/game/escape/toyroom_clean.png",
        verdict: "REGENERATE-VIDEO",
      },
      {
        path: "assets/game/story/acorn_a.jpg",
        verdict: "regenerate_video",
      },
      {
        path: "public/story-video/luna_start_0.mp4",
        verdict: "REGENERATE_IMAGE",
      },
    ];

    const { jobs, unmatched } = buildRegenQueue(verdicts);

    expect(jobs).toEqual([]);
    expect(unmatched).toEqual([
      "assets/game/escape/toyroom_clean.png",
      "assets/game/story/acorn_a.jpg",
      "public/story-video/luna_start_0.mp4",
    ]);
  });

  it("uses default models when config is omitted", () => {
    const verdicts: VerdictExport = [
      { path: "assets/game/story/acorn_a.jpg", verdict: "regenerate" },
      { path: "public/story-video/luna_start_0.mp4", verdict: "regenerate" },
    ];

    const { jobs } = buildRegenQueue(verdicts);

    const storyJob = jobs.find(
      (j) => j.asset === "assets/game/story/acorn_a.jpg",
    );
    expect(storyJob?.model).toEqual([
      "gemini-3-pro-image",
      "gemini-nano-banana-2.1",
    ]);

    const videoJob = jobs.find(
      (j) => j.asset === "public/story-video/luna_start_0.mp4",
    );
    expect(videoJob?.model).toEqual("veo-3.1-fast-generate-001");
  });

  it("sorts jobs and unmatched assets deterministically by path", () => {
    const verdicts: VerdictExport = [
      { path: "assets/game/story/z_story.jpg", verdict: "regenerate" },
      { path: "assets/game/escape/a_room.png", verdict: "regenerate" },
      { path: "assets/game/unknown/z_missing.png", verdict: "regenerate" },
      { path: "assets/game/unknown/a_missing.png", verdict: "regenerate" },
    ];

    const { jobs, unmatched } = buildRegenQueue(verdicts);

    expect(jobs.map((j) => j.asset)).toEqual([
      "assets/game/escape/a_room.png",
      "assets/game/story/z_story.jpg",
    ]);
    expect(unmatched).toEqual([
      "assets/game/unknown/a_missing.png",
      "assets/game/unknown/z_missing.png",
    ]);
  });

  it("handles multiple generator categories and spec references", () => {
    const verdicts: VerdictExport = [
      { path: "assets/game/musicbox/twinkle/bg.png", verdict: "regenerate" },
      { path: "assets/game/dressup/crown.png", verdict: "regenerate" },
      { path: "assets/game/spotit/star.png", verdict: "regenerate" },
    ];

    const { jobs } = buildRegenQueue(verdicts);

    const mb = jobs.find(
      (j) => j.asset === "assets/game/musicbox/twinkle/bg.png",
    );
    expect(mb?.generator).toBe("tools/gen_musicbox_scene.py");
    expect(mb?.specRef).toBe("twinkle");

    const dress = jobs.find((j) => j.asset === "assets/game/dressup/crown.png");
    expect(dress?.generator).toBe("tools/gen_dressup.py");
    expect(dress?.specRef).toBe("");

    const icon = jobs.find((j) => j.asset === "assets/game/spotit/star.png");
    expect(icon?.generator).toBe("tools/generate_assets.py");
    expect(icon?.specRef).toBe("icons");
  });
});

describe("formatPlan", () => {
  it("formats jobs and unmatched section clearly", () => {
    const plan = {
      jobs: [
        {
          asset: "assets/game/story/acorn_a.jpg",
          mediaKind: "image" as const,
          generator: "tools/gen_stories.py",
          specRef: "acorn",
          model: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
        },
      ],
      unmatched: ["assets/game/unknown/orphan.png"],
    };

    const formatted = formatPlan(plan);
    expect(formatted).toContain(
      "assets/game/story/acorn_a.jpg [image] -> tools/gen_stories.py acorn (gemini-3-pro-image, gemini-nano-banana-2.1)",
    );
    expect(formatted).toContain("Unmatched:");
    expect(formatted).toContain("  assets/game/unknown/orphan.png");
  });

  it("prints (none) when unmatched is empty", () => {
    const plan = { jobs: [], unmatched: [] };
    const formatted = formatPlan(plan);
    expect(formatted).toContain("Unmatched:");
    expect(formatted).toContain("  (none)");
  });
});

describe("plan_regen CLI", () => {
  it("prints the plan on a fixture export without calling any model or network", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "regen_cli_test-"));
    const fixturePath = path.join(tmpDir, "review_decisions.json");
    const fixtureData = [
      { path: "assets/game/story/acorn_a.jpg", verdict: "regenerate" },
      { path: "public/story-video/luna_start_0.mp4", verdict: "regenerate" },
      { path: "assets/game/escape/toyroom_clean.png", verdict: "keep" },
      { path: "assets/game/unknown/ghost.png", verdict: "regenerate" },
    ];
    fs.writeFileSync(
      fixturePath,
      JSON.stringify(fixtureData, null, 2),
      "utf-8",
    );

    try {
      const logs: string[] = [];
      const logSpy = vi
        .spyOn(console, "log")
        .mockImplementation((msg?: unknown) => {
          logs.push(String(msg ?? ""));
        });

      const exitCode = main([fixturePath], process.cwd());
      expect(exitCode).toBe(0);

      const output = logs.join("\n");
      expect(output).toContain(
        "assets/game/story/acorn_a.jpg [image] -> tools/gen_stories.py acorn (gemini-3-pro-image, gemini-nano-banana-2.1)",
      );
      expect(output).toContain(
        "public/story-video/luna_start_0.mp4 [video] -> tools/gen_story_videos.py luna (veo-3.1-fast-generate-001)",
      );
      expect(output).not.toContain("toyroom_clean.png");
      expect(output).toContain("Unmatched:");
      expect(output).toContain("  assets/game/unknown/ghost.png");

      logSpy.mockRestore();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
