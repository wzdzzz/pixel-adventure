/**
 * 弓箭手技能定义 — 12主动 + 6被动 + 4状态效果
 *
 * 效果类型(effect.type):
 *   melee  — 前方hitbox单次判定（穿透射击、蓄力射击、毒箭等，长hitbox模拟箭矢）
 *   spin   — 以自身为中心持续AOE（连射、箭雨）
 *   dash   — 位移+碰撞判定（闪避翻滚、翻滚射击）
 *   buff   — 无hitbox，施加增益（鹰眼、影遁、疾风步）
 *   taunt  — 范围效果（猎人陷阱，减速区域）
 *
 * 资源: stamina（体力）
 */

// ═══════════════════════════════════════════════
// 主动技能 (12)
// ═══════════════════════════════════════════════

export const ARCHER_SKILLS = {
  // ─── 1. 穿透射击 ───
  piercingShot: {
    id: 'piercingShot',
    name: '穿透射击',
    description: '射出强力一箭，造成{dmg}%攻击力伤害，穿透敌人防御',
    icon: '🏹',
    resource: 'stamina',
    baseCost: 15,
    baseCooldown: 2000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 1,
    category: 'active',
    phases: { startup: 120, active: 100, recovery: 200 },
    effect: {
      type: 'melee',
      hitbox: { w: 60, h: 24 },
      baseDamageMultiplier: 1.6,
      knockback: 60,
      applyEffects: [
        { effectId: 'armorBreak', chance: 0.25, duration: 3000 }
      ]
    }
  },

  // ─── 2. 连射 ───
  rapidFire: {
    id: 'rapidFire',
    name: '连射',
    description: '快速射出多箭，{dur}秒内每0.2秒造成{dmg}%攻击力伤害',
    icon: '🎯',
    resource: 'stamina',
    baseCost: 25,
    baseCooldown: 5000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 1,
    category: 'active',
    phases: { startup: 80, active: 1200, recovery: 200 },
    effect: {
      type: 'spin',
      radius: 44,
      tickInterval: 200,
      baseDamageMultiplier: 0.5,
      moveSpeedMod: 0.4,
      superArmor: false
    }
  },

  // ─── 3. 闪避翻滚 ───
  evasiveRoll: {
    id: 'evasiveRoll',
    name: '闪避翻滚',
    description: '快速翻滚闪避，途中无敌，造成{dmg}%攻击力伤害',
    icon: '💨',
    resource: 'stamina',
    baseCost: 12,
    baseCooldown: 4000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 1,
    category: 'active',
    phases: { startup: 50, active: 200, recovery: 150 },
    effect: {
      type: 'dash',
      distance: 300,
      speed: 900,
      hitbox: { w: 30, h: 30 },
      baseDamageMultiplier: 0.8,
      knockback: 30
    }
  },

  // ─── 4. 蓄力射击 ───
  chargedShot: {
    id: 'chargedShot',
    name: '蓄力射击',
    description: '按住蓄力后释放，最长{chargeTime}秒，伤害随蓄力倍增（最高{dmg}%）',
    icon: '⚡',
    resource: 'stamina',
    baseCost: 20,
    baseCooldown: 5000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 3,
    category: 'active',
    phases: { startup: 50, active: 100, recovery: 200 },
    effect: {
      type: 'melee',
      hitbox: { w: 64, h: 28 },
      baseDamageMultiplier: 2.8,
      knockback: 90,
      // 蓄力机制
      chargeable: true,
      chargeTime: 1500,        // 满蓄时间
      minChargeTime: 200,      // 最低蓄力
      chargeMovement: 'interrupt',  // 'interrupt' = 移动中断；'scale' = 移动减伤（暂未实现）
      cameraShake: { intensity: 5, duration: 80 }
    }
  },

  // ─── 5. 毒箭 ───
  poisonArrow: {
    id: 'poisonArrow',
    name: '毒箭',
    description: '射出毒箭造成{dmg}%伤害，使目标中毒5秒',
    icon: '☠️',
    resource: 'stamina',
    baseCost: 18,
    baseCooldown: 6000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 3,
    category: 'active',
    phases: { startup: 150, active: 100, recovery: 200 },
    effect: {
      type: 'melee',
      hitbox: { w: 56, h: 24 },
      baseDamageMultiplier: 1.2,
      knockback: 40,
      applyEffects: [
        { effectId: 'poison', chance: 1.0, duration: 5000 }
      ]
    }
  },

  // ─── 6. 多重射击 ───
  multiShot: {
    id: 'multiShot',
    name: '多重射击',
    description: '扇形射出多箭，造成{dmg}%攻击力伤害，击退敌人',
    icon: '🌟',
    resource: 'stamina',
    baseCost: 22,
    baseCooldown: 7000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 5,
    category: 'active',
    phases: { startup: 150, active: 150, recovery: 250 },
    effect: {
      type: 'melee',
      hitbox: { w: 70, h: 60 },
      baseDamageMultiplier: 1.8,
      knockback: 80,
      dedicatedKnockback: true,
      // 扇形：5 发箭、总扩散 60°
      arrows: 5,
      spreadAngle: 60,
      cameraShake: { intensity: 4, duration: 80 }
    }
  },

  // ─── 7. 猎人印记 ───
  huntersMark: {
    id: 'huntersMark',
    name: '猎人印记',
    description: '标记目标，使其受到伤害增加{dmgAmp}%，持续{dur}秒',
    icon: '🔍',
    resource: 'stamina',
    baseCost: 15,
    baseCooldown: 10000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 3,
    category: 'active',
    phases: { startup: 100, active: 100, recovery: 100 },
    effect: {
      type: 'melee',
      hitbox: { w: 50, h: 40 },
      baseDamageMultiplier: 0.5,
      knockback: 0,
      applyEffects: [
        { effectId: 'huntersMark', chance: 1.0, duration: 6000, modifiers: { damageTaken: 0.20 } }
      ]
    }
  },

  // ─── 8. 鹰眼 ───
  eagleEye: {
    id: 'eagleEye',
    name: '鹰眼',
    description: '集中精神，暴击率+{critBonus}%，攻击力+{atkBonus}%，持续{dur}秒',
    icon: '🦅',
    resource: 'none',
    baseCost: 0,
    baseCooldown: 14000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 5,
    category: 'active',
    phases: { startup: 100, active: 200, recovery: 100 },
    effect: {
      type: 'buff',
      target: 'self',
      buffId: 'eagleEyeBuff',
      baseDuration: 8000,
      baseModifiers: { critRate: 0.20, attack: 0.15 }
    }
  },

  // ─── 9. 影遁 ───
  shadowStep: {
    id: 'shadowStep',
    name: '影遁',
    description: '隐入阴影，移速+{spdBonus}%，下次攻击伤害+50%，持续{dur}秒',
    icon: '🌑',
    resource: 'stamina',
    baseCost: 20,
    baseCooldown: 12000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 5,
    category: 'active',
    phases: { startup: 80, active: 200, recovery: 100 },
    effect: {
      type: 'buff',
      target: 'self',
      buffId: 'shadowStepBuff',
      baseDuration: 5000,
      baseModifiers: { moveSpeed: 0.30, attack: 0.50 }
    }
  },

  // ─── 10. 翻滚射击 ───
  rollingShot: {
    id: 'rollingShot',
    name: '翻滚射击',
    description: '向后翻滚并射击，造成{dmg}%伤害，减速目标2秒',
    icon: '🔄',
    resource: 'stamina',
    baseCost: 18,
    baseCooldown: 6000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 7,
    category: 'active',
    phases: { startup: 60, active: 250, recovery: 150 },
    effect: {
      type: 'dash',
      distance: 250,
      speed: 900,
      reverse: true,            // 朝鼠标反方向位移（向后翻滚）
      hitbox: { w: 44, h: 36 },
      baseDamageMultiplier: 1.5,
      knockback: 50,
      applyEffects: [
        { effectId: 'slow', chance: 1.0, duration: 2000, modifiers: { moveSpeed: -0.30 } }
      ]
    }
  },

  // ─── 11. 致命射击 ───
  deadlyShot: {
    id: 'deadlyShot',
    name: '致命射击',
    description: '瞄准弱点射击，造成{dmg}%伤害，目标低于30%生命时伤害翻倍',
    icon: '💀',
    resource: 'stamina',
    baseCost: 30,
    baseCooldown: 8000,
    maxLevel: 5,
    upgradeCost: 1,
    requiredLevel: 7,
    category: 'active',
    phases: { startup: 300, active: 100, recovery: 250 },
    effect: {
      type: 'melee',
      hitbox: { w: 64, h: 28 },
      baseDamageMultiplier: 2.8,
      executeThreshold: 0.30,
      executeMultiplier: 2.0,
      knockback: 70,
      cameraShake: { intensity: 6, duration: 100 }
    }
  },

  // ─── 12. 箭雨（大招）───
  arrowRain: {
    id: 'arrowRain',
    name: '箭雨',
    description: '召唤箭雨覆盖区域，{dur}秒内每0.3秒造成{dmg}%攻击力伤害',
    icon: '🌧️',
    resource: 'stamina',
    baseCost: 40,
    baseCooldown: 20000,
    maxLevel: 5,
    upgradeCost: 2,
    requiredLevel: 10,
    category: 'active',
    phases: { startup: 200, active: 2000, recovery: 300 },
    effect: {
      type: 'spin',
      radius: 60,
      tickInterval: 300,
      baseDamageMultiplier: 0.7,
      moveSpeedMod: 0.0,
      superArmor: true,
      cameraShake: { intensity: 3, duration: 50 }
    }
  }
};

