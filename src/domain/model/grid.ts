export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

export interface GridMap {
  readonly width: number;
  readonly height: number;
  readonly blocked: ReadonlySet<string>;
}

export function cellKey(point: GridPoint): string {
  return `${point.x},${point.y}`;
}

export function createGridMap(
  width: number,
  height: number,
  blockedCells: Iterable<GridPoint>,
): GridMap {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Grid dimensions must be positive integers.");
  }

  const blocked = new Set<string>();
  for (const point of blockedCells) {
    if (!isInside({ width, height }, point)) {
      throw new Error(`Blocked cell is outside the grid: ${cellKey(point)}.`);
    }
    blocked.add(cellKey(point));
  }

  return { width, height, blocked };
}

export function isInside(
  map: Pick<GridMap, "width" | "height">,
  point: GridPoint,
): boolean {
  return Number.isInteger(point.x)
    && Number.isInteger(point.y)
    && point.x >= 0
    && point.y >= 0
    && point.x < map.width
    && point.y < map.height;
}

export function isWalkable(map: GridMap, point: GridPoint): boolean {
  return isInside(map, point) && !map.blocked.has(cellKey(point));
}

export function cellCenter(point: GridPoint, tileSize: number): GridPoint {
  assertValidTileSize(tileSize);
  if (!Number.isInteger(point.x) || !Number.isInteger(point.y)) {
    throw new Error("Grid coordinates must be integers.");
  }
  return {
    x: point.x * tileSize + tileSize / 2,
    y: point.y * tileSize + tileSize / 2,
  };
}

export function worldToCell(point: GridPoint, tileSize: number): GridPoint {
  assertValidTileSize(tileSize);
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error("World coordinates must be finite.");
  }
  return {
    x: Math.floor(point.x / tileSize),
    y: Math.floor(point.y / tileSize),
  };
}

function assertValidTileSize(tileSize: number): void {
  if (!Number.isFinite(tileSize) || tileSize <= 0) {
    throw new Error("Tile size must be finite and positive.");
  }
}
