# 装备 & 材料系统 Phase 1 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在现有装备系统上加入随机词条 / 6 品质 / 强化（+0~+15）/ 分解→材料 闭环，并保持老存档兼容。

**Architecture:** 装备从「模板引用」升级为「实例」（templateId + rarity + level + enhanceLevel + affixes[] + instanceId）。`EquipmentGenerator` 在 LootEngine drop 时实例化；`EnhanceSystem` 处理强化 / 分解；`Stats` 引擎扩展 `bonusPct` 通道吃词条百分比加成。InventoryPanel 右键菜单新增"强化 / 分解"，弹出小窗口操作（不做独立 tab）。

**Tech Stack:** Phaser 3.90、vanilla JS ES Modules、Vite 5、localStorage 存档。**项目无单元测试框架**——验证用 `pnpm build` 通过 + 浏览器手动验收 + 控制台 log。

**前置文档：** `docs/plans/2026-05-03-equipment-materials-system-design.md`

**TDD 适配说明：** 由于无 vitest/jest，关键算法函数（如 `EquipmentGenerator.generate` / `EnhanceSystem.calculateCost`）通过临时 `console.assert` 做 smoke test，提交前删除；UI/集成行为靠浏览器手动验收。

---

## Phase 1 任务图

```
Task 1: Stats 加 bonusPct 通道  ──┐
Task 2: 词条数据 affixes.js      ─┤
Task 3: 材料数据 + items.json    ─┤
Task 4: EquipmentGenerator       ─┘
                                  ↓
Task 5: LootEngine 实例化 drop
                                  ↓
Task 6: EquipmentSystem 消费 instance
                                  ↓
Task 7: InventorySystem 适配 instance（不堆叠，唯一 ID）
                                  ↓
Task 8: EnhanceSystem
                                  ↓
Task 9: InventoryPanel tooltip 显示词条
                                  ↓
Task 10: SmithyPanel（强化/分解小窗口）
                                  ↓
Task 11: SaveSystem 兼容老存档
                                  ↓
Task 12: 调参 + 浏览器全流程验收
```

---

## Task 1：Stats 加 bonusPct 通道

**Goal:** Stats 引擎能消费百分比加成（`attackPct`、`critRatePct` 等），让词条能加成 derived 属性。

**Files:**
- Modify: `src/systems/Stats.js:30-39, 50-79, 80-100`

**Step 1：构造函数加 bonusPct 字段**

修改 `Stats.constructor` 在 `flatBonuses` 之后加：
```js
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
  cdr: 0
};
```

**Step 2：getDerived 末尾加 pct 应用**

在 `_cache = { ... }` 计算完后、return 前插入：

```js
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
```

**Step 3：新增 setBonusPct API**

```js
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
```

**Step 4：build 验证**

Run: `pnpm build`
Expected: 通过，无 syntax 错误。

**Step 5：commit**

```bash
git add src/systems/Stats.js
git commit -m "feat(stats): 加百分比加成通道 bonusPct，准备消费装备词条"
```

---

## Task 2：词条数据表 `affixes.js`

**Goal:** 定义 30+ 词条，按池/Tier/最低品质组织。

**Files:**
- Create: `src/data/affixes.js`

**Step 1：写词条池数据**

```js
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
  rage_gain_t2:  { id:'rage_gain_t2', name:'怒气获取', pool:'warrior', tier:2, stat:'rageGain', valueRange:[0.10, 0.20], minRarity:'rare', weight:8, isFlat:false },
  lifesteal_t2:  { id:'lifesteal_t2', name:'吸血',   pool:'warrior', tier:2, stat:'lifesteal', valueRange:[0.04, 0.08], minRarity:'rare', weight:6, isFlat:true },
  lifesteal_t3:  { id:'lifesteal_t3', name:'吸血',   pool:'warrior', tier:3, stat:'lifesteal', valueRange:[0.01, 0.04], minRarity:'uncommon', weight:10, isFlat:true },

  // ── archer 专属 ───────────────────────
  ranged_dmg_t2: { id:'ranged_dmg_t2', name:'远程伤害', pool:'archer', tier:2, stat:'rangedDmg', valueRange:[0.08, 0.14], minRarity:'rare', weight:8, isFlat:false },
  agi_pct_t2:    { id:'agi_pct_t2', name:'敏捷',     pool:'archer', tier:2, stat:'_base_agi', valueRange:[5, 10], minRarity:'rare', weight:8, isFlat:true },

  // ── mage 专属 ─────────────────────────
  spell_dmg_t2:  { id:'spell_dmg_t2', name:'法术伤害', pool:'mage', tier:2, stat:'spellDmg', valueRange:[0.08, 0.14], minRarity:'rare', weight:8, isFlat:false },
  mana_regen_t2: { id:'mana_regen_t2', name:'法力恢复', pool:'mage', tier:2, stat:'manaRegen', valueRange:[0.10, 0.20], minRarity:'rare', weight:8, isFlat:false },
  int_pct_t2:    { id:'int_pct_t2', name:'智力',    pool:'mage', tier:2, stat:'_base_int', valueRange:[5, 10], minRarity:'rare', weight:8, isFlat:true }
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
```

**Step 2：build 验证**

Run: `pnpm build`
Expected: 通过。

**Step 3：commit**

```bash
git add src/data/affixes.js
git commit -m "feat(equipment): 加词条数据表 + rollAffixes 工具"
```

