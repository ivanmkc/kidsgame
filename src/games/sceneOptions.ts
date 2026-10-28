import { SceneOption } from "../components/ScenePicker";
import { DifficultyFilter, inFilter } from "../difficulty";
import { Lang } from "../lang";
import { baseImage, manifest } from "../manifest";

// The "every scene as a backdrop/picture" list — one builder for Puzzle and
// Sticker Party so schema changes and prefix conventions live in one place.
export function allSceneOptions(
  filter: DifficultyFilter = "all",
  lang: Lang = "en",
): SceneOption[] {
  return [
    ...manifest.diff
      .filter((d) => inFilter(d.level, filter))
      .map((d) => ({
        id: `d-${d.id}`,
        name: d.nameT?.[lang] ?? d.name,
        image: baseImage(d),
        flagged: d.flagged,
        level: d.level,
      })),
    ...manifest.hidden
      .filter((h) => inFilter(h.level, filter))
      .map((h) => ({
        id: `h-${h.id}`,
        name: h.nameT?.[lang] ?? h.name,
        image: h.image,
        flagged: h.flagged,
        level: h.level,
      })),
  ];
}
