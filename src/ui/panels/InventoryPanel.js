import { AFFIXES } from '../../data/affixes.js';
import { RARITY_MULTIPLIERS } from '../../data/lootTables.js';
import { GEMS } from '../../data/gems.js';
import { SETS, countSetPieces } from '../../data/sets.js';
import itemData from '../../data/items.json';
import { EQUIPMENT_SLOT_LABELS, RARITY_LABELS, STAT_LABELS, THEME_CONFIG, WEAPON_TYPE_LABELS } from '../../config/themeConfig.js';
import { RARITY_THEME, UI_THEME } from '../../config/uiTheme.js';

const RARITY_LABEL = RARITY_LABELS;

const STAT_LABEL = {
  attack:'攻击', defense:'防御', maxHp:'气血', maxMp:'灵力',
  spellPower:'术法强度', moveSpeed:'移速', attackSpeed:'攻速',
  hpRegen:'气血恢复', critDmg:'暴伤', critRate:'暴击', armorPen:'破防',
  tenacity:'韧性', cdr:'冷缩', lifesteal:'吸血',
  con:STAT_LABELS.con, str:STAT_LABELS.str, int:STAT_LABELS.int,
  agi:STAT_LABELS.agi, per:STAT_LABELS.per, lck:STAT_LABELS.lck
};

function formatEquipTooltip(item, equippedSetCount) {
  const lines = [];
  const enh = item.enhanceLevel ? ` +${item.enhanceLevel}` : '';
  lines.push(`${item.name}${enh}`);
  lines.push(`[${RARITY_LABEL[item.rarity] || RARITY_LABEL.common}] Lv.${item.level || 1}`);
  if (item.slot) {
    const slotLabel = EQUIPMENT_SLOT_LABELS[item.slot] || item.slot;
    lines.push(`部位: ${slotLabel}`);
  }
  if (item.weaponType) {
    const wt = WEAPON_TYPE_LABELS[item.weaponType] || '';
    if (wt) lines.push(`器物: ${wt}`);
  }
  // 基础属性（含 rarity × level × enhance 缩放）
  if (item.baseStats && Object.keys(item.baseStats).length) {
    const rarityMult = RARITY_MULTIPLIERS[item.rarity] || 1.0;
    const lvlMult = 1 + 0.1 * (item.level || 1);
    const enhMult = 1 + 0.05 * (item.enhanceLevel || 0);
    const total = rarityMult * lvlMult * enhMult;
    lines.push('— 基础属性 —');
    const baseMult = rarityMult * lvlMult;
    for (const [k, v] of Object.entries(item.baseStats)) {
      const baseVal = (v * baseMult).toFixed(1);
      const enhBonus = v * baseMult * ((item.enhanceLevel || 0) * 0.05);
      const enhText = enhBonus > 0 ? `(+${enhBonus.toFixed(1)})` : '';
      lines.push(`  ${STAT_LABEL[k] || k} +${baseVal}${enhText}`);
    }
  }
  // 词条
  if (item.affixes && item.affixes.length) {
    lines.push('— 词条 —');
    for (const a of item.affixes) {
      const def = AFFIXES[a.id];
      if (!def) continue;
      if (def.stat === '_trigger' && def.trigger) {
        lines.push(`  ${def.name}: ${(def.trigger.chance*100).toFixed(0)}% 触发`);
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
        const val = gem ? gem.baseValue * (s.gemLevel || 1) : 0;
        const statName = STAT_LABEL[gem?.stat] || gem?.stat || '';
        const valText = gem?.stat === 'critRate'
          ? `+${val.toFixed(1)}% ${statName}`
          : `+${val} ${statName}`;
        lines.push(`  孔${i+1}: ${gem?.icon || '◆'} ${gem?.name || s.gemId} Lv.${s.gemLevel} (${valText})`);
      } else {
        lines.push(`  孔${i+1}: ⬜ 空`);
      }
    });
  }
  // 套装效果
  const setId = item.setId || itemData.items[item.templateId]?.setId;
  if (setId && SETS[setId]) {
    const setDef = SETS[setId];
    const cnt = equippedSetCount ?? 0;
    const cntText = cnt > 0 ? ` (已装备${cnt}件)` : '';
    lines.push(`— 🔗 ${setDef.name}${cntText} —`);
    for (const tier of [2, 4, 6]) {
      const b = setDef.bonuses[tier];
      if (!b) continue;
      const active = cnt >= tier;
      const mark = active ? '✓' : '○';
      lines.push(`  ${mark} (${tier})件: ${b.label}`);
    }
  }
  // 保底进度
  if (item.reforgePity && item.reforgePity > 0) {
    lines.push(`洗练保底: ${item.reforgePity}/5`);
  }
  if (item.description) lines.push(`\n${item.description}`);
  return lines.join('\n');
}

