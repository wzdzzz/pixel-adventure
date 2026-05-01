import Phaser from 'phaser';
import { TEXTURES } from '../assets/AssetManager.js';

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create() {
    this.gameScene = this.scene.get('MainGameScene');

    this.createHUD();
    this.createHealthBar();
    this.createScoreDisplay();
    this.createKeyDisplay();
    this.createLevelDisplay();
    this.createControlsHint();
    this.setupEvents();

    // Listen for resize events to reposition all HUD elements
    this.scale.on('resize', this.onResize, this);
  }

  createHUD() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.hudBg = this.add.rectangle(0, 0, width, 50, 0x000000, 0.7).setOrigin(0, 0);
    this.bottomBar = this.add.rectangle(0, height - 30, width, 30, 0x000000, 0.5).setOrigin(0, 0);

    this.hudBg.setDepth(1);
    this.bottomBar.setDepth(1);
  }

  createHealthBar() {
    // HP
    this.heartIcon = this.add.image(20, 18, TEXTURES.HEART).setScale(0.8).setDepth(2);
    this.hpBarBg = this.add.rectangle(50, 18, 150, 12, 0x333333).setOrigin(0, 0.5).setDepth(2);
    this.hpBarBg.setStrokeStyle(1, 0x666666);
    this.hpBar = this.add.rectangle(51, 18, 148, 10, 0x00ff00).setOrigin(0, 0.5).setDepth(3);
    this.hpText = this.add.text(210, 18, '100/100', {
      fontSize: '12px',
      fill: '#ffffff',
      fontFamily: 'Courier New'
    }).setOrigin(0, 0.5).setDepth(3);

    // MP
    this.mpBarBg = this.add.rectangle(50, 35, 150, 10, 0x333333).setOrigin(0, 0.5).setDepth(2);
    this.mpBarBg.setStrokeStyle(1, 0x444466);
    this.mpBar = this.add.rectangle(51, 35, 148, 8, 0x4488ff).setOrigin(0, 0.5).setDepth(3);
    this.mpText = this.add.text(210, 35, '50/50', {
      fontSize: '11px',
      fill: '#aaccff',
      fontFamily: 'Courier New'
    }).setOrigin(0, 0.5).setDepth(3);
  }

  createScoreDisplay() {
    const width = this.cameras.main.width;

    this.scoreLabelText = this.add.text(width / 2, 15, '分数', {
      fontSize: '12px',
      fill: '#aaaaaa',
      fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(2);

    this.scoreText = this.add.text(width / 2, 32, '0', {
      fontSize: '18px',
      fill: '#ffff00',
      fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(2);
  }

  createKeyDisplay() {
    const width = this.cameras.main.width;

    this.keyIcon = this.add.image(width - 200, 25, TEXTURES.KEY).setScale(0.8).setDepth(2);
    this.keyText = this.add.text(width - 180, 25, 'x0', {
      fontSize: '14px',
      fill: '#ff69b4',
      fontFamily: 'Courier New'
    }).setOrigin(0, 0.5).setDepth(2);
  }

  createLevelDisplay() {
    const width = this.cameras.main.width;

    this.levelText = this.add.text(width - 80, 25, '第一关', {
      fontSize: '12px',
      fill: '#7c4dff',
      fontFamily: 'Courier New'
    }).setOrigin(0.5, 0.5).setDepth(2);
  }

  createControlsHint() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.controlsText = this.add.text(width / 2, height - 15, 'WASD:移动 | 左键:攻击 | E:交互', {
      fontSize: '12px',
      fill: '#888888',
      fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(2);
  }

  onResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;

    // Update camera size
    this.cameras.main.setSize(width, height);

    // Top bar: full width
    this.hudBg.setPosition(0, 0);
    this.hudBg.width = width;

    // Bottom bar: full width, anchored to bottom
    this.bottomBar.setPosition(0, height - 30);
    this.bottomBar.width = width;

    // HP/MP bars: top-left, fixed offset (20, 18) — no change needed for these
    // (heartIcon, hpBarBg, hpBar, hpText, mpBarBg, mpBar, mpText stay at fixed left positions)

    // Score: top-center
    this.scoreLabelText.setPosition(width / 2, 15);
    this.scoreText.setPosition(width / 2, 32);

    // Keys: top-right
    this.keyIcon.setPosition(width - 200, 25);
    this.keyText.setPosition(width - 180, 25);

    // Level name: top-right
    this.levelText.setPosition(width - 80, 25);

    // Controls hint: bottom-center
    this.controlsText.setPosition(width / 2, height - 15);
  }

  setupEvents() {
    if (this.gameScene) {
      this.gameScene.events.on('playerHpChanged', (hp, maxHp, mp, maxMp) => {
        this.updateHealthBar(hp, maxHp);
        if (mp !== undefined) this.updateMpBar(mp, maxMp);
      });

      this.gameScene.events.on('scoreChanged', (score) => {
        this.updateScore(score);
      });

      this.gameScene.events.on('keysChanged', (count) => {
        this.updateKeyCount(count);
      });

      this.gameScene.events.on('levelChanged', (name, index) => {
        this.updateLevelDisplay(name, index);
      });
    }
  }

  updateHealthBar(hp, maxHp) {
    const percentage = hp / maxHp;
    const barWidth = 148 * percentage;

    this.hpBar.width = Math.max(0, barWidth);

    if (percentage > 0.6) {
      this.hpBar.setFillStyle(0x00ff00);
    } else if (percentage > 0.3) {
      this.hpBar.setFillStyle(0xffff00);
    } else {
      this.hpBar.setFillStyle(0xff0000);
    }

    this.hpText.setText(`${Math.floor(hp)}/${maxHp}`);

    if (percentage <= 0.3) {
      this.tweens.add({
        targets: this.heartIcon,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 200,
        yoyo: true
      });
    }
  }

  updateMpBar(mp, maxMp) {
    if (!maxMp || maxMp <= 0) return;
    const percentage = mp / maxMp;
    this.mpBar.width = Math.max(0, 148 * percentage);
    this.mpText.setText(`${Math.floor(mp)}/${maxMp}`);
  }

  updateScore(score) {
    this.scoreText.setText(score.toString());
    this.tweens.add({
      targets: this.scoreText,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 100,
      yoyo: true
    });
  }

  updateKeyCount(count) {
    this.keyText.setText(`x${count}`);
    this.tweens.add({
      targets: this.keyText,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 100,
      yoyo: true
    });
  }

  updateLevelDisplay(name, index) {
    this.levelText.setText(name);
    this.tweens.add({
      targets: this.levelText,
      scaleX: 1.3, scaleY: 1.3,
      duration: 200, yoyo: true
    });
  }

  update() {}
}
