import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import { CLASS_CONFIG } from '../data/classConfig.js';
import { UI_THEME } from '../config/uiTheme.js';

/**
 * 存档选择场景
 *
 * 通过 scene.launch('SaveSelectScene', { mode, returnTo, onLoad })
 * - mode 'load': 从主菜单选择存档加载（点空槽 → 触发 onEmpty）
 * - mode 'save': 游戏内 ESC 时保存到指定槽位
 * - returnTo: 关闭后切回的场景 key（默认 MainMenuScene）
 */
export class SaveSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SaveSelectScene' });
  }

  init(data) {
    this.mode = data.mode || 'load';
    this.returnTo = data.returnTo || null;
    this.onEmpty = data.onEmpty || null;
    this.onAfterLoad = data.onAfterLoad || null;
    this.onAfterSave = data.onAfterSave || null;
  }

  create() {
    this.w = this.cameras.main.width;
    this.h = this.cameras.main.height;
    const { colors, text, font } = UI_THEME;

    this.add.rectangle(this.w / 2, this.h / 2, this.w, this.h, colors.ink)
      .setScrollFactor(0).setInteractive();

    const landscape = this.add.graphics().setScrollFactor(0);
    landscape.fillStyle(colors.backdrop, 0.82);
    landscape.fillPoints([
      new Phaser.Geom.Point(0, this.h * 0.76),
      new Phaser.Geom.Point(this.w * 0.18, this.h * 0.58),
      new Phaser.Geom.Point(this.w * 0.33, this.h * 0.73),
      new Phaser.Geom.Point(this.w * 0.51, this.h * 0.53),
      new Phaser.Geom.Point(this.w * 0.68, this.h * 0.75),
      new Phaser.Geom.Point(this.w * 0.86, this.h * 0.6),
      new Phaser.Geom.Point(this.w, this.h * 0.72),
      new Phaser.Geom.Point(this.w, this.h),
      new Phaser.Geom.Point(0, this.h),
    ], true);
    landscape.lineStyle(1, colors.brassMuted, 0.65);
    landscape.strokeRect(36, 36, this.w - 72, this.h - 72);

    const title = this.mode === 'save' ? '收录行迹' : '选择存档';
    this.add.text(this.w / 2, 98, title, {
      fontSize: '42px', color: text.paper,
      fontFamily: font.display, fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0);

    // 副标题（操作提示）
    const hint = this.mode === 'save'
      ? '将此刻行迹收入一卷'
      : '择一卷宗，续接云荒道途';
    this.add.text(this.w / 2, 150, hint, {
      fontSize: '15px', color: text.muted, fontFamily: font.body,
      wordWrap: { width: Math.min(960, this.w - 120), useAdvancedWrap: true },
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0);

    // 3 槽位卡片
    this.cards = [];
    const cardW = 340;
    const cardH = 500;
    const cardGap = 32;
    const totalW = 3 * cardW + 2 * cardGap;
    const startX = this.w / 2 - totalW / 2 + cardW / 2;
    const cardY = this.h / 2 + 30;

    const saves = SaveSystem.listAllSaves();
    const activeSlot = (this.scene.get('MainGameScene')?.registry?.get('activeSaveSlot')) || 1;
    for (let i = 0; i < SaveSystem.SLOT_COUNT; i++) {
      const slotId = i + 1;
      const x = startX + i * (cardW + cardGap);
      const isActive = slotId === activeSlot;
      this._buildCard(x, cardY, cardW, cardH, slotId, saves[i], isActive);
    }

    // 底部按钮
    const btnY = this.h - 60;
    this._addButton(this.w / 2, btnY, '返回', text.jadeBright, () => this._close());

    // ESC 关闭
    this.input.keyboard.once('keydown-ESC', () => this._close());
  }

  _buildCard(x, y, w, h, slotId, info, isActive) {
    const isEmpty = !info;
    const { colors, text, font } = UI_THEME;

    const borderColor = isActive ? colors.brass : isEmpty ? colors.borderMuted : colors.jade;
    const bgColor = isEmpty ? colors.panel : colors.panelRaised;

    const bg = this.add.rectangle(x, y, w, h, bgColor, 0.96)
      .setStrokeStyle(2, borderColor).setInteractive({ useHandCursor: true });

    // 槽位标签
    const slotLabel = this.add.text(x, y - h / 2 + 30, `卷宗 ${slotId}${isActive ? '  · 当前' : ''}`, {
      fontSize: '17px', color: isActive ? text.brass : text.paper,
      fontFamily: font.body, fontStyle: 'bold'
    }).setOrigin(0.5);

    let detailObjs = [];

    if (isEmpty) {
      const emptyText = this.add.text(x, y - 12, '未有行迹', {
        fontSize: '22px', color: text.disabled, fontFamily: font.display
      }).setOrigin(0.5);
      const hint = this.add.text(x, y + 30, this.mode === 'save' ? '收录当前行迹' : '开启新篇', {
        fontSize: '14px', color: text.muted, fontFamily: font.body
      }).setOrigin(0.5);
      detailObjs.push(emptyText, hint);
    } else {
      const cls = CLASS_CONFIG[info.classType] || CLASS_CONFIG.warrior;
      const genderLabel = info.gender === 'female' ? '女' : '男';
      const classMark = info.classType === 'warrior' ? '体' : info.classType === 'archer' ? '剑' : '术';

      const seal = this.add.rectangle(x, y - h / 2 + 104, 76, 76, colors.cinnabar, 0.92)
        .setStrokeStyle(2, colors.cinnabarBright);
      const iconText = this.add.text(x, y - h / 2 + 104, classMark, {
        fontSize: '36px', color: text.paper, fontFamily: font.display, fontStyle: 'bold'
      }).setOrigin(0.5);
      detailObjs.push(seal, iconText);

      const classText = this.add.text(x, y - h / 2 + 166, `${cls.name}  ·  ${genderLabel}`, {
        fontSize: '18px', color: text.paper,
        fontFamily: font.body, fontStyle: 'bold'
      }).setOrigin(0.5);
      detailObjs.push(classText);

      // 等级
      const levelText = this.add.text(x, y - h / 2 + 204, `境界 ${info.level}`, {
        fontSize: '16px', color: text.brass, fontFamily: font.body
      }).setOrigin(0.5);
      detailObjs.push(levelText);

      // 关卡 + 分数
      const stageText = this.add.text(x, y - h / 2 + 242, info.levelName || '云荒游历', {
        fontSize: '15px', color: text.jadeBright, fontFamily: font.body,
        wordWrap: { width: w - 48, useAdvancedWrap: true }, align: 'center'
      }).setOrigin(0.5);
      detailObjs.push(stageText);

      const scoreText = this.add.text(x, y - h / 2 + 278, `历练 ${info.score}`, {
        fontSize: '14px', color: text.muted, fontFamily: font.body
      }).setOrigin(0.5);
      detailObjs.push(scoreText);

      // 时间
      const timeText = this.add.text(x, y - h / 2 + 318, info.dateText, {
        fontSize: '13px', color: text.muted, fontFamily: font.body
      }).setOrigin(0.5);
      detailObjs.push(timeText);

      // 删除按钮
      const delBtn = this.add.text(x, y + h / 2 - 68, '删除卷宗', {
        fontSize: '14px', color: text.cinnabarBright, fontFamily: font.body,
        backgroundColor: '#241714', padding: { x: 12, y: 6 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      delBtn.on('pointerover', () => delBtn.setColor(text.paper));
      delBtn.on('pointerout', () => delBtn.setColor(text.cinnabarBright));
      delBtn.on('pointerdown', (pointer, lx, ly, event) => {
        event.stopPropagation();
        this._confirmDelete(slotId);
      });
      detailObjs.push(delBtn);
    }

    // 底部按钮提示
    const actionText = isEmpty
      ? (this.mode === 'save' ? '保存' : '新游戏')
      : (this.mode === 'save' ? '覆盖保存' : '加载');
    const actionLabel = this.add.text(x, y + h / 2 - 26, actionText, {
      fontSize: '16px', color: isEmpty ? text.jadeBright : text.brass,
      fontFamily: font.body, fontStyle: 'bold'
    }).setOrigin(0.5);
    detailObjs.push(actionLabel);

    bg.on('pointerover', () => {
      bg.setFillStyle(colors.panelHover);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(bgColor);
    });
    bg.on('pointerdown', () => this._handleSlotClick(slotId, info));

    this.cards.push({ bg, slotLabel, detailObjs, slotId });
  }

  _handleSlotClick(slotId, info) {
    if (this.mode === 'save') {
      const game = this.scene.get('MainGameScene');
      if (!game) return;
      const ok = SaveSystem.save(game, slotId);
      if (ok) {
        this._showToast(`行迹已收入卷宗 ${slotId}`);
        if (this.onAfterSave) this.onAfterSave(slotId);
        this.scene.restart({ mode: this.mode, returnTo: this.returnTo, onAfterSave: this.onAfterSave });
      }
      return;
    }

    // mode === 'load'
    if (!info) {
      // 空槽位 → 触发 onEmpty（通常是回主菜单进入新游戏选择）
      if (this.onEmpty) {
        this.onEmpty(slotId);
      } else {
        this._close();
      }
      return;
    }

    // 选择此槽位作为活跃槽，启动游戏（让 MainGameScene 在 tryLoadSave 时读取）
    this._loadAndStart(slotId);
  }

  _loadAndStart(slotId) {
    this._showToast(`展开卷宗 ${slotId}...`);

    // 仅设置标记，让 MainGameScene.create 全权处理加载
    // （重要：不要在这里重置 gameState，否则会覆盖存档的 currentLevel）
    this.game.registry.set('pendingLoadSlot', slotId);
    this.game.registry.set('activeSaveSlot', slotId);

    this.time.delayedCall(150, () => {
      this.scene.stop();
      this.scene.stop('MainMenuScene');
      this.scene.start('MainGameScene');
      this.scene.start('UIScene');
      this.scene.bringToTop('UIScene');
    });
  }

  _confirmDelete(slotId) {
    const { colors, text, font } = UI_THEME;
    const dim = this.add.rectangle(this.w / 2, this.h / 2, this.w, this.h, colors.shadow, 0.72)
      .setScrollFactor(0).setInteractive().setDepth(100);
    const panel = this.add.rectangle(this.w / 2, this.h / 2, 420, 220, colors.panelRaised, 0.99)
      .setStrokeStyle(2, colors.cinnabar).setDepth(101);
    const title = this.add.text(this.w / 2, this.h / 2 - 58, `焚毁卷宗 ${slotId}？`, {
      fontSize: '20px', color: text.cinnabarBright, fontFamily: font.display, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102);
    const hint = this.add.text(this.w / 2, this.h / 2 - 20, '此行迹将无法恢复', {
      fontSize: '14px', color: text.muted, fontFamily: font.body
    }).setOrigin(0.5).setDepth(102);

    const closeAll = () => {
      dim.destroy(); panel.destroy(); title.destroy(); hint.destroy();
      cancelBg.destroy(); cancelTxt.destroy(); confirmBg.destroy(); confirmTxt.destroy();
    };

    const cancelBg = this.add.rectangle(this.w / 2 - 82, this.h / 2 + 48, 126, 38, colors.panel)
      .setStrokeStyle(1, colors.border).setInteractive({ useHandCursor: true }).setDepth(102);
    const cancelTxt = this.add.text(this.w / 2 - 82, this.h / 2 + 48, '保留', {
      fontSize: '15px', color: text.paper, fontFamily: font.body
    }).setOrigin(0.5).setDepth(103);
    cancelBg.on('pointerdown', closeAll);

    const confirmBg = this.add.rectangle(this.w / 2 + 82, this.h / 2 + 48, 126, 38, 0x321b17)
      .setStrokeStyle(1, colors.cinnabar).setInteractive({ useHandCursor: true }).setDepth(102);
    const confirmTxt = this.add.text(this.w / 2 + 82, this.h / 2 + 48, '焚毁', {
      fontSize: '15px', color: text.cinnabarBright, fontFamily: font.body, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(103);
    confirmBg.on('pointerdown', () => {
      SaveSystem.deleteSave(slotId);
      closeAll();
      this._showToast(`卷宗 ${slotId} 已焚毁`);
      this.scene.restart({ mode: this.mode, returnTo: this.returnTo, onEmpty: this.onEmpty });
    });
  }

  _showToast(text) {
    const { text: themeText, font } = UI_THEME;
    const t = this.add.text(this.w / 2, this.h - 90, text, {
      fontSize: '16px', color: themeText.brass,
      fontFamily: font.body, fontStyle: 'bold',
      backgroundColor: '#12201b', padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setDepth(200);
    this.tweens.add({
      targets: t, alpha: 0, y: t.y - 12,
      duration: 1500, delay: 600, onComplete: () => t.destroy()
    });
  }

  _addButton(x, y, label, color, callback) {
    const { colors, font } = UI_THEME;
    const w = 140, h = 40;
    const bg = this.add.rectangle(x, y, w, h, colors.panel, 0.98)
      .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(color).color)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(x, y, label, {
      fontSize: '16px', color, fontFamily: font.body
    }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(colors.panelHover));
    bg.on('pointerout', () => bg.setFillStyle(colors.panel));
    bg.on('pointerdown', callback);
    return { bg, txt };
  }

  _close() {
    if (this.returnTo === 'MainGameScene') {
      // 从游戏内打开 → 关闭场景，恢复游戏
      const game = this.scene.get('MainGameScene');
      this.scene.stop();
      game?.resumeGame?.('save-select');
    } else if (this.returnTo === 'MainMenuScene') {
      this.scene.stop();
      // MainMenu 仍在运行，无需重启
    } else {
      this.scene.stop();
    }
  }
}
