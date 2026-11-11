import { describe, expect, it } from "vitest";
import { createGridMap } from "../../src/domain/model/grid";
import { evaluateSound, evaluateVision } from "../../src/domain/perception/perception";

const OPEN_MAP = createGridMap(8, 8, []);
const BASE_VISION = {
  map: OPEN_MAP,
  tileSize: 10,
  observer: { x: 15, y: 15 },
  facing: { x: 1, y: 0 },
  target: { x: 45, y: 15 },
  range: 50,
  fieldOfViewRadians: Math.PI / 2,
};

describe("vision", () => {
  it("detects a target inside range and cone", () => {
    expect(evaluateVision(BASE_VISION)).toMatchObject({ visible: true, reason: "visible" });
  });

  it("distinguishes range and cone failures", () => {
    expect(evaluateVision({ ...BASE_VISION, target: { x: 75, y: 15 } }).reason).toBe(
      "out-of-range",
    );
    expect(evaluateVision({ ...BASE_VISION, target: { x: 15, y: 45 } }).reason).toBe(
      "outside-cone",
    );
  });

  it("blocks vision through a wall", () => {
    const map = createGridMap(8, 8, [{ x: 3, y: 1 }]);

    expect(evaluateVision({ ...BASE_VISION, map })).toMatchObject({
      visible: false,
      reason: "occluded",
    });
  });

  it("treats a wall touched at a grid corner as an occluder", () => {
    const map = createGridMap(8, 8, [{ x: 2, y: 1 }]);

    expect(evaluateVision({
      ...BASE_VISION,
      map,
      observer: { x: 15, y: 15 },
      facing: { x: 1, y: 1 },
      target: { x: 45, y: 45 },
    }).reason).toBe("occluded");
  });

  it("preserves corner occlusion after accumulated traversal steps", () => {
    const map = createGridMap(100, 60, [{ x: 80, y: 39 }]);

    expect(evaluateVision({
      map,
      tileSize: 10,
      observer: { x: 0, y: 0 },
      facing: { x: 2, y: 1 },
      target: { x: 990, y: 495 },
      range: 1200,
      fieldOfViewRadians: Math.PI / 2,
    }).reason).toBe("occluded");
  });

  it("includes a target exactly on the cone boundary", () => {
    expect(evaluateVision({
      ...BASE_VISION,
      target: { x: 35, y: 35 },
    }).visible).toBe(true);
  });

  it("does not occlude a ray that passes immediately beside a corner", () => {
    const map = createGridMap(3, 3, [{ x: 0, y: 1 }]);

    expect(evaluateVision({
      ...BASE_VISION,
      map,
      observer: { x: 5, y: 5 },
      facing: { x: 1, y: 1 },
      target: { x: 25, y: 24.999999999 },
    }).visible).toBe(true);
  });

  it("rejects invalid numeric configuration and blocked endpoints", () => {
    expect(() => evaluateVision({ ...BASE_VISION, range: Number.NaN })).toThrow(
      "Vision configuration",
    );
    expect(() => evaluateVision({ ...BASE_VISION, fieldOfViewRadians: Math.PI * 3 })).toThrow(
      "Vision configuration",
    );
    const blockedMap = createGridMap(8, 8, [{ x: 1, y: 1 }]);
    expect(evaluateVision({
      ...BASE_VISION,
      map: blockedMap,
      observer: { x: 15, y: 15 },
      target: { x: 15, y: 15 },
    }).reason).toBe("occluded");
  });

  it("rejects a zero facing vector", () => {
    expect(evaluateVision({ ...BASE_VISION, facing: { x: 0, y: 0 } }).reason).toBe(
      "invalid-facing",
    );
  });
});

describe("sound", () => {
  const event = {
    position: { x: 20, y: 10 },
    radius: 15,
    emittedAtMs: 100,
    durationMs: 50,
  };

  it("hears an active event inside its radius", () => {
    expect(evaluateSound({ x: 10, y: 10 }, event, 125)).toMatchObject({
      active: true,
      heard: true,
      distance: 10,
    });
  });

  it("does not hear an expired or distant event", () => {
    expect(evaluateSound({ x: 10, y: 10 }, event, 151).heard).toBe(false);
    expect(evaluateSound({ x: 0, y: 10 }, event, 125).heard).toBe(false);
  });

  it("rejects non-finite sound values", () => {
    expect(() => evaluateSound({ x: 0, y: 0 }, { ...event, radius: Number.NaN }, 125)).toThrow(
      "Sound event",
    );
  });
});
