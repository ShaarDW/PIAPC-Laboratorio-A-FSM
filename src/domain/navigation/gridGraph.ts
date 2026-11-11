import { isWalkable, type GridMap, type GridPoint } from "../model/grid";

const CARDINAL_DIRECTIONS: readonly GridPoint[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export function walkableNeighbors(map: GridMap, point: GridPoint): GridPoint[] {
  const neighbors: GridPoint[] = [];

  for (const direction of CARDINAL_DIRECTIONS) {
    const candidate = {
      x: point.x + direction.x,
      y: point.y + direction.y,
    };
    if (isWalkable(map, candidate)) {
      neighbors.push(candidate);
    }
  }

  return neighbors;
}

export function manhattanDistance(from: GridPoint, to: GridPoint): number {
  return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
}
