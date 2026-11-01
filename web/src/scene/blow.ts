export type Point = { x: number; y: number };

export type Wind = {
  /** Degrees. Positive leans the flame to the right, away from a cursor on the left. */
  lean: number;
  shiftX: number;
  /** Radians, from the cursor toward the flame. */
  angle: number;
  distance: number;
  /** 0 at the edge of the wind, 1 with the cursor on the flame. */
  closeness: number;
  extinguish: boolean;
};

/** Wind still bends the flame inside this radius, in CSS pixels. */
export const BLOW_REACH = 520;

/** Holding the button inside this radius puts the flame out. */
export const EXTINGUISH_DISTANCE = 108;

export function windFromCursor(flame: Point, cursor: Point, blowing: boolean): Wind {
  const dx = flame.x - cursor.x;
  const dy = flame.y - cursor.y;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  if (!blowing || distance === 0) {
    return {
      lean: 0,
      shiftX: 0,
      angle,
      distance,
      closeness: 0,
      extinguish: blowing && distance <= EXTINGUISH_DISTANCE,
    };
  }
  const span = Math.max(0, 1 - distance / BLOW_REACH);
  // Squared so a far cursor barely bends the flame, and the bend grows quickly as it comes in.
  const closeness = span * span;
  const nx = dx / distance;
  return {
    lean: nx * closeness * 58,
    shiftX: nx * closeness * 16,
    angle,
    distance,
    closeness,
    extinguish: distance <= EXTINGUISH_DISTANCE,
  };
}

export function pickGhost<T>(ghosts: readonly T[], random: () => number = Math.random): T | null {
  if (ghosts.length === 0) return null;
  const index = Math.min(ghosts.length - 1, Math.floor(random() * ghosts.length));
  return ghosts[index] ?? null;
}
