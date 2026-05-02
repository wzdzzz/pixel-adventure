import { MATERIALS, getEnhanceCost, getEnhanceSuccessRate } from '../../data/materials.js';

/**
 * 强化/分解小窗口（modal in PanelScene）
 *
 * 通过 this.openEnhanceModal(slotIndex) / this.openDecomposeModal(slotIndex) 打开。
 * Mixin 到 PanelScene，复用 PanelScene 的 add / cameras / events / gameScene。
 */
export const SmithyPanel = {
  openEnhanceModal(slotIndex) {
    const inv = this.gameScene?.inventory;
    const eq = inv?.slots?.[slotIndex];
    if (!eq || eq.type !== 'equipment') return;
    this._closeSmithyModal();

    const enh = eq.enhanceLevel || 0;
    const cost = getEnhanceCost(enh);
    const rate = getEnhanceSuccessRate(enh);
    const matName = cost ? (MATERIALS[cost.matId]?.name || cost.matId) : '';

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const cx = w / 2, cy = h / 2;

    const c = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(cx, cy, w, h, 0, 0.6).setInteractive();
    const panel = this.add.rectangle(cx, cy, 360, 240, 0x1a1a2e, 0.98).setStrokeStyle(2, 0xffaa44);
    const title = this.add.text(cx, cy - 95, `强化 ${eq.name} +${enh}`, {
      fontSize:'15px', color:'#ffdd66', fontFamily:'Courier New', fontStyle:'bold'
    }).setOrigin(0.5);

    const info = enh >= 15
      ? this.add.text(cx, cy - 30, '已达最高强化等级 +15', {
          fontSize:'12px', color:'#aaaaaa', fontFamily:'Courier New'
        }).setOrigin(0.5)
      : this.add.text(cx, cy - 30,
          `下一级: +${enh+1}\n材料: ${matName} ×${cost.count}\n金币: ${cost.gold}\n成功率: ${(rate*100).toFixed(0)}%`,
          { fontSize:'12px', color:'#cccccc', fontFamily:'Courier New', align:'center', lineSpacing:4 }
        ).setOrigin(0.5);

    c.add([dim, panel, title, info]);

    if (enh < 15) {
      const okBg = this.add.rectangle(cx - 70, cy + 70, 110, 32, 0x224422)
        .setStrokeStyle(1, 0x66ff88).setInteractive({ useHandCursor: true });
      const okTxt = this.add.text(cx - 70, cy + 70, '强化', {
        fontSize:'13px', color:'#66ff88', fontFamily:'Courier New'
      }).setOrigin(0.5);
      okBg.on('pointerdown', () => {
        const r = this.gameScene.enhanceSystem.enhance(slotIndex);
        if (r && r.result === 'invalid') {
          this._showPanelToast?.(this._enhanceErrText(r.reason), '#ff6666');
        }
        this._closeSmithyModal();
        if (this.refreshInventoryTab) this.refreshInventoryTab();
      });
      c.add([okBg, okTxt]);
    }

    const cancelBg = this.add.rectangle(cx + 70, cy + 70, 110, 32, 0x442222)
      .setStrokeStyle(1, 0xff6666).setInteractive({ useHandCursor: true });
    const cancelTxt = this.add.text(cx + 70, cy + 70, '取消', {
      fontSize:'13px', color:'#ff8866', fontFamily:'Courier New'
    }).setOrigin(0.5);
    cancelBg.on('pointerdown', () => this._closeSmithyModal());
    c.add([cancelBg, cancelTxt]);

    this._smithyModal = c;
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

  _closeSmithyModal() {
    if (this._smithyModal) {
      this._smithyModal.destroy();
      this._smithyModal = null;
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
