import Phaser from 'phaser';
import { AssetManager, TEXTURES } from '../assets/AssetManager.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Load real sprite images — these override generated textures
    const sprites = {
      [TEXTURES.CHEST_CLOSED]: 'sprites/chest_closed.png',
      [TEXTURES.CHEST_OPEN]: 'sprites/chest_open.png',
      [TEXTURES.CHEST_LOCKED]: 'sprites/chest_locked.png',
      [TEXTURES.COIN]: 'sprites/coin.png',
      [TEXTURES.POTION]: 'sprites/potion.png',
      [TEXTURES.CAMPFIRE]: 'sprites/campfire.png',
      [TEXTURES.SIGN]: 'sprites/sign.png',
      [TEXTURES.STONE]: 'sprites/stone.png',
      [TEXTURES.ARTIFACT]: 'sprites/artifact.png',
      [TEXTURES.NPC]: 'sprites/npc.png',
      [TEXTURES.BARREL]: 'sprites/barrel.png',
      [TEXTURES.GEM]: 'sprites/gem.png',
      [TEXTURES.LANTERN]: 'sprites/lantern.png',
      [TEXTURES.ROCK_CANDLE]: 'sprites/rock_candle.png',
      [TEXTURES.HEAL_ICON]: 'sprites/heal_icon.png',
    };
    for (const [key, path] of Object.entries(sprites)) {
      this.load.image(key, path);
    }
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    const titleText = this.add.text(width / 2, height / 2 - 60, '像素冒险', {
      fontSize: '36px',
      fill: '#00ff00',
      fontFamily: 'Courier New',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const loadText = this.add.text(width / 2, height / 2 + 10, '正在加载...', {
      fontSize: '16px',
      fill: '#888888',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: loadText,
      alpha: 0.3,
      duration: 500,
      yoyo: true,
      repeat: -1
    });

    AssetManager.generateAllTextures(this);

    this.registry.set('gameState', {
      hp: 100,
      maxHp: 100,
      score: 0,
      inventory: [],
      keysCollected: 0,
      hasArtifact: false,
      currentLevel: 0,
      playerPosition: { x: 150, y: 150 },
      collectedItems: []
    });

    this.time.delayedCall(600, () => {
      this.scene.start('MainGameScene');
      this.scene.start('UIScene');
      this.scene.bringToTop('UIScene');
    });
  }
}
