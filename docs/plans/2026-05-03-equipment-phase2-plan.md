# 装备 Phase 2 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 Phase 1 实例化装备 + 词条 + 强化 + 分解的基础上，加入洗练、孔位/宝石、触发型词条、装备制作 4 个深度系统。

**Architecture:** 装备 instance 加 `sockets[]` 字段；新增 GemSystem / ReforgeSystem / CraftingSystem / TriggerSystem 4 个独立系统；SmithyPanel 加 4 个新 modal；InteractionHandler 在战斗触发点调用 TriggerSystem。

**Tech Stack:** Phaser 3.90、vanilla JS、Vite。无单测，build + 浏览器手动验收。

**前置文档：** `docs/plans/2026-05-03-equipment-phase2-design.md`

---

## Task 图

```
T1 数据层（gems.js / recipes.js / 扩展 items.json/lootTables 加宝石+材料）
   ↓
T2 EquipmentGenerator 加 sockets 生成 + 触发型词条数据加 trigger 字段
   ↓
T3 GemSystem（镶嵌/拆卸/合成）
   ↓
T4 ReforgeSystem（洗练）
   ↓
T5 CraftingSystem（制作）
   ↓
T6 TriggerSystem + InteractionHandler 注入触发点
   ↓
T7 EquipmentSystem 消费宝石属性贡献
   ↓
T8 SmithyPanel 加 4 个 modal（洗练/镶嵌/合成/制作）
   ↓
T9 InventoryPanel tooltip 显示孔位 + 触发型词条 + 右键菜单扩展
   ↓
T10 CharacterPanel 右键菜单扩展（加洗练/镶嵌选项）
   ↓
T11 SaveSystem 兼容（sockets 字段补全）
   ↓
T12 build + 浏览器全流程验收
```

---

## T1: 数据层 — gems / 配方 / items.json 扩展

**Files:**
- Create: `src/data/gems.js`
- Create: `src/data/recipes.js`
- Modify: `src/data/items.json`（加宝石 4 种 lv1 + 材料 4 种）
- Modify: `src/data/lootTables.js`（加宝石/高级材料掉落）

### Step 1.1：gems.js

```js
/**
 * 宝石数据：4 色 × 10 级
 *
 * 玩家通过镶嵌到装备孔位获得贡献；3 同色同级合成高 1 级。
 */

const COLORS = ['red', 'blue', 'green', 'yellow'];

// 各色基础属性曲线（lv1 数值，递增按 lv*基值）
const STAT_DEF = {
  red:    { stat: 'attack',   isFlat: true,  baseValue: 3 },     // +3/lv flat attack
  blue:   { stat: 'spellPower', isFlat: true, baseValue: 4 },    // +4/lv flat spellPower
  green:  { stat: 'maxHp',    isFlat: true,  baseValue: 15 },    // +15/lv flat maxHp
  yellow: { stat: 'critRate', isFlat: true,  baseValue: 1.5 }    // +1.5/lv flat critRate (百分点)
};

export const GEMS = {};
for (const color of COLORS) {
  const def = STAT_DEF[color];
  GEMS[`${color}_gem`] = {
    id: `${color}_gem`,
    color,
    name: { red:'红宝石', blue:'蓝宝石', green:'绿宝石', yellow:'黄宝石' }[color],
    stat: def.stat,
    isFlat: def.isFlat,
    baseValue: def.baseValue,
    icon: { red:'🔴', blue:'🔵', green:'🟢', yellow:'🟡' }[color]
  };
}

/** 取宝石在某等级的属性值 */
export function getGemValue(gemId, level) {
  const def = GEMS[gemId];
  if (!def) return 0;
  return def.baseValue * level;
}

/** 取宝石实例（用于 inventory 存储） */
export function makeGemInstance(gemId, level = 1) {
  const def = GEMS[gemId];
  if (!def) return null;
  return {
    id: gemId,
    type: 'gem',
    color: def.color,
    name: `${def.name} Lv.${level}`,
    icon: def.icon,
    level,
    stat: def.stat,
    value: getGemValue(gemId, level),
    isFlat: def.isFlat,
    rarity: level >= 7 ? 'epic' : level >= 4 ? 'rare' : level >= 2 ? 'uncommon' : 'common',
    stackable: true,
    maxStack: 99,
    description: `镶嵌到装备孔位 +${def.isFlat ? def.baseValue * level : (def.baseValue * level * 100).toFixed(1) + '%'} ${def.stat}`,
    sellPrice: level * level * 5
  };
}

export const MAX_GEM_LEVEL = 10;
```

