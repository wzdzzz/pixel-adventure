/**
 * 法师技能定义 — 12主动 + 6被动 + 4状态效果
 *
 * 效果类型(effect.type):
 *   melee  — 前方hitbox单次判定（火球、寒冰箭、奥术飞弹等，大hitbox模拟施法）
 *   spin   — 以自身为中心持续AOE（冰霜新星、火焰风暴、暴风雪）
 *   dash   — 位移+碰撞判定（闪现）
 *   buff   — 无hitbox，施加增益（魔法护盾、奥术增幅、元素掌控）
 *   taunt  — 范围效果（冰环束缚）
 *
 * 资源: mana（法力）
 */

// ═══════════════════════════════════════════════
// 主动技能 (12)
// ═══════════════════════════════════════════════

export const MAGE_SKILLS = {
  // ─── 1. 火球术 ───
  fireball: {
    id: 'fireball',
    name: '火球术',
    description: '发射火球，造成{dmg}%攻击力伤害，25%概率灼烧目标',
    icon: '🔥',
    resource: 'mana',
    baseCost: 15,
    baseCooldown: 2000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 1,
    category: 'active',
    phases: { startup: 150, active: 100, recovery: 200 },
    effect: {
      type: 'melee',
      hitbox: { w: 56, h: 40 },
      baseDamageMultiplier: 1.8,
      knockback: 70,
      applyEffects: [
        { effectId: 'burn', chance: 0.25, duration: 4000 }
      ]
    }
  },

  // ─── 2. 冰霜新星 ───
  frostNova: {
    id: 'frostNova',
    name: '冰霜新星',
    description: '释放冰霜冲击波，{dur}秒内每0.3秒造成{dmg}%伤害并减速',
    icon: '❄️',
    resource: 'mana',
    baseCost: 25,
    baseCooldown: 6000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 1,
    category: 'active',
    phases: { startup: 100, active: 1000, recovery: 300 },
    effect: {
      type: 'spin',
      radius: 52,
      tickInterval: 300,
      baseDamageMultiplier: 0.5,
      moveSpeedMod: 0.1,
      superArmor: true
    }
  },

  // ─── 3. 闪现 ───
  blink: {
    id: 'blink',
    name: '闪现',
    description: '瞬间移动到前方，途中造成{dmg}%攻击力伤害',
    icon: '✨',
    resource: 'mana',
    baseCost: 12,
    baseCooldown: 5000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 1,
    category: 'active',
    phases: { startup: 30, active: 150, recovery: 100 },
    effect: {
      type: 'dash',
      blink: true,
      distance: 260,
      hitbox: { w: 50, h: 50 },
      baseDamageMultiplier: 0.6,
      knockback: 20
    }
  },

  // ─── 4. 寒冰箭 ───
  iceBolt: {
    id: 'iceBolt',
    name: '寒冰箭',
    description: '发射冰箭造成{dmg}%伤害，减速目标40%持续3秒',
    icon: '🧊',
    resource: 'mana',
    baseCost: 18,
    baseCooldown: 4000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 3,
    category: 'active',
    phases: { startup: 130, active: 100, recovery: 200 },
    effect: {
      type: 'melee',
      hitbox: { w: 56, h: 30 },
      baseDamageMultiplier: 1.5,
      knockback: 50,
      applyEffects: [
        { effectId: 'frostSlow', chance: 1.0, duration: 3000, modifiers: { moveSpeed: -0.40 } }
      ]
    }
  },

  // ─── 5. 奥术飞弹 ───
  arcaneMissile: {
    id: 'arcaneMissile',
    name: '奥术飞弹',
    description: '发射跟踪飞弹，造成{dmg}%攻击力伤害',
    icon: '💫',
    resource: 'mana',
    baseCost: 14,
    baseCooldown: 3000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 3,
    category: 'active',
    phases: { startup: 100, active: 120, recovery: 180 },
    effect: {
      type: 'melee',
      hitbox: { w: 52, h: 36 },
      baseDamageMultiplier: 1.6,
      knockback: 40
    }
  },

  // ─── 6. 魔法护盾 ───
  magicShield: {
    id: 'magicShield',
    name: '魔法护盾',
    description: '召唤魔法屏障，减伤{dr}%，持续{dur}秒',
    icon: '🔮',
    resource: 'mana',
    baseCost: 20,
    baseCooldown: 12000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 3,
    category: 'active',
    phases: { startup: 80, active: 200, recovery: 100 },
    effect: {
      type: 'buff',
      target: 'self',
      buffId: 'magicShieldBuff',
      baseDuration: 6000,
      baseModifiers: { damageReduction: 0.35 }
    }
  },

  // ─── 7. 火焰风暴 ───
  flameStorm: {
    id: 'flameStorm',
    name: '火焰风暴',
    description: '召唤火焰风暴，{dur}秒内每0.25秒造成{dmg}%伤害',
    icon: '🌋',
    resource: 'mana',
    baseCost: 35,
    baseCooldown: 10000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 5,
    category: 'active',
    phases: { startup: 200, active: 2000, recovery: 300 },
    effect: {
      type: 'spin',
      radius: 56,
      tickInterval: 250,
      baseDamageMultiplier: 0.6,
      moveSpeedMod: 0.0,
      superArmor: true,
      cameraShake: { intensity: 3, duration: 50 }
    }
  },

  // ─── 8. 冰冻术 ───
  freeze: {
    id: 'freeze',
    name: '冰冻术',
    description: '冻结目标，造成{dmg}%伤害并眩晕{stun}秒',
    icon: '🥶',
    resource: 'mana',
    baseCost: 22,
    baseCooldown: 8000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 5,
    category: 'active',
    phases: { startup: 180, active: 120, recovery: 200 },
    effect: {
      type: 'melee',
      hitbox: { w: 48, h: 40 },
      baseDamageMultiplier: 1.4,
      knockback: 20,
      baseStun: 1200,
      cameraShake: { intensity: 4, duration: 80 },
      applyEffects: [
        { effectId: 'frostSlow', chance: 1.0, duration: 4000, modifiers: { moveSpeed: -0.50 } }
      ]
    }
  },

  // ─── 9. 奥术增幅 ───
  arcaneAmplify: {
    id: 'arcaneAmplify',
    name: '奥术增幅',
    description: '增幅魔力，攻击力+{atkBonus}%，法力回复+50%，持续{dur}秒',
    icon: '⭐',
    resource: 'none',
    baseCost: 0,
    baseCooldown: 15000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 5,
    category: 'active',
    phases: { startup: 100, active: 200, recovery: 100 },
    effect: {
      type: 'buff',
      target: 'self',
      buffId: 'arcaneAmplifyBuff',
      baseDuration: 8000,
      baseModifiers: { attack: 0.25, manaRegen: 0.50 }
    }
  },

  // ─── 10. 陨石术 ───
  meteor: {
    id: 'meteor',
    name: '陨石术',
    description: '召唤陨石砸落，造成{dmg}%攻击力范围伤害并灼烧',
    icon: '☄️',
    resource: 'mana',
    baseCost: 30,
    baseCooldown: 10000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 7,
    category: 'active',
    phases: { startup: 400, active: 150, recovery: 300 },
    effect: {
      type: 'melee',
      hitbox: { w: 70, h: 70 },
      baseDamageMultiplier: 3.2,
      knockback: 100,
      dedicatedKnockback: true,
      stagger: 800,
      cameraShake: { intensity: 10, duration: 200 },
      applyEffects: [
        { effectId: 'burn', chance: 0.80, duration: 5000 }
      ]
    }
  },

  // ─── 11. 暴风雪 ───
  blizzard: {
    id: 'blizzard',
    name: '暴风雪',
    description: '召唤暴风雪，{dur}秒内每0.3秒造成{dmg}%伤害并减速',
    icon: '🌨️',
    resource: 'mana',
    baseCost: 35,
    baseCooldown: 12000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 7,
    category: 'active',
    phases: { startup: 200, active: 2500, recovery: 300 },
    effect: {
      type: 'spin',
      radius: 64,
      tickInterval: 300,
      baseDamageMultiplier: 0.5,
      moveSpeedMod: 0.0,
      superArmor: true,
      cameraShake: { intensity: 2, duration: 40 }
    }
  },

  // ─── 12. 元素爆发（大招）───
  elementalBurst: {
    id: 'elementalBurst',
    name: '元素爆发',
    description: '释放全部元素之力，攻击+{atkBonus}%，法术减CD 30%，持续{dur}秒',
    icon: '🌈',
    resource: 'mana',
    baseCost: 45,
    baseCooldown: 25000,
    maxLevel: 5,
    upgradeCost: 2,
    requiredLevel: 10,
    category: 'active',
    phases: { startup: 200, active: 300, recovery: 200 },
    effect: {
      type: 'buff',
      target: 'self',
      buffId: 'elementalBurstBuff',
      baseDuration: 10000,
      baseModifiers: { attack: 0.45, cdr: 0.30 }
    }
  }
};

