/**
 * LootEngine — static utility class for rolling loot drops
 *
 * Uses weighted random selection against per-enemy loot tables
 * to determine what items drop when an enemy is killed.
 *
 * All methods are static; no instantiation required.
 */

import { LOOT_TABLES, RARITY_MULTIPLIERS } from '../data/lootTables.js';
import itemData from '../data/items.json';
import { EquipmentGenerator } from './EquipmentGenerator.js';

export class LootEngine {

  // ── Public ───────────────────────────────────────────────────────────────

  /**
   * Roll loot drops for a killed enemy.
   *
   * @param  {string} enemyId    key into LOOT_TABLES (e.g. 'slime')
   * @param  {number} dropBonus  luck-based % bonus applied to equipment pool weights
   * @returns {Array<{itemData: object, quantity: number}>}
   */
  static roll(enemyId, dropBonus = 0, enemyLevel = 1, isBoss = false, tier = 'normal') {
    const table = LOOT_TABLES[enemyId];
    if (!table) return [];

    // 注入 dropBonus / enemyLevel / isBoss 到装备 pool，便于 _rollItem 内取用
    table.pools.forEach(p => {
      if (p.name === 'equipment') {
        p._dropBonus = dropBonus;
        p._enemyLevel = enemyLevel;
        p._isBoss = isBoss;
      }
    });

    const drops = [];

    // ── Boss 保底：1 件传说级以上装备 + 4~6 件随机掉落 ──
    if (tier === 'boss') {
      const guaranteed = LootEngine._rollGuaranteedEquip(table, enemyLevel, true);
      if (guaranteed) drops.push(guaranteed);

      const extraCount = Phaser.Math.Between(4, 6);
      for (let i = 0; i < extraCount; i++) {
        const result = LootEngine._rollPool(table.pools, dropBonus);
        if (result) drops.push(result);
      }
      return drops;
    }

    // ── 普通 pool roll ──
    const numDrops = Phaser.Math.Between(table.minDrops, table.maxDrops);
    for (let i = 0; i < numDrops; i++) {
      const result = LootEngine._rollPool(table.pools, dropBonus);
      if (result) drops.push(result);
    }

    // ── Elite 保底：至少 1 件装备 ──
    if (tier === 'elite') {
      const hasEquip = drops.some(d => d.itemData?.type === 'equipment');
      if (!hasEquip) {
        const equip = LootEngine._rollGuaranteedEquip(table, enemyLevel, false);
        if (equip) drops.push(equip);
      }
    }

    return drops;
  }

