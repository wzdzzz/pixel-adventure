/**
 * 套装数据
 *
 * 每套 6 件，2/4/6 件激活效果。bonus 通道：
 *   - flatBonuses[stat] += value （isFlat:true）
 *   - bonusPct[stat]    += value （isFlat:false，期望 [0..1]）
 *   - baseBonuses[stat] += value （stat 以 _base_ 开头，作用于 con/str/...）
 *
 * 装备 instance 的 setId 来自 items.json template 的 setId 字段（运行时查表）。
 */
export const SETS = {
  warrior_legacy: {
    id: 'warrior_legacy',
    name: '远征战士套装',
    pieces: ['iron_sword', 'guardian_plate', 'iron_helm', 'worn_boots', 'copper_ring', 'bone_necklace'],
    bonuses: {
      2: { stat: 'attack',    value: 0.05, isFlat: false, label: '攻击 +5%' },
      4: { stat: 'maxHp',     value: 0.10, isFlat: false, label: '生命上限 +10%' },
      6: { stat: 'attack',    value: 0.20, isFlat: false, label: '攻击 +20%（与 2 件套叠加）' }
    }
  },
  archer_legacy: {
    id: 'archer_legacy',
    name: '远征游侠套装',
    pieces: ['rusty_dagger', 'cloth_robe', 'leather_cap', 'swift_boots', 'shadow_dagger', 'bone_necklace'],
    bonuses: {
      2: { stat: 'critRate',  value: 5,    isFlat: true,  label: '暴击率 +5%' },
      4: { stat: 'attackSpeed', value: 0.10, isFlat: false, label: '攻速 +10%' },
      6: { stat: 'critDmg',   value: 0.50, isFlat: false, label: '暴击伤害 +50%' }
    }
  },
  mage_legacy: {
    id: 'mage_legacy',
    name: '远征贤者套装',
    pieces: ['apprentice_staff', 'cloth_robe', 'leather_cap', 'worn_boots', 'copper_ring', 'flame_staff'],
    bonuses: {
      2: { stat: 'spellPower', value: 8,   isFlat: true,  label: '法术强度 +8' },
      4: { stat: 'cdr',        value: 10,  isFlat: true,  label: '冷却缩减 +10%' },
      6: { stat: 'spellPower', value: 0.30, isFlat: false, label: '法术强度 +30%' }
    }
  },
  guardian_set: {
    id: 'guardian_set',
    name: '守护者全装',
    pieces: ['wooden_shield', 'chain_mail', 'iron_helm', 'worn_boots', 'copper_ring', 'bone_necklace'],
    bonuses: {
      2: { stat: 'defense',  value: 0.10, isFlat: false, label: '防御 +10%' },
      4: { stat: 'maxHp',    value: 50,   isFlat: true,  label: '生命值 +50' },
      6: { stat: 'defense',  value: 0.30, isFlat: false, label: '防御 +30%' }
    }
  }
};

/** 取装备模板的 setId（template 上）；instance 未必有，由 templateId 查 items.json 得 */
export function getSetIdForTemplate(templateId, itemDataItems) {
  return itemDataItems[templateId]?.setId || null;
}

/** 装备槽集合 → 各 setId 件数统计 */
export function countSetPieces(slots, itemDataItems) {
  const counts = {};
  for (const slotName of Object.keys(slots)) {
    const eq = slots[slotName];
    if (!eq?.templateId) continue;
    const setId = eq.setId || itemDataItems[eq.templateId]?.setId;
    if (!setId) continue;
    counts[setId] = (counts[setId] || 0) + 1;
  }
  return counts;
}