// ═══════════════════════════════════════════════
// 被动技能 (6)
// ═══════════════════════════════════════════════

export const MAGE_PASSIVES = {
  manaWell: {
    id: 'manaWell',
    name: '法力之泉',
    description: '最大法力提升15%',
    icon: '💧',
    maxLevel: 3,
    category: 'passive',
    effect: {
      type: 'stat_bonus',
      modifier: { maxMana: 0.15 }
    }
  },
  spellMastery: {
    id: 'spellMastery',
    name: '法术精通',
    description: '法术伤害提升10%',
    icon: '📖',
    maxLevel: 3,
    category: 'passive',
    effect: {
      type: 'stat_bonus',
      modifier: { spellDamage: 0.10 }
    }
  },
  icyVeins: {
    id: 'icyVeins',
    name: '寒冰之血',
    description: '冰系技能减速效果增强20%',
    icon: '🩵',
    maxLevel: 3,
    category: 'passive',
    effect: {
      type: 'stat_bonus',
      modifier: { frostEffect: 0.20 }
    }
  },
  pyromaniac: {
    id: 'pyromaniac',
    name: '纵火专家',
    description: '灼烧伤害提升25%',
    icon: '🔥',
    maxLevel: 3,
    category: 'passive',
    effect: {
      type: 'stat_bonus',
      modifier: { burnDamage: 0.25 }
    }
  },
  arcaneFocus: {
    id: 'arcaneFocus',
    name: '奥术专注',
    description: '施法时减伤10%',
    icon: '🔮',
    maxLevel: 3,
    category: 'passive',
    effect: {
      type: 'conditional_stat',
      condition: 'while_casting',
      modifier: { damageReduction: 0.10 }
    }
  },
  manaShield: {
    id: 'manaShield',
    name: '法力护盾',
    description: '受伤时消耗法力抵消20%伤害',
    icon: '🛡️',
    maxLevel: 3,
    category: 'passive',
    effect: {
      type: 'on_hit_received',
      manaAbsorb: 0.20
    }
  }
};

