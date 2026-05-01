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
    // Inventory tab has dedicated implementation
    this.createInventoryTab();
    // Skill tree tab has dedicated implementation
    this.createSkillTreeTab();
    // Quest log tab
    this.createQuestLogTab();

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
    if (tabName === 'inventory') this.refreshInventoryTab();
    if (tabName === 'skillTree') this.refreshSkillTreeTab();
    if (tabName === 'questLog') this.refreshQuestLogTab();
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

  createInventoryTab() {
    const container = this.add.container(0, 0).setDepth(5).setVisible(false);
    this.tabContainers.inventory = container;

    const contentTop = this.panelTop + 50;
    const contentW = this.panelW - 20;
    const contentH = this.panelH - 60;

    // Content background
    const contentBg = this.add.rectangle(
      this.panelX, contentTop + contentH / 2,
      contentW, contentH, 0x12121e, 0.8
    ).setStrokeStyle(1, 0x3a3a5a);
    container.add(contentBg);

    // --- Filter bar ---
    const filterY = contentTop + 18;
    const filterTypes = [
      { key: 'all', label: '全部' },
      { key: 'consumable', label: '消耗' },
      { key: 'quest', label: '任务' },
      { key: 'equipment', label: '装备' },
      { key: 'material', label: '材料' }
    ];
    this.invActiveFilter = 'all';
    this.invFilterButtons = [];

    const filterLabel = this.add.text(this.panelLeft + 20, filterY, '过滤:', {
      fontSize: '11px', fill: '#888899', fontFamily: 'Courier New'
    });
    container.add(filterLabel);

    filterTypes.forEach((ft, i) => {
      const btn = this.add.text(this.panelLeft + 65 + i * 55, filterY, `[${ft.label}]`, {
        fontSize: '11px', fill: ft.key === 'all' ? '#ffffff' : '#777788', fontFamily: 'Courier New'
      }).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.invActiveFilter = ft.key;
        this.invFilterButtons.forEach((b, j) => {
          b.setColor(filterTypes[j].key === ft.key ? '#ffffff' : '#777788');
        });
        this.refreshInventoryTab();
      });

      this.invFilterButtons.push(btn);
      container.add(btn);
    });

    // --- Sort buttons + Gold display ---
    const sortY = contentTop + 38;
    const sortLabel = this.add.text(this.panelLeft + 20, sortY, '排序:', {
      fontSize: '11px', fill: '#888899', fontFamily: 'Courier New'
    });
    container.add(sortLabel);

    const sortTypes = [
      { key: 'level', label: '等级▼' },
      { key: 'type', label: '种类' },
      { key: 'rarity', label: '稀有度' }
    ];
    sortTypes.forEach((st, i) => {
      const btn = this.add.text(this.panelLeft + 65 + i * 65, sortY, `[${st.label}]`, {
        fontSize: '11px', fill: '#777788', fontFamily: 'Courier New'
      }).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        const inv = this.gameScene?.inventory;
        if (inv) {
          inv.sortBy(st.key);
          this.refreshInventoryTab();
        }
      });
      btn.on('pointerover', () => btn.setColor('#aaaacc'));
      btn.on('pointerout', () => btn.setColor('#777788'));
      container.add(btn);
    });

    // Gold display
    this.invGoldText = this.add.text(this.panelLeft + contentW - 10, sortY, '金币: 0', {
      fontSize: '12px', fill: '#ffd700', fontFamily: 'Courier New'
    }).setOrigin(1, 0);
    container.add(this.invGoldText);

    // --- 8x4 Grid ---
    const cellSize = 48;
    const gap = 4;
    const gridW = 8 * (cellSize + gap) - gap;
    const gridStartX = this.panelX - gridW / 2;
    const gridStartY = contentTop + 65;

    const RARITY_COLORS = {
      common:    { bg: 0x3a3a3a, border: 0x666666 },
      uncommon:  { bg: 0x1a3a1a, border: 0x44bb44 },
      rare:      { bg: 0x1a1a3a, border: 0x4488ff },
      epic:      { bg: 0x2a1a3a, border: 0xbb44ff },
      legendary: { bg: 0x3a2a1a, border: 0xffaa00 }
    };
    this.RARITY_COLORS = RARITY_COLORS;

    this.invSlots = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 8; col++) {
        const x = gridStartX + col * (cellSize + gap) + cellSize / 2;
        const y = gridStartY + row * (cellSize + gap) + cellSize / 2;
        const slotIndex = row * 8 + col;

        const cell = this.add.rectangle(x, y, cellSize, cellSize, 0x3a3a3a, 0.8)
          .setStrokeStyle(1, 0x666666)
          .setInteractive({ useHandCursor: true });

        // Item icon placeholder (text-based since we use generated textures)
        const icon = this.add.text(x, y - 4, '', {
          fontSize: '18px', fill: '#ffffff', fontFamily: 'Courier New'
        }).setOrigin(0.5).setVisible(false);

        // Quantity badge
        const countText = this.add.text(x + cellSize / 2 - 4, y + cellSize / 2 - 4, '', {
          fontSize: '9px', fill: '#ffffff', fontFamily: 'Courier New',
          backgroundColor: '#00000088', padding: { x: 2, y: 0 }
        }).setOrigin(1, 1).setVisible(false);

        cell.on('pointerover', () => {
          cell.setStrokeStyle(2, 0xffffff);
          this.showItemTooltip(slotIndex, x, y);
        });
        cell.on('pointerout', () => {
          this.restoreSlotBorder(slotIndex);
          this.hideTooltip();
        });
        cell.on('pointerdown', (pointer) => {
          if (pointer.rightButtonDown()) {
            this.showContextMenu(slotIndex, pointer);
          } else {
            this.selectInventoryItem(slotIndex);
          }
        });

        this.invSlots.push({ cell, icon, countText, index: slotIndex });
        container.add([cell, icon, countText]);
      }
    }

    // --- Item Detail Panel (bottom) ---
    const detailY = gridStartY + 4 * (cellSize + gap) + 20;
    const detailH = contentTop + contentH - detailY - 10;

    const detailBg = this.add.rectangle(this.panelX, detailY + detailH / 2, contentW - 20, detailH, 0x1e1e2e, 0.9)
      .setStrokeStyle(1, 0x3a3a5a);
    container.add(detailBg);

    this.invDetailName = this.add.text(this.panelLeft + 30, detailY + 8, '', {
      fontSize: '14px', fill: '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold'
    });
    container.add(this.invDetailName);

    this.invDetailRarity = this.add.text(this.panelLeft + 30, detailY + 28, '', {
      fontSize: '10px', fill: '#888888', fontFamily: 'Courier New'
    });
    container.add(this.invDetailRarity);

    this.invDetailDesc = this.add.text(this.panelLeft + 30, detailY + 44, '', {
      fontSize: '11px', fill: '#aaaaaa', fontFamily: 'Courier New',
      wordWrap: { width: contentW - 200 }
    });
    container.add(this.invDetailDesc);

    // Action buttons
    this.invUseBtn = this.add.text(this.panelLeft + contentW - 90, detailY + 12, '[使用]', {
      fontSize: '12px', fill: '#44cc44', fontFamily: 'Courier New'
    }).setInteractive({ useHandCursor: true }).setVisible(false);
    this.invUseBtn.on('pointerdown', () => this.useSelectedItem());
    container.add(this.invUseBtn);

    this.invDropBtn = this.add.text(this.panelLeft + contentW - 90, detailY + 34, '[丢弃]', {
      fontSize: '12px', fill: '#cc4444', fontFamily: 'Courier New'
    }).setInteractive({ useHandCursor: true }).setVisible(false);
    this.invDropBtn.on('pointerdown', () => this.dropSelectedItem());
    container.add(this.invDropBtn);

    this.invSelectedSlot = -1;

    // Context menu container (scene-level, high depth)
    this.contextMenu = this.add.container(0, 0).setDepth(30).setVisible(false);

    // Disable browser right-click on game canvas
    this.input.mouse.disableContextMenu();
  }

  refreshInventoryTab() {
    const inv = this.gameScene?.inventory;
    if (!inv || !this.invSlots) return;

    // Update gold
    if (this.invGoldText) this.invGoldText.setText(`金币: ${inv.gold}`);

    // Get filtered view
    const filtered = this.invActiveFilter === 'all'
      ? inv.slots
      : inv.filterBy(this.invActiveFilter);

    // Item name abbreviations for icon display
    const ITEM_ICONS = {
      potion: '药', heart: '♥', key: '🔑', artifact: '✦',
      coin: '●'
    };

    // Update each slot
    this.invSlots.forEach(({ cell, icon, countText, index }) => {
      const item = filtered[index];

      if (item) {
        const rarity = this.RARITY_COLORS[item.rarity] || this.RARITY_COLORS.common;
        cell.setFillStyle(rarity.bg, 0.8);
        cell.setStrokeStyle(1, rarity.border);

        icon.setText(ITEM_ICONS[item.id] || item.name.charAt(0));
        icon.setVisible(true);

        if (item.quantity > 1) {
          countText.setText(`${item.quantity}`);
          countText.setVisible(true);
        } else {
          countText.setVisible(false);
        }
      } else {
        cell.setFillStyle(0x3a3a3a, 0.8);
        cell.setStrokeStyle(1, 0x666666);
        icon.setVisible(false);
        countText.setVisible(false);
      }
    });

    // Update selection highlight
    if (this.invSelectedSlot >= 0) {
      this.selectInventoryItem(this.invSelectedSlot);
    }
  }

  selectInventoryItem(slotIndex) {
    this.invSelectedSlot = slotIndex;
    const inv = this.gameScene?.inventory;
    if (!inv) return;

    const item = inv.getSlot(slotIndex);

    // Update detail panel
    if (item) {
      const RARITY_NAMES = {
        common: '普通', uncommon: '优秀', rare: '精良', epic: '史诗', legendary: '传说'
      };
      const rarityColor = this.RARITY_COLORS[item.rarity] || this.RARITY_COLORS.common;

      this.invDetailName.setText(item.name);
      this.invDetailName.setColor('#' + rarityColor.border.toString(16).padStart(6, '0'));
      this.invDetailRarity.setText(`[${RARITY_NAMES[item.rarity] || '普通'}] Lv.${item.level || 1}  数量: ${item.quantity}`);
      this.invDetailDesc.setText(item.description || '');

      this.invUseBtn.setVisible(item.type === 'consumable');
      this.invDropBtn.setVisible(item.type !== 'quest');
    } else {
      this.invDetailName.setText('');
      this.invDetailRarity.setText('');
      this.invDetailDesc.setText('选择一个物品查看详情');
      this.invUseBtn.setVisible(false);
      this.invDropBtn.setVisible(false);
    }

    // Highlight selected slot
    this.invSlots.forEach(({ cell }, i) => {
      if (i === slotIndex) {
        cell.setStrokeStyle(2, 0xffffff);
      } else {
        this.restoreSlotBorder(i);
      }
    });
  }

  restoreSlotBorder(slotIndex) {
    const inv = this.gameScene?.inventory;
    if (!inv || !this.invSlots[slotIndex]) return;

    const item = inv.getSlot(slotIndex);
    const cell = this.invSlots[slotIndex].cell;

    if (slotIndex === this.invSelectedSlot) {
      cell.setStrokeStyle(2, 0xffffff);
      return;
    }

    if (item) {
      const rarity = this.RARITY_COLORS[item.rarity] || this.RARITY_COLORS.common;
      cell.setStrokeStyle(1, rarity.border);
    } else {
      cell.setStrokeStyle(1, 0x666666);
    }
  }

  useSelectedItem() {
    const inv = this.gameScene?.inventory;
    if (!inv || this.invSelectedSlot < 0) return;
    inv.useItem(this.invSelectedSlot);
    this.refreshInventoryTab();
    // Re-select to update detail panel
    this.selectInventoryItem(this.invSelectedSlot);
  }

  dropSelectedItem() {
    const inv = this.gameScene?.inventory;
    if (!inv || this.invSelectedSlot < 0) return;
    inv.removeItem(this.invSelectedSlot, 1);
    this.refreshInventoryTab();
    this.selectInventoryItem(this.invSelectedSlot);
  }

  showItemTooltip(slotIndex, x, y) {
    const inv = this.gameScene?.inventory;
    if (!inv) return;
    const item = inv.getSlot(slotIndex);
    if (!item) return;

    if (!this.tooltipContainer) return;

    const RARITY_NAMES = {
      common: '普通', uncommon: '优秀', rare: '精良', epic: '史诗', legendary: '传说'
    };

    this.tooltipText.setText(
      `${item.name}\n[${RARITY_NAMES[item.rarity] || '普通'}] Lv.${item.level || 1}\n${item.description || ''}\n数量: ${item.quantity}${item.sellPrice > 0 ? '\n售价: ' + item.sellPrice : ''}`
    );
    this.tooltipContainer.setPosition(x + 30, y - 40);
    this.tooltipContainer.setVisible(true);
  }

  showContextMenu(slotIndex, pointer) {
    const inv = this.gameScene?.inventory;
    if (!inv) return;
    const item = inv.getSlot(slotIndex);
    if (!item) return;

    // Clear previous context menu
    this.contextMenu.removeAll(true);

    const menuX = pointer.x;
    const menuY = pointer.y;

    const bg = this.add.rectangle(0, 0, 80, 0, 0x2a2a3e, 0.95)
      .setStrokeStyle(1, 0x5a5a7a).setOrigin(0, 0);
    this.contextMenu.add(bg);

    let optionY = 4;
    const addOption = (label, color, callback) => {
      const opt = this.add.text(8, optionY, label, {
        fontSize: '11px', fill: color, fontFamily: 'Courier New'
      }).setInteractive({ useHandCursor: true });
      opt.on('pointerdown', () => {
        callback();
        this.contextMenu.setVisible(false);
      });
      opt.on('pointerover', () => opt.setColor('#ffffff'));
      opt.on('pointerout', () => opt.setColor(color));
      this.contextMenu.add(opt);
      optionY += 20;
    };

    if (item.type === 'consumable') addOption('使用', '#44cc44', () => { inv.useItem(slotIndex); this.refreshInventoryTab(); });
    if (item.type !== 'quest') addOption('丢弃', '#cc4444', () => { inv.removeItem(slotIndex, 1); this.refreshInventoryTab(); });

    bg.setSize(80, optionY + 4);

    this.contextMenu.setPosition(menuX, menuY);
    this.contextMenu.setVisible(true);

    // Close context menu on any click elsewhere
    this.input.once('pointerdown', () => {
      if (this.contextMenu) this.contextMenu.setVisible(false);
    });
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

  createSkillTreeTab() {
    const container = this.add.container(0, 0).setDepth(5).setVisible(false);
    this.tabContainers.skillTree = container;

    const contentTop = this.panelTop + 50;
    const contentW = this.panelW - 20;
    const contentH = this.panelH - 60;

    // Content background
    const contentBg = this.add.rectangle(
      this.panelX, contentTop + contentH / 2,
      contentW, contentH, 0x12121e, 0.8
    ).setStrokeStyle(1, 0x3a3a5a);
    container.add(contentBg);

    // Skill points display
    this.skillPointsText = this.add.text(this.panelLeft + 20, contentTop + 10, '技能点: 0', {
      fontSize: '13px', fill: '#00ccff', fontFamily: 'Courier New'
    });
    container.add(this.skillPointsText);

    // "技能内容待填充" notice
    const noticeText = this.add.text(this.panelLeft + contentW - 20, contentTop + 10, '技能内容待填充', {
      fontSize: '10px', fill: '#555566', fontFamily: 'Courier New'
    }).setOrigin(1, 0);
    container.add(noticeText);

    // Tree visualization
    const centerX = this.panelX;
    const startY = contentTop + 60;
    const spacingX = 80;
    const spacingY = 80;

    const skillTree = this.registry.get('skillTreeSystem');
    if (!skillTree) return;

    // Draw connection lines first (lower depth)
    this.skillLines = [];
    skillTree.nodes.forEach(node => {
      node.prerequisites.forEach(preReqId => {
        const preReq = skillTree.getNode(preReqId);
        if (!preReq) return;

        const fromX = centerX + preReq.x * spacingX;
        const fromY = startY + preReq.y * spacingY;
        const toX = centerX + node.x * spacingX;
        const toY = startY + node.y * spacingY;

        const line = this.add.graphics();
        line.lineStyle(2, 0x444466);
        line.beginPath();
        line.moveTo(fromX, fromY);
        line.lineTo(toX, toY);
        line.strokePath();
        container.add(line);
        this.skillLines.push({ line, fromId: preReqId, toId: node.id });
      });
    });

    // Draw nodes
    this.skillNodeElements = {};
    skillTree.nodes.forEach(node => {
      const nx = centerX + node.x * spacingX;
      const ny = startY + node.y * spacingY;

      // Node shape: circle for passive, rounded rectangle for active
      const size = node.type === 'passive' ? 28 : 32;
      let shape;
      if (node.type === 'passive') {
        shape = this.add.circle(nx, ny, size / 2, 0x2a2a3a)
          .setStrokeStyle(2, 0x555555);
      } else {
        shape = this.add.rectangle(nx, ny, size, size, 0x2a2a3a)
          .setStrokeStyle(2, 0x555555);
      }
      shape.setInteractive({ useHandCursor: true });

      // Node label
      const label = this.add.text(nx, ny, node.name === '???' ? '?' : node.name.charAt(0), {
        fontSize: '12px', fill: '#888888', fontFamily: 'Courier New'
      }).setOrigin(0.5);

      // Rank indicator
      const rankText = this.add.text(nx, ny + size / 2 + 8, `${node.currentRank}/${node.maxRank}`, {
        fontSize: '8px', fill: '#666666', fontFamily: 'Courier New'
      }).setOrigin(0.5);

      // Interaction
      shape.on('pointerover', () => {
        this.showSkillTooltip(node, nx, ny);
      });
      shape.on('pointerout', () => {
        this.hideTooltip();
      });
      shape.on('pointerdown', () => {
        this.handleSkillNodeClick(node.id);
      });

      container.add([shape, label, rankText]);
      this.skillNodeElements[node.id] = { shape, label, rankText };
    });

    // Bottom detail panel
    const detailY = startY + 4 * spacingY + 10;
    this.skillDetailText = this.add.text(this.panelX, detailY, '', {
      fontSize: '11px', fill: '#aaaaaa', fontFamily: 'Courier New',
      align: 'center', wordWrap: { width: contentW - 40 }
    }).setOrigin(0.5, 0);
    container.add(this.skillDetailText);

    this.refreshSkillTreeTab();
  }

  refreshSkillTreeTab() {
    const skillTree = this.registry.get('skillTreeSystem');
    const levelSystem = this.registry.get('levelSystem');
    if (!skillTree || !this.skillNodeElements) return;

    if (this.skillPointsText) {
      this.skillPointsText.setText(`技能点: ${levelSystem ? levelSystem.skillPoints : 0}`);
    }

    // Update node visuals based on state
    const STATE_COLORS = {
      maxed:     { fill: 0x3a3a1a, border: 0xffd700, label: '#ffd700' },  // Gold
      unlocked:  { fill: 0x2a3a2a, border: 0x44bb44, label: '#44bb44' },  // Green
      available: { fill: 0x2a2a3a, border: 0xcccccc, label: '#cccccc' },  // White
      locked:    { fill: 0x2a2a2a, border: 0x444444, label: '#555555' }   // Gray
    };

    skillTree.nodes.forEach(node => {
      const el = this.skillNodeElements[node.id];
      if (!el) return;

      const state = skillTree.getNodeState(node.id);
      const colors = STATE_COLORS[state] || STATE_COLORS.locked;

      el.shape.setFillStyle(colors.fill);
      el.shape.setStrokeStyle(2, colors.border);
      el.label.setColor(colors.label);
      el.rankText.setText(`${node.currentRank}/${node.maxRank}`);
      el.rankText.setColor(colors.label);
    });

    // Update connection line colors
    if (this.skillLines) {
      this.skillLines.forEach(({ line, fromId, toId }) => {
        const fromState = skillTree.getNodeState(fromId);
        const toState = skillTree.getNodeState(toId);
        line.clear();
        const lineColor = (fromState === 'unlocked' || fromState === 'maxed') ? 0x44bb44 : 0x444466;
        const fromNode = skillTree.getNode(fromId);
        const toNode = skillTree.getNode(toId);
        const centerX = this.panelX;
        const startY = this.panelTop + 50 + 60;
        const spacingX = 80;
        const spacingY = 80;
        line.lineStyle(2, lineColor);
        line.beginPath();
        line.moveTo(centerX + fromNode.x * spacingX, startY + fromNode.y * spacingY);
        line.lineTo(centerX + toNode.x * spacingX, startY + toNode.y * spacingY);
        line.strokePath();
      });
    }
  }

  showSkillTooltip(node, x, y) {
    if (!this.tooltipContainer) return;
    const skillTree = this.registry.get('skillTreeSystem');
    const state = skillTree ? skillTree.getNodeState(node.id) : 'locked';

    const stateLabels = { maxed: '已满级', unlocked: '已解锁', available: '可解锁', locked: '未解锁' };

    let text = `${node.name}\n`;
    text += `类型: ${node.type === 'passive' ? '被动' : '主动'}\n`;
    text += `等级: ${node.currentRank}/${node.maxRank}\n`;
    text += `状态: ${stateLabels[state] || '未知'}\n`;
    text += `需要等级: ${node.requiredLevel}\n`;
    if (node.cost > 0) text += `消耗: ${node.cost} 技能点\n`;
    text += `${node.description}`;

    this.tooltipText.setText(text);
    this.tooltipContainer.setPosition(x + 30, y - 20);
    this.tooltipContainer.setVisible(true);
  }

  handleSkillNodeClick(nodeId) {
    const skillTree = this.registry.get('skillTreeSystem');
    if (!skillTree) return;

    const state = skillTree.getNodeState(nodeId);
    if (state !== 'available') return;

    // Try to unlock
    if (skillTree.unlock(nodeId)) {
      // Success animation
      const el = this.skillNodeElements[nodeId];
      if (el) {
        this.tweens.add({
          targets: el.shape,
          scaleX: 1.3, scaleY: 1.3,
          duration: 150, yoyo: true, ease: 'Back.easeOut'
        });
      }
      this.refreshSkillTreeTab();
    }
  }

  createQuestLogTab() {
    const container = this.add.container(0, 0).setDepth(5).setVisible(false);
    this.tabContainers.questLog = container;

    const contentTop = this.panelTop + 50;
    const contentW = this.panelW - 20;
    const contentH = this.panelH - 60;

    // Content background
    const contentBg = this.add.rectangle(
      this.panelX, contentTop + contentH / 2,
      contentW, contentH, 0x12121e, 0.8
    ).setStrokeStyle(1, 0x3a3a5a);
    container.add(contentBg);

    // Left panel (30%) - quest list
    const leftW = contentW * 0.3;
    const leftX = this.panelLeft + 10;
    const listBg = this.add.rectangle(
      leftX + leftW / 2, contentTop + contentH / 2,
      leftW, contentH - 10, 0x1a1a28, 0.9
    ).setStrokeStyle(1, 0x3a3a4a);
    container.add(listBg);

    // Quest list title
    const listTitle = this.add.text(leftX + 10, contentTop + 10, '任务列表', {
      fontSize: '13px', fill: '#aaaacc', fontFamily: 'Courier New', fontStyle: 'bold'
    });
    container.add(listTitle);

    // Quest list area
    this.questListItems = [];
    this.questListContainer = this.add.container(0, 0);
    container.add(this.questListContainer);

    // Right panel (70%) - quest detail
    const rightX = leftX + leftW + 10;
    const rightW = contentW - leftW - 20;

    // Detail panel title
    this.questDetailTitle = this.add.text(rightX + 10, contentTop + 10, '', {
      fontSize: '15px', fill: '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold'
    });
    container.add(this.questDetailTitle);

    // Quest type badge
    this.questDetailType = this.add.text(rightX + 10, contentTop + 32, '', {
      fontSize: '10px', fill: '#888888', fontFamily: 'Courier New'
    });
    container.add(this.questDetailType);

    // Description
    this.questDetailDesc = this.add.text(rightX + 10, contentTop + 52, '', {
      fontSize: '11px', fill: '#aaaaaa', fontFamily: 'Courier New',
      wordWrap: { width: rightW - 30 }
    });
    container.add(this.questDetailDesc);

    // Objectives section
    this.questObjTitle = this.add.text(rightX + 10, contentTop + 100, '', {
      fontSize: '12px', fill: '#8888aa', fontFamily: 'Courier New'
    });
    container.add(this.questObjTitle);

    this.questObjTexts = [];
    for (let i = 0; i < 5; i++) {
      const objText = this.add.text(rightX + 20, contentTop + 120 + i * 22, '', {
        fontSize: '11px', fill: '#cccccc', fontFamily: 'Courier New'
      });
      this.questObjTexts.push(objText);
      container.add(objText);
    }

    // Rewards section
    this.questRewardsTitle = this.add.text(rightX + 10, contentTop + 240, '', {
      fontSize: '12px', fill: '#8888aa', fontFamily: 'Courier New'
    });
    container.add(this.questRewardsTitle);

    this.questRewardsText = this.add.text(rightX + 20, contentTop + 260, '', {
      fontSize: '11px', fill: '#ffd700', fontFamily: 'Courier New'
    });
    container.add(this.questRewardsText);

    this.selectedQuestId = null;
  }

  refreshQuestLogTab() {
    const questSystem = this.registry.get('questSystem');
    if (!questSystem || !this.questListContainer) return;

    // Clear existing list items
    this.questListContainer.removeAll(true);
    this.questListItems = [];

    const contentTop = this.panelTop + 50;
    const leftX = this.panelLeft + 10;
    let y = contentTop + 35;

    // Group quests
    const groups = [
      { label: '-- 主线任务 --', quests: questSystem.quests.filter(q => q.type === 'main' && q.status === 'active') },
      { label: '-- 支线任务 --', quests: questSystem.quests.filter(q => q.type === 'side' && q.status === 'active') },
      { label: '-- 已完成 --', quests: questSystem.quests.filter(q => q.status === 'completed') }
    ];

    groups.forEach(group => {
      if (group.quests.length === 0) return;

      // Group header
      const header = this.add.text(leftX + 15, y, group.label, {
        fontSize: '10px', fill: '#666688', fontFamily: 'Courier New'
      });
      this.questListContainer.add(header);
      y += 18;

      group.quests.forEach(quest => {
        const isSelected = quest.id === this.selectedQuestId;
        const isCompleted = quest.status === 'completed';
        const color = isCompleted ? '#555555' : (quest.type === 'main' ? '#ffaa44' : '#aaaacc');

        const item = this.add.text(leftX + 20, y,
          `${isCompleted ? '\u2713 ' : '\u25CF '}${quest.title}`, {
            fontSize: '11px', fill: isSelected ? '#ffffff' : color,
            fontFamily: 'Courier New',
            backgroundColor: isSelected ? '#3a3a5e' : undefined,
            padding: isSelected ? { x: 4, y: 2 } : undefined
          }
        ).setInteractive({ useHandCursor: true });

        item.on('pointerdown', () => this.selectQuest(quest.id));
        item.on('pointerover', () => { if (!isSelected) item.setColor('#ffffff'); });
        item.on('pointerout', () => { if (quest.id !== this.selectedQuestId) item.setColor(color); });

        this.questListContainer.add(item);
        this.questListItems.push({ text: item, questId: quest.id });
        y += 20;
      });

      y += 5;
    });

    // Auto-select first active quest if none selected
    if (!this.selectedQuestId) {
      const firstActive = questSystem.getActiveQuests()[0];
      if (firstActive) this.selectQuest(firstActive.id);
    } else {
      this.selectQuest(this.selectedQuestId);
    }
  }

  selectQuest(questId) {
    const questSystem = this.registry.get('questSystem');
    if (!questSystem) return;

    this.selectedQuestId = questId;
    const quest = questSystem.quests.find(q => q.id === questId);
    if (!quest) {
      this.questDetailTitle.setText('');
      this.questDetailType.setText('');
      this.questDetailDesc.setText('选择一个任务查看详情');
      this.questObjTitle.setText('');
      this.questObjTexts.forEach(t => t.setText(''));
      this.questRewardsTitle.setText('');
      this.questRewardsText.setText('');
      return;
    }

    const typeLabels = { main: '[主线]', side: '[支线]' };
    const statusLabels = { active: '进行中', completed: '已完成', locked: '未解锁' };

    this.questDetailTitle.setText(quest.title);
    this.questDetailType.setText(`${typeLabels[quest.type] || ''} ${statusLabels[quest.status] || ''}`);
    this.questDetailType.setColor(quest.type === 'main' ? '#ffaa44' : '#8888aa');
    this.questDetailDesc.setText(quest.description);

    // Objectives
    this.questObjTitle.setText('-- 目标 --');
    quest.objectives.forEach((obj, i) => {
      if (i < this.questObjTexts.length) {
        const done = obj.current >= obj.required;
        const prefix = done ? '\u2713' : '\u25CB';
        this.questObjTexts[i].setText(`${prefix} ${obj.text} (${obj.current}/${obj.required})`);
        this.questObjTexts[i].setColor(done ? '#44bb44' : '#cccccc');
      }
    });
    // Clear remaining objective lines
    for (let i = quest.objectives.length; i < this.questObjTexts.length; i++) {
      this.questObjTexts[i].setText('');
    }

    // Rewards
    this.questRewardsTitle.setText('-- 奖励 --');
    let rewardStr = '';
    if (quest.rewards.xp) rewardStr += `经验: ${quest.rewards.xp}  `;
    if (quest.rewards.gold) rewardStr += `金币: ${quest.rewards.gold}`;
    this.questRewardsText.setText(rewardStr);
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
