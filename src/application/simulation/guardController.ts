import { cellCenter, worldToCell, type GridPoint } from "../../domain/model/grid";
import type { Vector2 } from "../../domain/model/vector";
import {
  createGuardContext,
  handleGuardEvent,
  handleGuardFrame,
  type GuardCommand,
  type GuardConfig,
  type GuardContext,
  type GuardEvent,
  type RouteFailureStatus,
  type TransitionRecord,
} from "../../domain/behavior/guardStateMachine";
import { advanceAlongPath } from "../../domain/navigation/pathFollower";
import type { SearchAlgorithm, SearchResult } from "../../domain/navigation/search";
import type { SoundEvent, VisionReason, VisionResult } from "../../domain/perception/perception";
import { calculateRoute } from "./navigationDemo";
import {
  initialPerceptionState,
  updatePerceptionSimulation,
  withSoundEvent,
  type PerceptionSimulationState,
} from "./perceptionSimulation";

export interface GuardControllerConfig {
  readonly guard: GuardConfig;
  readonly tileSize: number;
  readonly speed: number;
  readonly visionRange: number;
  readonly fieldOfViewRadians: number;
  readonly startCell: GridPoint;
  readonly startFacing: Vector2;
}

export interface RouteSummary {
  readonly algorithm: SearchAlgorithm;
  readonly goal: GridPoint;
  readonly status: SearchResult["status"];
  readonly cost: number | null;
  readonly expandedNodes: number;
  readonly maximumFrontier: number;
}

export interface TelemetryEntry extends TransitionRecord {
  readonly guardCell: GridPoint;
  readonly vision: VisionReason | null;
  readonly route: RouteSummary | null;
}

interface PendingFailure {
  readonly goal: GridPoint;
  readonly status: RouteFailureStatus;
}

export interface GuardControllerState {
  readonly fsm: GuardContext;
  readonly perception: PerceptionSimulationState;
  readonly position: Vector2;
  readonly facing: Vector2;
  readonly waypoints: readonly Vector2[];
  readonly nextWaypoint: number;
  readonly route: SearchResult | null;
  readonly routeGoal: GridPoint | null;
  readonly algorithm: SearchAlgorithm;
  readonly wasVisible: boolean;
  readonly arrivalPending: GridPoint | null;
  readonly failurePending: PendingFailure | null;
  readonly lastHeardSoundAtMs: number | null;
  readonly lastEntry: TelemetryEntry | null;
}

export interface GuardFrameInput {
  readonly timeMs: number;
  readonly deltaMs: number;
  readonly playerPosition: Vector2;
  readonly newSound?: SoundEvent | null;
  readonly algorithm?: SearchAlgorithm;
  readonly reset?: boolean;
}

export interface GuardFrameOutput {
  readonly state: GuardControllerState;
  readonly vision: VisionResult | null;
  readonly soundHeard: boolean;
  readonly entries: readonly TelemetryEntry[];
}

export function createGuardController(
  config: GuardControllerConfig,
  timeMs: number,
  algorithm: SearchAlgorithm = "astar",
): GuardControllerState {
  const step = createGuardContext(config.guard, timeMs);
  const base: GuardControllerState = {
    fsm: step.context,
    perception: initialPerceptionState(),
    position: cellCenter(config.startCell, config.tileSize),
    facing: { ...config.startFacing },
    waypoints: [],
    nextWaypoint: 0,
    route: null,
    routeGoal: null,
    algorithm,
    wasVisible: false,
    arrivalPending: null,
    failurePending: null,
    lastHeardSoundAtMs: null,
    lastEntry: null,
  };
  return step.command ? applyCommand(base, step.command, config) : base;
}

/**
 * One simulation frame: perception -> events -> FSM -> navigation command -> locomotion.
 * Search runs only when the FSM emits a navigate command, never every frame.
 */