// ═══════════════════════════════════════════════
// 状态效果模板 (4)
// ═══════════════════════════════════════════════

export const MAGE_EFFECTS = {
  burn: {
    id: 'burn',
    name: '灼烧',
    type: 'dot',
    duration: 4000,
    tickInterval: 1000,
    maxStacks: 3,
    refreshable: true,
    damagePerTick: 0.30
  },
  frostSlow: {
    id: 'frostSlow',
    name: '冰霜减速',
    type: 'debuff',
    duration: 3000,
    maxStacks: 1,
    refreshable: true,
    modifiers: { moveSpeed: -0.40 }
  },
  arcaneWeakness: {
    id: 'arcaneWeakness',
    name: '奥术虚弱',
    type: 'debuff',
    duration: 4000,
    maxStacks: 1,
    refreshable: true,
    modifiers: { defense: -0.20 }
  },
  manaBoost: {
    id: 'manaBoost',
    name: '法力涌动',
    type: 'buff',
    duration: 6000,
    maxStacks: 1,
    refreshable: true,
    modifiers: { manaRegen: 0.50 }
  }
};

// ═══════════════════════════════════════════════
// 等级缩放
// ═══════════════════════════════════════════════

export function getSkillAtLevel(skillId, level) {
  const base = MAGE_SKILLS[skillId];
  if (!base) return null;
  const lv = Math.max(1, Math.min(level, base.maxLevel));

  const result = {
    ...base,
    level: lv,
    cost: Math.round(base.baseCost * (1 - (lv - 1) * 0.03)),
    cooldown: Math.round(base.baseCooldown * (1 - (lv - 1) * 0.05)),
    effect: { ...base.effect }
  };

  const eff = base.effect;

  if (eff.type === 'dash') {
    result.effect.damageMultiplier = eff.baseDamageMultiplier + (lv - 1) * 0.1;
  } else if (eff.type === 'spin') {
    result.effect.damageMultiplier = eff.baseDamageMultiplier + (lv - 1) * 0.1;
  } else if (eff.type === 'melee') {
    result.effect.damageMultiplier = eff.baseDamageMultiplier + (lv - 1) * 0.18;
    if (eff.baseStun) {
      result.effect.stun = eff.baseStun + (lv - 1) * 150;
    }
  } else if (eff.type === 'buff') {
    result.effect.duration = eff.baseDuration + (lv - 1) * 600;
    if (eff.baseModifiers) {
      result.effect.modifiers = {};
      for (const [stat, val] of Object.entries(eff.baseModifiers)) {
        result.effect.modifiers[stat] = val + (lv - 1) * (val * 0.1);
      }
    }
  }

  return result;
}

export function getSkillDescription(skillId, level) {
  const skill = getSkillAtLevel(skillId, level);
  if (!skill) return '';

  let desc = skill.description;
  const eff = skill.effect;

  if (eff.damageMultiplier) {
    desc = desc.replace('{dmg}', Math.round(eff.damageMultiplier * 100));
  }
  desc = desc.replace('{cost}', skill.cost);
  desc = desc.replace('{cd}', (skill.cooldown / 1000).toFixed(1));

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
    if (mods.damageReduction) desc = desc.replace('{dr}', Math.round(mods.damageReduction * 100));
    if (mods.moveSpeed) desc = desc.replace('{spdBonus}', Math.round(mods.moveSpeed * 100));
    if (mods.damageTaken) desc = desc.replace('{dmgAmp}', Math.round(mods.damageTaken * 100));
  }

  return desc;
}

// ═══════════════════════════════════════════════
// 默认技能栏配置
// ═══════════════════════════════════════════════

/** 法师默认技能栏（键位 1-4） */
export const SKILL_SLOTS = [
  'fireball',      // key 1
  'frostNova',     // key 2
  'blink',         // key 3
  'magicShield'    // key 4
];
