import Phaser from 'phaser';
import { AssetManager } from '../assets/AssetManager.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
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
      playerPosition: { x: 100, y: 100 },
      collectedItems: []
    });

    this.time.delayedCall(600, () => {
      this.scene.start('MainGameScene');
      this.scene.start('UIScene');
      this.scene.bringToTop('UIScene');
    });
  }
}
