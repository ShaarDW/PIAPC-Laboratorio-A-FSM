import type { GridMap, GridPoint } from "../../domain/model/grid";
import {
  findPathAStar,
  findPathBfs,
  type SearchAlgorithm,
  type SearchResult,
} from "../../domain/navigation/search";

export function calculateRoute(
  map: GridMap,
  start: GridPoint,
  goal: GridPoint,
  algorithm: SearchAlgorithm,
): SearchResult {
  return algorithm === "astar"
    ? findPathAStar(map, start, goal)
    : findPathBfs(map, start, goal);
}
