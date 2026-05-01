/**
 * Warrior skill definitions with level scaling.
 *
 * Each skill has:
 *   id          - unique identifier
 *   name        - display name (Chinese)
 *   description - tooltip text (use {dmg}%, {cost}, {cd}s for dynamic values)
 *   icon        - text icon placeholder
 *   resource    - "stamina" | "rage" | "none"
 *   baseCost    - resource cost at level 1
 *   baseCooldown - cooldown in ms at level 1
 *   maxLevel    - max skill level
 *   upgradeCost - skill points per upgrade
 *   requiredLevel - player level to unlock
 *   phases      - { startup, active, recovery } in ms
 *   effect      - skill-specific behavior data (base values, scaled by getSkillAtLevel)
 */

export const WARRIOR_SKILLS = {
  charge: {
    id: 'charge',
    name: '野蛮冲锋',
    description: '向前方冲锋，命中敌人造成{dmg}%攻击力伤害并击晕{stun}秒',
    icon: '💥',
    resource: 'stamina',
    baseCost: 25,
    baseCooldown: 5000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 1,
    phases: { startup: 100, active: 300, recovery: 200 },
    effect: {
      type: 'dash',
      distance: 120,
      speed: 400,
      hitbox: { w: 36, h: 36 },
      baseDamageMultiplier: 1.2,  // +0.15 per level
      baseStun: 1000,             // +100ms per level
      knockback: 50,
      cameraShake: { intensity: 5, duration: 100 }
    }
  },

  whirlwind: {
    id: 'whirlwind',
    name: '旋风斩',
    description: '旋转攻击{dur}秒，对周围敌人每0.2秒造成{dmg}%攻击力伤害',
    icon: '🌀',
    resource: 'stamina',
    baseCost: 35,
    baseCooldown: 8000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 1,
    phases: { startup: 100, active: 1200, recovery: 300 },
    effect: {
      type: 'spin',
      radius: 50,
      tickInterval: 200,
      baseDamageMultiplier: 0.6,  // +0.1 per level
      moveSpeedMod: 0.2,
      superArmor: true
    }
  }
};

/**
 * Get scaled skill stats for a given level.
 * Returns a merged skill object with computed values.
 */
export function getSkillAtLevel(skillId, level) {
  const base = WARRIOR_SKILLS[skillId];
  if (!base) return null;
  const lv = Math.max(1, Math.min(level, base.maxLevel));

  const result = {
    ...base,
    level: lv,
    cost: Math.round(base.baseCost * (1 - (lv - 1) * 0.03)),  // -3% cost per level
    cooldown: Math.round(base.baseCooldown * (1 - (lv - 1) * 0.05)),  // -5% CD per level
    effect: { ...base.effect }
  };

  if (base.effect.type === 'dash') {
    result.effect.damageMultiplier = base.effect.baseDamageMultiplier + (lv - 1) * 0.15;
    result.effect.stun = base.effect.baseStun + (lv - 1) * 100;
  } else if (base.effect.type === 'spin') {
    result.effect.damageMultiplier = base.effect.baseDamageMultiplier + (lv - 1) * 0.1;
  }

  return result;
}

/**
 * Get tooltip description with filled-in values.
 */
export function getSkillDescription(skillId, level) {
  const skill = getSkillAtLevel(skillId, level);
  if (!skill) return '';

  let desc = skill.description;
  const dmg = Math.round(skill.effect.damageMultiplier * 100);
  desc = desc.replace('{dmg}', dmg);
  desc = desc.replace('{cost}', skill.cost);
  desc = desc.replace('{cd}', (skill.cooldown / 1000).toFixed(1));

  if (skill.effect.stun) {
    desc = desc.replace('{stun}', (skill.effect.stun / 1000).toFixed(1));
  }
  if (skill.effect.type === 'spin') {
    desc = desc.replace('{dur}', (skill.phases.active / 1000).toFixed(1));
  }

  return desc;
}

/** Ordered skill slot assignments (keys 1-4) */
export const SKILL_SLOTS = [
  'charge',     // key 1
  'whirlwind',  // key 2
  null,         // key 3 (Phase 2)
  null          // key 4 (Phase 2)
];
