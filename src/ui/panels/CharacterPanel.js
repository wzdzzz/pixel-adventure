import { formatEquipTooltip, getSetCount } from './InventoryPanel.js';

export const CharacterPanel = {
  createCharacterTab() {
    // 重置右键菜单引用（PanelScene 重开时旧容器已销毁）
    this.charContextMenu = null;
    this._charCtxDismiss = null;

    const container = this.add.container(0, 0).setDepth(5).setVisible(false);
    this.tabContainers.character = container;

    const contentTop = this.panelTop + 50;
    const leftX = this.panelLeft + this.panelW * 0.25;
    const rightX = this.panelLeft + this.panelW * 0.55;
    const topY = contentTop + 20;

    // Content background
    const contentBg = this.add.rectangle(
      this.panelX, contentTop + (this.panelH - 60) / 2,
      this.panelW - 20, this.panelH - 60, 0x12121e, 0.8
    ).setStrokeStyle(1, 0x3a3a5a);
    container.add(contentBg);

    // --- LEFT: Paper Doll (加大区域) ---
    const leftTitle = this.add.text(leftX, topY, '-- 角色装备 --', {
      fontSize: '13px', fill: '#8888aa', fontFamily: 'Courier New'
    }).setOrigin(0.5);
    container.add(leftTitle);

    const previewY = topY + 160;
    const preview = this.add.sprite(leftX, previewY, 'hero_00');
    preview.setDisplaySize(84, 120);
    if (this.anims.exists('hero_idle')) preview.play('hero_idle');
    container.add(preview);

    // 装备槽布局：4 行，第2-3排与武器/护甲列对齐，不挡人物
    const rowGap = 70;
    const colGap = 85;
    const slotMapping = [
      { slot: 'weapon',   x: -colGap, y: -rowGap * 1.5, label: '武器' },
      { slot: 'helmet',   x: 0,       y: -rowGap * 1.5, label: '头盔' },
      { slot: 'armor',    x: colGap,  y: -rowGap * 1.5, label: '护甲' },
      { slot: 'offhand',  x: -colGap, y: -rowGap * 0.5, label: '副手' },
      { slot: 'necklace', x: colGap,  y: -rowGap * 0.5, label: '项链' },
      { slot: 'ring1',    x: -colGap, y: rowGap * 0.5,  label: '戒指' },
      { slot: 'ring2',    x: colGap,  y: rowGap * 0.5,  label: '戒指' },
      { slot: 'boots',    x: 0,       y: rowGap * 1.5,  label: '靴子' }
    ];

    this.equipSlotUI = {};
    const SLOT_ICONS = {
      weapon: '⚔', offhand: '🛡', helmet: '⛑', armor: '🛡',
      boots: '👢', necklace: '📿', ring1: '💍', ring2: '💍'
    };

    slotMapping.forEach(def => {
      const sx = leftX + def.x;
      const sy = previewY + def.y;

      const cell = this.add.rectangle(sx, sy, 42, 42, 0x2a2a3a, 0.7)
        .setStrokeStyle(1, 0x555555).setInteractive({ useHandCursor: true });
      const icon = this.add.text(sx, sy, '', {
        fontSize: '18px', fontFamily: 'Courier New'
      }).setOrigin(0.5).setVisible(false);
      const label = this.add.text(sx, sy + 24, def.label, {
        fontSize: '9px', fill: '#555566', fontFamily: 'Courier New'
      }).setOrigin(0.5);

      cell.on('pointerdown', (pointer) => {
        const equip = this.gameScene?.equipmentSystem;
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
        this.refreshInventoryTab();
      });

      // 备用右键监听（某些 Phaser 版本 pointerdown 不传 button=2）
      cell.on('pointerup', (pointer) => {
        if (pointer.button === 2 || pointer.rightButtonDown()) {
          const equip = this.gameScene?.equipmentSystem;
          if (!equip) return;
          const equipped = equip.getSlot(def.slot);
          if (!equipped) return;
          this._showCharContextMenu(def.slot, equipped, pointer);
        }
      });

      cell.on('pointerover', () => {
        const equip = this.gameScene?.equipmentSystem;
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

    const xpBarY = previewY + 180;
    this.charLevelText = this.add.text(leftX - 80, xpBarY, 'LV.1', {
      fontSize: '14px', fill: '#ffd700', fontFamily: 'Courier New', fontStyle: 'bold'
    });
    container.add(this.charLevelText);

    const xpBarBg = this.add.rectangle(leftX - 10, xpBarY + 7, 140, 10, 0x222233)
      .setStrokeStyle(1, 0x444466).setOrigin(0, 0.5);
    container.add(xpBarBg);

    this.charXpBar = this.add.rectangle(leftX - 9, xpBarY + 7, 0, 8, 0x9966ff)
      .setOrigin(0, 0.5);
    container.add(this.charXpBar);

    this.charXpText = this.add.text(leftX - 10 + 70, xpBarY + 7, '0/40', {
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

      nameText.setInteractive();
      nameText.on('pointerover', () => this.showStatTooltip(stat, nameText.x, nameText.y));
      nameText.on('pointerout', () => this.hideTooltip());

      container.add([nameText, valueText, plusBtn]);
    });

    this.charStatPointsText = this.add.text(rightX, topY + 30 + 6 * 32 + 10, '可用属性点: 0', {
      fontSize: '12px', fill: '#ffd700', fontFamily: 'Courier New'
    });
    container.add(this.charStatPointsText);

    // --- Derived Stats ---
    const derivedY = topY + 30 + 6 * 32 + 40;
    this.derivedExpanded = true;

    const derivedToggle = this.add.text(rightX, derivedY, '▼ 衍生属性', {
      fontSize: '12px', fill: '#8888aa', fontFamily: 'Courier New'
    }).setInteractive({ useHandCursor: true });
    container.add(derivedToggle);

    this.derivedContainer = this.add.container(0, 0);
    container.add(this.derivedContainer);

    const derivedStats = [
      { key: 'hp', label: 'HP' },
      { key: 'stamina', label: '体力' },
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

    // --- 已激活套装区 ---
    const setsY = derivedY + 22 + derivedStats.length * 20 + 14;
    this.charSetsTitle = this.add.text(rightX, setsY, '🛡 已激活套装', {
      fontSize: '12px', fill: '#ffaa44', fontFamily: 'Courier New'
    });
    container.add(this.charSetsTitle);
    this.charSetsContainer = this.add.container(0, 0);
    container.add(this.charSetsContainer);

    this.refreshCharacterTab();
  },

  refreshActiveSets() {
    if (!this.charSetsContainer) return;
    this.charSetsContainer.removeAll(true);
    const equip = this.gameScene?.equipmentSystem;
    if (!equip || !equip.getActiveSets) return;
    const activeSets = equip.getActiveSets();

    const rightX = this.panelLeft + this.panelW * 0.55;
    const baseY = this.charSetsTitle.y + 18;

    if (!activeSets.length) {
      const t = this.add.text(rightX + 10, baseY, '（未装备任何套装）', {
        fontSize: '10px', fill: '#666677', fontFamily: 'Courier New'
      });
      this.charSetsContainer.add(t);
      return;
    }

    let y = baseY;
    for (const setInfo of activeSets) {
      const head = this.add.text(rightX + 10, y, `${setInfo.name}  ${setInfo.count}/${setInfo.total}`, {
        fontSize: '11px', fill: '#ffd566', fontFamily: 'Courier New', fontStyle: 'bold'
      });
      this.charSetsContainer.add(head);
      y += 16;
      for (const tier of setInfo.allTiers) {
        const mark = tier.active ? '✓' : '✗';
        const color = tier.active ? '#88ff88' : '#666677';
        const t = this.add.text(rightX + 18, y, `${mark} ${tier.tier}件: ${tier.label}`, {
          fontSize: '10px', fill: color, fontFamily: 'Courier New'
        });
        this.charSetsContainer.add(t);
        y += 14;
      }
      y += 4;
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
    this.charXpBar.setSize(Math.max(1, 138 * xpPct), 8);
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
    const equip = this.gameScene?.equipmentSystem;
    if (equip && this.equipSlotUI) {
      const SLOT_ICONS = {
        weapon: '⚔', offhand: '🛡', helmet: '⛑', armor: '🛡',
        boots: '👢', necklace: '📿', ring1: '💍', ring2: '💍'
      };

      for (const [slotName, ui] of Object.entries(this.equipSlotUI)) {
        const item = equip.getSlot(slotName);
        if (item) {
          const rarity = this.RARITY_COLORS[item.rarity] || this.RARITY_COLORS.common;
          ui.cell.setFillStyle(rarity.bg, 0.9);
          ui.cell.setStrokeStyle(1, rarity.border);
          ui.icon.setText(SLOT_ICONS[slotName] || '?');
          ui.icon.setVisible(true);
        } else {
          ui.cell.setFillStyle(0x2a2a3a, 0.7);
          ui.cell.setStrokeStyle(1, 0x555555);
          ui.icon.setVisible(false);
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
  },

  updatePlusButtonColors() {
    const levelSystem = this.registry.get('levelSystem');
    const hasPoints = levelSystem && levelSystem.statPoints > 0;
    const stats = ['con', 'str', 'int', 'agi', 'per', 'lck'];
    stats.forEach(stat => {
      if (this.charStatPlusButtons[stat]) {
        this.charStatPlusButtons[stat].setColor(hasPoints ? '#00cc00' : '#444444');
      }
    });
  },

  showStatTooltip(stat, x, y) {
    if (!this.tooltipContainer) return;
    if (this.tooltipContainer2) this.tooltipContainer2.setVisible(false);

    const player = this.gameScene?.player;
    if (!player) return;

    this.tooltipBg.setStrokeStyle(1, 0x6666aa);
    const derived = player.stats.getDerived();
    const val = player.stats.getEffective(stat);

    const primaryStat = player.classConfig?.primaryAttackStat || 'str';
    const tooltips = {
      con: `体质 (CON) = ${val}\n+${val * 10} 最大生命\n+${(val * 0.05).toFixed(2)}/s 生命恢复\n+${(val * 0.5).toFixed(1)} 韧性`,
      str: `力量 (STR) = ${val}` + (primaryStat === 'str' ? `\n+${val * 2} 攻击（主属性）` : '') + `\n+${(val * 0.2).toFixed(1)} 韧性\n+${(val * 0.3).toFixed(1)} 破甲`,
      int: `智力 (INT) = ${val}\n+${val * 15} 最大魔力\n+${val} 法术强度` + (primaryStat === 'int' ? `\n+${val * 2} 攻击（主属性）` : '') + `\n+${(val * 0.2).toFixed(1)}% 冷却缩减`,
      agi: `敏捷 (AGI) = ${val}` + (primaryStat === 'agi' ? `\n+${val * 2} 攻击（主属性）` : '') + `\n+${val}% 攻击速度\n+${val * 20 + 40} 移动速度`,
      per: `感知 (PER) = ${val}\n+${(val * 0.5).toFixed(1)}% 暴击率\n+${(val * 0.5).toFixed(1)} 破甲`,
      lck: `幸运 (LCK) = ${val}\n+${(Math.sqrt(val) * 1).toFixed(1)}% 掉落加成`
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

    const bg = this.add.rectangle(0, 0, 120, 0, 0x2a2a3e, 0.95)
      .setStrokeStyle(1, 0x5a5a7a).setOrigin(0, 0);
    this.charContextMenu.add(bg);

    let optY = 4;
    const addOpt = (label, color, cb) => {
      const t = this.add.text(8, optY, label, {
        fontSize:'11px', fill:color, fontFamily:'Courier New'
      }).setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => { cb(); this.charContextMenu.setVisible(false); });
      t.on('pointerover', () => t.setColor('#ffffff'));
      t.on('pointerout', () => t.setColor(color));
      this.charContextMenu.add(t);
      optY += 20;
    };

    // 强化（直接传 instance）
    addOpt('🔨 强化', '#ffdd66', () => this.openEnhanceModal?.(equipped));

    // 洗练
    addOpt('♻ 洗练', '#66ccff', () => this.openReforgeModal?.(equipped));

    // 镶嵌（仅当装备有插槽时）
    if (equipped.sockets && equipped.sockets.length > 0) {
      addOpt('💎 镶嵌', '#aa88ff', () => this.openSocketModal?.(equipped));
    }

    // 卸下
    addOpt('📥 卸下', '#aaccff', () => {
      const equip = this.gameScene.equipmentSystem;
      equip.unequipToInventory(slotName);
      this.refreshCharacterTab();
      this.refreshInventoryTab();
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

    const sc = getSetCount(this.gameScene?.equipmentSystem, item);
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
