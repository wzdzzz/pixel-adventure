import { MATERIALS, getEnhanceCost, getEnhanceSuccessRate, getEnhanceFailureBehavior } from '../../data/materials.js';
import { AFFIXES } from '../../data/affixes.js';
import { RECIPES } from '../../data/recipes.js';
import { GEMS } from '../../data/gems.js';
import itemData from '../../data/items.json';
import SystemRegistry from '../../core/SystemRegistry.js';
import { RARITY_LABELS, THEME_CONFIG } from '../../config/themeConfig.js';
import { UI_THEME } from '../../config/uiTheme.js';

/**
 * 强化/分解小窗口（modal in PanelScene）
 *
 * 通过 this.openEnhanceModal(slotIndex) / this.openDecomposeModal(slotIndex) 打开。
 * Mixin 到 PanelScene，复用 PanelScene 的 add / cameras / events / gameScene。
 */
export const SmithyPanel = {
  openEnhanceModal(target) {
    const inv = this.gameScene?.inventory;
    let eq, isInstance;
    if (typeof target === 'number') {
      eq = inv?.slots?.[target];
      isInstance = false;
    } else {
      eq = target;
      isInstance = true;
    }
    if (!eq || eq.type !== 'equipment') return;
    this._closeSmithyModal();

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const cx = w / 2, cy = h / 2;

    const c = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(cx, cy, w, h, 0, 0.6).setInteractive();
    const panel = this.add.rectangle(cx, cy, 380, 260, UI_THEME.colors.panel, 0.98).setStrokeStyle(2, UI_THEME.colors.brass);
    const title = this.add.text(cx, cy - 110, '', {
      fontSize:'17px', color:UI_THEME.text.brass, fontFamily:UI_THEME.font.body, fontStyle:'bold'
    }).setOrigin(0.5);
    const info = this.add.text(cx, cy - 35, '', {
      fontSize:'14px', color:UI_THEME.text.paper, fontFamily:UI_THEME.font.body, align:'center', lineSpacing:5
    }).setOrigin(0.5);

    c.add([dim, panel, title, info]);

    const okBg = this.add.rectangle(cx - 80, cy + 80, 130, 34, UI_THEME.colors.panelRaised)
      .setStrokeStyle(1, UI_THEME.colors.jadeBright).setInteractive({ useHandCursor: true });
    const okTxt = this.add.text(cx - 80, cy + 80, '强化', {
      fontSize:'15px', color:UI_THEME.text.jadeBright, fontFamily:UI_THEME.font.body
    }).setOrigin(0.5);
    c.add([okBg, okTxt]);

    const cancelBg = this.add.rectangle(cx + 80, cy + 80, 130, 34, UI_THEME.colors.panelRaised)
      .setStrokeStyle(1, UI_THEME.colors.cinnabar).setInteractive({ useHandCursor: true });
    const cancelTxt = this.add.text(cx + 80, cy + 80, '关闭', {
      fontSize:'15px', color:UI_THEME.text.cinnabarBright, fontFamily:UI_THEME.font.body
    }).setOrigin(0.5);
    cancelBg.on('pointerdown', () => {
      this._closeSmithyModal();
      this.events.emit('panel:refresh', 'inventory');
      this.events.emit('panel:refresh', 'character');
    });
    c.add([cancelBg, cancelTxt]);

    // 刷新面板显示
    const refreshEnhanceUI = () => {
      const enh = eq.enhanceLevel || 0;
      const cost = getEnhanceCost(enh);
      const rate = getEnhanceSuccessRate(enh);
      const matName = cost ? (MATERIALS[cost.matId]?.name || cost.matId) : '';
      const check = SystemRegistry.get('enhanceSystem').canEnhance(eq);
      const canEnhance = check.ok;
      const errText = canEnhance ? '' : this._enhanceErrText(check.reason);
      const heldMat = cost ? this._countMatInInv(cost.matId) : 0;
      const heldGold = inv?.gold || 0;

      title.setText(`强化 ${eq.name} +${enh}`);

      if (enh >= 15) {
        info.setText('已达最高强化等级 +15');
        info.setColor(UI_THEME.text.brass);
        okBg.setFillStyle(UI_THEME.colors.ink).setStrokeStyle(1, UI_THEME.colors.disabled);
        okTxt.setColor(UI_THEME.text.disabled);
        okBg.removeAllListeners('pointerdown');
      } else {
        const lines = [
          `下一级: +${enh+1}`,
          `成功率: ${(rate*100).toFixed(0)}%   失败不降级`,
          `材料: ${matName} ×${cost.count} (持有 ${heldMat})`,
          `${THEME_CONFIG.currency}: ${cost.gold} (持有 ${heldGold})`
        ];
        if (errText) { lines.push(''); lines.push(`⚠ ${errText}`); }
        info.setText(lines.join('\n'));
        info.setColor(canEnhance ? UI_THEME.text.paper : UI_THEME.text.cinnabarBright);

        if (canEnhance) {
          okBg.setFillStyle(UI_THEME.colors.panelRaised).setStrokeStyle(1, UI_THEME.colors.jadeBright);
          okTxt.setColor(UI_THEME.text.jadeBright);
        } else {
          okBg.setFillStyle(UI_THEME.colors.ink).setStrokeStyle(1, UI_THEME.colors.disabled);
          okTxt.setColor(UI_THEME.text.disabled);
        }
      }
    };

    okBg.on('pointerdown', () => {
      const check = SystemRegistry.get('enhanceSystem').canEnhance(eq);
      if (!check.ok) return;
      const r = SystemRegistry.get('enhanceSystem').enhance(isInstance ? eq : target);
      if (r && r.result === 'invalid') {
        this._showPanelToast?.(this._enhanceErrText(r.reason), UI_THEME.text.cinnabar);
      }
      refreshEnhanceUI();
    });

    refreshEnhanceUI();
    this._smithyModal = c;
  },

  _countMatInInv(matId) {
    const inv = this.gameScene?.inventory;
    if (!inv) return 0;
    return inv.slots.reduce((sum, s) => (s && s.id === matId ? sum + (s.quantity || 0) : sum), 0);
  },

  openDecomposeModal(slotIndex) {
    const inv = this.gameScene?.inventory;
    const eq = inv?.slots?.[slotIndex];
    if (!eq || eq.type !== 'equipment') return;
    this._closeSmithyModal();

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const cx = w / 2, cy = h / 2;

    const c = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(cx, cy, w, h, 0, 0.6).setInteractive();
    const panel = this.add.rectangle(cx, cy, 360, 200, UI_THEME.colors.panel, 0.98).setStrokeStyle(2, UI_THEME.colors.cinnabar);
    const title = this.add.text(cx, cy - 75, `分解 ${eq.name}`, {
      fontSize:'17px', color:UI_THEME.text.cinnabarBright, fontFamily:UI_THEME.font.body, fontStyle:'bold'
    }).setOrigin(0.5);
    const info = this.add.text(cx, cy - 20,
      '此操作不可逆，装备会变成对应材料',
      { fontSize:'14px', color:UI_THEME.text.muted, fontFamily:UI_THEME.font.body }
    ).setOrigin(0.5);
    c.add([dim, panel, title, info]);

    const okBg = this.add.rectangle(cx - 70, cy + 50, 110, 32, UI_THEME.colors.panelRaised)
      .setStrokeStyle(1, UI_THEME.colors.cinnabar).setInteractive({ useHandCursor: true });
    const okTxt = this.add.text(cx - 70, cy + 50, '分解', {
      fontSize:'15px', color:UI_THEME.text.cinnabar, fontFamily:UI_THEME.font.body
    }).setOrigin(0.5);
    okBg.on('pointerdown', () => {
      SystemRegistry.get('enhanceSystem').decompose(slotIndex);
      this._closeSmithyModal();
      this.events.emit('panel:refresh', 'inventory');
    });

    const cancelBg = this.add.rectangle(cx + 70, cy + 50, 110, 32, UI_THEME.colors.ink)
      .setStrokeStyle(1, UI_THEME.colors.border).setInteractive({ useHandCursor: true });
    const cancelTxt = this.add.text(cx + 70, cy + 50, '取消', {
      fontSize:'15px', color:UI_THEME.text.paper, fontFamily:UI_THEME.font.body
    }).setOrigin(0.5);
    cancelBg.on('pointerdown', () => this._closeSmithyModal());

    c.add([okBg, okTxt, cancelBg, cancelTxt]);
    this._smithyModal = c;
  },

  openBulkDecomposeModal() {
    this._closeSmithyModal();
    const inv = this.gameScene?.inventory;
    if (!inv) return;

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const cx = w / 2, cy = h / 2;

    // 默认勾选 common + uncommon
    const selected = { common: true, uncommon: true, rare: false, epic: false, legendary: false, mythic: false };

    const c = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(cx, cy, w, h, 0, 0.6).setInteractive();
    const panel = this.add.rectangle(cx, cy, 400, 320, UI_THEME.colors.panel, 0.98).setStrokeStyle(2, UI_THEME.colors.jade);
    const title = this.add.text(cx, cy - 140, '批量拆解', {
      fontSize:'17px', color:UI_THEME.text.jadeBright, fontFamily:UI_THEME.font.body, fontStyle:'bold'
    }).setOrigin(0.5);
    c.add([dim, panel, title]);

    const rarityList = [
      { key:'common',    label:RARITY_LABELS.common,    color:UI_THEME.text.paper },
      { key:'uncommon',  label:RARITY_LABELS.uncommon,  color:'#44cc44' },
      { key:'rare',      label:RARITY_LABELS.rare,      color:'#4488ff' },
      { key:'epic',      label:RARITY_LABELS.epic,      color:'#bb44ff' },
      { key:'legendary', label:RARITY_LABELS.legendary, color:UI_THEME.text.brass },
      { key:'mythic',    label:RARITY_LABELS.mythic,    color:'#ff4444' }
    ];

    const rowY = cy - 90;
    const rowH = 24;
    const checkboxes = {};
    const counterText = this.add.text(cx, cy + 70, '', {
      fontSize:'14px', color:UI_THEME.text.brass, fontFamily:UI_THEME.font.body
    }).setOrigin(0.5);
    c.add(counterText);

    const updateCounter = () => {
      const count = inv.slots.reduce((n, s) =>
        s && s.type === 'equipment' && selected[s.rarity] ? n + 1 : n, 0);
      counterText.setText(`将拆解: ${count} 件装备`);
    };

    rarityList.forEach((r, i) => {
      const y = rowY + i * rowH;
      const box = this.add.text(cx - 80, y, selected[r.key] ? '☑' : '☐', {
        fontSize:'16px', color:r.color, fontFamily:UI_THEME.font.body
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      const lbl = this.add.text(cx - 60, y, r.label, {
        fontSize:'14px', color:r.color, fontFamily:UI_THEME.font.body
      }).setOrigin(0, 0.5);
      box.on('pointerdown', () => {
        selected[r.key] = !selected[r.key];
        box.setText(selected[r.key] ? '☑' : '☐');
        updateCounter();
      });
      checkboxes[r.key] = box;
      c.add([box, lbl]);
    });
    updateCounter();

    // 确认按钮
    const okBg = this.add.rectangle(cx - 80, cy + 120, 130, 34, UI_THEME.colors.panelRaised)
      .setStrokeStyle(1, UI_THEME.colors.jadeBright).setInteractive({ useHandCursor: true });
    const okTxt = this.add.text(cx - 80, cy + 120, '确认拆解', {
      fontSize:'15px', color:UI_THEME.text.jadeBright, fontFamily:UI_THEME.font.body
    }).setOrigin(0.5);
    okBg.on('pointerdown', () => {
      const enhSys = SystemRegistry.get('enhanceSystem');
      let cnt = 0;
      // 反向遍历避免索引错位
      for (let i = inv.slots.length - 1; i >= 0; i--) {
        const s = inv.slots[i];
        if (s && s.type === 'equipment' && selected[s.rarity]) {
          const r = enhSys.decompose(i);
          if (r.result === 'success') cnt++;
        }
      }
      this._closeSmithyModal();
      this._showPanelToast?.(`已拆解 ${cnt} 件装备`, UI_THEME.text.jadeBright);
    });
    c.add([okBg, okTxt]);

    // 取消按钮
    const cancelBg = this.add.rectangle(cx + 80, cy + 120, 130, 34, UI_THEME.colors.panelRaised)
      .setStrokeStyle(1, UI_THEME.colors.cinnabar).setInteractive({ useHandCursor: true });
    const cancelTxt = this.add.text(cx + 80, cy + 120, '取消', {
      fontSize:'15px', color:UI_THEME.text.cinnabarBright, fontFamily:UI_THEME.font.body
    }).setOrigin(0.5);
    cancelBg.on('pointerdown', () => this._closeSmithyModal());
    c.add([cancelBg, cancelTxt]);

    this._smithyModal = c;
  },

  _closeSmithyModal() {
    // 清除滚动监听
    if (this._gemFusionScrollHandler) {
      this.input.off('wheel', this._gemFusionScrollHandler);
      this._gemFusionScrollHandler = null;
    }
    if (this._craftScrollHandler) {
      this.input.off('wheel', this._craftScrollHandler);
      this._craftScrollHandler = null;
    }
    if (this._smithyModal) {
      this._smithyModal.destroy();
      this._smithyModal = null;
    }
    // 修复：modal 期间网格 cell 的 pointerout 被吞，关闭后重绘恢复边框
    // 用 delayedCall 推迟一帧避免在 Phaser render 过程中触发 setColor → drawImage null
    if (this.scene && this.scene.isActive()) {
      this.time.delayedCall(0, () => {
        try {
          if (this.scene.isActive()) this.events.emit('panel:refresh', 'inventory');
        } catch (e) {
          // 静默：场景在销毁中
        }
      });
    }
  },

  _enhanceErrText(reason) {
    return ({
      no_material: '材料不足',
      no_gold: `${THEME_CONFIG.currency}不足`,
      maxed: '已达最高强化等级',
      not_equipment: '不是装备'
    })[reason] || '强化失败';
  },

  openReforgeModal(eq) {
    if (!eq || eq.type !== 'equipment') return;
    if (!eq.affixes || eq.affixes.length === 0) {
      this._showPanelToast?.('该装备没有词条，无法洗练', UI_THEME.text.cinnabarBright);
      return;
    }
    this._closeSmithyModal();

    const reforgeSys = this.gameScene?.reforgeSystem;
    if (!reforgeSys) return;

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const cx = w / 2, cy = h / 2;

    const lockedIndices = new Set(); // 用索引锁定，避免 ID 引用失效
    const locks = []; // 控件引用，用于刷新

    const c = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(cx, cy, w, h, 0, 0.6).setInteractive();
    const panel = this.add.rectangle(cx, cy, 460, 380, UI_THEME.colors.panel, 0.98).setStrokeStyle(2, UI_THEME.colors.jade);
    const title = this.add.text(cx, cy - 165, `洗练 ${eq.name}`, {
      fontSize:'17px', color:UI_THEME.text.jadeBright, fontFamily:UI_THEME.font.body, fontStyle:'bold'
    }).setOrigin(0.5);
    c.add([dim, panel, title]);

    const hint = this.add.text(cx, cy - 140, '勾选最多 2 条词条锁定，其余重 roll', {
      fontSize:'13px', color:UI_THEME.text.muted, fontFamily:UI_THEME.font.body
    }).setOrigin(0.5);
    c.add(hint);

    // 列出每条词条
    const startY = cy - 110;
    eq.affixes.forEach((a, i) => {
      const y = startY + i * 26;
      const def = AFFIXES[a.id];
      if (!def) return;
      const isTrigger = def.stat === '_trigger';
      const valText = isTrigger
        ? `${(def.trigger?.chance*100 || 0).toFixed(0)}% 触发`
        : (def.isFlat ? a.value.toFixed(1) : `${(a.value*100).toFixed(1)}%`);
      const box = this.add.text(cx - 180, y, '☐', {
        fontSize:'16px', color:UI_THEME.text.muted, fontFamily:UI_THEME.font.body
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      const lbl = this.add.text(cx - 165, y, `T${def.tier} ${def.name}: ${valText}`, {
        fontSize:'14px', color:UI_THEME.text.paper, fontFamily:UI_THEME.font.body
      }).setOrigin(0, 0.5);
      box.on('pointerdown', () => {
        if (lockedIndices.has(i)) {
          lockedIndices.delete(i);
          box.setText('☐');
        } else {
          if (lockedIndices.size >= 2) {
            this._showPanelToast?.('最多锁定 2 条词条', UI_THEME.text.brass);
            return;
          }
          lockedIndices.add(i);
          box.setText('☑');
        }
        refreshCost();
      });
      locks.push({ box, lbl, index: i });
      c.add([box, lbl]);
    });

    // 成本预览
    const costText = this.add.text(cx, cy + 90, '', {
      fontSize:'14px', color:UI_THEME.text.paper, fontFamily:UI_THEME.font.body, align:'center', lineSpacing:3
    }).setOrigin(0.5);
    c.add(costText);

    let divineMode = false;

    const _matName = (id) => itemData.items?.[id]?.name || MATERIALS[id]?.name || id;

    const refreshCost = () => {
      const cost = reforgeSys.getCost(lockedIndices.size);
      const lines = [
        `锁定: ${lockedIndices.size} 条${divineMode ? '  [天工模式]' : ''}`,
        `材料: ${_matName(cost.matId)} ×${cost.count} (持有 ${this._countMatInInv(cost.matId)})`,
        `${THEME_CONFIG.currency}: ${cost.gold} (持有 ${SystemRegistry.get('inventory').gold || 0})`
      ];
      cost.lockedExtras.forEach(e => {
        lines.push(`+ ${_matName(e.matId)} ×${e.count} (持有 ${this._countMatInInv(e.matId)})`);
      });
      if (divineMode) {
        lines.push(`+ ${_matName('divine_heart')} ×1 (持有 ${this._countMatInInv('divine_heart')})`);
        lines.push('T1 词条权重 ×3');
      }
      const pity = reforgeSys.getPity(eq);
      if (pity > 0) lines.push(`保底进度: ${pity}/5（5 次未出 T1 必触发保底）`);
      costText.setText(lines.join('\n'));
    };
    refreshCost();

    // 天工洗练切换
    const divineBg = this.add.rectangle(cx, cy + 130, 280, 22, UI_THEME.colors.panelRaised)
      .setStrokeStyle(1, UI_THEME.colors.jadeBright).setInteractive({ useHandCursor: true });
    const divineLabel = `天工洗练（消耗${MATERIALS.divine_heart.name}，T1 概率 ×3）`;
    const divineTxt = this.add.text(cx, cy + 130, `☐ ${divineLabel}`, {
      fontSize:'13px', color:UI_THEME.text.jadeBright, fontFamily:UI_THEME.font.body
    }).setOrigin(0.5);
    divineBg.on('pointerdown', () => {
      divineMode = !divineMode;
      divineTxt.setText(`${divineMode ? '☑' : '☐'} ${divineLabel}`);
      refreshCost();
    });
    c.add([divineBg, divineTxt]);

    // 按钮
    const okBg = this.add.rectangle(cx - 80, cy + 165, 130, 30, UI_THEME.colors.panelRaised)
      .setStrokeStyle(1, UI_THEME.colors.jadeBright).setInteractive({ useHandCursor: true });
    const okTxt = this.add.text(cx - 80, cy + 165, '洗练', {
      fontSize:'15px', color:UI_THEME.text.jadeBright, fontFamily:UI_THEME.font.body
    }).setOrigin(0.5);
    const REFORGE_ERRORS = {
      not_equipment: '该物品不是装备',
      no_affixes: '该装备没有词条',
      too_many_locks: '最多锁定 2 条',
      no_material: `${MATERIALS.chaos_essence.name}不足`,
      no_gold: `${THEME_CONFIG.currency}不足`,
      no_material_extra: `${MATERIALS.soul_crystal.name}不足`,
      no_divine_heart: `${MATERIALS.divine_heart.name}不足`
    };

    okBg.on('pointerdown', () => {
      // 将锁定的索引转为当前词条 ID 传给 reforgeSystem
      const lockedAffixIds = [...lockedIndices].map(idx => eq.affixes[idx]?.id).filter(Boolean);
      const r = reforgeSys.reforge(eq, lockedAffixIds, divineMode);
      if (r.result === 'invalid') {
        this._showPanelToast?.(REFORGE_ERRORS[r.reason] || `洗练失败: ${r.reason}`, UI_THEME.text.cinnabar);
        return;
      }
      // 洗练成功 — 刷新词条显示而非关闭弹窗
      lockedIndices.clear();
      locks.forEach((lockItem, i) => {
        const a = eq.affixes[i];
        if (a) {
          const def = AFFIXES[a.id];
          if (def) {
            const isTrigger = def.stat === '_trigger';
            const valText = isTrigger
              ? `${(def.trigger?.chance*100 || 0).toFixed(0)}% 触发`
              : (def.isFlat ? a.value.toFixed(1) : `${(a.value*100).toFixed(1)}%`);
            lockItem.lbl.setText(`T${def.tier} ${def.name}: ${valText}`);
            lockItem.box.setText('☐');
          }
        } else {
          lockItem.lbl.setText('');
          lockItem.box.setVisible(false);
        }
      });
      refreshCost();
      this.events.emit('panel:refresh', 'character');
      this.events.emit('panel:refresh', 'inventory');
    });
    const cancelBg = this.add.rectangle(cx + 80, cy + 165, 130, 30, UI_THEME.colors.panelRaised)
      .setStrokeStyle(1, UI_THEME.colors.cinnabar).setInteractive({ useHandCursor: true });
    const cancelTxt = this.add.text(cx + 80, cy + 165, '取消', {
      fontSize:'15px', color:UI_THEME.text.cinnabarBright, fontFamily:UI_THEME.font.body
    }).setOrigin(0.5);
    cancelBg.on('pointerdown', () => this._closeSmithyModal());
    c.add([okBg, okTxt, cancelBg, cancelTxt]);

    this._smithyModal = c;
  },

  openSocketModal(eq) {
    if (!eq || eq.type !== 'equipment' || !eq.sockets || eq.sockets.length === 0) {
      this._showPanelToast?.('该装备无孔位', UI_THEME.text.cinnabarBright);
      return;
    }
    this._closeSmithyModal();

    const gemSys = this.gameScene?.gemSystem;
    const inv = this.gameScene?.inventory;
    if (!gemSys || !inv) return;

    const renderModal = () => {
      if (this._smithyModal) this._smithyModal.destroy();
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const cx = w / 2, cy = h / 2;

      const c = this.add.container(0, 0).setDepth(50);
      const dim = this.add.rectangle(cx, cy, w, h, 0, 0.6).setInteractive();
      const panel = this.add.rectangle(cx, cy, 440, 320, UI_THEME.colors.panel, 0.98).setStrokeStyle(2, UI_THEME.colors.jade);
      const title = this.add.text(cx, cy - 135, `孔位 ${eq.name}`, {
        fontSize:'17px', color:UI_THEME.text.jade, fontFamily:UI_THEME.font.body, fontStyle:'bold'
      }).setOrigin(0.5);
      c.add([dim, panel, title]);

      eq.sockets.forEach((s, i) => {
        const y = cy - 90 + i * 36;
        const slotLabel = this.add.text(cx - 180, y, `孔 ${i+1}:`, {
          fontSize:'14px', color:UI_THEME.text.muted, fontFamily:UI_THEME.font.body
        }).setOrigin(0, 0.5);
        c.add(slotLabel);

        if (s.gemId) {
          // 已镶嵌
          const gem = GEMS[s.gemId];
          const val = gem ? gem.baseValue * (s.gemLevel || 1) : 0;
          const statLabel = { attack:'攻击', spellPower:'术法强度', maxHp:'气血', critRate:'暴击' }[gem?.stat] || gem?.stat || '';
          const valText = gem?.stat === 'critRate' ? `+${val.toFixed(1)}%` : `+${val}`;
          const gemName = `${gem?.icon || '◆'} ${gem?.name || s.gemId} Lv.${s.gemLevel}  ${valText} ${statLabel}`;
          const lbl = this.add.text(cx - 100, y, gemName, {
            fontSize:'14px', color:UI_THEME.text.jadeBright, fontFamily:UI_THEME.font.body
          }).setOrigin(0, 0.5);
          const unsocketBg = this.add.rectangle(cx + 130, y, 80, 24, UI_THEME.colors.panelRaised)
            .setStrokeStyle(1, UI_THEME.colors.cinnabar).setInteractive({ useHandCursor: true });
          const unsocketTxt = this.add.text(cx + 130, y, '拆卸', {
            fontSize:'14px', color:UI_THEME.text.cinnabarBright, fontFamily:UI_THEME.font.body
          }).setOrigin(0.5);
          unsocketBg.on('pointerdown', () => {
            const r = gemSys.unsocket(eq, i);
            if (!r.ok) this._showPanelToast?.(`拆卸失败: ${r.reason}`, UI_THEME.text.cinnabar);
            renderModal();
          });
          c.add([lbl, unsocketBg, unsocketTxt]);
        } else {
          // 空孔
          const lbl = this.add.text(cx - 100, y, '空', {
            fontSize:'14px', color:UI_THEME.text.disabled, fontFamily:UI_THEME.font.body
          }).setOrigin(0, 0.5);
          const socketBg = this.add.rectangle(cx + 130, y, 80, 24, UI_THEME.colors.ink)
            .setStrokeStyle(1, UI_THEME.colors.jade).setInteractive({ useHandCursor: true });
          const socketTxt = this.add.text(cx + 130, y, '镶嵌', {
            fontSize:'14px', color:UI_THEME.text.jadeBright, fontFamily:UI_THEME.font.body
          }).setOrigin(0.5);
          socketBg.on('pointerdown', () => {
            openGemPicker(i);
          });
          c.add([lbl, socketBg, socketTxt]);
        }
      });

      const cancelBg = this.add.rectangle(cx, cy + 130, 130, 32, UI_THEME.colors.panelRaised)
        .setStrokeStyle(1, UI_THEME.colors.cinnabar).setInteractive({ useHandCursor: true });
      const cancelTxt = this.add.text(cx, cy + 130, '关闭', {
        fontSize:'15px', color:UI_THEME.text.cinnabarBright, fontFamily:UI_THEME.font.body
      }).setOrigin(0.5);
      cancelBg.on('pointerdown', () => this._closeSmithyModal());
      c.add([cancelBg, cancelTxt]);

      this._smithyModal = c;
    };

    const openGemPicker = (socketIdx) => {
      if (this._smithyModal) this._smithyModal.destroy();
      const w = this.cameras.main.width;
      const h = this.cameras.main.height;
      const cx = w / 2, cy = h / 2;

      const c = this.add.container(0, 0).setDepth(50);
      const dim = this.add.rectangle(cx, cy, w, h, 0, 0.6).setInteractive();
      const panel = this.add.rectangle(cx, cy, 440, 360, UI_THEME.colors.panel, 0.98).setStrokeStyle(2, UI_THEME.colors.jade);
      const title = this.add.text(cx, cy - 155, '选择宝石镶嵌', {
        fontSize:'16px', color:UI_THEME.text.jade, fontFamily:UI_THEME.font.body, fontStyle:'bold'
      }).setOrigin(0.5);
      c.add([dim, panel, title]);

      // 列出背包所有宝石
      const gemEntries = inv.slots
        .map((s, idx) => ({ s, idx }))
        .filter(({ s }) => s && s.type === 'gem');

      if (gemEntries.length === 0) {
        const empty = this.add.text(cx, cy - 50, '行囊中没有灵玉', {
          fontSize:'14px', color:UI_THEME.text.muted, fontFamily:UI_THEME.font.body
        }).setOrigin(0.5);
        c.add(empty);
      } else {
        gemEntries.forEach(({ s, idx }, i) => {
          const y = cy - 110 + i * 26;
          const gem = GEMS[s.id];
          const val = gem ? gem.baseValue * (s.level || 1) : 0;
          const statLabel = { attack:'攻击', spellPower:'术法强度', maxHp:'气血', critRate:'暴击' }[gem?.stat] || '';
          const valText = gem?.stat === 'critRate' ? `+${val.toFixed(1)}%` : `+${val}`;
          const txt = this.add.text(cx - 180, y, `${s.icon || '◆'} ${s.name}  ${valText}${statLabel}  ×${s.quantity}`, {
            fontSize:'14px', color:UI_THEME.text.paper, fontFamily:UI_THEME.font.body,
            backgroundColor:'#192b24', padding:{ x:6, y:3 }
          }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
          txt.on('pointerdown', () => {
            const r = gemSys.socket(eq, socketIdx, idx);
            if (!r.ok) this._showPanelToast?.(`镶嵌失败: ${r.reason}`, UI_THEME.text.cinnabar);
            renderModal();
          });
          c.add(txt);
        });
      }

      const backBg = this.add.rectangle(cx, cy + 150, 130, 32, UI_THEME.colors.ink)
        .setStrokeStyle(1, UI_THEME.colors.jade).setInteractive({ useHandCursor: true });
      const backTxt = this.add.text(cx, cy + 150, '返回', {
        fontSize:'15px', color:UI_THEME.text.paper, fontFamily:UI_THEME.font.body
      }).setOrigin(0.5);
      backBg.on('pointerdown', () => renderModal());
      c.add([backBg, backTxt]);

      this._smithyModal = c;
    };

    renderModal();
  },

  openGemFusionModal() {
    this._closeSmithyModal();
    const gemSys = this.gameScene?.gemSystem;
    const inv = this.gameScene?.inventory;
    if (!gemSys || !inv) return;

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const cx = w / 2, cy = h / 2;
    const panelW = 520, panelH = 560;
    const selected = [];  // slotIndex 数组

    const render = () => {
      if (this._smithyModal) this._smithyModal.destroy();
      const c = this.add.container(0, 0).setDepth(50);
      const dim = this.add.rectangle(cx, cy, w, h, 0, 0.6).setInteractive();
      const panel = this.add.rectangle(cx, cy, panelW, panelH, UI_THEME.colors.panel, 0.98).setStrokeStyle(2, UI_THEME.colors.brass);
      const title = this.add.text(cx, cy - panelH / 2 + 25, '宝石合成', {
        fontSize:'17px', color:UI_THEME.text.brass, fontFamily:UI_THEME.font.body, fontStyle:'bold'
      }).setOrigin(0.5);
      const hint = this.add.text(cx, cy - panelH / 2 + 50, '选 3 颗同色同级宝石合成更高 1 级', {
        fontSize:'13px', color:UI_THEME.text.muted, fontFamily:UI_THEME.font.body
      }).setOrigin(0.5);
      c.add([dim, panel, title, hint]);

      const gemEntries = inv.slots
        .map((s, idx) => ({ s, idx }))
        .filter(({ s }) => s && s.type === 'gem' && s.level < 10);

      // 滚动列表区域
      const listTop = cy - panelH / 2 + 70;
      const listH = panelH - 160; // 列表可用高度
      const rowH = 28;
      const listLeft = cx - panelW / 2 + 30;
      const listW = panelW - 60;

      // 裁剪遮罩：只显示列表区域内的行
      const maskGfx = this.make.graphics({ x: 0, y: 0, add: false });
      maskGfx.fillRect(listLeft, listTop, listW, listH);
      const mask = maskGfx.createGeometryMask();

      // 列表内容容器（可滚动）
      const listContainer = this.add.container(0, 0);
      listContainer.setMask(mask);

      if (gemEntries.length === 0) {
        const empty = this.add.text(cx, listTop + 50, '没有可合成的宝石', {
          fontSize:'14px', color:UI_THEME.text.muted, fontFamily:UI_THEME.font.body
        }).setOrigin(0.5);
        listContainer.add(empty);
      } else {
        gemEntries.forEach(({ s, idx }, i) => {
          const y = listTop + i * rowH + rowH / 2;
          const isSel = selected.includes(idx);
          const bg = this.add.rectangle(cx, y, listW, rowH - 4,
            isSel ? UI_THEME.colors.panelHover : UI_THEME.colors.panelRaised)
            .setStrokeStyle(1, isSel ? UI_THEME.colors.jadeBright : UI_THEME.colors.border)
            .setInteractive({ useHandCursor: true });
          const levelTag = `Lv.${s.level || 1}`;
          const gem = GEMS[s.id];
          const val = gem ? gem.baseValue * (s.level || 1) : 0;
          const statLabel = { attack:'攻击', spellPower:'术法强度', maxHp:'气血', critRate:'暴击' }[gem?.stat] || '';
          const valText = gem?.stat === 'critRate' ? `+${val.toFixed(1)}%` : `+${val}`;
          const txt = this.add.text(listLeft + 10, y, `${s.icon || '◆'} ${s.name} ${levelTag}  ${valText}${statLabel}  ×${s.quantity}`, {
            fontSize:'14px', color: isSel ? UI_THEME.text.jadeBright : UI_THEME.text.paper, fontFamily:UI_THEME.font.body
          }).setOrigin(0, 0.5);
          bg.on('pointerdown', () => {
            const i2 = selected.indexOf(idx);
            if (i2 >= 0) selected.splice(i2, 1);
            else if (selected.length < 3) selected.push(idx);
            render();
          });
          listContainer.add([bg, txt]);
        });
      }
      c.add(listContainer);

      // 滚动支持：鼠标滚轮
      const maxScroll = Math.max(0, gemEntries.length * rowH - listH);
      let scrollY = 0;
      if (maxScroll > 0) {
        const scrollHint = this.add.text(cx + panelW / 2 - 40, listTop + listH - 14, '▼滚动', {
          fontSize:'12px', color:UI_THEME.text.disabled, fontFamily:UI_THEME.font.body
        }).setOrigin(0.5);
        c.add(scrollHint);

        this.input.on('wheel', this._gemFusionScrollHandler = (_p, _over, _dx, dy) => {
          scrollY = Math.max(0, Math.min(maxScroll, scrollY + dy * 0.5));
          listContainer.setY(-scrollY);
        });
      }

      // 底部栏
      const bottomY = cy + panelH / 2 - 60;
      const counterText = this.add.text(cx, bottomY, `已选: ${selected.length}/3`, {
        fontSize:'14px', color:UI_THEME.text.brass, fontFamily:UI_THEME.font.body
      }).setOrigin(0.5);
      c.add(counterText);

      const btnY = bottomY + 35;
      const enabled = selected.length === 3;
      const okBg = this.add.rectangle(cx - 80, btnY, 130, 32,
        enabled ? UI_THEME.colors.panelRaised : UI_THEME.colors.ink)
        .setStrokeStyle(1, enabled ? UI_THEME.colors.jadeBright : UI_THEME.colors.disabled);
      if (enabled) okBg.setInteractive({ useHandCursor: true });
      const okTxt = this.add.text(cx - 80, btnY, '合成', {
        fontSize:'15px', color: enabled ? UI_THEME.text.jadeBright : UI_THEME.text.disabled, fontFamily:UI_THEME.font.body
      }).setOrigin(0.5);
      if (enabled) {
        okBg.on('pointerdown', () => {
          const r = gemSys.fuse(selected);
          if (!r.ok) {
            this._showPanelToast?.(`合成失败: ${r.reason}`, UI_THEME.text.cinnabar);
          }
          this._closeSmithyModal();
        });
      }

      const cancelBg = this.add.rectangle(cx + 80, btnY, 130, 32, UI_THEME.colors.panelRaised)
        .setStrokeStyle(1, UI_THEME.colors.cinnabar).setInteractive({ useHandCursor: true });
      const cancelTxt = this.add.text(cx + 80, btnY, '取消', {
        fontSize:'15px', color:UI_THEME.text.cinnabarBright, fontFamily:UI_THEME.font.body
      }).setOrigin(0.5);
      cancelBg.on('pointerdown', () => this._closeSmithyModal());
      c.add([okBg, okTxt, cancelBg, cancelTxt]);

      this._smithyModal = c;
    };
    render();
  },

  openCraftModal() {
    this._closeSmithyModal();
    const craftSys = this.gameScene?.craftingSystem;
    const inv = this.gameScene?.inventory;
    if (!craftSys || !inv) return;

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const cx = w / 2, cy = h / 2;
    const panelW = 540, panelH = 600;

    const render = () => {
      if (this._smithyModal) this._smithyModal.destroy();
      const c = this.add.container(0, 0).setDepth(50);
      const dim = this.add.rectangle(cx, cy, w, h, 0, 0.6).setInteractive();
      const panel = this.add.rectangle(cx, cy, panelW, panelH, UI_THEME.colors.panel, 0.98).setStrokeStyle(2, UI_THEME.colors.jade);
      const title = this.add.text(cx, cy - panelH / 2 + 25, '炼器', {
        fontSize:'17px', color:UI_THEME.text.jade, fontFamily:UI_THEME.font.body, fontStyle:'bold'
      }).setOrigin(0.5);
      const hint = this.add.text(cx, cy - panelH / 2 + 50, '选择配方制作装备，材料不足时按钮禁用', {
        fontSize:'13px', color:UI_THEME.text.muted, fontFamily:UI_THEME.font.body
      }).setOrigin(0.5);
      c.add([dim, panel, title, hint]);

      // 滚动列表区域
      const listTop = cy - panelH / 2 + 70;
      const listH = panelH - 150;
      const rowH = 54;
      const listLeft = cx - panelW / 2 + 20;
      const listW = panelW - 40;

      // 裁剪遮罩
      const maskGfx = this.make.graphics({ x: 0, y: 0, add: false });
      maskGfx.fillRect(listLeft, listTop, listW, listH);
      const mask = maskGfx.createGeometryMask();

      const listContainer = this.add.container(0, 0);
      listContainer.setMask(mask);

      const recipes = craftSys.listRecipes();
      const RARITY_COLOR = {
        common:UI_THEME.text.paper, uncommon:'#44cc44', rare:'#4488ff',
        epic:'#bb44ff', legendary:'#ffaa00', mythic:'#ff4444'
      };

      recipes.forEach((rcp, i) => {
        const y = listTop + i * rowH + rowH / 2;
        const check = craftSys.canCraft(rcp.id);
        const enabled = check.ok;

        const bg = this.add.rectangle(cx, y, listW - 10, rowH - 4,
          enabled ? 0x1e2e1e : UI_THEME.colors.ink)
          .setStrokeStyle(1, enabled ? 0x448844 : 0x444444);

        const rarityColor = RARITY_COLOR[rcp.resultRarity] || UI_THEME.text.paper;
        const lvlText = rcp.requiredLevel ? ` Lv.${rcp.requiredLevel}` : '';
        const lbl = this.add.text(listLeft + 15, y - 10, `${rcp.name}${lvlText}`, {
          fontSize:'14px', color: rarityColor,
          fontFamily:UI_THEME.font.body, fontStyle:'bold'
        }).setOrigin(0, 0.5);

        const matsText = rcp.materials.map(m => {
          const held = this._countMatInInv(m.matId);
          const color = held >= m.count ? '' : '!';
          return `${m.matId}×${m.count}(${held})${color}`;
        }).join('  ');
        const detail = this.add.text(listLeft + 15, y + 10, `${matsText} | ${rcp.gold}${THEME_CONFIG.currency}`, {
          fontSize:'12px', color: enabled ? UI_THEME.text.muted : '#666666', fontFamily:UI_THEME.font.body
        }).setOrigin(0, 0.5);

        const btnBg = this.add.rectangle(cx + listW / 2 - 55, y, 80, 28,
          enabled ? UI_THEME.colors.panelRaised : UI_THEME.colors.ink)
          .setStrokeStyle(1, enabled ? UI_THEME.colors.jadeBright : UI_THEME.colors.disabled);
        if (enabled) btnBg.setInteractive({ useHandCursor: true });
        const btnTxt = this.add.text(cx + listW / 2 - 55, y, '制作', {
          fontSize:'14px', color: enabled ? UI_THEME.text.jadeBright : UI_THEME.text.disabled,
          fontFamily:UI_THEME.font.body
        }).setOrigin(0.5);
        if (enabled) {
          btnBg.on('pointerdown', () => {
            const r = craftSys.craft(rcp.id);
            if (r.result !== 'success') {
              this._showPanelToast?.(`制作失败: ${r.reason}`, UI_THEME.text.cinnabar);
            }
            render();
          });
        }
        listContainer.add([bg, lbl, detail, btnBg, btnTxt]);
      });
      c.add(listContainer);

      // 滚动支持
      const maxScroll = Math.max(0, recipes.length * rowH - listH);
      let scrollY = 0;
      if (maxScroll > 0) {
        const scrollHint = this.add.text(cx + panelW / 2 - 40, listTop + listH - 14, '▼滚动', {
          fontSize:'12px', color:UI_THEME.text.disabled, fontFamily:UI_THEME.font.body
        }).setOrigin(0.5);
        c.add(scrollHint);

        this.input.on('wheel', this._craftScrollHandler = (_p, _over, _dx, dy) => {
          scrollY = Math.max(0, Math.min(maxScroll, scrollY + dy * 0.5));
          listContainer.setY(-scrollY);
        });
      }

      // 底部关闭按钮
      const btnY = cy + panelH / 2 - 40;
      const cancelBg = this.add.rectangle(cx, btnY, 130, 32, UI_THEME.colors.panelRaised)
        .setStrokeStyle(1, UI_THEME.colors.cinnabar).setInteractive({ useHandCursor: true });
      const cancelTxt = this.add.text(cx, btnY, '关闭', {
        fontSize:'15px', color:UI_THEME.text.cinnabarBright, fontFamily:UI_THEME.font.body
      }).setOrigin(0.5);
      cancelBg.on('pointerdown', () => this._closeSmithyModal());
      c.add([cancelBg, cancelTxt]);

      this._smithyModal = c;
    };
    render();
  }
};
