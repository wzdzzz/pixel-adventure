import Phaser from 'phaser';
import itemData from '../data/items.json';

/**
 * ShopPanel — 商店双栏 UI（左：商店货架 / 右：玩家背包）
 *
 * 与 DialoguePanel 一样直接挂在 MainGameScene 之上（不走 PanelScene tab 系统），
 * 通过 ShopService 驱动。
 *
 * 操作：
 *   - 点击商店物品 → 买 1
 *   - 右键商店物品 → 买 5（如果不够则尽量买）
 *   - 点击背包物品 → 卖 1
 *   - 右键背包物品 → 卖全
 *   - ESC 关闭
 */
export class ShopPanel {
  constructor(scene, shopService, displayScene = null) {
    this.scene = scene;
    this.displayScene = displayScene || scene;
    this.service = shopService;
    this.visible = false;
    this.shopId = null;
    this.npc = null;

    this._build();
    this._listen();
  }

  _build() {
    const W = 1100, H = 660;
    const cx = 1920 / 2, cy = 1080 / 2;
    this.container = this.displayScene.add.container(cx, cy)
      .setDepth(9991).setScrollFactor(0).setVisible(false);

    this.bg = this.displayScene.add.rectangle(0, 0, W, H, 0x141420, 0.97)
      .setStrokeStyle(2, 0xffaa44);
    this.border = this.displayScene.add.rectangle(0, 0, W + 6, H + 6, 0, 0)
      .setStrokeStyle(1, 0xffaa44, 0.3);

    // Title
    this.titleText = this.displayScene.add.text(0, -H / 2 + 24, '商店', {
      fontSize: '24px',
      fill: '#ffcc66',
      fontFamily: 'Courier New',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);

    this.relationText = this.displayScene.add.text(W / 2 - 24, -H / 2 + 24, '', {
      fontSize: '14px',
      fill: '#aaaaaa',
      fontFamily: 'Courier New'
    }).setOrigin(1, 0);

    // 中间分隔线
    this.divider = this.displayScene.add.line(0, 0, 0, -H / 2 + 60, 0, H / 2 - 40, 0xffaa44, 0.4)
      .setLineWidth(1);

    // 左侧标题
    this.leftTitle = this.displayScene.add.text(-W / 4, -H / 2 + 70, '商店货架', {
      fontSize: '18px',
      fill: '#ffffff',
      fontFamily: 'Courier New'
    }).setOrigin(0.5, 0);

    // 右侧标题
    this.rightTitle = this.displayScene.add.text(W / 4, -H / 2 + 70, '我的背包', {
      fontSize: '18px',
      fill: '#ffffff',
      fontFamily: 'Courier New'
    }).setOrigin(0.5, 0);

    // 金币显示
    this.goldText = this.displayScene.add.text(0, H / 2 - 28, '', {
      fontSize: '18px',
      fill: '#ffdd44',
      fontFamily: 'Courier New',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0.5);

    // 提示
    this.hintText = this.displayScene.add.text(0, H / 2 - 4, '左键买/卖 1   右键买/卖 全部   [ESC] 关闭', {
      fontSize: '12px',
      fill: '#888888',
      fontFamily: 'Courier New'
    }).setOrigin(0.5, 0.5);

    // 滚动容器（列表项动态创建/销毁）
    this.leftItems = [];
    this.rightItems = [];

    this.container.add([
      this.border, this.bg, this.titleText, this.relationText, this.divider,
      this.leftTitle, this.rightTitle, this.goldText, this.hintText
    ]);

    // ESC 关闭
    this.displayScene.input.keyboard.on('keydown-ESC', () => {
      if (this.visible) this.hide();
    });
  }

  _listen() {
    this.scene.events.on('shopOpened', ({ shopId, npc }) => this.show(shopId, npc));
    this.scene.events.on('shopClosed', () => this.hide());
    this.scene.events.on('shopBought', () => this.refresh());
    this.scene.events.on('shopSold', () => this.refresh());
    this.scene.events.on('inventoryUpdated', () => { if (this.visible) this.refresh(); });
    this.scene.events.on('goldChanged', () => { if (this.visible) this._refreshGold(); });
  }

  show(shopId, npc) {
    this.shopId = shopId;
    this.npc = npc;
    this.visible = true;
    this.container.setVisible(true);
    this.titleText.setText(npc?.name ? `${npc.name} 的商店` : '商店');
    this._refreshRelation();
    this.refresh();
    // 暂停玩家移动
    if (this.scene.player) this.scene.player.canInteract = false;
    this.scene.uiBlocking = true;
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.container.setVisible(false);
    this._clearItems();
    this.service?.close(this.shopId);
    this.shopId = null;
    this.npc = null;
    if (this.scene.player) this.scene.player.canInteract = true;
    this.scene.uiBlocking = false;
  }

  refresh() {
    if (!this.visible) return;
    this._clearItems();
    this._renderShop();
    this._renderInventory();
    this._refreshGold();
  }

  _refreshGold() {
    const gold = this.scene.inventory?.gold ?? 0;
    this.goldText.setText(`💰 ${gold} G`);
  }

  _refreshRelation() {
    if (!this.npc) { this.relationText.setText(''); return; }
    const fs = this.scene.factionSystem;
    if (!fs) return;
    const rel = fs.getRelation(this.npc.faction, this.npc.id);
    const discountPct = rel.discount != null ? Math.round((1 - rel.discount) * 100) : null;
    const dlabel = discountPct != null ? `折扣 ${discountPct}%` : '拒绝交易';
    this.relationText.setText(`${rel.emoji} ${rel.label}（${dlabel}）`);
  }

  _clearItems() {
    for (const item of this.leftItems) item.destroy();
    for (const item of this.rightItems) item.destroy();
    this.leftItems = [];
    this.rightItems = [];
  }

  _renderShop() {
    const stock = this.service.getStock(this.shopId);
    const baseX = -1100 / 4;
    const baseY = -660 / 2 + 110;
    const rowH = 36;
    if (stock.length === 0) {
      const t = this.displayScene.add.text(baseX, baseY, '（货架空空如也）', {
        fontSize: '14px', fill: '#777777', fontFamily: 'Courier New'
      }).setOrigin(0.5, 0);
      this.container.add(t);
      this.leftItems.push(t);
      return;
    }

    for (let i = 0; i < stock.length; i++) {
      const slot = stock[i];
      const def = itemData.items?.[slot.id] || {};
      const price = this.service.getBuyPrice(this.shopId, i, this.npc);
      const text = `${def.name || slot.id} ×${slot.count}   ${price} G`;
      const row = this.displayScene.add.text(baseX, baseY + i * rowH, text, {
        fontSize: '15px', fill: this._rarityColor(def.rarity), fontFamily: 'Courier New'
      }).setOrigin(0.5, 0);
      row.setInteractive({ useHandCursor: true });
      row.on('pointerover', () => row.setBackgroundColor('#3a3a44'));
      row.on('pointerout', () => row.setBackgroundColor(null));
      row.on('pointerdown', (e) => {
        const count = e.rightButtonDown() ? 5 : 1;
        this.service.buy(this.shopId, i, count, this.npc);
      });
      this.container.add(row);
      this.leftItems.push(row);
    }
  }

  _renderInventory() {
    const inv = this.scene.inventory;
    if (!inv?.getItems) return;
    const slots = inv.getItems();
    const baseX = 1100 / 4;
    const baseY = -660 / 2 + 110;
    const rowH = 36;

    let visIdx = 0;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot) continue;
      // 跳过 quest/currency
      if (slot.type === 'quest' || slot.type === 'currency') continue;
      const price = this.service.getSellPrice(slot, this.npc);
      const text = `${slot.name || slot.id} ×${slot.quantity || 1}   ${price} G`;
      const row = this.displayScene.add.text(baseX, baseY + visIdx * rowH, text, {
        fontSize: '15px', fill: this._rarityColor(slot.rarity), fontFamily: 'Courier New'
      }).setOrigin(0.5, 0);
      row.setInteractive({ useHandCursor: true });
      row.on('pointerover', () => row.setBackgroundColor('#3a3a44'));
      row.on('pointerout', () => row.setBackgroundColor(null));
      const slotIdx = i;
      row.on('pointerdown', (e) => {
        const count = e.rightButtonDown() ? (slot.quantity || 1) : 1;
        this.service.sell(this.shopId, slotIdx, count, this.npc);
      });
      this.container.add(row);
      this.rightItems.push(row);
      visIdx++;
    }

    if (visIdx === 0) {
      const t = this.displayScene.add.text(baseX, baseY, '（无可出售物品）', {
        fontSize: '14px', fill: '#777777', fontFamily: 'Courier New'
      }).setOrigin(0.5, 0);
      this.container.add(t);
      this.rightItems.push(t);
    }
  }

  _rarityColor(rarity) {
    const map = {
      common: '#cccccc', uncommon: '#44ff44', rare: '#4488ff',
      epic: '#cc44ff', legendary: '#ffaa00', mythic: '#ff4444'
    };
    return map[rarity] || '#ffffff';
  }
}
