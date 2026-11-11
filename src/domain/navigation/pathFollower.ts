import { assertFiniteVector, distanceBetween, type Vector2 } from "../model/vector";

export interface PathFollowerResult {
  readonly position: Vector2;
  readonly nextWaypoint: number;
  readonly completed: boolean;
  readonly direction: Vector2 | null;
}

export function advanceAlongPath(
  position: Vector2,
  waypoints: readonly Vector2[],
  nextWaypoint: number,
  maximumDistance: number,
): PathFollowerResult {
  assertFiniteVector(position);
  waypoints.forEach(assertFiniteVector);
  if (!Number.isInteger(nextWaypoint) || nextWaypoint < 0 || nextWaypoint > waypoints.length) {
    throw new Error("Next waypoint index is outside the path.");
  }
  if (!Number.isFinite(maximumDistance) || maximumDistance < 0) {
    throw new Error("Maximum movement distance must be finite and non-negative.");
  }

  let current = { ...position };
  let index = nextWaypoint;
  let remaining = maximumDistance;
  let direction: Vector2 | null = null;

  while (index < waypoints.length) {
    const target = waypoints[index];
    if (!target) {
      throw new Error("Path waypoint invariant failed.");
    }

    const distance = distanceBetween(current, target);
    if (distance <= Number.EPSILON) {
      current = { ...target };
      index += 1;
      continue;
    }
    if (remaining < distance) {
      const proportion = remaining / distance;
      if (remaining > 0) {
        direction = {
          x: (target.x - current.x) / distance,
          y: (target.y - current.y) / distance,
        };
      }
      current = {
        x: current.x + (target.x - current.x) * proportion,
        y: current.y + (target.y - current.y) * proportion,
      };
      remaining = 0;
      break;
    }

    direction = {
      x: (target.x - current.x) / distance,
      y: (target.y - current.y) / distance,
    };
    current = { ...target };
    remaining -= distance;
    index += 1;
  }

  return {
    position: current,
    nextWaypoint: index,
    completed: index === waypoints.length,
    direction,
  };
}
