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
    this.createGoldDisplay();
    this.createLevelDisplay();
    this.createControlsHint();
    this.setupEvents();
    this.createQuestTracker();

    // Listen for resize events to reposition all HUD elements
    this.scale.on('resize', this.onResize, this);

    // Cleanup resize listener when the scene shuts down
    this.events.on('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
    });
  }

  createHUD() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.hudBg = this.add.rectangle(0, 0, width, 60, 0x000000, 0.7).setOrigin(0, 0);
    this.bottomBar = this.add.rectangle(0, height - 30, width, 30, 0x000000, 0.5).setOrigin(0, 0);

    this.hudBg.setDepth(1);
    this.bottomBar.setDepth(1);
  }

  createHealthBar() {
    // HP
    this.heartIcon = this.add.image(20, 18, TEXTURES.HEART).setScale(0.8).setDepth(2);
    this.hpBarBg = this.add.rectangle(50, 18, 150, 12, 0x333333).setOrigin(0, 0.5).setDepth(2);
    this.hpBarBg.setStrokeStyle(1, 0x666666);
    this.hpGhost = this.add.rectangle(51, 18, 148, 10, 0xffffff, 0.4).setOrigin(0, 0.5).setDepth(2.5);
    this.hpBar = this.add.rectangle(51, 18, 148, 10, 0x00ff00).setOrigin(0, 0.5).setDepth(3);
    this.hpText = this.add.text(210, 18, '100/100', {
      fontSize: '12px',
      fill: '#ffffff',
      fontFamily: 'Courier New'
    }).setOrigin(0, 0.5).setDepth(3);

    // Level display next to HP bar
    this.playerLevelText = this.add.text(210, 8, 'LV.1', {
      fontSize: '11px', fill: '#ffd700', fontFamily: 'Courier New', fontStyle: 'bold'
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

    // XP bar
    this.xpBarBg = this.add.rectangle(50, 48, 150, 8, 0x222233).setOrigin(0, 0.5).setDepth(2);
    this.xpBarBg.setStrokeStyle(1, 0x333344);
    this.xpBar = this.add.rectangle(51, 48, 0, 6, 0x9966ff).setOrigin(0, 0.5).setDepth(3);
    this.xpText = this.add.text(210, 48, 'XP: 0/40', {
      fontSize: '9px', fill: '#9988cc', fontFamily: 'Courier New'
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

  createGoldDisplay() {
    const width = this.cameras.main.width;
    this.goldText = this.add.text(width - 200, 40, '💰 0', {
      fontSize: '11px', fill: '#ffd700', fontFamily: 'Courier New'
    }).setDepth(2);
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

    this.controlsText = this.add.text(width / 2, height - 15, 'WASD:移动 | 左键:攻击 | E:交互 | TAB:面板', {
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
    this.hudBg.setSize(width, 60);

    // Bottom bar: full width, anchored to bottom
    this.bottomBar.setPosition(0, height - 30);
    this.bottomBar.setSize(width, 30);

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

    // Gold display
    if (this.goldText) this.goldText.setPosition(width - 200, 40);

    // Quest tracker
    if (this.questTrackerBg) {
      this.questTrackerBg.setPosition(width - 10, height - 40);
      this.questTrackerTitle.setPosition(width - 205, height - 95);
      this.questTrackerObj1.setPosition(width - 205, height - 80);
      this.questTrackerObj2.setPosition(width - 205, height - 65);
    }
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

      // XP changes
      this.gameScene.events.on('xpChanged', (xp, xpRequired) => {
        this.updateXpBar(xp, xpRequired);
      });

      // Level up
      this.gameScene.events.on('levelUp', (level) => {
        if (this.playerLevelText) this.playerLevelText.setText(`LV.${level}`);
      });

      // Gold changes
      this.gameScene.events.on('goldChanged', (gold) => {
        if (this.goldText) this.goldText.setText(`💰 ${gold}`);
      });

      // Quest tracking
      this.gameScene.events.on('questActivated', () => this.updateQuestTracker());
      this.gameScene.events.on('questProgressUpdated', () => this.updateQuestTracker());
      this.gameScene.events.on('questCompleted', () => this.updateQuestTracker());
    }
  }

  updateHealthBar(hp, maxHp) {
    const percentage = hp / maxHp;
    const newWidth = Math.max(0, 148 * percentage);

    // Ghost bar - only on decrease
    if (newWidth < this.hpBar.width) {
      // Stop any existing ghost tween
      if (this.hpGhostTween) this.hpGhostTween.stop();
      this.hpGhost.width = this.hpBar.width;
      this.hpGhostTween = this.tweens.add({
        targets: this.hpGhost,
        width: newWidth,
        duration: 500, delay: 200,
        ease: 'Quad.easeOut'
      });
    } else {
      // On heal, ghost immediately matches
      this.hpGhost.width = newWidth;
    }

    this.hpBar.width = newWidth;

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
        scaleX: 1.3, scaleY: 1.3,
        duration: 200, yoyo: true
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

  updateXpBar(xp, xpRequired) {
    if (!this.xpBar) return;
    const percentage = xpRequired > 0 ? xp / xpRequired : 0;
    this.xpBar.width = Math.max(0, 148 * percentage);
    this.xpText.setText(`XP: ${xp}/${xpRequired}`);
  }

  createQuestTracker() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.questTrackerBg = this.add.rectangle(width - 10, height - 40, 200, 60, 0x000000, 0.5)
      .setOrigin(1, 1).setStrokeStyle(1, 0x333355).setDepth(1);

    this.questTrackerTitle = this.add.text(width - 205, height - 95, '', {
      fontSize: '10px', fill: '#ffaa44', fontFamily: 'Courier New', fontStyle: 'bold'
    }).setDepth(2);

    this.questTrackerObj1 = this.add.text(width - 205, height - 80, '', {
      fontSize: '9px', fill: '#aaaaaa', fontFamily: 'Courier New'
    }).setDepth(2);

    this.questTrackerObj2 = this.add.text(width - 205, height - 65, '', {
      fontSize: '9px', fill: '#aaaaaa', fontFamily: 'Courier New'
    }).setDepth(2);
  }

  updateQuestTracker() {
    const questSystem = this.gameScene?.registry?.get('questSystem');
    if (!questSystem || !this.questTrackerTitle) return;

    const quest = questSystem.getTrackedQuest();
    if (!quest) {
      this.questTrackerTitle.setText('');
      this.questTrackerObj1.setText('');
      this.questTrackerObj2.setText('');
      this.questTrackerBg.setVisible(false);
      return;
    }

    this.questTrackerBg.setVisible(true);
    this.questTrackerTitle.setText(quest.title);

    const objs = quest.objectives.filter(o => o.current < o.required);
    this.questTrackerObj1.setText(objs[0] ? `○ ${objs[0].text} (${objs[0].current}/${objs[0].required})` : '');
    this.questTrackerObj2.setText(objs[1] ? `○ ${objs[1].text} (${objs[1].current}/${objs[1].required})` : '');
  }

  update() {}
}
