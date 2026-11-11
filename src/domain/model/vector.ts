export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

export function distanceBetween(from: Vector2, to: Vector2): number {
  assertFiniteVector(from);
  assertFiniteVector(to);
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export function normalized(vector: Vector2): Vector2 | null {
  assertFiniteVector(vector);
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) {
    return null;
  }
  return { x: vector.x / length, y: vector.y / length };
}

export function assertFiniteVector(vector: Vector2): void {
  if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y)) {
    throw new Error("Vector components must be finite.");
  }
}