---

## Task 3：材料数据 + items.json 模板字段

**Goal:** 新增 3 个 Phase 1 材料；现有装备模板加 `affixPools` 字段。

**Files:**
- Create: `src/data/materials.js`
- Modify: `src/data/items.json`（加材料条目 + 已有装备加 affixPools）

**Step 1：创建 materials.js**

```js
/**
 * 材料数据
 *
 * Tier 1: 强化 +1~+5
 * Tier 2: 强化 +6~+10
 * Tier 3: 强化 +11~+15
 *
 * Phase 1 仅启用 enhance 用途的材料；其他 Phase 2/3 用途占位。
 */
export const MATERIALS = {
  iron_shard:     { id:'iron_shard',    name:'铁矿碎片', tier:1, color:'#999999', icon:'⛓️', desc:'低级强化材料' },
  enhance_stone:  { id:'enhance_stone', name:'强化石',   tier:2, color:'#4488ff', icon:'💠', desc:'中级强化材料' },
  ancient_core:   { id:'ancient_core',  name:'远古核心', tier:3, color:'#bb44ff', icon:'🔮', desc:'高级强化材料' }
};

/** 装备品质 → 分解产物（材料 ID + 数量） */
export const DECOMPOSE_TABLE = {
  common:    [{ matId:'iron_shard', count: 1 }],
  uncommon:  [{ matId:'iron_shard', count: 2 }],
  rare:      [{ matId:'enhance_stone', count: 1 }],
  epic:      [{ matId:'enhance_stone', count: 2 }],
  legendary: [{ matId:'ancient_core', count: 1 }],
  mythic:    [{ matId:'ancient_core', count: 2 }]
};

/** 强化等级 → 所需材料 + 金币（每次尝试） */
export function getEnhanceCost(currentLevel) {
  const next = currentLevel + 1;
  if (next <= 5)  return { matId:'iron_shard',    count: next * 2,        gold: next * 50 };
  if (next <= 10) return { matId:'enhance_stone', count: next - 5,        gold: next * 200 };
  if (next <= 15) return { matId:'ancient_core',  count: next - 10,       gold: next * 800 };
  return null; // 已满级
}

/** 强化等级 → 成功率 */
export function getEnhanceSuccessRate(currentLevel) {
  const next = currentLevel + 1;
  if (next <= 5)  return 1.0;
  if (next <= 10) return 0.7;
  if (next <= 15) return 0.4;
  return 0;
}

/** 强化失败行为：维持 / 降级 */
export function getEnhanceFailureBehavior(currentLevel) {
  const next = currentLevel + 1;
  if (next <= 10) return 'stay';
  return 'downgrade';
}
```

**Step 2：items.json 加材料条目**

在 items.json 的 `items` 对象内（建议放在装备区之后），添加：

```json
"iron_shard": {
  "id": "iron_shard",
  "name": "铁矿碎片",
  "type": "material",
  "texture": "potion",
  "rarity": "common",
  "stackable": true,
  "maxStack": 999,
  "level": 1,
  "sellPrice": 2,
  "value": 0,
  "description": "低级强化材料"
},
"enhance_stone": {
  "id": "enhance_stone",
  "name": "强化石",
  "type": "material",
  "texture": "potion",
  "rarity": "uncommon",
  "stackable": true,
  "maxStack": 999,
  "level": 1,
  "sellPrice": 20,
  "value": 0,
  "description": "中级强化材料"
},
"ancient_core": {
  "id": "ancient_core",
  "name": "远古核心",
  "type": "material",
  "texture": "potion",
  "rarity": "rare",
  "stackable": true,
  "maxStack": 999,
  "level": 1,
  "sellPrice": 100,
  "value": 0,
  "description": "高级强化材料"
}
```

**Step 3：现有装备加 affixPools 字段**

为 items.json 中已有的 `iron_sword`、`rusty_dagger`、`apprentice_staff`、`wooden_shield` 等装备添加 `affixPools` 字段：

- 武器（slot=weapon）：
  - heavy → `["weapon_common", "warrior"]`
  - light → `["weapon_common", "archer"]`
  - magic → `["weapon_common", "mage"]`
- 防具（slot=armor / helmet / boots / chest / gloves）→ `["armor_common"]`，并按 weaponType 类似加职业池
- 戒指/项链/饰品 → `["accessory"]`
- 盾牌（offhand）→ `["armor_common"]`

具体修改示例：
```json
"iron_sword": {
  ...
  "affixPools": ["weapon_common", "warrior"]
},
"rusty_dagger": {
  ...
  "affixPools": ["weapon_common", "archer"]
},
"apprentice_staff": {
  ...
  "affixPools": ["weapon_common", "mage"]
},
"wooden_shield": {
  ...
  "affixPools": ["armor_common"]
}
```

完整列表请遍历 items.json 中所有 `type: "equipment"` 项目，按 slot/weaponType 推断池。

**Step 4：build 验证**

Run: `pnpm build`
Expected: 通过；JSON 格式无错误。

**Step 5：commit**

```bash
git add src/data/materials.js src/data/items.json
git commit -m "feat(equipment): 加材料数据 + 装备模板 affixPools 字段"
```

---

## Task 4：EquipmentGenerator

**Goal:** 把模板 + rarity + level 实例化成完整 equipment instance。

**Files:**
- Create: `src/systems/EquipmentGenerator.js`

