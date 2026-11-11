import type { GridMap } from "../../domain/model/grid";
import type { GuardControllerConfig } from "./guardController";
import { GUARD_START, LAB_MAP, PATROL_POINTS, TILE_SIZE } from "./labLevel";

export const GUARD_SPEED = 115;
export const VISION_RANGE = 220;
export const FIELD_OF_VIEW = Math.PI / 2;
export const SOUND_RADIUS = 190;
export const SOUND_DURATION_MS = 800;

/** Shared by the scene and the integration tests so traces reproduce the product exactly. */
export function labGuardConfig(map: GridMap = LAB_MAP): GuardControllerConfig {
  return {
    guard: {
      map,
      patrolPoints: PATROL_POINTS,
      searchDurationMs: 4000,
      searchRadius: 2,
      replanIntervalMs: 500,
      relevantChangeCells: 3,
      retryDelayMs: 1500,
    },
    tileSize: TILE_SIZE,
    speed: GUARD_SPEED,
    visionRange: VISION_RANGE,
    fieldOfViewRadians: FIELD_OF_VIEW,
    startCell: GUARD_START,
    startFacing: { x: -1, y: 0 },
  };
}
