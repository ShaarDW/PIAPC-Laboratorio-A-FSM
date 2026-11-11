import { describe, expect, it } from "vitest";
import { createGridMap, isWalkable, type GridPoint } from "../../src/domain/model/grid";
import { findPathAStar, findPathBfs } from "../../src/domain/navigation/search";

const START: GridPoint = { x: 0, y: 0 };
const GOAL: GridPoint = { x: 4, y: 0 };
const DETOUR_MAP = createGridMap(5, 5, [
  { x: 2, y: 0 },
  { x: 2, y: 1 },
  { x: 2, y: 2 },
  { x: 2, y: 3 },
]);

describe.each([
  ["BFS", findPathBfs],
  ["A*", findPathAStar],
] as const)("%s", (_name, findPath) => {
  it("finds an optimal walkable route", () => {
    const result = findPath(DETOUR_MAP, START, GOAL);

    expect(result.status).toBe("success");
    expect(result.totalCost).toBe(12);
    expect(result.path[0]).toEqual(START);
    expect(result.path.at(-1)).toEqual(GOAL);
    expect(result.path.every((point) => isWalkable(DETOUR_MAP, point))).toBe(true);
    expect(result.expandedNodes).toBeGreaterThan(0);
    expect(result.maximumFrontier).toBeGreaterThan(0);
  });

  it("returns a one-cell path when start equals goal", () => {
    const result = findPath(DETOUR_MAP, START, START);

    expect(result.status).toBe("success");
    expect(result.path).toEqual([START]);
    expect(result.totalCost).toBe(0);
    expect(result.explored).toEqual([START]);
    expect(result.expandedNodes).toBe(1);
    expect(result.maximumFrontier).toBe(1);
  });

  it("reports invalid endpoints without exploring", () => {
    const invalidStart = findPath(DETOUR_MAP, { x: -1, y: 0 }, GOAL);
    const invalidGoal = findPath(DETOUR_MAP, START, { x: 2, y: 0 });

    expect(invalidStart.status).toBe("invalid-start");
    expect(invalidGoal.status).toBe("invalid-goal");
    expect(invalidGoal.expandedNodes).toBe(0);
  });

  it("reports an unreachable goal explicitly", () => {
    const splitMap = createGridMap(3, 3, [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ]);
    const result = findPath(splitMap, { x: 0, y: 1 }, { x: 2, y: 1 });

    expect(result.status).toBe("unreachable");
    expect(result.path).toEqual([]);
    expect(result.totalCost).toBeNull();
    expect(result.expandedNodes).toBe(3);
    expect(result.maximumFrontier).toBe(2);
    expect(result.explored).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 0 },
      { x: 0, y: 2 },
    ]);
  });
});

describe("algorithm comparison", () => {
  it("A* preserves optimal cost while expanding no more nodes than BFS", () => {
    const bfs = findPathBfs(DETOUR_MAP, START, GOAL);
    const astar = findPathAStar(DETOUR_MAP, START, GOAL);

    expect(astar.totalCost).toBe(bfs.totalCost);
    expect(astar.expandedNodes).toBeLessThanOrEqual(bfs.expandedNodes);
  });
});
