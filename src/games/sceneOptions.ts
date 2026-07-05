import { SceneOption } from '../components/ScenePicker';
import { DifficultyFilter, inFilter } from '../difficulty';
import { baseImage, manifest } from '../manifest';

// The "every scene as a backdrop/picture" list — one builder for Puzzle and
// Sticker Party so schema changes and prefix conventions live in one place.
export function allSceneOptions(filter: DifficultyFilter = 'all'): SceneOption[] {
  return [
    ...manifest.diff
      .filter((d) => inFilter(d.level, filter))
      .map((d) => ({ id: `d-${d.id}`, name: d.name, image: baseImage(d), flagged: d.flagged, level: d.level })),
    ...manifest.hidden
      .filter((h) => inFilter(h.level, filter))
      .map((h) => ({ id: `h-${h.id}`, name: h.name, image: h.image, flagged: h.flagged, level: h.level })),
  ];
}