**Step 1：实现**

```js
import itemData from '../data/items.json';
import { rollAffixes, AFFIX_COUNTS } from '../data/affixes.js';

let _instanceSeq = 0;
const _genId = () => `eq_${Date.now()}_${(_instanceSeq++).toString(36)}`;

const RARITY_ORDER = ['common','uncommon','rare','epic','legendary','mythic'];

/**
 * 装备实例化器：模板 + 品质 + 等级 → 完整实例
 */
export class EquipmentGenerator {
  /**
   * @param {string} templateId 模板 ID（items.json 的 key）
   * @param {string} rarity     品质（common ~ mythic）
   * @param {number} level      装备等级
   * @returns {object|null}     equipment instance 或 null（找不到模板）
   */
  static generate(templateId, rarity, level) {
    const tpl = itemData.items[templateId];
    if (!tpl || tpl.type !== 'equipment') return null;
    if (!RARITY_ORDER.includes(rarity)) rarity = 'common';

    const pools = tpl.affixPools || [];
    const count = AFFIX_COUNTS[rarity] || 0;
    const affixes = rollAffixes(pools, rarity, count);

    return {
      instanceId: _genId(),
      templateId,
      type: 'equipment',
      name: tpl.name,
      slot: tpl.slot,
      weaponType: tpl.weaponType || null,
      texture: tpl.texture,
      rarity,
      level,
      enhanceLevel: 0,
      affixes,
      // 静态字段（来自模板，方便 UI 直接读）
      baseStats: tpl.baseStats || {},
      statBonuses: tpl.statBonuses || {},
      sellPrice: tpl.sellPrice || 0,
      description: tpl.description || ''
    };
  }

  /** 选品质：基于敌人等级 / 是否 boss */
  static rollRarity({ isBoss = false, dropBonus = 0 }) {
    // 加 luck dropBonus 到稀有侧权重（1% per 4 luck，约略）
    const boost = 1 + dropBonus / 100;
    const weights = isBoss
      ? { rare: 30, epic: 40, legendary: 25 * boost, mythic: 5 * boost }
      : { common: 60, uncommon: 30, rare: 10 * boost, epic: 0, legendary: 0, mythic: 0 };
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (const [r, w] of Object.entries(weights)) {
      roll -= w;
      if (roll <= 0) return r;
    }
    return 'common';
  }
}
```

**Step 2：build 验证 + smoke test**

Run: `pnpm build`，确保 import 路径正确。

临时在 main.js 末尾加（验证后**删除**）：
```js
import { EquipmentGenerator } from './systems/EquipmentGenerator.js';
const inst = EquipmentGenerator.generate('iron_sword', 'rare', 5);
console.log('[smoke] generate:', inst);
console.assert(inst.affixes.length === 2, 'rare should have 2 affixes');
console.assert(inst.instanceId, 'must have instanceId');
```

启动 dev server，浏览器控制台应看到一个含 2 条 affixes 的实例。验证后删除 smoke 代码。

**Step 3：commit**

```bash
git add src/systems/EquipmentGenerator.js
git commit -m "feat(equipment): EquipmentGenerator — 模板实例化 + 品质 roll"
```

---

## Task 5：LootEngine 改造（drop instance）

**Goal:** 装备掉落时调 EquipmentGenerator 生成实例，而不是直接传模板对象。

**Files:**
- Modify: `src/systems/LootEngine.js`

**Step 1：修改 _rollItem 方法**

在 `_rollItem(pool)` 中，当 `pool.name === 'equipment'` 时调 generator：

```js
import { EquipmentGenerator } from './EquipmentGenerator.js';

// 在 _rollItem 末尾（拿到 baseData 后）：
if (baseData.type === 'equipment') {
  const enemyLevel = pool._enemyLevel || baseData.level || 1;
  const isBoss = pool._isBoss || false;
  const dropBonus = pool._dropBonus || 0;
  const rarity = EquipmentGenerator.rollRarity({ isBoss, dropBonus });
  const instance = EquipmentGenerator.generate(selected.id, rarity, enemyLevel);
  if (!instance) return null;
  return { itemData: instance, quantity: 1 };
}

return { itemData: { ...baseData }, quantity: 1 };  // 原有非装备逻辑
```

**Step 2：把 enemyLevel/isBoss/dropBonus 注入 pool（可选，简化先跳过）**

Phase 1 简化：不强制传 enemyLevel/isBoss，只用 dropBonus（已有参数）。enemyLevel 默认走 baseData.level。boss 后续 Phase 才精细化。

把 `LootEngine.roll(enemyId, dropBonus)` 改造把 dropBonus 传给 pool：

```js
static roll(enemyId, dropBonus = 0) {
  const table = LOOT_TABLES[enemyId];
  if (!table) return [];

  // 把 dropBonus 临时注入到 equipment pool
  table.pools.forEach(p => { if (p.name === 'equipment') p._dropBonus = dropBonus; });

  // ... 余下原逻辑
}
```

**Step 3：build + 浏览器验收**

Run: `pnpm build`

启动 dev server，杀几只怪验证装备掉落是 instance 格式（控制台 log 一下 drop 结果）。

**Step 4：commit**

```bash
git add src/systems/LootEngine.js
git commit -m "feat(loot): 装备掉落改为实例化（含品质 roll + 词条）"
```

---

## Task 6：EquipmentSystem 消费 instance

