import { SCENE_AR } from '../../manifest';

export interface StickerLayout {
  isLandscape: boolean;
  stageW: number;
  stageH: number;
}

const MIN_STAGE_H = 180;
const MIN_STAGE_W = Math.round(MIN_STAGE_H * SCENE_AR); // 320

/**
 * Computes responsive dimensions and orientation for Sticker Party.
 * On mobile landscape viewports (height < 500), places the stage side-by-side
 * with the sticker tray so neither collapses. Enforces guaranteed minimum
 * playable stage dimensions.
 */
export function stickerLayout(width: number, height: number): StickerLayout {
  const ar = SCENE_AR;
  const isLandscape = width > height && height < 500;

  if (isLandscape) {
    const availH = Math.max(MIN_STAGE_H, height - 100);
    const maxStageW = Math.max(MIN_STAGE_W, width - 24 - 180);
    const stageWFromH = availH * ar;
    const stageW = Math.round(
      Math.max(Math.min(MIN_STAGE_W, width - 24), Math.min(width - 24, maxStageW, stageWFromH, 1100)),
    );
    const stageH = Math.round(stageW / ar);
    return { isLandscape, stageW, stageH };
  }

  const availH = Math.max(MIN_STAGE_H, height - 84 - 180 - 40);
  const maxW = Math.max(MIN_STAGE_W, width - 24);
  const stageW = Math.round(Math.max(Math.min(MIN_STAGE_W, width - 24), Math.min(maxW, availH * ar, 1100)));
  const stageH = Math.round(stageW / ar);
  return { isLandscape, stageW, stageH };
}