### Step 1.2：recipes.js

```js
/**
 * 装备制作配方
 */
export const RECIPES = {
  steel_blade_recipe: {
    id: 'steel_blade_recipe',
    name: '钢剑配方',
    resultId: 'steel_blade',
    resultRarity: 'rare',
    resultLevel: 5,
    materials: [
      { matId: 'enhance_stone', count: 5 },
      { matId: 'iron_shard', count: 20 }
    ],
    gold: 500,
    requiredLevel: 5
  },
  guardian_plate_recipe: {
    id: 'guardian_plate_recipe',
    name: '守护板甲配方',
    resultId: 'guardian_plate',
    resultRarity: 'rare',
    resultLevel: 8,
    materials: [
      { matId: 'enhance_stone', count: 8 },
      { matId: 'iron_shard', count: 30 },
      { matId: 'refining_stone', count: 2 }
    ],
    gold: 1200,
    requiredLevel: 8
  },
  shadow_dagger_recipe: {
    id: 'shadow_dagger_recipe',
    name: '影刃配方',
    resultId: 'shadow_dagger',
    resultRarity: 'rare',
    resultLevel: 5,
    materials: [
      { matId: 'enhance_stone', count: 5 },
      { matId: 'iron_shard', count: 15 }
    ],
    gold: 500,
    requiredLevel: 5
  },
  flame_staff_recipe: {
    id: 'flame_staff_recipe',
    name: '火焰法杖配方',
    resultId: 'flame_staff',
    resultRarity: 'epic',
    resultLevel: 10,
    materials: [
      { matId: 'ancient_core', count: 1 },
      { matId: 'enhance_stone', count: 10 },
      { matId: 'chaos_essence', count: 2 }
    ],
    gold: 2500,
    requiredLevel: 10
  },
  copper_ring_recipe: {
    id: 'copper_ring_recipe',
    name: '铜戒配方',
    resultId: 'copper_ring',
    resultRarity: 'rare',
    resultLevel: 6,
    materials: [
      { matId: 'enhance_stone', count: 4 },
      { matId: 'iron_shard', count: 10 }
    ],
    gold: 600,
    requiredLevel: 6
  },
  bone_necklace_recipe: {
    id: 'bone_necklace_recipe',
    name: '骨项链配方',
    resultId: 'bone_necklace',
    resultRarity: 'epic',
    resultLevel: 12,
    materials: [
      { matId: 'ancient_core', count: 2 },
      { matId: 'soul_crystal', count: 1 }
    ],
    gold: 3000,
    requiredLevel: 12
  }
};
```

### Step 1.3：items.json 加 4 宝石 + 4 材料

新增材料：
- `chaos_essence`：混沌精华，rare，stackable maxStack 999
- `soul_crystal`：灵魂结晶，epic，maxStack 999
- `refining_stone`：精炼石，uncommon，maxStack 999
- `star_fragment`：星辰碎片，rare，maxStack 999

新增宝石（lv1 形态）：
- `red_gem`：红宝石 Lv.1，type:'gem'，stackable maxStack 99
- `blue_gem`：蓝宝石 Lv.1
- `green_gem`：绿宝石 Lv.1
- `yellow_gem`：黄宝石 Lv.1

