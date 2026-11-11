import { isWalkable, type GridMap, type GridPoint } from "../model/grid";
import { manhattanDistance } from "../navigation/gridGraph";

export type GuardState = "patrol" | "investigate" | "chase" | "search" | "return";

export const GUARD_STATES: readonly GuardState[] = [
  "patrol",
  "investigate",
  "chase",
  "search",
  "return",
];

export type RouteFailureStatus = "unreachable" | "invalid-start" | "invalid-goal";

interface EventBase {
  readonly timeMs: number;
  readonly guardCell: GridPoint;
}

export type GuardEvent =
  | (EventBase & { readonly type: "player-seen"; readonly cell: GridPoint })
  | (EventBase & { readonly type: "player-lost" })
  | (EventBase & { readonly type: "sound-heard"; readonly cell: GridPoint })
  | (EventBase & {
    readonly type: "route-failed";
    readonly goal: GridPoint;
    readonly status: RouteFailureStatus;
  })
  | (EventBase & { readonly type: "arrived"; readonly cell: GridPoint })
  | (EventBase & { readonly type: "tick" })
  | (EventBase & { readonly type: "reset" });

export type GuardEventType = GuardEvent["type"];

/** Priority used by the application when several events happen in the same frame. */
export const EVENT_PRIORITY: readonly GuardEventType[] = [
  "reset",
  "player-seen",
  "player-lost",
  "sound-heard",
  "route-failed",
  "arrived",
  "tick",
];

export type GuardCommand =
  | { readonly type: "navigate"; readonly goal: GridPoint }
  | { readonly type: "stop" };

export interface GuardConfig {
  readonly map: GridMap;
  readonly patrolPoints: readonly GridPoint[];
  readonly searchDurationMs: number;
  readonly searchRadius: number;
  readonly replanIntervalMs: number;
  readonly relevantChangeCells: number;
  readonly retryDelayMs: number;
}

export interface GuardContext {
  readonly state: GuardState;
  readonly previousState: GuardState | null;
  readonly enteredAtMs: number;
  readonly patrolIndex: number;
  readonly destination: GridPoint | null;
  readonly lastKnownCell: GridPoint | null;
  readonly lastKnownSource: "vision" | "sound" | null;
  readonly searchPoints: readonly GridPoint[];
  readonly searchIndex: number;
  readonly searchEndsAtMs: number | null;
  readonly lastRouteAtMs: number | null;
  readonly patrolFailures: number;
  readonly retryAtMs: number | null;
}

export type TransitionKind = "external" | "internal" | "ignored" | "discarded";

export interface TransitionRecord {
  readonly timeMs: number;
  readonly from: GuardState;
  readonly to: GuardState;
  readonly event: GuardEventType;
  readonly kind: TransitionKind;
  readonly guard: string;
  readonly reason: string;
  readonly lastKnown: GridPoint | null;
  readonly memorySource: "vision" | "sound" | null;
  readonly destination: GridPoint | null;
  readonly command: GuardCommand | null;
}

export interface GuardStep {
  readonly context: GuardContext;
  readonly record: TransitionRecord | null;
  readonly command: GuardCommand | null;
}

export function validateGuardConfig(config: GuardConfig): void {
  if (config.patrolPoints.length === 0) {
    throw new Error("At least one patrol point is required.");
  }
  for (const point of config.patrolPoints) {
    if (!isWalkable(config.map, point)) {
      throw new Error(`Patrol point is not walkable: ${point.x},${point.y}.`);
    }
  }
  for (const value of [
    config.searchDurationMs,
    config.replanIntervalMs,
    config.retryDelayMs,
    config.searchRadius,
    config.relevantChangeCells,
  ]) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Guard timing and distance parameters must be finite and non-negative.");
    }
  }
}

/** Initial context: Patrol towards the first patrol point. */
export function createGuardContext(config: GuardConfig, timeMs: number): GuardStep {
  validateGuardConfig(config);
  assertFiniteTime(timeMs);
  const goal = patrolPoint(config, 0);
  const context: GuardContext = {
    state: "patrol",
    previousState: null,
    enteredAtMs: timeMs,
    patrolIndex: 0,
    destination: goal,
    lastKnownCell: null,
    lastKnownSource: null,
    searchPoints: [],
    searchIndex: 0,
    searchEndsAtMs: null,
    lastRouteAtMs: timeMs,
    patrolFailures: 0,
    retryAtMs: null,
  };
  return { context, record: null, command: { type: "navigate", goal } };
}