// ═══════════════════════════════════════════════
// 被动技能 (6)
// ═══════════════════════════════════════════════

export const ARCHER_PASSIVES = {
  steadyAim: {
    id: 'steadyAim',
    name: '精准瞄准',
    description: '暴击伤害提升15%',
    icon: '🎯',
    maxLevel: 3,
    category: 'passive',
    effect: {
      type: 'stat_bonus',
      modifier: { critDamage: 0.15 }
    }
  },
  nimbleFeet: {
    id: 'nimbleFeet',
    name: '轻捷步伐',
    description: '移动速度提升10%',
    icon: '👟',
    maxLevel: 3,
    category: 'passive',
    effect: {
      type: 'stat_bonus',
      modifier: { moveSpeed: 0.10 }
    }
  },
  keenEye: {
    id: 'keenEye',
    name: '锐利之眼',
    description: '暴击率提升5%',
    icon: '👁️',
    maxLevel: 3,
    category: 'passive',
    effect: {
      type: 'stat_bonus',
      modifier: { critRate: 0.05 }
    }
  },
  poisonMastery: {
    id: 'poisonMastery',
    name: '毒素精通',
    description: '毒素伤害提升20%，持续时间+2秒',
    icon: '🧪',
    maxLevel: 3,
    category: 'passive',
    effect: {
      type: 'stat_bonus',
      modifier: { poisonDamage: 0.20 }
    }
  },
  evasion: {
    id: 'evasion',
    name: '闪避本能',
    description: '10%概率完全闪避攻击',
    icon: '💫',
    maxLevel: 3,
    category: 'passive',
    effect: {
      type: 'on_hit_received',
      chance: 0.10,
      dodge: true
    }
  },
  windRunner: {
    id: 'windRunner',
    name: '疾风跑者',
    description: '翻滚后2秒内攻速提升20%',
    icon: '🌪️',
    maxLevel: 3,
    category: 'passive',
    effect: {
      type: 'on_dodge',
      buffDuration: 2000,
      modifier: { attackSpeed: 0.20 }
    }
  }
};

