/**
 * 商店配置（纯数据）
 *
 * 字段：
 *   id            商店唯一 id（被 NPC.shopId 引用）
 *   name          显示名
 *   inventory     固定货架物品 [{id, count, price?}]（price 未设则用 items.json value × 倍率）
 *   pool          随机货架（每次 refresh 时 generateLoot 出来）
 *                 {minSlots, maxSlots, weighted: [{id, weight, count?:[min,max]}], rarityBias?: {common:..., uncommon:...}}
 *   refresh       'bonfire' | 'never' | 'time:<ms>' （目前仅实现 bonfire / never）
 *   sellbackRate  玩家卖给商店时的回收比例（默认 0.3）
 *   priceMult     全局价格倍数（默认 1.0）
 */
export const SHOPS = {
  tom_shop: {
    id: 'tom_shop',
    name: '炼器师石崇山的货架',
    inventory: [
      { id: 'potion', count: 5 },
      { id: 'mana_potion', count: 3 }
    ],
    pool: {
      minSlots: 2,
      maxSlots: 4,
      weighted: [
        { id: 'rusty_dagger', weight: 30 },
        { id: 'copper_ring', weight: 20 },
        { id: 'leather_cap', weight: 20 },
        { id: 'apprentice_staff', weight: 10 }
      ]
    },
    refresh: 'bonfire',
    sellbackRate: 0.35,
    priceMult: 1.0
  }
};

export function getShopConfig(id) {
  return SHOPS[id] || null;
}
