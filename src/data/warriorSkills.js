/**
 * 战士技能定义 — 12主动 + 6被动 + 4状态效果
 *
 * 效果类型(effect.type):
 *   dash   — 位移+碰撞判定（冲锋、跳斩）
 *   spin   — 以自身为中心持续AOE（旋风斩）
 *   melee  — 前方hitbox单次判定（重击、斩杀、地裂斩、破甲打击）
 *   buff   — 无hitbox，施加增益（战吼、血怒、防御姿态、狂怒爆发）
 *   taunt  — 范围嘲讽（挑衅）
 *
 * 新增技能步骤：
 * 1. 在 WARRIOR_SKILLS 添加技能数据
 * 2. 在 getSkillAtLevel() 添加缩放逻辑
 * 3. 如需新 effect.type → 在 Player.onSkillActive() 添加处理
 * 4. 更新 DEFAULT_WARRIOR_SLOTS 或技能树解锁
 */

// ═══════════════════════════════════════════════
// 主动技能 (12)
// ═══════════════════════════════════════════════

export const WARRIOR_SKILLS = {
  // ─── 1. 重击 ───
  heavyStrike: {
    id: 'heavyStrike',
    name: '重击',
    description: '重重一击，造成{dmg}%攻击力伤害，20%概率破甲3秒',
    icon: '🗡️',
    resource: 'rage',
    baseCost: 20,
    baseCooldown: 2000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 1,
    category: 'active',
    phases: { startup: 150, active: 150, recovery: 200 },
    effect: {
      type: 'melee',
      hitbox: { w: 44, h: 40 },
      baseDamageMultiplier: 1.8,
      knockback: 80,
      cameraShake: { intensity: 6, duration: 100 },
      applyEffects: [
        { effectId: 'armorBreak', chance: 0.20, duration: 3000 }
      ]
    }
  },

  // ─── 2. 旋风斩 ───
  whirlwind: {
    id: 'whirlwind',
    name: '旋风斩',
    description: '旋转攻击{dur}秒，对周围敌人每0.2秒造成{dmg}%攻击力伤害',
    icon: '🌀',
    resource: 'rage',
    baseCost: 30,
    baseCooldown: 6000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 1,
    category: 'active',
    phases: { startup: 100, active: 1500, recovery: 300 },
    effect: {
      type: 'spin',
      radius: 50,
      tickInterval: 200,
      baseDamageMultiplier: 0.6,
      moveSpeedMod: 0.2,
      superArmor: true
    }
  },

  // ─── 3. 冲锋 ───
  charge: {
    id: 'charge',
    name: '野蛮冲锋',
    description: '向前方冲锋，造成{dmg}%攻击力伤害并击晕{stun}秒',
    icon: '💥',
    resource: 'none',
    baseCost: 0,
    baseCooldown: 8000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 1,
    category: 'active',
    phases: { startup: 100, active: 300, recovery: 200 },
    effect: {
      type: 'dash',
      distance: 300,
      speed: 800,
      hitbox: { w: 36, h: 36 },
      baseDamageMultiplier: 1.2,
      baseStun: 1000,
      knockback: 50,
      dedicatedKnockback: true,
      stagger: 800,
      cameraShake: { intensity: 5, duration: 100 }
    }
  },

  // ─── 4. 战吼 ───
  warCry: {
    id: 'warCry',
    name: '战吼',
    description: '怒吼增加{atkBonus}%攻击力，持续{dur}秒',
    icon: '📣',
    resource: 'none',
    baseCost: 0,
    baseCooldown: 12000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 3,
    category: 'active',
    phases: { startup: 100, active: 200, recovery: 100 },
    effect: {
      type: 'buff',
      target: 'self',
      buffId: 'warCryBuff',
      baseDuration: 6000,
      baseModifiers: { attack: 0.20 }
    }
  },

  // ─── 5. 斩杀 ───
  execute: {
    id: 'execute',
    name: '斩杀',
    description: '猛力一击造成{dmg}%伤害，目标低于30%生命时伤害翻倍',
    icon: '⚰️',
    resource: 'rage',
    baseCost: 30,
    baseCooldown: 6000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 5,
    category: 'active',
    phases: { startup: 200, active: 150, recovery: 250 },
    effect: {
      type: 'melee',
      hitbox: { w: 44, h: 40 },
      baseDamageMultiplier: 2.5,
      executeThreshold: 0.30,
      executeMultiplier: 2.0,
      knockback: 100,
      cameraShake: { intensity: 8, duration: 150 }
    }
  },

  // ─── 6. 地裂斩 ───
  groundSplitter: {
    id: 'groundSplitter',
    name: '地裂斩',
    description: '劈开大地，造成{dmg}%伤害并减速30%持续2秒',
    icon: '🌋',
    resource: 'rage',
    baseCost: 25,
    baseCooldown: 8000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 5,
    category: 'active',
    phases: { startup: 200, active: 200, recovery: 300 },
    effect: {
      type: 'melee',
      hitbox: { w: 56, h: 48 },
      baseDamageMultiplier: 2.2,
      knockback: 60,
      dedicatedKnockback: true,
      stagger: 600,
      cameraShake: { intensity: 7, duration: 120 },
      applyEffects: [
        { effectId: 'slow', chance: 1.0, duration: 2000, modifiers: { moveSpeed: -0.30 } }
      ]
    }
  },

  // ─── 7. 血怒 ───
  bloodRage: {
    id: 'bloodRage',
    name: '血怒',
    description: '进入血怒状态，攻击吸血{lifesteal}%，持续{dur}秒',
    icon: '🩸',
    resource: 'rage',
    baseCost: 40,
    baseCooldown: 15000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 7,
    category: 'active',
    phases: { startup: 100, active: 200, recovery: 100 },
    effect: {
      type: 'buff',
      target: 'self',
      buffId: 'bloodRageBuff',
      baseDuration: 8000,
      baseModifiers: { lifesteal: 0.15 }
    }
  },

  // ─── 8. 防御姿态 ───
  defensiveStance: {
    id: 'defensiveStance',
    name: '防御姿态',
    description: '进入防御姿态，减伤{dr}%，持续{dur}秒',
    icon: '🛡️',
    resource: 'none',
    baseCost: 0,
    baseCooldown: 12000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 3,
    category: 'active',
    phases: { startup: 50, active: 200, recovery: 100 },
    effect: {
      type: 'buff',
      target: 'self',
      buffId: 'defensiveStanceBuff',
      baseDuration: 5000,
      baseModifiers: { damageReduction: 0.30 }
    }
  },

  // ─── 9. 跳斩 ───
  leapStrike: {
    id: 'leapStrike',
    name: '跳斩',
    description: '跳向目标区域，落地造成{dmg}%范围伤害，地面燃烧3秒。恢复怒气',
    icon: '⬆️',
    resource: 'none',
    baseCost: 0,
    baseCooldown: 10000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 7,
    category: 'active',
    phases: { startup: 100, active: 500, recovery: 300 },
    effect: {
      type: 'leap_slam',
      distance: 350,
      leapHeight: 80,
      leapDuration: 400,
      hitbox: { w: 120, h: 120 },
      baseDamageMultiplier: 2.5,
      knockback: 100,
      cameraShake: { intensity: 10, duration: 200 },
      groundDot: { damageMultiplier: 0.3, duration: 3000, tickInterval: 500, radius: 60 }
    }
  },

  // ─── 10. 破甲打击 ───
  armorBreakStrike: {
    id: 'armorBreakStrike',
    name: '破甲打击',
    description: '降低目标30%防御，持续5秒',
    icon: '🔨',
    resource: 'rage',
    baseCost: 15,
    baseCooldown: 5000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 3,
    category: 'active',
    phases: { startup: 120, active: 150, recovery: 200 },
    effect: {
      type: 'melee',
      hitbox: { w: 40, h: 36 },
      baseDamageMultiplier: 1.0,
      knockback: 40,
      applyEffects: [
        { effectId: 'armorBreak', chance: 1.0, duration: 5000 }
      ]
    }
  },

  // ─── 11. 挑衅 ───
  taunt: {
    id: 'taunt',
    name: '挑衅',
    description: '强制周围敌人攻击你{dur}秒',
    icon: '😤',
    resource: 'none',
    baseCost: 0,
    baseCooldown: 10000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 5,
    category: 'active',
    phases: { startup: 100, active: 200, recovery: 100 },
    effect: {
      type: 'taunt',
      radius: 120,
      baseDuration: 2000
    }
  },

  // ─── 12. 狂怒爆发（大招）───
  berserkerRage: {
    id: 'berserkerRage',
    name: '狂怒爆发',
    description: '释放全部怒气，攻击+{atkBonus}%，攻速+30%，持续{dur}秒',
    icon: '👹',
    resource: 'rage',
    baseCost: 50,
    baseCooldown: 25000,
    maxLevel: 5,
    upgradeCost: 2,
    requiredLevel: 10,
    category: 'active',
    phases: { startup: 200, active: 300, recovery: 200 },
    effect: {
      type: 'buff',
      target: 'self',
      buffId: 'berserkerRageBuff',
      baseDuration: 8000,
      baseModifiers: { attack: 0.40, attackSpeed: 0.30 }
    }
  }
};

