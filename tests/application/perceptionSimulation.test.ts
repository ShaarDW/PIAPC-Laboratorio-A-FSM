import { describe, expect, it } from "vitest";
import {
  initialPerceptionState,
  updatePerceptionSimulation,
  withSoundEvent,
} from "../../src/application/simulation/perceptionSimulation";
import { createGridMap } from "../../src/domain/model/grid";

const INPUT = {
  map: createGridMap(5, 5, []),
  tileSize: 10,
  observer: { x: 15, y: 15 },
  facing: { x: 1, y: 0 },
  target: { x: 25, y: 15 },
  visionRange: 30,
  fieldOfViewRadians: Math.PI / 2,
  timeMs: 100,
};

describe("perception simulation", () => {
  it("prioritizes simultaneous vision over sound", () => {
    const state = withSoundEvent(initialPerceptionState(), {
      position: { x: 10, y: 15 },
      radius: 20,
      emittedAtMs: 100,
      durationMs: 100,
    });
    const frame = updatePerceptionSimulation(state, INPUT);

    expect(frame.soundHeard).toBe(true);
    expect(frame.vision.visible).toBe(true);
    expect(frame.state.memory.source).toBe("vision");
    expect(frame.state.memory.lastKnownPosition).toEqual(INPUT.target);
  });

  it("expires sound while preserving memory", () => {
    const state = withSoundEvent(initialPerceptionState(), {
      position: { x: 10, y: 15 },
      radius: 20,
      emittedAtMs: 0,
      durationMs: 50,
    });
    const frame = updatePerceptionSimulation(state, {
      ...INPUT,
      target: { x: 45, y: 45 },
      timeMs: 51,
    });

    expect(frame.state.soundEvent).toBeNull();
    expect(frame.soundHeard).toBe(false);
  });
});
