import { AFFIXES, AFFIX_COUNTS, rollAffixes } from '../data/affixes.js';
import itemData from '../data/items.json';

const REFORGE_COSTS = {
  0: { matId:'chaos_essence', count: 2, gold: 1000, lockedExtras: [] },
  1: { matId:'chaos_essence', count: 3, gold: 2000, lockedExtras: [{ matId:'soul_crystal', count: 1 }] },
  2: { matId:'chaos_essence', count: 4, gold: 4000, lockedExtras: [{ matId:'soul_crystal', count: 3 }] }
};

/**
 * 洗练系统：重 roll 装备词条
 * - 0 锁：基础消耗
 * - 1-2 锁：保留指定词条不变 + 额外消耗灵魂结晶
 */
export class ReforgeSystem {
  constructor(scene) {
    this.scene = scene;
  }

  getCost(lockCount) {
    return REFORGE_COSTS[Math.min(2, Math.max(0, lockCount))];
  }

  canReforge(eq, lockedAffixIds = []) {
    if (!eq || eq.type !== 'equipment') return { ok:false, reason:'not_equipment' };
    if (!Array.isArray(eq.affixes) || eq.affixes.length === 0)
      return { ok:false, reason:'no_affixes' };
    const lockCount = lockedAffixIds.length;
    if (lockCount > 2) return { ok:false, reason:'too_many_locks' };

    const cost = this.getCost(lockCount);
    const inv = this.scene.inventory;
    if (this._countMat(cost.matId) < cost.count) return { ok:false, reason:'no_material', cost };
    if ((inv.gold || 0) < cost.gold) return { ok:false, reason:'no_gold', cost };
    for (const extra of cost.lockedExtras) {
      if (this._countMat(extra.matId) < extra.count)
        return { ok:false, reason:'no_material_extra', cost };
    }
    return { ok:true, cost };
  }

  reforge(eq, lockedAffixIds = []) {
    const check = this.canReforge(eq, lockedAffixIds);
    if (!check.ok) return { result:'invalid', reason: check.reason };

    const inv = this.scene.inventory;
    const cost = check.cost;
    this._consumeMat(cost.matId, cost.count);
    cost.lockedExtras.forEach(e => this._consumeMat(e.matId, e.count));
    inv.gold -= cost.gold;
    this.scene.events.emit('goldChanged', inv.gold);

    // 保留锁定词条
    const locked = eq.affixes.filter(a => lockedAffixIds.includes(a.id));
    const lockedStats = new Set(locked.map(a => AFFIXES[a.id]?.stat).filter(Boolean));

    // 重 roll 剩余词条数（避免锁定的 stat）
    const tpl = itemData.items[eq.templateId];
    const totalCount = AFFIX_COUNTS[eq.rarity] || 0;
    const remainCount = totalCount - locked.length;
    const candidates = (tpl?.affixPools || []).flatMap(p =>
      Object.values(AFFIXES).filter(a => a.pool === p)
    );
    const newAffixes = [];
    const usedStats = new Set(lockedStats);
    for (let i = 0; i < remainCount; i++) {
      const filtered = candidates.filter(c =>
        !usedStats.has(c.stat) &&
        // minRarity 过滤
        ['common','uncommon','rare','epic','legendary','mythic'].indexOf(c.minRarity) <=
        ['common','uncommon','rare','epic','legendary','mythic'].indexOf(eq.rarity)
      );
      if (!filtered.length) break;
      const totalW = filtered.reduce((s, a) => s + (a.weight || 1), 0);
      let roll = Math.random() * totalW;
      let picked = filtered[filtered.length - 1];
      for (const a of filtered) {
        roll -= (a.weight || 1);
        if (roll <= 0) { picked = a; break; }
      }
      const [lo, hi] = picked.valueRange;
      const value = lo + Math.random() * (hi - lo);
      newAffixes.push({ id: picked.id, value: Math.round(value * 100) / 100 });
      usedStats.add(picked.stat);
    }

    eq.affixes = [...locked, ...newAffixes];
    this.scene.equipmentSystem._applyBonuses();
    this.scene.events.emit('inventoryUpdated', inv.slots);
    this.scene.events.emit('showMessage', '洗练完成', '#66ccff');
    return { result:'success' };
  }

  _countMat(matId) {
    return this.scene.inventory.slots.reduce((sum, s) =>
      s && s.id === matId ? sum + (s.quantity || 0) : sum, 0);
  }

  _consumeMat(matId, count) {
    const inv = this.scene.inventory;
    let remaining = count;
    for (let i = 0; i < inv.slots.length && remaining > 0; i++) {
      const s = inv.slots[i];
      if (s && s.id === matId) {
        const take = Math.min(remaining, s.quantity);
        s.quantity -= take;
        remaining -= take;
        if (s.quantity <= 0) inv.slots[i] = null;
      }
    }
  }
}