export function stepGuardController(
  state: GuardControllerState,
  input: GuardFrameInput,
  config: GuardControllerConfig,
): GuardFrameOutput {
  if (!Number.isFinite(input.timeMs) || !Number.isFinite(input.deltaMs) || input.deltaMs < 0) {
    throw new Error("Frame time and delta must be finite and delta non-negative.");
  }
  const algorithm = input.algorithm ?? state.algorithm;
  const guardCell = worldToCell(state.position, config.tileSize);

  if (input.reset) {
    const step = handleGuardEvent(state.fsm, { type: "reset", timeMs: input.timeMs, guardCell }, config.guard);
    const fresh = createGuardController(config, input.timeMs, algorithm);
    const restarted = { ...fresh, fsm: step.context };
    const entries = step.record ? [entry(step.record, guardCell, null, restarted.route, restarted.algorithm)] : [];
    return {
      state: { ...restarted, lastEntry: entries.at(-1) ?? null },
      vision: null,
      soundHeard: false,
      entries,
    };
  }

  let perception = state.perception;
  if (input.newSound) {
    perception = withSoundEvent(perception, input.newSound);
  }
  const frame = updatePerceptionSimulation(perception, {
    map: config.guard.map,
    tileSize: config.tileSize,
    observer: state.position,
    facing: state.facing,
    target: input.playerPosition,
    visionRange: config.visionRange,
    fieldOfViewRadians: config.fieldOfViewRadians,
    timeMs: input.timeMs,
  });

  const events: GuardEvent[] = [];
  const base = { timeMs: input.timeMs, guardCell };
  if (frame.vision.visible) {
    events.push({ ...base, type: "player-seen", cell: worldToCell(input.playerPosition, config.tileSize) });
  } else if (state.wasVisible) {
    events.push({ ...base, type: "player-lost" });
  }
  let lastHeardSoundAtMs = state.lastHeardSoundAtMs;
  const sound = perception.soundEvent;
  if (frame.soundHeard && sound && sound.emittedAtMs !== lastHeardSoundAtMs) {
    lastHeardSoundAtMs = sound.emittedAtMs;
    events.push({ ...base, type: "sound-heard", cell: worldToCell(sound.position, config.tileSize) });
  }
  if (state.failurePending) {
    events.push({ ...base, type: "route-failed", ...state.failurePending });
  }
  if (state.arrivalPending) {
    events.push({ ...base, type: "arrived", cell: state.arrivalPending });
  }
  events.push({ ...base, type: "tick" });

  const decision = handleGuardFrame(state.fsm, events, config.guard);
  let next: GuardControllerState = {
    ...state,
    fsm: decision.context,
    perception: frame.state,
    algorithm,
    wasVisible: frame.vision.visible,
    arrivalPending: null,
    failurePending: null,
    lastHeardSoundAtMs,
  };
  if (decision.command) {
    next = applyCommand(next, decision.command, config);
  }

  // Only the record whose command was applied carries the resulting route.
  const entries = decision.records.map((record) =>
    entry(record, guardCell, frame.vision.reason, record.command === decision.command ? next.route : null, next.algorithm),
  );
  next = moveGuard(next, input.deltaMs, config);
  if (entries.length > 0) {
    next = { ...next, lastEntry: entries.at(-1) ?? null };
  }

  return { state: next, vision: frame.vision, soundHeard: frame.soundHeard, entries };
}

function applyCommand(
  state: GuardControllerState,
  command: GuardCommand,
  config: GuardControllerConfig,
): GuardControllerState {
  if (command.type === "stop") {
    return { ...state, waypoints: [], nextWaypoint: 0, route: null, routeGoal: null };
  }
  const start = worldToCell(state.position, config.tileSize);
  const route = calculateRoute(config.guard.map, start, command.goal, state.algorithm);
  if (route.status !== "success") {
    return {
      ...state,
      waypoints: [],
      nextWaypoint: 0,
      route,
      routeGoal: command.goal,
      failurePending: { goal: command.goal, status: route.status },
    };
  }
  return {
    ...state,
    waypoints: route.path.map((point) => cellCenter(point, config.tileSize)),
    nextWaypoint: 0,
    route,
    routeGoal: command.goal,
  };
}

function moveGuard(state: GuardControllerState, deltaMs: number, config: GuardControllerConfig): GuardControllerState {
  if (state.waypoints.length === 0 || state.nextWaypoint >= state.waypoints.length) {
    return state;
  }
  const movement = advanceAlongPath(
    state.position,
    state.waypoints,
    state.nextWaypoint,
    config.speed * deltaMs / 1000,
  );
  return {
    ...state,
    position: movement.position,
    nextWaypoint: movement.nextWaypoint,
    facing: movement.direction ?? state.facing,
    arrivalPending: movement.completed ? state.routeGoal : state.arrivalPending,
  };
}

function entry(
  record: TransitionRecord,
  guardCell: GridPoint,
  vision: VisionReason | null,
  route: SearchResult | null,
  algorithm: SearchAlgorithm,
): TelemetryEntry {
  return {
    ...record,
    guardCell,
    vision,
    route: route && record.command?.type === "navigate"
      ? {
        algorithm,
        goal: record.command.goal,
        status: route.status,
        cost: route.totalCost,
        expandedNodes: route.expandedNodes,
        maximumFrontier: route.maximumFrontier,
      }
      : null,
  };
}