/** 计算装备有效属性数值（用于对比） */
function calcEquipStats(item) {
  if (!item) return {};
  const stats = {};
  if (item.baseStats) {
    const m = (RARITY_MULTIPLIERS[item.rarity] || 1) * (1 + 0.1 * (item.level || 1)) * (1 + 0.05 * (item.enhanceLevel || 0));
    for (const [k, v] of Object.entries(item.baseStats)) {
      stats[k] = (stats[k] || 0) + v * m;
    }
  }
  if (item.affixes) {
    for (const a of item.affixes) {
      const def = AFFIXES[a.id];
      if (!def || def.stat === '_trigger') continue;
      if (def.stat.startsWith('_base_')) {
        const base = def.stat.replace('_base_', '');
        stats[base] = (stats[base] || 0) + a.value;
      } else {
        const key = def.isFlat ? def.stat : `${def.stat}%`;
        stats[key] = (stats[key] || 0) + a.value;
      }
    }
  }
  if (item.sockets) {
    for (const s of item.sockets) {
      if (!s.gemId) continue;
      const gem = GEMS[s.gemId];
      if (!gem) continue;
      const v = gem.baseValue * (s.gemLevel || 1);
      const key = gem.isFlat ? gem.stat : `${gem.stat}%`;
      stats[key] = (stats[key] || 0) + v;
    }
  }
  return stats;
}

/** 生成装备对比文本 */
function formatEquipCompare(newItem, equippedItem) {
  if (!equippedItem) return '当前槽位: 空';
  const lines = [];
  const enh = equippedItem.enhanceLevel ? ` +${equippedItem.enhanceLevel}` : '';
  lines.push(`当前: ${equippedItem.name}${enh}`);
  lines.push(`[${RARITY_LABEL[equippedItem.rarity] || RARITY_LABEL.common}] Lv.${equippedItem.level || 1}`);
  lines.push('');

  const ns = calcEquipStats(newItem);
  const cs = calcEquipStats(equippedItem);
  const allKeys = [...new Set([...Object.keys(ns), ...Object.keys(cs)])];
  if (allKeys.length) {
    lines.push('— 属性差异 —');
    for (const k of allKeys) {
      const nv = ns[k] || 0;
      const cv = cs[k] || 0;
      const diff = nv - cv;
      if (Math.abs(diff) < 0.05) continue;
      const isPct = k.endsWith('%');
      const label = STAT_LABEL[isPct ? k.slice(0, -1) : k] || k;
      if (isPct) {
        lines.push(`  ${label}: ${diff > 0 ? '+' : ''}${(diff * 100).toFixed(1)}% ${diff > 0 ? '▲' : '▼'}`);
      } else {
        lines.push(`  ${label}: ${diff > 0 ? '+' : ''}${diff.toFixed(1)} ${diff > 0 ? '▲' : '▼'}`);
      }
    }
  }
  return lines.join('\n');
}

/** 获取装备所属套装的已装备件数 */
function getSetCount(equipSys, item) {
  if (!equipSys || !item) return 0;
  const setId = item.setId || itemData.items[item.templateId]?.setId;
  if (!setId) return 0;
  const counts = countSetPieces(equipSys.slots, itemData.items);
  return counts[setId] || 0;
}

