import itemData from '../data/items.json';
import { getShopConfig } from '../data/shops.js';

/**
 * 商店服务
 *
 * 库存模型：
 *   - 每个 shopId 维持一份运行时库存 stock: Array<{ id, count, basePrice }>
 *   - 首次打开（或 refresh 后）调 _generateStock 填充
 *   - 篝火休息时 refreshAll() 清空所有库存（下次打开时重新生成）
 *
 * 定价：
 *   - 基础价 = item.value × shop.priceMult
 *   - 调用 getRelation(faction, npcId) 取 discount，亲密 0.7 / 友好 0.85 / 中立 1.0
 *   - 敌对/仇恨 → 拒绝交易（discount=null）
 *
 * 事件：
 *   - shopOpened:   { shopId, npc }
 *   - shopClosed:   { shopId }
 *   - shopBought:   { shopId, item, count, gold }
 *   - shopSold:     { shopId, item, count, gold }
 *   - shopRefused:  { shopId, reason }
 */
const RARITY_BUY_MULT = {
  common: 1.0, uncommon: 1.5, rare: 2.5, epic: 4.0, legendary: 6.0, mythic: 10.0
};

export class ShopService {
  constructor(scene, initial = null) {
    this.scene = scene;
    // shopId -> Array<{id, count, basePrice}>
    this.stocks = new Map();
    if (initial?.stocks) {
      for (const [k, v] of Object.entries(initial.stocks)) {
        this.stocks.set(k, v.map(s => ({ ...s })));
      }
    }
  }

  // ─── 库存生成 ────────────────────────────────────

  _generateStock(shopId) {
    const cfg = getShopConfig(shopId);
    if (!cfg) return [];
    const items = [];

    // 1) 固定货架
    for (const it of (cfg.inventory || [])) {
      const def = itemData.items?.[it.id];
      if (!def) continue;
      items.push({
        id: it.id,
        count: it.count ?? 1,
        basePrice: it.price ?? this._calcBasePrice(def, cfg)
      });
    }

    // 2) 随机货架（简化版：不走 LootEngine.roll，直接 weighted 抽样）
    if (cfg.pool && cfg.pool.weighted?.length) {
      const min = cfg.pool.minSlots ?? 0;
      const max = cfg.pool.maxSlots ?? min;
      const slots = min + Math.floor(Math.random() * (max - min + 1));
      const totalW = cfg.pool.weighted.reduce((s, e) => s + (e.weight || 1), 0);
      for (let i = 0; i < slots; i++) {
        let r = Math.random() * totalW;
        let picked = cfg.pool.weighted[0];
        for (const w of cfg.pool.weighted) {
          r -= (w.weight || 1);
          if (r <= 0) { picked = w; break; }
        }
        const def = itemData.items?.[picked.id];
        if (!def) continue;
        let count = 1;
        if (Array.isArray(picked.count)) {
          const [a, b] = picked.count;
          count = a + Math.floor(Math.random() * (b - a + 1));
        }
        items.push({
          id: picked.id,
          count,
          basePrice: this._calcBasePrice(def, cfg)
        });
      }
    }

    return items;
  }

  _calcBasePrice(itemDef, shopCfg) {
    const baseValue = itemDef.value ?? itemDef.sellPrice ?? 10;
    const rarityMult = RARITY_BUY_MULT[itemDef.rarity] ?? 1.0;
    const mult = shopCfg.priceMult ?? 1.0;
    return Math.max(1, Math.round(baseValue * rarityMult * mult));
  }

  // ─── 打开/关闭 ──────────────────────────────────

  open(shopId, npc = null) {
    const cfg = getShopConfig(shopId);
    if (!cfg) return false;

    // 关系检查：敌对/仇恨不卖
    if (npc) {
      const fs = this.scene.factionSystem;
      if (fs) {
        const rel = fs.getRelation(npc.faction, npc.id);
        if (rel.discount == null) {
          this.scene.events.emit('shopRefused', { shopId, reason: 'hostile' });
          this.scene.events.emit('showMessage', `[${npc.name}] 拒绝与你交易`);
          return false;
        }
      }
    }

    if (!this.stocks.has(shopId)) {
      this.stocks.set(shopId, this._generateStock(shopId));
    }
    this.scene.events.emit('shopOpened', { shopId, npc });
    return true;
  }

