/**
 * 词条数据表
 *
 * 每条词条：
 *   id          — 唯一 ID（含 stat + tier）
 *   name        — 显示名
 *   pool        — 所属池（weapon_common / armor_common / accessory / warrior / archer / mage）
 *   tier        — 1（最强）~ 5（最弱）
 *   stat        — 应用的派生属性 key（attackPct / critRate / lifesteal 等）
 *   valueRange  — [min, max] 浮点
 *   minRarity   — 最低出现品质
 *   weight      — 池内权重
 *   isFlat      — true=flatBonus，false=bonusPct（百分比）
 */
export const AFFIXES = {
  // ── weapon_common ─────────────────────
  attack_pct_t1:   { id:'attack_pct_t1', name:'攻击力',   pool:'weapon_common', tier:1, stat:'attack',   valueRange:[0.10, 0.16], minRarity:'epic',     weight:5, isFlat:false },
  attack_pct_t2:   { id:'attack_pct_t2', name:'攻击力',   pool:'weapon_common', tier:2, stat:'attack',   valueRange:[0.06, 0.10], minRarity:'rare',     weight:10, isFlat:false },
  attack_pct_t3:   { id:'attack_pct_t3', name:'攻击力',   pool:'weapon_common', tier:3, stat:'attack',   valueRange:[0.03, 0.06], minRarity:'uncommon', weight:15, isFlat:false },
  attack_flat_t2:  { id:'attack_flat_t2', name:'攻击',    pool:'weapon_common', tier:2, stat:'attack',   valueRange:[8, 14],      minRarity:'rare',     weight:10, isFlat:true },
  attack_flat_t3:  { id:'attack_flat_t3', name:'攻击',    pool:'weapon_common', tier:3, stat:'attack',   valueRange:[3, 7],       minRarity:'uncommon', weight:15, isFlat:true },

  crit_rate_t1:    { id:'crit_rate_t1', name:'暴击率',   pool:'weapon_common', tier:1, stat:'critRate', valueRange:[4.0, 6.0],   minRarity:'epic',     weight:4, isFlat:true },
  crit_rate_t2:    { id:'crit_rate_t2', name:'暴击率',   pool:'weapon_common', tier:2, stat:'critRate', valueRange:[2.5, 4.0],   minRarity:'rare',     weight:8, isFlat:true },
  crit_rate_t3:    { id:'crit_rate_t3', name:'暴击率',   pool:'weapon_common', tier:3, stat:'critRate', valueRange:[1.0, 2.5],   minRarity:'uncommon', weight:12, isFlat:true },

  crit_dmg_t1:     { id:'crit_dmg_t1', name:'暴击伤害',   pool:'weapon_common', tier:1, stat:'critDmg', valueRange:[0.20, 0.30], minRarity:'epic',    weight:4, isFlat:false },
  crit_dmg_t2:     { id:'crit_dmg_t2', name:'暴击伤害',   pool:'weapon_common', tier:2, stat:'critDmg', valueRange:[0.10, 0.20], minRarity:'rare',    weight:8, isFlat:false },

  attack_speed_t2: { id:'attack_speed_t2', name:'攻击速度', pool:'weapon_common', tier:2, stat:'attackSpeed', valueRange:[0.06, 0.10], minRarity:'rare',     weight:8, isFlat:false },
  attack_speed_t3: { id:'attack_speed_t3', name:'攻击速度', pool:'weapon_common', tier:3, stat:'attackSpeed', valueRange:[0.03, 0.06], minRarity:'uncommon', weight:12, isFlat:false },

  // ── armor_common ──────────────────────
  hp_pct_t1:       { id:'hp_pct_t1', name:'生命',     pool:'armor_common', tier:1, stat:'maxHp',    valueRange:[0.10, 0.16], minRarity:'epic',     weight:5, isFlat:false },
  hp_pct_t2:       { id:'hp_pct_t2', name:'生命',     pool:'armor_common', tier:2, stat:'maxHp',    valueRange:[0.06, 0.10], minRarity:'rare',     weight:10, isFlat:false },
  hp_pct_t3:       { id:'hp_pct_t3', name:'生命',     pool:'armor_common', tier:3, stat:'maxHp',    valueRange:[0.03, 0.06], minRarity:'uncommon', weight:15, isFlat:false },
  hp_flat_t2:      { id:'hp_flat_t2', name:'生命值',   pool:'armor_common', tier:2, stat:'maxHp',    valueRange:[40, 80],     minRarity:'rare',     weight:10, isFlat:true },
  hp_flat_t3:      { id:'hp_flat_t3', name:'生命值',   pool:'armor_common', tier:3, stat:'maxHp',    valueRange:[15, 35],     minRarity:'uncommon', weight:15, isFlat:true },

  defense_pct_t2:  { id:'defense_pct_t2', name:'防御',  pool:'armor_common', tier:2, stat:'defense',  valueRange:[0.10, 0.18], minRarity:'rare',     weight:8, isFlat:false },
  defense_flat_t3: { id:'defense_flat_t3', name:'防御', pool:'armor_common', tier:3, stat:'defense',  valueRange:[3, 8],       minRarity:'uncommon', weight:12, isFlat:true },

  hp_regen_t2:     { id:'hp_regen_t2', name:'生命回复', pool:'armor_common', tier:2, stat:'hpRegen', valueRange:[0.5, 1.5],   minRarity:'rare',     weight:6, isFlat:true },

  // ── accessory ─────────────────────────
  str_t2:    { id:'str_t2', name:'力量',  pool:'accessory', tier:2, stat:'_base_str', valueRange:[3, 6], minRarity:'rare',     weight:8, isFlat:true },
  str_t3:    { id:'str_t3', name:'力量',  pool:'accessory', tier:3, stat:'_base_str', valueRange:[1, 3], minRarity:'uncommon', weight:12, isFlat:true },
  agi_t2:    { id:'agi_t2', name:'敏捷',  pool:'accessory', tier:2, stat:'_base_agi', valueRange:[3, 6], minRarity:'rare',     weight:8, isFlat:true },
  agi_t3:    { id:'agi_t3', name:'敏捷',  pool:'accessory', tier:3, stat:'_base_agi', valueRange:[1, 3], minRarity:'uncommon', weight:12, isFlat:true },
  int_t2:    { id:'int_t2', name:'智力',  pool:'accessory', tier:2, stat:'_base_int', valueRange:[3, 6], minRarity:'rare',     weight:8, isFlat:true },
  int_t3:    { id:'int_t3', name:'智力',  pool:'accessory', tier:3, stat:'_base_int', valueRange:[1, 3], minRarity:'uncommon', weight:12, isFlat:true },
  con_t3:    { id:'con_t3', name:'体质',  pool:'accessory', tier:3, stat:'_base_con', valueRange:[1, 3], minRarity:'uncommon', weight:12, isFlat:true },
  cdr_t1:    { id:'cdr_t1', name:'冷却缩减', pool:'accessory', tier:1, stat:'cdr', valueRange:[5, 10], minRarity:'epic',     weight:4, isFlat:true },
  cdr_t2:    { id:'cdr_t2', name:'冷却缩减', pool:'accessory', tier:2, stat:'cdr', valueRange:[2, 5],  minRarity:'rare',     weight:8, isFlat:true },
  move_speed_t3: { id:'move_speed_t3', name:'移动速度', pool:'accessory', tier:3, stat:'moveSpeed', valueRange:[0.03, 0.07], minRarity:'uncommon', weight:10, isFlat:false },

  // ── warrior 专属 ──────────────────────
  rage_gain_t2:  { id:'rage_gain_t2', name:'怒气获取', pool:'warrior', tier:2, stat:'rageGain', valueRange:[0.10, 0.20], minRarity:'rare', weight:8, isFlat:false }, // TODO Phase 2: 战斗代码消费 stats.bonusPct.rageGain
  lifesteal_t2:  { id:'lifesteal_t2', name:'吸血',   pool:'warrior', tier:2, stat:'lifesteal', valueRange:[0.04, 0.08], minRarity:'rare', weight:6, isFlat:true },
  lifesteal_t3:  { id:'lifesteal_t3', name:'吸血',   pool:'warrior', tier:3, stat:'lifesteal', valueRange:[0.01, 0.04], minRarity:'uncommon', weight:10, isFlat:true },

  // ── archer 专属 ───────────────────────
  ranged_dmg_t2: { id:'ranged_dmg_t2', name:'远程伤害', pool:'archer', tier:2, stat:'rangedDmg', valueRange:[0.08, 0.14], minRarity:'rare', weight:8, isFlat:false }, // TODO Phase 2: 战斗代码消费 stats.bonusPct.rangedDmg
  agi_pct_t2:    { id:'agi_pct_t2', name:'敏捷',     pool:'archer', tier:2, stat:'_base_agi', valueRange:[5, 10], minRarity:'rare', weight:8, isFlat:true },

  // ── mage 专属 ─────────────────────────
  spell_dmg_t2:  { id:'spell_dmg_t2', name:'法术伤害', pool:'mage', tier:2, stat:'spellDmg', valueRange:[0.08, 0.14], minRarity:'rare', weight:8, isFlat:false }, // TODO Phase 2: 战斗代码消费 stats.bonusPct.spellDmg
  mana_regen_t2: { id:'mana_regen_t2', name:'法力恢复', pool:'mage', tier:2, stat:'manaRegen', valueRange:[0.10, 0.20], minRarity:'rare', weight:8, isFlat:false }, // TODO Phase 2: 战斗代码消费 stats.bonusPct.manaRegen
  int_pct_t2:    { id:'int_pct_t2', name:'智力',    pool:'mage', tier:2, stat:'_base_int', valueRange:[5, 10], minRarity:'rare', weight:8, isFlat:true },

  // ── 触发型词条（Phase 2）──────────────────
  // stat 统一标记为 '_trigger'，rollAffixes 按 stat dedupe → 一件装备至多一条触发词条
  // EquipmentSystem.getStatBonuses 应跳过 _trigger（不进任何属性通道），由 TriggerSystem 单独读取
  fire_on_hit_t2: {
    id:'fire_on_hit_t2', name:'火焰附魔',
    pool:'weapon_common', tier:2, stat:'_trigger',
    isFlat:false, valueRange:[1,1], minRarity:'rare', weight:5,
    trigger: { event:'onHit', chance:0.20, effect:'spawn_fireball', power:0.5 }
  },
  heal_on_kill_t2: {
    id:'heal_on_kill_t2', name:'吸魂',
    pool:'armor_common', tier:2, stat:'_trigger',
    isFlat:false, valueRange:[1,1], minRarity:'rare', weight:5,
    trigger: { event:'onKill', chance:1.0, effect:'heal_pct', power:0.05 }
  },
  cdr_on_skill_t2: {
    id:'cdr_on_skill_t2', name:'技能加速',
    pool:'accessory', tier:2, stat:'_trigger',
    isFlat:false, valueRange:[1,1], minRarity:'rare', weight:5,
    trigger: { event:'onSkillCast', chance:1.0, effect:'reduce_cd', power:500 }
  },
  lifesteal_on_crit_t2: {
    id:'lifesteal_on_crit_t2', name:'血怒',
    pool:'weapon_common', tier:2, stat:'_trigger',
    isFlat:false, valueRange:[1,1], minRarity:'rare', weight:4,
    trigger: { event:'onCrit', chance:1.0, effect:'lifesteal_pct', power:0.30 }
  }
};

