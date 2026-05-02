import { MATERIALS, getEnhanceCost, getEnhanceSuccessRate } from '../../data/materials.js';

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
      infoLines = [
        `下一级: +${enh+1}`,
        `成功率: ${(rate*100).toFixed(0)}%`,
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
  }
};