```json
"chaos_essence": {
  "id":"chaos_essence","name":"混沌精华","type":"material","texture":"potion",
  "rarity":"rare","stackable":true,"maxStack":999,"level":1,"sellPrice":80,"value":0,
  "description":"洗练装备词条所需的混沌之力"
},
"soul_crystal": {
  "id":"soul_crystal","name":"灵魂结晶","type":"material","texture":"potion",
  "rarity":"epic","stackable":true,"maxStack":999,"level":1,"sellPrice":200,"value":0,
  "description":"锁定词条用，凝聚着英魂之力"
},
"refining_stone": {
  "id":"refining_stone","name":"精炼石","type":"material","texture":"potion",
  "rarity":"uncommon","stackable":true,"maxStack":999,"level":1,"sellPrice":15,"value":0,
  "description":"中级制作材料"
},
"star_fragment": {
  "id":"star_fragment","name":"星辰碎片","type":"material","texture":"potion",
  "rarity":"rare","stackable":true,"maxStack":999,"level":1,"sellPrice":120,"value":0,
  "description":"宝石升级所需的星辰之力"
},
"red_gem": {
  "id":"red_gem","name":"红宝石 Lv.1","type":"gem","texture":"potion",
  "color":"red","level":1,"stat":"attack","value":3,"isFlat":true,
  "rarity":"common","stackable":true,"maxStack":99,"sellPrice":5,"value":0,
  "description":"镶嵌到装备孔位 +3 攻击"
},
"blue_gem": {
  "id":"blue_gem","name":"蓝宝石 Lv.1","type":"gem","texture":"potion",
  "color":"blue","level":1,"stat":"spellPower","value":4,"isFlat":true,
  "rarity":"common","stackable":true,"maxStack":99,"sellPrice":5,
  "description":"镶嵌到装备孔位 +4 法术强度"
},
"green_gem": {
  "id":"green_gem","name":"绿宝石 Lv.1","type":"gem","texture":"potion",
  "color":"green","level":1,"stat":"maxHp","value":15,"isFlat":true,
  "rarity":"common","stackable":true,"maxStack":99,"sellPrice":5,
  "description":"镶嵌到装备孔位 +15 生命值"
},
"yellow_gem": {
  "id":"yellow_gem","name":"黄宝石 Lv.1","type":"gem","texture":"potion",
  "color":"yellow","level":1,"stat":"critRate","value":1.5,"isFlat":true,
  "rarity":"common","stackable":true,"maxStack":99,"sellPrice":5,
  "description":"镶嵌到装备孔位 +1.5% 暴击率"
}
```

注意：宝石 `value` 字段要么是 0 要么是属性值——按 items.json 现有 `value` 表示金币兑换值，材料用 0；这里宝石我们用 0（与材料一致），属性值放在 `value` 也容易混淆。**用 0 即可**，属性值通过 `getGemValue` 查表。

### Step 1.4：lootTables.js 调整

为每个 enemy 的 pools 数组加 `materials` 池（已部分有），扩充材料种类：
- 普通怪：iron_shard / refining_stone（低概率） / red_gem 等 lv1 宝石（极低概率）
- 精英怪：enhance_stone / chaos_essence / star_fragment / 中级宝石
- boss：ancient_core / soul_crystal / 高级宝石

具体权重参考现有 `gold` 池配置自行平衡。

### Step 1.5：build + commit

```bash
pnpm build
git add src/data/gems.js src/data/recipes.js src/data/items.json src/data/lootTables.js
git commit -m "feat(equipment-p2): 数据层 — 宝石/配方/材料/掉落表"
```

---

## T2: EquipmentGenerator 加 sockets + 触发型词条数据

**Files:**
- Modify: `src/systems/EquipmentGenerator.js`
- Modify: `src/data/affixes.js`（加 4 条触发型词条）

### Step 2.1：EquipmentGenerator 生成 sockets

```js
const SOCKET_COUNTS = {
  common: 0, uncommon: 0, rare: 1,
  epic: 2, legendary: 3, mythic: 4
};

// generate 末尾，return 之前：
const socketCount = SOCKET_COUNTS[rarity] || 0;
const sockets = [];
for (let i = 0; i < socketCount; i++) sockets.push({ gemId: null, gemLevel: 0 });

return {
  ...,
  sockets
};
```

### Step 2.2：affixes.js 加 4 条触发型词条

```js
// 追加到 AFFIXES 对象
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
  trigger: { event:'onSkillCast', chance:1.0, effect:'reduce_cd', power:500 }  // 500ms
},
lifesteal_on_crit_t2: {
  id:'lifesteal_on_crit_t2', name:'血怒',
  pool:'weapon_common', tier:2, stat:'_trigger',
  isFlat:false, valueRange:[1,1], minRarity:'rare', weight:4,
  trigger: { event:'onCrit', chance:1.0, effect:'lifesteal_pct', power:0.30 }
}
```

### Step 2.3：build + commit
```bash
git add src/systems/EquipmentGenerator.js src/data/affixes.js
git commit -m "feat(equipment-p2): 装备生成 sockets + 触发型词条数据"
```

---

## T3: GemSystem

**Files:**
- Create: `src/systems/GemSystem.js`
- Modify: `src/scenes/MainGameScene.js`（注册）

### 实现

