import { MATERIALS, getEnhanceCost, getEnhanceSuccessRate, getEnhanceFailureBehavior } from '../../data/materials.js';
import { AFFIXES } from '../../data/affixes.js';
import { RECIPES } from '../../data/recipes.js';
import { GEMS } from '../../data/gems.js';

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

    const enh = eq.enhanceLevel || 0;
    const cost = getEnhanceCost(enh);
    const rate = getEnhanceSuccessRate(enh);
    const matName = cost ? (MATERIALS[cost.matId]?.name || cost.matId) : '';

    // 检查可强化性
    const check = this.gameScene.enhanceSystem.canEnhance(eq);
    const canEnhance = check.ok;
    const errText = canEnhance ? '' : this._enhanceErrText(check.reason);

    // 持有材料数
    const heldMat = cost ? this._countMatInInv(cost.matId) : 0;
    const heldGold = inv?.gold || 0;

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const cx = w / 2, cy = h / 2;

    const c = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(cx, cy, w, h, 0, 0.6).setInteractive();
    const panel = this.add.rectangle(cx, cy, 380, 260, 0x1a1a2e, 0.98).setStrokeStyle(2, 0xffaa44);
    const title = this.add.text(cx, cy - 110, `强化 ${eq.name} +${enh}`, {
      fontSize:'15px', color:'#ffdd66', fontFamily:'Courier New', fontStyle:'bold'
    }).setOrigin(0.5);

    let infoLines;
    if (enh >= 15) {
      infoLines = ['已达最高强化等级 +15'];
    } else {
      const failBehavior = getEnhanceFailureBehavior(enh);
      const failText = failBehavior === 'downgrade' ? '⚠ 失败降 1 级' : '失败保持等级';
      infoLines = [
        `下一级: +${enh+1}`,
        `成功率: ${(rate*100).toFixed(0)}%   ${failText}`,
        `材料: ${matName} ×${cost.count} (持有 ${heldMat})`,
        `金币: ${cost.gold} (持有 ${heldGold})`
      ];
      if (errText) {
        infoLines.push('');
        infoLines.push(`⚠ ${errText}`);
      }
    }

    const info = this.add.text(cx, cy - 35, infoLines.join('\n'), {
      fontSize:'12px', color: canEnhance ? '#cccccc' : '#ffaaaa',
      fontFamily:'Courier New', align:'center', lineSpacing:5
    }).setOrigin(0.5);

    c.add([dim, panel, title, info]);

    // 强化按钮：仅 canEnhance 时可点击；不可强化时显示灰色禁用按钮
    if (enh < 15) {
      const enabled = canEnhance;
      const okBg = this.add.rectangle(cx - 80, cy + 80, 130, 34,
        enabled ? 0x224422 : 0x2a2a2a)
        .setStrokeStyle(1, enabled ? 0x66ff88 : 0x555555);
      if (enabled) okBg.setInteractive({ useHandCursor: true });
      const okTxt = this.add.text(cx - 80, cy + 80, '强化', {
        fontSize:'13px', color: enabled ? '#66ff88' : '#777777', fontFamily:'Courier New'
      }).setOrigin(0.5);
      if (enabled) {
        okBg.on('pointerdown', () => {
          const r = this.gameScene.enhanceSystem.enhance(isInstance ? eq : target);
          if (r && r.result === 'invalid') {
            this._showPanelToast?.(this._enhanceErrText(r.reason), '#ff6666');
          }
          this._closeSmithyModal();
          if (this.refreshInventoryTab) this.refreshInventoryTab();
          if (this.refreshCharacterTab) this.refreshCharacterTab();
        });
      }
      c.add([okBg, okTxt]);
    }

    const cancelBg = this.add.rectangle(cx + 80, cy + 80, 130, 34, 0x442222)
      .setStrokeStyle(1, 0xff6666).setInteractive({ useHandCursor: true });
    const cancelTxt = this.add.text(cx + 80, cy + 80, '取消', {
      fontSize:'13px', color:'#ff8866', fontFamily:'Courier New'
    }).setOrigin(0.5);
    cancelBg.on('pointerdown', () => this._closeSmithyModal());
    c.add([cancelBg, cancelTxt]);

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
    const panel = this.add.rectangle(cx, cy, 360, 200, 0x1a1a2e, 0.98).setStrokeStyle(2, 0xff6666);
    const title = this.add.text(cx, cy - 75, `分解 ${eq.name}`, {
      fontSize:'15px', color:'#ff8866', fontFamily:'Courier New', fontStyle:'bold'
    }).setOrigin(0.5);
    const info = this.add.text(cx, cy - 20,
      '此操作不可逆，装备会变成对应材料',
      { fontSize:'12px', color:'#aaaaaa', fontFamily:'Courier New' }
    ).setOrigin(0.5);
    c.add([dim, panel, title, info]);

    const okBg = this.add.rectangle(cx - 70, cy + 50, 110, 32, 0x442222)
      .setStrokeStyle(1, 0xff6666).setInteractive({ useHandCursor: true });
    const okTxt = this.add.text(cx - 70, cy + 50, '分解', {
      fontSize:'13px', color:'#ff6666', fontFamily:'Courier New'
    }).setOrigin(0.5);
    okBg.on('pointerdown', () => {
      this.gameScene.enhanceSystem.decompose(slotIndex);
      this._closeSmithyModal();
      if (this.refreshInventoryTab) this.refreshInventoryTab();
    });

    const cancelBg = this.add.rectangle(cx + 70, cy + 50, 110, 32, 0x222244)
      .setStrokeStyle(1, 0x6688aa).setInteractive({ useHandCursor: true });
    const cancelTxt = this.add.text(cx + 70, cy + 50, '取消', {
      fontSize:'13px', color:'#aaccff', fontFamily:'Courier New'
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
    const panel = this.add.rectangle(cx, cy, 400, 320, 0x1a1a2e, 0.98).setStrokeStyle(2, 0x66ccff);
    const title = this.add.text(cx, cy - 140, '批量拆解', {
      fontSize:'15px', color:'#66ccff', fontFamily:'Courier New', fontStyle:'bold'
    }).setOrigin(0.5);
    c.add([dim, panel, title]);

    const rarityList = [
      { key:'common',    label:'普通',  color:'#cccccc' },
      { key:'uncommon',  label:'优秀',  color:'#44cc44' },
      { key:'rare',      label:'稀有',  color:'#4488ff' },
      { key:'epic',      label:'史诗',  color:'#bb44ff' },
      { key:'legendary', label:'传说',  color:'#ffaa44' },
      { key:'mythic',    label:'神话',  color:'#ff4444' }
    ];

    const rowY = cy - 90;
    const rowH = 24;
    const checkboxes = {};
    const counterText = this.add.text(cx, cy + 70, '', {
      fontSize:'11px', color:'#ffdd66', fontFamily:'Courier New'
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
        fontSize:'14px', color:r.color, fontFamily:'Courier New'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      const lbl = this.add.text(cx - 60, y, r.label, {
        fontSize:'12px', color:r.color, fontFamily:'Courier New'
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
    const okBg = this.add.rectangle(cx - 80, cy + 120, 130, 34, 0x224422)
      .setStrokeStyle(1, 0x66ff88).setInteractive({ useHandCursor: true });
    const okTxt = this.add.text(cx - 80, cy + 120, '确认拆解', {
      fontSize:'13px', color:'#66ff88', fontFamily:'Courier New'
    }).setOrigin(0.5);
    okBg.on('pointerdown', () => {
      const enhSys = this.gameScene.enhanceSystem;
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
      this._showPanelToast?.(`已拆解 ${cnt} 件装备`, '#66ccff');
    });
    c.add([okBg, okTxt]);

    // 取消按钮
    const cancelBg = this.add.rectangle(cx + 80, cy + 120, 130, 34, 0x442222)
      .setStrokeStyle(1, 0xff6666).setInteractive({ useHandCursor: true });
    const cancelTxt = this.add.text(cx + 80, cy + 120, '取消', {
      fontSize:'13px', color:'#ff8866', fontFamily:'Courier New'
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
    if (this.scene && this.scene.isActive() && this.refreshInventoryTab) {
      this.time.delayedCall(0, () => {
        try {
          if (this.scene.isActive()) this.refreshInventoryTab();
        } catch (e) {
          // 静默：场景在销毁中
        }
      });
    }
  },

  _enhanceErrText(reason) {
    return ({
      no_material: '材料不足',
      no_gold: '金币不足',
      maxed: '已达最高强化等级',
      not_equipment: '不是装备'
    })[reason] || '强化失败';
  },

  openReforgeModal(eq) {
    if (!eq || eq.type !== 'equipment') return;
    if (!eq.affixes || eq.affixes.length === 0) {
      this._showPanelToast?.('该装备没有词条，无法洗练', '#ff8866');
      return;
    }
    this._closeSmithyModal();

    const reforgeSys = this.gameScene?.reforgeSystem;
    if (!reforgeSys) return;

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const cx = w / 2, cy = h / 2;

    const lockedIds = new Set();
    const locks = []; // 控件引用，用于刷新

    const c = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(cx, cy, w, h, 0, 0.6).setInteractive();
    const panel = this.add.rectangle(cx, cy, 460, 380, 0x1a1a2e, 0.98).setStrokeStyle(2, 0x66ccff);
    const title = this.add.text(cx, cy - 165, `洗练 ${eq.name}`, {
      fontSize:'15px', color:'#66ccff', fontFamily:'Courier New', fontStyle:'bold'
    }).setOrigin(0.5);
    c.add([dim, panel, title]);

    const hint = this.add.text(cx, cy - 140, '勾选最多 2 条词条锁定，其余重 roll', {
      fontSize:'10px', color:'#888899', fontFamily:'Courier New'
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
        fontSize:'14px', color:'#aaaacc', fontFamily:'Courier New'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      const lbl = this.add.text(cx - 165, y, `T${def.tier} ${def.name}: ${valText}`, {
        fontSize:'11px', color:'#cccccc', fontFamily:'Courier New'
      }).setOrigin(0, 0.5);
      box.on('pointerdown', () => {
        if (lockedIds.has(a.id)) {
          lockedIds.delete(a.id);
          box.setText('☐');
        } else {
          if (lockedIds.size >= 2) {
            this._showPanelToast?.('最多锁定 2 条词条', '#ffaa44');
            return;
          }
          lockedIds.add(a.id);
          box.setText('☑');
        }
        refreshCost();
      });
      locks.push({ a, box, lbl });
      c.add([box, lbl]);
    });

    // 成本预览
    const costText = this.add.text(cx, cy + 90, '', {
      fontSize:'11px', color:'#cccccc', fontFamily:'Courier New', align:'center', lineSpacing:3
    }).setOrigin(0.5);
    c.add(costText);

    let divineMode = false;

    const refreshCost = () => {
      const cost = reforgeSys.getCost(lockedIds.size);
      const lines = [
        `锁定: ${lockedIds.size} 条${divineMode ? '  [神圣模式]' : ''}`,
        `材料: ${cost.matId} ×${cost.count} (持有 ${this._countMatInInv(cost.matId)})`,
        `金币: ${cost.gold} (持有 ${this.gameScene.inventory.gold || 0})`
      ];
      cost.lockedExtras.forEach(e => {
        lines.push(`+ ${e.matId} ×${e.count} (持有 ${this._countMatInInv(e.matId)})`);
      });
      if (divineMode) {
        lines.push(`+ divine_heart ×1 (持有 ${this._countMatInInv('divine_heart')})`);
        lines.push('T1 词条权重 ×3');
      }
      const pity = reforgeSys.getPity(eq);
      if (pity > 0) lines.push(`保底进度: ${pity}/5（5 次未出 T1 必触发保底）`);
      costText.setText(lines.join('\n'));
    };
    refreshCost();

    // 神圣洗练切换
    const divineBg = this.add.rectangle(cx, cy + 130, 280, 22, 0x332244)
      .setStrokeStyle(1, 0x9966ff).setInteractive({ useHandCursor: true });
    const divineTxt = this.add.text(cx, cy + 130, '☐ 神圣洗练（消耗神铸之心，T1 概率 ×3）', {
      fontSize:'10px', color:'#cc99ff', fontFamily:'Courier New'
    }).setOrigin(0.5);
    divineBg.on('pointerdown', () => {
      divineMode = !divineMode;
      divineTxt.setText((divineMode ? '☑' : '☐') + ' 神圣洗练（消耗神铸之心，T1 概率 ×3）');
      refreshCost();
    });
    c.add([divineBg, divineTxt]);

    // 按钮
    const okBg = this.add.rectangle(cx - 80, cy + 165, 130, 30, 0x224422)
      .setStrokeStyle(1, 0x66ff88).setInteractive({ useHandCursor: true });
    const okTxt = this.add.text(cx - 80, cy + 165, '洗练', {
      fontSize:'13px', color:'#66ff88', fontFamily:'Courier New'
    }).setOrigin(0.5);
    okBg.on('pointerdown', () => {
      const r = reforgeSys.reforge(eq, [...lockedIds], divineMode);
      if (r.result === 'invalid') {
        this._showPanelToast?.(`洗练失败: ${r.reason}`, '#ff6666');
        return;
      }
      this._closeSmithyModal();
    });
    const cancelBg = this.add.rectangle(cx + 80, cy + 165, 130, 30, 0x442222)
      .setStrokeStyle(1, 0xff6666).setInteractive({ useHandCursor: true });
    const cancelTxt = this.add.text(cx + 80, cy + 165, '取消', {
      fontSize:'13px', color:'#ff8866', fontFamily:'Courier New'
    }).setOrigin(0.5);
    cancelBg.on('pointerdown', () => this._closeSmithyModal());
    c.add([okBg, okTxt, cancelBg, cancelTxt]);

    this._smithyModal = c;
  },

  openSocketModal(eq) {
    if (!eq || eq.type !== 'equipment' || !eq.sockets || eq.sockets.length === 0) {
      this._showPanelToast?.('该装备无孔位', '#ff8866');
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
      const panel = this.add.rectangle(cx, cy, 440, 320, 0x1a1a2e, 0.98).setStrokeStyle(2, 0xaa88ff);
      const title = this.add.text(cx, cy - 135, `孔位 ${eq.name}`, {
        fontSize:'15px', color:'#aa88ff', fontFamily:'Courier New', fontStyle:'bold'
      }).setOrigin(0.5);
      c.add([dim, panel, title]);

      eq.sockets.forEach((s, i) => {
        const y = cy - 90 + i * 36;
        const slotLabel = this.add.text(cx - 180, y, `孔 ${i+1}:`, {
          fontSize:'12px', color:'#aaaacc', fontFamily:'Courier New'
        }).setOrigin(0, 0.5);
        c.add(slotLabel);

        if (s.gemId) {
          // 已镶嵌
          const gem = GEMS[s.gemId];
          const val = gem ? gem.baseValue * (s.gemLevel || 1) : 0;
          const statLabel = { attack:'攻击', spellPower:'法强', maxHp:'生命', critRate:'暴击' }[gem?.stat] || gem?.stat || '';
          const valText = gem?.stat === 'critRate' ? `+${val.toFixed(1)}%` : `+${val}`;
          const gemName = `${gem?.icon || '◆'} ${gem?.name || s.gemId} Lv.${s.gemLevel}  ${valText} ${statLabel}`;
          const lbl = this.add.text(cx - 100, y, gemName, {
            fontSize:'11px', color:'#66ccff', fontFamily:'Courier New'
          }).setOrigin(0, 0.5);
          const unsocketBg = this.add.rectangle(cx + 130, y, 80, 24, 0x442222)
            .setStrokeStyle(1, 0xff6666).setInteractive({ useHandCursor: true });
          const unsocketTxt = this.add.text(cx + 130, y, '拆卸', {
            fontSize:'11px', color:'#ff8866', fontFamily:'Courier New'
          }).setOrigin(0.5);
          unsocketBg.on('pointerdown', () => {
            const r = gemSys.unsocket(eq, i);
            if (!r.ok) this._showPanelToast?.(`拆卸失败: ${r.reason}`, '#ff6666');
            renderModal();
          });
          c.add([lbl, unsocketBg, unsocketTxt]);
        } else {
          // 空孔
          const lbl = this.add.text(cx - 100, y, '空', {
            fontSize:'11px', color:'#777788', fontFamily:'Courier New'
          }).setOrigin(0, 0.5);
          const socketBg = this.add.rectangle(cx + 130, y, 80, 24, 0x222244)
            .setStrokeStyle(1, 0x66ccff).setInteractive({ useHandCursor: true });
          const socketTxt = this.add.text(cx + 130, y, '镶嵌', {
            fontSize:'11px', color:'#66ccff', fontFamily:'Courier New'
          }).setOrigin(0.5);
          socketBg.on('pointerdown', () => {
            openGemPicker(i);
          });
          c.add([lbl, socketBg, socketTxt]);
        }
      });

      const cancelBg = this.add.rectangle(cx, cy + 130, 130, 32, 0x442222)
        .setStrokeStyle(1, 0xff6666).setInteractive({ useHandCursor: true });
      const cancelTxt = this.add.text(cx, cy + 130, '关闭', {
        fontSize:'13px', color:'#ff8866', fontFamily:'Courier New'
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
      const panel = this.add.rectangle(cx, cy, 440, 360, 0x1a1a2e, 0.98).setStrokeStyle(2, 0xaa88ff);
      const title = this.add.text(cx, cy - 155, '选择宝石镶嵌', {
        fontSize:'14px', color:'#aa88ff', fontFamily:'Courier New', fontStyle:'bold'
      }).setOrigin(0.5);
      c.add([dim, panel, title]);

      // 列出背包所有宝石
      const gemEntries = inv.slots
        .map((s, idx) => ({ s, idx }))
        .filter(({ s }) => s && s.type === 'gem');

      if (gemEntries.length === 0) {
        const empty = this.add.text(cx, cy - 50, '背包没有宝石', {
          fontSize:'12px', color:'#888899', fontFamily:'Courier New'
        }).setOrigin(0.5);
        c.add(empty);
      } else {
        gemEntries.forEach(({ s, idx }, i) => {
          const y = cy - 110 + i * 26;
          const gem = GEMS[s.id];
          const val = gem ? gem.baseValue * (s.level || 1) : 0;
          const statLabel = { attack:'攻击', spellPower:'法强', maxHp:'生命', critRate:'暴击' }[gem?.stat] || '';
          const valText = gem?.stat === 'critRate' ? `+${val.toFixed(1)}%` : `+${val}`;
          const txt = this.add.text(cx - 180, y, `${s.icon || '◆'} ${s.name}  ${valText}${statLabel}  ×${s.quantity}`, {
            fontSize:'12px', color:'#cccccc', fontFamily:'Courier New',
            backgroundColor:'#2a2a3e', padding:{ x:6, y:3 }
          }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
          txt.on('pointerdown', () => {
            const r = gemSys.socket(eq, socketIdx, idx);
            if (!r.ok) this._showPanelToast?.(`镶嵌失败: ${r.reason}`, '#ff6666');
            renderModal();
          });
          c.add(txt);
        });
      }

      const backBg = this.add.rectangle(cx, cy + 150, 130, 32, 0x222244)
        .setStrokeStyle(1, 0x66aaff).setInteractive({ useHandCursor: true });
      const backTxt = this.add.text(cx, cy + 150, '返回', {
        fontSize:'13px', color:'#aaccff', fontFamily:'Courier New'
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
      const panel = this.add.rectangle(cx, cy, panelW, panelH, 0x1a1a2e, 0.98).setStrokeStyle(2, 0xffdd66);
      const title = this.add.text(cx, cy - panelH / 2 + 25, '宝石合成', {
        fontSize:'15px', color:'#ffdd66', fontFamily:'Courier New', fontStyle:'bold'
      }).setOrigin(0.5);
      const hint = this.add.text(cx, cy - panelH / 2 + 50, '选 3 颗同色同级宝石合成更高 1 级', {
        fontSize:'10px', color:'#888899', fontFamily:'Courier New'
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
          fontSize:'12px', color:'#888899', fontFamily:'Courier New'
        }).setOrigin(0.5);
        listContainer.add(empty);
      } else {
        gemEntries.forEach(({ s, idx }, i) => {
          const y = listTop + i * rowH + rowH / 2;
          const isSel = selected.includes(idx);
          const bg = this.add.rectangle(cx, y, listW, rowH - 4,
            isSel ? 0x3a4a3a : 0x2a2a3e)
            .setStrokeStyle(1, isSel ? 0x66ff88 : 0x5a5a7a)
            .setInteractive({ useHandCursor: true });
          const levelTag = `Lv.${s.level || 1}`;
          const gem = GEMS[s.id];
          const val = gem ? gem.baseValue * (s.level || 1) : 0;
          const statLabel = { attack:'攻击', spellPower:'法强', maxHp:'生命', critRate:'暴击' }[gem?.stat] || '';
          const valText = gem?.stat === 'critRate' ? `+${val.toFixed(1)}%` : `+${val}`;
          const txt = this.add.text(listLeft + 10, y, `${s.icon || '◆'} ${s.name} ${levelTag}  ${valText}${statLabel}  ×${s.quantity}`, {
            fontSize:'12px', color: isSel ? '#aaffaa' : '#cccccc', fontFamily:'Courier New'
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
          fontSize:'9px', color:'#666677', fontFamily:'Courier New'
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
        fontSize:'12px', color:'#ffdd66', fontFamily:'Courier New'
      }).setOrigin(0.5);
      c.add(counterText);

      const btnY = bottomY + 35;
      const enabled = selected.length === 3;
      const okBg = this.add.rectangle(cx - 80, btnY, 130, 32,
        enabled ? 0x224422 : 0x2a2a2a)
        .setStrokeStyle(1, enabled ? 0x66ff88 : 0x555555);
      if (enabled) okBg.setInteractive({ useHandCursor: true });
      const okTxt = this.add.text(cx - 80, btnY, '合成', {
        fontSize:'13px', color: enabled ? '#66ff88' : '#777777', fontFamily:'Courier New'
      }).setOrigin(0.5);
      if (enabled) {
        okBg.on('pointerdown', () => {
          const r = gemSys.fuse(selected);
          if (!r.ok) {
            this._showPanelToast?.(`合成失败: ${r.reason}`, '#ff6666');
          }
          this._closeSmithyModal();
        });
      }

      const cancelBg = this.add.rectangle(cx + 80, btnY, 130, 32, 0x442222)
        .setStrokeStyle(1, 0xff6666).setInteractive({ useHandCursor: true });
      const cancelTxt = this.add.text(cx + 80, btnY, '取消', {
        fontSize:'13px', color:'#ff8866', fontFamily:'Courier New'
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
      const panel = this.add.rectangle(cx, cy, panelW, panelH, 0x1a1a2e, 0.98).setStrokeStyle(2, 0x88ddaa);
      const title = this.add.text(cx, cy - panelH / 2 + 25, '装备制作', {
        fontSize:'15px', color:'#88ddaa', fontFamily:'Courier New', fontStyle:'bold'
      }).setOrigin(0.5);
      const hint = this.add.text(cx, cy - panelH / 2 + 50, '选择配方制作装备，材料不足时按钮禁用', {
        fontSize:'10px', color:'#888899', fontFamily:'Courier New'
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
        common:'#cccccc', uncommon:'#44cc44', rare:'#4488ff',
        epic:'#bb44ff', legendary:'#ffaa00', mythic:'#ff4444'
      };

      recipes.forEach((rcp, i) => {
        const y = listTop + i * rowH + rowH / 2;
        const check = craftSys.canCraft(rcp.id);
        const enabled = check.ok;

        const bg = this.add.rectangle(cx, y, listW - 10, rowH - 4,
          enabled ? 0x1e2e1e : 0x2a2a2a)
          .setStrokeStyle(1, enabled ? 0x448844 : 0x444444);

        const rarityColor = RARITY_COLOR[rcp.resultRarity] || '#cccccc';
        const lvlText = rcp.requiredLevel ? ` Lv.${rcp.requiredLevel}` : '';
        const lbl = this.add.text(listLeft + 15, y - 10, `${rcp.name}${lvlText}`, {
          fontSize:'12px', color: rarityColor,
          fontFamily:'Courier New', fontStyle:'bold'
        }).setOrigin(0, 0.5);

        const matsText = rcp.materials.map(m => {
          const held = this._countMatInInv(m.matId);
          const color = held >= m.count ? '' : '!';
          return `${m.matId}×${m.count}(${held})${color}`;
        }).join('  ');
        const detail = this.add.text(listLeft + 15, y + 10, `${matsText} | ${rcp.gold}金`, {
          fontSize:'9px', color: enabled ? '#aaaaaa' : '#666666', fontFamily:'Courier New'
        }).setOrigin(0, 0.5);

        const btnBg = this.add.rectangle(cx + listW / 2 - 55, y, 80, 28,
          enabled ? 0x224422 : 0x2a2a2a)
          .setStrokeStyle(1, enabled ? 0x66ff88 : 0x555555);
        if (enabled) btnBg.setInteractive({ useHandCursor: true });
        const btnTxt = this.add.text(cx + listW / 2 - 55, y, '制作', {
          fontSize:'11px', color: enabled ? '#66ff88' : '#777777',
          fontFamily:'Courier New'
        }).setOrigin(0.5);
        if (enabled) {
          btnBg.on('pointerdown', () => {
            const r = craftSys.craft(rcp.id);
            if (r.result !== 'success') {
              this._showPanelToast?.(`制作失败: ${r.reason}`, '#ff6666');
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
          fontSize:'9px', color:'#666677', fontFamily:'Courier New'
        }).setOrigin(0.5);
        c.add(scrollHint);

        this.input.on('wheel', this._craftScrollHandler = (_p, _over, _dx, dy) => {
          scrollY = Math.max(0, Math.min(maxScroll, scrollY + dy * 0.5));
          listContainer.setY(-scrollY);
        });
      }

      // 底部关闭按钮
      const btnY = cy + panelH / 2 - 40;
      const cancelBg = this.add.rectangle(cx, btnY, 130, 32, 0x442222)
        .setStrokeStyle(1, 0xff6666).setInteractive({ useHandCursor: true });
      const cancelTxt = this.add.text(cx, btnY, '关闭', {
        fontSize:'13px', color:'#ff8866', fontFamily:'Courier New'
      }).setOrigin(0.5);
      cancelBg.on('pointerdown', () => this._closeSmithyModal());
      c.add([cancelBg, cancelTxt]);

      this._smithyModal = c;
    };
    render();
  }
};
