import { cellKey, isWalkable, type GridMap, type GridPoint } from "../model/grid";
import { manhattanDistance, walkableNeighbors } from "./gridGraph";

export type SearchAlgorithm = "bfs" | "astar";
export type SearchStatus = "success" | "unreachable" | "invalid-start" | "invalid-goal";

export interface SearchResult {
  readonly algorithm: SearchAlgorithm;
  readonly status: SearchStatus;
  readonly path: readonly GridPoint[];
  readonly totalCost: number | null;
  readonly expandedNodes: number;
  readonly maximumFrontier: number;
  readonly explored: readonly GridPoint[];
}

interface AStarNode {
  readonly point: GridPoint;
  readonly cost: number;
  readonly heuristic: number;
  readonly order: number;
}

export function findPathBfs(map: GridMap, start: GridPoint, goal: GridPoint): SearchResult {
  const invalid = validateEndpoints("bfs", map, start, goal);
  if (invalid) {
    return invalid;
  }

  const frontier: GridPoint[] = [start];
  let frontierIndex = 0;
  let maximumFrontier = 1;
  const visited = new Set([cellKey(start)]);
  const parents = new Map<string, GridPoint>();
  const explored: GridPoint[] = [];

  while (frontierIndex < frontier.length) {
    const current = frontier[frontierIndex];
    if (!current) {
      throw new Error("BFS frontier invariant failed.");
    }
    frontierIndex += 1;
    explored.push(current);

    if (samePoint(current, goal)) {
      return successResult("bfs", start, goal, parents, explored, maximumFrontier);
    }

    for (const neighbor of walkableNeighbors(map, current)) {
      const key = cellKey(neighbor);
      if (!visited.has(key)) {
        visited.add(key);
        parents.set(key, current);
        frontier.push(neighbor);
      }
    }

    maximumFrontier = Math.max(maximumFrontier, frontier.length - frontierIndex);
  }

  return failureResult("bfs", "unreachable", explored, maximumFrontier);
}

export function findPathAStar(map: GridMap, start: GridPoint, goal: GridPoint): SearchResult {
  const invalid = validateEndpoints("astar", map, start, goal);
  if (invalid) {
    return invalid;
  }

  let insertionOrder = 0;
  const startKey = cellKey(start);
  const frontier = new Map<string, AStarNode>([
    [
      startKey,
      { point: start, cost: 0, heuristic: manhattanDistance(start, goal), order: insertionOrder },
    ],
  ]);
  const bestCosts = new Map<string, number>([[startKey, 0]]);
  const parents = new Map<string, GridPoint>();
  const explored: GridPoint[] = [];
  const closed = new Set<string>();
  let maximumFrontier = 1;

  while (frontier.size > 0) {
    const current = lowestPriorityNode(frontier);
    const currentKey = cellKey(current.point);
    frontier.delete(currentKey);
    closed.add(currentKey);
    explored.push(current.point);

    if (samePoint(current.point, goal)) {
      return successResult("astar", start, goal, parents, explored, maximumFrontier);
    }

    for (const neighbor of walkableNeighbors(map, current.point)) {
      const neighborKey = cellKey(neighbor);
      if (closed.has(neighborKey)) {
        continue;
      }

      const candidateCost = current.cost + 1;
      const knownCost = bestCosts.get(neighborKey);
      if (knownCost === undefined || candidateCost < knownCost) {
        insertionOrder += 1;
        bestCosts.set(neighborKey, candidateCost);
        parents.set(neighborKey, current.point);
        frontier.set(neighborKey, {
          point: neighbor,
          cost: candidateCost,
          heuristic: manhattanDistance(neighbor, goal),
          order: insertionOrder,
        });
      }
    }

    maximumFrontier = Math.max(maximumFrontier, frontier.size);
  }

  return failureResult("astar", "unreachable", explored, maximumFrontier);
}

function validateEndpoints(
  algorithm: SearchAlgorithm,
  map: GridMap,
  start: GridPoint,
  goal: GridPoint,
): SearchResult | null {
  if (!isWalkable(map, start)) {
    return failureResult(algorithm, "invalid-start", [], 0);
  }
  if (!isWalkable(map, goal)) {
    return failureResult(algorithm, "invalid-goal", [], 0);
  }
  return null;
}

function lowestPriorityNode(frontier: ReadonlyMap<string, AStarNode>): AStarNode {
  let selected: AStarNode | undefined;

  for (const candidate of frontier.values()) {
    const candidateScore = candidate.cost + candidate.heuristic;
    const selectedScore = selected ? selected.cost + selected.heuristic : Number.POSITIVE_INFINITY;
    if (
      !selected
      || candidateScore < selectedScore
      || (candidateScore === selectedScore && candidate.heuristic < selected.heuristic)
      || (
        candidateScore === selectedScore
        && candidate.heuristic === selected.heuristic
        && candidate.order < selected.order
      )
    ) {
      selected = candidate;
    }
  }

  if (!selected) {
    throw new Error("A* frontier invariant failed.");
  }
  return selected;
}

function successResult(
  algorithm: SearchAlgorithm,
  start: GridPoint,
  goal: GridPoint,
  parents: ReadonlyMap<string, GridPoint>,
  explored: readonly GridPoint[],
  maximumFrontier: number,
): SearchResult {
  const path = reconstructPath(start, goal, parents);
  return {
    algorithm,
    status: "success",
    path,
    totalCost: path.length - 1,
    expandedNodes: explored.length,
    maximumFrontier,
    explored,
  };
}

function failureResult(
  algorithm: SearchAlgorithm,
  status: Exclude<SearchStatus, "success">,
  explored: readonly GridPoint[],
  maximumFrontier: number,
): SearchResult {
  return {
    algorithm,
    status,
    path: [],
    totalCost: null,
    expandedNodes: explored.length,
    maximumFrontier,
    explored,
  };
}

function reconstructPath(
  start: GridPoint,
  goal: GridPoint,
  parents: ReadonlyMap<string, GridPoint>,
): GridPoint[] {
  const path: GridPoint[] = [goal];
  let current = goal;

  while (!samePoint(current, start)) {
    const parent = parents.get(cellKey(current));
    if (!parent) {
      throw new Error("Path reconstruction invariant failed.");
    }
    path.push(parent);
    current = parent;
  }

  return path.reverse();
}

function samePoint(left: GridPoint, right: GridPoint): boolean {
  return left.x === right.x && left.y === right.y;
}