export { formatEquipTooltip, calcEquipStats, getSetCount, STAT_LABEL };

export const InventoryPanel = {
  createInventoryTab() {
    // 重置右键菜单引用（PanelScene 重开时旧容器已销毁）
    this.contextMenu = null;
    this._invCtxDismiss = null;

    const container = this.add.container(0, 0).setDepth(5).setVisible(false);
    this.tabContainers.inventory = container;

    const contentTop = this.panelTop + 50;
    const contentW = this.panelW - 20;
    const contentH = this.panelH - 60;

    // Content background
    const contentBg = this.add.rectangle(
      this.panelX, contentTop + contentH / 2,
      contentW, contentH, UI_THEME.colors.backdrop, 0.88
    ).setStrokeStyle(1, UI_THEME.colors.borderMuted);
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
      fontSize: '14px', fill: UI_THEME.text.muted, fontFamily: UI_THEME.font.body
    });
    container.add(filterLabel);

    filterTypes.forEach((ft, i) => {
      const btn = this.add.text(this.panelLeft + 65 + i * 55, filterY, `[${ft.label}]`, {
        fontSize: '14px', fill: ft.key === 'all' ? UI_THEME.text.jadeBright : UI_THEME.text.disabled, fontFamily: UI_THEME.font.body
      }).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.invActiveFilter = ft.key;
        this.invFilterButtons.forEach((b, j) => {
          b.setColor(filterTypes[j].key === ft.key ? UI_THEME.text.jadeBright : UI_THEME.text.disabled);
        });
        this.refreshInventoryTab();
      });

      this.invFilterButtons.push(btn);
      container.add(btn);
    });

    // --- Sort buttons + Gold display ---
    const sortY = contentTop + 38;
    const sortLabel = this.add.text(this.panelLeft + 20, sortY, '排序:', {
      fontSize: '14px', fill: UI_THEME.text.muted, fontFamily: UI_THEME.font.body
    });
    container.add(sortLabel);

    const sortTypes = [
      { key: 'level', label: '等级▼' },
      { key: 'type', label: '种类' },
      { key: 'rarity', label: '品质' }
    ];
    sortTypes.forEach((st, i) => {
      const btn = this.add.text(this.panelLeft + 65 + i * 65, sortY, `[${st.label}]`, {
        fontSize: '14px', fill: UI_THEME.text.disabled, fontFamily: UI_THEME.font.body
      }).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        const inv = this.gameScene?.inventory;
        if (inv) {
          inv.sortBy(st.key);
          this.refreshInventoryTab();
        }
      });
      btn.on('pointerover', () => btn.setColor(UI_THEME.text.jadeBright));
      btn.on('pointerout', () => btn.setColor(UI_THEME.text.disabled));
      container.add(btn);
    });

    // Gold display
    this.invGoldText = this.add.text(this.panelLeft + contentW - 10, sortY, `${THEME_CONFIG.currency}: 0`, {
      fontSize: '14px', fill: UI_THEME.text.brass, fontFamily: UI_THEME.font.body
    }).setOrigin(1, 0);
    container.add(this.invGoldText);

    // 批量拆解按钮（位于金币左侧）
    const bulkBtn = this.add.text(this.panelLeft + contentW - 90, filterY, '[批量拆解]', {
      fontSize: '14px', fill: UI_THEME.text.cinnabarBright, fontFamily: UI_THEME.font.body,
      backgroundColor: '#192b24', padding: { x: 6, y: 3 }
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    bulkBtn.on('pointerdown', () => {
      this.openBulkDecomposeModal?.();
    });
    bulkBtn.on('pointerover', () => bulkBtn.setColor(UI_THEME.text.paper));
    bulkBtn.on('pointerout', () => bulkBtn.setColor(UI_THEME.text.cinnabarBright));
    container.add(bulkBtn);

    // 制作按钮（bulkBtn 左侧，因 bulkBtn 是右锚定，需向左偏移）
    const craftBtn = this.add.text(bulkBtn.x - bulkBtn.width - 10, filterY, '[炼制]', {
      fontSize: '14px', fill: UI_THEME.text.jade, fontFamily: UI_THEME.font.body,
      backgroundColor: '#192b24', padding: { x: 6, y: 3 }
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    craftBtn.on('pointerdown', () => this.openCraftModal?.());
    craftBtn.on('pointerover', () => craftBtn.setColor(UI_THEME.text.jadeBright));
    craftBtn.on('pointerout', () => craftBtn.setColor(UI_THEME.text.jade));
    container.add(craftBtn);

    // 合成按钮（craftBtn 左侧）
    const fuseBtn = this.add.text(craftBtn.x - craftBtn.width - 10, filterY, '[合成]', {
      fontSize: '14px', fill: UI_THEME.text.brass, fontFamily: UI_THEME.font.body,
      backgroundColor: '#192b24', padding: { x: 6, y: 3 }
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    fuseBtn.on('pointerdown', () => this.openGemFusionModal?.());
    fuseBtn.on('pointerover', () => fuseBtn.setColor(UI_THEME.text.paper));
    fuseBtn.on('pointerout', () => fuseBtn.setColor(UI_THEME.text.brass));
    container.add(fuseBtn);

    // --- 11x9 Grid (99 slots) ---
    const cols = 11;
    const rows = 9;
    const cellSize = 40;
    const gap = 3;
    const gridW = cols * (cellSize + gap) - gap;
    const gridStartX = this.panelX - gridW / 2;
    const gridStartY = contentTop + 65;

    this.RARITY_COLORS = RARITY_THEME;

    this.invSlots = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = gridStartX + col * (cellSize + gap) + cellSize / 2;
        const y = gridStartY + row * (cellSize + gap) + cellSize / 2;
        const slotIndex = row * cols + col;

        const cell = this.add.rectangle(x, y, cellSize, cellSize, RARITY_THEME.common.bg, 0.8)
          .setStrokeStyle(1, RARITY_THEME.common.border)
          .setInteractive({ useHandCursor: true });

        // Item icon placeholder (text-based since we use generated textures)
        const icon = this.add.text(x, y - 4, '', {
          fontSize: '18px', fill: UI_THEME.text.paper, fontFamily: UI_THEME.font.body
        }).setOrigin(0.5).setVisible(false);

        // Quantity badge
        const countText = this.add.text(x + cellSize / 2 - 4, y + cellSize / 2 - 4, '', {
          fontSize: '14px', fill: UI_THEME.text.paper, fontFamily: UI_THEME.font.mono,
          backgroundColor: '#00000088', padding: { x: 2, y: 0 }
        }).setOrigin(1, 1).setVisible(false);

        cell.on('pointerover', () => {
          cell.setStrokeStyle(2, UI_THEME.colors.jadeBright);
          this.showItemTooltip(slotIndex, x, y);
        });
        cell.on('pointerout', () => {
          this.restoreSlotBorder(slotIndex);
          this.hideTooltip();
        });
        cell.on('pointerdown', (pointer) => {
          if (pointer.button === 2) {
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
    const detailY = gridStartY + rows * (cellSize + gap) + 10;
    const detailH = contentTop + contentH - detailY - 10;

    const detailBg = this.add.rectangle(this.panelX, detailY + detailH / 2, contentW - 20, detailH, UI_THEME.colors.panelRaised, 0.9)
      .setStrokeStyle(1, UI_THEME.colors.borderMuted);
    container.add(detailBg);

    this.invDetailName = this.add.text(this.panelLeft + 30, detailY + 8, '', {
      fontSize: '16px', fill: UI_THEME.text.paper, fontFamily: UI_THEME.font.body, fontStyle: 'bold'
    });
    container.add(this.invDetailName);

    this.invDetailRarity = this.add.text(this.panelLeft + 30, detailY + 28, '', {
      fontSize: '13px', fill: UI_THEME.text.muted, fontFamily: UI_THEME.font.body
    });
    container.add(this.invDetailRarity);

    this.invDetailDesc = this.add.text(this.panelLeft + 30, detailY + 44, '', {
      fontSize: '13px', fill: UI_THEME.text.muted, fontFamily: UI_THEME.font.body,
      wordWrap: { width: (contentW - 120) / 2 - 20 }, lineSpacing: 1
    });
    container.add(this.invDetailDesc);

    // 对比栏（右半边：显示当前装备信息 + 属性差异）
    this.invCompareText = this.add.text(this.panelX + 10, detailY + 8, '', {
      fontSize: '13px', fill: UI_THEME.text.jadeBright, fontFamily: UI_THEME.font.body,
      lineSpacing: 1, wordWrap: { width: (contentW - 120) / 2 - 20 }
    }).setVisible(false);
    container.add(this.invCompareText);

    // Action buttons
    this.invUseBtn = this.add.text(this.panelLeft + contentW - 90, detailY + 12, '[使用]', {
      fontSize: '14px', fill: UI_THEME.text.jade, fontFamily: UI_THEME.font.body
    }).setInteractive({ useHandCursor: true }).setVisible(false);
    this.invUseBtn.on('pointerdown', () => this.useSelectedItem());
    container.add(this.invUseBtn);

    this.invDropBtn = this.add.text(this.panelLeft + contentW - 90, detailY + 34, '[丢弃]', {
      fontSize: '14px', fill: UI_THEME.text.cinnabar, fontFamily: UI_THEME.font.body
    }).setInteractive({ useHandCursor: true }).setVisible(false);
    this.invDropBtn.on('pointerdown', () => this.dropSelectedItem());
    container.add(this.invDropBtn);

    this.invEquipBtn = this.add.text(this.panelLeft + contentW - 90, detailY + 56, '[装备]', {
      fontSize: '14px', fill: UI_THEME.text.jadeBright, fontFamily: UI_THEME.font.body, fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true }).setVisible(false);
    this.invEquipBtn.on('pointerdown', () => this.equipSelectedItem());
    container.add(this.invEquipBtn);

    // 强化按钮（仅装备显示）
    this.invEnhanceBtn = this.add.text(this.panelLeft + contentW - 90, detailY + 78, '[强化]', {
      fontSize: '14px', fill: UI_THEME.text.brass, fontFamily: UI_THEME.font.body
    }).setInteractive({ useHandCursor: true }).setVisible(false);
    this.invEnhanceBtn.on('pointerdown', () => {
      if (this.invSelectedSlot < 0) return;
      const actualSlot = this._actualSlot(this.invSelectedSlot);
      if (actualSlot >= 0) this.openEnhanceModal?.(actualSlot);
    });
    container.add(this.invEnhanceBtn);

    // 分解按钮（仅装备显示）
    this.invDecomposeBtn = this.add.text(this.panelLeft + contentW - 90, detailY + 100, '[分解]', {
      fontSize: '14px', fill: UI_THEME.text.cinnabarBright, fontFamily: UI_THEME.font.body
    }).setInteractive({ useHandCursor: true }).setVisible(false);
    this.invDecomposeBtn.on('pointerdown', () => {
      if (this.invSelectedSlot < 0) return;
      const actualSlot = this._actualSlot(this.invSelectedSlot);
      if (actualSlot >= 0) this.openDecomposeModal?.(actualSlot);
    });
    container.add(this.invDecomposeBtn);

    // 镶嵌按钮（仅有孔位装备显示）
    this.invSocketBtn = this.add.text(this.panelLeft + contentW - 90, detailY + 122, '[镶嵌]', {
      fontSize: '14px', fill: UI_THEME.text.jadeBright, fontFamily: UI_THEME.font.body
    }).setInteractive({ useHandCursor: true }).setVisible(false);
    this.invSocketBtn.on('pointerdown', () => {
      if (this.invSelectedSlot < 0) return;
      const actualSlot = this._actualSlot(this.invSelectedSlot);
      if (actualSlot < 0) return;
      const item = this.gameScene?.inventory?.getSlot(actualSlot);
      if (item) this.openSocketModal?.(item);
    });
    container.add(this.invSocketBtn);

    this.invSelectedSlot = -1;

    // Context menu container (scene-level, high depth)
    this.contextMenu = this.add.container(0, 0).setDepth(30).setVisible(false);

    // 右键菜单已在 PanelScene.create() 和 gameConfig 中禁用
  },

  refreshInventoryTab() {
    const inv = this.gameScene?.inventory;
    if (!inv || !this.invSlots) return;

    // Update gold
    if (this.invGoldText) this.invGoldText.setText(`${THEME_CONFIG.currency}: ${inv.gold}`);

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
      potion: '药', mana_potion: '灵', heart: '丹', key: '钥', artifact: '符',
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
        cell.setFillStyle(RARITY_THEME.common.bg, 0.8);
        cell.setStrokeStyle(1, RARITY_THEME.common.border);
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
      this.invDetailRarity.setText(`[${RARITY_LABEL[item.rarity] || RARITY_LABEL.common}] Lv.${item.level || 1}  数量: ${item.quantity}`);
      // 装备：详细多行（覆盖 invDetailDesc）
      if (item.type === 'equipment') {
        const sc = getSetCount(this.gameScene?.equipmentSystem, item);
        this.invDetailDesc.setText(formatEquipTooltip(item, sc));
      } else {
        this.invDetailDesc.setText(item.description || '');
      }

      // 装备对比：在右侧显示当前穿戴的同部位装备信息
      if (item.type === 'equipment' && this.invCompareText) {
        const equipSys = this.gameScene?.equipmentSystem;
        let targetSlot = item.slot;
        // 戒指特殊处理
        if (targetSlot === 'ring1' || targetSlot === 'ring2') {
          targetSlot = equipSys?.slots?.['ring1'] ? 'ring2' : 'ring1';
        }
        const equipped = equipSys?.getSlot(targetSlot) || null;
        const compareStr = formatEquipCompare(item, equipped);
        this.invCompareText.setText(compareStr);
        this.invCompareText.setVisible(true);
      } else if (this.invCompareText) {
        this.invCompareText.setVisible(false);
      }

      this.invUseBtn.setVisible(item.type === 'consumable');
      this.invEquipBtn.setVisible(item.type === 'equipment');
      this.invDropBtn.setVisible(item.type !== 'quest');
      this.invEnhanceBtn?.setVisible(item.type === 'equipment');
      this.invDecomposeBtn?.setVisible(item.type === 'equipment');
      this.invSocketBtn?.setVisible(item.type === 'equipment' && Array.isArray(item.sockets) && item.sockets.length > 0);
    } else {
      this.invDetailName.setText('');
      this.invDetailRarity.setText('');
      this.invDetailDesc.setText('选择一个物品查看详情');
      this.invUseBtn.setVisible(false);
      this.invEquipBtn.setVisible(false);
      this.invDropBtn.setVisible(false);
      this.invEnhanceBtn?.setVisible(false);
      this.invDecomposeBtn?.setVisible(false);
      this.invSocketBtn?.setVisible(false);
      if (this.invCompareText) this.invCompareText.setVisible(false);
    }

    // Highlight selected slot
    this.invSlots.forEach(({ cell }, i) => {
      if (i === slotIndex) {
        cell.setStrokeStyle(2, UI_THEME.colors.jadeBright);
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
      cell.setStrokeStyle(2, UI_THEME.colors.jadeBright);
      return;
    }

    if (item) {
      const rarity = this.RARITY_COLORS[item.rarity] || this.RARITY_COLORS.common;
      cell.setStrokeStyle(1, rarity.border);
    } else {
      cell.setStrokeStyle(1, RARITY_THEME.common.border);
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
      this.events.emit('panel:refresh', 'character');
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

    const camW = this.cameras.main.width;
    const camH = this.cameras.main.height;

    if (item.type === 'equipment') {
      const equipSys = this.gameScene?.equipmentSystem;
      const sc = getSetCount(equipSys, item);

      // ——— 左面板：背包中的装备 ———
      this.tooltipText.setText(formatEquipTooltip(item, sc));
      const rarity = this.RARITY_COLORS[item.rarity] || this.RARITY_COLORS.common;
      this.tooltipBg.setStrokeStyle(1, rarity.border);
      this.tooltipBg.setSize(this.tooltipText.width + 16, this.tooltipText.height + 12);

      // 查找当前穿戴的同槽位装备
      let equipped = null;
      if (equipSys && item.slot) {
        let targetSlot = item.slot;
        if (targetSlot === 'ring1' || targetSlot === 'ring2') {
          targetSlot = equipSys.slots?.['ring1'] ? 'ring2' : 'ring1';
        }
        equipped = equipSys.getSlot(targetSlot);
      }

      if (equipped && this.tooltipContainer2) {
        // ——— 右面板：当前装备 + 属性差异 ———
        const esc = getSetCount(equipSys, equipped);
        let rightText = '当前装备\n' + formatEquipTooltip(equipped, esc);

        // 属性差异
        const ns = calcEquipStats(item);
        const cs = calcEquipStats(equipped);
        const allKeys = [...new Set([...Object.keys(ns), ...Object.keys(cs)])];
        let diffLines = '';
        for (const k of allKeys) {
          const diff = (ns[k] || 0) - (cs[k] || 0);
          if (Math.abs(diff) < 0.05) continue;
          const isPct = k.endsWith('%');
          const label = STAT_LABEL[isPct ? k.slice(0, -1) : k] || k;
          const sign = diff > 0 ? '+' : '';
          const arrow = diff > 0 ? '▲' : '▼';
          diffLines += isPct
            ? `\n  ${label}: ${sign}${(diff * 100).toFixed(1)}% ${arrow}`
            : `\n  ${label}: ${sign}${diff.toFixed(1)} ${arrow}`;
        }
        if (diffLines) rightText += '\n\n— 属性差异 —' + diffLines;

        this.tooltipText2.setText(rightText);
        const eqRarity = this.RARITY_COLORS[equipped.rarity] || this.RARITY_COLORS.common;
        this.tooltipBg2.setStrokeStyle(1, eqRarity.border);
        this.tooltipBg2.setSize(this.tooltipText2.width + 16, this.tooltipText2.height + 12);

        // 并排定位
        const lw = this.tooltipText.width + 16;
        const lh = this.tooltipText.height + 12;
        const rw = this.tooltipText2.width + 16;
        const rh = this.tooltipText2.height + 12;
        const gap = 6;
        let tx = x + 30, ty = y - 40;
        const totalW = lw + gap + rw;
        if (tx + totalW > camW) tx = camW - totalW - 4;
        if (tx < 4) tx = 4;
        const maxH = Math.max(lh, rh);
        if (ty + maxH > camH) ty = camH - maxH - 4;
        if (ty < 4) ty = 4;

        this.tooltipContainer.setPosition(tx, ty);
        this.tooltipContainer2.setPosition(tx + lw + gap, ty);
        this.tooltipContainer.setVisible(true);
        this.tooltipContainer2.setVisible(true);
      } else {
        // 没有装备对比，单窗口
        if (this.tooltipContainer2) this.tooltipContainer2.setVisible(false);
        let tx = x + 30, ty = y - 40;
        const tw = this.tooltipText.width + 16;
        const th = this.tooltipText.height + 12;
        if (tx + tw > camW) tx = x - tw - 30;
        if (ty + th > camH) ty = camH - th - 4;
        if (ty < 4) ty = 4;
        this.tooltipContainer.setPosition(tx, ty);
        this.tooltipContainer.setVisible(true);
      }
      return;
    }

    // ——— 非装备：单窗口 ———
    if (this.tooltipContainer2) this.tooltipContainer2.setVisible(false);
    this.tooltipBg.setStrokeStyle(1, UI_THEME.colors.brassMuted);
    this.tooltipText.setText(
      `${item.name}\n[${RARITY_LABEL[item.rarity] || RARITY_LABEL.common}] Lv.${item.level || 1}\n${item.description || ''}\n数量: ${item.quantity}${item.sellPrice > 0 ? `\n售价: ${item.sellPrice} ${THEME_CONFIG.currency}` : ''}`
    );
    this.tooltipBg.setSize(this.tooltipText.width + 16, this.tooltipText.height + 12);
    let tx = x + 30, ty = y - 40;
    if (tx + this.tooltipText.width + 16 > camW) tx = x - this.tooltipText.width - 30;
    if (ty + this.tooltipText.height + 12 > camH) ty = camH - this.tooltipText.height - 16;
    if (ty < 4) ty = 4;
    this.tooltipContainer.setPosition(tx, ty);
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

    const bg = this.add.rectangle(0, 0, 120, 0, UI_THEME.colors.panelRaised, 0.97)
      .setStrokeStyle(1, UI_THEME.colors.border).setOrigin(0, 0);
    this.contextMenu.add(bg);

    let optionY = 4;
    const addOption = (label, color, callback) => {
      const opt = this.add.text(8, optionY, label, {
        fontSize: '14px', fill: color, fontFamily: UI_THEME.font.body
      }).setInteractive({ useHandCursor: true });
      opt.on('pointerdown', () => {
        callback();
        this.contextMenu.setVisible(false);
      });
      opt.on('pointerover', () => opt.setColor(UI_THEME.text.paper));
      opt.on('pointerout', () => opt.setColor(color));
      this.contextMenu.add(opt);
      optionY += 20;
    };

    if (item.type === 'consumable') {
      addOption('使用', UI_THEME.text.jade, () => { inv.useItem(actualSlot); this.refreshInventoryTab(); });
      // 设置到快捷栏 F1-F4
      for (let si = 0; si < 4; si++) {
        const slotIdx = si;
        addOption(`设为快捷栏 F${si + 1}`, UI_THEME.text.muted, () => {
          const player = this.gameScene?.player;
          if (!player) return;
          player.itemSlots[slotIdx] = item.id;
          this.gameScene.events.emit('itemSlotsChanged');
        });
      }
    }
    // 装备：加装备/强化/洗练/镶嵌/分解
    if (item.type === 'equipment') {
      addOption('装备', UI_THEME.text.jadeBright, () => {
        const equip = this.gameScene?.equipmentSystem;
        if (!equip) return;
        const success = equip.equipFromInventory(actualSlot);
        if (success) {
          this.refreshInventoryTab();
          this.events.emit('panel:refresh', 'character');
        }
      });
      addOption('强化', UI_THEME.text.brass, () => this.openEnhanceModal?.(actualSlot));
      addOption('洗练', UI_THEME.text.jadeBright, () => this.openReforgeModal?.(item));
      if (item.sockets && item.sockets.length > 0) {
        addOption('镶嵌', UI_THEME.text.jade, () => this.openSocketModal?.(item));
      }
      addOption('分解', UI_THEME.text.cinnabarBright, () => this.openDecomposeModal?.(actualSlot));
    }
    // 宝石：合成入口
    if (item.type === 'gem') {
      addOption('合成', UI_THEME.text.brass, () => this.openGemFusionModal?.());
    }
    if (item.type !== 'quest') addOption('丢弃', UI_THEME.text.cinnabar, () => { inv.removeItem(actualSlot, 1); this.refreshInventoryTab(); });

    bg.setSize(120, optionY + 4);

    this.contextMenu.setPosition(menuX, menuY);
    this.contextMenu.setVisible(true);

    // Close context menu on any click elsewhere
    if (this._invCtxDismiss) {
      this.input.off('pointerdown', this._invCtxDismiss);
    }
    this.time.delayedCall(0, () => {
      this._invCtxDismiss = () => {
        if (this.contextMenu) this.contextMenu.setVisible(false);
        this.input.off('pointerdown', this._invCtxDismiss);
        this._invCtxDismiss = null;
      };
      this.input.on('pointerdown', this._invCtxDismiss);
    });
  }
};
