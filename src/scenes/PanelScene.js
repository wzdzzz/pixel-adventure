import Phaser from 'phaser';
import { CharacterPanel } from '../ui/panels/CharacterPanel.js';
import { InventoryPanel } from '../ui/panels/InventoryPanel.js';
import { SkillTreePanel } from '../ui/panels/SkillTreePanel.js';
import { QuestLogPanel } from '../ui/panels/QuestLogPanel.js';
import { SmithyPanel } from '../ui/panels/SmithyPanel.js';
import { Tooltip } from '../ui/Tooltip.js';
import audioEngine from '../systems/AudioEngine.js';

/** 将值钳制到 [0,1] */
function clamp01(v) { v = Number(v); if (!isFinite(v)) return 0; return Math.max(0, Math.min(1, v)); }

const TABS = ['character', 'inventory', 'skillTree', 'questLog', 'settings'];
const TAB_LABELS = ['角色', '背包', '技能', '日志', '设置'];
const TAB_ICONS = ['👤', '🎒', '⚔', '📜', '⚙'];
const TAB_KEYS = ['C', 'B', 'X', 'L', ''];

export const RARITY_COLORS = {
  common:    { bg: 0x3a3a3a, border: 0x666666 },
  uncommon:  { bg: 0x1a3a1a, border: 0x44bb44 },
  rare:      { bg: 0x1a1a3a, border: 0x4488ff },
  epic:      { bg: 0x2a1a3a, border: 0xbb44ff },
  legendary: { bg: 0x3a2a1a, border: 0xffaa00 },
  mythic:    { bg: 0x3a1a1a, border: 0xff4444 }
};

