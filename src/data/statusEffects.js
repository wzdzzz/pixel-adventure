/**
 * 状态效果统一注册表
 *
 * 合并三职业的 EFFECTS 表，并补充 UI 显示用的 emoji 图标。
 * `handleSkillHit` 等消费方通过此表查模板，自动拼出 type/tickInterval/damagePerTick 等字段。
 *
 * 同名 effect（slow / armorBreak）以战士定义为准，技能 applyEffects 条目可覆盖 duration/modifiers。
 */

import { WARRIOR_EFFECTS } from './warriorSkills.js';
import { ARCHER_EFFECTS } from './archerSkills.js';
import { MAGE_EFFECTS } from './mageSkills.js';

// 合并：mage → archer → warrior 顺序，相同 key 时 warrior 优先
export const STATUS_EFFECTS = {
  ...MAGE_EFFECTS,
  ...ARCHER_EFFECTS,
  ...WARRIOR_EFFECTS
};

/** UI 显示用图标（覆盖整套 effect） */
export const EFFECT_ICONS = {
  // DoT
  bleed: '🩸',
  poison: '☠️',
  burn: '🔥',
  // Debuff
  armorBreak: '🛡️',
  slow: '🐌',
  frostSlow: '❄️',
  huntersMark: '🎯',
  arcaneWeakness: '🌀',
  // Buff（敌人通常不挂 buff，备用）
  rageBoost: '💢',
  manaBoost: '💧'
};

/** 取效果模板（含 icon） */
export function getEffectTemplate(effectId) {
  const tpl = STATUS_EFFECTS[effectId];
  if (!tpl) return null;
  return { ...tpl, icon: EFFECT_ICONS[effectId] || '✨' };
}
