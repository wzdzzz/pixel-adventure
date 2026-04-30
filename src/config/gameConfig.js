import Phaser from 'phaser';

export const GAME_CONFIG = {
  WIDTH: 800,
  HEIGHT: 600,

  MAP: {
    TILE_SIZE: 32,
    WIDTH: 50,
    HEIGHT: 40
  },

  PHYSICS: {
    GRAVITY: 0,
    PLAYER_SPEED: 200,
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
    width: GAME_CONFIG.WIDTH,
    height: GAME_CONFIG.HEIGHT,
    parent: 'game-container',
    pixelArt: true,
    roundPixels: true,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: GAME_CONFIG.PHYSICS.GRAVITY },
        debug: false
      }
    },
    scene: scenes,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  };
}