**Goal:** 装备进入 stats 引擎时，把 instance 的 baseStats/statBonuses/affixes/enhanceLevel 累加。

**Files:**
- Modify: `src/systems/EquipmentSystem.js`

**Step 1：修改 getStatBonuses**

```js
import { AFFIXES } from '../data/affixes.js';

getStatBonuses() {
  const bonuses = { con: 0, str: 0, int: 0, agi: 0, per: 0, lck: 0 };
  const flatBonuses = {};
  const bonusPct = {};

  EQUIP_SLOTS.forEach(slotName => {
    const item = this.slots[slotName];
    if (!item) return;

    // 1) baseStats 按 rarity × (1+0.1×level) × (1+0.05×enhanceLevel) 缩放
    const rarityMult = RARITY_MULTIPLIERS[item.rarity] || 1.0;
    const lvlMult = 1 + 0.1 * (item.level || 1);
    const enhMult = 1 + 0.05 * (item.enhanceLevel || 0);
    const totalMult = rarityMult * lvlMult * enhMult;

    if (item.baseStats) {
      for (const [stat, val] of Object.entries(item.baseStats)) {
        flatBonuses[stat] = (flatBonuses[stat] || 0) + val * totalMult;
      }
    }
    if (item.statBonuses) {
      for (const [stat, val] of Object.entries(item.statBonuses)) {
        bonuses[stat] = (bonuses[stat] || 0) + val;
      }
    }

    // 2) 词条贡献
    if (Array.isArray(item.affixes)) {
      for (const a of item.affixes) {
        const def = AFFIXES[a.id];
        if (!def) continue;
        const stat = def.stat;
        // 处理 _base_str 等基础属性词条
        if (stat.startsWith('_base_')) {
          const baseStat = stat.replace('_base_', '');
          bonuses[baseStat] = (bonuses[baseStat] || 0) + a.value;
        } else if (def.isFlat) {
          flatBonuses[stat] = (flatBonuses[stat] || 0) + a.value;
        } else {
          bonusPct[stat] = (bonusPct[stat] || 0) + a.value;
        }
      }
    }
  });

  // 四舍五入 flatBonuses
  for (const k in flatBonuses) flatBonuses[k] = Math.round(flatBonuses[k] * 10) / 10;

  return { bonuses, flatBonuses, bonusPct };
}
```

**Step 2：修改 _applyBonuses**

```js
_applyBonuses() {
  const { bonuses, flatBonuses, bonusPct } = this.getStatBonuses();
  const player = this.scene.player;
  if (!player) return;

  player.stats.setEquipmentBonuses(bonuses, flatBonuses);
  player.stats.setBonusPct(bonusPct);
  player.stats.invalidate();
  player.refreshStats();
}
```

**Step 3：build 验证**

Run: `pnpm build`，确认 syntax 通过。

**Step 4：浏览器验证**

启动 dev server，给玩家一件 rare 装备（用 dev 控制台或新游戏打怪）：
- 观察 Character Panel 攻击力是否包含词条加成

**Step 5：commit**

```bash
git add src/systems/EquipmentSystem.js
git commit -m "feat(equipment): 消费装备 instance 词条+强化加成进 Stats"
```

---

## Task 7：InventorySystem 适配 instance

**Goal:** 装备实例不堆叠（每件唯一 instanceId），其他类型保持现状。

**Files:**
- Modify: `src/systems/InventorySystem.js`

**Step 1：修改 addItem — 装备特殊处理**

在 `addItem(itemData, quantity = 1)` 开头加：

```js
// 装备实例：每件独立，不堆叠
if (itemData.type === 'equipment') {
  const emptyIdx = this.slots.findIndex(s => s === null);
  if (emptyIdx === -1) {
    console.log('[Inventory] 背包已满');
    return false;
  }
  // 装备 instance 直接整体存入（已含 instanceId/affixes/enhanceLevel）
  this.slots[emptyIdx] = { ...itemData, quantity: 1 };
  this.scene.events.emit('inventoryUpdated', this.slots);
  return true;
}
```

**Step 2：修改默认 slot 创建（添加 instance 字段）**

在原"Find empty slot"分支构造对象处，添加：
```js
this.slots[emptyIdx] = {
  ...原有字段,
  // Equipment instance 字段（仅 equipment 用，材料/消耗品 null）
  instanceId: itemData.instanceId || null,
  enhanceLevel: itemData.enhanceLevel || 0,
  affixes: itemData.affixes || []
};
```

（实际上由于装备已在前面 early return，这里不会触发，但保留兜底。）

**Step 3：exportData / importData 已有结构兼容（slot 整体存）**

无需改。

**Step 4：build + 浏览器验收**

杀怪 → 装备进入背包 → 控制台 log inventory.slots，确认装备 instance 完整保留 instanceId/affixes/enhanceLevel。

**Step 5：commit**

```bash
git add src/systems/InventorySystem.js
git commit -m "feat(inventory): 装备实例化存储，不再堆叠同模板"
```

---

## Task 8：EnhanceSystem

**Goal:** 强化与分解的纯逻辑系统。

**Files:**
- Create: `src/systems/EnhanceSystem.js`

**Step 1：实现**

