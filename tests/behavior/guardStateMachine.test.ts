import { describe, expect, it } from "vitest";
import { createGridMap, type GridPoint } from "../../src/domain/model/grid";
import {
  checkGuardInvariants,
  createGuardContext,
  handleGuardEvent,
  handleGuardFrame,
  searchPointsAround,
  type GuardConfig,
  type GuardContext,
  type GuardEvent,
  type GuardStep,
} from "../../src/domain/behavior/guardStateMachine";

// 12 x 8 open room with a wall segment; the pocket at (10,1) is enclosed.
const MAP = createGridMap(12, 8, [
  { x: 5, y: 2 },
  { x: 5, y: 3 },
  { x: 5, y: 4 },
  { x: 10, y: 0 },
  { x: 9, y: 1 },
  { x: 11, y: 1 },
  { x: 10, y: 2 },
]);
const P0 = { x: 1, y: 1 };
const P1 = { x: 8, y: 6 };
const CONFIG: GuardConfig = {
  map: MAP,
  patrolPoints: [P0, P1],
  searchDurationMs: 4000,
  searchRadius: 2,
  replanIntervalMs: 500,
  relevantChangeCells: 3,
  retryDelayMs: 1500,
};

type EventInput = GuardEvent extends infer E ? E extends GuardEvent ? Omit<E, "guardCell"> & { guardCell?: GridPoint } : never : never;

/** Applies events one by one, checking every invariant after each event. */
function run(start: GuardContext, inputs: readonly EventInput[]): { context: GuardContext; steps: GuardStep[] } {
  let context = start;
  const steps: GuardStep[] = [];
  for (const input of inputs) {
    const event = { guardCell: { x: 2, y: 2 }, ...input } as GuardEvent;
    const step = handleGuardEvent(context, event, CONFIG);
    expect(checkGuardInvariants(step.context, CONFIG, context, event), `after ${event.type}`).toEqual([]);
    steps.push(step);
    context = step.context;
  }
  return { context, steps };
}

function initial(): GuardContext {
  const step = createGuardContext(CONFIG, 0);
  expect(checkGuardInvariants(step.context, CONFIG)).toEqual([]);
  return step.context;
}

function inState(state: "patrol" | "investigate" | "search" | "return" | "chase"): GuardContext {
  const start = initial();
  switch (state) {
    case "patrol":
      return start;
    case "investigate":
      return run(start, [{ type: "sound-heard", timeMs: 100, cell: { x: 3, y: 6 } }]).context;
    case "search":
      return run(inState("investigate"), [{ type: "arrived", timeMs: 200, cell: { x: 3, y: 6 } }]).context;
    case "return":
      return run(inState("search"), [{ type: "tick", timeMs: 4200 }]).context;
    case "chase":
      return run(start, [{ type: "player-seen", timeMs: 100, cell: { x: 7, y: 2 } }]).context;
  }
}

