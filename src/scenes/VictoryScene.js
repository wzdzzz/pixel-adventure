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

    this.add.text(width / 2, height / 2 - 104, '你取回镇界古印，平定了云荒异变', {
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

    // ── 制作名单（分段淡入） ──
    const credits = [
      ['《云荒问道》', text.brass, '18px'],
      ['设计 · 程序 · 美术 · 音乐   wzdzzz × Claude', text.muted, '14px'],
      ['引擎  Phaser 3', text.muted, '14px'],
      ['感谢游玩', text.jadeBright, '15px'],
    ];
    credits.forEach(([line, color, size], i) => {
      const t = this.add.text(width / 2, height / 2 + 84 + i * 30, line, {
        fontSize: size, fill: color, fontFamily: font.body,
        fontStyle: i === 0 ? 'bold' : 'normal'
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 700, delay: 600 + i * 550 });
    });

    // ── 双选项：继续游历（post-game 读档回世界）/ 重返山门 ──
    const makeButton = (x, label, color, borderColor, onClick) => {
      const bg = this.add.rectangle(x, height / 2 + 256, 236, 50, colors.panelRaised)
        .setStrokeStyle(1, borderColor).setInteractive({ useHandCursor: true }).setAlpha(0);
      const txt = this.add.text(x, height / 2 + 256, label, {
        fontSize: '18px', fill: color, fontFamily: font.body
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: [bg, txt], alpha: 1, duration: 500, delay: 2900 });
      bg.on('pointerover', () => bg.setFillStyle(colors.panelHover));
      bg.on('pointerout', () => bg.setFillStyle(colors.panelRaised));
      bg.on('pointerdown', onClick);
      return bg;
    };

    // 继续游历：读回通关时自动写入的存档（post-game）
    const victorySlot = this.registry.get('lastVictorySlot') || this.registry.get('activeSaveSlot') || 1;
    makeButton(width / 2 - 136, '继续游历', text.jadeBright, colors.jade, () => {
      this.game.registry.set('pendingLoadSlot', victorySlot);
      this.game.registry.set('activeSaveSlot', victorySlot);
      this.scene.stop('PanelScene');
      this.scene.start('MainGameScene');
      this.scene.start('UIScene');
      this.scene.bringToTop('UIScene');
    });

    makeButton(width / 2 + 136, '重返山门', text.paper, colors.borderMuted, () => {
      this.scene.stop('UIScene');
      this.scene.stop('PanelScene');
      this.scene.start('MainMenuScene');
    });

    this.add.text(width / 2, height - 52, '云荒留痕，道途未止', {
      fontSize: '14px',
      fill: text.muted,
      fontFamily: font.body
    }).setOrigin(0.5);
  }
}
