import { assertFiniteVector, type Vector2 } from "../model/vector";

export type PerceptionSource = "vision" | "sound";

export interface PerceptionObservation {
  readonly source: PerceptionSource;
  readonly position: Vector2;
  readonly observedAtMs: number;
}

export interface PerceptionMemory {
  readonly lastKnownPosition: Vector2 | null;
  readonly lastPerceivedAtMs: number | null;
  readonly source: PerceptionSource | null;
}

export function emptyPerceptionMemory(): PerceptionMemory {
  return {
    lastKnownPosition: null,
    lastPerceivedAtMs: null,
    source: null,
  };
}

export function rememberObservation(
  memory: PerceptionMemory,
  observation: PerceptionObservation,
): PerceptionMemory {
  assertFiniteVector(observation.position);
  if (!Number.isFinite(observation.observedAtMs)) {
    throw new Error("Observation time must be finite.");
  }
  if (
    memory.lastPerceivedAtMs !== null
    && (
      observation.observedAtMs < memory.lastPerceivedAtMs
      || (
        observation.observedAtMs === memory.lastPerceivedAtMs
        && memory.source === "vision"
        && observation.source === "sound"
      )
    )
  ) {
    return memory;
  }

  return {
    lastKnownPosition: { ...observation.position },
    lastPerceivedAtMs: observation.observedAtMs,
    source: observation.source,
  };
}

export function timeSinceLastPerception(
  memory: PerceptionMemory,
  currentTimeMs: number,
): number | null {
  if (!Number.isFinite(currentTimeMs)) {
    throw new Error("Current time must be finite.");
  }
  return memory.lastPerceivedAtMs === null
    ? null
    : Math.max(0, currentTimeMs - memory.lastPerceivedAtMs);
}