describe("guard state machine: required sequences", () => {
  it("Patrol -(sound)-> Investigate -(arrival)-> Search", () => {
    const { context, steps } = run(initial(), [
      { type: "sound-heard", timeMs: 100, cell: { x: 3, y: 6 } },
      { type: "arrived", timeMs: 900, cell: { x: 3, y: 6 } },
    ]);

    expect(steps.map((step) => step.record?.to)).toEqual(["investigate", "search"]);
    expect(steps[0]?.command).toEqual({ type: "navigate", goal: { x: 3, y: 6 } });
    expect(context.state).toBe("search");
    expect(context.previousState).toBe("investigate");
    expect(context.searchEndsAtMs).toBe(4900);
    expect(context.destination).toEqual(context.searchPoints[0]);
    expect(context.lastKnownSource).toBe("sound");
  });

  it("Search -(time)-> Return -(arrival)-> Patrol", () => {
    const search = inState("search");
    const before = run(search, [{ type: "tick", timeMs: 4199, guardCell: { x: 3, y: 5 } }]);
    expect(before.context.state).toBe("search");
    expect(before.steps[0]?.record).toBeNull();

    const { context, steps } = run(search, [
      { type: "tick", timeMs: 4200, guardCell: { x: 7, y: 6 } },
      { type: "arrived", timeMs: 5000, cell: P1 },
    ]);

    expect(steps.map((step) => step.record?.to)).toEqual(["return", "patrol"]);
    expect(steps[0]?.command).toEqual({ type: "navigate", goal: P1 });
    expect(context.state).toBe("patrol");
    expect(context.destination).toEqual(P0);
    expect(context.searchEndsAtMs).toBeNull();
  });

  it.each(["patrol", "investigate", "search", "return"] as const)(
    "%s -(vision)-> Chase",
    (state) => {
      const { context, steps } = run(inState(state), [
        { type: "player-seen", timeMs: 5000, cell: { x: 7, y: 2 } },
      ]);

      expect(steps[0]?.record).toMatchObject({ from: state, to: "chase", kind: "external", event: "player-seen" });
      expect(context.lastKnownCell).toEqual({ x: 7, y: 2 });
      expect(context.lastKnownSource).toBe("vision");
      expect(steps[0]?.command).toEqual({ type: "navigate", goal: { x: 7, y: 2 } });
    },
  );

  it("Chase -(loss with memory)-> Investigate the last known position", () => {
    const { context, steps } = run(inState("chase"), [
      { type: "player-seen", timeMs: 300, cell: { x: 7, y: 3 } },
      { type: "player-lost", timeMs: 400 },
    ]);

    expect(steps.at(-1)?.record).toMatchObject({ from: "chase", to: "investigate", guard: "hay última posición conocida" });
    expect(context.destination).toEqual({ x: 7, y: 3 });
  });
});

