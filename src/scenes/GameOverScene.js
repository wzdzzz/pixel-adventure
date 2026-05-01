import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);

    const gameOverText = this.add.text(width / 2, height / 2 - 80, '游戏结束', {
      fontSize: '48px',
      fill: '#ff0000',
      fontFamily: 'Courier New',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const gameState = this.registry.get('gameState');
    const score = gameState ? gameState.score : 0;

    this.add.text(width / 2, height / 2 - 20, `最终得分: ${score}`, {
      fontSize: '24px',
      fill: '#ffff00',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);

    const restartText = this.add.text(width / 2, height / 2 + 60, '点击屏幕重新开始', {
      fontSize: '20px',
      fill: '#ffffff',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: restartText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    this.tweens.add({
      targets: gameOverText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.add.text(width / 2, height / 2 + 110, '按 R 键快速重启', {
      fontSize: '14px',
      fill: '#888888',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);

    const resetGame = () => {
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
      SaveSystem.deleteSave();
      this.scene.start('BootScene');
    };

    this.input.on('pointerdown', resetGame);
    this.input.keyboard.on('keydown-R', resetGame);
  }
}
