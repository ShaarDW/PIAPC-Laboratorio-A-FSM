import Phaser from "phaser";
import {
  createGuardController,
  stepGuardController,
  type GuardControllerState,
  type TelemetryEntry,
} from "../../application/simulation/guardController";
import {
  FIELD_OF_VIEW,
  labGuardConfig,
  SOUND_DURATION_MS,
  SOUND_RADIUS,
  VISION_RANGE,
} from "../../application/simulation/guardSetup";
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  LAB_MAP,
  PATROL_POINTS,
  PLAYER_START,
  TILE_SIZE,
} from "../../application/simulation/labLevel";
import type { GuardState } from "../../domain/behavior/guardStateMachine";
import { cellCenter, isWalkable, type GridPoint } from "../../domain/model/grid";
import type { SearchAlgorithm, SearchStatus } from "../../domain/navigation/search";
import { timeSinceLastPerception } from "../../domain/perception/memory";
import type { SoundEvent, VisionReason } from "../../domain/perception/perception";

const PLAYER_SPEED = 190;
const STEP_MS = 100;
const GUARD_CONFIG = labGuardConfig();
const STATUS_LABELS: Readonly<Record<SearchStatus, string>> = {
  success: "EXITO",
  unreachable: "INALCANZABLE",
  "invalid-start": "INICIO INVALIDO",
  "invalid-goal": "DESTINO INVALIDO",
};
const VISION_LABELS: Readonly<Record<VisionReason, string>> = {
  visible: "VISIBLE",
  "out-of-range": "FUERA DE RANGO",
  "outside-cone": "FUERA DEL CONO",
  occluded: "OCLUIDO",
  "invalid-facing": "DIRECCION INVALIDA",
};
const STATE_LABELS: Readonly<Record<GuardState, string>> = {
  patrol: "PATRULLAR",
  investigate: "INVESTIGAR",
  chase: "PERSEGUIR",
  search: "BUSCAR",
  return: "REGRESAR",
};
const STATE_COLORS: Readonly<Record<GuardState, number>> = {
  patrol: 0x6b8afd,
  investigate: 0xe5b454,
  chase: 0xe16969,
  search: 0xc58af0,
  return: 0x73c991,
};

declare global {
  interface Window {
    __guardTelemetry?: TelemetryEntry[];
  }
}

