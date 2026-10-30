/**
 * Regeneration models and asset-path-to-generator mapping.
 */

export const REGEN_MODELS = {
  image: ["gemini-3-pro-image", "gemini-nano-banana-2.1"],
  /** Latest Veo fast model, marked for owner confirmation. */
  video: "veo-3.1-fast-generate-001",
} as const;

export type RegenModelKind = keyof typeof REGEN_MODELS;

export interface GeneratorTarget {
  script: string;
  args: string[];
  model: RegenModelKind;
}

/**
 * Extracts story id from a story video filename or path, following
 * gen_story_videos.py:85-87 (`<sid>_<nid>_<n>.mp4`).
 */
export function storyIdFromVideo(file: string): string | null {
  const norm = file.replace(/\\/g, "/");
  const filename = norm.split("/").pop() ?? "";
  const stem = filename.replace(/\.[^.]+$/, "");
  const underscoreIdx = stem.indexOf("_");
  if (underscoreIdx <= 0) {
    return null;
  }
  return stem.slice(0, underscoreIdx);
}

type PathRule = (normPath: string) => GeneratorTarget | null;

const RULES: readonly PathRule[] = [
  // public/story-video/<sid>_<nid>_<n>.mp4 -> tools/gen_story_videos.py [sid]
  (norm) => {
    if (norm.startsWith("public/story-video/") && norm.endsWith(".mp4")) {
      const sid = storyIdFromVideo(norm);
      if (sid) {
        return {
          script: "tools/gen_story_videos.py",
          args: [sid],
          model: "video",
        };
      }
    }
    return null;
  },
  // assets/game/story/* -> tools/gen_stories.py [story id]
  (norm) => {
    if (norm.startsWith("assets/game/story/")) {
      const rel = norm.slice("assets/game/story/".length);
      if (rel.length > 0) {
        const segment = rel.includes("/") ? rel.split("/")[0] : rel;
        const stem = segment.replace(/\.[^.]+$/, "");
        const storyId = stem.includes("_")
          ? stem.slice(0, stem.indexOf("_"))
          : stem;
        if (storyId.length > 0) {
          return {
            script: "tools/gen_stories.py",
            args: [storyId],
            model: "image",
          };
        }
      }
    }
    return null;
  },
  // assets/game/escape/<room>/ -> tools/gen_escape.py [room]
  (norm) => {
    if (
      norm === "assets/game/escape" ||
      norm.startsWith("assets/game/escape/")
    ) {
      const rel =
        norm === "assets/game/escape"
          ? ""
          : norm.slice("assets/game/escape/".length);
      if (rel.length > 0) {
        const segment = rel.includes("/") ? rel.split("/")[0] : rel;
        const stem = segment.replace(/\.[^.]+$/, "");
        const room = stem.includes("_")
          ? stem.slice(0, stem.indexOf("_"))
          : stem;
        if (room.length > 0) {
          return {
            script: "tools/gen_escape.py",
            args: [room],
            model: "image",
          };
        }
      }
    }
    return null;
  },
  // assets/game/musicbox/<scene>/ -> tools/gen_musicbox_scene.py [scene]
  (norm) => {
    if (
      norm === "assets/game/musicbox" ||
      norm.startsWith("assets/game/musicbox/")
    ) {
      const rel =
        norm === "assets/game/musicbox"
          ? ""
          : norm.slice("assets/game/musicbox/".length);
      if (rel.length > 0) {
        const segment = rel.includes("/") ? rel.split("/")[0] : rel;
        const stem = segment.replace(/\.[^.]+$/, "");
        const scene = stem.includes("_")
          ? stem.slice(0, stem.indexOf("_"))
          : stem;
        if (scene.length > 0) {
          return {
            script: "tools/gen_musicbox_scene.py",
            args: [scene],
            model: "image",
          };
        }
      }
    }
    return null;
  },
  // assets/game/dressup -> tools/gen_dressup.py
  (norm) => {
    if (
      norm === "assets/game/dressup" ||
      norm.startsWith("assets/game/dressup/")
    ) {
      return {
        script: "tools/gen_dressup.py",
        args: [],
        model: "image",
      };
    }
    return null;
  },
  // assets/game/{spotit,diff,hidden,ui} -> tools/generate_assets.py ['--only', <kind>]
  (norm) => {
    const match = norm.match(
      /^assets\/game\/(spotit|diff|hidden|ui)(?:\/.*)?$/,
    );
    if (match) {
      const step = match[1] === "spotit" ? "icons" : match[1];
      return {
        script: "tools/generate_assets.py",
        args: ["--only", step],
        model: "image",
      };
    }
    return null;
  },
];

/**
 * Returns generator script, invocation arguments, and target model kind for an
 * asset path, or null if no generator is known.
 */
export function generatorFor(assetPath: string): GeneratorTarget | null {
  const norm = assetPath
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
  for (const rule of RULES) {
    const target = rule(norm);
    if (target !== null) {
      return target;
    }
  }
  return null;
}
