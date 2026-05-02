/**
 * 敌人技能数据表
 *
 * 4 种技能 type，每种对应 EnemySkillSystem 中一个执行函数：
 *   melee_strike  - 前方矩形 hitbox（slime/goblin 等近战）
 *   ranged_shot   - 朝玩家发射弹道（bat/skeleton 等远程）
 *   charge_attack - 短距冲锋撞击（boss/敏捷怪）
 *   aoe_burst     - 圆形 AOE（boss）
 *
 * 公共字段：
 *   type         - 派发到哪个执行函数
 *   range        - 触发距离（玩家进入此距离才会选用此技能）
 *   minRange     - （可选）最小距离（远程怪保持距离用）
 *   cooldown     - 冷却 ms
 *   telegraph    - 预警时间 ms（敌人染色或显视觉指示）
 *   activeWindow - 实际造成伤害的窗口 ms
 *   damage       - 伤害倍率（× enemy.getAttack()）
 *
 * 类型特定字段：
 *   melee_strike: hitbox: { w, h }
 *   ranged_shot:  projectileSpeed, projectileSize, color, lifetime
 *   charge_attack: speed, hitbox: { w, h }
 *   aoe_burst:    radius
 *
 * 优先级：当多个技能可用时，按 priority 高优先选（默认 0）
 */

export const ENEMY_SKILLS = {
  // ── melee_strike: 近战挥击 ─────────────────
  basic_melee: {
    type: 'melee_strike',
    range: 50,
    cooldown: 1500,
    telegraph: 300,
    activeWindow: 100,
    damage: 1.0,
    hitbox: { w: 36, h: 32 },
    telegraphTint: 0xff8800,
    priority: 0
  },

  // 较强近战（boss / 精英怪用）
  heavy_strike: {
    type: 'melee_strike',
    range: 60,
    cooldown: 3000,
    telegraph: 500,
    activeWindow: 150,
    damage: 1.6,
    hitbox: { w: 50, h: 40 },
    telegraphTint: 0xff4422,
    priority: 1
  },

  // ── ranged_shot: 远程弹道 ───────────────────
  basic_shot: {
    type: 'ranged_shot',
    range: 280,
    minRange: 60,            // 玩家太近不射
    cooldown: 2500,
    telegraph: 400,
    activeWindow: 0,         // 弹道一旦发射，hitbox 由弹道自己管
    damage: 0.8,
    projectileSpeed: 220,
    projectileSize: 8,
    projectileLifetime: 2000,
    color: 0xff8844,
    telegraphTint: 0xffaa44,
    priority: 0
  },

  // 大型弹道（boss）
  heavy_shot: {
    type: 'ranged_shot',
    range: 320,
    minRange: 80,
    cooldown: 4500,
    telegraph: 600,
    activeWindow: 0,
    damage: 1.4,
    projectileSpeed: 200,
    projectileSize: 14,
    projectileLifetime: 2500,
    color: 0xff4444,
    telegraphTint: 0xff6666,
    priority: 1
  },

  // ── charge_attack: 冲锋撞击 ─────────────────
  pounce: {
    type: 'charge_attack',
    range: 220,
    minRange: 40,
    cooldown: 4000,
    telegraph: 500,
    activeWindow: 400,         // 冲锋持续时间
    damage: 1.2,
    speed: 280,
    hitbox: { w: 40, h: 36 },
    telegraphTint: 0xff6644,
    priority: 1
  },

  // ── aoe_burst: 范围爆发 ─────────────────────
  ground_pound: {
    type: 'aoe_burst',
    range: 100,
    cooldown: 6000,
    telegraph: 800,            // 长预警
    activeWindow: 200,
    damage: 1.8,
    radius: 80,
    color: 0xff4422,
    telegraphTint: 0xff2200,
    priority: 2
  }
};

/**
 * 取技能数据（敌人技能不分等级，直接克隆基础数据）
 */
export function getEnemySkill(skillId) {
  const base = ENEMY_SKILLS[skillId];
  if (!base) return null;
  return { id: skillId, ...base };
}
