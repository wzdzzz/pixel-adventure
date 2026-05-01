export const InventoryPanel = {
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

    this.invCompareText = this.add.text(this.panelLeft + 30, detailY + 70, '', {
      fontSize: '10px', fill: '#aaaaaa', fontFamily: 'Courier New',
      lineSpacing: 2
    }).setVisible(false);
    container.add(this.invCompareText);

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

    this.invEquipBtn = this.add.text(this.panelLeft + contentW - 90, detailY + 56, '[装备]', {
      fontSize: '12px', fill: '#44ff44', fontFamily: 'Courier New', fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true }).setVisible(false);
    this.invEquipBtn.on('pointerdown', () => this.equipSelectedItem());
    container.add(this.invEquipBtn);

    this.invSelectedSlot = -1;

    // Context menu container (scene-level, high depth)
    this.contextMenu = this.add.container(0, 0).setDepth(30).setVisible(false);

    // Disable browser right-click on game canvas
    this.input.mouse.disableContextMenu();
  },

  refreshInventoryTab() {
    const inv = this.gameScene?.inventory;
    if (!inv || !this.invSlots) return;

    // Update gold
    if (this.invGoldText) this.invGoldText.setText(`金币: ${inv.gold}`);

    // Get filtered view
    const filtered = this.invActiveFilter === 'all'
      ? inv.slots
      : inv.filterBy(this.invActiveFilter);

    // Build compact display: non-null items only, track original slot indices
    this._gridToSlot = [];
    const compactItems = [];
    filtered.forEach((item, slotIdx) => {
      if (item !== null) {
        compactItems.push(item);
        this._gridToSlot.push(slotIdx);
      }
    });

    // Item name abbreviations for icon display
    const ITEM_ICONS = {
      potion: '药', heart: '♥', key: '🔑', artifact: '✦',
      coin: '●'
    };

    // Update each slot — compact display without gaps
    this.invSlots.forEach(({ cell, icon, countText }, gridIdx) => {
      const item = compactItems[gridIdx];

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
  },

  _actualSlot(gridIndex) {
    return this._gridToSlot?.[gridIndex] ?? -1;
  },

  selectInventoryItem(slotIndex) {
    this.invSelectedSlot = slotIndex;
    const inv = this.gameScene?.inventory;
    if (!inv) return;

    const actualSlot = this._actualSlot(slotIndex);
    const item = actualSlot >= 0 ? inv.getSlot(actualSlot) : null;

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

      // Equipment stat comparison
      if (item.type === 'equipment' && this.invCompareText) {
        const equip = this.gameScene?.equipmentSystem;
        // Determine which slot to compare against
        let compareSlot = item.slot;
        if (compareSlot === 'ring1' || compareSlot === 'ring2') {
          compareSlot = equip?.getSlot('ring1') === null ? 'ring1' : 'ring2';
        }
        const currentEquip = equip ? equip.getSlot(compareSlot) : null;

        const STAT_NAMES = {
          attack: '攻击', defense: '防御', maxHp: '生命', maxStamina: '体力',
          spellPower: '法强', moveSpeed: '移速', attackSpeed: '攻速',
          critRate: '暴击率', critDmg: '暴击伤害', hpRegen: 'HP回复'
        };

        let compareText = '';
        if (item.baseStats) {
          for (const [stat, val] of Object.entries(item.baseStats)) {
            const currentVal = currentEquip?.baseStats?.[stat] || 0;
            const diff = val - currentVal;
            const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '=';
            const color = diff > 0 ? '(+)' : diff < 0 ? '(-)' : '';
            compareText += `${STAT_NAMES[stat] || stat}: ${val} ${arrow}${Math.abs(diff) > 0 ? Math.abs(diff) : ''} ${color}\n`;
          }
        }
        if (currentEquip) {
          compareText += `\n对比: ${currentEquip.name}`;
        } else {
          compareText += `\n当前: 空槽位`;
        }
        this.invCompareText.setText(compareText);
        this.invCompareText.setVisible(true);
      } else if (this.invCompareText) {
        this.invCompareText.setVisible(false);
      }

      this.invUseBtn.setVisible(item.type === 'consumable');
      this.invEquipBtn.setVisible(item.type === 'equipment');
      this.invDropBtn.setVisible(item.type !== 'quest');
    } else {
      this.invDetailName.setText('');
      this.invDetailRarity.setText('');
      this.invDetailDesc.setText('选择一个物品查看详情');
      this.invUseBtn.setVisible(false);
      this.invEquipBtn.setVisible(false);
      this.invDropBtn.setVisible(false);
      if (this.invCompareText) this.invCompareText.setVisible(false);
    }

    // Highlight selected slot
    this.invSlots.forEach(({ cell }, i) => {
      if (i === slotIndex) {
        cell.setStrokeStyle(2, 0xffffff);
      } else {
        this.restoreSlotBorder(i);
      }
    });
  },

  restoreSlotBorder(gridIndex) {
    const inv = this.gameScene?.inventory;
    if (!inv || !this.invSlots[gridIndex]) return;

    const actualSlot = this._actualSlot(gridIndex);
    const item = actualSlot >= 0 ? inv.getSlot(actualSlot) : null;
    const cell = this.invSlots[gridIndex].cell;

    if (gridIndex === this.invSelectedSlot) {
      cell.setStrokeStyle(2, 0xffffff);
      return;
    }

    if (item) {
      const rarity = this.RARITY_COLORS[item.rarity] || this.RARITY_COLORS.common;
      cell.setStrokeStyle(1, rarity.border);
    } else {
      cell.setStrokeStyle(1, 0x666666);
    }
  },

  useSelectedItem() {
    const inv = this.gameScene?.inventory;
    if (!inv || this.invSelectedSlot < 0) return;
    const actualSlot = this._actualSlot(this.invSelectedSlot);
    if (actualSlot < 0) return;
    inv.useItem(actualSlot);
    this.refreshInventoryTab();
    this.selectInventoryItem(this.invSelectedSlot);
  },

  dropSelectedItem() {
    const inv = this.gameScene?.inventory;
    if (!inv || this.invSelectedSlot < 0) return;
    const actualSlot = this._actualSlot(this.invSelectedSlot);
    if (actualSlot < 0) return;
    inv.removeItem(actualSlot, 1);
    this.refreshInventoryTab();
    this.selectInventoryItem(this.invSelectedSlot);
  },

  equipSelectedItem() {
    const equip = this.gameScene?.equipmentSystem;
    if (!equip || this.invSelectedSlot < 0) return;
    const actualSlot = this._actualSlot(this.invSelectedSlot);
    if (actualSlot < 0) return;
    const success = equip.equipFromInventory(actualSlot);
    if (success) {
      this.refreshInventoryTab();
      this.refreshCharacterTab();
      this.selectInventoryItem(this.invSelectedSlot);
    }
  },

  showItemTooltip(gridIndex, x, y) {
    const inv = this.gameScene?.inventory;
    if (!inv) return;
    const actualSlot = this._actualSlot(gridIndex);
    const item = actualSlot >= 0 ? inv.getSlot(actualSlot) : null;
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
  },

  showContextMenu(gridIndex, pointer) {
    const inv = this.gameScene?.inventory;
    if (!inv) return;
    const actualSlot = this._actualSlot(gridIndex);
    const item = actualSlot >= 0 ? inv.getSlot(actualSlot) : null;
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

    if (item.type === 'consumable') addOption('使用', '#44cc44', () => { inv.useItem(actualSlot); this.refreshInventoryTab(); });
    if (item.type !== 'quest') addOption('丢弃', '#cc4444', () => { inv.removeItem(actualSlot, 1); this.refreshInventoryTab(); });

    bg.setSize(80, optionY + 4);

    this.contextMenu.setPosition(menuX, menuY);
    this.contextMenu.setVisible(true);

    // Close context menu on any click elsewhere
    this.input.once('pointerdown', () => {
      if (this.contextMenu) this.contextMenu.setVisible(false);
    });
  }
};
