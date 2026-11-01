import { formatEquipTooltip, getSetCount } from './InventoryPanel.js';
import SystemRegistry from '../../core/SystemRegistry.js';
import { EQUIPMENT_SLOT_LABELS, STAT_LABELS } from '../../config/themeConfig.js';
import { UI_THEME } from '../../config/uiTheme.js';

export const CharacterPanel = {
  createCharacterTab() {
    // 重置右键菜单引用（PanelScene 重开时旧容器已销毁）
    this.charContextMenu = null;
    this._charCtxDismiss = null;

    const container = this.add.container(0, 0).setDepth(5).setVisible(false);
    this.tabContainers.character = container;

    // 双卡片布局：左=装备，右=属性
    const margin = 16;
    const gap = 12;
    const top = this.panelTop + 56 + 8;
    const bottom = this.panelTop + this.panelH - margin;
    const cardH = bottom - top;
    const colW = (this.panelW - margin * 2 - gap) / 2;
    const leftCardX = this.panelLeft + margin;
    const rightCardX = leftCardX + colW + gap;
    const pad = 20;

    this._addCard(container, leftCardX, top, colW, cardH);
    this._addCard(container, rightCardX, top, colW, cardH);

    // --- 左卡片：装备纸娃娃 ---
    this._addSectionTitle(container, leftCardX + pad, top + 16, '装备');

    const leftX = leftCardX + colW / 2;
    const previewY = top + 330;
    const preview = this.add.sprite(leftX, previewY, 'hero_00');
    preview.setDisplaySize(108, 150);
    if (this.anims.exists('hero_idle')) preview.play('hero_idle');
    container.add(preview);

    // 装备槽布局：4 行，第2-3排与武器/护甲列对齐，不挡人物
    const rowGap = 92;
    const colGap = 122;
    const cellSize = 54;
    const slotMapping = [
      { slot: 'weapon',   x: -colGap, y: -rowGap * 1.5 },
      { slot: 'helmet',   x: 0,       y: -rowGap * 1.5 },
      { slot: 'armor',    x: colGap,  y: -rowGap * 1.5 },
      { slot: 'offhand',  x: -colGap, y: -rowGap * 0.5 },
      { slot: 'necklace', x: colGap,  y: -rowGap * 0.5 },
      { slot: 'ring1',    x: -colGap, y: rowGap * 0.5 },
      { slot: 'ring2',    x: colGap,  y: rowGap * 0.5 },
      { slot: 'boots',    x: 0,       y: rowGap * 1.5 }
    ];

    this.equipSlotUI = {};
    const SLOT_ICONS = {
      weapon: '器', offhand: '符', helmet: '冠', armor: '袍',
      boots: '履', necklace: '佩', ring1: '戒', ring2: '戒'
    };

    slotMapping.forEach(def => {
      const sx = leftX + def.x;
      const sy = previewY + def.y;

      const cell = this.add.rectangle(sx, sy, cellSize, cellSize, UI_THEME.colors.ink, 0.6)
        .setStrokeStyle(1, UI_THEME.colors.borderMuted).setInteractive({ useHandCursor: true });
      const icon = this.add.text(sx, sy, SLOT_ICONS[def.slot], {
        fontSize: '20px', fill: UI_THEME.text.disabled, fontFamily: UI_THEME.font.body
      }).setOrigin(0.5);
      const label = this.add.text(sx, sy + cellSize / 2 + 12, EQUIPMENT_SLOT_LABELS[def.slot], {
        fontSize: '12px', fill: UI_THEME.text.disabled, fontFamily: UI_THEME.font.body
      }).setOrigin(0.5);

      cell.on('pointerdown', (pointer) => {
        const equip = SystemRegistry.get('equipmentSystem');
        if (!equip) return;
        const equipped = equip.getSlot(def.slot);
        if (!equipped) return;

        // 右键 → 弹出菜单
        if (pointer.button === 2 || pointer.rightButtonDown()) {
          this._showCharContextMenu(def.slot, equipped, pointer);
          return;
        }
        // 左键 → 卸下
        equip.unequipToInventory(def.slot);
        this.refreshCharacterTab();
        this.events.emit('panel:refresh', 'inventory');
      });

      // 备用右键监听（某些 Phaser 版本 pointerdown 不传 button=2）
      cell.on('pointerup', (pointer) => {
        if (pointer.button === 2 || pointer.rightButtonDown()) {
          const equip = SystemRegistry.get('equipmentSystem');
          if (!equip) return;
          const equipped = equip.getSlot(def.slot);
          if (!equipped) return;
          this._showCharContextMenu(def.slot, equipped, pointer);
        }
      });

      cell.on('pointerover', () => {
        const equip = SystemRegistry.get('equipmentSystem');
        if (!equip) return;
        const equipped = equip.getSlot(def.slot);
        if (equipped) {
          this.showEquipTooltip(equipped, sx + 25, sy);
        }
      });

      cell.on('pointerout', () => {
        this.hideTooltip();
      });

      container.add([cell, icon, label]);
      this.equipSlotUI[def.slot] = { cell, icon };
    });

    // 等级 + 修为条（左卡片下部，居中）
    const xpBarY = previewY + rowGap * 1.5 + 96;
    this._xpBarW = 280;
    this.charLevelText = this.add.text(leftX - this._xpBarW / 2 - 14, xpBarY, 'LV.1', {
      fontSize: '17px', fill: UI_THEME.text.brass, fontFamily: UI_THEME.font.body, fontStyle: 'bold'
    }).setOrigin(1, 0.5);
    container.add(this.charLevelText);

    const xpBarBg = this.add.rectangle(leftX - this._xpBarW / 2, xpBarY, this._xpBarW, 14, UI_THEME.colors.ink)
      .setStrokeStyle(1, UI_THEME.colors.borderMuted).setOrigin(0, 0.5);
    container.add(xpBarBg);

    this.charXpBar = this.add.rectangle(leftX - this._xpBarW / 2 + 1, xpBarY, 0, 10, UI_THEME.colors.jade)
      .setOrigin(0, 0.5);
    container.add(this.charXpBar);

    this.charXpText = this.add.text(leftX, xpBarY, '0/40', {
      fontSize: '12px', fill: UI_THEME.text.paper, fontFamily: UI_THEME.font.mono
    }).setOrigin(0.5);
    container.add(this.charXpText);

    const equipHint = this.add.text(leftX, xpBarY + 34, '左键卸下 · 右键强化 / 洗练 / 镶嵌', {
      fontSize: '12px', fill: UI_THEME.text.disabled, fontFamily: UI_THEME.font.body
    }).setOrigin(0.5);
    container.add(equipHint);

    // --- 右卡片：属性 ---
    const contentX = rightCardX + pad;
    const contentW = colW - pad * 2;
    const valueRightX = rightCardX + colW - pad - 44;
    this._charSetsX = contentX;

    this._addSectionTitle(container, contentX, top + 16, '基础属性');

    const stats = ['con', 'str', 'int', 'agi', 'per', 'lck'];
    this.charStatValues = {};
    this.charStatPlusButtons = {};

    const statsY0 = top + 56;
    const statRowH = 36;
    stats.forEach((stat, i) => {
      const y = statsY0 + i * statRowH;

      const nameText = this.add.text(contentX, y, `${STAT_LABELS[stat]}  ${stat.toUpperCase()}`, {
        fontSize: '15px', fill: UI_THEME.text.paper, fontFamily: UI_THEME.font.body
      });

      const valueText = this.add.text(valueRightX, y, '0', {
        fontSize: '16px', fill: UI_THEME.text.paper, fontFamily: UI_THEME.font.mono
      }).setOrigin(1, 0);
      this.charStatValues[stat] = valueText;

      const plusBtn = this.add.text(rightCardX + colW - pad - 26, y - 3, '+', {
        fontSize: '16px', fill: UI_THEME.text.disabled, fontFamily: UI_THEME.font.body,
        backgroundColor: '#1b2f27', fixedWidth: 26, align: 'center', padding: { y: 3 }
      }).setInteractive({ useHandCursor: true });
      this.charStatPlusButtons[stat] = plusBtn;

      plusBtn.on('pointerdown', () => this.handleStatAllocation(stat));
      plusBtn.on('pointerover', () => {
        const ls = this.registry.get('levelSystem');
        if (ls && ls.statPoints > 0) plusBtn.setColor(UI_THEME.text.jadeBright);
      });
      plusBtn.on('pointerout', () => this.updatePlusButtonColors());

      nameText.setInteractive();
      nameText.on('pointerover', () => this.showStatTooltip(stat, nameText.x, nameText.y));
      nameText.on('pointerout', () => this.hideTooltip());

      container.add([nameText, valueText, plusBtn]);
    });

    const pointsY = statsY0 + 6 * statRowH + 4;
    this.charStatPointsText = this.add.text(contentX, pointsY, '可用属性点: 0', {
      fontSize: '14px', fill: UI_THEME.text.brass, fontFamily: UI_THEME.font.body
    });
    container.add(this.charStatPointsText);

    // --- 衍生属性（双列） ---
    const derivedY = pointsY + 34;
    this._addDivider(container, contentX, derivedY - 8, contentW);
    this.derivedExpanded = true;

    const derivedToggle = this.add.text(contentX, derivedY + 6, '▾ 衍生属性', {
      fontSize: '15px', fill: UI_THEME.text.paper, fontFamily: UI_THEME.font.body, fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true });
    container.add(derivedToggle);

    this.derivedContainer = this.add.container(0, 0);
    container.add(this.derivedContainer);

    const derivedStats = [
      { key: 'hp', label: '气血' },
      { key: 'stamina', label: '行气' },
      { key: 'attack', label: '攻击' },
      { key: 'spellPower', label: '术法强度' },
      { key: 'critRate', label: '暴击率' },
      { key: 'tenacity', label: '韧性' },
      { key: 'armorPen', label: '破甲' },
      { key: 'moveSpeed', label: '移速' },
      { key: 'dropBonus', label: '掉率加成' }
    ];

    this.charDerivedTexts = {};
    const halfW = contentW / 2;
    const derivedRowH = 28;
    const derivedRows = Math.ceil(derivedStats.length / 2);
    derivedStats.forEach((ds, i) => {
      const col = Math.floor(i / derivedRows);
      const row = i % derivedRows;
      const x = contentX + col * halfW;
      const y = derivedY + 38 + row * derivedRowH;
      const label = this.add.text(x, y, ds.label, {
        fontSize: '14px', fill: UI_THEME.text.muted, fontFamily: UI_THEME.font.body
      });
      const value = this.add.text(x + halfW - 24, y, '-', {
        fontSize: '14px', fill: UI_THEME.text.paper, fontFamily: UI_THEME.font.mono
      }).setOrigin(1, 0);
      this.charDerivedTexts[ds.key] = value;
      this.derivedContainer.add([label, value]);
    });

    derivedToggle.on('pointerdown', () => {
      this.derivedExpanded = !this.derivedExpanded;
      this.derivedContainer.setVisible(this.derivedExpanded);
      derivedToggle.setText(this.derivedExpanded ? '▾ 衍生属性' : '▸ 衍生属性');
    });

    // --- 已激活套装区 ---
    const setsY = derivedY + 38 + derivedRows * derivedRowH + 12;
    this._addDivider(container, contentX, setsY - 8, contentW);
    this.charSetsTitle = this._addSectionTitle(container, contentX, setsY + 6, '已激活套装');
    this.charSetsContainer = this.add.container(0, 0);
    container.add(this.charSetsContainer);

    this.refreshCharacterTab();
  },

  refreshActiveSets() {
    if (!this.charSetsContainer) return;
    this.charSetsContainer.removeAll(true);
    const equip = SystemRegistry.get('equipmentSystem');
    if (!equip || !equip.getActiveSets) return;
    const activeSets = equip.getActiveSets();

    const setsX = this._charSetsX || (this.panelLeft + this.panelW * 0.55);
    const baseY = this.charSetsTitle.y + 28;

    if (!activeSets.length) {
      const t = this.add.text(setsX, baseY, '（未装备任何套装）', {
        fontSize: '13px', fill: UI_THEME.text.disabled, fontFamily: UI_THEME.font.body
      });
      this.charSetsContainer.add(t);
      return;
    }

    let y = baseY;
    for (const setInfo of activeSets) {
      const head = this.add.text(setsX, y, `${setInfo.name}  ${setInfo.count}/${setInfo.total}`, {
        fontSize: '14px', fill: UI_THEME.text.brass, fontFamily: UI_THEME.font.body, fontStyle: 'bold'
      });
      this.charSetsContainer.add(head);
      y += 20;
      for (const tier of setInfo.allTiers) {
        const mark = tier.active ? '✓' : '○';
        const color = tier.active ? UI_THEME.text.jadeBright : UI_THEME.text.disabled;
        const t = this.add.text(setsX + 12, y, `${mark} ${tier.tier}件: ${tier.label}`, {
          fontSize: '13px', fill: color, fontFamily: UI_THEME.font.body
        });
        this.charSetsContainer.add(t);
        y += 17;
      }
      y += 6;
    }
  },

  refreshCharacterTab() {
    const player = this.gameScene?.player;
    const levelSystem = this.registry.get('levelSystem');
    if (!player || !levelSystem) return;

    // Update level + XP
    this.charLevelText.setText(`LV.${levelSystem.level}`);
    const xpReq = levelSystem.getXpRequired();
    const xpPct = Math.min(1, levelSystem.xp / xpReq);
    const barW = (this._xpBarW || 140) - 2;
    this.charXpBar.setSize(Math.max(1, barW * xpPct), 10);
    this.charXpText.setText(`${levelSystem.xp}/${xpReq}`);

    // Update base stats
    const stats = ['con', 'str', 'int', 'agi', 'per', 'lck'];
    stats.forEach(stat => {
      const val = Math.floor(player.stats.getEffective(stat));
      this.charStatValues[stat].setText(`${val}`);
    });

    // Update stat points
    this.charStatPointsText.setText(`可用属性点: ${levelSystem.statPoints}`);
    this.updatePlusButtonColors();

    // Update derived stats
    const derived = player.stats.getDerived();
    this.charDerivedTexts.hp.setText(`${player.hp}/${player.maxHp}`);
    this.charDerivedTexts.stamina.setText(`${Math.floor(player.stamina)}/${player.maxStamina}`);
    // 攻击力按职业主属性显示（与实战 player.getAttack 一致）
    this.charDerivedTexts.attack.setText(`${Math.floor(player.getAttack ? player.getAttack() : derived.attack)}`);
    this.charDerivedTexts.spellPower.setText(`${derived.spellPower}`);
    this.charDerivedTexts.critRate.setText(`${derived.critRate.toFixed(1)}%`);
    this.charDerivedTexts.tenacity.setText(`${derived.tenacity.toFixed(1)}`);
    this.charDerivedTexts.armorPen.setText(`${derived.armorPen.toFixed(1)}`);
    this.charDerivedTexts.moveSpeed.setText(`${derived.moveSpeed}`);
    this.charDerivedTexts.dropBonus.setText(`${derived.dropBonus.toFixed(1)}%`);

    // Update equipment slot visuals
    const equip = SystemRegistry.get('equipmentSystem');
    if (equip && this.equipSlotUI) {
      const SLOT_ICONS = {
        weapon: '器', offhand: '符', helmet: '冠', armor: '袍',
        boots: '履', necklace: '佩', ring1: '戒', ring2: '戒'
      };

      for (const [slotName, ui] of Object.entries(this.equipSlotUI)) {
        const item = equip.getSlot(slotName);
        if (item) {
          const rarity = this.RARITY_COLORS[item.rarity] || this.RARITY_COLORS.common;
          ui.cell.setFillStyle(rarity.bg, 0.95);
          ui.cell.setStrokeStyle(2, rarity.border);
          ui.icon.setText(SLOT_ICONS[slotName] || '?');
          ui.icon.setColor(rarity.text);
        } else {
          // 空槽：暗底 + 灰置位置图示
          ui.cell.setFillStyle(UI_THEME.colors.ink, 0.6);
          ui.cell.setStrokeStyle(1, UI_THEME.colors.borderMuted);
          ui.icon.setText(SLOT_ICONS[slotName] || '?');
          ui.icon.setColor(UI_THEME.text.disabled);
        }
      }
    }

    // Refresh derived stats if the method exists
    if (this.updateDerivedStats) this.updateDerivedStats();

    // 已激活套装
    this.refreshActiveSets();
  },

  handleStatAllocation(statName) {
    const levelSystem = this.registry.get('levelSystem');
    if (!levelSystem || levelSystem.statPoints <= 0) return;

    const player = this.gameScene?.player;
    if (!player) return;

    // Allocate
    if (levelSystem.allocateStat(statName)) {
      player.onHpChanged();

      // Show "+1" floating effect
      const valueText = this.charStatValues[statName];
      const floatText = this.add.text(valueText.x, valueText.y, '+1', {
        fontSize: '14px', fill: UI_THEME.text.jadeBright, fontFamily: UI_THEME.font.body, fontStyle: 'bold'
      }).setOrigin(0.5, 1).setDepth(25);

      this.tweens.add({
        targets: floatText,
        y: floatText.y - 25,
        alpha: 0,
        duration: 800,
        onComplete: () => floatText.destroy()
      });

      // Flash the value green briefly
      this.charStatValues[statName].setColor(UI_THEME.text.jadeBright);
      this.time.delayedCall(300, () => {
        if (this.charStatValues[statName]) this.charStatValues[statName].setColor(UI_THEME.text.paper);
      });

      this.refreshCharacterTab();
    }
  },

  updatePlusButtonColors() {
    const levelSystem = this.registry.get('levelSystem');
    const hasPoints = levelSystem && levelSystem.statPoints > 0;
    const stats = ['con', 'str', 'int', 'agi', 'per', 'lck'];
    stats.forEach(stat => {
      if (this.charStatPlusButtons[stat]) {
        this.charStatPlusButtons[stat].setColor(hasPoints ? UI_THEME.text.jade : UI_THEME.text.disabled);
      }
    });
  },

  showStatTooltip(stat, x, y) {
    if (!this.tooltipContainer) return;
    if (this.tooltipContainer2) this.tooltipContainer2.setVisible(false);

    const player = this.gameScene?.player;
    if (!player) return;

    this.tooltipBg.setStrokeStyle(1, UI_THEME.colors.brassMuted);
    const derived = player.stats.getDerived();
    const val = player.stats.getEffective(stat);

    const primaryStat = player.classConfig?.primaryAttackStat || 'str';
    const tooltips = {
      con: `体魄 (CON) = ${val}\n+${val * 10} 最大气血\n+${(val * 0.05).toFixed(2)}/s 气血恢复\n+${(val * 0.5).toFixed(1)} 韧性`,
      str: `力道 (STR) = ${val}` + (primaryStat === 'str' ? `\n+${val * 2} 攻击（主属性）` : '') + `\n+${(val * 0.2).toFixed(1)} 韧性\n+${(val * 0.3).toFixed(1)} 破甲`,
      int: `悟性 (INT) = ${val}\n+${val * 15} 最大灵力\n+${val} 术法强度` + (primaryStat === 'int' ? `\n+${val * 2} 攻击（主属性）` : '') + `\n+${(val * 0.2).toFixed(1)}% 冷却缩减`,
      agi: `身法 (AGI) = ${val}` + (primaryStat === 'agi' ? `\n+${val * 2} 攻击（主属性）` : '') + `\n+${val}% 攻击速度\n+${val * 20 + 40} 移动速度`,
      per: `神识 (PER) = ${val}\n+${(val * 0.5).toFixed(1)}% 暴击率\n+${(val * 0.5).toFixed(1)} 破甲`,
      lck: `机缘 (LCK) = ${val}\n+${(Math.sqrt(val) * 1).toFixed(1)}% 掉落加成`
    };

    this.tooltipText.setText(tooltips[stat] || '');
    this.tooltipBg.setSize(this.tooltipText.width + 16, this.tooltipText.height + 12);
    this.tooltipContainer.setPosition(x + 120, y - 10);
    this.tooltipContainer.setVisible(true);
  },

  _showCharContextMenu(slotName, equipped, pointer) {
    // 立即移除旧的关闭监听，防止它关掉即将显示的新菜单
    if (this._charCtxDismiss) {
      this.input.off('pointerdown', this._charCtxDismiss);
      this._charCtxDismiss = null;
    }

    if (!this.charContextMenu) {
      this.charContextMenu = this.add.container(0, 0).setDepth(30);
    }
    this.charContextMenu.removeAll(true);
    this.charContextMenu.setVisible(true);

    const bg = this.add.rectangle(0, 0, 120, 0, UI_THEME.colors.panelRaised, 0.97)
      .setStrokeStyle(1, UI_THEME.colors.border).setOrigin(0, 0);
    this.charContextMenu.add(bg);

    let optY = 4;
    const addOpt = (label, color, cb) => {
      const t = this.add.text(8, optY, label, {
        fontSize:'14px', fill:color, fontFamily:UI_THEME.font.body
      }).setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => { cb(); this.charContextMenu.setVisible(false); });
      t.on('pointerover', () => t.setColor(UI_THEME.text.paper));
      t.on('pointerout', () => t.setColor(color));
      this.charContextMenu.add(t);
      optY += 20;
    };

    // 强化（直接传 instance）
    addOpt('强化', UI_THEME.text.brass, () => this.openEnhanceModal?.(equipped));

    // 洗练
    addOpt('洗练', UI_THEME.text.jadeBright, () => this.openReforgeModal?.(equipped));

    // 镶嵌（仅当装备有插槽时）
    if (equipped.sockets && equipped.sockets.length > 0) {
      addOpt('镶嵌', UI_THEME.text.jade, () => this.openSocketModal?.(equipped));
    }

    // 卸下
    addOpt('卸下', UI_THEME.text.paper, () => {
      const equip = SystemRegistry.get('equipmentSystem');
      equip.unequipToInventory(slotName);
      this.refreshCharacterTab();
      this.events.emit('panel:refresh', 'inventory');
    });

    bg.setSize(120, optY + 4);
    this.charContextMenu.setPosition(pointer.x, pointer.y);

    // 下一帧注册关闭监听，避免当前事件冒泡立即触发
    this.time.delayedCall(0, () => {
      this._charCtxDismiss = (p) => {
        // 点击菜单项自身不触发（由菜单项的 pointerdown 处理）
        if (this.charContextMenu) this.charContextMenu.setVisible(false);
        this.input.off('pointerdown', this._charCtxDismiss);
        this._charCtxDismiss = null;
      };
      this.input.on('pointerdown', this._charCtxDismiss);
    });
  },

  showEquipTooltip(item, x, y) {
    if (!this.tooltipContainer) return;

    const sc = getSetCount(SystemRegistry.get('equipmentSystem'), item);
    const text = formatEquipTooltip(item, sc) + '\n\n左键卸下 | 右键菜单';
    this.tooltipText.setText(text);

    const rarity = this.RARITY_COLORS[item.rarity] || this.RARITY_COLORS.common;
    this.tooltipBg.setStrokeStyle(1, rarity.border);
    this.tooltipBg.setSize(this.tooltipText.width + 16, this.tooltipText.height + 12);

    // 屏幕边界检测
    let tx = x, ty = y;
    const camW = this.cameras.main.width;
    const camH = this.cameras.main.height;
    if (tx + this.tooltipText.width + 16 > camW) tx = x - this.tooltipText.width - 40;
    if (ty + this.tooltipText.height + 12 > camH) ty = camH - this.tooltipText.height - 16;
    if (ty < 4) ty = 4;

    this.tooltipContainer.setPosition(tx, ty);
    this.tooltipContainer.setVisible(true);
    if (this.tooltipContainer2) this.tooltipContainer2.setVisible(false);
  }
};
