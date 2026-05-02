import itemData from '../data/items.json';
import { rollAffixes, AFFIX_COUNTS } from '../data/affixes.js';

let _instanceSeq = 0;
const _genId = () => `eq_${Date.now()}_${(_instanceSeq++).toString(36)}`;

const RARITY_ORDER = ['common','uncommon','rare','epic','legendary','mythic'];

/**
 * 装备实例化器：模板 + 品质 + 等级 → 完整实例
 */
export class EquipmentGenerator {
  /**
   * @param {string} templateId 模板 ID（items.json 的 key）
   * @param {string} rarity     品质（common ~ mythic）
   * @param {number} level      装备等级
   * @returns {object|null}     equipment instance 或 null（找不到模板）
   */
  static generate(templateId, rarity, level) {
    const tpl = itemData.items[templateId];
    if (!tpl || tpl.type !== 'equipment') return null;
    if (!RARITY_ORDER.includes(rarity)) rarity = 'common';

    const pools = tpl.affixPools || [];
    const count = AFFIX_COUNTS[rarity] || 0;
    const affixes = rollAffixes(pools, rarity, count);

    return {
      instanceId: _genId(),
      templateId,
      type: 'equipment',
      name: tpl.name,
      slot: tpl.slot,
      weaponType: tpl.weaponType || null,
      texture: tpl.texture,
      rarity,
      level,
      enhanceLevel: 0,
      affixes,
      // 静态字段（来自模板，方便 UI 直接读）
      baseStats: tpl.baseStats || {},
      statBonuses: tpl.statBonuses || {},
      sellPrice: tpl.sellPrice || 0,
      description: tpl.description || ''
    };
  }

  /** 选品质：基于敌人等级 / 是否 boss */
  static rollRarity({ isBoss = false, dropBonus = 0 }) {
    const boost = 1 + dropBonus / 100;
    const weights = isBoss
      ? { rare: 30, epic: 40, legendary: 25 * boost, mythic: 5 * boost }
      : { common: 60, uncommon: 30, rare: 10 * boost, epic: 0, legendary: 0, mythic: 0 };
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (const [r, w] of Object.entries(weights)) {
      roll -= w;
      if (roll <= 0) return r;
    }
    return 'common';
  }
}