/** Phaser adapter: reads input and time, delegates every decision to the guard controller, draws the result. */
export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private guard!: Phaser.GameObjects.Arc;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private moveUp!: Phaser.Input.Keyboard.Key;
  private moveDown!: Phaser.Input.Keyboard.Key;
  private moveLeft!: Phaser.Input.Keyboard.Key;
  private moveRight!: Phaser.Input.Keyboard.Key;
  private reset!: Phaser.Input.Keyboard.Key;
  private toggleAlgorithm!: Phaser.Input.Keyboard.Key;
  private emitSound!: Phaser.Input.Keyboard.Key;
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private stepKey!: Phaser.Input.Keyboard.Key;
  private navigationGraphics!: Phaser.GameObjects.Graphics;
  private perceptionGraphics!: Phaser.GameObjects.Graphics;
  private targetMarker!: Phaser.GameObjects.Arc;
  private lastKnownMarker!: Phaser.GameObjects.Arc;
  private hud!: Phaser.GameObjects.Text;
  private controller!: GuardControllerState;
  private algorithm: SearchAlgorithm = "astar";
  private paused = false;
  private simulationTimeMs = 0;
  private visionReason: VisionReason | null = null;
  private soundHeard = false;

  public constructor() {
    super("GameScene");
  }

  public create(): void {
    this.algorithm = "astar";
    this.paused = false;
    this.simulationTimeMs = 0;
    this.controller = createGuardController(GUARD_CONFIG, this.simulationTimeMs, this.algorithm);
    window.__guardTelemetry ??= [];
    this.cameras.main.setBackgroundColor("#10161c");
    this.drawGrid();

    const walls = this.physics.add.staticGroup();
    for (let y = 0; y < GRID_HEIGHT; y += 1) {
      for (let x = 0; x < GRID_WIDTH; x += 1) {
        if (!isWalkable(LAB_MAP, { x, y })) {
          const center = cellCenter({ x, y }, TILE_SIZE);
          const wall = this.add.rectangle(center.x, center.y, TILE_SIZE, TILE_SIZE, 0x27333d);
          wall.setStrokeStyle(1, 0x3a4c58);
          walls.add(wall);
        }
      }
    }
    this.drawPatrolPoints();

    const spawn = cellCenter(PLAYER_START, TILE_SIZE);
    this.player = this.add.rectangle(spawn.x, spawn.y, 20, 20, 0xe5b454);
    this.player.setStrokeStyle(2, 0xffd98a);
    this.player.setDepth(12); // above the HUD, like the guard
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, walls);

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("Keyboard input is unavailable.");
    }
    this.cursors = keyboard.createCursorKeys();
    this.moveUp = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.moveDown = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.moveLeft = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.moveRight = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.reset = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.toggleAlgorithm = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.emitSound = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.pauseKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.stepKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.N);

    this.perceptionGraphics = this.add.graphics().setDepth(1);
    this.navigationGraphics = this.add.graphics().setDepth(2);
    this.guard = this.add
      .circle(this.controller.position.x, this.controller.position.y, 11, STATE_COLORS.patrol)
      .setStrokeStyle(2, 0xd9e4ea)
      .setDepth(12); // above the HUD so the guard is never hidden
    this.targetMarker = this.add
      .circle(0, 0, 10, 0x000000, 0)
      .setStrokeStyle(3, 0x73c991)
      .setDepth(11);
    this.lastKnownMarker = this.add
      .circle(0, 0, 7, 0x000000, 0)
      .setStrokeStyle(2, 0xe16969)
      .setDepth(11)
      .setVisible(false);

    this.add
      .text(16, 14, "H4 / MAQUINA DE ESTADOS", {
        color: "#9eb4c2",
        fontFamily: "monospace",
        fontSize: "14px",
      })
      .setDepth(10);
    this.hud = this.add
      .text(GRID_WIDTH * TILE_SIZE - 16, 14, "", {
        align: "right",
        backgroundColor: "#10161ccc",
        color: "#d9e4ea",
        fontFamily: "monospace",
        fontSize: "13px",
        padding: { x: 8, y: 6 },
      })
      .setOrigin(1, 0)
      .setDepth(10);

    this.render();
  }

  public update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.reset)) {
      this.simulate(0, { reset: true });
      this.scene.restart();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.toggleAlgorithm)) {
      this.algorithm = this.algorithm === "astar" ? "bfs" : "astar";
    }
    if (Phaser.Input.Keyboard.JustDown(this.pauseKey)) {
      this.paused = !this.paused;
    }

    const stepRequested = Phaser.Input.Keyboard.JustDown(this.stepKey);
    if (this.paused && !stepRequested) {
      this.playerBody.setVelocity(0, 0);
      this.render();
      return;
    }
    const frameMs = this.paused ? STEP_MS : delta;

    let newSound: SoundEvent | null = null;
    if (Phaser.Input.Keyboard.JustDown(this.emitSound)) {
      newSound = {
        position: { x: this.player.x, y: this.player.y },
        radius: SOUND_RADIUS,
        emittedAtMs: this.simulationTimeMs + frameMs,
        durationMs: SOUND_DURATION_MS,
      };
    }

    const horizontal = Number(this.cursors.right.isDown || this.moveRight.isDown)
      - Number(this.cursors.left.isDown || this.moveLeft.isDown);
    const vertical = Number(this.cursors.down.isDown || this.moveDown.isDown)
      - Number(this.cursors.up.isDown || this.moveUp.isDown);
    const velocity = new Phaser.Math.Vector2(horizontal, vertical);
    if (velocity.lengthSq() > 0) {
      velocity.normalize().scale(PLAYER_SPEED);
    }
    this.playerBody.setVelocity(this.paused ? 0 : velocity.x, this.paused ? 0 : velocity.y);

    this.simulate(frameMs, { newSound });
    this.render();
  }

  /** Advances the domain simulation with an explicit simulation clock (pause keeps it frozen). */
  private simulate(frameMs: number, extra: { newSound?: SoundEvent | null; reset?: boolean }): void {
    this.simulationTimeMs += frameMs;
    const output = stepGuardController(
      this.controller,
      {
        timeMs: this.simulationTimeMs,
        deltaMs: frameMs,
        playerPosition: { x: this.player.x, y: this.player.y },
        algorithm: this.algorithm,
        ...extra,
      },
      GUARD_CONFIG,
    );
    this.controller = output.state;
    this.visionReason = output.vision?.reason ?? null;
    this.soundHeard = output.soundHeard;
    for (const entry of output.entries) {
      window.__guardTelemetry?.push(entry);
      console.info("[guardia]", JSON.stringify(entry));
    }
  }

  private render(): void {
    const { position, fsm } = this.controller;
    this.guard.setPosition(position.x, position.y);
    this.guard.setFillStyle(STATE_COLORS[fsm.state]);
    this.drawRoute();
    this.drawPerception();
    this.updateHud();
  }

  private drawGrid(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x1b252d, 1);
    for (let x = 0; x <= GRID_WIDTH; x += 1) {
      graphics.lineBetween(x * TILE_SIZE, 0, x * TILE_SIZE, GRID_HEIGHT * TILE_SIZE);
    }
    for (let y = 0; y <= GRID_HEIGHT; y += 1) {
      graphics.lineBetween(0, y * TILE_SIZE, GRID_WIDTH * TILE_SIZE, y * TILE_SIZE);
    }
  }

  private drawPatrolPoints(): void {
    const graphics = this.add.graphics().setDepth(1);
    graphics.lineStyle(2, 0x6b8afd, 0.6);
    for (const point of PATROL_POINTS) {
      const center = cellCenter(point, TILE_SIZE);
      graphics.strokeRect(center.x - 8, center.y - 8, 16, 16);
    }
  }

  private drawRoute(): void {
    const { route, routeGoal } = this.controller;
    this.navigationGraphics.clear();
    this.targetMarker.setVisible(routeGoal !== null);
    if (routeGoal) {
      const goal = cellCenter(routeGoal, TILE_SIZE);
      this.targetMarker.setPosition(goal.x, goal.y);
      this.targetMarker.setStrokeStyle(3, route?.status === "success" ? 0x73c991 : 0xe16969);
    }
    if (!route) {
      return;
    }
    this.navigationGraphics.fillStyle(0x3b819c, 0.18);
    for (const point of route.explored) {
      this.navigationGraphics.fillRect(point.x * TILE_SIZE + 3, point.y * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6);
    }
    const remaining: GridPoint[] = route.path.slice(Math.max(0, this.controller.nextWaypoint - 1));
    const first = remaining[0];
    if (!first) {
      return;
    }
    const start = cellCenter(first, TILE_SIZE);
    this.navigationGraphics.lineStyle(4, 0x62d0e8, 0.9);
    this.navigationGraphics.beginPath();
    this.navigationGraphics.moveTo(start.x, start.y);
    for (const point of remaining.slice(1)) {
      const center = cellCenter(point, TILE_SIZE);
      this.navigationGraphics.lineTo(center.x, center.y);
    }
    this.navigationGraphics.strokePath();
  }

  private drawPerception(): void {
    const { position, facing, perception } = this.controller;
    this.perceptionGraphics.clear();
    const facingAngle = Math.atan2(facing.y, facing.x);
    this.perceptionGraphics.fillStyle(this.visionReason === "visible" ? 0x73c991 : 0x6b8afd, 0.16);
    this.perceptionGraphics.beginPath();
    this.perceptionGraphics.moveTo(position.x, position.y);
    this.perceptionGraphics.arc(
      position.x,
      position.y,
      VISION_RANGE,
      facingAngle - FIELD_OF_VIEW / 2,
      facingAngle + FIELD_OF_VIEW / 2,
    );
    this.perceptionGraphics.closePath();
    this.perceptionGraphics.fillPath();

    if (perception.soundEvent) {
      this.perceptionGraphics.lineStyle(2, 0xe5b454, 0.8);
      this.perceptionGraphics.strokeCircle(
        perception.soundEvent.position.x,
        perception.soundEvent.position.y,
        perception.soundEvent.radius,
      );
    }

    const lastKnown = this.controller.fsm.lastKnownCell;
    this.lastKnownMarker.setVisible(lastKnown !== null);
    if (lastKnown) {
      const center = cellCenter(lastKnown, TILE_SIZE);
      this.lastKnownMarker.setPosition(center.x, center.y);
    }
  }

  private updateHud(): void {
    const { fsm, route, perception, lastEntry } = this.controller;
    const previous = fsm.previousState ? STATE_LABELS[fsm.previousState] : "-";
    const memory = fsm.lastKnownCell
      ? `${fsm.lastKnownSource} ${fsm.lastKnownCell.x},${fsm.lastKnownCell.y}`
      : "-";
    const age = timeSinceLastPerception(perception.memory, this.simulationTimeMs);
    const routeText = route
      ? `${route.algorithm === "astar" ? "A*" : "BFS"} ${STATUS_LABELS[route.status]} costo ${route.totalCost ?? "-"} exp ${route.expandedNodes}`
      : "sin ruta";
    const searchLeft = fsm.searchEndsAtMs === null
      ? ""
      : ` | vence en ${Math.max(0, (fsm.searchEndsAtMs - this.simulationTimeMs) / 1000).toFixed(1)}s`;

    this.hud.setText([
      `estado ${STATE_LABELS[fsm.state]} (antes ${previous})${searchLeft}`,
      `evento ${lastEntry ? `${lastEntry.event} [${lastEntry.kind}]` : "-"}`,
      `razon ${lastEntry?.reason ?? "-"}`,
      `memoria ${memory}${age === null ? "" : ` hace ${(age / 1000).toFixed(1)}s`}`,
      `ruta ${routeText}`,
      `vision ${this.visionReason ? VISION_LABELS[this.visionReason] : "-"} | sonido ${perception.soundEvent ? (this.soundHeard ? "OIDO" : "FUERA DE RANGO") : "-"}`,
      `algoritmo ${this.algorithm === "astar" ? "A*" : "BFS"}${this.paused ? " | PAUSA (N avanza)" : ""}`,
    ]);
  }
}