// ═══════════════════════════════════════════════
// 状态效果模板 (4)
// ═══════════════════════════════════════════════

export const ARCHER_EFFECTS = {
  poison: {
    id: 'poison',
    name: '中毒',
    type: 'dot',
    duration: 5000,
    tickInterval: 1000,
    maxStacks: 3,
    refreshable: true,
    damagePerTick: 0.25
  },
  huntersMark: {
    id: 'huntersMark',
    name: '猎人印记',
    type: 'debuff',
    duration: 6000,
    maxStacks: 1,
    refreshable: true,
    modifiers: { damageTaken: 0.20 }
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
  armorBreak: {
    id: 'armorBreak',
    name: '破甲',
    type: 'debuff',
    duration: 3000,
    maxStacks: 1,
    refreshable: true,
    modifiers: { defense: -0.25 }
  }
};

// ═══════════════════════════════════════════════
// 等级缩放
// ═══════════════════════════════════════════════

export function getSkillAtLevel(skillId, level) {
  const base = ARCHER_SKILLS[skillId];
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
    result.effect.damageMultiplier = eff.baseDamageMultiplier + (lv - 1) * 0.12;
    if (eff.baseStun) {
      result.effect.stun = eff.baseStun + (lv - 1) * 80;
    }
  } else if (eff.type === 'spin') {
    result.effect.damageMultiplier = eff.baseDamageMultiplier + (lv - 1) * 0.08;
  } else if (eff.type === 'melee') {
    result.effect.damageMultiplier = eff.baseDamageMultiplier + (lv - 1) * 0.15;
  } else if (eff.type === 'buff') {
    result.effect.duration = eff.baseDuration + (lv - 1) * 500;
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
  if (eff.chargeTime) desc = desc.replace('{chargeTime}', (eff.chargeTime / 1000).toFixed(1));

  if (eff.stun) desc = desc.replace('{stun}', (eff.stun / 1000).toFixed(1));
  if (eff.type === 'spin') desc = desc.replace('{dur}', (skill.phases.active / 1000).toFixed(1));
  if (eff.duration) desc = desc.replace('{dur}', (eff.duration / 1000).toFixed(1));

  // 兜底：从 applyEffects[0] 取 duration / modifiers（如猎人印记）
  const apply0 = Array.isArray(eff.applyEffects) && eff.applyEffects[0];
  if (apply0 && apply0.duration) {
    desc = desc.replace('{dur}', (apply0.duration / 1000).toFixed(1));
  }
  const mods = (eff.modifiers) || (apply0 && apply0.modifiers) || null;
  if (mods) {
    if (mods.critRate) desc = desc.replace('{critBonus}', Math.round(mods.critRate * 100));
    if (mods.attack) desc = desc.replace('{atkBonus}', Math.round(mods.attack * 100));
    if (mods.moveSpeed) desc = desc.replace('{spdBonus}', Math.round(mods.moveSpeed * 100));
    if (mods.damageTaken) desc = desc.replace('{dmgAmp}', Math.round(mods.damageTaken * 100));
  }

  return desc;
}

// ═══════════════════════════════════════════════
// 默认技能栏配置
// ═══════════════════════════════════════════════

/** 弓箭手默认技能栏（键位 1-4） */
export const SKILL_SLOTS = [
  'piercingShot',  // key 1
  'rapidFire',     // key 2
  'evasiveRoll',   // key 3
  'eagleEye'       // key 4
];