/** 品质 → 词条数量 */
export const AFFIX_COUNTS = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5
};

/** 取一个池的所有词条（按 minRarity 过滤） */
export function getPoolAffixes(poolName, rarity) {
  const order = ['common','uncommon','rare','epic','legendary','mythic'];
  const rIdx = order.indexOf(rarity);
  return Object.values(AFFIXES).filter(a => {
    if (a.pool !== poolName) return false;
    return order.indexOf(a.minRarity) <= rIdx;
  });
}

/** 在多个池里加权随机抽 N 条不重复 stat 的词条，并 roll value */
export function rollAffixes(pools, rarity, count) {
  if (count <= 0) return [];
  let candidates = [];
  for (const p of pools) candidates = candidates.concat(getPoolAffixes(p, rarity));
  if (!candidates.length) return [];

  const result = [];
  const usedStats = new Set();

  for (let i = 0; i < count; i++) {
    const filtered = candidates.filter(c => !usedStats.has(c.stat));
    if (!filtered.length) break;
    const totalW = filtered.reduce((s, a) => s + (a.weight || 1), 0);
    let roll = Math.random() * totalW;
    let picked = filtered[filtered.length - 1];
    for (const a of filtered) {
      roll -= (a.weight || 1);
      if (roll <= 0) { picked = a; break; }
    }
    const [lo, hi] = picked.valueRange;
    const value = lo + Math.random() * (hi - lo);
    result.push({ id: picked.id, value: Math.round(value * 100) / 100 });
    usedStats.add(picked.stat);
  }
  return result;
}