  /**
   * 生成一件保底装备
   * @param {object} table    掉落表
   * @param {number} level    装备等级（= 怪物等级，不 ±1）
   * @param {boolean} forceHighRarity  true = 传说/神话，false = 随机品质
   */
  static _rollGuaranteedEquip(table, level, forceHighRarity) {
    // 从掉落表的 equipment pool 中随机选一个模板
    const equipPool = table.pools.find(p => p.name === 'equipment');
    if (!equipPool || !equipPool.items || equipPool.items.length === 0) return null;

    // 加权随机选模板
    const totalWeight = equipPool.items.reduce((s, e) => s + e.weight, 0);
    let roll = Math.random() * totalWeight;
    let selected = equipPool.items[equipPool.items.length - 1];
    for (const entry of equipPool.items) {
      roll -= entry.weight;
      if (roll <= 0) { selected = entry; break; }
    }

    const baseData = itemData.items[selected.id];
    if (!baseData || baseData.type !== 'equipment') return null;

    // 品质：Boss 保底传说+（80% legendary, 20% mythic），Elite 走普通 roll
    const rarity = forceHighRarity
      ? (Math.random() < 0.2 ? 'mythic' : 'legendary')
      : EquipmentGenerator.rollRarity({ isBoss: false, dropBonus: equipPool._dropBonus || 0 });

    const instance = EquipmentGenerator.generate(selected.id, rarity, level);
    if (!instance) return null;
    return { itemData: instance, quantity: 1 };
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  /**
   * Weighted-random pick of one pool, then roll an item from it.
   *
   * Equipment pool weights are boosted by the dropBonus so luckier
   * players see gear more often.
   *
   * @param  {Array}  pools      array of Pool objects from the loot table
   * @param  {number} dropBonus  luck-based % bonus for equipment pools
   * @returns {{itemData: object, quantity: number}|null}
   */
  static _rollPool(pools, dropBonus) {
    // Build adjusted weights — equipment pools get a luck multiplier
    const adjustedWeights = pools.map(pool => {
      if (pool.name === 'equipment') {
        return pool.weight * (1 + dropBonus / 100);
      }
      return pool.weight;
    });

    // Weighted random selection
    const totalWeight = adjustedWeights.reduce((sum, w) => sum + w, 0);
    let roll = Math.random() * totalWeight;

    let selectedPool = null;
    for (let i = 0; i < pools.length; i++) {
      roll -= adjustedWeights[i];
      if (roll <= 0) {
        selectedPool = pools[i];
        break;
      }
    }

    // Safety — shouldn't happen, but guard against floating-point edge cases
    if (!selectedPool) {
      selectedPool = pools[pools.length - 1];
    }

    return LootEngine._rollItem(selectedPool);
  }

  /**
   * Pick a single item from a pool's items list.
   *
   * Currency pools use a random range for quantity; equipment / consumable
   * pools use weighted random among entries, quantity = 1.
   *
   * @param  {object} pool  the selected Pool object
   * @returns {{itemData: object, quantity: number}|null}
   */
  static _rollItem(pool) {
    if (!pool.items || pool.items.length === 0) return null;

    // Currency — single item with a `range` property
    if (pool.items.length === 1 && pool.items[0].range) {
      const entry = pool.items[0];
      const baseData = itemData.items[entry.id];
      if (!baseData) return null;

      const quantity = Phaser.Math.Between(entry.range[0], entry.range[1]);
      return { itemData: { ...baseData }, quantity };
    }

    // Weighted random among pool entries
    const totalWeight = pool.items.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;

    let selected = null;
    for (let i = 0; i < pool.items.length; i++) {
      roll -= pool.items[i].weight;
      if (roll <= 0) {
        selected = pool.items[i];
        break;
      }
    }

    if (!selected) {
      selected = pool.items[pool.items.length - 1];
    }

    const baseData = itemData.items[selected.id];
    if (!baseData) return null;

    // 装备类型：实例化生成（含品质 roll + 词条）
    if (baseData.type === 'equipment') {
      const dropBonus = pool._dropBonus || 0;
      const isBoss = pool._isBoss || false;
      // 装备等级 = 怪物等级 ±1，最低1
      const baseLevel = pool._enemyLevel || baseData.level || 1;
      const equipLevel = Math.max(1, baseLevel + Phaser.Math.Between(-1, 1));
      const rarity = EquipmentGenerator.rollRarity({ isBoss, dropBonus });
      const instance = EquipmentGenerator.generate(selected.id, rarity, equipLevel);
      if (!instance) return null;
      return { itemData: instance, quantity: 1 };
    }

    return { itemData: { ...baseData }, quantity: 1 };
  }

  // ── Stat scaling ─────────────────────────────────────────────────────────

  /**
   * Compute effective stat values for an equipment item, factoring in
   * rarity multiplier and item level.
   *
   * Formula:  Value = BaseValue * RarityMultiplier * (1 + 0.1 * Level)
   *
   * @param  {object} equipItem  an equipment item object (from items.json or inventory)
   * @returns {{ flatBonuses: object, statBonuses: object }}
   */
  static getScaledStats(equipItem) {
    if (!equipItem || !equipItem.baseStats) {
      return { flatBonuses: {}, statBonuses: {} };
    }

    const rarityMult = RARITY_MULTIPLIERS[equipItem.rarity] || 1.0;
    const level = equipItem.level || 1;
    const levelMult = 1 + 0.1 * level;

    const flatBonuses = {};
    for (const [stat, baseValue] of Object.entries(equipItem.baseStats)) {
      flatBonuses[stat] = Math.round(baseValue * rarityMult * levelMult * 10) / 10;
    }

    // Base attribute bonuses (str, con, etc.) are NOT level-scaled
    const statBonuses = equipItem.statBonuses ? { ...equipItem.statBonuses } : {};

    return { flatBonuses, statBonuses };
  }
}
