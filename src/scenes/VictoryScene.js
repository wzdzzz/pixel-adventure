import Phaser from 'phaser';

/**
 * 胜利场景
 *
 * 当玩家到达地图终点并持有神器时显示
 */
export class VictoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VictoryScene' });
  }

  /**
   * create 生命周期
   * 创建胜利界面
   */
  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 背景 - 渐变效果
    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    // 粒子效果背景
    for (let i = 0; i < 50; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.Between(1, 3),
        0xffff00,
        Phaser.Math.FloatBetween(0.3, 1)
      );

      // 闪烁动画
      this.tweens.add({
        targets: star,
        alpha: 0.2,
        duration: Phaser.Math.Between(500, 1500),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1000)
      });
    }

    // 胜利标题
    const victoryText = this.add.text(width / 2, height / 2 - 100, '胜利！', {
      fontSize: '64px',
      fill: '#00ff00',
      fontFamily: 'Courier New',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // 标题动画
    this.tweens.add({
      targets: victoryText,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 副标题
    this.add.text(width / 2, height / 2 - 30, '你成功找到了神器并逃出了迷宫！', {
      fontSize: '18px',
      fill: '#ffffff',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);

    // 分数显示
    const gameState = this.registry.get('gameState');
    const score = gameState ? gameState.score : 0;

    this.add.text(width / 2, height / 2 + 20, `最终得分: ${score}`, {
      fontSize: '24px',
      fill: '#ffff00',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);

    // 统计信息
    const keysCollected = gameState ? gameState.keysCollected : 0;
    this.add.text(width / 2, height / 2 + 60, `收集钥匙: ${keysCollected}`, {
      fontSize: '16px',
      fill: '#ff69b4',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);

    // 重新开始提示
    const restartText = this.add.text(width / 2, height / 2 + 120, '点击屏幕重新开始冒险', {
      fontSize: '18px',
      fill: '#aaaaaa',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);

    // 闪烁动画
    this.tweens.add({
      targets: restartText,
      alpha: 0.3,
      duration: 1000,
      yoyo: true,
      repeat: -1
    });

    // 点击屏幕重新开始
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

    // 底部提示
    this.add.text(width / 2, height - 40, '感谢游玩！按 R 键重新开始', {
      fontSize: '14px',
      fill: '#666666',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);
  }
}
