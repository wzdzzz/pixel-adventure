import Phaser from 'phaser';
import { CLASS_CONFIG, GENDER_OPTIONS } from '../data/classConfig.js';
import { SaveSystem } from '../systems/SaveSystem.js';

/**
 * 主菜单场景 — 标题画面 + 角色选择
 *
 * 两个阶段:
 *   'menu'   — 继续游戏 / 新建游戏 / 退出
 *   'select' — 职业选择 + 性别选择 + 确认
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create() {
    this.w = this.cameras.main.width;
    this.h = this.cameras.main.height;

    // Starfield background
    this.add.rectangle(this.w / 2, this.h / 2, this.w, this.h, 0x0e0e1a);
    this.stars = [];
    for (let i = 0; i < 60; i++) {
      const s = this.add.circle(
        Phaser.Math.Between(0, this.w),
        Phaser.Math.Between(0, this.h),
        Phaser.Math.Between(1, 2),
        0xffffff, Phaser.Math.FloatBetween(0.15, 0.6)
      );
      this.tweens.add({
        targets: s, alpha: 0.1,
        duration: Phaser.Math.Between(600, 2000),
        yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 1000)
      });
      this.stars.push(s);
    }

    // Containers for two phases
    this.menuContainer = this.add.container(0, 0);
    this.selectContainer = this.add.container(0, 0).setVisible(false);

    this.buildMenuPhase();
    this.buildSelectPhase();
  }

  // ═══════════════════════════════════════════
  //  Phase 1: Main Menu
  // ═══════════════════════════════════════════

  buildMenuPhase() {
    const cx = this.w / 2;
    const cy = this.h / 2;

    // Title
    const title = this.add.text(cx, cy - 140, '像素冒险', {
      fontSize: '48px', fill: '#00ff88',
      fontFamily: 'Courier New', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.menuContainer.add(title);

    this.tweens.add({
      targets: title,
      y: title.y - 6, duration: 1500,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    // Subtitle
    const sub = this.add.text(cx, cy - 90, 'Pixel Adventure', {
      fontSize: '14px', fill: '#556677', fontFamily: 'Courier New'
    }).setOrigin(0.5);
    this.menuContainer.add(sub);

    // --- Buttons ---
    let btnY = cy - 20;
    const btnGap = 52;

    // 加载存档（始终显示，进入 SaveSelectScene）
    this.addMenuButton(cx, btnY, '加载存档', '#44ff88', () => this.openSaveSelect());
    btnY += btnGap;

    // New Game
    this.addMenuButton(cx, btnY, '新建游戏', '#66aaff', () => this.showSelectPhase());
    btnY += btnGap;

    // Exit
    this.addMenuButton(cx, btnY, '退出游戏', '#aa6666', () => this.exitGame());

    // Version / footer
    const footer = this.add.text(cx, this.h - 20, 'v2.1  |  WASD移动  鼠标攻击  1-4技能', {
      fontSize: '10px', fill: '#333344', fontFamily: 'Courier New'
    }).setOrigin(0.5);
    this.menuContainer.add(footer);
  }

  addMenuButton(x, y, label, color, callback) {
    const w = 220;
    const h = 38;

    const bg = this.add.rectangle(x, y, w, h, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(color).color)
      .setInteractive({ useHandCursor: true });

    const txt = this.add.text(x, y, label, {
      fontSize: '16px', fill: color, fontFamily: 'Courier New'
    }).setOrigin(0.5);

    bg.on('pointerover', () => {
      bg.setFillStyle(0x2a2a3e, 1);
      txt.setScale(1.05);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x1a1a2e, 0.9);
      txt.setScale(1);
    });
    bg.on('pointerdown', callback);

    this.menuContainer.add([bg, txt]);
    return { bg, txt };
  }

  openSaveSelect() {
    // 打开存档选择场景；空槽位点击 → 回主菜单进入新游戏选择
    this.scene.launch('SaveSelectScene', {
      mode: 'load',
      returnTo: 'MainMenuScene',
      onEmpty: (slotId) => {
        // 用户选择空槽位 → 关闭选择场景，标记待新游戏写入此槽
        this.scene.stop('SaveSelectScene');
        this.registry.set('pendingNewGameSlot', slotId);
        this.showSelectPhase();
      }
    });
    this.scene.bringToTop('SaveSelectScene');
  }

  exitGame() {
    // Browser can't reliably close; show hint
    try { window.close(); } catch (_) { /* ignore */ }
    // If window.close didn't work (most browsers block it)
    // Show a message
    const msg = this.add.text(this.w / 2, this.h - 50, '请直接关闭浏览器标签页', {
      fontSize: '12px', fill: '#ffaa44', fontFamily: 'Courier New'
    }).setOrigin(0.5);
    this.menuContainer.add(msg);
    this.tweens.add({ targets: msg, alpha: 0, delay: 2000, duration: 500 });
  }

  // ═══════════════════════════════════════════
  //  Phase 2: Character Selection
  // ═══════════════════════════════════════════

  buildSelectPhase() {
    const cx = this.w / 2;

    // Title
    const title = this.add.text(cx, 30, '选择你的职业', {
      fontSize: '24px', fill: '#ffffff',
      fontFamily: 'Courier New', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.selectContainer.add(title);

    // Class cards
    this.selectedClass = 'warrior';
    this.selectedGender = 'male';
    this.classCards = {};

    const classes = Object.values(CLASS_CONFIG);
    const cardW = 200;
    const cardH = 260;
    const gap = 20;
    const totalW = classes.length * cardW + (classes.length - 1) * gap;
    const startX = cx - totalW / 2 + cardW / 2;
    const cardY = 190;

    classes.forEach((cls, i) => {
      const x = startX + i * (cardW + gap);
      this.classCards[cls.id] = this.buildClassCard(x, cardY, cls, cardW, cardH);
    });

    // Gender selection
    const genderY = cardY + cardH / 2 + 40;
    const genderLabel = this.add.text(cx - 80, genderY, '性别:', {
      fontSize: '14px', fill: '#aaaaaa', fontFamily: 'Courier New'
    }).setOrigin(0, 0.5);
    this.selectContainer.add(genderLabel);

    this.genderBtns = {};
    const genderNames = { male: '男', female: '女' };
    GENDER_OPTIONS.forEach((g, i) => {
      const gx = cx + i * 70;
      const bg = this.add.rectangle(gx, genderY, 54, 28, 0x1a1a2e)
        .setStrokeStyle(1, 0x555566)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(gx, genderY, genderNames[g], {
        fontSize: '13px', fill: '#aaaaaa', fontFamily: 'Courier New'
      }).setOrigin(0.5);

      bg.on('pointerdown', () => this.selectGender(g));
      this.selectContainer.add([bg, txt]);
      this.genderBtns[g] = { bg, txt };
    });

    // Confirm button
    const confirmY = genderY + 50;
    const confirmBg = this.add.rectangle(cx, confirmY, 180, 40, 0x1a2e1a)
      .setStrokeStyle(2, 0x44ff66)
      .setInteractive({ useHandCursor: true });
    const confirmTxt = this.add.text(cx, confirmY, '开始冒险', {
      fontSize: '18px', fill: '#44ff66', fontFamily: 'Courier New', fontStyle: 'bold'
    }).setOrigin(0.5);

    confirmBg.on('pointerover', () => confirmBg.setFillStyle(0x2a3e2a));
    confirmBg.on('pointerout', () => confirmBg.setFillStyle(0x1a2e1a));
    confirmBg.on('pointerdown', () => this.confirmSelection());
    this.selectContainer.add([confirmBg, confirmTxt]);

    // Back button
    const backBg = this.add.rectangle(70, 30, 80, 28, 0x1a1a2e)
      .setStrokeStyle(1, 0x666666)
      .setInteractive({ useHandCursor: true });
    const backTxt = this.add.text(70, 30, '← 返回', {
      fontSize: '12px', fill: '#888888', fontFamily: 'Courier New'
    }).setOrigin(0.5);
    backBg.on('pointerdown', () => this.showMenuPhase());
    this.selectContainer.add([backBg, backTxt]);

    // Apply initial highlights
    this.selectClass('warrior');
    this.selectGender('male');
  }

  buildClassCard(x, y, cls, w, h) {
    const isStub = false; // all classes now have skills

    // Card BG
    const bg = this.add.rectangle(x, y, w, h, 0x14141e, 0.95)
      .setStrokeStyle(1, 0x3a3a5a)
      .setInteractive({ useHandCursor: true });

    // Resource color
    const resourceColors = { rage: '#ff4444', stamina: '#ddcc00', mana: '#4488ff' };
    const resourceNames = { rage: '怒气', stamina: '体力', mana: '魔力' };

    // Class name
    const nameText = this.add.text(x, y - h / 2 + 24, cls.name, {
      fontSize: '20px', fill: '#ffffff',
      fontFamily: 'Courier New', fontStyle: 'bold'
    }).setOrigin(0.5);

    // Resource tag
    const resText = this.add.text(x, y - h / 2 + 48, resourceNames[cls.resource], {
      fontSize: '11px', fill: resourceColors[cls.resource],
      fontFamily: 'Courier New'
    }).setOrigin(0.5);

    // Description
    const descText = this.add.text(x, y - h / 2 + 74, cls.description, {
      fontSize: '10px', fill: '#888899', fontFamily: 'Courier New',
      wordWrap: { width: w - 24 }, align: 'center'
    }).setOrigin(0.5, 0);

    // Base stats
    const statNames = { con: '体质', str: '力量', int: '智力', agi: '敏捷', per: '感知', lck: '幸运' };
    const stats = cls.baseStats;
    let statY = y + 20;
    const statTexts = [];
    for (const [key, val] of Object.entries(stats)) {
      const barW = val * 8;
      const barColor = val >= 10 ? 0x44ff66 : val >= 7 ? 0xaacc44 : 0x666688;

      const label = this.add.text(x - w / 2 + 14, statY, statNames[key], {
        fontSize: '9px', fill: '#777788', fontFamily: 'Courier New'
      }).setOrigin(0, 0.5);

      const bar = this.add.rectangle(x - w / 2 + 52, statY, barW, 6, barColor)
        .setOrigin(0, 0.5);

      const valText = this.add.text(x - w / 2 + 56 + barW, statY, `${val}`, {
        fontSize: '8px', fill: '#999999', fontFamily: 'Courier New'
      }).setOrigin(0, 0.5);

      statTexts.push(label, bar, valText);
      statY += 16;
    }

    // "Coming soon" overlay for stub classes
    let overlay = null;
    let comingSoonText = null;
    if (isStub) {
      overlay = this.add.rectangle(x, y, w, h, 0x000000, 0.4);
      comingSoonText = this.add.text(x, y + h / 2 - 18, '技能开发中', {
        fontSize: '10px', fill: '#ffaa44', fontFamily: 'Courier New'
      }).setOrigin(0.5);
    }

    const allElements = [bg, nameText, resText, descText, ...statTexts];
    if (overlay) allElements.push(overlay, comingSoonText);
    this.selectContainer.add(allElements);

    bg.on('pointerdown', () => this.selectClass(cls.id));

    return { bg, nameText, allElements, isStub };
  }

  selectClass(classId) {
    this.selectedClass = classId;
    // Update highlights
    for (const [id, card] of Object.entries(this.classCards)) {
      if (id === classId) {
        card.bg.setStrokeStyle(2, 0x44ff66);
        card.bg.setFillStyle(0x1a2a1e, 0.95);
      } else {
        card.bg.setStrokeStyle(1, 0x3a3a5a);
        card.bg.setFillStyle(0x14141e, 0.95);
      }
    }
  }

  selectGender(gender) {
    this.selectedGender = gender;
    for (const [g, btn] of Object.entries(this.genderBtns)) {
      if (g === gender) {
        btn.bg.setStrokeStyle(2, 0x44ff66);
        btn.bg.setFillStyle(0x1a2e1a);
        btn.txt.setColor('#44ff66');
      } else {
        btn.bg.setStrokeStyle(1, 0x555566);
        btn.bg.setFillStyle(0x1a1a2e);
        btn.txt.setColor('#aaaaaa');
      }
    }
  }

  showSelectPhase() {
    this.menuContainer.setVisible(false);
    this.selectContainer.setVisible(true);
  }

  showMenuPhase() {
    this.selectContainer.setVisible(false);
    this.menuContainer.setVisible(true);
  }

  confirmSelection() {
    // 决定写入槽位：优先来自 SaveSelectScene 的 pendingNewGameSlot；否则槽 1
    const targetSlot = this.registry.get('pendingNewGameSlot') || 1;
    this.registry.remove('pendingNewGameSlot');

    // Delete old save in target slot for fresh start
    SaveSystem.deleteSave(targetSlot);
    SaveSystem.setActiveSlot(this, targetSlot);

    // Store choice in registry for LevelBuilder to read
    this.registry.set('classType', this.selectedClass);
    this.registry.set('gender', this.selectedGender);

    // Reset game state
    this.registry.set('gameState', {
      hp: 100, maxHp: 100, score: 0, inventory: [],
      keysCollected: 0, hasArtifact: false, currentLevel: 0,
      playerPosition: { x: 150, y: 150 }, collectedItems: []
    });
    this.registry.remove('savedPlayerData');
    this.registry.set('pendingLoadSlot', null);  // 新游戏，不加载

    this.startGame();
  }

  startGame() {
    this.scene.start('MainGameScene');
    this.scene.start('UIScene');
    this.scene.bringToTop('UIScene');
  }
}
