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
    this.createControlsHint();
    this.setupEvents();
  }

  createHUD() {
    this.hudBg = this.add.rectangle(0, 0, 800, 50, 0x000000, 0.7).setOrigin(0, 0);
    this.bottomBar = this.add.rectangle(0, 570, 800, 30, 0x000000, 0.5).setOrigin(0, 0);

    this.hudBg.setDepth(1);
    this.bottomBar.setDepth(1);
  }

  createHealthBar() {
    this.heartIcon = this.add.image(20, 25, TEXTURES.HEART).setScale(0.8).setDepth(2);
    this.hpBarBg = this.add.rectangle(50, 25, 150, 16, 0x333333).setOrigin(0, 0.5).setDepth(2);
    this.hpBarBg.setStrokeStyle(1, 0x666666);
    this.hpBar = this.add.rectangle(51, 25, 148, 14, 0x00ff00).setOrigin(0, 0.5).setDepth(3);
    this.hpText = this.add.text(210, 25, '100/100', {
      fontSize: '14px',
      fill: '#ffffff',
      fontFamily: 'Courier New'
    }).setOrigin(0, 0.5).setDepth(3);
  }

  createScoreDisplay() {
    this.add.text(400, 15, '分数', {
      fontSize: '12px',
      fill: '#aaaaaa',
      fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(2);

    this.scoreText = this.add.text(400, 32, '0', {
      fontSize: '18px',
      fill: '#ffff00',
      fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(2);
  }

  createKeyDisplay() {
    this.keyIcon = this.add.image(600, 25, TEXTURES.KEY).setScale(0.8).setDepth(2);
    this.keyText = this.add.text(620, 25, 'x0', {
      fontSize: '14px',
      fill: '#ff69b4',
      fontFamily: 'Courier New'
    }).setOrigin(0, 0.5).setDepth(2);
  }

  createControlsHint() {
    this.add.text(400, 585, 'WASD:移动 | 空格:攻击 | E:交互', {
      fontSize: '12px',
      fill: '#888888',
      fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(2);
  }

  setupEvents() {
    if (this.gameScene) {
      this.gameScene.events.on('playerHpChanged', (hp, maxHp) => {
        this.updateHealthBar(hp, maxHp);
      });

      this.gameScene.events.on('scoreChanged', (score) => {
        this.updateScore(score);
      });

      this.gameScene.events.on('keysChanged', (count) => {
        this.updateKeyCount(count);
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

  update() {}
}