```js
import {
  MATERIALS, DECOMPOSE_TABLE,
  getEnhanceCost, getEnhanceSuccessRate, getEnhanceFailureBehavior
} from '../data/materials.js';
import itemData from '../data/items.json';

/**
 * 强化与分解系统（纯函数 + 副作用集中）
 *
 * 通过 scene 引用拿到 inventory + player 来执行操作。
 */
export class EnhanceSystem {
  constructor(scene) {
    this.scene = scene;
  }

  /** 取强化成本（用于 UI 预览） */
  getCost(currentEnhanceLevel) {
    return getEnhanceCost(currentEnhanceLevel);
  }

  /** 成功率（UI 展示） */
  getSuccessRate(currentEnhanceLevel) {
    return getEnhanceSuccessRate(currentEnhanceLevel);
  }

  /** 检查是否能强化 */
  canEnhance(equipInstance) {
    if (!equipInstance || equipInstance.type !== 'equipment') return { ok: false, reason: 'not_equipment' };
    if ((equipInstance.enhanceLevel || 0) >= 15) return { ok: false, reason: 'maxed' };
    const cost = this.getCost(equipInstance.enhanceLevel || 0);
    if (!cost) return { ok: false, reason: 'maxed' };

    const inv = this.scene.inventory;
    const matCount = this._countMaterial(cost.matId);
    if (matCount < cost.count) return { ok: false, reason: 'no_material', need: cost };
    if ((inv.gold || 0) < cost.gold) return { ok: false, reason: 'no_gold', need: cost };
    return { ok: true, cost };
  }

  /**
   * 强化指定背包格的装备（直接修改 inventory.slots[idx]）
   * @returns {{result: 'success'|'fail_stay'|'fail_downgrade', newLevel: number}}
   */
  enhance(slotIndex) {
    const inv = this.scene.inventory;
    const eq = inv.slots[slotIndex];
    const check = this.canEnhance(eq);
    if (!check.ok) return { result: 'invalid', reason: check.reason };

    // 扣材料 + 金币
    this._consumeMaterial(check.cost.matId, check.cost.count);
    inv.gold -= check.cost.gold;
    this.scene.events.emit('goldChanged', inv.gold);

    const cur = eq.enhanceLevel || 0;
    const rate = this.getSuccessRate(cur);
    const success = Math.random() < rate;

    if (success) {
      eq.enhanceLevel = cur + 1;
      this.scene.equipmentSystem._applyBonuses();
      this.scene.events.emit('inventoryUpdated', inv.slots);
      this.scene.events.emit('showMessage', `强化成功！+${eq.enhanceLevel}`, '#66ff88');
      return { result: 'success', newLevel: eq.enhanceLevel };
    }

    // 失败
    const behavior = getEnhanceFailureBehavior(cur);
    if (behavior === 'downgrade' && cur > 0) {
      eq.enhanceLevel = cur - 1;
      this.scene.equipmentSystem._applyBonuses();
      this.scene.events.emit('inventoryUpdated', inv.slots);
      this.scene.events.emit('showMessage', `强化失败，等级 -1`, '#ff8866');
      return { result: 'fail_downgrade', newLevel: eq.enhanceLevel };
    }
    this.scene.events.emit('showMessage', `强化失败，等级保持`, '#ffaa44');
    return { result: 'fail_stay', newLevel: cur };
  }

  /**
   * 分解指定背包格的装备
   * @returns {{result: 'success', drops: Array<{matId, count}>}|{result:'invalid'}}
   */
  decompose(slotIndex) {
    const inv = this.scene.inventory;
    const eq = inv.slots[slotIndex];
    if (!eq || eq.type !== 'equipment') return { result: 'invalid' };

    const drops = (DECOMPOSE_TABLE[eq.rarity] || DECOMPOSE_TABLE.common).map(d => ({ ...d }));
    // 高强化等级额外奖励
    if ((eq.enhanceLevel || 0) >= 5) {
      drops.forEach(d => d.count += 1);
    }

    inv.removeItem(slotIndex);

    drops.forEach(d => {
      const matTpl = itemData.items[d.matId];
      if (matTpl) inv.addItem(matTpl, d.count);
    });

    const summary = drops.map(d => `${MATERIALS[d.matId]?.name || d.matId} ×${d.count}`).join(', ');
    this.scene.events.emit('showMessage', `分解：${summary}`, '#aaccff');
    this.scene.events.emit('inventoryUpdated', inv.slots);
    return { result: 'success', drops };
  }

  // ── 内部辅助 ─────────────────────────

  _countMaterial(matId) {
    const inv = this.scene.inventory;
    return inv.slots.reduce((sum, s) => {
      if (s && s.id === matId) return sum + (s.quantity || 0);
      return sum;
    }, 0);
  }

  _consumeMaterial(matId, count) {
    const inv = this.scene.inventory;
    let remaining = count;
    for (let i = 0; i < inv.slots.length && remaining > 0; i++) {
      const s = inv.slots[i];
      if (s && s.id === matId) {
        const take = Math.min(remaining, s.quantity);
        s.quantity -= take;
        remaining -= take;
        if (s.quantity <= 0) inv.slots[i] = null;
      }
    }
    this.scene.events.emit('inventoryUpdated', inv.slots);
  }
}
```

**Step 2：在 MainGameScene 注册**

修改 `MainGameScene.create()`，在 `this.equipmentSystem = ...` 附近加：
```js
import { EnhanceSystem } from '../systems/EnhanceSystem.js';

// 在 create 里：
this.enhanceSystem = new EnhanceSystem(this);
```

**Step 3：build 验证**

Run: `pnpm build`

