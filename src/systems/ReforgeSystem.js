import { AFFIXES, AFFIX_COUNTS, rollAffixes } from '../data/affixes.js';
import itemData from '../data/items.json';

const REFORGE_COSTS = {
  0: { matId:'chaos_essence', count: 2, gold: 1000, lockedExtras: [] },
  1: { matId:'chaos_essence', count: 3, gold: 2000, lockedExtras: [{ matId:'soul_crystal', count: 1 }] },
  2: { matId:'chaos_essence', count: 4, gold: 4000, lockedExtras: [{ matId:'soul_crystal', count: 3 }] }
};

/** 神圣洗练额外消耗（叠加在普通成本之上） */
const DIVINE_EXTRA_COST = { matId: 'divine_heart', count: 1 };

/** 保底阈值：连续 N 次未出 T1 → 下次必出至少一条 T1 */
const PITY_THRESHOLD = 5;

/** 神圣洗练 T1 权重倍率 */
const DIVINE_T1_WEIGHT_MULT = 3;

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

  /**
   * 取实例的保底计数（缺则 0）
   */
  getPity(eq) {
    return eq?.reforgePity || 0;
  }

  canReforge(eq, lockedAffixIds = [], divine = false) {
    if (!eq || eq.type !== 'equipment') return { ok:false, reason:'not_equipment' };
    if (!Array.isArray(eq.affixes) || eq.affixes.length === 0)
      return { ok:false, reason:'no_affixes' };
    const lockCount = lockedAffixIds.length;
    if (lockCount > 2) return { ok:false, reason:'too_many_locks' };

    const cost = this.getCost(lockCount);
    const inv = this.scene.inventory;
    if (this._countMat(cost.matId) < cost.count) return { ok:false, reason:'no_material', cost, divine };
    if ((inv.gold || 0) < cost.gold) return { ok:false, reason:'no_gold', cost, divine };
    for (const extra of cost.lockedExtras) {
      if (this._countMat(extra.matId) < extra.count)
        return { ok:false, reason:'no_material_extra', cost, divine };
    }
    if (divine && this._countMat(DIVINE_EXTRA_COST.matId) < DIVINE_EXTRA_COST.count) {
      return { ok:false, reason:'no_divine_heart', cost, divine };
    }
    return { ok:true, cost, divine };
  }

  reforge(eq, lockedAffixIds = [], divine = false) {
    const check = this.canReforge(eq, lockedAffixIds, divine);
    if (!check.ok) return { result:'invalid', reason: check.reason };

    const inv = this.scene.inventory;
    const cost = check.cost;
    this._consumeMat(cost.matId, cost.count);
    cost.lockedExtras.forEach(e => this._consumeMat(e.matId, e.count));
    if (divine) this._consumeMat(DIVINE_EXTRA_COST.matId, DIVINE_EXTRA_COST.count);
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

    // 保底：连续 N 次没出 T1 → 本次必出至少 1 条 T1（如池中存在）
    const pity = this.getPity(eq);
    const pityActive = pity >= PITY_THRESHOLD;

    const newAffixes = [];
    const usedStats = new Set(lockedStats);
    let gotT1 = locked.some(a => AFFIXES[a.id]?.tier === 1);

    for (let i = 0; i < remainCount; i++) {
      let filtered = candidates.filter(c =>
        !usedStats.has(c.stat) &&
        ['common','uncommon','rare','epic','legendary','mythic'].indexOf(c.minRarity) <=
        ['common','uncommon','rare','epic','legendary','mythic'].indexOf(eq.rarity)
      );
      if (!filtered.length) break;

      // 保底：最后一次还没出 T1 → 强制只从 T1 池里抽
      const isLastChance = (i === remainCount - 1) && pityActive && !gotT1;
      if (isLastChance) {
        const t1Only = filtered.filter(c => c.tier === 1);
        if (t1Only.length) filtered = t1Only;
      }

      // 神圣洗练：T1 词条权重 ×3
      const totalW = filtered.reduce((s, a) => {
        const w = (a.weight || 1) * (divine && a.tier === 1 ? DIVINE_T1_WEIGHT_MULT : 1);
        return s + w;
      }, 0);
      let roll = Math.random() * totalW;
      let picked = filtered[filtered.length - 1];
      for (const a of filtered) {
        const w = (a.weight || 1) * (divine && a.tier === 1 ? DIVINE_T1_WEIGHT_MULT : 1);
        roll -= w;
        if (roll <= 0) { picked = a; break; }
      }
      const [lo, hi] = picked.valueRange;
      const value = lo + Math.random() * (hi - lo);
      newAffixes.push({ id: picked.id, value: Math.round(value * 100) / 100 });
      usedStats.add(picked.stat);
      if (picked.tier === 1) gotT1 = true;
    }

    eq.affixes = [...locked, ...newAffixes];
    eq.reforgePity = gotT1 ? 0 : (pity + 1);

    this.scene.equipmentSystem._applyBonuses();
    this.scene.events.emit('inventoryUpdated', inv.slots);
    this.scene.events.emit('showMessage',
      gotT1 ? (divine ? '神圣洗练成功！触发 T1 词条' : '洗练完成 — T1 觉醒')
            : (divine ? '神圣洗练完成' : '洗练完成'),
      gotT1 ? '#ffaa44' : '#66ccff');
    return { result:'success', gotT1, divine };
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
