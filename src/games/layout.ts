// Clamped sprite placement: positions are % of the stage, but a sprite has
// EXTENT — near an edge the center must pull in by half the sprite or the
// art clips outside the stage (landscape stages get very short).
export function spriteLT(
  pxPct: number,
  pyPct: number,
  size: number,
  stageW: number,
  stageH: number,
): { left: number; top: number } {
  const half = size / 2;
  const cx = Math.min(Math.max((pxPct / 100) * stageW, half), Math.max(half, stageW - half));
  const cy = Math.min(Math.max((pyPct / 100) * stageH, half), Math.max(half, stageH - half));
  return { left: cx - half, top: cy - half };
}