export function handleGuardEvent(
  context: GuardContext,
  event: GuardEvent,
  config: GuardConfig,
): GuardStep {
  assertFiniteTime(event.timeMs);

  if (event.type === "reset") {
    const initial = createGuardContext(config, event.timeMs).context;
    const next = { ...initial, previousState: context.state };
    return external(context, next, event, "siempre", "reinicio pedido", {
      type: "navigate",
      goal: patrolPoint(config, 0),
    });
  }

  if (event.type === "player-seen") {
    return onPlayerSeen(context, event, config);
  }

  switch (context.state) {
    case "chase":
      return onChase(context, event, config);
    case "investigate":
      return onInvestigate(context, event, config);
    case "search":
      return onSearch(context, event, config);
    case "patrol":
    case "return":
      return onPatrolOrReturn(context, event, config);
  }
}

export interface GuardFrameResult {
  readonly context: GuardContext;
  readonly records: readonly TransitionRecord[];
  /** Last command emitted in the frame; it replaces any previous one. */
  readonly command: GuardCommand | null;
}

/**
 * Simultaneous-event policy: events of one frame are processed by EVENT_PRIORITY.
 * After the first external transition the remaining events are discarded and recorded.
 */
export function handleGuardFrame(
  context: GuardContext,
  events: readonly GuardEvent[],
  config: GuardConfig,
): GuardFrameResult {
  const ordered = [...events].sort(
    (left, right) => EVENT_PRIORITY.indexOf(left.type) - EVENT_PRIORITY.indexOf(right.type),
  );
  let current = context;
  let command: GuardCommand | null = null;
  const records: TransitionRecord[] = [];
  let externalSeen = false;

  for (const event of ordered) {
    if (externalSeen) {
      if (event.type !== "tick") {
        records.push(discardedRecord(current, event));
      }
      continue;
    }
    const step = handleGuardEvent(current, event, config);
    current = step.context;
    if (step.record) {
      records.push(step.record);
      externalSeen = step.record.kind === "external";
    }
    if (step.command) {
      command = step.command;
    }
  }

  return { context: current, records, command };
}

/** Builds a "discarded" record for an event dropped after an external transition in the same frame. */
export function discardedRecord(context: GuardContext, event: GuardEvent): TransitionRecord {
  return record(context, context, event, "discarded", "transición externa previa en el cuadro", "descartado por prioridad", null);
}

function onPlayerSeen(
  context: GuardContext,
  event: Extract<GuardEvent, { type: "player-seen" }>,
  config: GuardConfig,
): GuardStep {
  if (!isWalkable(config.map, event.cell)) {
    return ignored(context, event, "celda vista transitable = falso", "percepción inválida");
  }

  const remembered = rememberCell(context, event.cell, "vision");
  if (context.state !== "chase") {
    const next = enter(remembered, "chase", event.timeMs, {
      destination: event.cell,
      lastRouteAtMs: event.timeMs,
    });
    return external(context, next, event, "visión válida", "jugador visible", {
      type: "navigate",
      goal: event.cell,
    });
  }

  const target = context.destination;
  const sinceRoute = context.lastRouteAtMs === null
    ? Number.POSITIVE_INFINITY
    : event.timeMs - context.lastRouteAtMs;
  const intervalElapsed = sinceRoute >= config.replanIntervalMs;
  // Without a destination (after a failed route) only the interval allows a new attempt.
  const relevantChange = target !== null
    && manhattanDistance(target, event.cell) >= config.relevantChangeCells;
  const moved = target === null || !samePoint(target, event.cell);
  if (moved && (relevantChange || intervalElapsed)) {
    const next = { ...remembered, destination: event.cell, lastRouteAtMs: event.timeMs };
    return internal(
      context,
      next,
      event,
      relevantChange ? "cambio relevante del objetivo" : "intervalo de replanificación vencido",
      "jugador visible en otra celda",
      { type: "navigate", goal: event.cell },
    );
  }

  return { context: remembered, record: null, command: null };
}

function onChase(context: GuardContext, event: GuardEvent, config: GuardConfig): GuardStep {
  switch (event.type) {
    case "player-lost": {
      if (context.lastKnownCell) {
        const next = enter(context, "investigate", event.timeMs, {
          destination: context.lastKnownCell,
          lastRouteAtMs: event.timeMs,
        });
        return external(context, next, event, "hay última posición conocida", "jugador fuera de visión", {
          type: "navigate",
          goal: context.lastKnownCell,
        });
      }
      return startReturn(context, event, config, "sin memoria", "jugador fuera de visión");
    }
    case "sound-heard":
      return ignored(context, event, "estado = Perseguir, la visión tiene prioridad", "sonido ignorado");
    case "route-failed": {
      const next = { ...context, destination: null, lastRouteAtMs: event.timeMs };
      return internal(context, next, event, "siempre", `ruta al jugador ${event.status}`, { type: "stop" });
    }
    case "arrived":
      return arrivalCheck(context, event) ?? { context, record: null, command: null };
    default:
      return { context, record: null, command: null };
  }
}

