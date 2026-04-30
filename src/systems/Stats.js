/**
 * 属性引擎：基础属性 → 二级属性 → 最终属性
 *
 * 基础属性:
 *   CON (体质): +10 MaxHP, +0.5/s HP回复
 *   STR (力量): +2 物理攻击, +0.1 暴击伤害倍率
 *   INT (智力): +10 MaxMP, +1 法术强度
 *   AGI (敏捷): +1% 攻击速度, +0.5 移动速度
 */

// 默认基础属性
export const DEFAULT_BASE_STATS = {
  con: 10,
  str: 8,
  int: 5,
  agi: 8
};

export class Stats {
  constructor(base = {}) {
    // 基础四维
    this.base = {
      con: base.con ?? DEFAULT_BASE_STATS.con,
      str: base.str ?? DEFAULT_BASE_STATS.str,
      int: base.int ?? DEFAULT_BASE_STATS.int,
      agi: base.agi ?? DEFAULT_BASE_STATS.agi
    };

    // 装备/buff 提供的额外加成 (flat bonuses)
    this.bonuses = { con: 0, str: 0, int: 0, agi: 0 };

    // 额外的二级属性加成 (来自装备直接加成)
    this.flatBonuses = {
      maxHp: 0, maxMp: 0, attack: 0, spellPower: 0,
      moveSpeed: 0, attackSpeed: 0, hpRegen: 0, critDmg: 0,
      tenacity: 0, defense: 0
    };

    // 缓存计算结果
    this._cache = null;
  }

  /** 获取某个基础属性的有效值 */
  getEffective(stat) {
    return this.base[stat] + (this.bonuses[stat] || 0);
  }

  /** 计算所有二级属性（带缓存） */
  getDerived() {
    if (this._cache) return this._cache;

    const con = this.getEffective('con');
    const str = this.getEffective('str');
    const int = this.getEffective('int');
    const agi = this.getEffective('agi');

    this._cache = {
      maxHp:       con * 10         + this.flatBonuses.maxHp,
      maxMp:       int * 10         + this.flatBonuses.maxMp,
      attack:      str * 2          + this.flatBonuses.attack,
      spellPower:  int * 1          + this.flatBonuses.spellPower,
      moveSpeed:   agi * 20 + 40    + this.flatBonuses.moveSpeed,
      attackSpeed: 1.0 + agi * 0.01 + this.flatBonuses.attackSpeed,
      hpRegen:     con * 0.5        + this.flatBonuses.hpRegen,
      critDmg:     1.5 + str * 0.1  + this.flatBonuses.critDmg,
      tenacity:    Math.min(0.5, con * 0.01 + this.flatBonuses.tenacity),
      defense:     this.flatBonuses.defense
    };
    return this._cache;
  }

  /** 使缓存失效（属性变更时调用） */
  invalidate() {
    this._cache = null;
  }

  /** 设置基础属性 */
  setBase(stat, value) {
    this.base[stat] = value;
    this.invalidate();
  }

  /** 增加基础属性（升级） */
  addBase(stat, amount) {
    this.base[stat] += amount;
    this.invalidate();
  }

  /** 设置装备/buff加成 */
  setBonus(stat, value) {
    this.bonuses[stat] = value;
    this.invalidate();
  }

  /** 设置二级属性直接加成 */
  setFlatBonus(stat, value) {
    this.flatBonuses[stat] = value;
    this.invalidate();
  }

  /** 等级提升：每个属性 +1 */
  levelUp() {
    this.base.con += 1;
    this.base.str += 1;
    this.base.int += 1;
    this.base.agi += 1;
    this.invalidate();
  }

  /** 序列化 */
  toJSON() {
    return { base: { ...this.base }, bonuses: { ...this.bonuses }, flatBonuses: { ...this.flatBonuses } };
  }

  /** 反序列化 */
  static fromJSON(data) {
    const stats = new Stats(data.base);
    if (data.bonuses) stats.bonuses = { ...stats.bonuses, ...data.bonuses };
    if (data.flatBonuses) stats.flatBonuses = { ...stats.flatBonuses, ...data.flatBonuses };
    return stats;
  }
}