```js
import { GEMS, getGemValue, makeGemInstance, MAX_GEM_LEVEL } from '../data/gems.js';
import itemData from '../data/items.json';

export class GemSystem {
  constructor(scene) {
    this.scene = scene;
  }

  /** 镶嵌：从背包取宝石（slotIndex），放到装备 sockets[socketIdx] */
  socket(equipInstance, socketIdx, gemSlotIndex) {
    if (!equipInstance || !equipInstance.sockets) return { ok:false, reason:'no_sockets' };
    if (socketIdx < 0 || socketIdx >= equipInstance.sockets.length)
      return { ok:false, reason:'invalid_socket' };
    if (equipInstance.sockets[socketIdx].gemId) return { ok:false, reason:'socket_occupied' };

    const inv = this.scene.inventory;
    const gem = inv.slots[gemSlotIndex];
    if (!gem || gem.type !== 'gem') return { ok:false, reason:'not_gem' };

    // 扣 1 颗宝石
    if (gem.quantity > 1) gem.quantity -= 1;
    else inv.slots[gemSlotIndex] = null;

    equipInstance.sockets[socketIdx] = { gemId: gem.id, gemLevel: gem.level };
    this.scene.equipmentSystem._applyBonuses();
    this.scene.events.emit('inventoryUpdated', inv.slots);
    this.scene.events.emit('showMessage', `已镶嵌 ${gem.name}`, '#66ccff');
    return { ok:true };
  }

  /** 拆卸：把宝石还回背包 */
  unsocket(equipInstance, socketIdx) {
    if (!equipInstance || !equipInstance.sockets) return { ok:false, reason:'no_sockets' };
    const slot = equipInstance.sockets[socketIdx];
    if (!slot || !slot.gemId) return { ok:false, reason:'empty_socket' };

    const inv = this.scene.inventory;
    const gemTpl = makeGemInstance(slot.gemId, slot.gemLevel);
    if (!gemTpl) return { ok:false, reason:'invalid_gem' };

    if (!inv.addItem(gemTpl, 1)) return { ok:false, reason:'inv_full' };

    equipInstance.sockets[socketIdx] = { gemId: null, gemLevel: 0 };
    this.scene.equipmentSystem._applyBonuses();
    this.scene.events.emit('inventoryUpdated', inv.slots);
    this.scene.events.emit('showMessage', `已拆卸 ${gemTpl.name}`, '#aaccff');
    return { ok:true };
  }

  /** 合成：3 颗同色同级 → 1 颗高 1 级 */
  fuse(gemSlotIndices) {
    if (!Array.isArray(gemSlotIndices) || gemSlotIndices.length !== 3)
      return { ok:false, reason:'need_3' };

    const inv = this.scene.inventory;
    const gems = gemSlotIndices.map(i => inv.slots[i]);
    if (gems.some(g => !g || g.type !== 'gem')) return { ok:false, reason:'not_gem' };

    const first = gems[0];
    if (first.level >= MAX_GEM_LEVEL) return { ok:false, reason:'maxed' };
    if (!gems.every(g => g.id === first.id && g.level === first.level))
      return { ok:false, reason:'mismatch' };

    // 扣 3 颗
    gemSlotIndices.forEach(i => {
      const g = inv.slots[i];
      if (g.quantity > 1) g.quantity -= 1;
      else inv.slots[i] = null;
    });

    // 加 1 颗高级宝石
    const newGem = makeGemInstance(first.id, first.level + 1);
    inv.addItem(newGem, 1);

    this.scene.events.emit('inventoryUpdated', inv.slots);
    this.scene.events.emit('showMessage', `合成成功：${newGem.name}`, '#66ff88');
    return { ok:true, result: newGem };
  }
}
```

MainGameScene.create 加：
```js
import { GemSystem } from '../systems/GemSystem.js';
this.gemSystem = new GemSystem(this);
```

```bash
git add src/systems/GemSystem.js src/scenes/MainGameScene.js
git commit -m "feat(equipment-p2): GemSystem 镶嵌/拆卸/合成"
```

---

## T4: ReforgeSystem

**Files:**
- Create: `src/systems/ReforgeSystem.js`
- Modify: `src/scenes/MainGameScene.js`（注册）

### 实现