function onInvestigate(context: GuardContext, event: GuardEvent, config: GuardConfig): GuardStep {
  switch (event.type) {
    case "sound-heard":
      return onSoundWhileActive(context, event, config);
    case "arrived": {
      const stale = arrivalCheck(context, event);
      if (stale) {
        return stale;
      }
      const center = context.lastKnownCell ?? event.cell;
      const points = searchPointsAround(config.map, center, config.searchRadius);
      const first = points[0] ?? null;
      const next = enter(context, "search", event.timeMs, {
        searchPoints: points,
        searchIndex: 0,
        searchEndsAtMs: event.timeMs + config.searchDurationMs,
        destination: first,
        lastRouteAtMs: event.timeMs,
      });
      return external(
        context,
        next,
        event,
        "llegada al destino actual",
        "llegó a la última posición conocida",
        first ? { type: "navigate", goal: first } : { type: "stop" },
      );
    }
    case "route-failed":
      return startReturn(context, event, config, "siempre", `destino inaccesible (${event.status})`);
    default:
      return { context, record: null, command: null };
  }
}

function onSearch(context: GuardContext, event: GuardEvent, config: GuardConfig): GuardStep {
  if (
    (event.type === "tick" || event.type === "arrived" || event.type === "route-failed")
    && context.searchEndsAtMs !== null
    && event.timeMs >= context.searchEndsAtMs
  ) {
    return startReturn(context, event, config, "tiempo ≥ vencimiento", "búsqueda agotada");
  }

  switch (event.type) {
    case "sound-heard":
      return onSoundWhileActive(context, event, config);
    case "arrived": {
      const stale = arrivalCheck(context, event);
      if (stale) {
        return stale;
      }
      return nextSearchPoint(
        context,
        event,
        context.searchPoints,
        context.searchIndex + 1,
        "punto de búsqueda alcanzado",
      );
    }
    case "route-failed": {
      const failedIndex = context.searchPoints.findIndex((point) => samePoint(point, event.goal));
      const remaining = context.searchPoints.filter((point) => !samePoint(point, event.goal));
      // The point after the discarded one now occupies the discarded index.
      return nextSearchPoint(
        context,
        event,
        remaining,
        failedIndex < 0 ? context.searchIndex : failedIndex,
        `punto de búsqueda descartado (${event.status})`,
      );
    }
    default:
      return { context, record: null, command: null };
  }
}

function onPatrolOrReturn(context: GuardContext, event: GuardEvent, config: GuardConfig): GuardStep {
  switch (event.type) {
    case "sound-heard":
      return onSoundWhileActive(context, event, config);
    case "arrived": {
      const stale = arrivalCheck(context, event);
      if (stale) {
        return stale;
      }
      const nextIndex = (context.patrolIndex + 1) % config.patrolPoints.length;
      const goal = patrolPoint(config, nextIndex);
      const base = { ...context, patrolIndex: nextIndex, patrolFailures: 0 };
      if (context.state === "return") {
        const next = enter(base, "patrol", event.timeMs, { destination: goal, lastRouteAtMs: event.timeMs });
        return external(context, next, event, "llegada al destino actual", "punto de patrulla alcanzado", {
          type: "navigate",
          goal,
        });
      }
      const next = { ...base, destination: goal, lastRouteAtMs: event.timeMs };
      return internal(context, next, event, "llegada al destino actual", "siguiente punto de patrulla", {
        type: "navigate",
        goal,
      });
    }
    case "route-failed": {
      const failures = context.patrolFailures + 1;
      if (failures >= config.patrolPoints.length) {
        const next = {
          ...context,
          patrolFailures: failures,
          destination: null,
          retryAtMs: event.timeMs + config.retryDelayMs,
        };
        return internal(
          context,
          next,
          event,
          "ya fallaron todos los puntos",
          `sin ruta a patrulla (${event.status}), reintento programado`,
          { type: "stop" },
        );
      }
      const nextIndex = (context.patrolIndex + 1) % config.patrolPoints.length;
      const goal = patrolPoint(config, nextIndex);
      const next = {
        ...context,
        patrolIndex: nextIndex,
        patrolFailures: failures,
        destination: goal,
        lastRouteAtMs: event.timeMs,
      };
      return internal(context, next, event, "quedan puntos sin probar", `punto de patrulla inaccesible (${event.status})`, {
        type: "navigate",
        goal,
      });
    }
    case "tick": {
      if (context.retryAtMs === null || event.timeMs < context.retryAtMs) {
        return { context, record: null, command: null };
      }
      const index = nearestPatrolIndex(config, event.guardCell);
      const goal = patrolPoint(config, index);
      const next = {
        ...context,
        patrolIndex: index,
        patrolFailures: 0,
        retryAtMs: null,
        destination: goal,
        lastRouteAtMs: event.timeMs,
      };
      return internal(context, next, event, "tiempo ≥ reintento", "reintento de ruta a patrulla", {
        type: "navigate",
        goal,
      });
    }
    default:
      return { context, record: null, command: null };
  }
}