// ═══════════════════════════════════════════════
// 被动技能 (6)
// ═══════════════════════════════════════════════

export const WARRIOR_PASSIVES = {
  battleFury: {
    id: 'battleFury',
    name: '战斗狂怒',
    description: '每10点怒气增加2%攻击力',
    icon: '🔥',
    maxLevel: 3,
    category: 'passive',
    effect: {
      type: 'conditional_stat',
      condition: 'per_rage_10',
      modifier: { attack: 0.02 }
    }
  },
  unyielding: {
    id: 'unyielding',
    name: '不屈',
    description: '生命值低于30%时减伤20%',
    icon: '💪',
    maxLevel: 3,
    category: 'passive',
    effect: {
      type: 'conditional_stat',
      condition: 'hp_below_30',
      modifier: { damageReduction: 0.20 }
    }
  },
  heavyArmor: {
    id: 'heavyArmor',
    name: '厚甲',
    description: '防御力提升15%',
    icon: '🛡️',
    maxLevel: 3,
    category: 'passive',
    effect: {
      type: 'stat_bonus',
      modifier: { defense: 0.15 }
    }
  },
  bloodlust: {
    id: 'bloodlust',
    name: '嗜血',
    description: '击杀敌人回复10%最大生命',
    icon: '❤️',
    maxLevel: 3,
    category: 'passive',
    effect: {
      type: 'on_kill',
      healPercent: 0.10
    }
  },
  weaponMastery: {
    id: 'weaponMastery',
    name: '武器专精',
    description: '近战伤害提升10%',
    icon: '⚔️',
    maxLevel: 3,
    category: 'passive',
    effect: {
      type: 'stat_bonus',
      modifier: { meleeDamage: 0.10 }
    }
  },
  concussiveStrikes: {
    id: 'concussiveStrikes',
    name: '震荡打击',
    description: '普通攻击10%概率眩晕0.5秒',
    icon: '💫',
    maxLevel: 3,
    category: 'passive',
    effect: {
      type: 'on_hit',
      chance: 0.10,
      stunDuration: 500
    }
  }
};

