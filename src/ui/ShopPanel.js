import Phaser from 'phaser';
import itemData from '../data/items.json';
import { THEME_CONFIG } from '../config/themeConfig.js';
import { getRarityTheme, UI_THEME } from '../config/uiTheme.js';

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

    this.bg = this.displayScene.add.rectangle(0, 0, W, H, UI_THEME.colors.panel, 0.98)
      .setStrokeStyle(2, UI_THEME.colors.brass);
    this.border = this.displayScene.add.rectangle(0, 0, W + 6, H + 6, 0, 0)
      .setStrokeStyle(1, UI_THEME.colors.brass, 0.3);

    // Title
    this.titleText = this.displayScene.add.text(0, -H / 2 + 24, '坊市商铺', {
      fontSize: '24px',
      fill: UI_THEME.text.brass,
      fontFamily: UI_THEME.font.body,
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);

    this.relationText = this.displayScene.add.text(W / 2 - 24, -H / 2 + 24, '', {
      fontSize: '14px',
      fill: UI_THEME.text.muted,
      fontFamily: UI_THEME.font.body
    }).setOrigin(1, 0);

    // 中间分隔线
    this.divider = this.displayScene.add.line(0, 0, 0, -H / 2 + 60, 0, H / 2 - 40, UI_THEME.colors.brassMuted, 0.55)
      .setLineWidth(1);

    // 左侧标题
    this.leftTitle = this.displayScene.add.text(-W / 4, -H / 2 + 70, '商铺货架', {
      fontSize: '18px',
      fill: UI_THEME.text.paper,
      fontFamily: UI_THEME.font.body
    }).setOrigin(0.5, 0);

    // 右侧标题
    this.rightTitle = this.displayScene.add.text(W / 4, -H / 2 + 70, '我的行囊', {
      fontSize: '18px',
      fill: UI_THEME.text.paper,
      fontFamily: UI_THEME.font.body
    }).setOrigin(0.5, 0);

    // 金币显示
    this.goldText = this.displayScene.add.text(0, H / 2 - 28, '', {
      fontSize: '18px',
      fill: UI_THEME.text.brass,
      fontFamily: UI_THEME.font.body,
      fontStyle: 'bold'
    }).setOrigin(0.5, 0.5);

    // 提示
    this.hintText = this.displayScene.add.text(0, H / 2 - 4, '左键买/卖 1   右键买/卖 全部   [ESC] 关闭', {
      fontSize: '12px',
      fill: UI_THEME.text.muted,
      fontFamily: UI_THEME.font.mono
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
    // 存引用以便 shutdown 时解绑（MainGameScene 单例复用，否则陈旧面板
    // 监听器会在已销毁的 UIScene 文本上操作导致 drawImage 崩溃）
    this._handlers = {
      shopOpened: ({ shopId, npc }) => this.show(shopId, npc),
      shopClosed: () => this.hide(),
      shopBought: () => this.refresh(),
      shopSold: () => this.refresh(),
      inventoryUpdated: () => { if (this.visible) this.refresh(); },
      goldChanged: () => { if (this.visible) this._refreshGold(); },
    };
    for (const ev in this._handlers) this.scene.events.on(ev, this._handlers[ev]);
    this.scene.events.once('shutdown', this.destroy, this);
    this.scene.events.once('destroy', this.destroy, this);
  }

  /** 解绑场景事件 + 销毁显示对象，防止场景重启后监听器泄漏。 */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this.scene && this.scene.events && this._handlers) {
      for (const ev in this._handlers) this.scene.events.off(ev, this._handlers[ev]);
    }
    if (this.container) { try { this.container.destroy(); } catch (e) { /* UIScene 可能已销毁 */ } this.container = null; }
  }

  show(shopId, npc) {
    this.shopId = shopId;
    this.npc = npc;
    this.visible = true;
    this.container.setVisible(true);
    this.titleText.setText(npc?.name ? `${npc.name}的铺面` : '坊市商铺');
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
    this.goldText.setText(`${THEME_CONFIG.currency} ${gold}`);
  }

  _refreshRelation() {
    if (!this.npc) { this.relationText.setText(''); return; }
    const fs = this.scene.factionSystem;
    if (!fs) return;
    const rel = fs.getRelation(this.npc.faction, this.npc.id);
    const discountPct = rel.discount != null ? Math.round((1 - rel.discount) * 100) : null;
    const dlabel = discountPct != null ? `折扣 ${discountPct}%` : '拒绝交易';
    this.relationText.setText(`${rel.label}（${dlabel}）`);
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
        fontSize: '14px', fill: UI_THEME.text.disabled, fontFamily: UI_THEME.font.body
      }).setOrigin(0.5, 0);
      this.container.add(t);
      this.leftItems.push(t);
      return;
    }

    for (let i = 0; i < stock.length; i++) {
      const slot = stock[i];
      const def = itemData.items?.[slot.id] || {};
      const price = this.service.getBuyPrice(this.shopId, i, this.npc);
      const text = `${def.name || slot.id} ×${slot.count}   ${price} ${THEME_CONFIG.currency}`;
      const row = this.displayScene.add.text(baseX, baseY + i * rowH, text, {
        fontSize: '15px', fill: this._rarityColor(def.rarity), fontFamily: UI_THEME.font.body
      }).setOrigin(0.5, 0);
      row.setInteractive({ useHandCursor: true });
      row.on('pointerover', () => row.setBackgroundColor('#233a31'));
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
      const text = `${slot.name || slot.id} ×${slot.quantity || 1}   ${price} ${THEME_CONFIG.currency}`;
      const row = this.displayScene.add.text(baseX, baseY + visIdx * rowH, text, {
        fontSize: '15px', fill: this._rarityColor(slot.rarity), fontFamily: UI_THEME.font.body
      }).setOrigin(0.5, 0);
      row.setInteractive({ useHandCursor: true });
      row.on('pointerover', () => row.setBackgroundColor('#233a31'));
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
        fontSize: '14px', fill: UI_THEME.text.disabled, fontFamily: UI_THEME.font.body
      }).setOrigin(0.5, 0);
      this.container.add(t);
      this.rightItems.push(t);
    }
  }

  _rarityColor(rarity) {
    return getRarityTheme(rarity).text;
  }
}
