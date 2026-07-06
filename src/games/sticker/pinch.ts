// Two-finger transform math for sticker resize/rotate — pure and unit-tested.

export interface Touch2 {
  x0: number; y0: number; x1: number; y1: number;
}

export function dist(t: Touch2): number {
  return Math.hypot(t.x1 - t.x0, t.y1 - t.y0);
}

export function angleDeg(t: Touch2): number {
  return (Math.atan2(t.y1 - t.y0, t.x1 - t.x0) * 180) / Math.PI;
}

/** New (size, rotation) from a pinch that started at `start` and is now at
 *  `now`, applied to the sticker's size/rotation at gesture start. */
export function pinchTransform(
  start: Touch2, now: Touch2, baseSize: number, baseRotation: number,
): { size: number; rotation: number } {
  const scale = dist(start) > 8 ? dist(now) / dist(start) : 1;
  return {
    size: Math.min(0.32, Math.max(0.04, baseSize * scale)),
    rotation: (baseRotation + angleDeg(now) - angleDeg(start)) % 360,
  };
}