// ═══════════════════════════════════════════════
// 状态效果模板 (4)
// ═══════════════════════════════════════════════

export const WARRIOR_EFFECTS = {
  bleed: {
    id: 'bleed',
    name: '流血',
    type: 'dot',
    duration: 5000,
    tickInterval: 1000,
    maxStacks: 3,
    refreshable: true,
    damagePerTick: 0.3  // ×ATK per tick per stack
  },
  armorBreak: {
    id: 'armorBreak',
    name: '破甲',
    type: 'debuff',
    duration: 5000,
    maxStacks: 1,
    refreshable: true,
    modifiers: { defense: -0.30 }
  },
  slow: {
    id: 'slow',
    name: '减速',
    type: 'debuff',
    duration: 2000,
    maxStacks: 1,
    refreshable: true,
    modifiers: { moveSpeed: -0.30 }
  },
  rageBoost: {
    id: 'rageBoost',
    name: '怒气强化',
    type: 'buff',
    duration: 8000,
    maxStacks: 1,
    refreshable: true,
    modifiers: { rageGain: 0.50 }
  }
};

// ═══════════════════════════════════════════════
// 等级缩放
// ═══════════════════════════════════════════════

/**
 * 获取指定等级下的技能数据（含缩放后的数值）
 */
export function getSkillAtLevel(skillId, level) {
  const base = WARRIOR_SKILLS[skillId];
  if (!base) return null;
  const lv = Math.max(1, Math.min(level, base.maxLevel));

  const result = {
    ...base,
    level: lv,
    cost: Math.round(base.baseCost * (1 - (lv - 1) * 0.03)),
    cooldown: Math.round(base.baseCooldown * (1 - (lv - 1) * 0.05)),
    effect: { ...base.effect }
  };

  // 按效果类型缩放
  const eff = base.effect;

  if (eff.type === 'dash') {
    result.effect.damageMultiplier = eff.baseDamageMultiplier + (lv - 1) * 0.15;
    if (eff.baseStun) {
      result.effect.stun = eff.baseStun + (lv - 1) * 100;
    }
  } else if (eff.type === 'spin') {
    result.effect.damageMultiplier = eff.baseDamageMultiplier + (lv - 1) * 0.1;
  } else if (eff.type === 'melee') {
    result.effect.damageMultiplier = eff.baseDamageMultiplier + (lv - 1) * 0.15;
  } else if (eff.type === 'buff') {
    // 增益类：持续时间随等级增加，修正值随等级增加
    result.effect.duration = eff.baseDuration + (lv - 1) * 500;
    if (eff.baseModifiers) {
      result.effect.modifiers = {};
      for (const [stat, val] of Object.entries(eff.baseModifiers)) {
        result.effect.modifiers[stat] = val + (lv - 1) * (val * 0.1);
      }
    }
  } else if (eff.type === 'taunt') {
    result.effect.duration = eff.baseDuration + (lv - 1) * 200;
  }

  return result;
}