```js
import { AFFIXES, AFFIX_COUNTS, rollAffixes } from '../data/affixes.js';
import itemData from '../data/items.json';

const REFORGE_COSTS = {
  0: { matId:'chaos_essence', count: 2, gold: 1000, lockedExtras: [] },
  1: { matId:'chaos_essence', count: 3, gold: 2000, lockedExtras: [{ matId:'soul_crystal', count: 1 }] },
  2: { matId:'chaos_essence', count: 4, gold: 4000, lockedExtras: [{ matId:'soul_crystal', count: 3 }] }
};

export class ReforgeSystem {
  constructor(scene) {
    this.scene = scene;
  }

  getCost(lockCount) {
    return REFORGE_COSTS[Math.min(2, Math.max(0, lockCount))];
  }

  canReforge(eq, lockedAffixIds = []) {
    if (!eq || eq.type !== 'equipment') return { ok:false, reason:'not_equipment' };
    if (!Array.isArray(eq.affixes) || eq.affixes.length === 0)
      return { ok:false, reason:'no_affixes' };
    const lockCount = lockedAffixIds.length;
    if (lockCount > 2) return { ok:false, reason:'too_many_locks' };

    const cost = this.getCost(lockCount);
    const inv = this.scene.inventory;
    if (this._countMat(cost.matId) < cost.count) return { ok:false, reason:'no_material', cost };
    if ((inv.gold || 0) < cost.gold) return { ok:false, reason:'no_gold', cost };
    for (const extra of cost.lockedExtras) {
      if (this._countMat(extra.matId) < extra.count)
        return { ok:false, reason:'no_material_extra', cost };
    }
    return { ok:true, cost };
  }

  reforge(eq, lockedAffixIds = []) {
    const check = this.canReforge(eq, lockedAffixIds);
    if (!check.ok) return { result:'invalid', reason: check.reason };

    const inv = this.scene.inventory;
    const cost = check.cost;
    this._consumeMat(cost.matId, cost.count);
    cost.lockedExtras.forEach(e => this._consumeMat(e.matId, e.count));
    inv.gold -= cost.gold;
    this.scene.events.emit('goldChanged', inv.gold);

    // 保留锁定词条
    const locked = eq.affixes.filter(a => lockedAffixIds.includes(a.id));
    const lockedStats = new Set(locked.map(a => AFFIXES[a.id]?.stat).filter(Boolean));

    // 重 roll 剩余词条数（避免锁定的 stat）
    const tpl = itemData.items[eq.templateId];
    const totalCount = AFFIX_COUNTS[eq.rarity] || 0;
    const remainCount = totalCount - locked.length;
    const candidates = (tpl?.affixPools || []).flatMap(p =>
      Object.values(AFFIXES).filter(a =>
        a.pool === p && !lockedStats.has(a.stat)
      )
    );
    // 用 rollAffixes-like 逻辑（手工以排除已锁定 stat）
    const newAffixes = [];
    const usedStats = new Set(lockedStats);
    for (let i = 0; i < remainCount; i++) {
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
      newAffixes.push({ id: picked.id, value: Math.round(value * 100) / 100 });
      usedStats.add(picked.stat);
    }

    eq.affixes = [...locked, ...newAffixes];
    this.scene.equipmentSystem._applyBonuses();
    this.scene.events.emit('inventoryUpdated', inv.slots);
    this.scene.events.emit('showMessage', '洗练完成', '#66ccff');
    return { result:'success' };
  }

  _countMat(matId) {
    return this.scene.inventory.slots.reduce((sum, s) =>
      s && s.id === matId ? sum + (s.quantity || 0) : sum, 0);
  }

  _consumeMat(matId, count) {
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
  }
}
```

MainGameScene 注册 `this.reforgeSystem = new ReforgeSystem(this);`

```bash
git add src/systems/ReforgeSystem.js src/scenes/MainGameScene.js
git commit -m "feat(equipment-p2): ReforgeSystem 洗练（含锁定 1-2 条）"
```

---

## T5: CraftingSystem

**Files:**
- Create: `src/systems/CraftingSystem.js`
- Modify: `src/scenes/MainGameScene.js`（注册）