describe("guard state machine: guards, limits and recovery", () => {
  it("ignores sound while chasing (false guard, vision has priority)", () => {
    const chase = inState("chase");
    const { context, steps } = run(chase, [{ type: "sound-heard", timeMs: 200, cell: { x: 1, y: 6 } }]);

    expect(steps[0]?.record).toMatchObject({ kind: "ignored", from: "chase", to: "chase" });
    expect(steps[0]?.command).toBeNull();
    expect(context).toEqual(chase);
  });

  it("ignores a vision report on a blocked cell (invalid perception)", () => {
    const start = initial();
    const { context, steps } = run(start, [{ type: "player-seen", timeMs: 100, cell: { x: 5, y: 3 } }]);

    expect(steps[0]?.record?.kind).toBe("ignored");
    expect(context).toEqual(start);
  });

  it("does not replan a chase for a small change inside the interval, but does after it", () => {
    const { steps } = run(inState("chase"), [
      { type: "player-seen", timeMs: 200, cell: { x: 7, y: 3 } },
      { type: "player-seen", timeMs: 650, cell: { x: 7, y: 4 } },
      { type: "player-seen", timeMs: 700, cell: { x: 2, y: 6 } },
    ]);

    expect(steps[0]?.command).toBeNull();
    expect(steps[1]?.record).toMatchObject({ kind: "internal", guard: "intervalo de replanificación vencido" });
    expect(steps[2]?.record).toMatchObject({ kind: "internal", guard: "cambio relevante del objetivo" });
  });

  it("vision wins over a simultaneous sound and the rest of the frame is discarded", () => {
    const frame = handleGuardFrame(
      initial(),
      [
        { type: "sound-heard", timeMs: 100, guardCell: P0, cell: { x: 3, y: 6 } },
        { type: "player-seen", timeMs: 100, guardCell: P0, cell: { x: 7, y: 2 } },
        { type: "tick", timeMs: 100, guardCell: P0 },
      ],
      CONFIG,
    );

    expect(frame.context.state).toBe("chase");
    expect(frame.context.lastKnownSource).toBe("vision");
    expect(frame.records.map((record) => [record.event, record.kind])).toEqual([
      ["player-seen", "external"],
      ["sound-heard", "discarded"],
    ]);
    expect(frame.command).toEqual({ type: "navigate", goal: { x: 7, y: 2 } });
  });

  it("recovers from an unreachable investigation target by returning to patrol", () => {
    const { context, steps } = run(inState("investigate"), [
      { type: "route-failed", timeMs: 150, goal: { x: 3, y: 6 }, status: "unreachable", guardCell: { x: 2, y: 1 } },
    ]);

    expect(steps[0]?.record).toMatchObject({ from: "investigate", to: "return", reason: "destino inaccesible (unreachable)" });
    expect(context.destination).toEqual(P0);
  });

  it("skips a blocked patrol point, holds when all fail and retries after the delay", () => {
    const { context, steps } = run(initial(), [
      { type: "route-failed", timeMs: 10, goal: P0, status: "unreachable" },
      { type: "route-failed", timeMs: 20, goal: P1, status: "unreachable" },
      { type: "tick", timeMs: 1000 },
      { type: "tick", timeMs: 1520 },
    ]);

    expect(steps[0]?.command).toEqual({ type: "navigate", goal: P1 });
    expect(steps[1]?.command).toEqual({ type: "stop" });
    expect(steps[1]?.record?.reason).toContain("reintento programado");
    expect(steps[2]?.record).toBeNull();
    expect(steps[3]?.record?.reason).toBe("reintento de ruta a patrulla");
    expect(context.retryAtMs).toBeNull();
    expect(context.destination).not.toBeNull();
  });

  it("discards an unreachable search point and keeps the order of the others", () => {
    const search = inState("search");
    const first = search.searchPoints[0];
    const second = search.searchPoints[1];
    if (!first || !second) {
      throw new Error("Expected at least two search points.");
    }
    const { context, steps } = run(search, [
      { type: "route-failed", timeMs: 300, goal: first, status: "unreachable" },
    ]);

    expect(steps[0]?.command).toEqual({ type: "navigate", goal: second });
    expect(context.searchPoints).not.toContainEqual(first);
  });

  it("treats a repeated sound and a repeated arrival as no-ops", () => {
    const { context, steps } = run(initial(), [
      { type: "sound-heard", timeMs: 100, cell: { x: 3, y: 6 } },
      { type: "sound-heard", timeMs: 120, cell: { x: 3, y: 6 } },
      { type: "arrived", timeMs: 900, cell: { x: 3, y: 6 } },
      { type: "arrived", timeMs: 910, cell: { x: 3, y: 6 } },
    ]);

    expect(steps[1]?.record).toMatchObject({ kind: "ignored", reason: "sonido repetido" });
    expect(steps[1]?.command).toBeNull();
    expect(steps[3]?.record).toMatchObject({ kind: "ignored", reason: "llegada obsoleta" });
    expect(context.state).toBe("search");
    expect(context.enteredAtMs).toBe(900);
  });

  it("resets during a chase to a clean patrol", () => {
    const { context, steps } = run(inState("chase"), [{ type: "reset", timeMs: 500 }]);

    expect(steps[0]?.record).toMatchObject({ from: "chase", to: "patrol", event: "reset", kind: "external" });
    expect(steps[0]?.command).toEqual({ type: "navigate", goal: P0 });
    expect(context.lastKnownCell).toBeNull();
    expect(context.searchEndsAtMs).toBeNull();
    expect(context.previousState).toBe("chase");
  });

  it("returns from a chase without memory only through the explicit guard", () => {
    const chaseWithoutMemory: GuardContext = { ...inState("chase"), lastKnownCell: null };
    const step = handleGuardEvent(chaseWithoutMemory, { type: "player-lost", timeMs: 50, guardCell: { x: 7, y: 6 } }, CONFIG);

    expect(step.record).toMatchObject({ to: "return", guard: "sin memoria" });
  });

  it("detects invariant violations", () => {
    const broken: GuardContext = { ...initial(), state: "search", searchEndsAtMs: null, lastKnownCell: null };

    expect(checkGuardInvariants(broken, CONFIG)).toEqual([
      "I3 estado que requiere memoria sin última posición conocida",
      "I5 vencimiento de búsqueda fuera de Buscar",
    ]);
  });

  it("rejects non-walkable patrol points and non-finite times", () => {
    expect(() => createGuardContext({ ...CONFIG, patrolPoints: [{ x: 5, y: 3 }] }, 0)).toThrow();
    expect(() => handleGuardEvent(initial(), { type: "tick", timeMs: Number.NaN, guardCell: P0 }, CONFIG)).toThrow();
  });
});

describe("searchPointsAround", () => {
  it("returns walkable points in a fixed clockwise order and skips walls", () => {
    expect(searchPointsAround(MAP, { x: 5, y: 6 }, 2)).toEqual([
      { x: 5, y: 5 },
      { x: 7, y: 6 },
      { x: 5, y: 7 },
      { x: 3, y: 6 },
    ]);
  });
});
