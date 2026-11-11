import type { GridMap } from "../../domain/model/grid";
import type { Vector2 } from "../../domain/model/vector";
import {
  emptyPerceptionMemory,
  rememberObservation,
  type PerceptionMemory,
} from "../../domain/perception/memory";
import {
  evaluateSound,
  evaluateVision,
  type SoundEvent,
  type VisionResult,
} from "../../domain/perception/perception";

export interface PerceptionSimulationState {
  readonly memory: PerceptionMemory;
  readonly soundEvent: SoundEvent | null;
}

export interface PerceptionFrame {
  readonly state: PerceptionSimulationState;
  readonly vision: VisionResult;
  readonly soundHeard: boolean;
}

export interface PerceptionFrameInput {
  readonly map: GridMap;
  readonly tileSize: number;
  readonly observer: Vector2;
  readonly facing: Vector2;
  readonly target: Vector2;
  readonly visionRange: number;
  readonly fieldOfViewRadians: number;
  readonly timeMs: number;
}

export function initialPerceptionState(): PerceptionSimulationState {
  return { memory: emptyPerceptionMemory(), soundEvent: null };
}

export function withSoundEvent(
  state: PerceptionSimulationState,
  soundEvent: SoundEvent,
): PerceptionSimulationState {
  return { ...state, soundEvent };
}

export function updatePerceptionSimulation(
  state: PerceptionSimulationState,
  input: PerceptionFrameInput,
): PerceptionFrame {
  let memory = state.memory;
  let soundEvent = state.soundEvent;
  let soundHeard = false;

  if (soundEvent) {
    const sound = evaluateSound(input.observer, soundEvent, input.timeMs);
    soundHeard = sound.heard;
    if (sound.heard) {
      memory = rememberObservation(memory, {
        source: "sound",
        position: soundEvent.position,
        observedAtMs: input.timeMs,
      });
    }
    if (!sound.active && input.timeMs > soundEvent.emittedAtMs + soundEvent.durationMs) {
      soundEvent = null;
    }
  }

  const vision = evaluateVision({
    map: input.map,
    tileSize: input.tileSize,
    observer: input.observer,
    facing: input.facing,
    target: input.target,
    range: input.visionRange,
    fieldOfViewRadians: input.fieldOfViewRadians,
  });
  if (vision.visible) {
    memory = rememberObservation(memory, {
      source: "vision",
      position: input.target,
      observedAtMs: input.timeMs,
    });
  }

  return {
    state: { memory, soundEvent },
    vision,
    soundHeard,
  };
}