  close(shopId) {
    this.scene.events.emit('shopClosed', { shopId });
  }

  // ─── 查询 ───────────────────────────────────────

  getStock(shopId) {
    return this.stocks.get(shopId) || [];
  }

  getDiscount(npc) {
    if (!npc) return 1.0;
    const fs = this.scene.factionSystem;
    if (!fs) return 1.0;
    const rel = fs.getRelation(npc.faction, npc.id);
    return rel.discount ?? 1.0;
  }

  getBuyPrice(shopId, idx, npc) {
    const slot = this.getStock(shopId)[idx];
    if (!slot) return 0;
    return Math.max(1, Math.round(slot.basePrice * this.getDiscount(npc)));
  }

  getSellPrice(item, npc) {
    const cfg = npc?.shopId ? getShopConfig(npc.shopId) : null;
    const rate = cfg?.sellbackRate ?? 0.3;
    const base = item?.sellPrice || Math.floor((item?.value || 0) * 0.3);
    // 关系越好回收略多（讨好奖励小）
    const relMult = 0.85 + (1 - this.getDiscount(npc)) * 0.5;
    return Math.max(1, Math.round(base * rate * relMult * 10));
  }

  // ─── 买卖 ───────────────────────────────────────

  buy(shopId, idx, count, npc) {
    const stock = this.getStock(shopId);
    const slot = stock[idx];
    if (!slot) return false;
    const buyCount = Math.min(count, slot.count);
    if (buyCount <= 0) return false;

    const unitPrice = this.getBuyPrice(shopId, idx, npc);
    const totalPrice = unitPrice * buyCount;
    const inv = this.scene.inventory;
    if (!inv || (inv.gold || 0) < totalPrice) {
      this.scene.events.emit('showMessage', '金币不足');
      return false;
    }

    const def = itemData.items?.[slot.id];
    if (!def) return false;

    // 扣钱 + 加包
    inv.gold = (inv.gold || 0) - totalPrice;
    const itemPayload = { ...def, id: slot.id };
    inv.addItem(itemPayload, buyCount);
    slot.count -= buyCount;
    if (slot.count <= 0) {
      stock.splice(idx, 1);
    }

    // 声誉 +1（每次成功购买）
    if (npc?.faction) {
      this.scene.factionSystem?.applyDelta(npc.faction, 'shop_purchase', `buy:${slot.id}`);
    }

    this.scene.events.emit('shopBought', { shopId, item: def, count: buyCount, gold: totalPrice });
    this.scene.events.emit('goldChanged', inv.gold);
    return true;
  }

  /** 玩家把背包某 slotIndex 物品卖给商店 */
  sell(shopId, inventorySlotIndex, count, npc) {
    const inv = this.scene.inventory;
    if (!inv) return false;
    const slot = inv.getSlot?.(inventorySlotIndex);
    if (!slot) return false;
    // 不允许卖任务物品/货币
    if (slot.type === 'quest' || slot.type === 'currency') {
      this.scene.events.emit('showMessage', '该物品无法出售');
      return false;
    }
    const sellCount = Math.min(count, slot.quantity || 1);
    if (sellCount <= 0) return false;

    const unitPrice = this.getSellPrice(slot, npc);
    const totalPrice = unitPrice * sellCount;

    inv.removeItem(inventorySlotIndex, sellCount);
    inv.gold = (inv.gold || 0) + totalPrice;

    if (npc?.faction) {
      this.scene.factionSystem?.applyDelta(npc.faction, 'shop_sell', `sell:${slot.id}`);
    }

    this.scene.events.emit('shopSold', { shopId, item: slot, count: sellCount, gold: totalPrice });
    this.scene.events.emit('goldChanged', inv.gold);
    return true;
  }

  // ─── 刷新 ───────────────────────────────────────

  refresh(shopId) {
    this.stocks.delete(shopId);
  }

  refreshAll() {
    this.stocks.clear();
  }

  // ─── 序列化 ─────────────────────────────────────

  serialize() {
    return {
      stocks: Object.fromEntries(
        [...this.stocks.entries()].map(([k, v]) => [k, v.map(s => ({ ...s }))])
      )
    };
  }

  static deserialize(scene, data) {
    return new ShopService(scene, data || null);
  }
}
