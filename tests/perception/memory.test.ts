import { describe, expect, it } from "vitest";
import {
  emptyPerceptionMemory,
  rememberObservation,
  timeSinceLastPerception,
} from "../../src/domain/perception/memory";

describe("perception memory", () => {
  it("starts without a last known position", () => {
    const memory = emptyPerceptionMemory();

    expect(memory.lastKnownPosition).toBeNull();
    expect(timeSinceLastPerception(memory, 100)).toBeNull();
  });

  it("records the latest observation and its source", () => {
    const memory = rememberObservation(emptyPerceptionMemory(), {
      source: "sound",
      position: { x: 4, y: 8 },
      observedAtMs: 100,
    });

    expect(memory).toEqual({
      source: "sound",
      lastKnownPosition: { x: 4, y: 8 },
      lastPerceivedAtMs: 100,
    });
    expect(timeSinceLastPerception(memory, 160)).toBe(60);
  });

  it("ignores older observations and prioritizes vision on a tie", () => {
    const seen = rememberObservation(emptyPerceptionMemory(), {
      source: "vision",
      position: { x: 5, y: 5 },
      observedAtMs: 200,
    });
    const olderSound = rememberObservation(seen, {
      source: "sound",
      position: { x: 1, y: 1 },
      observedAtMs: 199,
    });
    const simultaneousSound = rememberObservation(seen, {
      source: "sound",
      position: { x: 2, y: 2 },
      observedAtMs: 200,
    });

    expect(olderSound).toBe(seen);
    expect(simultaneousSound).toBe(seen);
  });

  it("allows simultaneous vision to replace sound", () => {
    const heard = rememberObservation(emptyPerceptionMemory(), {
      source: "sound",
      position: { x: 1, y: 1 },
      observedAtMs: 200,
    });
    const seen = rememberObservation(heard, {
      source: "vision",
      position: { x: 2, y: 2 },
      observedAtMs: 200,
    });

    expect(seen.source).toBe("vision");
    expect(seen.lastKnownPosition).toEqual({ x: 2, y: 2 });
  });

  it("rejects non-finite observations", () => {
    expect(() => rememberObservation(emptyPerceptionMemory(), {
      source: "vision",
      position: { x: 0, y: 0 },
      observedAtMs: Number.POSITIVE_INFINITY,
    })).toThrow("Observation time");
  });
});
