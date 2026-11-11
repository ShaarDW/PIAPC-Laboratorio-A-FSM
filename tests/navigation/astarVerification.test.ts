import { describe, expect, it } from "vitest";
import { GUARD_START, LAB_MAP, PLAYER_START } from "../../src/application/simulation/labLevel";
import {
  cellKey,
  createGridMap,
  isWalkable,
  type GridMap,
  type GridPoint,
} from "../../src/domain/model/grid";
import { manhattanDistance } from "../../src/domain/navigation/gridGraph";
import { findPathAStar, findPathBfs, type SearchResult } from "../../src/domain/navigation/search";

/** Deterministic PRNG (mulberry32) so every random case can be reproduced from its seed. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomMap(seed: number): { map: GridMap; start: GridPoint; goal: GridPoint } {
  const random = mulberry32(seed);
  const width = 4 + Math.floor(random() * 12);
  const height = 4 + Math.floor(random() * 12);
  const blocked: GridPoint[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (random() < 0.28) {
        blocked.push({ x, y });
      }
    }
  }
  const map = createGridMap(width, height, blocked);
  const free: GridPoint[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isWalkable(map, { x, y })) {
        free.push({ x, y });
      }
    }
  }
  const pick = (): GridPoint => free[Math.floor(random() * free.length)] ?? { x: 0, y: 0 };
  return { map, start: pick(), goal: pick() };
}

function expectValidRoute(map: GridMap, result: SearchResult, start: GridPoint, goal: GridPoint): void {
  expect(result.status).toBe("success");
  expect(result.path[0]).toEqual(start);
  expect(result.path.at(-1)).toEqual(goal);
  expect(result.totalCost).toBe(result.path.length - 1);
  expect(result.path.every((point) => isWalkable(map, point))).toBe(true);
  for (let index = 1; index < result.path.length; index += 1) {
    const previous = result.path[index - 1];
    const current = result.path[index];
    if (!previous || !current) {
      throw new Error("Path index invariant failed.");
    }
    expect(manhattanDistance(previous, current)).toBe(1);
  }
  expect(result.expandedNodes).toBe(result.explored.length);
  expect(result.maximumFrontier).toBeGreaterThanOrEqual(1);
}

describe("A* verification", () => {
  it("returns a zero-cost single-cell route when start equals goal on the lab map", () => {
    const result = findPathAStar(LAB_MAP, GUARD_START, GUARD_START);

    expect(result.status).toBe("success");
    expect(result.path).toEqual([GUARD_START]);
    expect(result.totalCost).toBe(0);
    expect(result.expandedNodes).toBe(1);
  });

  it.each([
    ["outside the grid", { x: -1, y: 5 }],
    ["on a wall", { x: 0, y: 0 }],
    ["with fractional coordinates", { x: 2.5, y: 2 }],
  ])("rejects a start %s without exploring", (_label, start) => {
    const result = findPathAStar(LAB_MAP, start, PLAYER_START);

    expect(result.status).toBe("invalid-start");
    expect(result.path).toEqual([]);
    expect(result.totalCost).toBeNull();
    expect(result.expandedNodes).toBe(0);
    expect(result.maximumFrontier).toBe(0);
  });

  it.each([
    ["outside the grid", { x: 30, y: 5 }],
    ["on a wall", { x: 4, y: 5 }],
  ])("rejects a goal %s without exploring", (_label, goal) => {
    const result = findPathAStar(LAB_MAP, GUARD_START, goal);

    expect(result.status).toBe("invalid-goal");
    expect(result.path).toEqual([]);
    expect(result.expandedNodes).toBe(0);
  });

  it("reports invalid-start first when both endpoints are invalid", () => {
    expect(findPathAStar(LAB_MAP, { x: 0, y: 0 }, { x: 4, y: 5 }).status).toBe("invalid-start");
  });

  it("reports an enclosed goal as unreachable after exhausting the reachable region", () => {
    const pocket = createGridMap(7, 7, [
      { x: 3, y: 2 },
      { x: 2, y: 3 },
      { x: 4, y: 3 },
      { x: 3, y: 4 },
    ]);
    const result = findPathAStar(pocket, { x: 0, y: 0 }, { x: 3, y: 3 });
    const bfs = findPathBfs(pocket, { x: 0, y: 0 }, { x: 3, y: 3 });

    expect(result.status).toBe("unreachable");
    expect(result.path).toEqual([]);
    expect(result.totalCost).toBeNull();
    expect(result.expandedNodes).toBe(7 * 7 - 5);
    expect(bfs.expandedNodes).toBe(result.expandedNodes);
  });

  it.each([
    ["guard to player", GUARD_START, PLAYER_START, 40],
    ["guard to central room", GUARD_START, { x: 12, y: 8 }, 34],
    ["corner to corner", { x: 1, y: 1 }, { x: 28, y: 18 }, 44],
  ])("finds a valid route that avoids blocked cells on the lab map (%s)", (_label, start, goal, cost) => {
    const result = findPathAStar(LAB_MAP, start, goal);

    expectValidRoute(LAB_MAP, result, start, goal);
    expect(result.totalCost).toBe(cost);
  });

  it("matches the BFS optimal cost on 400 reproducible random uniform-cost grids", () => {
    let successes = 0;
    let failures = 0;

    for (let seed = 1; seed <= 400; seed += 1) {
      const { map, start, goal } = randomMap(seed);
      const bfs = findPathBfs(map, start, goal);
      const astar = findPathAStar(map, start, goal);

      expect(astar.status, `seed ${seed}`).toBe(bfs.status);
      expect(astar.totalCost, `seed ${seed}`).toBe(bfs.totalCost);
      if (astar.status === "success") {
        expectValidRoute(map, astar, start, goal);
        successes += 1;
      } else {
        expect(astar.path).toEqual([]);
        failures += 1;
      }
      expect(new Set(astar.explored.map(cellKey)).size, `seed ${seed}`).toBe(astar.explored.length);
    }

    expect(successes).toBeGreaterThan(100);
    expect(failures).toBeGreaterThan(10);
  });

  it("breaks ties reproducibly: lower heuristic first, then insertion order", () => {
    const open = createGridMap(5, 5, []);
    const first = findPathAStar(open, { x: 0, y: 0 }, { x: 2, y: 2 });
    const second = findPathAStar(open, { x: 0, y: 0 }, { x: 2, y: 2 });

    expect(first.path).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ]);
    expect(first.expandedNodes).toBe(5);
    expect(second).toEqual(first);
  });

  it("produces the same detour every time on the detour map", () => {
    const detour = createGridMap(5, 5, [
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
    ]);
    const runs = Array.from({ length: 3 }, () => findPathAStar(detour, { x: 0, y: 0 }, { x: 4, y: 0 }));

    expect(runs[0]?.totalCost).toBe(12);
    expect(runs[0]?.path.some((point) => point.y === 4 && point.x === 2)).toBe(true);
    expect(runs[1]).toEqual(runs[0]);
    expect(runs[2]).toEqual(runs[0]);
  });
});