**Step 4：commit**

```bash
git add src/systems/EnhanceSystem.js src/scenes/MainGameScene.js
git commit -m "feat(equipment): EnhanceSystem — 强化（成本/成功率）+ 分解"
```

---

## Task 9：InventoryPanel — 装备 tooltip 显示词条

**Goal:** 装备格子 hover 时 tooltip 显示完整属性：品质 / +N 强化 / 基础属性 / 词条列表。

**Files:**
- Modify: `src/ui/panels/InventoryPanel.js`

**Step 1：找到 tooltip 构造代码**

InventoryPanel 的 hover 构建处（搜索 `tooltipText.setText` 或类似）。

**Step 2：扩展 tooltip 文本生成**

新建辅助函数（写在文件顶部或 InventoryPanel 内）：

```js
import { AFFIXES } from '../../data/affixes.js';
import { RARITY_MULTIPLIERS } from '../../data/lootTables.js';

const RARITY_LABEL = {
  common:'普通', uncommon:'优秀', rare:'稀有',
  epic:'史诗', legendary:'传说', mythic:'神话'
};
const TIER_COLOR = {
  1: '#ff6633',  // T1 橙红 —最强
  2: '#ffaa44',
  3: '#ffdd66',
  4: '#cccccc',
  5: '#888888'
};

function formatEquipTooltip(item) {
  const lines = [];
  const enh = item.enhanceLevel ? ` +${item.enhanceLevel}` : '';
  lines.push(`${item.name}${enh}`);
  lines.push(`[${RARITY_LABEL[item.rarity] || ''}] Lv.${item.level || 1}`);
  if (item.weaponType) {
    const wt = { heavy:'战士', light:'弓箭手', magic:'法师' }[item.weaponType] || '';
    lines.push(`职业: ${wt}`);
  }
  // 基础属性（含强化倍率）
  if (item.baseStats) {
    const rarityMult = RARITY_MULTIPLIERS[item.rarity] || 1.0;
    const lvlMult = 1 + 0.1 * (item.level || 1);
    const enhMult = 1 + 0.05 * (item.enhanceLevel || 0);
    const total = rarityMult * lvlMult * enhMult;
    lines.push('— 基础属性 —');
    for (const [k, v] of Object.entries(item.baseStats)) {
      lines.push(`  ${k} +${(v * total).toFixed(1)}`);
    }
  }
  // 词条
  if (item.affixes && item.affixes.length) {
    lines.push('— 词条 —');
    for (const a of item.affixes) {
      const def = AFFIXES[a.id];
      if (!def) continue;
      const v = def.isFlat ? a.value.toFixed(1) : `${(a.value * 100).toFixed(1)}%`;
      lines.push(`  T${def.tier} ${def.name}: ${v}`);
    }
  }
  if (item.description) lines.push(`\n${item.description}`);
  return lines.join('\n');
}
```

**Step 3：在 hover 显示时调用**

找到原 tooltip 设置文本的代码：
```js
// 原代码可能：
this.tooltipText.setText(item.description || item.name);

// 改为：
if (item.type === 'equipment') {
  this.tooltipText.setText(formatEquipTooltip(item));
} else {
  this.tooltipText.setText(item.description || item.name);
}
```

**Step 4：词条着色（可选，简化 Phase 1 跳过）**

Phase 1 用单色文本即可；Phase 2 可以拆 multi-color（按 tier 着色）。

**Step 5：build + 浏览器验收**

杀怪获得 rare+ 装备 → 背包 hover → tooltip 显示完整词条与强化等级。

**Step 6：commit**

```bash
git add src/ui/panels/InventoryPanel.js
git commit -m "feat(ui): 装备 tooltip 显示品质/强化/词条"
```

---

## Task 10：SmithyPanel — 强化 / 分解小窗口

**Goal:** 在 InventoryPanel 装备格子右键（或长按）打开操作菜单，包含强化/分解按钮，点击弹出确认窗口。

**Files:**
- Create: `src/ui/panels/SmithyPanel.js`
- Modify: `src/ui/panels/InventoryPanel.js`（接入右键菜单）
- Modify: `src/scenes/PanelScene.js`（混入 SmithyPanel）

**Step 1：创建 SmithyPanel.js**

