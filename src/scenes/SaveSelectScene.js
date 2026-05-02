import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import { CLASS_CONFIG } from '../data/classConfig.js';

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

    // 全屏遮罩
    this.add.rectangle(this.w / 2, this.h / 2, this.w, this.h, 0x000000, 0.85)
      .setScrollFactor(0).setInteractive();

    // 标题
    const title = this.mode === 'save' ? '保存到槽位' : '选择存档';
    this.add.text(this.w / 2, 60, title, {
      fontSize: '32px', color: '#ffdd66',
      fontFamily: 'Courier New', fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0);

    // 副标题（操作提示）
    const hint = this.mode === 'save'
      ? '点击槽位保存当前进度'
      : '点击有数据的槽位继续游戏，点击空槽位开始新游戏';
    this.add.text(this.w / 2, 100, hint, {
      fontSize: '12px', color: '#999999', fontFamily: 'Courier New'
    }).setOrigin(0.5).setScrollFactor(0);

    // 3 槽位卡片
    this.cards = [];
    const cardW = 240;
    const cardH = 320;
    const cardGap = 24;
    const totalW = 3 * cardW + 2 * cardGap;
    const startX = this.w / 2 - totalW / 2 + cardW / 2;
    const cardY = this.h / 2 - 20;

    const saves = SaveSystem.listAllSaves();
    const activeSlot = (this.scene.get('MainGameScene')?.registry?.get('activeSaveSlot')) || 1;
    for (let i = 0; i < SaveSystem.SLOT_COUNT; i++) {
      const slotId = i + 1;
      const x = startX + i * (cardW + cardGap);
      const isActive = slotId === activeSlot;
      this._buildCard(x, cardY, cardW, cardH, slotId, saves[i], isActive);
    }

    // 底部按钮
    const btnY = this.h - 50;
    this._addButton(this.w / 2, btnY, '返回', '#aaccff', () => this._close());

    // ESC 关闭
    this.input.keyboard.once('keydown-ESC', () => this._close());
  }

  _buildCard(x, y, w, h, slotId, info, isActive) {
    const isEmpty = !info;

    // 边框颜色：活跃槽=金色；空=灰；填充=蓝
    const borderColor = isActive ? 0xffdd44 : isEmpty ? 0x555566 : 0x6688aa;
    const bgColor = isEmpty ? 0x1a1a26 : 0x1f1f30;

    const bg = this.add.rectangle(x, y, w, h, bgColor, 0.96)
      .setStrokeStyle(2, borderColor).setInteractive({ useHandCursor: true });

    // 槽位标签
    const slotLabel = this.add.text(x, y - h / 2 + 18, `槽位 ${slotId}${isActive ? '  (当前)' : ''}`, {
      fontSize: '14px', color: isActive ? '#ffdd44' : '#bbbbcc',
      fontFamily: 'Courier New', fontStyle: 'bold'
    }).setOrigin(0.5);

    let detailObjs = [];

    if (isEmpty) {
      const emptyText = this.add.text(x, y - 10, '空 槽 位', {
        fontSize: '20px', color: '#666677', fontFamily: 'Courier New'
      }).setOrigin(0.5);
      const hint = this.add.text(x, y + 30, this.mode === 'save' ? '点击保存到此槽位' : '点击开始新游戏', {
        fontSize: '11px', color: '#888899', fontFamily: 'Courier New'
      }).setOrigin(0.5);
      detailObjs.push(emptyText, hint);
    } else {
      const cls = CLASS_CONFIG[info.classType] || CLASS_CONFIG.warrior;
      const genderIcon = info.gender === 'female' ? '♀' : '♂';
      const classIcon = info.classType === 'warrior' ? '⚔️' : info.classType === 'archer' ? '🏹' : '🔮';

      // 大图标
      const iconText = this.add.text(x, y - h / 2 + 70, classIcon, {
        fontSize: '54px', fontFamily: 'Courier New'
      }).setOrigin(0.5);
      detailObjs.push(iconText);

      // 职业 + 性别
      const classText = this.add.text(x, y - h / 2 + 130, `${cls.name}  ${genderIcon}`, {
        fontSize: '16px', color: '#ffffff',
        fontFamily: 'Courier New', fontStyle: 'bold'
      }).setOrigin(0.5);
      detailObjs.push(classText);

      // 等级
      const levelText = this.add.text(x, y - h / 2 + 158, `Lv. ${info.level}`, {
        fontSize: '14px', color: '#ffdd66', fontFamily: 'Courier New'
      }).setOrigin(0.5);
      detailObjs.push(levelText);

      // 关卡 + 分数
      const stageText = this.add.text(x, y - h / 2 + 184, info.levelName || `第 ${info.currentLevel + 1} 关`, {
        fontSize: '12px', color: '#aaccff', fontFamily: 'Courier New'
      }).setOrigin(0.5);
      detailObjs.push(stageText);

      const scoreText = this.add.text(x, y - h / 2 + 204, `分数: ${info.score}`, {
        fontSize: '11px', color: '#aaaaaa', fontFamily: 'Courier New'
      }).setOrigin(0.5);
      detailObjs.push(scoreText);

      // 时间
      const timeText = this.add.text(x, y - h / 2 + 234, info.dateText, {
        fontSize: '10px', color: '#888899', fontFamily: 'Courier New'
      }).setOrigin(0.5);
      detailObjs.push(timeText);

      // 删除按钮
      const delBtn = this.add.text(x, y + h / 2 - 38, '✕ 删除', {
        fontSize: '11px', color: '#ff8866', fontFamily: 'Courier New',
        backgroundColor: '#2a1a1a', padding: { x: 8, y: 4 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      delBtn.on('pointerover', () => delBtn.setColor('#ffaaaa'));
      delBtn.on('pointerout', () => delBtn.setColor('#ff8866'));
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
    const actionLabel = this.add.text(x, y + h / 2 - 18, `▶ ${actionText}`, {
      fontSize: '13px', color: isEmpty ? '#88ff88' : '#66aaff',
      fontFamily: 'Courier New', fontStyle: 'bold'
    }).setOrigin(0.5);
    detailObjs.push(actionLabel);

    bg.on('pointerover', () => {
      bg.setFillStyle(isEmpty ? 0x2a2a36 : 0x2f2f40);
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
        this._showToast(`已保存到槽 ${slotId}`);
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
    this._showToast(`加载槽 ${slotId}...`);

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
    // 简单 confirm 弹窗
    const dim = this.add.rectangle(this.w / 2, this.h / 2, this.w, this.h, 0x000000, 0.65)
      .setScrollFactor(0).setInteractive().setDepth(100);
    const panel = this.add.rectangle(this.w / 2, this.h / 2, 320, 160, 0x1a1a2e, 0.98)
      .setStrokeStyle(2, 0xff6666).setDepth(101);
    const title = this.add.text(this.w / 2, this.h / 2 - 40, `删除槽位 ${slotId}？`, {
      fontSize: '16px', color: '#ff8866', fontFamily: 'Courier New', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102);
    const hint = this.add.text(this.w / 2, this.h / 2 - 12, '此操作不可恢复', {
      fontSize: '11px', color: '#aaaaaa', fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(102);

    const closeAll = () => {
      dim.destroy(); panel.destroy(); title.destroy(); hint.destroy();
      cancelBg.destroy(); cancelTxt.destroy(); confirmBg.destroy(); confirmTxt.destroy();
    };

    const cancelBg = this.add.rectangle(this.w / 2 - 70, this.h / 2 + 30, 110, 32, 0x2a2a3a)
      .setStrokeStyle(1, 0x6666aa).setInteractive({ useHandCursor: true }).setDepth(102);
    const cancelTxt = this.add.text(this.w / 2 - 70, this.h / 2 + 30, '取消', {
      fontSize: '13px', color: '#ffffff', fontFamily: 'Courier New'
    }).setOrigin(0.5).setDepth(103);
    cancelBg.on('pointerdown', closeAll);

    const confirmBg = this.add.rectangle(this.w / 2 + 70, this.h / 2 + 30, 110, 32, 0x3a1a1a)
      .setStrokeStyle(1, 0xff6666).setInteractive({ useHandCursor: true }).setDepth(102);
    const confirmTxt = this.add.text(this.w / 2 + 70, this.h / 2 + 30, '删除', {
      fontSize: '13px', color: '#ff8866', fontFamily: 'Courier New', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(103);
    confirmBg.on('pointerdown', () => {
      SaveSystem.deleteSave(slotId);
      closeAll();
      this._showToast(`槽 ${slotId} 已删除`);
      this.scene.restart({ mode: this.mode, returnTo: this.returnTo, onEmpty: this.onEmpty });
    });
  }

  _showToast(text) {
    const t = this.add.text(this.w / 2, this.h - 90, text, {
      fontSize: '14px', color: '#ffdd66',
      fontFamily: 'Courier New', fontStyle: 'bold',
      backgroundColor: '#1a1a2e', padding: { x: 10, y: 6 }
    }).setOrigin(0.5).setDepth(200);
    this.tweens.add({
      targets: t, alpha: 0, y: t.y - 12,
      duration: 1500, delay: 600, onComplete: () => t.destroy()
    });
  }

  _addButton(x, y, label, color, callback) {
    const w = 120, h = 36;
    const bg = this.add.rectangle(x, y, w, h, 0x1a1a2e, 0.95)
      .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(color).color)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(x, y, label, {
      fontSize: '14px', color, fontFamily: 'Courier New'
    }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(0x2a2a3e));
    bg.on('pointerout', () => bg.setFillStyle(0x1a1a2e));
    bg.on('pointerdown', callback);
    return { bg, txt };
  }

  _close() {
    if (this.returnTo === 'MainGameScene') {
      // 从游戏内打开 → 关闭场景，恢复游戏
      const game = this.scene.get('MainGameScene');
      if (game && game.scene.isPaused()) {
        game.scene.resume();
      }
      this.scene.stop();
    } else if (this.returnTo === 'MainMenuScene') {
      this.scene.stop();
      // MainMenu 仍在运行，无需重启
    } else {
      this.scene.stop();
    }
  }
}
