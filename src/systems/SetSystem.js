/**
 * 套装系统 — 计算装备槽中已激活的套装件数 + 累加套装效果
 *
 * 集成方式：
 *   EquipmentSystem.getStatBonuses() 末尾会调用 setSystem.computeActiveBonuses(slots)，
 *   把 flatBonuses / bonusPct / baseBonuses 合并进总加成。
 *
 *   CharacterPanel 调用 setSystem.getActiveSets(slots) 渲染已激活套装信息。
 */
import { SETS, countSetPieces } from '../data/sets.js';
import itemData from '../data/items.json';

export class SetSystem {
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * 给定 EquipmentSystem.slots，统计件数 + 计算 bonuses
   * @returns {{ flatBonuses, bonusPct, baseBonuses, activeSets }}
   */
  computeActiveBonuses(slots) {
    const counts = countSetPieces(slots, itemData.items);
    const flatBonuses = {};
    const bonusPct = {};
    const baseBonuses = {};
    const activeSets = [];

    for (const [setId, count] of Object.entries(counts)) {
      const def = SETS[setId];
      if (!def) continue;
      const tiersActive = [];
      const tiersAll = Object.keys(def.bonuses).map(Number).sort((a, b) => a - b);
      for (const tier of tiersAll) {
        if (count >= tier) {
          const b = def.bonuses[tier];
          tiersActive.push({ tier, label: b.label });
          this._applyBonus(b, flatBonuses, bonusPct, baseBonuses);
        }
      }
      activeSets.push({
        setId,
        name: def.name,
        count,
        total: def.pieces.length,
        activeTiers: tiersActive,
        allTiers: tiersAll.map(t => ({ tier: t, label: def.bonuses[t].label, active: count >= t }))
      });
    }
    return { flatBonuses, bonusPct, baseBonuses, activeSets };
  }

  /** 仅返回展示用 activeSets */
  getActiveSets(slots) {
    return this.computeActiveBonuses(slots).activeSets;
  }

  _applyBonus(bonus, flatBonuses, bonusPct, baseBonuses) {
    const { stat, value, isFlat } = bonus;
    if (stat.startsWith('_base_')) {
      const baseStat = stat.replace('_base_', '');
      baseBonuses[baseStat] = (baseBonuses[baseStat] || 0) + value;
    } else if (isFlat) {
      flatBonuses[stat] = (flatBonuses[stat] || 0) + value;
    } else {
      bonusPct[stat] = (bonusPct[stat] || 0) + value;
    }
  }
}
