import Phaser from "phaser";
import { GRID_HEIGHT, GRID_WIDTH, TILE_SIZE } from "../application/simulation/labLevel";
import { GameScene } from "./scenes/GameScene";

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: GRID_WIDTH * TILE_SIZE,
  height: GRID_HEIGHT * TILE_SIZE,
  backgroundColor: "#10161c",
  pixelArt: true,
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
};
