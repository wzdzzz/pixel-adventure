/**
 * 敌人配置表
 *
 * 每个怪物类型对应：
 *   - skills: 技能 ID 列表（来自 enemySkills.js）
 *   - isBoss: 是否 boss（HP 条更大、不被击退、技能更多等）
 *   - tier:   怪物阶级（MINION / NORMAL / ELITE / BOSS）
 *   - displayScale: （可选）显示缩放
 *   - tint:        （可选）颜色染色
 *   - statOverride:（可选）覆盖默认 stats（来自 levels.js）
 */

import { TIER } from './monsterScaling.js';

export const ENEMY_CONFIG = {
  slime: {
    skills: ['basic_melee'],
    isBoss: false,
    tier: TIER.MINION
  },
  goblin: {
    skills: ['basic_melee'],
    isBoss: false,
    tier: TIER.NORMAL
  },
  spider: {
    skills: ['basic_melee', 'pounce'],   // 蜘蛛会扑击
    isBoss: false,
    tier: TIER.NORMAL
  },
  skeleton: {
    skills: ['basic_melee', 'basic_shot'],  // 骷髅近战 + 远程投骨
    isBoss: false,
    tier: TIER.NORMAL
  },
  bat: {
    skills: ['basic_shot'],   // 蝙蝠纯远程
    isBoss: false,
    tier: TIER.MINION
  },
  orc_warrior: {
    skills: ['basic_melee', 'pounce'],
    isBoss: false,
    tier: TIER.ELITE
  },
  fire_mage: {
    skills: ['basic_shot', 'ground_pound'],
    isBoss: false,
    tier: TIER.ELITE
  },
  // ── Boss（已有 skeleton_king sprite） ──
  skeleton_king: {
    skills: ['heavy_strike', 'pounce', 'heavy_shot', 'ground_pound'],
    isBoss: true,
    tier: TIER.BOSS,
    tint: 0xff8888,
    aggroDelay: 0,         // 立即仇恨（boss 一进视线就追）
    disengageRange: 600,
    disengageTime: 5000    // 5s 才脱战，更难甩
  },
  // 巨型骷髅（精英）
  giant_skeleton: {
    skills: ['heavy_strike', 'pounce'],
    isBoss: false,
    tier: TIER.ELITE
  }
};

/** 取敌人配置（找不到时返回最小 fallback） */
export function getEnemyConfig(typeId) {
  return ENEMY_CONFIG[typeId] || { skills: ['basic_melee'], isBoss: false, tier: TIER.NORMAL };
}