```js
import { RECIPES } from '../data/recipes.js';
import { EquipmentGenerator } from './EquipmentGenerator.js';

export class CraftingSystem {
  constructor(scene) {
    this.scene = scene;
  }

  listRecipes() {
    return Object.values(RECIPES);
  }

  canCraft(recipeId) {
    const rcp = RECIPES[recipeId];
    if (!rcp) return { ok:false, reason:'unknown_recipe' };

    const lvl = this.scene.levelSystem?.level || 1;
    if (rcp.requiredLevel && lvl < rcp.requiredLevel)
      return { ok:false, reason:'low_level', need: rcp.requiredLevel };

    const inv = this.scene.inventory;
    if ((inv.gold || 0) < rcp.gold) return { ok:false, reason:'no_gold' };
    for (const m of rcp.materials) {
      if (this._countMat(m.matId) < m.count) return { ok:false, reason:'no_material', missing: m };
    }
    return { ok:true };
  }

  craft(recipeId) {
    const check = this.canCraft(recipeId);
    if (!check.ok) return { result:'invalid', reason: check.reason };

    const rcp = RECIPES[recipeId];
    const inv = this.scene.inventory;
    rcp.materials.forEach(m => this._consumeMat(m.matId, m.count));
    inv.gold -= rcp.gold;
    this.scene.events.emit('goldChanged', inv.gold);

    const instance = EquipmentGenerator.generate(rcp.resultId, rcp.resultRarity, rcp.resultLevel);
    if (!instance) return { result:'invalid', reason:'gen_fail' };

    inv.addItem(instance, 1);
    this.scene.events.emit('inventoryUpdated', inv.slots);
    this.scene.events.emit('showMessage', `制作成功：${instance.name}`, '#66ff88');
    return { result:'success', instance };
  }

  _countMat(matId) {
    return this.scene.inventory.slots.reduce((sum, s) =>
      s && s.id === matId ? sum + (s.quantity || 0) : sum, 0);
  }

  _consumeMat(matId, count) {
    const inv = this.scene.inventory;
    let r = count;
    for (let i = 0; i < inv.slots.length && r > 0; i++) {
      const s = inv.slots[i];
      if (s && s.id === matId) {
        const take = Math.min(r, s.quantity);
        s.quantity -= take;
        r -= take;
        if (s.quantity <= 0) inv.slots[i] = null;
      }
    }
  }
}
```

注册 `this.craftingSystem = new CraftingSystem(this);`

```bash
git add src/systems/CraftingSystem.js src/scenes/MainGameScene.js
git commit -m "feat(equipment-p2): CraftingSystem 装备制作"
```

---

## T6: TriggerSystem + InteractionHandler 注入触发点

**Files:**
- Create: `src/systems/TriggerSystem.js`
- Modify: `src/managers/InteractionHandler.js`
- Modify: `src/scenes/MainGameScene.js`（注册）

### TriggerSystem 实现

```js
import { AFFIXES } from '../data/affixes.js';

const TRIGGER_EFFECTS = {
  spawn_fireball: (player, ctx, power) => {
    // 简化：直接造成 power × atk 的伤害到当前 enemy
    if (ctx.enemy && typeof ctx.enemy.takeDamage === 'function') {
      const dmg = Math.floor((player.getAttack() || 1) * power);
      ctx.enemy.takeDamage(dmg, player.sprite.x, player.sprite.y);
      // 视觉：飘字 + 简单火球图形
      if (player.scene.floatingText) {
        player.scene.floatingText.spawn(ctx.enemy.sprite.x, ctx.enemy.sprite.y - 20, `🔥${dmg}`, { color:'#ff7733', fontSize:13 });
      }
    }
  },
  heal_pct: (player, ctx, power) => {
    const amt = Math.floor((player.maxHp || 100) * power);
    player.heal(amt);
  },
  reduce_cd: (player, ctx, power) => {
    const eng = player.skillEngine;
    if (!eng?.cooldowns) return;
    for (const k in eng.cooldowns) eng.cooldowns[k] = Math.max(0, eng.cooldowns[k] - power);
  },
  lifesteal_pct: (player, ctx, power) => {
    if (ctx.damage > 0) player.heal(Math.floor(ctx.damage * power));
  }
};

export class TriggerSystem {
  constructor(scene) {
    this.scene = scene;
  }

  /** 收集玩家所有装备词条中的触发器 */
  _collectTriggers() {
    const triggers = [];
    const eqSys = this.scene.equipmentSystem;
    if (!eqSys?.slots) return triggers;
    for (const k in eqSys.slots) {
      const it = eqSys.slots[k];
      if (!it?.affixes) continue;
      for (const a of it.affixes) {
        const def = AFFIXES[a.id];
        if (def?.trigger) triggers.push(def.trigger);
      }
    }
    return triggers;
  }

  /** 在战斗触发点调用：fire('onHit', { enemy, damage }) */
  fire(event, ctx = {}) {
    const triggers = this._collectTriggers();
    const player = this.scene.player;
    if (!player) return;
    for (const t of triggers) {
      if (t.event !== event) continue;
      if (Math.random() >= (t.chance ?? 1)) continue;
      const fn = TRIGGER_EFFECTS[t.effect];
      if (fn) fn(player, ctx, t.power);
    }
  }
}
```

### InteractionHandler 注入触发点

定位 handleSkillHit 的 dash/melee 分支命中后（`enemy.takeDamage(...)` 之后），加：
```js
if (this.triggerSystem) {
  this.triggerSystem.fire('onHit', { enemy, damage });
  if (enemy.hp <= 0) this.triggerSystem.fire('onKill', { enemy });
}
```