/**
 * 获取带填充数值的技能描述
 */
export function getSkillDescription(skillId, level) {
  const skill = getSkillAtLevel(skillId, level);
  if (!skill) return '';

  let desc = skill.description;
  const eff = skill.effect;

  // 通用替换
  if (eff.damageMultiplier) {
    desc = desc.replace('{dmg}', Math.round(eff.damageMultiplier * 100));
  }
  desc = desc.replace('{cost}', skill.cost);
  desc = desc.replace('{cd}', (skill.cooldown / 1000).toFixed(1));

  // 类型特定
  if (eff.stun) desc = desc.replace('{stun}', (eff.stun / 1000).toFixed(1));
  if (eff.type === 'spin') desc = desc.replace('{dur}', (skill.phases.active / 1000).toFixed(1));
  if (eff.duration) desc = desc.replace('{dur}', (eff.duration / 1000).toFixed(1));

  const apply0 = Array.isArray(eff.applyEffects) && eff.applyEffects[0];
  if (apply0 && apply0.duration) {
    desc = desc.replace('{dur}', (apply0.duration / 1000).toFixed(1));
  }
  const mods = (eff.modifiers) || (apply0 && apply0.modifiers) || null;
  if (mods) {
    if (mods.attack) desc = desc.replace('{atkBonus}', Math.round(mods.attack * 100));
    if (mods.lifesteal) desc = desc.replace('{lifesteal}', Math.round(mods.lifesteal * 100));
    if (mods.damageReduction) desc = desc.replace('{dr}', Math.round(mods.damageReduction * 100));
    if (mods.moveSpeed) desc = desc.replace('{spdBonus}', Math.round(mods.moveSpeed * 100));
    if (mods.damageTaken) desc = desc.replace('{dmgAmp}', Math.round(mods.damageTaken * 100));
  }

  return desc;
}

// ═══════════════════════════════════════════════
// 默认技能栏配置
// ═══════════════════════════════════════════════

/** 战士默认技能栏（键位 1-4） */
export const SKILL_SLOTS = [
  'heavyStrike',  // key 1
  'whirlwind',    // key 2
  'charge',       // key 3
  'warCry'        // key 4
];
