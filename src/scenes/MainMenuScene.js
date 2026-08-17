import Phaser from 'phaser';
import { CLASS_CONFIG, GENDER_OPTIONS } from '../data/classConfig.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import audioEngine from '../systems/AudioEngine.js';
import MusicEngine from '../systems/MusicEngine.js';
import { RESOURCE_LABELS, STAT_LABELS, THEME_CONFIG } from '../config/themeConfig.js';
import { UI_THEME } from '../config/uiTheme.js';
import { TEXTURES } from '../assets/AssetManager.js';

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

    this.buildInkLandscape();

    // Containers for two phases
    this.menuContainer = this.add.container(0, 0);
    this.selectContainer = this.add.container(0, 0).setVisible(false);

    this.buildMenuPhase();
    this.buildSelectPhase();

    // 菜单背景音乐（AudioContext 解锁后自动开始播放）
    this.menuMusic = new MusicEngine();
    this.menuMusic.play('menu');
    this.events.once('shutdown', () => {
      if (this.menuMusic) { this.menuMusic.destroy(); this.menuMusic = null; }
    });
  }

  buildInkLandscape() {
    const { colors } = UI_THEME;
    this.add.image(this.w / 2, this.h / 2, TEXTURES.MENU_BACKGROUND)
      .setDisplaySize(this.w, this.h);
    this.add.rectangle(this.w / 2, this.h / 2, this.w, this.h, colors.ink, 0.34);

    const landscape = this.add.graphics();
    landscape.lineStyle(1, colors.brassMuted, 0.55);
    landscape.strokeRect(28, 28, this.w - 56, this.h - 56);
    landscape.lineBetween(64, 52, 210, 52);
    landscape.lineBetween(this.w - 210, 52, this.w - 64, 52);
  }

  // ═══════════════════════════════════════════
  //  Phase 1: Main Menu
  // ═══════════════════════════════════════════

  buildMenuPhase() {
    const cx = this.w / 2;
    const cy = this.h / 2;
    const { colors, text, font } = UI_THEME;

    const title = this.add.text(cx, cy - 255, THEME_CONFIG.title, {
      fontSize: '76px', fill: text.paper,
      fontFamily: font.display, fontStyle: 'bold'
    }).setOrigin(0.5);
    this.menuContainer.add(title);

    const titleRule = this.add.graphics();
    titleRule.lineStyle(2, colors.brass, 0.85);
    titleRule.lineBetween(cx - 210, cy - 200, cx - 42, cy - 200);
    titleRule.lineBetween(cx + 42, cy - 200, cx + 210, cy - 200);
    titleRule.fillStyle(colors.cinnabar, 1);
    titleRule.fillRect(cx - 13, cy - 213, 26, 26);
    this.menuContainer.add(titleRule);

    const sub = this.add.text(cx, cy - 160, THEME_CONFIG.subtitle, {
      fontSize: '20px', fill: text.brass, fontFamily: font.body
    }).setOrigin(0.5);
    this.menuContainer.add(sub);

    let btnY = cy - 60;
    const btnGap = 68;

    // 加载存档（始终显示，进入 SaveSelectScene）
    this.addMenuButton(cx, btnY, '续接道途', text.jadeBright, () => this.openSaveSelect());
    btnY += btnGap;

    // New Game
    this.addMenuButton(cx, btnY, '初入云荒', text.brass, () => this.showSelectPhase());
    btnY += btnGap;

    // Exit
    this.addMenuButton(cx, btnY, '暂别山门', text.cinnabarBright, () => this.exitGame());

    const footer = this.add.text(cx, this.h - 48, '云荒纪 · v2.1', {
      fontSize: '14px', fill: text.muted, fontFamily: font.body
    }).setOrigin(0.5);
    this.menuContainer.add(footer);
  }

  addMenuButton(x, y, label, color, callback) {
    const { colors, font } = UI_THEME;
    const w = 300;
    const h = 50;

    const bg = this.add.rectangle(x, y, w, h, colors.panel, 0.96)
      .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(color).color)
      .setInteractive({ useHandCursor: true });

    const txt = this.add.text(x, y, label, {
      fontSize: '18px', fill: color, fontFamily: font.body
    }).setOrigin(0.5);

    bg.on('pointerover', () => {
      bg.setFillStyle(colors.panelHover, 1);
      audioEngine.playSfx('ui_hover');
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(colors.panel, 0.96);
    });
    bg.on('pointerdown', () => { audioEngine.playSfx('ui_click'); callback(); });

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
      fontSize: '14px', fill: UI_THEME.text.brass, fontFamily: UI_THEME.font.body
    }).setOrigin(0.5);
    this.menuContainer.add(msg);
    this.tweens.add({ targets: msg, alpha: 0, delay: 2000, duration: 500 });
  }

  // ═══════════════════════════════════════════
  //  Phase 2: Character Selection
  // ═══════════════════════════════════════════

  buildSelectPhase() {
    const cx = this.w / 2;
    const { colors, text, font } = UI_THEME;

    const title = this.add.text(cx, 92, '择一道而行', {
      fontSize: '38px', fill: text.paper,
      fontFamily: font.display, fontStyle: 'bold'
    }).setOrigin(0.5);
    this.selectContainer.add(title);

    const subtitle = this.add.text(cx, 138, '体魄 · 飞剑 · 五行', {
      fontSize: '16px', fill: text.brass, fontFamily: font.body
    }).setOrigin(0.5);
    this.selectContainer.add(subtitle);

    // Class cards
    this.selectedClass = 'warrior';
    this.selectedGender = 'male';
    this.classCards = {};

    const classes = Object.values(CLASS_CONFIG);
    const cardW = 280;
    const cardH = 390;
    const gap = 32;
    const totalW = classes.length * cardW + (classes.length - 1) * gap;
    const startX = cx - totalW / 2 + cardW / 2;
    const cardY = 450;

    classes.forEach((cls, i) => {
      const x = startX + i * (cardW + gap);
      this.classCards[cls.id] = this.buildClassCard(x, cardY, cls, cardW, cardH);
    });

    // Gender selection
    const genderY = cardY + cardH / 2 + 60;
    const genderLabel = this.add.text(cx - 116, genderY, '道身', {
      fontSize: '16px', fill: text.muted, fontFamily: font.body
    }).setOrigin(0, 0.5);
    this.selectContainer.add(genderLabel);

    this.genderBtns = {};
    const genderNames = { male: '男', female: '女' };
    GENDER_OPTIONS.forEach((g, i) => {
      const gx = cx + i * 82;
      const bg = this.add.rectangle(gx, genderY, 64, 34, colors.panel)
        .setStrokeStyle(1, colors.border)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(gx, genderY, genderNames[g], {
        fontSize: '15px', fill: text.muted, fontFamily: font.body
      }).setOrigin(0.5);

      bg.on('pointerdown', () => { audioEngine.playSfx('ui_click'); this.selectGender(g); });
      this.selectContainer.add([bg, txt]);
      this.genderBtns[g] = { bg, txt };
    });

    // Confirm button
    const confirmY = genderY + 70;
    const confirmBg = this.add.rectangle(cx, confirmY, 220, 48, colors.panel)
      .setStrokeStyle(2, colors.jade)
      .setInteractive({ useHandCursor: true });
    const confirmTxt = this.add.text(cx, confirmY, '踏入云荒', {
      fontSize: '18px', fill: text.jadeBright, fontFamily: font.body, fontStyle: 'bold'
    }).setOrigin(0.5);

    confirmBg.on('pointerover', () => { confirmBg.setFillStyle(colors.panelHover); audioEngine.playSfx('ui_hover'); });
    confirmBg.on('pointerout', () => confirmBg.setFillStyle(colors.panel));
    confirmBg.on('pointerdown', () => { audioEngine.playSfx('quest_accept'); this.confirmSelection(); });
    this.selectContainer.add([confirmBg, confirmTxt]);

    // Back button
    const backBg = this.add.rectangle(104, 82, 116, 36, colors.panel)
      .setStrokeStyle(1, colors.borderMuted)
      .setInteractive({ useHandCursor: true });
    const backTxt = this.add.text(104, 82, '← 返回', {
      fontSize: '14px', fill: text.muted, fontFamily: font.body
    }).setOrigin(0.5);
    backBg.on('pointerdown', () => { audioEngine.playSfx('ui_close'); this.showMenuPhase(); });
    this.selectContainer.add([backBg, backTxt]);

    // Apply initial highlights
    this.selectClass('warrior');
    this.selectGender('male');
  }

  buildClassCard(x, y, cls, w, h) {
    const { colors, text, font } = UI_THEME;
    const bg = this.add.rectangle(x, y, w, h, colors.panel, 0.97)
      .setStrokeStyle(1, colors.borderMuted)
      .setInteractive({ useHandCursor: true });

    const resourceColors = {
      rage: text.cinnabarBright,
      stamina: text.brass,
      mana: text.jadeBright,
    };

    // Class name
    const nameText = this.add.text(x, y - h / 2 + 34, cls.name, {
      fontSize: '24px', fill: text.paper,
      fontFamily: font.display, fontStyle: 'bold'
    }).setOrigin(0.5);

    // Resource tag
    const resText = this.add.text(x, y - h / 2 + 70, RESOURCE_LABELS[cls.resource], {
      fontSize: '14px', fill: resourceColors[cls.resource],
      fontFamily: font.body
    }).setOrigin(0.5);

    // Description
    const descText = this.add.text(x, y - h / 2 + 104, cls.description, {
      fontSize: '14px', fill: text.muted, fontFamily: font.body,
      wordWrap: { width: w - 36, useAdvancedWrap: true }, align: 'center',
      lineSpacing: 5
    }).setOrigin(0.5, 0);

    // Base stats
    const stats = cls.baseStats;
    let statY = y + 20;
    const statTexts = [];
    for (const [key, val] of Object.entries(stats)) {
      const barW = val * 10;
      const barColor = val >= 10 ? colors.jade : val >= 7 ? colors.brass : colors.border;

      const label = this.add.text(x - w / 2 + 26, statY, STAT_LABELS[key], {
        fontSize: '13px', fill: text.muted, fontFamily: font.body
      }).setOrigin(0, 0.5);

      const bar = this.add.rectangle(x - w / 2 + 76, statY, barW, 7, barColor)
        .setOrigin(0, 0.5);

      const valText = this.add.text(x - w / 2 + 82 + barW, statY, `${val}`, {
        fontSize: '12px', fill: text.paper, fontFamily: font.mono
      }).setOrigin(0, 0.5);

      statTexts.push(label, bar, valText);
      statY += 25;
    }

    const allElements = [bg, nameText, resText, descText, ...statTexts];
    this.selectContainer.add(allElements);

    bg.on('pointerdown', () => { audioEngine.playSfx('ui_click'); this.selectClass(cls.id); });

    return { bg, nameText, allElements };
  }

  selectClass(classId) {
    this.selectedClass = classId;
    // Update highlights
    for (const [id, card] of Object.entries(this.classCards)) {
      if (id === classId) {
        card.bg.setStrokeStyle(2, UI_THEME.colors.jade);
        card.bg.setFillStyle(UI_THEME.colors.panelRaised, 0.98);
      } else {
        card.bg.setStrokeStyle(1, UI_THEME.colors.borderMuted);
        card.bg.setFillStyle(UI_THEME.colors.panel, 0.97);
      }
    }
  }

  selectGender(gender) {
    this.selectedGender = gender;
    for (const [g, btn] of Object.entries(this.genderBtns)) {
      if (g === gender) {
        btn.bg.setStrokeStyle(2, UI_THEME.colors.jade);
        btn.bg.setFillStyle(UI_THEME.colors.panelRaised);
        btn.txt.setColor(UI_THEME.text.jadeBright);
      } else {
        btn.bg.setStrokeStyle(1, UI_THEME.colors.border);
        btn.bg.setFillStyle(UI_THEME.colors.panel);
        btn.txt.setColor(UI_THEME.text.muted);
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
