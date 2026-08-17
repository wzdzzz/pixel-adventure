import Phaser from 'phaser';
import { UI_THEME } from '../config/uiTheme.js';

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
    const { colors, text, font } = UI_THEME;

    this.add.rectangle(width / 2, height / 2, width, height, colors.ink);

    const landscape = this.add.graphics();
    landscape.fillStyle(colors.backdrop, 1);
    landscape.fillPoints([
      new Phaser.Geom.Point(0, height * 0.75),
      new Phaser.Geom.Point(width * 0.17, height * 0.55),
      new Phaser.Geom.Point(width * 0.33, height * 0.7),
      new Phaser.Geom.Point(width * 0.5, height * 0.4),
      new Phaser.Geom.Point(width * 0.66, height * 0.69),
      new Phaser.Geom.Point(width * 0.83, height * 0.52),
      new Phaser.Geom.Point(width, height * 0.73),
      new Phaser.Geom.Point(width, height),
      new Phaser.Geom.Point(0, height),
    ], true);
    landscape.fillStyle(colors.panel, 0.9);
    landscape.fillPoints([
      new Phaser.Geom.Point(0, height * 0.84),
      new Phaser.Geom.Point(width * 0.26, height * 0.68),
      new Phaser.Geom.Point(width * 0.47, height * 0.83),
      new Phaser.Geom.Point(width * 0.7, height * 0.65),
      new Phaser.Geom.Point(width, height * 0.82),
      new Phaser.Geom.Point(width, height),
      new Phaser.Geom.Point(0, height),
    ], true);
    landscape.lineStyle(2, colors.brassMuted, 0.72);
    landscape.lineBetween(width / 2 - 260, height / 2 - 154, width / 2 - 50, height / 2 - 154);
    landscape.lineBetween(width / 2 + 50, height / 2 - 154, width / 2 + 260, height / 2 - 154);
    landscape.fillStyle(colors.cinnabar, 1);
    landscape.fillRect(width / 2 - 15, height / 2 - 169, 30, 30);

    const victoryText = this.add.text(width / 2, height / 2 - 250, '问道功成', {
      fontSize: '72px',
      fill: text.paper,
      fontFamily: font.display,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: victoryText,
      alpha: 0.76,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.add.text(width / 2, height / 2 - 104, '你取得镇界灵宝，平定了云荒异变', {
      fontSize: '20px',
      fill: text.jadeBright,
      fontFamily: font.body
    }).setOrigin(0.5);

    // 分数显示
    const gameState = this.registry.get('gameState');
    const score = gameState ? gameState.score : 0;

    this.add.text(width / 2, height / 2 - 36, `历练所得  ${score}`, {
      fontSize: '28px',
      fill: text.brass,
      fontFamily: font.body
    }).setOrigin(0.5);

    const keysCollected = gameState ? gameState.keysCollected : 0;
    this.add.text(width / 2, height / 2 + 18, `禁制令牌  ${keysCollected}`, {
      fontSize: '16px',
      fill: text.muted,
      fontFamily: font.body
    }).setOrigin(0.5);

    const actionBg = this.add.rectangle(width / 2, height / 2 + 116, 240, 48, colors.panelRaised)
      .setStrokeStyle(1, colors.jade);
    const restartText = this.add.text(width / 2, height / 2 + 116, '重返山门', {
      fontSize: '18px',
      fill: text.jadeBright,
      fontFamily: font.body
    }).setOrigin(0.5);

    this.tweens.add({
      targets: [actionBg, restartText],
      alpha: 0.64,
      duration: 1200,
      yoyo: true,
      repeat: -1
    });

    const goToMenu = () => {
      this.scene.stop('UIScene');
      this.scene.stop('PanelScene');
      this.scene.start('MainMenuScene');
    };

    this.input.on('pointerdown', goToMenu);
    this.input.keyboard.on('keydown-R', goToMenu);

    this.add.text(width / 2, height - 52, '云荒留痕，道途未止', {
      fontSize: '14px',
      fill: text.muted,
      fontFamily: font.body
    }).setOrigin(0.5);
  }
}