function onSoundWhileActive(
  context: GuardContext,
  event: Extract<GuardEvent, { type: "sound-heard" }>,
  config: GuardConfig,
): GuardStep {
  if (!isWalkable(config.map, event.cell)) {
    return ignored(context, event, "celda del sonido transitable = falso", "percepción inválida");
  }
  const remembered = rememberCell(context, event.cell, "sound");
  if (context.state === "investigate") {
    if (context.destination && samePoint(context.destination, event.cell)) {
      return ignored(remembered, event, "celda distinta del destino = falso", "sonido repetido");
    }
    const next = { ...remembered, destination: event.cell, lastRouteAtMs: event.timeMs };
    return internal(context, next, event, "celda distinta del destino", "sonido nuevo", {
      type: "navigate",
      goal: event.cell,
    });
  }
  const next = enter(remembered, "investigate", event.timeMs, {
    destination: event.cell,
    lastRouteAtMs: event.timeMs,
  });
  return external(context, next, event, "celda del sonido transitable", "sonido oído", {
    type: "navigate",
    goal: event.cell,
  });
}

function nextSearchPoint(
  context: GuardContext,
  event: GuardEvent,
  points: readonly GridPoint[],
  candidateIndex: number,
  reason: string,
): GuardStep {
  if (points.length === 0) {
    const next = { ...context, searchPoints: [], searchIndex: 0, destination: null };
    return internal(context, next, event, "no quedan puntos", `${reason}, espera el vencimiento`, { type: "stop" });
  }
  const index = candidateIndex % points.length;
  const goal = points[index] ?? null;
  if (!goal) {
    throw new Error("Search point invariant failed.");
  }
  const next = {
    ...context,
    searchPoints: points,
    searchIndex: index,
    destination: goal,
    lastRouteAtMs: event.timeMs,
  };
  return internal(context, next, event, "quedan puntos de búsqueda", reason, { type: "navigate", goal });
}

function startReturn(
  context: GuardContext,
  event: GuardEvent,
  config: GuardConfig,
  guard: string,
  reason: string,
): GuardStep {
  const index = nearestPatrolIndex(config, event.guardCell);
  const goal = patrolPoint(config, index);
  const next = enter(context, "return", event.timeMs, {
    patrolIndex: index,
    patrolFailures: 0,
    retryAtMs: null,
    destination: goal,
    lastRouteAtMs: event.timeMs,
  });
  return external(context, next, event, guard, reason, { type: "navigate", goal });
}

/** Returns an "ignored" step when an arrival does not match the current destination. */
function arrivalCheck(
  context: GuardContext,
  event: Extract<GuardEvent, { type: "arrived" }>,
): GuardStep | null {
  if (context.destination && samePoint(context.destination, event.cell)) {
    return null;
  }
  return ignored(context, event, "llegada al destino actual = falso", "llegada obsoleta");
}

/** Walkable cells around a center, at most `radius` cells away, in a fixed order (clockwise from north). */
export function searchPointsAround(map: GridMap, center: GridPoint, radius: number): GridPoint[] {
  const offsets: GridPoint[] = [
    { x: 0, y: -radius },
    { x: radius, y: 0 },
    { x: 0, y: radius },
    { x: -radius, y: 0 },
  ];
  const points: GridPoint[] = [];
  for (const offset of offsets) {
    for (let step = Math.max(1, radius); step >= 1; step -= 1) {
      const scale = radius === 0 ? 0 : step / radius;
      const candidate = {
        x: center.x + Math.round(offset.x * scale),
        y: center.y + Math.round(offset.y * scale),
      };
      if (isWalkable(map, candidate) && !samePoint(candidate, center)) {
        points.push(candidate);
        break;
      }
    }
  }
  return points;
}