handleAttackHit 同样：
```js
if (this.triggerSystem) {
  this.triggerSystem.fire('onHit', { enemy, damage: this.player.getAttack() });
  if (enemy.hp <= 0) this.triggerSystem.fire('onKill', { enemy });
}
```

trySkill 后或 onSkillActive 末尾（`Player.js`）：
```js
this.scene.triggerSystem?.fire('onSkillCast', { skillId });
```

注：触发系统通过 `this.scene.triggerSystem` 访问（MainGameScene 注册）。InteractionHandler mixin 到 MainGameScene，`this` 即 scene。

### 注册 + commit

```js
// MainGameScene.create
this.triggerSystem = new TriggerSystem(this);
```

```bash
git add src/systems/TriggerSystem.js src/managers/InteractionHandler.js src/scenes/MainGameScene.js
git commit -m "feat(equipment-p2): TriggerSystem + onHit/onKill/onSkillCast 触发点"
```

---

## T7: EquipmentSystem 消费宝石属性

**Files:**
- Modify: `src/systems/EquipmentSystem.js`

在 `getStatBonuses` 中遍历每件装备的 sockets，按宝石 stat/value/isFlat 累加：

```js
// 在词条处理之后追加：
if (Array.isArray(item.sockets)) {
  for (const s of item.sockets) {
    if (!s.gemId) continue;
    const gemDef = GEMS[s.gemId];
    if (!gemDef) continue;
    const value = gemDef.baseValue * (s.gemLevel || 1);
    if (gemDef.isFlat) {
      flatBonuses[gemDef.stat] = (flatBonuses[gemDef.stat] || 0) + value;
    } else {
      bonusPct[gemDef.stat] = (bonusPct[gemDef.stat] || 0) + value;
    }
  }
}
```

文件顶部 import `import { GEMS } from '../data/gems.js';`

```bash
git add src/systems/EquipmentSystem.js
git commit -m "feat(equipment-p2): EquipmentSystem 消费宝石属性贡献"
```

---

## T8: SmithyPanel 加 4 个 modal

**Files:**
- Modify: `src/ui/panels/SmithyPanel.js`

加 4 个新方法：
- `openReforgeModal(eq)` — 列出装备词条 + 锁定 checkbox + 成本预览 + 洗练按钮
- `openSocketModal(eq)` — 列出 sockets，每孔一行（已镶嵌显示宝石名+拆卸；空孔点击弹出"选择宝石"子窗）
- `openGemFusionModal()` — 列出背包 lv1-9 宝石，选 3 颗同款 → 合成
- `openCraftModal()` — 列出所有配方，每条显示需求/缺失，可制作按钮

实现量较大，每个 modal 200-400 行代码量。参考已有 openEnhanceModal/openDecomposeModal/openBulkDecomposeModal 风格写。

每个 modal 关闭都要调 `_closeSmithyModal` 风格的清理 + delayedCall scene.isActive 防御。

```bash
git add src/ui/panels/SmithyPanel.js
git commit -m "feat(equipment-p2): SmithyPanel 加洗练/镶嵌/合成/制作 4 modal"
```

---

## T9: InventoryPanel tooltip + 右键菜单扩展

**Files:**
- Modify: `src/ui/panels/InventoryPanel.js`

### 9.1 tooltip 显示孔位

`formatEquipTooltip` 在词条之后加 sockets 行：
```js
if (item.sockets && item.sockets.length) {
  lines.push('— 孔位 —');
  item.sockets.forEach((s, i) => {
    if (s.gemId) {
      const gem = GEMS[s.gemId];
      lines.push(`  孔${i+1}: ${gem?.icon || '◆'} ${gem?.name || s.gemId} Lv.${s.gemLevel}`);
    } else {
      lines.push(`  孔${i+1}: ⬜ 空`);
    }
  });
}
```

文件顶部 import `import { GEMS } from '../../data/gems.js';`

### 9.2 触发型词条特殊显示

`formatEquipTooltip` 词条循环中识别 `_trigger` stat：
```js
for (const a of item.affixes) {
  const def = AFFIXES[a.id];
  if (!def) continue;
  if (def.stat === '_trigger' && def.trigger) {
    lines.push(`  ✨ ${def.name}: ${(def.trigger.chance*100).toFixed(0)}% 触发`);
  } else {
    const v = def.isFlat ? a.value.toFixed(1) : `${(a.value * 100).toFixed(1)}%`;
    lines.push(`  T${def.tier} ${def.name}: ${v}`);
  }
}
```

