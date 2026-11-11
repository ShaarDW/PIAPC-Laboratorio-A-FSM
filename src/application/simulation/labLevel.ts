import { createGridMap, type GridPoint } from "../../domain/model/grid";

export const TILE_SIZE = 32;
export const GRID_WIDTH = 30;
export const GRID_HEIGHT = 20;
export const PLAYER_START: GridPoint = { x: 2, y: 2 };
export const GUARD_START: GridPoint = { x: 27, y: 17 };

interface BlockedRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const BLOCKED_AREAS: readonly BlockedRectangle[] = [
  { x: 0, y: 0, width: GRID_WIDTH, height: 1 },
  { x: 0, y: GRID_HEIGHT - 1, width: GRID_WIDTH, height: 1 },
  { x: 0, y: 0, width: 1, height: GRID_HEIGHT },
  { x: GRID_WIDTH - 1, y: 0, width: 1, height: GRID_HEIGHT },
  { x: 4, y: 3, width: 1, height: 8 },
  { x: 4, y: 3, width: 7, height: 1 },
  { x: 10, y: 3, width: 1, height: 5 },
  { x: 8, y: 10, width: 8, height: 1 },
  { x: 15, y: 6, width: 1, height: 5 },
  { x: 19, y: 3, width: 1, height: 8 },
  { x: 19, y: 10, width: 7, height: 1 },
  { x: 24, y: 10, width: 1, height: 6 },
  { x: 8, y: 15, width: 17, height: 1 },
];

function expandAreas(areas: readonly BlockedRectangle[]): GridPoint[] {
  const cells: GridPoint[] = [];

  for (const area of areas) {
    for (let y = area.y; y < area.y + area.height; y += 1) {
      for (let x = area.x; x < area.x + area.width; x += 1) {
        cells.push({ x, y });
      }
    }
  }

  return cells;
}

export const LAB_MAP = createGridMap(GRID_WIDTH, GRID_HEIGHT, expandAreas(BLOCKED_AREAS));
