import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGuardController,
  stepGuardController,
  type GuardControllerConfig,
  type GuardControllerState,
  type GuardFrameInput,
  type TelemetryEntry,
} from "../../src/application/simulation/guardController";
import { labGuardConfig, SOUND_DURATION_MS, SOUND_RADIUS } from "../../src/application/simulation/guardSetup";
import { LAB_MAP, PLAYER_START, TILE_SIZE } from "../../src/application/simulation/labLevel";
import { checkGuardInvariants } from "../../src/domain/behavior/guardStateMachine";
import { cellCenter, createGridMap, isWalkable, worldToCell, type GridPoint } from "../../src/domain/model/grid";
import type { Vector2 } from "../../src/domain/model/vector";

const DELTA_MS = 50;
const FAR_AWAY = cellCenter(PLAYER_START, TILE_SIZE);

/** Fixed-step driver: same inputs always produce the same trace. */
class Simulation {
  public state: GuardControllerState;
  public timeMs = 0;
  public player: Vector2 = FAR_AWAY;
  public readonly trace: TelemetryEntry[] = [];

  public constructor(private readonly config: GuardControllerConfig) {
    this.state = createGuardController(config, 0);
  }

  public frame(extra: Partial<GuardFrameInput> = {}): void {
    this.timeMs += DELTA_MS;
    const previous = this.state.fsm;
    const output = stepGuardController(
      this.state,
      { timeMs: this.timeMs, deltaMs: DELTA_MS, playerPosition: this.player, ...extra },
      this.config,
    );
    this.state = output.state;
    this.trace.push(...output.entries);
    expect(checkGuardInvariants(this.state.fsm, this.config.guard), `t=${this.timeMs}`).toEqual([]);
    if (!extra.reset && previous.lastKnownCell !== this.state.fsm.lastKnownCell) {
      const perceptual = output.entries.some((entry) => entry.event === "player-seen" || entry.event === "sound-heard")
        || output.vision?.visible === true;
      expect(perceptual, `memory changed without perception at t=${this.timeMs}`).toBe(true);
    }
    const cell = worldToCell(this.state.position, TILE_SIZE);
    expect(isWalkable(this.config.guard.map, cell), `guard off the walkable grid at t=${this.timeMs}`).toBe(true);
  }

  public runUntil(condition: () => boolean, maximumMs: number): void {
    const limit = this.timeMs + maximumMs;
    while (!condition()) {
      if (this.timeMs >= limit) {
        throw new Error(`Condition not reached before t=${limit} (state ${this.state.fsm.state}).`);
      }
      this.frame();
    }
  }

  public guardCell(): GridPoint {
    return worldToCell(this.state.position, TILE_SIZE);
  }

  public emitSoundAt(position: Vector2): void {
    this.player = position;
    this.frame({
      newSound: {
        position,
        radius: SOUND_RADIUS,
        emittedAtMs: this.timeMs + DELTA_MS,
        durationMs: SOUND_DURATION_MS,
      },
    });
  }

  public externalTransitions(): string[] {
    return this.trace.filter((entry) => entry.kind === "external").map((entry) => `${entry.from}>${entry.to}`);
  }
}

/** The first walkable cell along `facing`, preferring `distance` cells away and falling back closer. */
function cellAlong(map: typeof LAB_MAP, from: GridPoint, facing: Vector2, distance: number): GridPoint {
  const step = { x: Math.round(facing.x), y: Math.round(facing.y) };
  for (let current = distance; current >= 1; current -= 1) {
    const candidate = { x: from.x + step.x * current, y: from.y + step.y * current };
    const between = Array.from({ length: current }, (_, index) => ({
      x: from.x + step.x * (index + 1),
      y: from.y + step.y * (index + 1),
    }));
    if (between.every((cell) => isWalkable(map, cell))) {
      return candidate;
    }
  }
  throw new Error(`No walkable scenario cell next to ${from.x},${from.y}.`);
}

function writeTrace(name: string, trace: readonly TelemetryEntry[]): void {
  const directory = process.env.TRACE_DIR;
  if (!directory) {
    return;
  }
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, name), `${JSON.stringify(trace, null, 2)}\n`);
}

