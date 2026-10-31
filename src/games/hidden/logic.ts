export const MIN_SCENE_W = 320;

export interface HiddenLayout {
  isLandscape: boolean;
  sceneWidth: number;
  sidebarWidth: number;
}

/**
 * Computes responsive layout dimensions for HiddenGame.
 * In landscape (width > height), the checklist and turn banner are placed
 * in a side column beside the scene so the search scene does not collapse into a thumbnail.
 * Enforces a minimum playable scene width (320px) bounded by available space.
 */
export function hiddenLayout(
  width: number,
  height: number,
  coop = false,
  ar = 16 / 9,
): HiddenLayout {
  const isLandscape = width > height;

  if (isLandscape) {
    const sidebarWidth = width >= 800 ? 180 : 160;
    const headerH = coop && width < 750 ? 124 : 84;
    const availH = Math.max(0, height - headerH - 16);
    const maxW = Math.max(0, width - sidebarWidth - 36);
    const minW = Math.min(MIN_SCENE_W, maxW);
    const sceneWidth = Math.round(
      Math.min(maxW, Math.max(minW, availH * ar), 1100),
    );
    return { isLandscape, sceneWidth, sidebarWidth };
  }

  const availH = Math.max(0, height - 84 - 122 - (coop ? 56 : 0));
  const maxW = Math.max(0, width - 24);
  const minW = Math.min(MIN_SCENE_W, maxW);
  const sceneWidth = Math.round(
    Math.min(maxW, Math.max(minW, availH * ar), 1100),
  );
  return { isLandscape, sceneWidth, sidebarWidth: 0 };
}
