import Phaser from 'phaser';
import { UI_THEME } from '../config/uiTheme.js';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const { colors, text, font } = UI_THEME;

    this.add.rectangle(width / 2, height / 2, width, height, colors.shadow);

    const landscape = this.add.graphics();
    landscape.fillStyle(colors.ink, 1);
    landscape.fillPoints([
      new Phaser.Geom.Point(0, height * 0.76),
      new Phaser.Geom.Point(width * 0.16, height * 0.57),
      new Phaser.Geom.Point(width * 0.32, height * 0.74),
      new Phaser.Geom.Point(width * 0.52, height * 0.49),
      new Phaser.Geom.Point(width * 0.7, height * 0.72),
      new Phaser.Geom.Point(width * 0.86, height * 0.6),
      new Phaser.Geom.Point(width, height * 0.75),
      new Phaser.Geom.Point(width, height),
      new Phaser.Geom.Point(0, height),
    ], true);
    landscape.lineStyle(1, colors.cinnabar, 0.45);
    landscape.lineBetween(width / 2 - 210, height / 2 - 118, width / 2 + 210, height / 2 - 118);

    const gameOverText = this.add.text(width / 2, height / 2 - 210, '道途暂断', {
      fontSize: '64px',
      fill: text.cinnabarBright,
      fontFamily: font.display,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const gameState = this.registry.get('gameState');
    const score = gameState ? gameState.score : 0;

    this.add.text(width / 2, height / 2 - 74, `此行历练  ${score}`, {
      fontSize: '26px',
      fill: text.brass,
      fontFamily: font.body
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 20, '心火未熄，尚可再问云荒', {
      fontSize: '17px',
      fill: text.muted,
      fontFamily: font.body
    }).setOrigin(0.5);

    const actionBg = this.add.rectangle(width / 2, height / 2 + 82, 240, 48, colors.panelRaised)
      .setStrokeStyle(1, colors.cinnabar);
    const restartText = this.add.text(width / 2, height / 2 + 82, '重整行装', {
      fontSize: '18px',
      fill: text.paper,
      fontFamily: font.body
    }).setOrigin(0.5);

    this.tweens.add({
      targets: [actionBg, restartText],
      alpha: 0.62,
      duration: 1200,
      yoyo: true,
      repeat: -1
    });

    this.tweens.add({
      targets: gameOverText,
      alpha: 0.74,
      duration: 1700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.add.text(width / 2, height - 52, '一念回转，再续前缘', {
      fontSize: '14px',
      fill: text.muted,
      fontFamily: font.body
    }).setOrigin(0.5);

    const goToMenu = () => {
      this.scene.stop('UIScene');
      this.scene.stop('PanelScene');
      this.scene.start('MainMenuScene');
    };

    this.input.on('pointerdown', goToMenu);
    this.input.keyboard.on('keydown-R', goToMenu);
  }
}
