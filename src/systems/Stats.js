/**
 * 属性引擎：基础属性 → 二级属性 → 最终属性
 *
 * 基础属性:
 *   CON (体质): +10 MaxHP, +0.5/s HP回复
 *   STR (力量): +2 物理攻击, +0.1 暴击伤害倍率
 *   INT (智力): +15 MaxMP, +1 法术强度
 *   AGI (敏捷): +1% 攻击速度, +20 移动速度
 *   PER (感知): +0.5% 暴击率, +0.5 护甲穿透
 *   LCK (幸运): +√LCK% 掉落加成
 */

// 默认基础属性
export const DEFAULT_BASE_STATS = {
  con: 10, str: 8, int: 5, agi: 8, per: 5, lck: 3
};

export class Stats {
  constructor(base = {}) {
    // 基础六维
    this.base = {
      con: base.con ?? DEFAULT_BASE_STATS.con,
      str: base.str ?? DEFAULT_BASE_STATS.str,
      int: base.int ?? DEFAULT_BASE_STATS.int,
      agi: base.agi ?? DEFAULT_BASE_STATS.agi,
      per: base.per ?? DEFAULT_BASE_STATS.per,
      lck: base.lck ?? DEFAULT_BASE_STATS.lck
    };

    // 装备/buff 提供的额外加成 (flat bonuses)
    this.bonuses = { con: 0, str: 0, int: 0, agi: 0, per: 0, lck: 0 };

    // 额外的二级属性加成 (来自装备直接加成)
    this.flatBonuses = {
      maxHp: 0, maxMp: 0, attack: 0, spellPower: 0,
      moveSpeed: 0, attackSpeed: 0, hpRegen: 0, critDmg: 0,
      tenacity: 0, defense: 0,
      critRate: 0, armorPen: 0, dropBonus: 0, cdr: 0, encumbrance: 0,
      lifesteal: 0      // 吸血百分比（0.05 = 5%），由战斗逻辑直接读取
    };

    // 百分比加成（来自装备词条、buff 等）— 应用于 derived 派生值
    this.bonusPct = {
      attack: 0,        // attack × (1 + attackPct)
      defense: 0,
      maxHp: 0,
      maxMp: 0,
      moveSpeed: 0,
      attackSpeed: 0,
      hpRegen: 0,
      critRate: 0,      // 注意：critRate 既可 flat 也可 pct，pct 在最后乘
      critDmg: 0,
      cdr: 0,
      // 职业专属（暂不在 getDerived 内消费，由具体战斗逻辑读取）
      rageGain: 0,      // 战士：怒气获取倍率
      rangedDmg: 0,     // 弓手：远程伤害加成
      spellDmg: 0,      // 法师：法术伤害加成
      manaRegen: 0      // 法师：法力恢复倍率
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
    const per = this.getEffective('per');
    const lck = this.getEffective('lck');

    this._cache = {
      maxHp:       con * 10         + this.flatBonuses.maxHp,
      maxMp:       int * 15         + this.flatBonuses.maxMp,
      attack:      str * 2          + this.flatBonuses.attack,
      spellPower:  int * 1          + this.flatBonuses.spellPower,
      moveSpeed:   agi * 20 + 40    + this.flatBonuses.moveSpeed,
      attackSpeed: 1.0 + agi * 0.01 + this.flatBonuses.attackSpeed,
      hpRegen:     con * 0.5        + this.flatBonuses.hpRegen,
      critDmg:     1.5 + str * 0.1  + this.flatBonuses.critDmg,
      critRate:    per * 0.5         + this.flatBonuses.critRate,      // percentage points (2.5 = 2.5%)
      tenacity:    con * 0.5 + str * 0.2 + this.flatBonuses.tenacity,  // raw value, consumed via diminishing returns
      armorPen:    str * 0.3 + per * 0.5 + this.flatBonuses.armorPen,
      defense:     this.flatBonuses.defense,
      dropBonus:   Math.sqrt(lck) * 1.0 + this.flatBonuses.dropBonus,  // percentage points (1.7 = 1.7%)
      cdr:         Math.min(40, int * 0.2 + this.flatBonuses.cdr),     // hard cap 40%
      encumbrance: this.flatBonuses.encumbrance                        // reserved
    };

    // 应用百分比加成
    const pct = this.bonusPct;
    this._cache.attack      *= (1 + (pct.attack      || 0));
    this._cache.defense     *= (1 + (pct.defense     || 0));
    this._cache.maxHp       *= (1 + (pct.maxHp       || 0));
    this._cache.maxMp       *= (1 + (pct.maxMp       || 0));
    this._cache.moveSpeed   *= (1 + (pct.moveSpeed   || 0));
    this._cache.attackSpeed *= (1 + (pct.attackSpeed || 0));
    this._cache.hpRegen     *= (1 + (pct.hpRegen     || 0));
    this._cache.critRate    += (pct.critRate || 0);  // critRate 直接加百分点
    this._cache.critDmg     += (pct.critDmg  || 0);
    this._cache.cdr         = Math.min(40, this._cache.cdr + (pct.cdr || 0));

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

  /** 整体设置百分比加成（装备调用，覆盖式） */
  setBonusPct(pctMap) {
    this.bonusPct = { ...this.bonusPct, ...pctMap };
    this.invalidate();
  }

  /** 单项加 */
  addBonusPct(stat, value) {
    this.bonusPct[stat] = (this.bonusPct[stat] || 0) + value;
    this.invalidate();
  }

  /** 等级提升：每个属性 +1 */
  levelUp() {
    this.base.con += 1;
    this.base.str += 1;
    this.base.int += 1;
    this.base.agi += 1;
    this.base.per += 1;
    this.base.lck += 1;
    this.invalidate();
  }

  /** 序列化 */
  toJSON() {
    return {
      base: { ...this.base },
      bonuses: { ...this.bonuses },
      flatBonuses: { ...this.flatBonuses },
      bonusPct: { ...this.bonusPct }
    };
  }

  /** 反序列化 */
  static fromJSON(data) {
    const stats = new Stats(data.base);
    if (data.bonuses) stats.bonuses = { ...stats.bonuses, ...data.bonuses };
    if (data.flatBonuses) stats.flatBonuses = { ...stats.flatBonuses, ...data.flatBonuses };
    if (data.bonusPct) stats.bonusPct = { ...stats.bonusPct, ...data.bonusPct };
    return stats;
  }
}