export function nearestPatrolIndex(config: GuardConfig, cell: GridPoint): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  config.patrolPoints.forEach((point, index) => {
    const distance = manhattanDistance(point, cell);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/** Returns the list of violated invariants (empty when the context is consistent). */
export function checkGuardInvariants(
  context: GuardContext,
  config: GuardConfig,
  previous?: GuardContext,
  event?: GuardEvent,
): string[] {
  const violations: string[] = [];
  if (!GUARD_STATES.includes(context.state)) {
    violations.push("I1 estado desconocido");
  }
  if (context.destination && !isWalkable(config.map, context.destination)) {
    violations.push("I2 destino no transitable");
  }
  if (
    (context.state === "investigate" || context.state === "chase" || context.state === "search")
    && context.lastKnownCell === null
  ) {
    violations.push("I3 estado que requiere memoria sin última posición conocida");
  }
  if (context.state === "chase" && context.lastKnownSource !== "vision") {
    violations.push("I4 persecución sin memoria visual");
  }
  if ((context.searchEndsAtMs !== null) !== (context.state === "search")) {
    violations.push("I5 vencimiento de búsqueda fuera de Buscar");
  }
  if (context.state === "patrol" || context.state === "return") {
    const destination = context.destination;
    if (destination === null && context.retryAtMs === null) {
      violations.push("I6 patrulla sin destino ni reintento");
    }
    if (destination && !config.patrolPoints.some((point) => samePoint(point, destination))) {
      violations.push("I6 destino de patrulla que no es punto de patrulla");
    }
  }
  if (
    previous
    && event
    && event.type !== "player-seen"
    && event.type !== "sound-heard"
    && event.type !== "reset"
    && !sameNullablePoint(previous.lastKnownCell, context.lastKnownCell)
  ) {
    violations.push("I7 memoria cambiada sin percepción válida");
  }
  return violations;
}

function enter(
  context: GuardContext,
  state: GuardState,
  timeMs: number,
  changes: Partial<GuardContext>,
): GuardContext {
  return {
    ...context,
    searchPoints: [],
    searchIndex: 0,
    searchEndsAtMs: null,
    retryAtMs: null,
    ...changes,
    state,
    previousState: context.state,
    enteredAtMs: timeMs,
  };
}

function rememberCell(context: GuardContext, cell: GridPoint, source: "vision" | "sound"): GuardContext {
  return { ...context, lastKnownCell: { x: cell.x, y: cell.y }, lastKnownSource: source };
}

function external(
  before: GuardContext,
  after: GuardContext,
  event: GuardEvent,
  guard: string,
  reason: string,
  command: GuardCommand,
): GuardStep {
  return { context: after, record: record(before, after, event, "external", guard, reason, command), command };
}

function internal(
  before: GuardContext,
  after: GuardContext,
  event: GuardEvent,
  guard: string,
  reason: string,
  command: GuardCommand,
): GuardStep {
  return { context: after, record: record(before, after, event, "internal", guard, reason, command), command };
}

function ignored(context: GuardContext, event: GuardEvent, guard: string, reason: string): GuardStep {
  return { context, record: record(context, context, event, "ignored", guard, reason, null), command: null };
}

function record(
  before: GuardContext,
  after: GuardContext,
  event: GuardEvent,
  kind: TransitionKind,
  guard: string,
  reason: string,
  command: GuardCommand | null,
): TransitionRecord {
  return {
    timeMs: event.timeMs,
    from: before.state,
    to: after.state,
    event: event.type,
    kind,
    guard,
    reason,
    lastKnown: after.lastKnownCell,
    memorySource: after.lastKnownSource,
    destination: after.destination,
    command,
  };
}

function patrolPoint(config: GuardConfig, index: number): GridPoint {
  const point = config.patrolPoints[index];
  if (!point) {
    throw new Error("Patrol point index is outside the patrol list.");
  }
  return point;
}

function samePoint(left: GridPoint, right: GridPoint): boolean {
  return left.x === right.x && left.y === right.y;
}

function sameNullablePoint(left: GridPoint | null, right: GridPoint | null): boolean {
  return left === null || right === null ? left === right : samePoint(left, right);
}

function assertFiniteTime(timeMs: number): void {
  if (!Number.isFinite(timeMs)) {
    throw new Error("Event time must be finite.");
  }
}
