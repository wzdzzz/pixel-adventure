import Phaser from 'phaser';

export const GAME_CONFIG = {
  WIDTH: 1920,
  HEIGHT: 1080,

  MAP: {
    TILE_SIZE: 32,
    WIDTH: 80,
    HEIGHT: 60
  },

  PHYSICS: {
    GRAVITY: 0,
    PLAYER_SPEED: 200,
    PLAYER_MAX_SPEED: 1000,
    PLAYER_DRAG: 800,
    ENEMY_SPEED: 80
  },

  DEFAULT_STATE: {
    hp: 100,  // con=10 → maxHp=100
    maxHp: 100,
    score: 0,
    inventory: [],
    keysCollected: 0,
    hasArtifact: false,
    currentLevel: 0
  },

  ENTITY_SIZE: {
    PLAYER: { width: 28, height: 28 },
    ENEMY: { width: 28, height: 28 },
    ITEM: { width: 20, height: 20 },
    NPC: { width: 28, height: 32 }
  }
};

export function createPhaserConfig(scenes) {
  return {
    type: Phaser.AUTO,
    parent: 'game-container',
    pixelArt: true,
    // 关闭整数取整：相机/物体允许亚像素位置。开启时相机滚动被取整为
    // 3/4px 交替步进（移速非整数 px/帧），整个背景以 ~7Hz 抖动，观感眩晕。
    roundPixels: false,
    backgroundColor: '#0e0e1a',
    fps: {
      target: 60,
      min: 20,
      deltaHistory: 1,
      smoothStep: true
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: GAME_CONFIG.PHYSICS.GRAVITY },
        // Rendering can run above 60 Hz. A fixed 60 Hz physics step makes movement
        // alternate between stationary frames and position jumps on high-refresh displays.
        fixedStep: false,
        debug: false
      }
    },
    input: {
      mouse: {
        preventDefaultDown: true,
        preventDefaultUp: true
      }
    },
    scene: scenes,
    scale: {
      mode: Phaser.Scale.FIT,
      width: GAME_CONFIG.WIDTH,
      height: GAME_CONFIG.HEIGHT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      min: { width: 320, height: 180 },
      max: { width: 1920, height: 1080 }
    }
  };
}
