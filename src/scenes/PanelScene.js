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

    // Create tab content - character tab has special implementation
    this.createCharacterTab();
    // Other tabs use placeholder
    ['inventory', 'skillTree', 'questLog'].forEach(tab => {
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

    // Refresh tab content when switching
    if (tabName === 'character') this.refreshCharacterTab();
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

  createCharacterTab() {
    const container = this.add.container(0, 0).setDepth(5).setVisible(false);
    this.tabContainers.character = container;

    const contentTop = this.panelTop + 50;
    const leftX = this.panelLeft + this.panelW * 0.22;
    const rightX = this.panelX + this.panelW * 0.02;
    const topY = contentTop + 20;

    // Content background
    const contentBg = this.add.rectangle(
      this.panelX, contentTop + (this.panelH - 60) / 2,
      this.panelW - 20, this.panelH - 60, 0x12121e, 0.8
    ).setStrokeStyle(1, 0x3a3a5a);
    container.add(contentBg);

    // --- LEFT: Paper Doll ---
    // Section title
    const leftTitle = this.add.text(leftX, topY, '-- 角色预览 --', {
      fontSize: '12px', fill: '#8888aa', fontFamily: 'Courier New'
    }).setOrigin(0.5);
    container.add(leftTitle);

    // Character preview (idle animation)
    const previewY = topY + 130;
    const preview = this.add.sprite(leftX, previewY, 'hero_00');
    preview.setDisplaySize(72, 104);
    if (this.anims.exists('hero_idle')) preview.play('hero_idle');
    container.add(preview);

    // 8 equipment slots (gray boxes with labels)
    const slotDefs = [
      { x: 0, y: -100, label: '武器' },
      { x: 0, y: -60, label: '头盔' },
      { x: -55, y: -30, label: '项链' },
      { x: 55, y: -30, label: '戒指' },
      { x: -55, y: 30, label: '副手' },
      { x: 55, y: 30, label: '戒指' },
      { x: 0, y: 60, label: '护甲' },
      { x: 0, y: 100, label: '靴子' }
    ];
    slotDefs.forEach(pos => {
      const slot = this.add.rectangle(leftX + pos.x, previewY + pos.y, 34, 34, 0x2a2a3a, 0.7)
        .setStrokeStyle(1, 0x555555);
      const label = this.add.text(leftX + pos.x, previewY + pos.y + 20, pos.label, {
        fontSize: '8px', fill: '#555566', fontFamily: 'Courier New'
      }).setOrigin(0.5);
      container.add([slot, label]);
    });

    // Equipment system notice
    const devText = this.add.text(leftX, previewY + 130, '装备系统开发中...', {
      fontSize: '10px', fill: '#444455', fontFamily: 'Courier New'
    }).setOrigin(0.5);
    container.add(devText);

    // Level + XP bar
    const xpBarY = previewY + 150;
    this.charLevelText = this.add.text(leftX - 60, xpBarY, 'LV.1', {
      fontSize: '14px', fill: '#ffd700', fontFamily: 'Courier New', fontStyle: 'bold'
    });
    container.add(this.charLevelText);

    // XP bar background
    const xpBarBg = this.add.rectangle(leftX + 10, xpBarY + 7, 100, 10, 0x222233)
      .setStrokeStyle(1, 0x444466).setOrigin(0, 0.5);
    container.add(xpBarBg);

    // XP bar fill
    this.charXpBar = this.add.rectangle(leftX + 11, xpBarY + 7, 0, 8, 0x9966ff)
      .setOrigin(0, 0.5);
    container.add(this.charXpBar);

    this.charXpText = this.add.text(leftX + 10 + 50, xpBarY + 7, '0/40', {
      fontSize: '9px', fill: '#aaaacc', fontFamily: 'Courier New'
    }).setOrigin(0.5);
    container.add(this.charXpText);

    // --- RIGHT: Base Stats ---
    const statsTitle = this.add.text(rightX, topY, '-- 基础属性 --', {
      fontSize: '12px', fill: '#8888aa', fontFamily: 'Courier New'
    });
    container.add(statsTitle);

    const stats = ['con', 'str', 'int', 'agi', 'per', 'lck'];
    const statNames = ['体质(CON)', '力量(STR)', '智力(INT)', '敏捷(AGI)', '感知(PER)', '幸运(LCK)'];
    this.charStatValues = {};
    this.charStatPlusButtons = {};

    stats.forEach((stat, i) => {
      const y = topY + 30 + i * 32;

      const nameText = this.add.text(rightX, y, statNames[i], {
        fontSize: '13px', fill: '#ccccdd', fontFamily: 'Courier New'
      });

      const valueText = this.add.text(rightX + 140, y, '0', {
        fontSize: '13px', fill: '#ffffff', fontFamily: 'Courier New'
      }).setOrigin(0.5, 0);
      this.charStatValues[stat] = valueText;

      const plusBtn = this.add.text(rightX + 175, y, '[+]', {
        fontSize: '13px', fill: '#444444', fontFamily: 'Courier New'
      }).setInteractive({ useHandCursor: true });
      this.charStatPlusButtons[stat] = plusBtn;

      plusBtn.on('pointerdown', () => this.handleStatAllocation(stat));
      plusBtn.on('pointerover', () => {
        const ls = this.registry.get('levelSystem');
        if (ls && ls.statPoints > 0) plusBtn.setColor('#00ff00');
      });
      plusBtn.on('pointerout', () => this.updatePlusButtonColors());

      // Tooltip on stat name hover
      nameText.setInteractive();
      nameText.on('pointerover', () => this.showStatTooltip(stat, nameText.x, nameText.y));
      nameText.on('pointerout', () => this.hideTooltip());

      container.add([nameText, valueText, plusBtn]);
    });

    // Available stat points
    this.charStatPointsText = this.add.text(rightX, topY + 30 + 6 * 32 + 10, '可用属性点: 0', {
      fontSize: '12px', fill: '#ffd700', fontFamily: 'Courier New'
    });
    container.add(this.charStatPointsText);

    // --- Derived Stats (foldable) ---
    const derivedY = topY + 30 + 6 * 32 + 40;
    this.derivedExpanded = true;

    const derivedToggle = this.add.text(rightX, derivedY, '▼ 衍生属性', {
      fontSize: '12px', fill: '#8888aa', fontFamily: 'Courier New'
    }).setInteractive({ useHandCursor: true });
    container.add(derivedToggle);

    // Derived stats container
    this.derivedContainer = this.add.container(0, 0);
    container.add(this.derivedContainer);

    const derivedStats = [
      { key: 'hp', label: 'HP' },
      { key: 'mp', label: 'MP' },
      { key: 'attack', label: '攻击' },
      { key: 'spellPower', label: '法强' },
      { key: 'critRate', label: '暴击率' },
      { key: 'tenacity', label: '韧性' },
      { key: 'armorPen', label: '破甲' },
      { key: 'moveSpeed', label: '移速' },
      { key: 'dropBonus', label: '掉率加成' }
    ];

    this.charDerivedTexts = {};
    derivedStats.forEach((ds, i) => {
      const y = derivedY + 22 + i * 20;
      const label = this.add.text(rightX + 10, y, `${ds.label}:`, {
        fontSize: '11px', fill: '#999999', fontFamily: 'Courier New'
      });
      const value = this.add.text(rightX + 120, y, '-', {
        fontSize: '11px', fill: '#cccccc', fontFamily: 'Courier New'
      });
      this.charDerivedTexts[ds.key] = value;
      this.derivedContainer.add([label, value]);
    });

    derivedToggle.on('pointerdown', () => {
      this.derivedExpanded = !this.derivedExpanded;
      this.derivedContainer.setVisible(this.derivedExpanded);
      derivedToggle.setText(this.derivedExpanded ? '▼ 衍生属性' : '▶ 衍生属性');
    });

    // Tooltip container (shared, on top) - scene-level, not in tab container
    this.tooltipContainer = this.add.container(0, 0).setDepth(20).setVisible(false);
    this.tooltipBg = this.add.rectangle(0, 0, 200, 80, 0x1a1a2e, 0.95)
      .setStrokeStyle(1, 0x6666aa).setOrigin(0, 0);
    this.tooltipText = this.add.text(8, 8, '', {
      fontSize: '10px', fill: '#cccccc', fontFamily: 'Courier New', wordWrap: { width: 184 }
    });
    this.tooltipContainer.add([this.tooltipBg, this.tooltipText]);

    // Initial refresh
    this.refreshCharacterTab();
  }

  refreshCharacterTab() {
    const player = this.gameScene?.player;
    const levelSystem = this.registry.get('levelSystem');
    if (!player || !levelSystem) return;

    // Update level + XP
    this.charLevelText.setText(`LV.${levelSystem.level}`);
    const xpReq = levelSystem.getXpRequired();
    const xpPct = Math.min(1, levelSystem.xp / xpReq);
    this.charXpBar.setSize(Math.max(1, 98 * xpPct), 8);
    this.charXpText.setText(`${levelSystem.xp}/${xpReq}`);

    // Update base stats
    const stats = ['con', 'str', 'int', 'agi', 'per', 'lck'];
    stats.forEach(stat => {
      const val = player.stats.getEffective(stat);
      this.charStatValues[stat].setText(`${val}`);
    });

    // Update stat points
    this.charStatPointsText.setText(`可用属性点: ${levelSystem.statPoints}`);
    this.updatePlusButtonColors();

    // Update derived stats
    const derived = player.stats.getDerived();
    this.charDerivedTexts.hp.setText(`${player.hp}/${player.maxHp}`);
    this.charDerivedTexts.mp.setText(`${player.mp}/${player.maxMp}`);
    this.charDerivedTexts.attack.setText(`${derived.attack}`);
    this.charDerivedTexts.spellPower.setText(`${derived.spellPower}`);
    this.charDerivedTexts.critRate.setText(`${derived.critRate.toFixed(1)}%`);
    this.charDerivedTexts.tenacity.setText(`${derived.tenacity.toFixed(1)}`);
    this.charDerivedTexts.armorPen.setText(`${derived.armorPen.toFixed(1)}`);
    this.charDerivedTexts.moveSpeed.setText(`${derived.moveSpeed}`);
    this.charDerivedTexts.dropBonus.setText(`${derived.dropBonus.toFixed(1)}%`);
  }

  handleStatAllocation(statName) {
    const levelSystem = this.registry.get('levelSystem');
    if (!levelSystem || levelSystem.statPoints <= 0) return;

    const player = this.gameScene?.player;
    if (!player) return;

    // Allocate
    if (levelSystem.allocateStat(statName)) {
      player.stats.addBase(statName, 1);
      player.stats.invalidate();
      player.refreshStats();
      player.onHpChanged();

      // Show "+1" floating effect
      const valueText = this.charStatValues[statName];
      const floatText = this.add.text(valueText.x, valueText.y, '+1', {
        fontSize: '12px', fill: '#00ff00', fontFamily: 'Courier New', fontStyle: 'bold'
      }).setOrigin(0.5, 1).setDepth(25);

      this.tweens.add({
        targets: floatText,
        y: floatText.y - 25,
        alpha: 0,
        duration: 800,
        onComplete: () => floatText.destroy()
      });

      // Flash the value green briefly
      this.charStatValues[statName].setColor('#00ff00');
      this.time.delayedCall(300, () => {
        if (this.charStatValues[statName]) this.charStatValues[statName].setColor('#ffffff');
      });

      this.refreshCharacterTab();
    }
  }

  updatePlusButtonColors() {
    const levelSystem = this.registry.get('levelSystem');
    const hasPoints = levelSystem && levelSystem.statPoints > 0;
    const stats = ['con', 'str', 'int', 'agi', 'per', 'lck'];
    stats.forEach(stat => {
      if (this.charStatPlusButtons[stat]) {
        this.charStatPlusButtons[stat].setColor(hasPoints ? '#00cc00' : '#444444');
      }
    });
  }

  showStatTooltip(stat, x, y) {
    if (!this.tooltipContainer) return;

    const player = this.gameScene?.player;
    if (!player) return;

    const derived = player.stats.getDerived();
    const val = player.stats.getEffective(stat);

    const tooltips = {
      con: `体质 (CON) = ${val}\n+${val * 10} 最大生命\n+${(val * 0.5).toFixed(1)}/s 生命恢复\n+${(val * 0.5).toFixed(1)} 韧性`,
      str: `力量 (STR) = ${val}\n+${val * 2} 物理攻击\n+${(val * 0.2).toFixed(1)} 韧性\n+${(val * 0.3).toFixed(1)} 破甲`,
      int: `智力 (INT) = ${val}\n+${val * 15} 最大魔力\n+${val} 法术强度\n+${(val * 0.2).toFixed(1)}% 冷却缩减`,
      agi: `敏捷 (AGI) = ${val}\n+${val}% 攻击速度\n+${val * 20 + 40} 移动速度`,
      per: `感知 (PER) = ${val}\n+${(val * 0.5).toFixed(1)}% 暴击率\n+${(val * 0.5).toFixed(1)} 破甲`,
      lck: `幸运 (LCK) = ${val}\n+${(Math.sqrt(val) * 1).toFixed(1)}% 掉落加成`
    };

    this.tooltipText.setText(tooltips[stat] || '');
    this.tooltipContainer.setPosition(x + 120, y - 10);
    this.tooltipContainer.setVisible(true);
  }

  hideTooltip() {
    if (this.tooltipContainer) this.tooltipContainer.setVisible(false);
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
