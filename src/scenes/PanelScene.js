import Phaser from 'phaser';

const TABS = ['character', 'inventory', 'skillTree', 'questLog'];
const TAB_LABELS = ['角色', '背包', '技能', '日志'];
const TAB_ICONS = ['👤', '🎒', '⚔', '📜']; // text placeholders for now

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

    // Overlay background (darkened)
    this.overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(0)
      .setInteractive(); // Block clicks to game below

    // Panel dimensions - 80% of screen, capped
    this.panelW = Math.min(w * 0.8, 900);
    this.panelH = Math.min(h * 0.8, 600);
    this.panelX = w / 2;
    this.panelY = h / 2;
    this.panelLeft = this.panelX - this.panelW / 2;
    this.panelTop = this.panelY - this.panelH / 2;

    // Panel background
    this.panelBg = this.add.rectangle(this.panelX, this.panelY, this.panelW, this.panelH, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0x4a4a6a).setDepth(1);

    // Tab bar at top of panel
    this.createTabBar();

    // Create tab content containers (initially hidden)
    TABS.forEach(tab => {
      this.tabContainers[tab] = this.createTabContainer(tab);
    });

    // Show default tab
    this.switchTab('character');

    // Input: ESC to close, TAB to close
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.tabKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);

    this.escKey.on('down', () => this.closePanel());
    this.tabKey.on('down', (event) => {
      if (event.originalEvent) event.originalEvent.preventDefault();
      this.closePanel();
    });

    // Number keys to switch tabs
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

    // Resize handler
    this.scale.on('resize', this.handleResize, this);
    this.events.on('shutdown', () => {
      this.scale.off('resize', this.handleResize, this);
    });

    // Open animation
    this.playOpenAnimation();
  }

  createTabBar() {
    this.tabButtons = [];
    const tabW = this.panelW / TABS.length;
    const tabH = 40;
    const tabY = this.panelTop + tabH / 2;

    TABS.forEach((tab, i) => {
      const tabX = this.panelLeft + tabW * i + tabW / 2;

      // Tab background
      const bg = this.add.rectangle(tabX, tabY, tabW - 4, tabH - 4, 0x2a2a4e, 1)
        .setStrokeStyle(1, 0x5a5a8a).setDepth(2);

      // Tab label
      const label = this.add.text(tabX, tabY, `${TAB_ICONS[i]} ${TAB_LABELS[i]}`, {
        fontSize: '14px', fill: '#aaaacc', fontFamily: 'Courier New'
      }).setOrigin(0.5).setDepth(3);

      // Keyboard hint
      const hint = this.add.text(tabX + tabW / 2 - 14, tabY - tabH / 2 + 4, `${i + 1}`, {
        fontSize: '9px', fill: '#666688', fontFamily: 'Courier New'
      }).setOrigin(0.5, 0).setDepth(3);

      // Make clickable
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

    // Update tab button visuals
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

    // Show/hide containers
    TABS.forEach(tab => {
      if (this.tabContainers[tab]) {
        this.tabContainers[tab].setVisible(tab === tabName);
      }
    });
  }

  createTabContainer(tabName) {
    const contentTop = this.panelTop + 50; // below tab bar
    const contentW = this.panelW - 20;
    const contentH = this.panelH - 60;
    const contentX = this.panelX;
    const contentY = contentTop + contentH / 2;

    const container = this.add.container(0, 0).setDepth(5);

    // Content background
    const contentBg = this.add.rectangle(contentX, contentY, contentW, contentH, 0x12121e, 0.8)
      .setStrokeStyle(1, 0x3a3a5a);
    container.add(contentBg);

    // Placeholder text
    const tabIndex = TABS.indexOf(tabName);
    const placeholderText = this.add.text(contentX, contentY,
      `${TAB_LABELS[tabIndex]} — 开发中...`, {
        fontSize: '18px', fill: '#555577', fontFamily: 'Courier New'
      }
    ).setOrigin(0.5);
    container.add(placeholderText);

    container.setVisible(false);
    return container;
  }

  playOpenAnimation() {
    // Set initial state
    this.panelBg.setScale(0.8, 0.8);
    this.panelBg.setAlpha(0);
    this.overlay.setAlpha(0);

    // Animate overlay
    this.tweens.add({
      targets: this.overlay,
      alpha: 0.6,
      duration: 200
    });

    // Animate panel
    this.tweens.add({
      targets: this.panelBg,
      scaleX: 1, scaleY: 1, alpha: 1,
      duration: 200, ease: 'Back.easeOut'
    });
  }

  closePanel() {
    // Close animation
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
    // For now, just reposition overlay on resize
    const w = gameSize.width;
    const h = gameSize.height;

    this.overlay.setPosition(w / 2, h / 2);
    this.overlay.setSize(w, h);
  }
}