export class PanelScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PanelScene' });
    this.activeTab = 'character';
    this.tabContainers = {};
    this.tabButtons = [];
  }

  create() {
    this.gameScene = this.scene.get('MainGameScene');
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    this._uiW = w;
    this._uiH = h;

    // Shared constants
    this.RARITY_COLORS = RARITY_COLORS;

    // 禁用浏览器右键菜单
    this.game.canvas.oncontextmenu = (e) => { e.preventDefault(); return false; };

    // Overlay background（depth -1 确保不拦截面板内的 input）
    this.overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(-1)
      .setInteractive();

    // Panel dimensions — 加大面板
    this.panelW = Math.min(w * 0.85, 1050);
    this.panelH = Math.min(h * 0.9, 860);
    this.panelX = w / 2;
    this.panelY = h / 2;
    this.panelLeft = this.panelX - this.panelW / 2;
    this.panelTop = this.panelY - this.panelH / 2;

    // Panel background
    this.panelBg = this.add.rectangle(this.panelX, this.panelY, this.panelW, this.panelH, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0x4a4a6a).setDepth(1);

    // Shared tooltip (used by character + inventory panels)
    this.tooltipContainer = this.add.container(0, 0).setDepth(20).setVisible(false);
    this.tooltipBg = this.add.rectangle(0, 0, 200, 80, 0x1a1a2e, 0.95)
      .setStrokeStyle(1, 0x6666aa).setOrigin(0, 0);
    this.tooltipText = this.add.text(8, 8, '', {
      fontSize: '13px', fill: '#cccccc', fontFamily: 'Courier New', wordWrap: { width: 184 }
    });
    this.tooltipContainer.add([this.tooltipBg, this.tooltipText]);

    // 第二个 tooltip（并排对比用）
    this.tooltipContainer2 = this.add.container(0, 0).setDepth(20).setVisible(false);
    this.tooltipBg2 = this.add.rectangle(0, 0, 200, 80, 0x1a1a2e, 0.95)
      .setStrokeStyle(1, 0x6666aa).setOrigin(0, 0);
    this.tooltipText2 = this.add.text(8, 8, '', {
      fontSize: '13px', fill: '#cccccc', fontFamily: 'Courier New', wordWrap: { width: 184 }
    });
    this.tooltipContainer2.add([this.tooltipBg2, this.tooltipText2]);

    // 通用 hover tooltip（技能卡用）
    this.hoverTooltip = new Tooltip(this, { delay: 500 });

    // Tab bar + content
    this.createTabBar();
    this.createCharacterTab();
    this.createInventoryTab();
    this.createSkillTreeTab();
    this.createQuestLogTab();
    this.createSettingsTab();

    // 读取默认标签页（由快捷键设置）
    const defaultTab = this.gameScene?.registry?.get('panelDefaultTab') || 'character';
    this.switchTab(defaultTab);
    audioEngine.playSfx('ui_open');
    if (this.gameScene?.registry) this.gameScene.registry.set('panelDefaultTab', null);

    // Input — ESC / TAB 关闭面板
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.tabKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.escKey.on('down', () => this.closePanel());
    this.tabKey.on('down', (event) => {
      if (event.originalEvent) event.originalEvent.preventDefault();
      this.closePanel();
    });

    // C/B/X/L 在面板内：同标签关闭，不同标签切换
    const panelHotkeys = { C: 'character', B: 'inventory', X: 'skillTree', L: 'questLog' };
    Object.entries(panelHotkeys).forEach(([keyChar, tabName]) => {
      const key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[keyChar]);
      key.on('down', () => {
        if (this.activeTab === tabName) {
          this.closePanel();
        } else {
          this.switchTab(tabName);
        }
      });
    });

    // 监听 showMessage（来自 EquipmentSystem 等）→ 在 PanelScene 自己的层级显示 toast
    this._onShowMessage = (text, color) => this._showPanelToast(text, color);
    if (this.gameScene) this.gameScene.events.on('showMessage', this._onShowMessage);

    // Resize
    this.scale.on('resize', this.handleResize, this);
    this.events.on('shutdown', () => {
      this.scale.off('resize', this.handleResize, this);
      if (this.gameScene && this._onShowMessage) {
        this.gameScene.events.off('showMessage', this._onShowMessage);
      }
      // 解绑技能面板的滚轮监听
      if (this._skillWheelHandler) {
        this.input.off('wheel', this._skillWheelHandler);
        this._skillWheelHandler = null;
      }
      // 关闭打开中的强化/分解 modal（避免引用残留）
      this._closeSmithyModal?.();
    });

    // 统一面板间刷新事件
    this.events.on('panel:refresh', (tabName) => {
      if (tabName === 'character') this.refreshCharacterTab();
      else if (tabName === 'inventory') this.refreshInventoryTab();
      else if (tabName === 'skillTree') this.refreshSkillTreeTab();
      else if (tabName === 'questLog') this.refreshQuestLogTab();
    });

    this.playOpenAnimation();
    this.refreshCharacterTab();
    this.refreshInventoryTab();
  }

  createTabBar() {
    this.tabButtons = [];
    const tabW = this.panelW / TABS.length;
    const tabH = 40;
    const tabY = this.panelTop + tabH / 2;

    TABS.forEach((tab, i) => {
      const tabX = this.panelLeft + tabW * i + tabW / 2;

      const bg = this.add.rectangle(tabX, tabY, tabW - 4, tabH - 4, 0x2a2a4e, 1)
        .setStrokeStyle(1, 0x5a5a8a).setDepth(2);

      const label = this.add.text(tabX, tabY, `${TAB_ICONS[i]} ${TAB_LABELS[i]}`, {
        fontSize: '16px', fill: '#aaaacc', fontFamily: 'Courier New'
      }).setOrigin(0.5).setDepth(3);

      const hintChar = TAB_KEYS[i] || '';
      const hint = this.add.text(tabX + tabW / 2 - 14, tabY - tabH / 2 + 4, hintChar, {
        fontSize: '12px', fill: '#666688', fontFamily: 'Courier New'
      }).setOrigin(0.5, 0).setDepth(3);

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => {
        if (this.activeTab !== tab) bg.setFillStyle(0x3a3a5e);
      });
      bg.on('pointerout', () => {
        if (this.activeTab !== tab) bg.setFillStyle(0x2a2a4e);
      });
      bg.on('pointerdown', () => { audioEngine.playSfx('ui_click'); this.switchTab(tab); });

      this.tabButtons.push({ bg, label, hint, tab });
    });
  }

  switchTab(tabName) {
    this.activeTab = tabName;

    this.tabButtons.forEach(({ bg, label, tab }) => {
      if (tab === tabName) {
        bg.setFillStyle(0x3a3a6e);
        bg.setStrokeStyle(2, 0x8888cc);
        label.setColor('#ffffff');
      } else {
        bg.setFillStyle(0x2a2a4e);
        bg.setStrokeStyle(1, 0x5a5a8a);
        label.setColor('#aaaacc');
      }
    });

    TABS.forEach(tab => {
      if (this.tabContainers[tab]) {
        this.tabContainers[tab].setVisible(tab === tabName);
      }
    });

    if (tabName === 'character') this.refreshCharacterTab();
    if (tabName === 'inventory') this.refreshInventoryTab();
    if (tabName === 'skillTree') this.refreshSkillTreeTab();
    if (tabName === 'questLog') this.refreshQuestLogTab();
    if (tabName === 'settings') this.refreshSettingsTab?.();
  }

  hideTooltip() {
    if (this.tooltipContainer) this.tooltipContainer.setVisible(false);
    if (this.tooltipContainer2) this.tooltipContainer2.setVisible(false);
  }

  playOpenAnimation() {
    this.panelBg.setScale(0.8, 0.8);
    this.panelBg.setAlpha(0);
    this.overlay.setAlpha(0);

    this.tweens.add({
      targets: this.overlay,
      alpha: 0.6,
      duration: 200
    });

    this.tweens.add({
      targets: this.panelBg,
      scaleX: 1, scaleY: 1, alpha: 1,
      duration: 200, ease: 'Back.easeOut'
    });
  }

  _showPanelToast(text, color) {
    const w = this._uiW || this.cameras.main.width;
    const msg = this.add.text(w / 2, 60, text, {
      fontSize: '16px', color: color || '#ffaa44', fontFamily: 'Courier New',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#1a1a2e', padding: { x: 10, y: 6 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(9999);

    this.tweens.add({
      targets: msg, alpha: 0, y: msg.y - 20,
      duration: 1200, delay: 700,
      onComplete: () => msg.destroy()
    });
  }

  closePanel() {
    audioEngine.playSfx('ui_close');
    this.tweens.add({
      targets: this.overlay,
      alpha: 0,
      duration: 150
    });

    this.tweens.add({
      targets: this.panelBg,
      scaleX: 0.8, scaleY: 0.8, alpha: 0,
      duration: 150, ease: 'Back.easeIn',
      onComplete: () => {
        this.scene.stop('PanelScene');
        if (this.gameScene && this.gameScene.resumeGame) {
          this.gameScene.resumeGame();
        }
      }
    });
  }

  createSettingsTab() {
    const container = this.add.container(0, 0).setDepth(5).setVisible(false);
    this.tabContainers.settings = container;

    const contentTop = this.panelTop + 50;
    const leftX = this.panelLeft + 40;
    const topY = contentTop + 20;

    const contentBg = this.add.rectangle(
      this.panelX, contentTop + (this.panelH - 60) / 2,
      this.panelW - 20, this.panelH - 60, 0x12121e, 0.8
    ).setStrokeStyle(1, 0x3a3a5a);
    container.add(contentBg);

    const title = this.add.text(leftX, topY, '⚙ 操作说明', {
      fontSize: '16px', fill: '#ffd700', fontFamily: 'Courier New', fontStyle: 'bold'
    });
    container.add(title);

    const bindings = [
      ['移动', 'WASD / 方向键'],
      ['普通攻击', '鼠标左键'],
      ['技能 1-4', '数字键 1 / 2 / 3 / 4'],
      ['物品快捷栏', 'F1 / F2 / F3 / F4'],
      ['交互', 'E'],
      ['角色面板', 'C（再按关闭）'],
      ['背包面板', 'B（再按关闭）'],
      ['技能面板', 'X（再按关闭）'],
      ['日志面板', 'L（再按关闭）'],
      ['面板总开关', 'TAB'],
      ['关闭面板/菜单', 'ESC'],
      ['全屏切换', 'F'],
      ['右键菜单', '鼠标右键（背包/装备操作）'],
    ];

    bindings.forEach((pair, i) => {
      const y = topY + 40 + i * 28;
      const action = this.add.text(leftX + 10, y, pair[0], {
        fontSize: '15px', fill: '#ccccdd', fontFamily: 'Courier New'
      });
      const key = this.add.text(leftX + 220, y, pair[1], {
        fontSize: '15px', fill: '#88ccff', fontFamily: 'Courier New'
      });
      container.add([action, key]);
    });

    const note = this.add.text(leftX + 10, topY + 40 + bindings.length * 28 + 20,
      '（快捷键暂不支持自定义）', {
        fontSize: '14px', fill: '#666688', fontFamily: 'Courier New'
      });
    container.add(note);

    // ── 右栏：音频设置（音量滑条 + 静音） ──
    const audioX = this.panelX + 30;
    const audioTitle = this.add.text(audioX, topY, '🔊 音频设置', {
      fontSize: '16px', fill: '#ffd700', fontFamily: 'Courier New', fontStyle: 'bold'
    });
    container.add(audioTitle);

    this._volSliders = [];
    const sx = audioX + 20;
    this._volSliders.push(this._createVolumeSlider(container, sx, topY + 56, '主音量',
      () => audioEngine.getMasterVolume(), (v) => audioEngine.setMasterVolume(v)));
    this._volSliders.push(this._createVolumeSlider(container, sx, topY + 116, '音乐',
      () => audioEngine.getMusicVolume(), (v) => audioEngine.setMusicVolume(v)));
    this._volSliders.push(this._createVolumeSlider(container, sx, topY + 176, '音效',
      () => audioEngine.getSfxVolume(), (v) => audioEngine.setSfxVolume(v)));

    this._muteRefresh = this._createMuteToggle(container, sx, topY + 230);

    const audioNote = this.add.text(audioX, topY + 270,
      '设置自动保存（独立于存档）', {
        fontSize: '13px', fill: '#666688', fontFamily: 'Courier New'
      });
    container.add(audioNote);

    // 拖动滑条：场景级 pointermove / pointerup 处理
    this._sliderDragging = null;
    this.input.on('pointermove', (p) => {
      if (this._sliderDragging && p.isDown) this._sliderDragging(p.x);
    });
    this.input.on('pointerup', () => { this._sliderDragging = null; });
  }

  /**
   * 创建一个音量滑条行。
   * @returns {{refresh:Function}} 提供 refresh() 以同步外部值
   */
  _createVolumeSlider(container, x, y, label, getVal, setVal) {
    const W = 220, H = 8;
    const v0 = clamp01(getVal());

    const lbl = this.add.text(x, y - 18, label, {
      fontSize: '14px', fill: '#ccccdd', fontFamily: 'Courier New'
    });
    const track = this.add.rectangle(x, y, W, H, 0x2a2a44)
      .setOrigin(0, 0.5).setStrokeStyle(1, 0x555577);
    const fill = this.add.rectangle(x, y, W * v0, H, 0x44aaff).setOrigin(0, 0.5);
    const handle = this.add.circle(x + W * v0, y, 9, 0x88ccff).setStrokeStyle(2, 0xffffff);
    const valTxt = this.add.text(x + W + 16, y, Math.round(v0 * 100) + '%', {
      fontSize: '13px', fill: '#88ccff', fontFamily: 'Courier New'
    }).setOrigin(0, 0.5);

    const apply = (px) => {
      const v = clamp01((px - x) / W);
      setVal(v);
      fill.width = W * v;
      handle.x = x + W * v;
      valTxt.setText(Math.round(v * 100) + '%');
    };

    // 透明命中区（比滑条略大），按下即开始拖动
    const hit = this.add.rectangle(x + W / 2, y, W + 24, 30, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (p) => {
      this._sliderDragging = apply;
      apply(p.x);
      audioEngine.playSfx('ui_click');
    });

    container.add([lbl, track, fill, handle, valTxt, hit]);

    return {
      refresh: () => {
        const v = clamp01(getVal());
        fill.width = W * v;
        handle.x = x + W * v;
        valTxt.setText(Math.round(v * 100) + '%');
      }
    };
  }

  /** 创建静音勾选框。 */
  _createMuteToggle(container, x, y) {
    const box = this.add.rectangle(x, y, 20, 20, audioEngine.muted ? 0x44aaff : 0x222244)
      .setStrokeStyle(2, 0x6666aa).setInteractive({ useHandCursor: true });
    const check = this.add.text(x, y, audioEngine.muted ? '✓' : '', {
      fontSize: '15px', fill: '#ffffff', fontFamily: 'Courier New'
    }).setOrigin(0.5);
    const lbl = this.add.text(x + 16, y, '静音', {
      fontSize: '14px', fill: '#ccccdd', fontFamily: 'Courier New'
    }).setOrigin(0, 0.5);

    box.on('pointerdown', () => {
      const m = audioEngine.toggleMuted();
      box.setFillStyle(m ? 0x44aaff : 0x222244);
      check.setText(m ? '✓' : '');
      audioEngine.playSfx('ui_click');
    });

    container.add([box, check, lbl]);
    return {
      refresh: () => {
        box.setFillStyle(audioEngine.muted ? 0x44aaff : 0x222244);
        check.setText(audioEngine.muted ? '✓' : '');
      }
    };
  }

  refreshSettingsTab() {
    // 同步音量滑条 / 静音状态（值可能在别处变更）
    if (this._volSliders) this._volSliders.forEach((s) => s.refresh && s.refresh());
    if (this._muteRefresh && this._muteRefresh.refresh) this._muteRefresh.refresh();
  }

  handleResize(gameSize) {
    const w = gameSize.width;
    const h = gameSize.height;
    this._uiW = w;
    this._uiH = h;
    this.overlay.setPosition(w / 2, h / 2);
    this.overlay.setSize(w, h);
  }
}

// Mix in tab panel methods
Object.assign(PanelScene.prototype, CharacterPanel);
Object.assign(PanelScene.prototype, InventoryPanel);
Object.assign(PanelScene.prototype, SkillTreePanel);
Object.assign(PanelScene.prototype, QuestLogPanel);
Object.assign(PanelScene.prototype, SmithyPanel);
