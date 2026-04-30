import Phaser from 'phaser';

/**
 * 游戏失败场景
 *
 * 当玩家 HP 归零时显示
 * 点击屏幕重启游戏
 */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  /**
   * create 生命周期
   * 创建游戏失败界面
   */
  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 背景遮罩
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);

    // 游戏结束标题
    const gameOverText = this.add.text(width / 2, height / 2 - 80, '游戏结束', {
      fontSize: '48px',
      fill: '#ff0000',
      fontFamily: 'Courier New',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // 分数显示
    const gameState = this.registry.get('gameState');
    const score = gameState ? gameState.score : 0;

    this.add.text(width / 2, height / 2 - 20, `最终得分: ${score}`, {
      fontSize: '24px',
      fill: '#ffff00',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);

    // 重启提示
    const restartText = this.add.text(width / 2, height / 2 + 60, '点击屏幕重新开始', {
      fontSize: '20px',
      fill: '#ffffff',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);

    // 闪烁动画
    this.tweens.add({
      targets: restartText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    // 标题动画
    this.tweens.add({
      targets: gameOverText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 点击屏幕重启
    this.input.on('pointerdown', () => {
      // 重置游戏状态
      this.registry.set('gameState', {
        hp: 100,
        maxHp: 100,
        score: 0,
        inventory: [],
        keysCollected: 0,
        hasArtifact: false,
        playerPosition: { x: 150, y: 150 },
        collectedItems: []
      });

      // 删除存档
      const { SaveSystem } = require('../systems/SaveSystem.js');
      SaveSystem.deleteSave();

      // 重启游戏
      this.scene.start('BootScene');
    });

    // 按 R 键重启
    this.input.keyboard.on('keydown-R', () => {
      this.registry.set('gameState', {
        hp: 100,
        maxHp: 100,
        score: 0,
        inventory: [],
        keysCollected: 0,
        hasArtifact: false,
        playerPosition: { x: 150, y: 150 },
        collectedItems: []
      });

      this.scene.start('BootScene');
    });

    // 显示提示
    this.add.text(width / 2, height / 2 + 110, '按 R 键快速重启', {
      fontSize: '14px',
      fill: '#888888',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);
  }
}
