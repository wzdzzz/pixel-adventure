import { AFFIXES } from '../../data/affixes.js';
import { RARITY_MULTIPLIERS } from '../../data/lootTables.js';
import { GEMS } from '../../data/gems.js';
import { SETS } from '../../data/sets.js';
import itemData from '../../data/items.json';

const RARITY_LABEL = {
  common:'普通', uncommon:'优秀', rare:'稀有',
  epic:'史诗', legendary:'传说', mythic:'神话'
};

function formatEquipTooltip(item) {
  const lines = [];
  const enh = item.enhanceLevel ? ` +${item.enhanceLevel}` : '';
  lines.push(`${item.name}${enh}`);
  lines.push(`[${RARITY_LABEL[item.rarity] || '普通'}] Lv.${item.level || 1}`);
  if (item.weaponType) {
    const wt = { heavy:'战士', light:'弓箭手', magic:'法师' }[item.weaponType] || '';
    if (wt) lines.push(`职业: ${wt}`);
  }
  // 基础属性（含 rarity × level × enhance 缩放）
  if (item.baseStats && Object.keys(item.baseStats).length) {
    const rarityMult = RARITY_MULTIPLIERS[item.rarity] || 1.0;
    const lvlMult = 1 + 0.1 * (item.level || 1);
    const enhMult = 1 + 0.05 * (item.enhanceLevel || 0);
    const total = rarityMult * lvlMult * enhMult;
    lines.push('— 基础属性 —');
    for (const [k, v] of Object.entries(item.baseStats)) {
      lines.push(`  ${k} +${(v * total).toFixed(1)}`);
    }
  }
  // 词条
  if (item.affixes && item.affixes.length) {
    lines.push('— 词条 —');
    for (const a of item.affixes) {
      const def = AFFIXES[a.id];
      if (!def) continue;
      if (def.stat === '_trigger' && def.trigger) {
        lines.push(`  ✨ ${def.name}: ${(def.trigger.chance*100).toFixed(0)}% 触发`);
      } else {
        const v = def.isFlat ? a.value.toFixed(1) : `${(a.value * 100).toFixed(1)}%`;
        lines.push(`  T${def.tier} ${def.name}: ${v}`);
      }
    }
  }
  // 孔位
  if (item.sockets && item.sockets.length) {
    lines.push('— 孔位 —');
    item.sockets.forEach((s, i) => {
      if (s.gemId) {
        const gem = GEMS[s.gemId];
        lines.push(`  孔${i+1}: ${gem?.icon || '◆'} ${gem?.name || s.gemId} Lv.${s.gemLevel}`);
      } else {
        lines.push(`  孔${i+1}: ⬜ 空`);
      }
    });
  }
  // 套装归属
  const setId = item.setId || itemData.items[item.templateId]?.setId;
  if (setId && SETS[setId]) {
    lines.push(`🔗 套装: ${SETS[setId].name} (1/${SETS[setId].pieces.length})`);
  }
  // 保底进度
  if (item.reforgePity && item.reforgePity > 0) {
    lines.push(`♻ 洗练保底: ${item.reforgePity}/5`);
  }
  if (item.description) lines.push(`\n${item.description}`);
  return lines.join('\n');
}

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

    // 批量拆解按钮（位于金币左侧）
    const bulkBtn = this.add.text(this.panelLeft + contentW - 90, filterY, '[🪓 批量拆解]', {
      fontSize: '11px', fill: '#66ccff', fontFamily: 'Courier New',
      backgroundColor: '#1a2a3a', padding: { x: 6, y: 3 }
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    bulkBtn.on('pointerdown', () => {
      this.openBulkDecomposeModal?.();
    });
    bulkBtn.on('pointerover', () => bulkBtn.setColor('#aaddff'));
    bulkBtn.on('pointerout', () => bulkBtn.setColor('#66ccff'));
    container.add(bulkBtn);

    // 制作按钮（bulkBtn 左侧，因 bulkBtn 是右锚定，需向左偏移）
    const craftBtn = this.add.text(bulkBtn.x - bulkBtn.width - 10, filterY, '[🛠 制作]', {
      fontSize: '11px', fill: '#88ddaa', fontFamily: 'Courier New',
      backgroundColor: '#1a3a2a', padding: { x: 6, y: 3 }
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    craftBtn.on('pointerdown', () => this.openCraftModal?.());
    craftBtn.on('pointerover', () => craftBtn.setColor('#bbeecc'));
    craftBtn.on('pointerout', () => craftBtn.setColor('#88ddaa'));
    container.add(craftBtn);

    // 合成按钮（craftBtn 左侧）
    const fuseBtn = this.add.text(craftBtn.x - craftBtn.width - 10, filterY, '[💎 合成]', {
      fontSize: '11px', fill: '#ffdd66', fontFamily: 'Courier New',
      backgroundColor: '#3a2a1a', padding: { x: 6, y: 3 }
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    fuseBtn.on('pointerdown', () => this.openGemFusionModal?.());
    fuseBtn.on('pointerover', () => fuseBtn.setColor('#ffeeaa'));
    fuseBtn.on('pointerout', () => fuseBtn.setColor('#ffdd66'));
    container.add(fuseBtn);

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

    // 强化按钮（仅装备显示）
    this.invEnhanceBtn = this.add.text(this.panelLeft + contentW - 90, detailY + 78, '[🔨 强化]', {
      fontSize: '12px', fill: '#ffdd66', fontFamily: 'Courier New'
    }).setInteractive({ useHandCursor: true }).setVisible(false);
    this.invEnhanceBtn.on('pointerdown', () => {
      if (this.invSelectedSlot < 0) return;
      const actualSlot = this._actualSlot(this.invSelectedSlot);
      if (actualSlot >= 0) this.openEnhanceModal?.(actualSlot);
    });
    container.add(this.invEnhanceBtn);

    // 分解按钮（仅装备显示）
    this.invDecomposeBtn = this.add.text(this.panelLeft + contentW - 90, detailY + 100, '[🪓 分解]', {
      fontSize: '12px', fill: '#ff8866', fontFamily: 'Courier New'
    }).setInteractive({ useHandCursor: true }).setVisible(false);
    this.invDecomposeBtn.on('pointerdown', () => {
      if (this.invSelectedSlot < 0) return;
      const actualSlot = this._actualSlot(this.invSelectedSlot);
      if (actualSlot >= 0) this.openDecomposeModal?.(actualSlot);
    });
    container.add(this.invDecomposeBtn);

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
      const rarityColor = this.RARITY_COLORS[item.rarity] || this.RARITY_COLORS.common;

      const enhSuffix = item.type === 'equipment' && item.enhanceLevel ? ` +${item.enhanceLevel}` : '';
      this.invDetailName.setText(item.name + enhSuffix);
      this.invDetailName.setColor('#' + rarityColor.border.toString(16).padStart(6, '0'));
      this.invDetailRarity.setText(`[${RARITY_LABEL[item.rarity] || '普通'}] Lv.${item.level || 1}  数量: ${item.quantity}`);
      // 装备：详细多行（覆盖 invDetailDesc）
      if (item.type === 'equipment') {
        this.invDetailDesc.setText(formatEquipTooltip(item));
      } else {
        this.invDetailDesc.setText(item.description || '');
      }

      // Equipment stat comparison
      if (item.type === 'equipment' && this.invCompareText) {
        // 装备：长描述压住 compareText 区域，隐藏 compare 避免重叠
        this.invCompareText.setVisible(false);
      } else if (this.invCompareText) {
        this.invCompareText.setVisible(false);
      }

      this.invUseBtn.setVisible(item.type === 'consumable');
      this.invEquipBtn.setVisible(item.type === 'equipment');
      this.invDropBtn.setVisible(item.type !== 'quest');
      this.invEnhanceBtn?.setVisible(item.type === 'equipment');
      this.invDecomposeBtn?.setVisible(item.type === 'equipment');
    } else {
      this.invDetailName.setText('');
      this.invDetailRarity.setText('');
      this.invDetailDesc.setText('选择一个物品查看详情');
      this.invUseBtn.setVisible(false);
      this.invEquipBtn.setVisible(false);
      this.invDropBtn.setVisible(false);
      this.invEnhanceBtn?.setVisible(false);
      this.invDecomposeBtn?.setVisible(false);
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

    if (item.type === 'equipment') {
      this.tooltipText.setText(formatEquipTooltip(item));
    } else {
      this.tooltipText.setText(
        `${item.name}\n[${RARITY_LABEL[item.rarity] || '普通'}] Lv.${item.level || 1}\n${item.description || ''}\n数量: ${item.quantity}${item.sellPrice > 0 ? '\n售价: ' + item.sellPrice : ''}`
      );
    }
    // tooltipBg 自适应文本大小
    if (this.tooltipBg) {
      const b = this.tooltipText.getBounds();
      this.tooltipBg.setSize(b.width + 16, b.height + 12);
    }
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

    const bg = this.add.rectangle(0, 0, 120, 0, 0x2a2a3e, 0.95)
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
    // 装备：加装备/强化/洗练/镶嵌/分解
    if (item.type === 'equipment') {
      addOption('⚔ 装备', '#88ccff', () => {
        const equip = this.gameScene?.equipmentSystem;
        if (!equip) return;
        const success = equip.equipFromInventory(actualSlot);
        if (success) {
          this.refreshInventoryTab();
          this.refreshCharacterTab?.();
        }
      });
      addOption('🔨 强化', '#ffdd66', () => this.openEnhanceModal?.(actualSlot));
      addOption('♻ 洗练', '#66ccff', () => this.openReforgeModal?.(item));
      if (item.sockets && item.sockets.length > 0) {
        addOption('💎 镶嵌', '#aa88ff', () => this.openSocketModal?.(item));
      }
      addOption('🪓 分解', '#ff8866', () => this.openDecomposeModal?.(actualSlot));
    }
    // 宝石：合成入口
    if (item.type === 'gem') {
      addOption('✨ 合成', '#ffdd66', () => this.openGemFusionModal?.());
    }
    if (item.type !== 'quest') addOption('丢弃', '#cc4444', () => { inv.removeItem(actualSlot, 1); this.refreshInventoryTab(); });

    bg.setSize(120, optionY + 4);

    this.contextMenu.setPosition(menuX, menuY);
    this.contextMenu.setVisible(true);

    // Close context menu on any click elsewhere
    this.input.once('pointerdown', () => {
      if (this.contextMenu) this.contextMenu.setVisible(false);
    });
  }
};