```js
import { MATERIALS, getEnhanceCost, getEnhanceSuccessRate } from '../../data/materials.js';
import itemData from '../../data/items.json';

/**
 * 强化/分解小窗口（modal in PanelScene）
 *
 * 通过 this.openEnhanceModal(slotIndex) / this.openDecomposeModal(slotIndex) 打开
 */
export const SmithyPanel = {
  openEnhanceModal(slotIndex) {
    const inv = this.gameScene?.inventory;
    const eq = inv?.slots[slotIndex];
    if (!eq || eq.type !== 'equipment') return;
    this._closeSmithyModal();

    const enh = eq.enhanceLevel || 0;
    const cost = getEnhanceCost(enh);
    const rate = getEnhanceSuccessRate(enh);
    const matName = cost ? (MATERIALS[cost.matId]?.name || cost.matId) : '';

    const cx = this._uiW / 2, cy = this._uiH / 2;
    const c = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(cx, cy, this._uiW, this._uiH, 0, 0.6).setInteractive();
    const panel = this.add.rectangle(cx, cy, 360, 240, 0x1a1a2e, 0.98).setStrokeStyle(2, 0xffaa44);
    const title = this.add.text(cx, cy - 95, `强化 ${eq.name} +${enh}`, {
      fontSize:'15px', color:'#ffdd66', fontFamily:'Courier New', fontStyle:'bold'
    }).setOrigin(0.5);
    const info = enh >= 15
      ? this.add.text(cx, cy - 30, '已达最高强化等级 +15', { fontSize:'12px', color:'#aaaaaa' }).setOrigin(0.5)
      : this.add.text(cx, cy - 30,
          `下一级: +${enh+1}\n材料: ${matName} ×${cost.count}\n金币: ${cost.gold}\n成功率: ${(rate*100).toFixed(0)}%`,
          { fontSize:'12px', color:'#cccccc', fontFamily:'Courier New', align:'center', lineSpacing:4 }
        ).setOrigin(0.5);

    c.add([dim, panel, title, info]);

    if (enh < 15) {
      const okBg = this.add.rectangle(cx - 70, cy + 70, 110, 32, 0x224422)
        .setStrokeStyle(1, 0x66ff88).setInteractive({ useHandCursor: true });
      const okTxt = this.add.text(cx - 70, cy + 70, '强化', { fontSize:'13px', color:'#66ff88' }).setOrigin(0.5);
      okBg.on('pointerdown', () => {
        const r = this.gameScene.enhanceSystem.enhance(slotIndex);
        if (r.result === 'invalid') {
          this._showPanelToast(this._enhanceErrText(r.reason), '#ff6666');
        }
        this._closeSmithyModal();
      });
      c.add([okBg, okTxt]);
    }

    const cancelBg = this.add.rectangle(cx + 70, cy + 70, 110, 32, 0x442222)
      .setStrokeStyle(1, 0xff6666).setInteractive({ useHandCursor: true });
    const cancelTxt = this.add.text(cx + 70, cy + 70, '取消', { fontSize:'13px', color:'#ff8866' }).setOrigin(0.5);
    cancelBg.on('pointerdown', () => this._closeSmithyModal());
    c.add([cancelBg, cancelTxt]);

    this._smithyModal = c;
  },

  openDecomposeModal(slotIndex) {
    const inv = this.gameScene?.inventory;
    const eq = inv?.slots[slotIndex];
    if (!eq || eq.type !== 'equipment') return;
    this._closeSmithyModal();

    const cx = this._uiW / 2, cy = this._uiH / 2;
    const c = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(cx, cy, this._uiW, this._uiH, 0, 0.6).setInteractive();
    const panel = this.add.rectangle(cx, cy, 360, 200, 0x1a1a2e, 0.98).setStrokeStyle(2, 0xff6666);
    const title = this.add.text(cx, cy - 75, `分解 ${eq.name}`, {
      fontSize:'15px', color:'#ff8866', fontFamily:'Courier New', fontStyle:'bold'
    }).setOrigin(0.5);
    const info = this.add.text(cx, cy - 20,
      '此操作不可逆，装备会变成对应材料',
      { fontSize:'12px', color:'#aaaaaa', fontFamily:'Courier New' }
    ).setOrigin(0.5);
    c.add([dim, panel, title, info]);

    const okBg = this.add.rectangle(cx - 70, cy + 50, 110, 32, 0x442222)
      .setStrokeStyle(1, 0xff6666).setInteractive({ useHandCursor: true });
    const okTxt = this.add.text(cx - 70, cy + 50, '分解', { fontSize:'13px', color:'#ff6666' }).setOrigin(0.5);
    okBg.on('pointerdown', () => {
      this.gameScene.enhanceSystem.decompose(slotIndex);
      this._closeSmithyModal();
    });

    const cancelBg = this.add.rectangle(cx + 70, cy + 50, 110, 32, 0x222244)
      .setStrokeStyle(1, 0x6688aa).setInteractive({ useHandCursor: true });
    const cancelTxt = this.add.text(cx + 70, cy + 50, '取消', { fontSize:'13px', color:'#aaccff' }).setOrigin(0.5);
    cancelBg.on('pointerdown', () => this._closeSmithyModal());

    c.add([okBg, okTxt, cancelBg, cancelTxt]);
    this._smithyModal = c;
  },

  _closeSmithyModal() {
    if (this._smithyModal) {
      this._smithyModal.destroy();
      this._smithyModal = null;
    }
  },

  _enhanceErrText(reason) {
    return ({
      no_material: '材料不足',
      no_gold: '金币不足',
      maxed: '已达最高强化等级',
      not_equipment: '不是装备'
    })[reason] || '强化失败';
  }
};
```

**Step 2：PanelScene 注入 SmithyPanel**

修改 `src/scenes/PanelScene.js` 末尾：
```js
import { SmithyPanel } from '../ui/panels/SmithyPanel.js';

Object.assign(PanelScene.prototype, SmithyPanel);
```

**Step 3：InventoryPanel 加右键菜单**

找到 InventoryPanel 中装备格子的 pointer 事件处理。在 pointerdown 处理器加入右键判断（或长按）：

```js
// 在格子的 pointerdown 监听里：
slot.on('pointerdown', (pointer) => {
  if (!item) return;
  if (pointer.rightButtonDown && pointer.rightButtonDown()) {
    if (item.type === 'equipment') {
      this._openInventoryContextMenu(slotIndex, item);
    }
    return;
  }
  // 原有左键逻辑（装备/使用）
  ...
});
```

