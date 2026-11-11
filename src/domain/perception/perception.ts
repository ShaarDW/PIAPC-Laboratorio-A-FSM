import { isWalkable, worldToCell, type GridMap } from "../model/grid";
import { assertFiniteVector, distanceBetween, normalized, type Vector2 } from "../model/vector";

export type VisionReason = "visible" | "out-of-range" | "outside-cone" | "occluded" | "invalid-facing";

export interface VisionQuery {
  readonly map: GridMap;
  readonly tileSize: number;
  readonly observer: Vector2;
  readonly facing: Vector2;
  readonly target: Vector2;
  readonly range: number;
  readonly fieldOfViewRadians: number;
}

export interface VisionResult {
  readonly visible: boolean;
  readonly reason: VisionReason;
  readonly distance: number;
}

export interface SoundEvent {
  readonly position: Vector2;
  readonly radius: number;
  readonly emittedAtMs: number;
  readonly durationMs: number;
}

export interface SoundResult {
  readonly heard: boolean;
  readonly active: boolean;
  readonly distance: number;
}

export function evaluateVision(query: VisionQuery): VisionResult {
  assertFiniteVector(query.observer);
  assertFiniteVector(query.facing);
  assertFiniteVector(query.target);
  if (
    !Number.isFinite(query.tileSize)
    || query.tileSize <= 0
    || !Number.isFinite(query.range)
    || query.range < 0
    || !Number.isFinite(query.fieldOfViewRadians)
    || query.fieldOfViewRadians < 0
    || query.fieldOfViewRadians > Math.PI * 2
  ) {
    throw new Error("Vision configuration is invalid.");
  }

  const distance = distanceBetween(query.observer, query.target);
  if (distance > query.range) {
    return { visible: false, reason: "out-of-range", distance };
  }

  const facing = normalized(query.facing);
  if (!facing) {
    return { visible: false, reason: "invalid-facing", distance };
  }

  const targetDirection = normalized({
    x: query.target.x - query.observer.x,
    y: query.target.y - query.observer.y,
  });
  if (targetDirection) {
    const dot = facing.x * targetDirection.x + facing.y * targetDirection.y;
    const minimumDot = Math.cos(query.fieldOfViewRadians / 2);
    if (dot + 1e-10 < minimumDot) {
      return { visible: false, reason: "outside-cone", distance };
    }
  }

  if (lineIsOccluded(query.map, query.tileSize, query.observer, query.target)) {
    return { visible: false, reason: "occluded", distance };
  }

  return { visible: true, reason: "visible", distance };
}

export function evaluateSound(
  listener: Vector2,
  event: SoundEvent,
  currentTimeMs: number,
): SoundResult {
  assertFiniteVector(listener);
  assertFiniteVector(event.position);
  if (
    !Number.isFinite(event.radius)
    || event.radius < 0
    || !Number.isFinite(event.emittedAtMs)
    || !Number.isFinite(event.durationMs)
    || event.durationMs < 0
    || !Number.isFinite(currentTimeMs)
  ) {
    throw new Error("Sound event values must be finite and non-negative where required.");
  }

  const distance = distanceBetween(listener, event.position);
  const active = currentTimeMs >= event.emittedAtMs
    && currentTimeMs <= event.emittedAtMs + event.durationMs;
  return { heard: active && distance <= event.radius, active, distance };
}

function lineIsOccluded(
  map: GridMap,
  tileSize: number,
  from: Vector2,
  to: Vector2,
): boolean {
  const start = worldToCell(from, tileSize);
  const end = worldToCell(to, tileSize);
  if (!isWalkable(map, start) || !isWalkable(map, end)) {
    return true;
  }
  let x = start.x;
  let y = start.y;
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const stepX = Math.sign(deltaX);
  const stepY = Math.sign(deltaY);
  const absoluteDeltaX = Math.abs(deltaX);
  const absoluteDeltaY = Math.abs(deltaY);

  while (x !== end.x || y !== end.y) {
    const boundaryX = stepX > 0 ? (x + 1) * tileSize : x * tileSize;
    const boundaryY = stepY > 0 ? (y + 1) * tileSize : y * tileSize;
    const distanceX = stepX === 0 ? Number.POSITIVE_INFINITY : Math.abs(boundaryX - from.x);
    const distanceY = stepY === 0 ? Number.POSITIVE_INFINITY : Math.abs(boundaryY - from.y);
    const crossingX = distanceX * absoluteDeltaY;
    const crossingY = distanceY * absoluteDeltaX;

    if (crossingX === crossingY) {
      if (
        !isWalkable(map, { x: x + stepX, y })
        || !isWalkable(map, { x, y: y + stepY })
      ) {
        return true;
      }
      x += stepX;
      y += stepY;
    } else if (crossingX < crossingY) {
      x += stepX;
    } else {
      y += stepY;
    }

    if (!isWalkable(map, { x, y })) {
      return true;
    }
  }

  return false;
}