describe("guard controller on the lab map", () => {
  it("normal trace: patrol, investigate a sound, search, return, patrol, chase and lose the player", () => {
    const sim = new Simulation(labGuardConfig());

    sim.runUntil(() => sim.trace.some((entry) => entry.event === "arrived" && entry.from === "patrol"), 3000);
    sim.runUntil(() => sim.timeMs >= 1500, 2000);

    // Sound behind the guard (outside the cone, inside the radius), then the player walks away.
    const behind = cellAlong(LAB_MAP, sim.guardCell(), { x: -sim.state.facing.x, y: -sim.state.facing.y }, 3);
    sim.emitSoundAt(cellCenter(behind, TILE_SIZE));
    sim.player = FAR_AWAY;
    expect(sim.state.fsm.state).toBe("investigate");

    sim.runUntil(() => sim.state.fsm.state === "search", 5000);
    sim.runUntil(() => sim.state.fsm.state === "return", 6000);
    sim.runUntil(() => sim.state.fsm.state === "patrol", 15000);
    sim.runUntil(() => sim.state.waypoints.length > 1 && sim.state.nextWaypoint >= 1, 2000);

    // Player appears in front of the guard, then leaves the field of view.
    sim.player = cellCenter(cellAlong(LAB_MAP, sim.guardCell(), sim.state.facing, 2), TILE_SIZE);
    sim.frame();
    expect(sim.state.fsm.state).toBe("chase");
    sim.player = FAR_AWAY;
    sim.runUntil(() => sim.state.fsm.state === "investigate", 1000);
    sim.runUntil(() => sim.state.fsm.state === "search", 6000);

    expect(sim.externalTransitions()).toEqual([
      "patrol>investigate",
      "investigate>search",
      "search>return",
      "return>patrol",
      "patrol>chase",
      "chase>investigate",
      "investigate>search",
    ]);
    const lost = sim.trace.find((entry) => entry.from === "chase" && entry.to === "investigate");
    expect(lost?.memorySource).toBe("vision");
    expect(lost?.route?.status).toBe("success");
    writeTrace("h4-traza-normal.json", sim.trace);
  });

  it("limit trace: blocked patrol point, simultaneous sound and vision, reset during chase", () => {
    // Same lab map with the patrol point (21,5) walled in: it stays walkable but becomes unreachable.
    const walledMap = createGridMap(LAB_MAP.width, LAB_MAP.height, [
      ...[...LAB_MAP.blocked].map((key) => {
        const [x, y] = key.split(",").map(Number);
        return { x: x ?? 0, y: y ?? 0 };
      }),
      { x: 20, y: 5 },
      { x: 22, y: 5 },
      { x: 21, y: 4 },
      { x: 21, y: 6 },
    ]);
    const sim = new Simulation(labGuardConfig(walledMap));

    sim.runUntil(() => sim.trace.some((entry) => entry.event === "route-failed"), 20000);
    const failure = sim.trace.find((entry) => entry.event === "route-failed");
    expect(failure).toMatchObject({ from: "patrol", to: "patrol", kind: "internal" });
    expect(failure?.reason).toBe("punto de patrulla inaccesible (unreachable)");
    expect(failure?.destination).toEqual({ x: 21, y: 13 });
    expect(sim.state.route?.status).toBe("success");

    sim.runUntil(() => sim.state.waypoints.length > 1 && sim.state.nextWaypoint >= 2, 3000);
    const front = cellAlong(walledMap, sim.guardCell(), sim.state.facing, 2);
    sim.emitSoundAt(cellCenter(front, TILE_SIZE));
    const simultaneous = sim.trace.slice(-2);
    expect(simultaneous.map((entry) => [entry.event, entry.kind])).toEqual([
      ["player-seen", "external"],
      ["sound-heard", "discarded"],
    ]);
    expect(sim.state.fsm.state).toBe("chase");

    sim.frame();
    sim.frame({ reset: true });
    expect(sim.trace.at(-1)).toMatchObject({ from: "chase", to: "patrol", event: "reset" });
    expect(sim.state.fsm.lastKnownCell).toBeNull();
    expect(sim.state.perception.memory.lastKnownPosition).toBeNull();
    sim.player = FAR_AWAY;
    sim.runUntil(() => sim.timeMs >= sim.trace.at(-1)!.timeMs + 1000, 2000);
    expect(sim.state.fsm.state).toBe("patrol");
    writeTrace("h4-traza-limite.json", sim.trace);
  });

  it("is reproducible: the same script yields the same trace", () => {
    const traces = [0, 1].map(() => {
      const sim = new Simulation(labGuardConfig());
      sim.runUntil(() => sim.timeMs >= 6000, 7000);
      return sim.trace;
    });

    expect(traces[1]).toEqual(traces[0]);
    expect(traces[0]?.length).toBeGreaterThan(0);
  });
});
