/**
 * 怪物等级缩放配置
 *
 * 控制怪物按等级/阶层缩放的所有数值参数。
 * 纯数据 + 工具函数，无外部依赖。
 *
 * 阶层（Tier）：
 *   MINION  — 小怪（弱于玩家等级）
 *   NORMAL  — 普通怪（与玩家同级）
 *   ELITE   — 精英怪（高于玩家等级，属性翻倍）
 *   BOSS    — Boss（远高于玩家等级，属性大幅提升）
 */

// ── 阶层常量 ──────────────────────────────────────────
export const TIER = {
  MINION: 'minion',
  NORMAL: 'normal',
  ELITE:  'elite',
  BOSS:   'boss'
};

// ── 阶层等级偏移范围 [min, max]（相对于关卡推荐等级） ──
export const TIER_LEVEL_OFFSET = {
  [TIER.MINION]: [-1, 0],
  [TIER.NORMAL]: [0, 0],
  [TIER.ELITE]:  [1, 2],
  [TIER.BOSS]:   [3, 5]
};

// ── 缩放主配置 ──────────────────────────────────────────
export const SCALING_CONFIG = {
  /** 六围基础属性每级增长率 (con/str/int/agi/per/lck) */
  baseStatGrowth: 0.06,

  /** 派生属性每级增长率 */
  derivedGrowth: {
    maxHp:  0.06,
    attack: 0.02
  },

  /** 阶层乘数（应用于 HP / 攻击 / 经验） */
  tierMultipliers: {
    [TIER.MINION]: { hp: 0.7, attack: 0.8, xp: 0.5 },
    [TIER.NORMAL]: { hp: 1,   attack: 1,   xp: 1   },
    [TIER.ELITE]:  { hp: 2.5, attack: 1.5, xp: 3   },
    [TIER.BOSS]:   { hp: 8,   attack: 2,   xp: 10  }
  }
};

// ── 等级压制配置 ──────────────────────────────────────────
export const LEVEL_SUPPRESS = {
  /** 每级差异的伤害百分比调整 */
  perLevelPct: 0.05,
  /** 最大压制/加成百分比 */
  maxPct: 0.30
};

// ── 工具函数 ──────────────────────────────────────────────

/**
 * 根据阶层随机取等级偏移值
 * @param {string} tier — TIER 常量之一
 * @returns {number} 整数偏移
 */
export function rollTierOffset(tier) {
  const [min, max] = TIER_LEVEL_OFFSET[tier] || TIER_LEVEL_OFFSET[TIER.NORMAL];
  if (min === max) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * 按等级缩放六围基础属性
 * 公式：stat * (1 + baseStatGrowth * (level - 1))
 * @param {{ con:number, str:number, int:number, agi:number, per:number, lck:number }} baseStats
 * @param {number} level — 怪物最终等级（≥1）
 * @returns {{ con:number, str:number, int:number, agi:number, per:number, lck:number }}
 */
export function scaleBaseStats(baseStats, level) {
  const growth = SCALING_CONFIG.baseStatGrowth;
  const multiplier = 1 + growth * (level - 1);
  const result = {};
  for (const key of Object.keys(baseStats)) {
    result[key] = Math.round(baseStats[key] * multiplier);
  }
  return result;
}

/**
 * 对派生属性（maxHp / attack）应用等级增长 + 阶层乘数
 * 公式：derived * (1 + derivedGrowth * (level - 1)) * tierMultiplier
 * @param {{ maxHp:number, attack:number }} derived — 基础派生值
 * @param {number} level — 怪物最终等级
 * @param {string} tier — 阶层
 * @returns {{ maxHp:number, attack:number }}
 */
export function applyDerivedScaling(derived, level, tier) {
  const { derivedGrowth, tierMultipliers } = SCALING_CONFIG;
  const tm = tierMultipliers[tier] || tierMultipliers[TIER.NORMAL];

  return {
    maxHp:  Math.round(derived.maxHp  * (1 + derivedGrowth.maxHp  * (level - 1)) * tm.hp),
    attack: Math.round(derived.attack * (1 + derivedGrowth.attack * (level - 1)) * tm.attack)
  };
}

/**
 * 计算等级压制 / 加成伤害乘数
 * - 攻击方等级 > 防守方 → 伤害增加（最高 1 + maxPct）
 * - 攻击方等级 < 防守方 → 伤害减少（最低 1 - maxPct）
 * @param {number} attackerLevel
 * @param {number} defenderLevel
 * @returns {number} 伤害乘数，钳制在 [1 - maxPct, 1 + maxPct] 即 [0.7, 1.3]
 */
export function getLevelSuppression(attackerLevel, defenderLevel) {
  const diff = attackerLevel - defenderLevel;
  const raw = 1 + diff * LEVEL_SUPPRESS.perLevelPct;
  const floor = 1 - LEVEL_SUPPRESS.maxPct;  // 0.7
  const ceil  = 1 + LEVEL_SUPPRESS.maxPct;  // 1.3
  return Math.max(floor, Math.min(ceil, raw));
}
