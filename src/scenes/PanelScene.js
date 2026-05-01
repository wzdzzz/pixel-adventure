import Phaser from 'phaser';
import { CharacterPanel } from '../ui/panels/CharacterPanel.js';
import { InventoryPanel } from '../ui/panels/InventoryPanel.js';
import { SkillTreePanel } from '../ui/panels/SkillTreePanel.js';
import { QuestLogPanel } from '../ui/panels/QuestLogPanel.js';

const TABS = ['character', 'inventory', 'skillTree', 'questLog'];
const TAB_LABELS = ['角色', '背包', '技能', '日志'];
const TAB_ICONS = ['👤', '🎒', '⚔', '📜'];

export const RARITY_COLORS = {
  common:    { bg: 0x3a3a3a, border: 0x666666 },
  uncommon:  { bg: 0x1a3a1a, border: 0x44bb44 },
  rare:      { bg: 0x1a1a3a, border: 0x4488ff },
  epic:      { bg: 0x2a1a3a, border: 0xbb44ff },
  legendary: { bg: 0x3a2a1a, border: 0xffaa00 }
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

    // Shared constants
    this.RARITY_COLORS = RARITY_COLORS;

    // Overlay background
    this.overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(0)
      .setInteractive();

    // Panel dimensions
    this.panelW = Math.min(w * 0.8, 900);
    this.panelH = Math.min(h * 0.8, 600);
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
      fontSize: '10px', fill: '#cccccc', fontFamily: 'Courier New', wordWrap: { width: 184 }
    });
    this.tooltipContainer.add([this.tooltipBg, this.tooltipText]);

    // Tab bar + content
    this.createTabBar();
    this.createCharacterTab();
    this.createInventoryTab();
    this.createSkillTreeTab();
    this.createQuestLogTab();
    this.switchTab('character');

    // Input
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.tabKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.escKey.on('down', () => this.closePanel());
    this.tabKey.on('down', (event) => {
      if (event.originalEvent) event.originalEvent.preventDefault();
      this.closePanel();
    });

    const numKeys = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
      Phaser.Input.Keyboard.KeyCodes.FOUR
    ];
    numKeys.forEach((keyCode, i) => {
      const key = this.input.keyboard.addKey(keyCode);
      key.on('down', () => this.switchTab(TABS[i]));
    });

    // Resize
    this.scale.on('resize', this.handleResize, this);
    this.events.on('shutdown', () => {
      this.scale.off('resize', this.handleResize, this);
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
        fontSize: '14px', fill: '#aaaacc', fontFamily: 'Courier New'
      }).setOrigin(0.5).setDepth(3);

      const hint = this.add.text(tabX + tabW / 2 - 14, tabY - tabH / 2 + 4, `${i + 1}`, {
        fontSize: '9px', fill: '#666688', fontFamily: 'Courier New'
      }).setOrigin(0.5, 0).setDepth(3);

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => {
        if (this.activeTab !== tab) bg.setFillStyle(0x3a3a5e);
      });
      bg.on('pointerout', () => {
        if (this.activeTab !== tab) bg.setFillStyle(0x2a2a4e);
      });
      bg.on('pointerdown', () => this.switchTab(tab));

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
  }

  hideTooltip() {
    if (this.tooltipContainer) this.tooltipContainer.setVisible(false);
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

  closePanel() {
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

  handleResize(gameSize) {
    const w = gameSize.width;
    const h = gameSize.height;
    this.overlay.setPosition(w / 2, h / 2);
    this.overlay.setSize(w, h);
  }
}

// Mix in tab panel methods
Object.assign(PanelScene.prototype, CharacterPanel);
Object.assign(PanelScene.prototype, InventoryPanel);
Object.assign(PanelScene.prototype, SkillTreePanel);
Object.assign(PanelScene.prototype, QuestLogPanel);