### 9.3 右键菜单加 洗练 / 镶嵌

定位 `showContextMenu` 装备分支：
```js
if (item.type === 'equipment') {
  addOption('⚔ 装备', '#88ccff', () => { ... });
  addOption('🔨 强化', '#ffdd66', () => this.openEnhanceModal?.(actualSlot));
  addOption('♻ 洗练', '#66ccff', () => this.openReforgeModal?.(item));
  if (item.sockets && item.sockets.length > 0) {
    addOption('💎 镶嵌', '#aa88ff', () => this.openSocketModal?.(item));
  }
  addOption('🪓 分解', '#ff8866', () => this.openDecomposeModal?.(actualSlot));
}
```

宝石类型加合成入口：
```js
if (item.type === 'gem') {
  addOption('✨ 合成', '#ffdd66', () => this.openGemFusionModal?.());
}
```

调整 menu 宽度（emoji+多字符可能 > 100）：`bg.setSize(120, ...)`

### 9.4 顶部加 制作 + 宝石合成 按钮

类似批量拆解按钮：
```js
const craftBtn = this.add.text(...., '[🛠 制作]', {...}).setInteractive(...);
craftBtn.on('pointerdown', () => this.openCraftModal?.());

const fuseBtn = this.add.text(...., '[💎 合成]', {...}).setInteractive(...);
fuseBtn.on('pointerdown', () => this.openGemFusionModal?.());
```

```bash
git add src/ui/panels/InventoryPanel.js
git commit -m "feat(equipment-p2): InventoryPanel tooltip/右键菜单/顶部按钮扩展"
```

---

## T10: CharacterPanel 右键菜单扩展

**Files:**
- Modify: `src/ui/panels/CharacterPanel.js`

`_showCharContextMenu` 加：
```js
addOpt('🔨 强化', '#ffdd66', () => this.openEnhanceModal?.(equipped));
addOpt('♻ 洗练', '#66ccff', () => this.openReforgeModal?.(equipped));
if (equipped.sockets && equipped.sockets.length > 0) {
  addOpt('💎 镶嵌', '#aa88ff', () => this.openSocketModal?.(equipped));
}
addOpt('📥 卸下', '#aaccff', () => { ... });
```

```bash
git add src/ui/panels/CharacterPanel.js
git commit -m "feat(equipment-p2): CharacterPanel 右键菜单加洗练/镶嵌"
```

---

## T11: SaveSystem 兼容 sockets

**Files:**
- Modify: `src/systems/SaveSystem.js`

在 load 兼容代码块加 sockets 字段补全：

```js
// equipment / inventory 装备 instance 兼容
for (eq) {
  if (!Array.isArray(it.sockets)) it.sockets = [];
  // 老 instance 没孔位，默认 [] 即 0 孔；不补加默认孔位
}
```

```bash
git add src/systems/SaveSystem.js
git commit -m "feat(save-p2): 兼容老存档 sockets 字段"
```

---

## T12: build + 浏览器全流程验收

**验收清单：**
1. 杀几只 boss → 掉 mythic 装备，sockets 数 4
2. 杀普通怪 → 掉 lv1 宝石（红蓝绿黄），背包能堆叠
3. 顶部 [💎 合成] → 选 3 颗同款 → 合成 lv2 宝石
4. 装备右键 → 镶嵌 → 选宝石 → 槽位生效（角色面板属性变化）
5. 拆卸 → 宝石回背包
6. 装备右键 → 洗练 → 锁定 1 词条 → 重 roll → 锁定不变其他变
7. 顶部 [🛠 制作] → 选钢剑配方 → 材料够 → 制作成功，背包获得装备
8. 装备带 fire_on_hit_t2 词条 → 攻击敌人 → 看到 🔥XX 飘字
9. 击杀敌人，装备带 heal_on_kill_t2 → 回血
10. 满足 mythic 装备 4 孔全镶 + 触发型词条 + 强化 +15 → 终极成型
11. 老存档加载 → sockets 默认 [] 不报错
12. 装备 tooltip 显示孔位行 + 触发型词条特殊行

**最终 commit + push（用户决定）。**

---

## 不在 Phase 2 范围（明确推迟到 Phase 3）

- ❌ 套装系统（2/4/6 件套）
- ❌ 顶级材料 divine_heart / world_core
- ❌ 完美词条追求保底
- ❌ 商店/交易
- ❌ 装备绑定
- ❌ crit 系统（lifesteal_on_crit 触发器目前无法触发）