新增方法：
```js
_openInventoryContextMenu(slotIndex, item) {
  // 简化：先直接弹强化菜单（默认操作）；分解通过单独 UI
  // 或者先弹个小菜单选 强化/分解：
  const cx = this._uiW / 2, cy = this._uiH / 2;
  const c = this.add.container(0, 0).setDepth(40);
  const dim = this.add.rectangle(cx, cy, this._uiW, this._uiH, 0, 0.4).setInteractive();
  dim.on('pointerdown', () => c.destroy());
  const bg = this.add.rectangle(cx, cy, 200, 110, 0x1a1a2e, 0.98).setStrokeStyle(1, 0x6666aa);

  const enh = this.add.text(cx, cy - 22, '🔨 强化', {
    fontSize:'14px', color:'#ffdd66', fontFamily:'Courier New'
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  enh.on('pointerdown', () => { c.destroy(); this.openEnhanceModal(slotIndex); });

  const dec = this.add.text(cx, cy + 22, '🪓 分解', {
    fontSize:'14px', color:'#ff8866', fontFamily:'Courier New'
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  dec.on('pointerdown', () => { c.destroy(); this.openDecomposeModal(slotIndex); });

  c.add([dim, bg, enh, dec]);
}
```

**Step 4：build + 浏览器验收**

启动 dev → 打开背包 → 装备右键 → 弹出 强化/分解 菜单 → 选强化 → 弹强化窗口 → 点强化 → 控制台 / Toast 显示成功或失败。

**Step 5：commit**

```bash
git add src/ui/panels/SmithyPanel.js src/ui/panels/InventoryPanel.js src/scenes/PanelScene.js
git commit -m "feat(ui): 装备右键菜单 + 强化/分解小窗口"
```

---

## Task 11：SaveSystem 兼容老存档

**Goal:** 老存档里装备没有 instanceId/affixes/enhanceLevel，加载时补默认值。

**Files:**
- Modify: `src/systems/SaveSystem.js`

**Step 1：在 load 中补字段**

找到 `if (scene.equipmentSystem && saveData.equipment)` 之后，新增遍历填充：

```js
// 兼容老存档：装备 instance 字段补全
if (scene.equipmentSystem) {
  const slots = scene.equipmentSystem.slots;
  for (const k in slots) {
    const it = slots[k];
    if (!it) continue;
    if (!it.instanceId) it.instanceId = `eq_legacy_${k}_${Date.now()}`;
    if (!Array.isArray(it.affixes)) it.affixes = [];
    if (typeof it.enhanceLevel !== 'number') it.enhanceLevel = 0;
  }
  scene.equipmentSystem._applyBonuses();
}
```

类似处理 inventory：
```js
if (scene.inventory && Array.isArray(scene.inventory.slots)) {
  for (const it of scene.inventory.slots) {
    if (!it || it.type !== 'equipment') continue;
    if (!it.instanceId) it.instanceId = `eq_legacy_inv_${Date.now()}_${Math.random().toString(36).slice(2,5)}`;
    if (!Array.isArray(it.affixes)) it.affixes = [];
    if (typeof it.enhanceLevel !== 'number') it.enhanceLevel = 0;
  }
}
```

**Step 2：build + 测试老存档**

如果有老存档可以测；没有则验证新存档加载也工作。

**Step 3：commit**

```bash
git add src/systems/SaveSystem.js
git commit -m "feat(save): 兼容老存档（装备补 instanceId/affixes/enhanceLevel）"
```

---

## Task 12：调参 + 浏览器全流程验收

**Goal:** 跑一遍完整闭环，发现并修问题。

**验收步骤：**

1. **新游戏开局 → 杀几只小怪**
   - 装备掉落是不同 rarity 的实例
   - rare+ 装备含 1-2 条词条
   - 控制台无报错

2. **背包查看**
   - hover 装备 tooltip 显示品质 / 等级 / 词条列表 / 强化等级
   - 不同 rarity 边框颜色不同

3. **装备**
   - 装上 rare 武器，攻击力提升明显
   - 卸下后回归

4. **强化**
   - 右键武器 → 强化 → 选 +1（材料够）→ 成功
   - 连续强化到 +5（必成）
   - +6 开始有失败可能
   - 强化后 baseStats 数值提升 5%/级

5. **分解**
   - 右键装备 → 分解 → 确认 → 背包获得材料
   - 分解 +5 装备：材料数额外 +1

6. **错误提示**
   - 材料不足强化 → 提示 toast
   - 满 +15 强化 → 提示 maxed
   - 老存档加载 → 不报错

**调参建议：**

- 词条 valueRange 是否过强 / 过弱？跑一两件 rare 装备看实际数值
- 强化金币消耗是否过高？前期玩家金币产出有限
- mythic 概率（5% boss / 0% 普通）是否合理？

**Final commit + push（可选）：**

如果一切 OK：
```bash
git status  # 确认 clean
# 推送由用户确认
```

---

## 不在 Phase 1（明确推迟）

- ❌ 洗练（reforge）
- ❌ 孔位 + 宝石
- ❌ 触发型词条（"攻击有概率触发火球" 等）
- ❌ 套装
- ❌ 顶级材料（divine_heart 等）
- ❌ 装备制作（craft）
- ❌ 多语言
- ❌ 自动测试（项目无测试框架）

详见 `docs/plans/2026-05-03-equipment-materials-system-design.md`。
